<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class CurrencyDetectionService
{
    /**
     * Monedas LATAM (precio base)
     */
    private const LATAM_CURRENCIES = [
        'COP', // Colombia
        'MXN', // México
        'ARS', // Argentina
        'CLP', // Chile
        'PEN', // Perú
        'BRL', // Brasil
        'UYU', // Uruguay
        'PYG', // Paraguay
        'BOB', // Bolivia
        'VES', // Venezuela
        'GTQ', // Guatemala
        'HNL', // Honduras
        'NIO', // Nicaragua
        'CRC', // Costa Rica
        'PAB', // Panamá
        'DOP', // República Dominicana
        'HTG', // Haití
        'JMD', // Jamaica
        'BBD', // Barbados
        'BZD', // Belice
        'XCD', // Caribe Oriental
        'AWG', // Aruba
        'SRD', // Surinam
        'GYD', // Guyana
        'TTD', // Trinidad y Tobago
    ];

    /**
     * Códigos de países LATAM
     */
    private const LATAM_COUNTRIES = [
        'CO', // Colombia
        'MX', // México
        'AR', // Argentina
        'CL', // Chile
        'PE', // Perú
        'BR', // Brasil
        'UY', // Uruguay
        'PY', // Paraguay
        'BO', // Bolivia
        'VE', // Venezuela
        'GT', // Guatemala
        'HN', // Honduras
        'NI', // Nicaragua
        'CR', // Costa Rica
        'PA', // Panamá
        'DO', // República Dominicana
        'HT', // Haití
        'JM', // Jamaica
        'BB', // Barbados
        'BZ', // Belice
        'AG', // Antigua y Barbuda
        'BS', // Bahamas
        'DM', // Dominica
        'GD', // Granada
        'KN', // San Cristóbal y Nieves
        'LC', // Santa Lucía
        'VC', // San Vicente y las Granadinas
        'AW', // Aruba
        'SR', // Surinam
        'GY', // Guyana
        'TT', // Trinidad y Tobago
    ];

    /**
     * Detectar moneda basado en IP del usuario
     * 
     * @param string|null $ipAddress IP del usuario
     * @return string Código de moneda (COP, USD, EUR, etc.)
     */
    public function detectCurrencyByIp(?string $ipAddress = null): string
    {
        // Si no hay IP, usar COP por defecto (LATAM)
        if (!$ipAddress || $ipAddress === '127.0.0.1' || $ipAddress === '::1' || strpos($ipAddress, '192.168.') === 0) {
            return 'COP'; // Localhost o IP privada, asumir LATAM
        }

        // Cachear resultado por 24 horas para evitar múltiples llamadas
        $cacheKey = "currency_detection_{$ipAddress}";
        
        return Cache::remember($cacheKey, 86400, function () use ($ipAddress) {
            try {
                // Usar ipapi.co (gratis, 1000 requests/día)
                $response = Http::timeout(3)
                    ->get("https://ipapi.co/{$ipAddress}/json/", [
                        'key' => null // Sin API key para versión gratuita
                    ]);

                if ($response->successful()) {
                    $data = $response->json();
                    
                    // Verificar si hay error en la respuesta
                    if (isset($data['error'])) {
                        Log::warning('Error en detección de moneda por IP', [
                            'ip' => $ipAddress,
                            'error' => $data['error']
                        ]);
                        return 'COP'; // Fallback a LATAM
                    }

                    $countryCode = $data['country_code'] ?? null;
                    $currency = $data['currency'] ?? null;

                    // Si el país es LATAM, usar su moneda (o COP por defecto)
                    if ($countryCode && in_array(strtoupper($countryCode), self::LATAM_COUNTRIES)) {
                        // Si la moneda detectada es LATAM, usarla, sino COP
                        if ($currency && in_array(strtoupper($currency), self::LATAM_CURRENCIES)) {
                            return strtoupper($currency);
                        }
                        return 'COP'; // Default LATAM
                    }

                    // Si es USD o EUR, retornar directamente
                    if ($currency && in_array(strtoupper($currency), ['USD', 'EUR'])) {
                        return strtoupper($currency);
                    }

                    // Para otros países, intentar detectar moneda
                    if ($currency) {
                        return strtoupper($currency);
                    }

                    // Fallback: si no podemos detectar, asumir LATAM
                    return 'COP';
                }

                // Si la API falla, usar COP por defecto
                Log::warning('Error al obtener geolocalización por IP', [
                    'ip' => $ipAddress,
                    'status' => $response->status()
                ]);
                return 'COP';

            } catch (\Exception $e) {
                Log::error('Excepción al detectar moneda por IP', [
                    'ip' => $ipAddress,
                    'error' => $e->getMessage()
                ]);
                return 'COP'; // Fallback a LATAM
            }
        });
    }

    /**
     * Determinar si una moneda es LATAM o USD/EUR
     * 
     * @param string $currency Código de moneda
     * @return bool true si es LATAM, false si es USD/EUR
     */
    public function isLatamCurrency(string $currency): bool
    {
        $currencyUpper = strtoupper($currency);
        return in_array($currencyUpper, self::LATAM_CURRENCIES);
    }

    /**
     * Obtener lista de monedas LATAM
     * 
     * @return array
     */
    public function getLatamCurrencies(): array
    {
        return self::LATAM_CURRENCIES;
    }

    /**
     * Obtener lista de países LATAM
     * 
     * @return array
     */
    public function getLatamCountries(): array
    {
        return self::LATAM_COUNTRIES;
    }
}

