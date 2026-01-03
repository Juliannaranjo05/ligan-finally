<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\PersonalAccessToken;

class EnsureSingleSession
{
    public function handle(Request $request, Closure $next)
    {
        // ⚠️ Ignorar esta verificación en rutas específicas
        // 🔥 NO ignorar heartbeat - debe verificar el estado del token
        if ($request->is('api/reclamar-sesion') || $request->is('api/reactivar-sesion') || $request->is('api/verify-email-code')) {
            return $next($request);
        }

        $user = $request->user();
        
        if (!$user) {
            Log::info('🔍 EnsureSingleSession: no user authenticated for request - skipping', [
                'uri' => $request->getRequestUri(),
                'ip' => $request->ip()
            ]);
            return $next($request);
        }

        // Obtener el token actual del request
        $currentToken = $request->bearerToken();
        if (!$currentToken || !str_contains($currentToken, '|')) {
            return response()->json(['message' => 'Token no encontrado o malformado'], 401);
        }

        // Extraer el ID del token (parte antes del pipe)
        $tokenId = explode('|', $currentToken)[0];
        
        // Obtener el token del modelo para verificar su status
        $tokenModel = PersonalAccessToken::find($tokenId);
        
        if (!$tokenModel) {
            return response()->json(['message' => 'Token no encontrado'], 401);
        }

        // Verificar si el token está suspendido
        if ($tokenModel->status === 'suspended') {
            Log::warning("⏸️ Sesión suspendida detectada para {$user->email}", [
                'token_id' => $tokenId,
                'ip' => $request->ip(),
                'path' => $request->path(),
                'method' => $request->method(),
                'user_agent' => substr($request->userAgent(), 0, 100)
            ]);
            
            return response()->json([
                'message' => 'Tu sesión ha sido suspendida',
                'code' => 'SESSION_SUSPENDED',
                'reason' => 'Se abrió una nueva sesión en otro dispositivo'
            ], 403);
        }
        
        // Verificar si este token es el token activo actual
        // Si el token tiene status 'active' pero NO es el current_access_token_id,
        // significa que otra sesión fue reactivada y esta debe suspenderse
        if ($user->current_access_token_id != $tokenId) {
            // Si el token tiene status 'active' pero no es el current, fue reactivada otra sesión
            if ($tokenModel->status === 'active') {
                Log::warning("⏸️ Token activo detectado pero no es el current_access_token_id - otra sesión fue reactivada para {$user->email}", [
                    'token_actual_esperado' => $user->current_access_token_id,
                    'token_recibido' => $tokenId,
                    'token_status' => $tokenModel->status,
                    'ip' => $request->ip(),
                    'path' => $request->path(),
                    'method' => $request->method(),
                ]);

                return response()->json([
                    'message' => 'Tu sesión ha sido suspendida',
                    'code' => 'SESSION_SUSPENDED',
                    'reason' => 'Otra sesión fue reactivada en otro dispositivo',
                    'action' => 'close_immediately' // 🔥 Flag para cerrar inmediatamente
                ], 403);
            }
            
            Log::info("🔥 Sesión duplicada detectada para {$user->email}", [
                'token_actual_esperado' => $user->current_access_token_id,
                'token_recibido' => $tokenId,
                'ip' => $request->ip(),
                'user_agent' => substr($request->userAgent(), 0, 100)
            ]);
            
            return response()->json([
                'message' => 'Se abrió tu cuenta en otro dispositivo',
                'code' => 'SESSION_CLOSED_BY_OTHER_DEVICE',
                'reason' => 'La cuenta ha sido abierta en otro dispositivo'
            ], 401);
        }

        return $next($request);
    }
}