<?php

// app/Http/Middleware/CheckModeloCompleto.php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckModeloCompleto
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user->rol !== 'modelo') {
            return response()->json(['message' => 'Solo para modelos.'], 403);
        }

        $verificacion = $user->verificacion;

        if (
            !$user->name ||
            !$user->email_verified_at ||
            !$verificacion ||
            !$verificacion->selfie ||
            !$verificacion->documento ||
            !$verificacion->selfie_doc ||
            !$verificacion->video ||
            $verificacion->estado !== 'aprobado'
        ) {
            return response()->json(['message' => 'Perfil de modelo incompleto o no aprobado.'], 403);
        }

        return $next($request);
    }
}
