<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of the exception types that are not reported.
     *
     * @var array<int, class-string<Throwable>>
     */
    protected $dontReport = [
        //
    ];

    /**
     * A list of the inputs that are never flashed for validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     *
     * @return void
     */
    public function register()
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Devuelve una respuesta JSON si la autenticación falla
     */
    protected function unauthenticated($request, AuthenticationException $exception)
    {
        return response()->json([
            'message' => 'No autenticado. Token inválido o sesión cerrada en otro dispositivo',
        ], 401);
    }
    public function render($request, Throwable $exception)
    {
        // Para peticiones API, devolver JSON con información detallada
        if ($request->expectsJson() || $request->is('api/*')) {
            $statusCode = method_exists($exception, 'getStatusCode') ? $exception->getStatusCode() : 500;
            $message = $exception->getMessage();
            
            // Si el mensaje es genérico "Server Error", proporcionar más información
            if ($message === 'Server Error' || empty($message)) {
                $message = 'Error interno del servidor. Por favor, revisa los logs para más detalles.';
            }
            
            return response()->json([
                'success' => false,
                'error' => $message,
                'message' => $message,
            ], $statusCode);
        }
        
        if ($exception instanceof \Symfony\Component\HttpKernel\Exception\HttpException &&
            $exception->getStatusCode() === 403) {
            return response()->json([
                'message' => 'No tienes permiso para acceder a esta sección.',
            ], 403);
        }

        return parent::render($request, $exception);
    }

}
