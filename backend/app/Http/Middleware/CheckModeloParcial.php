<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckModeloParcial
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user->rol !== 'modelo') {
            return response()->json(['message' => 'Acceso permitido solo para modelos.'], 403);
        }

        // Verificamos que haya completado mínimo lo básico: nombre y correo verificado
        if (!$user->name || !$user->email_verified_at) {
            return response()->json(['message' => 'Completa tu perfil antes de continuar.'], 403);
        }

        // Si ya tiene una verificación aprobada, tampoco debe pasar por aquí
        if ($user->verificacion && $user->verificacion->estado === 'aprobado') {
            return response()->json(['message' => 'Ya tienes verificación aprobada.'], 403);
        }

        return $next($request);
    }
}
