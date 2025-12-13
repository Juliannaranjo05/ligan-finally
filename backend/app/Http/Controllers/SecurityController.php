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
        $resetLink = 'https://ligando.online/reset-password?token=' . $token . '&email=' . urlencode($user->email);
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
}