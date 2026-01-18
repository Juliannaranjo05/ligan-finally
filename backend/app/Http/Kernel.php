<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    /**
     * The application's global HTTP middleware stack.
     *
     * These middleware are run during every request to your application.
     *
     * @var array<int, class-string|string>
     */
    protected $middleware = [
        // \App\Http\Middleware\TrustHosts::class,
        \App\Http\Middleware\TrustProxies::class,
        \Fruitcake\Cors\HandleCors::class,
        \App\Http\Middleware\PreventRequestsDuringMaintenance::class,
        \App\Http\Middleware\IncreaseUploadLimits::class, // 🔥 Aplicar límites ANTES de ValidatePostSize
        // \Illuminate\Foundation\Http\Middleware\ValidatePostSize::class, // 🔥 DESACTIVADO - validamos manualmente
        \App\Http\Middleware\TrimStrings::class,
        \Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class,
        \App\Http\Middleware\HandleFrontendErrors::class,
        \App\Http\Middleware\SecurityHeaders::class,

    ];

    /**
     * The application's route middleware groups.
     *
     * @var array<string, array<int, class-string|string>>
     */
    protected $middlewareGroups = [
        'web' => [
            \App\Http\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \App\Http\Middleware\VerifyCsrfToken::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],

        // 🔥 CAMBIO CRÍTICO: ELIMINAR 'throttle:api' 
        'api' => [
            // ❌ REMOVIDO: 'throttle:api',
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],
    ];

    /**
     * The application's route middleware.
     *
     * These middleware may be assigned to groups or used individually.
     *
     * @var array<string, class-string|string>
     */
    protected $routeMiddleware = [
        'auth' => \App\Http\Middleware\Authenticate::class,
        'auth.basic' => \Illuminate\Auth\Middleware\AuthenticateWithBasicAuth::class,
        'cache.headers' => \Illuminate\Http\Middleware\SetCacheHeaders::class,
        'can' => \Illuminate\Auth\Middleware\Authorize::class,
        'guest' => \App\Http\Middleware\RedirectIfAuthenticated::class,
        'password.confirm' => \Illuminate\Auth\Middleware\RequirePassword::class,
        'signed' => \Illuminate\Routing\Middleware\ValidateSignature::class,
        'throttle' => \Illuminate\Routing\Middleware\ThrottleRequests::class,
        'admin' => \App\Http\Middleware\AdminMiddleware::class,
        'admin.auth' => \App\Http\Middleware\AdminAuthMiddleware::class,
        'verificacion.estado' => \App\Http\Middleware\VerificacionEstado::class,
        'email.verified' => \App\Http\Middleware\EnsureEmailVerified::class,
        'only.current.token' => \App\Http\Middleware\EnsureTokenIsCurrent::class,
        'check.current.token' => \App\Http\Middleware\CheckCurrentToken::class,
        'modeloCompleto' => \App\Http\Middleware\CheckModeloCompleto::class,
        'cliente' => \App\Http\Middleware\CheckCliente::class,
        'modeloParcial' => \App\Http\Middleware\CheckModeloParcial::class,
        'videocall.throttle' => \App\Http\Middleware\VideoCallThrottle::class,
        'single.session' => \App\Http\Middleware\EnsureSingleSession::class,
        'gift.security' => \App\Http\Middleware\GiftSecurityMiddleware::class,
        'epayco' => \App\Http\Middleware\EPaycoMiddleware::class,

    ];

    // 🎯 ALIASES MEJORADOS PARA THROTTLING GRANULAR
    protected $middlewareAliases = [
        // Diferentes niveles de throttling para usar EXPLÍCITAMENTE donde necesites
        'throttle.public' => 'throttle:20,1',     // Rutas públicas (login, register)
        'throttle.low' => 'throttle:30,1',        // Operaciones críticas (logout, verificación)
        'throttle.medium' => 'throttle:100,1',    // Operaciones normales
        'throttle.high' => 'throttle:500,1',      // Operaciones frecuentes pero no críticas
        'throttle.api' => 'throttle:60,1',        // Para usar SOLO donde lo necesites explícitamente
    ];
}