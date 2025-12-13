<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Throwable;

class HandleFrontendErrors
{
    public function handle(Request $request, Closure $next)
    {
        try {
            return $next($request);
        } catch (Throwable $e) {
            return response()->json([
                'error' => 'Excepción no manejada',
                'message' => $e->getMessage(),
                'file' => basename($e->getFile()),
                'line' => $e->getLine(),
                'trace' => collect($e->getTrace())->take(3), // Solo las primeras 3 líneas del trace
            ], 500);
        }
    }
}
