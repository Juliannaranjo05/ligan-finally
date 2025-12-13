<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureEmailVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user() || !$request->user()->email_verified_at) {
            return response()->json(['message' => 'Correo no verificado'], 403);
        }

        return $next($request);
    }
}
