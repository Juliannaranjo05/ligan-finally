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
        $user = $request->user();
        
        if (!$user) {
            return $next($request);
        }

        // Obtener el token actual del request
        $currentToken = $request->bearerToken();
        if (!$currentToken || !str_contains($currentToken, '|')) {
            return response()->json(['message' => 'Token no encontrado o malformado'], 401);
        }

        // Extraer el ID del token (parte antes del pipe)
        $tokenId = explode('|', $currentToken)[0];
        
        // Verificar si este token es el token activo actual
        if ($user->current_access_token_id != $tokenId) {
            Log::info("🔥 Sesión duplicada detectada para {$user->email}. Token actual: {$user->current_access_token_id}, Token recibido: {$tokenId}");
            
            return response()->json([
                'message' => 'Sesión iniciada en otro dispositivo',
                'code' => 'SESSION_DUPLICATED'
            ], 401);
        }

        return $next($request);
    }
}