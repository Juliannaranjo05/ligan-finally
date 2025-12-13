<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class VerificacionEstado
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next, $estadoPermitido)
    {
        $verificacion = $request->user()->verificacion;

        if (!$verificacion && $estadoPermitido === 'sin_verificar') {
            return $next($request);
        }

        if ($verificacion && $verificacion->estado === $estadoPermitido) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Acceso denegado por estado de verificación.'
        ], 403);
    }
}
