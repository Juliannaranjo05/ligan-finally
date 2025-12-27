<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\User;
use App\Mail\SecurityVerificationCode;
use App\Mail\PasswordSetupLink;

class SecurityController extends Controller
{
    // 🔐 SOLICITAR CÓDIGO PARA CAMBIAR CONTRASEÑA
    public function requestPasswordChangeCode(Request $request)
    {
        try {
            $user = $request->user();
            
            $request->validate([
                'current_password' => 'required|string'
            ]);

            // Verificar contraseña actual
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'error' => 'La contraseña actual es incorrecta'
                ], 422);
            }

            // Generar código de verificación
            $code = random_int(100000, 999999);
            $expiration = Carbon::now()->addMinutes(15);

            // Guardar código en tabla security_codes
            DB::table('security_codes')->updateOrInsert(
                ['user_id' => $user->id, 'action_type' => 'change_password'],
                [
                    'code' => $code,
                    'expires_at' => $expiration,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // Enviar código por correo
            Mail::to($user->email)->send(new SecurityVerificationCode($code, 'change_password', $user->name));

            Log::info("📧 Código de cambio de contraseña enviado a {$user->email}");

            return response()->json([
                'success' => true,
                'message' => 'Código de verificación enviado a tu correo electrónico'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error enviando código de cambio de contraseña', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    // 🔐 CAMBIAR CONTRASEÑA CON CÓDIGO
    public function changePasswordWithCode(Request $request)
    {
        try {
            $user = $request->user();
            
            $request->validate([
                'code' => 'required|digits:6',
                'new_password' => 'required|string|min:8|confirmed'
            ]);

            // Verificar código
            $securityCode = DB::table('security_codes')
                ->where('user_id', $user->id)
                ->where('action_type', 'change_password')
                ->where('code', $request->code)
                ->where('expires_at', '>', now())
                ->first();

            if (!$securityCode) {
                return response()->json([
                    'success' => false,
                    'error' => 'Código inválido o expirado'
                ], 422);
            }

            // Cambiar contraseña
            $user->password = Hash::make($request->new_password);
            $user->save();

            // Eliminar código usado
            DB::table('security_codes')
                ->where('user_id', $user->id)
                ->where('action_type', 'change_password')
                ->delete();

            Log::info("🔐 Contraseña cambiada exitosamente para usuario {$user->email}");

            return response()->json([
                'success' => true,
                'message' => 'Contraseña cambiada exitosamente'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error cambiando contraseña', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    // 🚪 SOLICITAR CÓDIGO PARA CERRAR SESIONES
    public function requestLogoutAllCode(Request $request)
    {
        try {
            $user = $request->user();

            // Generar código de verificación
            $code = random_int(100000, 999999);
            $expiration = Carbon::now()->addMinutes(15);

            // Guardar código
            DB::table('security_codes')->updateOrInsert(
                ['user_id' => $user->id, 'action_type' => 'logout_all'],
                [
                    'code' => $code,
                    'expires_at' => $expiration,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // Enviar código por correo
            Mail::to($user->email)->send(new SecurityVerificationCode($code, 'logout_all', $user->name));

            Log::info("📧 Código de cierre de sesiones enviado a {$user->email}");

            return response()->json([
                'success' => true,
                'message' => 'Código de verificación enviado a tu correo electrónico'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error enviando código de logout', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    // 🚪 CERRAR TODAS LAS SESIONES CON CÓDIGO
    public function logoutAllWithCode(Request $request)
    {
        try {
            $user = $request->user();
            
            $request->validate([
                'code' => 'required|digits:6'
            ]);

            // Verificar código
            $securityCode = DB::table('security_codes')
                ->where('user_id', $user->id)
                ->where('action_type', 'logout_all')
                ->where('code', $request->code)
                ->where('expires_at', '>', now())
                ->first();

            if (!$securityCode) {
                return response()->json([
                    'success' => false,
                    'error' => 'Código inválido o expirado'
                ], 422);
            }

            // Cerrar todas las sesiones excepto la actual
            $currentTokenId = $user->current_access_token_id;
            
            // Eliminar todos los tokens excepto el actual
            $user->tokens()->where('id', '!=', $currentTokenId)->delete();
            
            // Marcar como offline en otros dispositivos
            $user->markAsOffline();

            // Eliminar código usado
            DB::table('security_codes')
                ->where('user_id', $user->id)
                ->where('action_type', 'logout_all')
                ->delete();

            Log::info("🚪 Sesiones cerradas exitosamente para usuario {$user->email}");

            return response()->json([
                'success' => true,
                'message' => 'Todas las sesiones han sido cerradas exitosamente'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error cerrando sesiones', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    // 🗑️ SOLICITAR CÓDIGO PARA ELIMINAR CUENTA
    public function requestDeleteAccountCode(Request $request)
    {
        try {
            $user = $request->user();
            
            $request->validate([
                'current_password' => 'required|string'
            ]);

            // Verificar contraseña actual
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'error' => 'La contraseña es incorrecta'
                ], 422);
            }

            // Generar código de verificación
            $code = random_int(100000, 999999);
            $expiration = Carbon::now()->addMinutes(15);

            // Guardar código
            DB::table('security_codes')->updateOrInsert(
                ['user_id' => $user->id, 'action_type' => 'delete_account'],
                [
                    'code' => $code,
                    'expires_at' => $expiration,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // Enviar código por correo
            Mail::to($user->email)->send(new SecurityVerificationCode($code, 'delete_account', $user->name));

            Log::info("📧 Código de eliminación de cuenta enviado a {$user->email}");

            return response()->json([
                'success' => true,
                'message' => 'Código de verificación enviado a tu correo electrónico'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error enviando código de eliminación', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    // 🗑️ ELIMINAR CUENTA CON CÓDIGO
    public function deleteAccountWithCode(Request $request)
    {
    try {
        $user = $request->user();
        
        $request->validate([
            'code' => 'required|digits:6',
            'confirmation_text' => 'required|string'
        ]);

        // Verificar texto de confirmación
        if (strtoupper($request->confirmation_text) !== 'ELIMINAR') {
            return response()->json([
                'success' => false,
                'error' => 'Debes escribir "ELIMINAR" para confirmar'
            ], 422);
        }

        // Verificar código
        $securityCode = DB::table('security_codes')
            ->where('user_id', $user->id)
            ->where('action_type', 'delete_account')
            ->where('code', $request->code)
            ->where('expires_at', '>', now())
            ->first();

        if (!$securityCode) {
            return response()->json([
                'success' => false,
                'error' => 'Código inválido o expirado'
            ], 422);
        }

        $userEmail = $user->email;
        $userId = $user->id;

        DB::transaction(function () use ($user, $userId) {
            // 1. Eliminar chat_sessions (con columnas correctas)
            DB::table('chat_sessions')
                ->where('cliente_id', $userId)
                ->orWhere('modelo_id', $userId)
                ->delete();
                
            // 2. Eliminar otras tablas
            DB::table('user_online_status')->where('user_id', $userId)->delete();
            DB::table('verificaciones')->where('user_id', $userId)->delete();
            DB::table('video_chat_sessions')->where('user_id', $userId)->delete();
            
            // 3. Eliminar datos de seguridad
            DB::table('security_codes')->where('user_id', $userId)->delete();
            $user->tokens()->delete();
            
            // 4. Eliminar usuario
            $user->delete();
        });

        Log::info("🗑️ Cuenta eliminada exitosamente: {$userEmail}");

        return response()->json([
            'success' => true,
            'message' => 'Tu cuenta ha sido eliminada permanentemente'
        ]);

    } catch (\Exception $e) {
        Log::error('❌ Error eliminando cuenta', [
            'error' => $e->getMessage(),
            'user_id' => auth()->id()
        ]);

        return response()->json([
            'success' => false,
            'error' => 'Error interno del servidor: ' . $e->getMessage()
        ], 500);
    }
}
    // 📧 REENVIAR CÓDIGO DE SEGURIDAD
    public function resendSecurityCode(Request $request)
    {
        try {
            $user = $request->user();
            
            $request->validate([
                'action_type' => 'required|in:change_password,logout_all,delete_account'
            ]);

            $actionType = $request->action_type;

            // Verificar si ya existe un código reciente (menos de 1 minuto)
            $recentCode = DB::table('security_codes')
                ->where('user_id', $user->id)
                ->where('action_type', $actionType)
                ->where('created_at', '>', now()->subMinute())
                ->first();

            if ($recentCode) {
                return response()->json([
                    'success' => false,
                    'error' => 'Debes esperar al menos 1 minuto antes de solicitar un nuevo código'
                ], 429);
            }

            // Generar nuevo código
            $code = random_int(100000, 999999);
            $expiration = Carbon::now()->addMinutes(15);

            // Actualizar código
            DB::table('security_codes')->updateOrInsert(
                ['user_id' => $user->id, 'action_type' => $actionType],
                [
                    'code' => $code,
                    'expires_at' => $expiration,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // Enviar nuevo código
            Mail::to($user->email)->send(new SecurityVerificationCode($code, $actionType, $user->name));

            Log::info("🔄 Código de seguridad reenviado", [
                'user_email' => $user->email,
                'action_type' => $actionType
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Nuevo código enviado a tu correo electrónico'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error reenviando código de seguridad', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    public function requestPasswordReset(Request $request)
{
    try {
        $request->validate([
            'email' => 'required|email'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            // Por seguridad, siempre respondemos exitosamente aunque el email no exista
            return response()->json([
                'success' => true,
                'message' => 'Si el correo existe en nuestro sistema, recibirás un enlace de restablecimiento'
            ]);
        }

        // Generar token aleatorio seguro (64 caracteres)
        $token = bin2hex(random_bytes(32));
        $expiration = Carbon::now()->addHour(); // Expira en 1 hora

        // Guardar token en tabla security_codes
        DB::table('security_codes')->updateOrInsert(
            ['user_id' => $user->id, 'action_type' => 'reset_password'],
            [
                'code' => $token,
                'expires_at' => $expiration,
                'created_at' => now(),
                'updated_at' => now()
            ]
        );

        // Crear enlace de restablecimiento
        $frontendUrl = config('app.frontend_url', env('APP_FRONTEND_URL', 'https://ligando.online'));
        $resetLink = rtrim($frontendUrl, '/') . '/reset-password?token=' . $token . '&email=' . urlencode($user->email);
        // Enviar enlace por correo
        Mail::to($user->email)->send(new \App\Mail\PasswordResetLink($resetLink, $user->name));

        Log::info("🔗 Enlace de restablecimiento enviado a {$user->email}");

        return response()->json([
            'success' => true,
            'message' => 'Si el correo existe en nuestro sistema, recibirás un enlace de restablecimiento'
        ]);

    } catch (\Exception $e) {
        Log::error('❌ Error enviando enlace de restablecimiento', [
            'error' => $e->getMessage(),
            'email' => $request->email ?? 'no proporcionado'
        ]);

        return response()->json([
            'success' => false,
            'error' => 'Error interno del servidor'
        ], 500);
    }
}

// 🔑 VALIDAR TOKEN DE RESTABLECIMIENTO
public function validateResetToken(Request $request)
{
    try {
        $request->validate([
            'token' => 'required|string|size:64', // Token debe ser exactamente 64 caracteres
            'email' => 'required|email'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'Token inválido'
            ], 422);
        }

        // Verificar token
        $resetToken = DB::table('security_codes')
            ->where('user_id', $user->id)
            ->where('action_type', 'reset_password')
            ->where('code', $request->token)
            ->where('expires_at', '>', now())
            ->first();

        if (!$resetToken) {
            return response()->json([
                'success' => false,
                'error' => 'El enlace de restablecimiento ha expirado o es inválido'
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Token válido',
            'user_name' => $user->name,
            'expires_at' => $resetToken->expires_at
        ]);

    } catch (\Exception $e) {
        Log::error('❌ Error validando token de restablecimiento', [
            'error' => $e->getMessage(),
            'email' => $request->email ?? 'no proporcionado'
        ]);

        return response()->json([
            'success' => false,
            'error' => 'Error interno del servidor'
        ], 500);
    }
}

// 🔑 RESTABLECER CONTRASEÑA CON TOKEN
public function resetPasswordWithToken(Request $request)
{
    try {
        $request->validate([
            'token' => 'required|string|size:64',
            'email' => 'required|email',
            'new_password' => 'required|string|min:8|confirmed'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'Token inválido'
            ], 422);
        }

        // Verificar token
        $resetToken = DB::table('security_codes')
            ->where('user_id', $user->id)
            ->where('action_type', 'reset_password')
            ->where('code', $request->token)
            ->where('expires_at', '>', now())
            ->first();

        if (!$resetToken) {
            return response()->json([
                'success' => false,
                'error' => 'El enlace de restablecimiento ha expirado o es inválido'
            ], 422);
        }

        // Cambiar contraseña
        $user->password = Hash::make($request->new_password);
        $user->save();

        // Cerrar todas las sesiones activas por seguridad
        $user->tokens()->delete();

        // Eliminar token usado y otros tokens de reset pendientes
        DB::table('security_codes')
            ->where('user_id', $user->id)
            ->where('action_type', 'reset_password')
            ->delete();

        Log::info("🔐 Contraseña restablecida exitosamente para {$user->email}");

        return response()->json([
            'success' => true,
            'message' => 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.'
        ]);

    } catch (\Exception $e) {
        Log::error('❌ Error restableciendo contraseña', [
            'error' => $e->getMessage(),
            'email' => $request->email ?? 'no proporcionado'
        ]);

        return response()->json([
            'success' => false,
            'error' => 'Error interno del servidor'
        ], 500);
    }
}

// 🔐 SOLICITAR TOKEN PARA ESTABLECER CONTRASEÑA (USUARIOS GOOGLE)
public function requestPasswordSetupToken(Request $request)
{
    Log::info('🔐 [ENTRADA] requestPasswordSetupToken llamado', [
        'url' => $request->fullUrl(),
        'method' => $request->method(),
        'has_auth' => $request->user() ? 'yes' : 'no'
    ]);
    
    try {
        Log::info('🔐 Iniciando solicitud de token para establecer contraseña');
        
        $user = $request->user();
        
        if (!$user) {
            Log::warning('⚠️ Usuario no autenticado al solicitar token de setup password');
            return response()->json([
                'success' => false,
                'error' => 'Usuario no autenticado'
            ], 401);
        }
        
        Log::info('✅ Usuario autenticado', ['user_id' => $user->id, 'email' => $user->email]);
        
        // Validar que el usuario se registró con Google
        if (!$user->google_id) {
            Log::warning('⚠️ Usuario no es de Google', ['user_id' => $user->id]);
            return response()->json([
                'success' => false,
                'error' => 'Este método solo está disponible para usuarios que se registraron con Google'
            ], 422);
        }

        // Validar que el usuario tenga email
        if (!$user->email) {
            Log::warning('⚠️ Usuario sin email', ['user_id' => $user->id]);
            return response()->json([
                'success' => false,
                'error' => 'El usuario no tiene un email válido'
            ], 422);
        }

        // Validar que el usuario tenga nombre
        if (!$user->name) {
            Log::warning('⚠️ Usuario sin nombre', ['user_id' => $user->id]);
            return response()->json([
                'success' => false,
                'error' => 'El usuario no tiene un nombre válido'
            ], 422);
        }

        Log::info('✅ Validaciones de usuario completadas', [
            'user_id' => $user->id,
            'email' => $user->email,
            'name' => $user->name
        ]);

        // Generar token aleatorio seguro (64 caracteres)
        Log::info('🔑 Generando token seguro');
        $token = bin2hex(random_bytes(32));
        $expiration = Carbon::now()->addHours(24); // Expira en 24 horas
        Log::info('✅ Token generado', ['token_length' => strlen($token), 'expires_at' => $expiration]);

        // Guardar token en tabla security_codes
        Log::info('💾 Guardando token en base de datos');
        try {
            DB::table('security_codes')->updateOrInsert(
                ['user_id' => $user->id, 'action_type' => 'setup_password'],
                [
                    'code' => $token,
                    'expires_at' => $expiration,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
            Log::info('✅ Token guardado en base de datos');
        } catch (\Exception $dbException) {
            Log::error('❌ Error guardando token en base de datos', [
                'error' => $dbException->getMessage(),
                'user_id' => $user->id
            ]);
            throw $dbException;
        }

        // Crear enlace para establecer contraseña
        Log::info('🔗 Creando enlace de setup');
        $frontendUrl = config('app.frontend_url', env('APP_FRONTEND_URL', 'https://ligando.online'));
        $setupLink = rtrim($frontendUrl, '/') . '/setup-password?token=' . $token . '&email=' . urlencode($user->email);
        Log::info('✅ Enlace creado', ['link_length' => strlen($setupLink), 'frontend_url' => $frontendUrl]);

        // Validar configuración de correo
        Log::info('📧 Validando configuración de correo');
        $mailDriver = config('mail.default');
        $mailHost = config('mail.mailers.smtp.host');
        if (!$mailDriver || ($mailDriver === 'smtp' && !$mailHost)) {
            Log::error('❌ Configuración de correo incompleta', [
                'mail_driver' => $mailDriver,
                'mail_host' => $mailHost
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Configuración de correo no disponible. Por favor, contacta al administrador.'
            ], 500);
        }
        Log::info('✅ Configuración de correo válida', ['driver' => $mailDriver]);

        // Validar instanciación de PasswordSetupLink
        Log::info('📦 Validando instanciación de PasswordSetupLink');
        try {
            $mailInstance = new PasswordSetupLink($setupLink, $user->name);
            Log::info('✅ PasswordSetupLink instanciado correctamente');
        } catch (\Throwable $instantiationException) {
            Log::error('❌ Error instanciando PasswordSetupLink', [
                'error' => $instantiationException->getMessage(),
                'trace' => $instantiationException->getTraceAsString(),
                'file' => $instantiationException->getFile(),
                'line' => $instantiationException->getLine()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Error al preparar el correo electrónico. Por favor, contacta al soporte.'
            ], 500);
        }

        // Validar variables del template
        Log::info('🔍 Validando variables del template', [
            'setupLink' => substr($setupLink, 0, 50) . '...',
            'userName' => $user->name
        ]);
        if (empty($setupLink) || empty($user->name)) {
            Log::error('❌ Variables del template inválidas', [
                'setupLink_empty' => empty($setupLink),
                'userName_empty' => empty($user->name)
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Error al preparar el contenido del correo. Por favor, intenta nuevamente.'
            ], 500);
        }

        // Enviar enlace por correo usando la clase específica para setup password
        Log::info('📨 Enviando correo electrónico', ['to' => $user->email]);
        try {
            Mail::to($user->email)->send($mailInstance);
            Log::info("✅ Correo enviado exitosamente a {$user->email}");
        } catch (\Swift_TransportException $transportException) {
            $errorMessage = $transportException->getMessage();
            Log::error('❌ Error de transporte SMTP al enviar email', [
                'error' => $errorMessage,
                'code' => $transportException->getCode(),
                'user_id' => $user->id,
                'user_email' => $user->email,
                'mail_host' => config('mail.mailers.smtp.host'),
                'mail_driver' => config('mail.default')
            ]);
            
            // Mensaje más específico según el tipo de error
            $userFriendlyMessage = 'Error de conexión con el servidor de correo.';
            if (strpos($errorMessage, 'getaddrinfo') !== false || strpos($errorMessage, 'name resolution') !== false) {
                $userFriendlyMessage = 'El servidor de correo no está disponible. Por favor, contacta al administrador para configurar el servidor de correo correctamente.';
            } elseif (strpos($errorMessage, 'Connection refused') !== false) {
                $userFriendlyMessage = 'No se pudo conectar al servidor de correo. Verifica la configuración del servidor.';
            } elseif (strpos($errorMessage, 'Authentication failed') !== false) {
                $userFriendlyMessage = 'Error de autenticación con el servidor de correo. Verifica las credenciales.';
            }
            
            return response()->json([
                'success' => false,
                'error' => $userFriendlyMessage
            ], 500);
        } catch (\Illuminate\View\ViewException $viewException) {
            Log::error('❌ Error renderizando template de email', [
                'error' => $viewException->getMessage(),
                'trace' => $viewException->getTraceAsString(),
                'user_id' => $user->id
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error al generar el contenido del correo. Por favor, contacta al soporte.'
            ], 500);
        } catch (\Exception $mailException) {
            Log::error('❌ Error enviando email para establecer contraseña', [
                'error' => $mailException->getMessage(),
                'error_class' => get_class($mailException),
                'trace' => $mailException->getTraceAsString(),
                'user_id' => $user->id,
                'user_email' => $user->email
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error al enviar el correo electrónico. Por favor, verifica la configuración del servidor de correo.'
            ], 500);
        }

        Log::info("🔗 Enlace para establecer contraseña enviado a {$user->email} (usuario Google)");

        return response()->json([
            'success' => true,
            'message' => 'Se ha enviado un enlace a tu correo electrónico para establecer tu contraseña'
        ]);

    } catch (\Throwable $e) {
        // Capturar cualquier error incluyendo errores fatales y de autoloading
        $errorMessage = $e->getMessage();
        $errorClass = get_class($e);
        
        Log::error('❌ Error enviando enlace para establecer contraseña', [
            'error' => $errorMessage,
            'error_class' => $errorClass,
            'trace' => $e->getTraceAsString(),
            'user_id' => auth()->id(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);

        // Mensaje más descriptivo para el usuario
        $userFriendlyMessage = 'Error al procesar la solicitud. Por favor, intenta nuevamente.';
        
        // Si es un error de clase no encontrada, sugerir regenerar autoloader
        if (strpos($errorMessage, 'Class') !== false && strpos($errorMessage, 'not found') !== false) {
            $userFriendlyMessage = 'Error de configuración del servidor. Por favor, contacta al soporte.';
            Log::error('⚠️ Posible problema de autoloading detectado', [
                'sugerencia' => 'Ejecutar: composer dump-autoload'
            ]);
        }

        return response()->json([
            'success' => false,
            'error' => $userFriendlyMessage,
            'message' => $userFriendlyMessage
        ], 500);
    }
}

// 🔑 ESTABLECER CONTRASEÑA CON TOKEN (USUARIOS GOOGLE)
public function setupPasswordWithToken(Request $request)
{
    try {
        $request->validate([
            'token' => 'required|string|size:64',
            'email' => 'required|email',
            'new_password' => 'required|string|min:8|confirmed'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'Token inválido'
            ], 422);
        }

        // Verificar que el usuario se registró con Google
        if (!$user->google_id) {
            return response()->json([
                'success' => false,
                'error' => 'Este método solo está disponible para usuarios que se registraron con Google'
            ], 422);
        }

        // Verificar token
        $setupToken = DB::table('security_codes')
            ->where('user_id', $user->id)
            ->where('action_type', 'setup_password')
            ->where('code', $request->token)
            ->where('expires_at', '>', now())
            ->first();

        if (!$setupToken) {
            return response()->json([
                'success' => false,
                'error' => 'El enlace ha expirado o es inválido'
            ], 422);
        }

        // Establecer contraseña
        $user->password = Hash::make($request->new_password);
        $user->save();

        // Eliminar token usado y otros tokens de setup pendientes
        DB::table('security_codes')
            ->where('user_id', $user->id)
            ->where('action_type', 'setup_password')
            ->delete();

        Log::info("🔐 Contraseña establecida exitosamente para {$user->email} (usuario Google)");

        return response()->json([
            'success' => true,
            'message' => 'Contraseña establecida exitosamente. Ya puedes iniciar sesión con tu email y contraseña, o seguir usando Google.'
        ]);

    } catch (\Exception $e) {
        Log::error('❌ Error estableciendo contraseña', [
            'error' => $e->getMessage(),
            'email' => $request->email ?? 'no proporcionado'
        ]);

        return response()->json([
            'success' => false,
            'error' => 'Error interno del servidor'
        ], 500);
    }
}
}