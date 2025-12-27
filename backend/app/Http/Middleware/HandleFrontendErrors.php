<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Throwable;
use Illuminate\Support\Facades\Log;

class HandleFrontendErrors
{
    public function handle(Request $request, Closure $next)
    {
        try {
            return $next($request);
        } catch (Throwable $e) {
            // Log detallado del error
            Log::error('❌ Excepción capturada por HandleFrontendErrors', [
                'error' => $e->getMessage(),
                'error_class' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'url' => $request->fullUrl(),
                'method' => $request->method(),
            ]);
            
            // Determinar mensaje de error más descriptivo
            $errorMessage = $e->getMessage();
            $userFriendlyMessage = 'Error interno del servidor';
            
            // Mensajes más específicos según el tipo de error
            if (strpos($errorMessage, 'Class') !== false && strpos($errorMessage, 'does not exist') !== false) {
                $userFriendlyMessage = 'Error de configuración: Clase no encontrada';
            } elseif (strpos($errorMessage, 'Connection') !== false || strpos($errorMessage, 'SMTP') !== false) {
                $userFriendlyMessage = 'Error de conexión con el servidor de correo';
            } elseif (strpos($errorMessage, 'View') !== false || strpos($errorMessage, 'template') !== false) {
                $userFriendlyMessage = 'Error al generar el contenido del correo';
            } elseif (strpos($errorMessage, 'Server Error') !== false || empty($errorMessage)) {
                $userFriendlyMessage = 'Error interno del servidor. Por favor, revisa los logs para más detalles.';
            }
            
            return response()->json([
                'success' => false,
                'error' => $userFriendlyMessage,
                'message' => $userFriendlyMessage, // También incluir 'message' para compatibilidad
            ], 500);
        }
    }
}
