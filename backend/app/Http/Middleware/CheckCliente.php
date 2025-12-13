<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckCliente
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user()->rol !== 'cliente') {
            return response()->json(['message' => 'Acceso solo para clientes.'], 403);
        }

        return $next($request);
    }
}
