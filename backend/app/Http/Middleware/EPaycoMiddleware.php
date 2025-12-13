<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EPaycoMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        // 📝 Log detallado para debugging
        Log::info('🔐 ePayco Middleware - Petición recibida', [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'environment' => config('app.env'),
            'data' => $request->all()
        ]);

        // ⚠️ Validar método POST para confirmaciones
        if ($request->is('api/epayco-coins/confirmation')) {
            if (!$request->isMethod('POST')) {
                Log::warning('❌ Método HTTP incorrecto en confirmación ePayco', [
                    'method' => $request->method(),
                    'expected' => 'POST',
                    'ip' => $request->ip()
                ]);
                return response('Método no permitido - Se requiere POST', 405);
            }
        }

        // ⚠️ Validar método GET para respuestas
        if ($request->is('api/epayco/response')) {
            if (!$request->isMethod('GET')) {
                Log::warning('❌ Método HTTP incorrecto en respuesta ePayco', [
                    'method' => $request->method(),
                    'expected' => 'GET',
                    'ip' => $request->ip()
                ]);
                return response('Método no permitido - Se requiere GET', 405);
            }
        }

        // 🔐 Validación de IPs solo en producción (opcional)
        if (config('app.env') === 'production' && !config('epayco.sandbox')) {
            if ($request->is('api/epayco-coins/confirmation')) {
                $allowedIPs = [
                    '181.78.6.90',
                    '181.78.6.91', 
                    '181.78.6.92',
                    '181.78.12.27',
                    '181.78.12.28',
                    '200.118.252.150',
                ];
                
                $clientIP = $this->getClientIP($request);
                
                if (!in_array($clientIP, $allowedIPs)) {
                    Log::warning('🚫 IP no autorizada en callback ePayco', [
                        'ip' => $clientIP,
                        'allowed_ips' => $allowedIPs,
                        'url' => $request->fullUrl()
                    ]);
                    // En producción, puedes activar esto:
                    // return response('IP no autorizada', 403);
                }
            }
        }

        // ⏭️ Continuar con la petición
        $response = $next($request);
        
        // 📤 Agregar headers para evitar caché
        return $response->withHeaders([
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-ePayco-Environment' => config('app.env'),
            'X-ePayco-Sandbox' => config('epayco.sandbox', true) ? 'true' : 'false'
        ]);
    }

    /**
     * 🔍 Obtener IP real del cliente (maneja proxies, CloudFlare, etc.)
     */
    private function getClientIP($request)
    {
        $ipKeys = [
            'HTTP_CF_CONNECTING_IP',     // Cloudflare
            'HTTP_X_FORWARDED_FOR',      // Load balancers
            'HTTP_X_REAL_IP',            // Nginx
            'HTTP_CLIENT_IP',            // Proxy
            'REMOTE_ADDR'                // Standard
        ];
        
        foreach ($ipKeys as $key) {
            if (array_key_exists($key, $_SERVER) === true) {
                $ip = $_SERVER[$key];
                
                // Manejar múltiples IPs separadas por coma
                if (strpos($ip, ',') !== false) {
                    $ip = explode(',', $ip)[0];
                }
                
                $ip = trim($ip);
                
                // Validar IP pública válida
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return $request->ip();
    }
}