<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckCurrentToken
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();

        // Verifica si este token es el activo
        if (!$currentToken || $user->current_access_token_id != $currentToken->id) {
            return response()->json(['message' => 'Token inválido'], 401);
        }

        return $next($request);
    }
}
