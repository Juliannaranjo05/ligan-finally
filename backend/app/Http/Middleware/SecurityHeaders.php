<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SecurityHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // HSTS (HTTP Strict Transport Security) - Solo en HTTPS
        if ($request->secure()) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        // X-Frame-Options - Prevenir clickjacking
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');

        // X-Content-Type-Options - Prevenir MIME type sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // X-XSS-Protection (legacy, pero útil para navegadores antiguos)
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Referrer-Policy - Controlar qué información se envía en el header Referer
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Permissions-Policy (anteriormente Feature-Policy)
        // Permitir cámara y micrófono para la funcionalidad de grabación de historias
        $response->headers->set(
            'Permissions-Policy',
            'geolocation=(), microphone=(self), camera=(self), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
        );

        // Content Security Policy (CSP)
        // Ajustar según las necesidades de la aplicación
        $csp = $this->buildCSP();
        $response->headers->set('Content-Security-Policy', $csp);

        // Remove server information
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }

    /**
     * Construir Content Security Policy
     */
    private function buildCSP(): string
    {
        $directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://js.stripe.com https://checkout.stripe.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://ligandome.com https://api.stripe.com https://www.google-analytics.com https://www.googletagmanager.com wss://ligandome.com",
            "media-src 'self' blob: https:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
            "worker-src 'self' blob:",
            "manifest-src 'self'",
        ];

        return implode('; ', $directives);
    }
}
