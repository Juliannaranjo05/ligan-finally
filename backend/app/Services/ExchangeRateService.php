<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class ExchangeRateService
{
    /**
     * Obtener tasa de cambio USD a COP
     * 
     * @return float Tasa de cambio (1 USD = X COP)
     */
    public function getUsdToCopRate(): float
    {
        // Cachear por 1 hora para evitar demasiadas llamadas a la API
        return Cache::remember('exchange_rate_usd_cop', 3600, function () {
            try {
                // Usar ExchangeRate-API (gratis, sin API key para uso básico)
                // Alternativa: exchangerate-api.com
                $response = Http::timeout(5)
                    ->get('https://api.exchangerate-api.com/v4/latest/USD');

                if ($response->successful()) {
                    $data = $response->json();
                    $copRate = $data['rates']['COP'] ?? null;
                    
                    if ($copRate && $copRate > 0) {
                        Log::info('Tasa de cambio USD->COP obtenida desde API', [
                            'rate' => $copRate,
                            'source' => 'exchangerate-api.com'
                        ]);
                        return (float)$copRate;
                    }
                }

                // Fallback: usar tasa por defecto si la API falla
                Log::warning('No se pudo obtener tasa USD->COP desde API, usando valor por defecto');
                return config('wompi.usd_to_cop_rate', 4000);

            } catch (\Exception $e) {
                Log::error('Error obteniendo tasa de cambio USD->COP: ' . $e->getMessage());
                // Fallback: usar tasa por defecto
                return config('wompi.usd_to_cop_rate', 4000);
            }
        });
    }

    /**
     * Obtener tasa de cambio USD a EUR
     * 
     * @return float Tasa de cambio (1 USD = X EUR)
     */
    public function getUsdToEurRate(): float
    {
        // Cachear por 1 hora para evitar demasiadas llamadas a la API
        return Cache::remember('exchange_rate_usd_eur', 3600, function () {
            try {
                // Usar ExchangeRate-API (gratis, sin API key para uso básico)
                $response = Http::timeout(5)
                    ->get('https://api.exchangerate-api.com/v4/latest/USD');

                if ($response->successful()) {
                    $data = $response->json();
                    $eurRate = $data['rates']['EUR'] ?? null;
                    
                    if ($eurRate && $eurRate > 0) {
                        Log::info('Tasa de cambio USD->EUR obtenida desde API', [
                            'rate' => $eurRate,
                            'source' => 'exchangerate-api.com'
                        ]);
                        return (float)$eurRate;
                    }
                }

                // Fallback: usar tasa por defecto si la API falla
                Log::warning('No se pudo obtener tasa USD->EUR desde API, usando valor por defecto');
                return config('wompi.usd_to_eur_rate', 0.92);

            } catch (\Exception $e) {
                Log::error('Error obteniendo tasa de cambio USD->EUR: ' . $e->getMessage());
                // Fallback: usar tasa por defecto
                return config('wompi.usd_to_eur_rate', 0.92);
            }
        });
    }

    /**
     * Obtener ambas tasas de cambio
     * 
     * @return array ['usd_to_cop' => float, 'usd_to_eur' => float]
     */
    public function getExchangeRates(): array
    {
        return [
            'usd_to_cop' => $this->getUsdToCopRate(),
            'usd_to_eur' => $this->getUsdToEurRate()
        ];
    }

    /**
     * Limpiar caché de tasas de cambio (útil para forzar actualización)
     */
    public function clearCache(): void
    {
        Cache::forget('exchange_rate_usd_cop');
        Cache::forget('exchange_rate_usd_eur');
    }
}



