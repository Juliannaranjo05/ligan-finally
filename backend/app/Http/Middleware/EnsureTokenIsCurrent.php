<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Exceptions\HttpResponseException;
use Laravel\Sanctum\PersonalAccessToken;

class EnsureTokenIsCurrent
{
    public function handle(Request $request, Closure $next)
    {
        // ⚠️ Ignorar esta verificación en rutas específicas
        if ($request->is('api/reclamar-sesion') || $request->is('api/reactivar-sesion') || $request->is('api/verify-email-code')) {
            return $next($request);
        }

        $user = $request->user();

        // Si no hay usuario autenticado, permitir continuar (otro middleware lo bloqueará si es necesario)
        if (!$user) {
            return $next($request);
        }

        $token = $request->bearerToken();

        if (!$token || !str_contains($token, '|')) {
            Log::info("❌ Token inválido (sin formato esperado): {$token}");
            throw new HttpResponseException(response()->json([
                'message' => 'Token inválido o malformado.',
            ], 403));
        }

        $currentTokenId = explode('|', $token)[0];
        
        // Obtener el token del modelo para verificar su status
        $tokenModel = PersonalAccessToken::find($currentTokenId);
        
        if (!$tokenModel) {
            Log::info("❌ Token no encontrado: {$currentTokenId}");
            throw new HttpResponseException(response()->json([
                'message' => 'Token no encontrado',
            ], 403));
        }
        
        // Verificar si el token está suspendido
        if ($tokenModel->status === 'suspended') {
            Log::info("⏸️ Sesión suspendida detectada para {$user->email}", [
                'token_id' => $currentTokenId,
                'ip' => $request->ip()
            ]);
            
            throw new HttpResponseException(response()->json([
                'message' => 'Tu sesión ha sido suspendida',
                'code' => 'SESSION_SUSPENDED',
                'reason' => 'Se abrió una nueva sesión en otro dispositivo'
            ], 403));
        }

        // Verificar si este token es el token activo actual
        // Si el token tiene status 'active' pero NO es el current_access_token_id,
        // significa que otra sesión fue reactivada y esta debe suspenderse
        if ($user->current_access_token_id && $user->current_access_token_id != $currentTokenId) {
            // Si el token tiene status 'active' pero no es el current, fue reactivada otra sesión
            if ($tokenModel->status === 'active') {
                Log::info("⏸️ Token activo detectado pero no es el current_access_token_id - otra sesión fue reactivada para {$user->email}", [
                    'token_actual_esperado' => $user->current_access_token_id,
                    'token_recibido' => $currentTokenId,
                    'token_status' => $tokenModel->status,
                    'ip' => $request->ip()
                ]);
                
                // Marcar este token como suspendido automáticamente
                $tokenModel->update(['status' => 'suspended']);
                
                throw new HttpResponseException(response()->json([
                    'message' => 'Tu sesión ha sido suspendida',
                    'code' => 'SESSION_SUSPENDED',
                    'reason' => 'Otra sesión fue reactivada en otro dispositivo'
                ], 403));
            }
            
            Log::info("🚫 Token inválido detectado. ID actual: {$currentTokenId}, esperado: {$user->current_access_token_id}");

            throw new HttpResponseException(response()->json([
                'message' => 'Token inválido o sesión cerrada en otro dispositivo',
                'code' => 'SESSION_CLOSED_BY_OTHER_DEVICE',
                'reason' => 'La cuenta ha sido abierta en otro dispositivo'
            ], 403));
        }

        return $next($request);
    }
}
