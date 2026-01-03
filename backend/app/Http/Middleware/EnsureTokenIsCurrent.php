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

        // Validación de token desactivada: se permite cualquier token, no se suspende ni cierra sesión por duplicidad o estado.

        return $next($request);
    }
}
