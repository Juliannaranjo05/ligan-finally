<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Mail\VerifyCode;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use App\Models\UserOnlineStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Sanctum\PersonalAccessToken;



class AuthController extends Controller
{
    public function registerModel(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|string|email|unique:users',
                'password' => 'required|string|min:6',
            ]);

            // ✅ Luego crear el usuario
            $code = random_int(100000, 999999);
            $expiration = Carbon::now()->addMinutes(15);
            
            // Detectar país (sin bloquear si falla)
            try {
                $locationData = $this->detectarPais();
            } catch (\Exception $locationError) {
                Log::warning('Error detectando país en registro: ' . $locationError->getMessage());
                $locationData = null;
            }

            $user = User::create([
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'code_verify' => $code,
                'code_expires_at' => $expiration,
                'verification_expires_at' => Carbon::now()->addHours(24), // ⏳ expira en 24 horas
            ]);

            $token = $user->createToken('ligand-token')->plainTextToken;

            // Validar configuración de correo antes de enviar
            $mailDriver = config('mail.default');
            $mailHost = config('mail.mailers.smtp.host');
            $mailUsername = config('mail.mailers.smtp.username');
            $mailPassword = config('mail.mailers.smtp.password');
            
            $emailSent = false;
            $emailError = null;
            
            if ($mailDriver === 'smtp' && (!$mailHost || !$mailUsername || !$mailPassword)) {
                Log::error('❌ Configuración de correo incompleta', [
                    'mail_driver' => $mailDriver,
                    'mail_host' => $mailHost ? 'configured' : 'NOT SET',
                    'mail_username' => $mailUsername ? 'configured' : 'NOT SET',
                    'mail_password' => $mailPassword ? 'configured' : 'NOT SET'
                ]);
                $emailError = 'Configuración de correo incompleta en el servidor';
            } else {
                // Enviar correo de verificación
            try {
                    Log::info('📤 Enviando correo de verificación', [
                        'email' => $user->email,
                        'code' => $code,
                        'mail_driver' => $mailDriver,
                        'mail_host' => $mailHost,
                        'mail_port' => config('mail.mailers.smtp.port'),
                        'mail_encryption' => config('mail.mailers.smtp.encryption'),
                        'mail_username' => $mailUsername ? substr($mailUsername, 0, 3) . '***' : 'NOT SET'
                    ]);
                Mail::to($user->email)->send(new VerifyCode($code));
                    $emailSent = true;
                    Log::info('✅ Correo enviado exitosamente a ' . $user->email);
            } catch (\Throwable $mailError) {
                    $emailError = $mailError->getMessage();
                    $isAuthError = strpos($emailError, 'authentication failed') !== false || 
                                  strpos($emailError, '535') !== false ||
                                  strpos($emailError, 'authentication') !== false;
                    
                    Log::error('❌ Error enviando correo de verificación', [
                        'email' => $user->email,
                        'error' => $emailError,
                        'error_class' => get_class($mailError),
                        'trace' => $mailError->getTraceAsString(),
                        'is_auth_error' => $isAuthError,
                        'mail_host' => $mailHost,
                        'mail_port' => config('mail.mailers.smtp.port'),
                        'mail_encryption' => config('mail.mailers.smtp.encryption')
                    ]);
                }
            }

            // Retornar respuesta con información sobre el estado del correo
            $response = [
                'message' => 'Registro exitoso',
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => $user->toArray(),
                'email_sent' => $emailSent,
            ];
            
            if (!$emailSent) {
                $response['email_warning'] = 'El registro fue exitoso, pero no se pudo enviar el correo de verificación. Por favor, usa la opción "Reenviar código" o contacta al soporte.';
                Log::warning('⚠️ Registro exitoso pero correo no enviado', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'error' => $emailError
                ]);
            }

            return response()->json($response);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('❌ Error en registro: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Error al registrar usuario. Por favor intenta nuevamente.',
                'error' => config('app.debug') ? $e->getMessage() : 'Error interno del servidor'
            ], 500);
        }
    }

    public function detectarPais($ip = null)
    {
        try {
            $ip = $ip ?? request()->ip();
            
            // Servicio gratuito ipapi.co (1000 requests/día gratis)
            $response = Http::get("http://ipapi.co/{$ip}/json/");
            
            if ($response->successful()) {
                $data = $response->json();
                return [
                    'country_code' => $data['country'] ?? null,
                    'country_name' => $data['country_name'] ?? null,
                    'city' => $data['city'] ?? null,
                    'region' => $data['region'] ?? null
                ];
            }
        } catch (\Exception $e) {
            Log::error('Error detectando país: ' . $e->getMessage());
        }
        
        return null;
    }

    public function loginModel(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // 🔍 VALIDACIÓN 1: Verificar si el usuario existe
        $user = User::where('email', $request->email)->first();
        
        if (!$user) {
            Log::info("❌ Intento de login con email inexistente: {$request->email}");
            return response()->json([
                'message' => 'No existe una cuenta registrada con este correo electrónico'
            ], 404);
        }

        // 🔍 VALIDACIÓN 2: Verificar si la contraseña es correcta
        if (!Hash::check($request->password, $user->password)) {
            Log::info("❌ Contraseña incorrecta para: {$request->email}");
            return response()->json([
                'message' => 'La contraseña ingresada es incorrecta'
            ], 401);
        }

        // ✅ CREDENCIALES CORRECTAS - Login permitido
        // PERO si no está verificado, no podrá usar otras funciones (se valida en cada endpoint)

        // 🔥 SUSPENDER SESIÓN ANTERIOR en lugar de eliminarla
        $tokenAnteriorId = $user->current_access_token_id;
        
        if ($tokenAnteriorId) {
            $previousToken = \Laravel\Sanctum\PersonalAccessToken::find($tokenAnteriorId);
            if ($previousToken) {
                Log::info("⏸️ Suspendiéndo sesión anterior para {$user->email}", [
                    'token_anterior_id' => $tokenAnteriorId,
                    'ip' => $request->ip()
                ]);
                
                // Marcar token anterior como suspendido en lugar de eliminarlo
                $previousToken->update(['status' => 'suspended']);
            }
        }

        // ✅ Generar nuevo token con status 'active'
        $token = $user->createToken('ligand-token')->plainTextToken;
        $tokenId = explode('|', $token)[0];
        
        // Asegurar que el nuevo token tenga status 'active'
        $newToken = \Laravel\Sanctum\PersonalAccessToken::find($tokenId);
        if ($newToken) {
            $newToken->update(['status' => 'active']);
        }

        // ✅ Actualizar con el nuevo token
        $user->current_access_token_id = $tokenId;
        $user->save();
        
        Log::info("✅ Nuevo token creado para {$user->email}", [
            'nuevo_token_id' => $tokenId,
            'token_anterior_suspendido' => $tokenAnteriorId ? 'sí' : 'no'
        ]);

        // Marcar como online
        $user->markAsOnline(
            session()->getId(),
            request()->ip(),
            request()->userAgent()
        );

        Log::info("✅ Login exitoso para {$user->email} - Email verificado: " . ($user->email_verified_at ? 'SÍ' : 'NO'));

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->toArray(),
            'signup_step' => $user->signup_step,
            'message' => 'Inicio de sesión exitoso',
            'email_verified' => !is_null($user->email_verified_at) // Para que frontend sepa el estado
        ]);
    }


    

    public function logout(Request $request)
    {
        $user = $request->user();

        // Eliminar solo el token actual
        $user->tokens()->where('id', $user->current_access_token_id)->delete();

        $user->current_access_token_id = null;
        $user->save();

        $user->markAsOffline();

        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }
    
    public function asignarRol(Request $request)
    {
        try {
            $user = $request->user(); 
            
            if (!$user) {
                return response()->json(['message' => 'Usuario no autenticado.'], 401);
            }
            
            if (!$user->email_verified_at) {
                return response()->json(['message' => 'Correo no verificado.'], 403);
            }

            // 🔥 VALIDACIÓN DIFERENTE SEGÚN EL ORIGEN DEL USUARIO
            if ($user->google_id) {
            // 👤 USUARIO DE GOOGLE: Solo validar que no tenga ROL
            if ($user->rol) {
                return response()->json(['message' => 'Ya tienes un rol asignado.'], 403);
            }
            
                Log::info('🔵 Usuario de Google asignando rol', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'name_google' => $user->name, // Ya viene de Google
                    'rol_actual' => $user->rol
                ]);
                
            } else {
                    // 📧 USUARIO NORMAL: 
                // - Si tiene rol Y nombre: rechazar (ya completo)
                // - Si tiene rol pero NO nombre: permitir completar nombre (y validar que el rol coincida)
                // - Si no tiene rol ni nombre: permitir asignar ambos
                
                if ($user->rol && $user->name) {
                    return response()->json(['message' => 'Ya tienes un rol asignado.'], 403);
                }
                
                // Si tiene rol pero no nombre, validar que el rol enviado coincida
                if ($user->rol && !$user->name) {
                    $request->validate([
                        'rol' => 'required|in:modelo,cliente',
                        'name' => ['required', 'string', 'max:255', 'regex:/^[\pL\s]+$/u'],
                    ]);
                    
                    // Validar que el rol enviado coincida con el rol existente
                    if ($request->rol !== $user->rol) {
                        return response()->json(['message' => 'El rol enviado no coincide con tu rol actual.'], 403);
                    }
                    
                    // Solo actualizar el nombre, mantener el rol existente
                    $user->update([
                        'name' => $request->name,
                    ]);
                    
                    Log::info('📧 Usuario normal completando nombre', [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'rol_actual' => $user->rol,
                        'name_anterior' => null,
                        'name_nuevo' => $request->name
                    ]);
                    
                    return response()->json([
                        'message' => 'Nombre actualizado correctamente.',
                        'user' => [
                            'id' => $user->id,
                            'email' => $user->email,
                            'name' => $user->name,
                            'rol' => $user->rol,
                            'is_google_user' => false
                        ]
                    ]);
                }
                
                Log::info('📧 Usuario normal asignando rol', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'rol_actual' => $user->rol,
                    'name_actual' => $user->name
                ]);
            }

            // 🔥 VALIDACIÓN DE REQUEST DIFERENTE
            if ($user->google_id) {
                // Usuario de Google: Solo validar ROL (ya tiene nombre)
                $request->validate([
                    'rol' => 'required|in:modelo,cliente',
                ]);
                
                // Solo actualizar el rol, mantener el nombre de Google
                $user->update([
                    'rol' => $request->rol,
                ]);
                
            } else {
                // Usuario normal: Validar ROL y NAME
                $request->validate([
                    'rol' => 'required|in:modelo,cliente',
                    'name' => ['required', 'string', 'max:255', 'regex:/^[\pL\s]+$/u'],
                ]);
                
                // Actualizar ambos campos
                $user->update([
                    'rol' => $request->rol,
                    'name' => $request->name,
                ]);
            }

            return response()->json([
                'message' => 'Rol asignado correctamente.',
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                    'name' => $user->name,
                    'rol' => $user->rol,
                    'is_google_user' => !is_null($user->google_id)
                ]
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('❌ Error en asignarRol: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            Log::error('Request data: ' . json_encode($request->all()));
            $userId = $request->user() ? $request->user()->id : 'null';
            Log::error('User ID: ' . $userId);
            return response()->json([
                'message' => 'Error al asignar rol. Por favor intenta nuevamente.',
                'error' => config('app.debug') ? $e->getMessage() : 'Error interno del servidor'
            ], 500);
        }
    }
    public function verifyCode(Request $request)
    {
        Log::info('📥 verifyCode() fue invocado');

        $request->validate([
            'email' => 'required|email',
            'code' => 'required|digits:6',
        ]);

        Log::info('📩 VerifyCode request', ['data' => $request->all()]);

        $user = User::where('email', $request->email)
                    ->where('code_verify', $request->code)
                    ->first();

        Log::info('🔍 Buscando usuario con', [
            'email' => $request->email,
            'code' => $request->code,
            'encontrado' => $user
        ]);

        if (!$user) {
            return response()->json(['message' => 'Código incorrecto.'], 422);
        }

        // ✅ Si ya estaba verificado, solo informar
        if ($user->email_verified_at) {
            return response()->json(['message' => 'Correo ya verificado.']);
        }

        // ✅ Marcar como verificado
        $user->email_verified_at = now();
        $user->code_verify = null; // Opcional: limpia el código ya usado
        $user->save();

        Log::info("✅ Correo verificado exitosamente para {$user->email}");

        return response()->json(['message' => 'Correo verificado correctamente.']);
    }

    public function resendCode(Request $request)
    {
        Log::info('🔐 Intento de reenvío', [
        'ip' => $request->ip(),
        'user_agent' => $request->userAgent(),
        'email' => $request->email,
            'has_auth' => auth('sanctum')->check()
        ]);
        
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            Log::warning('❌ Intento de reenvío para email no registrado', ['email' => $request->email]);
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }

        // Si está bloqueado por muchos reintentos
        if ($user->resend_blocked_until && now()->lessThan($user->resend_blocked_until)) {
            $minutosRestantes = now()->diffInMinutes($user->resend_blocked_until);
            Log::warning('⚠️ Usuario bloqueado por reenvíos', [
                'email' => $user->email,
                'minutos_restantes' => $minutosRestantes
            ]);
            return response()->json([
                'message' => "Has alcanzado el límite de reenvíos. Intenta de nuevo en $minutosRestantes minutos."
            ], 429);
        }

        // Si superó los 3 reenvíos, se bloquea 10 minutos
        if ($user->resend_attempts >= 3) {
            $user->resend_attempts = 0;
            $user->resend_blocked_until = now()->addMinutes(10);
            $user->save();

            Log::warning('⚠️ Usuario bloqueado por exceso de reenvíos', ['email' => $user->email]);
            return response()->json([
                'message' => 'Has alcanzado el límite de reenvíos. Espera 10 minutos para intentarlo de nuevo.'
            ], 429);
        }

        // Generar nuevo código
        $newCode = random_int(100000, 999999);
        $user->code_verify = $newCode;
        $user->code_expires_at = now()->addMinutes(15);
        $user->resend_attempts += 1;
        $user->save();

        Log::info('📝 Nuevo código generado', [
            'user_id' => $user->id,
            'email' => $user->email,
            'code' => $newCode,
            'expires_at' => $user->code_expires_at->toISOString(),
            'resend_attempts' => $user->resend_attempts
        ]);

        // Validar configuración de correo
        $mailDriver = config('mail.default');
        $mailHost = config('mail.mailers.smtp.host');
        $mailUsername = config('mail.mailers.smtp.username');
        $mailPassword = config('mail.mailers.smtp.password');
        
        if ($mailDriver === 'smtp' && (!$mailHost || !$mailUsername || !$mailPassword)) {
            Log::error('❌ Configuración de correo incompleta en reenvío', [
                'mail_driver' => $mailDriver,
                'mail_host' => $mailHost ? 'configured' : 'NOT SET',
                'mail_username' => $mailUsername ? 'configured' : 'NOT SET',
                'mail_password' => $mailPassword ? 'configured' : 'NOT SET'
            ]);
            return response()->json([
                'message' => 'Error de configuración del servidor de correo. Por favor, contacta al soporte.',
                'error' => 'Mail configuration incomplete'
            ], 500);
        }

        try {
            Log::info('📤 Reenviando código de verificación', [
                'email' => $user->email,
                'code' => $newCode,
                'mail_driver' => $mailDriver,
                'mail_host' => $mailHost,
                'mail_port' => config('mail.mailers.smtp.port'),
                'mail_encryption' => config('mail.mailers.smtp.encryption'),
                'mail_username' => $mailUsername ? substr($mailUsername, 0, 3) . '***' : 'NOT SET'
            ]);
            Mail::to($user->email)->send(new VerifyCode($newCode));
            Log::info('✅ Código reenviado exitosamente a ' . $user->email);
        } catch (\Throwable $e) {
            $errorMessage = $e->getMessage();
            $isAuthError = strpos($errorMessage, 'authentication failed') !== false || 
                          strpos($errorMessage, '535') !== false ||
                          strpos($errorMessage, 'authentication') !== false;
            
            Log::error('❌ Error reenviando código', [
                'message' => $errorMessage,
                'error_class' => get_class($e),
                'trace' => $e->getTraceAsString(),
                'email' => $user->email,
                'code' => $newCode,
                'mail_host' => $mailHost,
                'mail_port' => config('mail.mailers.smtp.port'),
                'mail_encryption' => config('mail.mailers.smtp.encryption'),
                'is_auth_error' => $isAuthError
            ]);
            
            // Mensaje más específico según el tipo de error
            if ($isAuthError) {
            return response()->json([
                    'message' => 'Error de autenticación con el servidor de correo. Por favor, verifica la configuración de correo en el servidor.',
                    'error' => config('app.debug') ? 'SMTP Authentication failed. Check MAIL_USERNAME and MAIL_PASSWORD in .env file.' : null
            ], 500);
        }

            return response()->json([
                'message' => 'Error al reenviar el código. Por favor, verifica tu conexión e intenta de nuevo más tarde.',
                'error' => config('app.debug') ? $errorMessage : null
            ], 500);
        }

        return response()->json([
            'message' => 'Código reenviado exitosamente.',
            'expires_at' => $user->code_expires_at->toISOString()
        ]);
    }
    public function eliminarNoVerificado(Request $request)
    {
        $user = $request->user();

        if ($user->email_verified_at) {
            return response()->json(['message' => 'No se puede eliminar un usuario ya verificado.'], 403);
        }

        // Elimina el usuario
        $user->tokens()->delete(); // Elimina tokens
        $user->delete();

        return response()->json(['message' => 'Usuario eliminado correctamente.']);
    }
    public function markOnline(Request $request)
    {
        $user = auth()->user();
        $user->markAsOnline(
            session()->getId(),
            $request->ip(),
            $request->userAgent()
        );
        
        return response()->json(['status' => 'online', 'user_id' => $user->id]);
    }

    public function heartbeat(Request $request)
    {
        try {
            $user = auth()->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'No autenticado'
                ], 401);
            }

            // 🔥 VERIFICAR ESTADO DEL TOKEN (NUEVO) - Detectar sesión suspendida
            $currentToken = $request->bearerToken();
            if ($currentToken && str_contains($currentToken, '|')) {
                $tokenId = explode('|', $currentToken)[0];
                $tokenModel = PersonalAccessToken::find($tokenId);
                
                if ($tokenModel && $tokenModel->status === 'suspended') {
                    Log::info("⏸️ Heartbeat detectó sesión suspendida para {$user->email}", [
                        'token_id' => $tokenId,
                        'ip' => $request->ip(),
                        'user_agent' => substr($request->userAgent(), 0, 100)
                    ]);
                    
                    return response()->json([
                        'success' => false,
                        'message' => 'Tu sesión ha sido suspendida',
                        'code' => 'SESSION_SUSPENDED',
                        'reason' => 'Se abrió una nueva sesión en otro dispositivo',
                        'action' => 'show_modal' // 🔥 Flag para mostrar modal (no cerrar inmediatamente)
                    ], 403);
                }
            }

            // Obtener parámetros
            $activityType = $request->input('activity_type', 'browsing');
            $room = $request->input('room');
            
            // 🔥 MAPEAR ACTIVIDADES ESPECÍFICAS
            $activityTypeMap = [
                'searching' => 'searching',
                'browsing' => 'browsing', 
                'videochat' => 'videochat',
                'videochat_client' => 'videochat_client',
                'videochat_model' => 'videochat_model',
                'idle' => 'idle'
            ];
            
            $finalActivityType = $activityTypeMap[$activityType] ?? 'browsing';

            Log::info('💓 Heartbeat recibido', [
                'user_id' => $user->id,
                'activity_type' => $finalActivityType,
                'room' => $room,
                'timestamp' => now()->toISOString()
            ]);

            // 🔥 USAR MÉTODO MEJORADO - CON MANEJO DE ERRORES ROBUSTO
            try {
                $userStatus = UserOnlineStatus::firstOrCreate(
                    ['user_id' => $user->id],
                    [
                        'is_online' => true,
                        'last_seen' => now(),
                        'connected_at' => now(),
                        'activity_type' => $finalActivityType,
                        'current_room' => $room ?: null
                    ]
                );

                // Actualizar heartbeat de forma segura
                if ($userStatus && method_exists($userStatus, 'updateHeartbeatSafe')) {
                    $updated = $userStatus->updateHeartbeatSafe($room ?: null, $finalActivityType);
                    
                    if (!$updated) {
                        Log::warning('⚠️ updateHeartbeatSafe retornó false, pero continuando', [
                            'user_id' => $user->id
                        ]);
                        // No fallar, solo continuar
                    }
                } else {
                    // Fallback si el método no existe
                    $userStatus->update([
                        'last_seen' => now(),
                        'activity_type' => $finalActivityType,
                        'current_room' => $room ?: null,
                        'is_online' => true
                    ]);
                }
            } catch (\Illuminate\Database\QueryException $dbError) {
                Log::error('❌ Error de base de datos creando/actualizando UserOnlineStatus', [
                    'user_id' => $user->id,
                    'error' => $dbError->getMessage(),
                    'sql' => $dbError->getSql() ?? 'N/A'
                ]);
                // Continuar sin lanzar excepción
            } catch (\Exception $updateError) {
                Log::error('❌ Error creando/actualizando UserOnlineStatus', [
                    'user_id' => $user->id,
                    'error' => $updateError->getMessage()
                ]);
                // No fallar, solo continuar
            }

            // 🔥 EJECUTAR LIMPIEZA PERIÓDICA (cada 10 heartbeats aproximadamente)
            if (rand(1, 10) === 1) {
                try {
                    UserOnlineStatus::cleanupZombieUsers(5);
                } catch (\Exception $cleanupError) {
                    // No fallar el heartbeat por errores en cleanup
                    Log::warning('⚠️ Error en cleanup de usuarios zombie', [
                        'error' => $cleanupError->getMessage(),
                        'user_id' => $user->id
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Heartbeat registrado correctamente',
                'user_id' => $user->id,
                'activity_type' => $finalActivityType,
                'room' => $room,
                'timestamp' => now()->toISOString()
            ]);

        } catch (\Illuminate\Database\QueryException $dbError) {
            Log::error('❌ Error de base de datos en heartbeat', [
                'user_id' => auth()->id() ?? 'null',
                'error' => $dbError->getMessage(),
                'sql' => $dbError->getSql() ?? 'N/A'
            ]);

            // 🔥 IMPORTANTE: Devolver 200 con success=false para errores de BD
            return response()->json([
                'success' => false,
                'error' => 'Error de base de datos',
                'message' => 'El heartbeat no pudo ser procesado, pero la sesión sigue activa'
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('❌ Error en heartbeat', [
                'user_id' => auth()->id() ?? 'null',
                'error' => $e->getMessage(),
                'stack_trace' => $e->getTraceAsString()
            ]);

            // 🔥 IMPORTANTE: No devolver 500 para errores de heartbeat
            // Devolver 200 con success=false para que no dispare modales de sesión cerrada
            return response()->json([
                'success' => false,
                'error' => 'Error procesando heartbeat',
                'message' => 'El heartbeat no pudo ser procesado, pero la sesión sigue activa'
            ], 200); // 🔥 CAMBIAR A 200 en lugar de 500
        }
    }

    // 🔥 OPCIONAL: ENDPOINT PARA ESTADÍSTICAS DE DEBUG
    public function getOnlineStats(Request $request)
    {
        try {
            $stats = UserOnlineStatus::getStatusStats();
            
            return response()->json([
                'success' => true,
                'stats' => $stats,
                'timestamp' => now()->toISOString()
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error obteniendo estadísticas online', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo estadísticas'
            ], 500);
        }
    }
    
    public function resetPassword(Request $request)
    {
        Log::info('🔐 Reset Password llamado', $request->all());

        try {
            $request->validate([
                'token' => 'required',
                'email' => 'required|email',
                'password' => 'required|confirmed|min:8',
            ]);

            $passwordReset = DB::table('password_resets')
                ->where('email', $request->email)
                ->first();

            if (!$passwordReset) {
                return response()->json(['message' => 'Token inválido o expirado.'], 422);
            }

            if (!Hash::check($request->token, $passwordReset->token)) {
                return response()->json(['message' => 'Token inválido.'], 422);
            }

            if (\Carbon\Carbon::parse($passwordReset->created_at)->addMinutes(60)->isPast()) {
                return response()->json(['message' => 'El token ha expirado.'], 422);
            }

            $user = \App\Models\User::where('email', $request->email)->first();

            if (!$user) {
                return response()->json(['message' => 'Usuario no encontrado.'], 422);
            }

            $user->password = Hash::make($request->password);
            $user->remember_token = Str::random(60);
            $user->save();

            DB::table('password_resets')->where('email', $request->email)->delete();

            Log::info('Password reset successful', ['email' => $request->email]);

            return response()->json(['message' => 'Contraseña restablecida correctamente.']);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Datos inválidos.', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('❌ Excepción inesperada en reset-password', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['message' => 'Error interno del servidor.'], 500);
        }
    }
    public function sendVerificationEmail(Request $request)
    {
        // Validar que el usuario esté autenticado
        $user = auth()->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        // Validar entrada
        $request->validate([
            'reason' => 'required|string|max:255',
            'message' => 'required|string',
            // Eliminamos la validación de email porque se usará el del usuario autenticado
        ]);

        // Datos reales del usuario autenticado
        $email = $user->email;
        $reason = $request->reason;
        $message = $request->message;

        // Enviar correo
        Mail::to('support@ligand.app')->send(new \App\Mail\VerifyCode($email, $reason, $message));

        return response()->json(['message' => 'Reporte enviado correctamente']);
    }

    public function getModelInfo(Request $request, $modelId)
    {
        try {
            // Validar que el usuario esté autenticado
            $user = auth()->user();
            if (!$user) {
                return response()->json(['message' => 'No autenticado'], 401);
            }

            // Buscar el modelo
            $model = User::where('id', $modelId)
                        ->where('rol', 'modelo')
                        ->where('email_verified_at', '!=', null)
                        ->with(['onlineStatus'])
                        ->first();

            if (!$model) {
                return response()->json([
                    'success' => false,
                    'message' => 'Modelo no encontrado'
                ], 404);
            }

            // Formatear respuesta
            $modelInfo = [
                'id' => $model->id,
                'name' => $model->name,
                'avatar' => $model->avatar,
                'online' => $model->onlineStatus && $model->onlineStatus->is_online 
                        && $model->onlineStatus->last_seen >= now()->subMinutes(5),
                'last_seen' => $model->onlineStatus ? $model->onlineStatus->last_seen : null,
                'activity_type' => $model->onlineStatus ? $model->onlineStatus->activity_type : null,
                // Agregar más información del perfil según necesites
            ];

            return response()->json([
                'success' => true,
                'data' => $modelInfo
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error obteniendo información del modelo', [
                'model_id' => $modelId,
                'user_id' => auth()->id() ?? 'null',
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor'
            ], 500);
        }
    }
     public function redirectToGoogle()
    {
        try {
            $url = Socialite::driver('google')
                ->stateless() // Para APIs sin sesión
                ->with([
                    'access_type' => 'offline',
                    'prompt' => 'consent select_account'
                ])
                ->redirect()
                ->getTargetUrl();

            return response()->json([
                'success' => true,
                'auth_url' => $url
            ]);
        } catch (\Exception $e) {
            Log::error('❌ Error generando URL de Google: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al generar URL de Google'
            ], 500);
        }
    }

    /**
     * Maneja el callback de Google
     */
    public function handleGoogleCallback(Request $request)
    {
        try {
            Log::info('🔵 Google callback recibido', [
                'query_params' => $request->query(),
                'all_params' => $request->all()
            ]);

            // Validar que viene el código
            if (!$request->has('code')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Código de autorización no recibido'
                ], 400);
            }

            // Obtener usuario de Google
            $googleUser = Socialite::driver('google')
                ->stateless()
                ->user();

            Log::info('👤 Datos de Google recibidos', [
                'google_id' => $googleUser->id,
                'email' => $googleUser->email,
                'name' => $googleUser->name,
                'avatar' => $googleUser->avatar
            ]);

            // Buscar usuario existente por email
            $user = User::where('email', $googleUser->email)->first();

            if ($user) {
                // Usuario existe - actualizar datos de Google
                Log::info("🔄 Actualizando usuario existente: {$user->email}");
                
                try {
                    // 🔥 PRESERVAR AVATAR LOCAL: Solo actualizar avatar de Google si el usuario NO tiene avatar local
                    $avatarToSet = $user->avatar; // Mantener avatar actual por defecto
                    
                    // Verificar si el avatar actual es de Google o es un archivo local
                    $isCurrentAvatarGoogle = $this->isGoogleAvatar($user->avatar);
                    
                    // Solo actualizar avatar si:
                    // 1. No tiene avatar (null), O
                    // 2. El avatar actual es de Google (puede actualizarse)
                    if (!$user->avatar || $isCurrentAvatarGoogle) {
                        $avatarToSet = $googleUser->avatar;
                        Log::info("🔄 Actualizando avatar con el de Google", [
                            'avatar_anterior' => $user->avatar,
                            'avatar_nuevo' => $googleUser->avatar,
                            'razon' => !$user->avatar ? 'no_tenia_avatar' : 'avatar_era_de_google'
                        ]);
                    } else {
                        Log::info("✅ Preservando avatar local del usuario (no se sobrescribe con Google)", [
                            'avatar_actual' => $user->avatar
                        ]);
                    }
                    
                    $user->update([
                        'google_id' => $googleUser->id,
                        'avatar' => $avatarToSet, // 🔥 Usar avatar preservado o de Google
                        'email_verified_at' => $user->email_verified_at ?: now(),
                    ]);
                    
                    // Verificar que se actualizó
                    $user->refresh();
                    Log::info("✅ Usuario actualizado correctamente. Email verificado: " . ($user->email_verified_at ? 'SÍ' : 'NO'));
                    
                } catch (\Exception $updateError) {
                    Log::error("❌ Error actualizando usuario: " . $updateError->getMessage());
                    throw $updateError;
                }

            } else {
                // Usuario nuevo - crear cuenta
                Log::info("🆕 Creando usuario nuevo: {$googleUser->email}");
                
                try {
                    $userData = [
                        'email' => $googleUser->email,
                        'name' => $googleUser->name,
                        'google_id' => $googleUser->id,
                        'avatar' => $googleUser->avatar,
                        'email_verified_at' => now(),
                        'password' => Hash::make(Str::random(16)),
                    ];
                    
                    Log::info("📝 Datos para crear usuario:", $userData);
                    
                    $user = User::create($userData);
                    
                    if ($user) {
                        Log::info("✅ Usuario creado exitosamente con ID: {$user->id}");
                        
                        // Verificar que realmente se creó
                        $verifyUser = User::find($user->id);
                        if ($verifyUser) {
                            Log::info("✅ Verificación: Usuario existe en BD con email: {$verifyUser->email}");
                        } else {
                            Log::error("❌ Usuario creado pero no se puede encontrar en BD");
                        }
                    } else {
                        Log::error("❌ User::create() retornó null");
                        throw new \Exception("Error creando usuario - create() retornó null");
                    }
                    
                } catch (\Exception $createError) {
                    Log::error("❌ Error creando usuario: " . $createError->getMessage());
                    Log::error("Stack trace: " . $createError->getTraceAsString());
                    
                    // Verificar problemas comunes
                    Log::error("Fillable fields: " . json_encode((new User())->getFillable()));
                    
                    throw $createError;
                }
            }

            if (!$user) {
                Log::error("❌ Usuario es null después del proceso");
                throw new \Exception("Usuario es null después del proceso de creación/actualización");
            }

            // 🔥 SUSPENDER SESIÓN ANTERIOR en lugar de eliminarla (Google OAuth)
            $tokenAnteriorId = $user->current_access_token_id;
            
            if ($tokenAnteriorId) {
                $previousToken = \Laravel\Sanctum\PersonalAccessToken::find($tokenAnteriorId);
                if ($previousToken) {
                    Log::info("⏸️ Suspendiéndo sesión anterior para {$user->email} (Google OAuth)", [
                        'token_anterior_id' => $tokenAnteriorId,
                        'ip' => $request->ip()
                    ]);
                    
                    // Marcar token anterior como suspendido en lugar de eliminarlo
                    $previousToken->update(['status' => 'suspended']);
                }
            }

            // ✅ Generar nuevo token con status 'active'
            $token = $user->createToken('ligand-token')->plainTextToken;
            $tokenId = explode('|', $token)[0];
            
            // Asegurar que el nuevo token tenga status 'active'
            $newToken = \Laravel\Sanctum\PersonalAccessToken::find($tokenId);
            if ($newToken) {
                $newToken->update(['status' => 'active']);
            }

            // ✅ Actualizar con el nuevo token
            $user->current_access_token_id = $tokenId;
            $user->save();
            
            Log::info("✅ Nuevo token creado para {$user->email} (Google OAuth)", [
                'nuevo_token_id' => $tokenId,
                'token_anterior_suspendido' => $tokenAnteriorId ? 'sí' : 'no',
                'es_usuario_nuevo' => $user->wasRecentlyCreated
            ]);

            // Marcar como online
            $user->markAsOnline(
                session()->getId(),
                request()->ip(),
                request()->userAgent()
            );

            Log::info("🎉 Proceso completado exitosamente para usuario ID: {$user->id}");

            return response()->json([
                'success' => true,
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => $user->toArray(),
                'signup_step' => $user->signup_step,
                'message' => $user->wasRecentlyCreated ? 'Cuenta creada con Google' : 'Inicio de sesión exitoso',
                'email_verified' => true
            ]);

        } catch (\Laravel\Socialite\Two\InvalidStateException $e) {
            Log::error('❌ Estado inválido en Google OAuth: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Estado de autenticación inválido. Intenta de nuevo.'
            ], 400);
        } catch (\Exception $e) {
            Log::error('❌ Error en Google callback: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar autenticación con Google: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Desvincula cuenta de Google
     */
    public function unlinkGoogle(Request $request)
    {
        $user = $request->user();

        if (!$user->google_id) {
            return response()->json([
                'success' => false,
                'message' => 'No tienes una cuenta de Google vinculada'
            ], 400);
        }

        if (!$user->password || !Hash::check('', $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Debes establecer una contraseña antes de desvincular Google'
            ], 400);
        }

        $user->update([
            'google_id' => null,
            'avatar' => null
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cuenta de Google desvinculada correctamente'
        ]);
    }

    /**
     * Verificar si el avatar es de Google
     */
    private function isGoogleAvatar($filename)
    {
        if (!$filename) return false;
        
        return str_contains($filename, 'googleusercontent.com') || 
               str_contains($filename, 'googleapis.com') ||
               str_contains($filename, 'google.com');
    }
}

