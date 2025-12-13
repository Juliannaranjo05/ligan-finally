<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Exceptions\HttpResponseException;

class EnsureTokenIsCurrent
{
    public function handle(Request $request, Closure $next)
    {
        // ⚠️ Ignorar esta verificación en rutas específicas
        if ($request->is('api/reclamar-sesion') || $request->is('api/verify-email-code')) {
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

            if ($user->current_access_token_id && $user->current_access_token_id != $currentTokenId) {
            Log::info("🚫 Token inválido detectado. ID actual: {$currentTokenId}, esperado: {$user->current_access_token_id}");

            throw new HttpResponseException(response()->json([
                'message' => 'Token inválido o sesión cerrada en otro dispositivo',
            ], 403));
        }

        return $next($request);
    }
}
