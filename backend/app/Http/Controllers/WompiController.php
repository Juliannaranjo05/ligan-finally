<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use App\Models\User;
use App\Models\CoinPurchase;
use App\Models\CoinPackage;
use App\Models\UserCoins;
use App\Models\CoinTransaction;
use App\Http\Controllers\VideoChatCoinController;
use App\Services\CurrencyDetectionService;
use Exception;

class WompiController extends Controller
{
    private $wompiConfig;
    private $currencyDetectionService;

    public function __construct(CurrencyDetectionService $currencyDetectionService)
    {
        $this->wompiConfig = [
            // Credenciales Wompi
            'public_key' => config('wompi.public_key'),
            'private_key' => config('wompi.private_key'),
            'integrity_secret' => config('wompi.integrity_secret'),
            'events_secret' => config('wompi.events_secret'),
            
            // URLs de Wompi
            'api_url' => config('wompi.api_url', 'https://production.wompi.co/v1'),
            'checkout_url' => config('wompi.checkout_url', 'https://checkout.wompi.co'),
            
            // Configuración
            'sandbox' => config('wompi.sandbox', false),
            'currency' => config('wompi.currency', 'COP'),
            'environment' => config('app.env'),
        ];
        
        $this->currencyDetectionService = $currencyDetectionService;
    }

    /**
     * ⚙️ Obtener configuración de Wompi
     */
    public function getWompiConfig()
    {
        return response()->json([
            'success' => true,
            'payment_method' => 'wompi',
            'currency' => $this->wompiConfig['currency'],
            'sandbox' => $this->wompiConfig['sandbox'],
            'environment' => config('app.env'),
            'public_key' => $this->wompiConfig['public_key'],
            'checkout_url' => $this->wompiConfig['checkout_url'],
            'supported_methods' => [
                'card', 'pse', 'bancolombia_transfer', 'nequi'
            ],
            'coin_system' => [
                'cost_per_minute' => VideoChatCoinController::COST_PER_MINUTE,
                'minimum_balance' => VideoChatCoinController::MINIMUM_BALANCE
            ],
            'security' => [
                'max_attempts_per_hour' => 5,
                'min_amount' => config('wompi.limits.min_amount', 5000), // $5,000 COP mínimo
                'max_amount' => config('wompi.limits.max_amount', 2000000) // $2,000,000 COP máximo
            ],
            'features' => [
                'instant_confirmation' => true,
                'colombia_payments' => true,
                'pse_supported' => true,
                'card_payments' => true
            ]
        ]);
    }

    /**
     * 📦 Obtener paquetes disponibles para Wompi
     * 
     * @param Request $request Puede incluir 'currency' (COP, USD, EUR, etc.)
     */
    public function getPackages(Request $request)
    {
        try {
            $user = auth()->user();
            $userId = $user ? $user->id : null; // Permitir llamadas de invitados (sin usuario)
            
            // Validar y sanear parámetros entrantes (defensivo)
            $validator = \Validator::make($request->all(), [
                'price_per_hour' => 'nullable|numeric|min:0.01',
                'currency' => 'nullable|string|max:3',
                'country_code' => 'nullable|string|size:2'
            ]);
            if ($validator->fails()) {
                Log::warning('Wompi getPackages - parámetros inválidos', [
                    'errors' => $validator->errors()->all(),
                    'request' => $request->all()
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Parámetros inválidos',
                    'validation_errors' => $validator->errors()
                ], 422);
            }

            // 🔥 OBTENER PRECIO POR HORA DEL PAÍS (saneado):
            $pricePerHour = $request->filled('price_per_hour') ? (float)$request->input('price_per_hour') : 30.0;
            if ($pricePerHour <= 0) {
                Log::warning('Wompi getPackages: price_per_hour inválido, usando valor por defecto', ['received' => $request->input('price_per_hour')]);
                $pricePerHour = 30.0;
            }

            // 🔥 DETECCIÓN DE MONEDA (defensivo)
            if ($request->filled('currency')) {
                $currency = strtoupper($request->input('currency'));
            } else {
                try {
                    $userIp = $request->ip();
                    $detected = $this->currencyDetectionService->detectCurrencyByIp($userIp);
                    $currency = $detected ?: 'COP';
                    Log::info('Moneda detectada automáticamente', [
                        'ip' => $userIp,
                        'currency' => $currency
                    ]);
                } catch (\Exception $e) {
                    Log::warning('Error detectando moneda por IP en getPackages, fallback a COP', [
                        'ip' => $request->ip(),
                        'error' => $e->getMessage()
                    ]);
                    $currency = 'COP';
                }
            }
            
            // Verificar si es primera compra (si hay usuario autenticado)
            $hasFirstPurchase = false;
            if ($userId) {
                try {
                    $hasFirstPurchase = DB::table('coin_purchases')
                        ->where('user_id', $userId)
                        ->where('status', 'completed')
                        ->exists();
                } catch (\Exception $dbEx) {
                    Log::warning('Error verificando primera compra', ['user_id' => $userId, 'error' => $dbEx->getMessage()]);
                    $hasFirstPurchase = false;
                }
            }

            // Obtener paquetes activos y eliminar duplicados
            // Agrupar por tipo, coins, price y bonus_coins, manteniendo solo el primero (menor ID o menor sort_order)
            $packages = CoinPackage::where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->unique(function ($package) {
                    // Crear una clave única basada en características del paquete
                    return strtolower($package->type) . '_' . 
                           $package->coins . '_' . 
                           $package->price . '_' . 
                           $package->bonus_coins . '_' . 
                           ($package->is_popular ? '1' : '0');
                })
                ->values() // Reindexar el array después de unique
                ->map(function ($package) use ($hasFirstPurchase, $currency, $pricePerHour) {
                    // 🔥 LÓGICA DE PRECIOS SEGÚN TIPO DE PAQUETE
                    if ($package->type === 'gifts') {
                        // REGALOS: Precio fijo 1 moneda = 1 USD (sin bonos, descuentos ni precios regionales)
                        $calculatedPriceUsd = $package->price; // Precio exacto = número de monedas
                        $basePriceUsd = $package->price;
                    } else {
                        // MINUTOS: Calcular precio dinámicamente según precio por hora del país
                        // Precio = (minutos / 60) * precio_por_hora
                        $minutes = $package->minutes ?? ($package->coins / VideoChatCoinController::COST_PER_MINUTE);
                        $calculatedPriceUsd = ($minutes / 60) * $pricePerHour;
                        $basePriceUsd = $package->price; // Precio base original (para referencia)
                    }
                    
                    // Convertir precios a otras monedas para mostrar
                    $usdToCop = config('wompi.usd_to_cop_rate', 4000);
                    $usdToEur = config('wompi.usd_to_eur_rate', 0.92);
                    
                    // Precio en COP (para Wompi, siempre en COP)
                    $priceCop = $calculatedPriceUsd * $usdToCop;
                    
                    // Precio en EUR
                    $priceEur = $calculatedPriceUsd * $usdToEur;
                    
                    // Lógica de precios (mantener compatibilidad con descuentos de primera vez)
                    // Para regalos, no aplicar descuentos
                    if ($package->type === 'gifts') {
                        $showPriceCop = $priceCop;
                        $showDiscount = 0;
                        $isFirstTimeEligible = false;
                    } else if ($hasFirstPurchase) {
                        $showPriceCop = $package->regular_price * $usdToCop;
                        $showDiscount = 0;
                        $isFirstTimeEligible = false;
                    } else {
                        $showPriceCop = $package->is_first_time_only ? $priceCop : $priceCop;
                        $showDiscount = $package->is_first_time_only ? $package->discount_percentage : 0;
                        $isFirstTimeEligible = $package->is_first_time_only;
                    }

                    return [
                        'id' => $package->id,
                        'name' => $package->name,
                        'description' => $package->description,
                        'type' => $package->type,
                        'minutes' => $package->minutes,
                        'coins' => $package->coins,
                        'bonus_coins' => $package->bonus_coins,
                        'total_coins' => $package->coins + $package->bonus_coins,
                        'price_usd' => round($calculatedPriceUsd, 2), // Precio calculado (dinámico para minutos, fijo para regalos)
                        'price_usd_base' => round($basePriceUsd, 2), // Precio base original (para referencia)
                        'price_per_hour' => $package->type === 'gifts' ? null : $pricePerHour, // Solo para minutos
                        'price_eur' => round($priceEur, 2),
                        'price_cop' => (int)$showPriceCop, // Mantener para uso interno de Wompi
                        'price_cop_cents' => (int)($showPriceCop * 100), // Para Wompi
                        'regular_price_cop' => (int)($package->regular_price * $usdToCop),
                        'discount_percentage' => $showDiscount,
                        'is_first_time_only' => $isFirstTimeEligible,
                        'is_popular' => $package->is_popular,
                        'is_active' => $package->is_active,
                        'is_first_purchase' => !$hasFirstPurchase,
                        'usd_to_cop_rate' => $usdToCop,
                        'usd_to_eur_rate' => $usdToEur,
                        'currency' => $currency, // Moneda seleccionada
                        'price_multiplier' => $package->type === 'gifts' ? 1.00 : (($currency === 'USD' || $currency === 'EUR') ? 1.10 : 1.00) // Regalos siempre 1.00, minutos según región
                    ];
                });

            return response()->json([
                'success' => true,
                'packages' => $packages,
                'is_first_purchase' => !$hasFirstPurchase,
                'currency' => $currency, // Moneda detectada/seleccionada
                'currency_detected' => !($request && $request->has('currency') && $request->input('currency')), // true si fue detectada automáticamente
                'default_currency' => 'COP', // Moneda por defecto (Wompi)
                'is_latam' => $this->currencyDetectionService->isLatamCurrency($currency),
                'usd_to_cop_rate' => config('wompi.usd_to_cop_rate', 4000),
                'usd_to_eur_rate' => config('wompi.usd_to_eur_rate', 0.92),
                'environment_info' => $this->getEnvironmentInfo()
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo paquetes Wompi: ' . $e->getMessage(), [
                'exception' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor. Por favor, revisa los logs para más detalles.',
                'message' => 'Error interno del servidor. Por favor, revisa los logs para más detalles.'
            ], 500);
        }
    }

    /**
     * 🔧 Obtener información del ambiente actual
     */
    private function getEnvironmentInfo()
    {
        return [
            'environment' => config('app.env'),
            'sandbox_mode' => config('wompi.sandbox'),
            'app_url' => config('app.url'),
            'timestamp' => now()->toISOString()
        ];
    }

    /**
     * 💳 Crear transacción con Wompi Widget
     */
    public function createPayment(Request $request)
    {
        try {
            // Validación de entrada
            $request->validate([
                'package_id' => 'required|exists:coin_packages,id',
                'currency' => 'nullable|string|max:3', // Opcional: COP, USD, EUR, etc.
                'price_per_hour' => 'nullable|numeric|min:1', // Precio por hora del país
            ]);

            $user = Auth::user();
            $package = CoinPackage::findOrFail($request->package_id);
            
            // 🔥 OBTENER PRECIO POR HORA DEL PAÍS:
            $pricePerHour = $request->has('price_per_hour') && $request->input('price_per_hour')
                ? (float)$request->input('price_per_hour')
                : 30.0; // Precio por defecto LATAM
            
            // 🔥 DETECCIÓN DE MONEDA:
            // 1. Si el usuario especifica una moneda manualmente, usarla
            // 2. Si no, detectar automáticamente por IP
            // 3. Si falla la detección, usar COP por defecto (LATAM)
            if ($request->has('currency') && $request->input('currency')) {
                $currency = strtoupper($request->input('currency'));
            } else {
                // Detección automática por IP
                $userIp = $request->ip();
                $currency = $this->currencyDetectionService->detectCurrencyByIp($userIp);
                
                Log::info('Moneda detectada automáticamente para pago', [
                    'ip' => $userIp,
                    'currency' => $currency,
                    'package_id' => $package->id
                ]);
            }

            // 🔒 PREVENIR COMPRAS DUPLICADAS: Verificar si ya existe una compra pendiente reciente (últimos 30 segundos)
            $recentPendingPurchase = CoinPurchase::where('user_id', $user->id)
                ->where('package_id', $package->id)
                ->where('payment_method', 'wompi')
                ->where('status', 'pending')
                ->where('created_at', '>=', now()->subSeconds(30))
                ->first();

            if ($recentPendingPurchase) {
                Log::warning('⚠️ Intento de crear compra duplicada', [
                    'user_id' => $user->id,
                    'package_id' => $package->id,
                    'existing_purchase_id' => $recentPendingPurchase->id,
                    'created_at' => $recentPendingPurchase->created_at
                ]);
                
                // 🔥 CALCULAR PRECIO SEGÚN TIPO DE PAQUETE
                if ($package->type === 'gifts') {
                    // REGALOS: Precio fijo 1 moneda = 1 USD
                    $calculatedPriceUsd = $package->price;
                    $basePriceUsd = $package->price;
                } else {
                    // MINUTOS: Calcular precio dinámicamente según precio por hora del país
                    $minutes = $package->minutes ?? ($package->coins / VideoChatCoinController::COST_PER_MINUTE);
                    $calculatedPriceUsd = ($minutes / 60) * $pricePerHour;
                    $basePriceUsd = $package->price; // Para referencia
                }
                $usdToCop = config('wompi.usd_to_cop_rate', 4000);
                $priceCop = $calculatedPriceUsd * $usdToCop;
                
                $signature = $this->generateIntegritySignature($recentPendingPurchase->transaction_id, $priceCop * 100, 'COP');
                
                return response()->json([
                    'success' => true,
                    'message' => 'Compra ya en proceso',
                    'purchase_id' => $recentPendingPurchase->id,
                    'wompi_data' => [
                        'public_key' => $this->wompiConfig['public_key'],
                        'currency' => 'COP',
                        'amount_in_cents' => $priceCop * 100,
                        'reference' => $recentPendingPurchase->transaction_id,
                        'signature_integrity' => $signature,
                        'checkout_url' => $this->wompiConfig['checkout_url'],
                        'redirect_url' => (env('WOMPI_PAYMENT_SUCCESS_URL', env('APP_URL') . '/homecliente') . '?payment=wompi&purchase_id=' . $recentPendingPurchase->id),
                        'cancel_url' => (env('WOMPI_PAYMENT_CANCEL_URL', env('APP_URL') . '/homecliente') . '?payment=cancelled&purchase_id=' . $recentPendingPurchase->id),
                        'customer_email' => $user->email,
                        'customer_full_name' => $user->name,
                    ],
                    'package_info' => [
                        'name' => $package->name,
                        'coins' => $package->coins,
                        'bonus_coins' => $package->bonus_coins ?? 0,
                        'total_coins' => $package->coins + ($package->bonus_coins ?? 0),
                        'price_usd' => $calculatedPriceUsd,
                        'price_usd_base' => $basePriceUsd,
                    ],
                    'environment' => config('app.env'),
                    'duplicate_prevented' => true
                ], 200);
            }

            // 🔥 CALCULAR PRECIO SEGÚN TIPO DE PAQUETE
            if ($package->type === 'gifts') {
                // REGALOS: Precio fijo 1 moneda = 1 USD
                $calculatedPriceUsd = $package->price; // Precio exacto = número de monedas
                $basePriceUsd = $package->price;
            } else {
                // MINUTOS: Calcular precio dinámicamente según precio por hora del país
                $minutes = $package->minutes ?? ($package->coins / VideoChatCoinController::COST_PER_MINUTE);
                $calculatedPriceUsd = ($minutes / 60) * $pricePerHour;
                $basePriceUsd = $package->price; // Precio base original (para referencia)
            }
            
            // Convertir precio calculado a COP (Wompi siempre procesa en COP)
            $usdToCop = config('wompi.usd_to_cop_rate', 4000);
            $priceCop = $calculatedPriceUsd * $usdToCop;
            

            // Asegurar que el precio en centavos sea un entero
            $amountInCents = (int)round($priceCop * 100);
            
            // Validar que el monto mínimo sea al menos 1000 COP (según documentación Wompi)
            if ($amountInCents < 100000) { // 1000 COP = 100000 centavos
                throw new Exception("El monto mínimo para transacciones en Wompi es de $1,000 COP");
            }

            // Validar límites de transacción
            $this->validateTransactionLimits($priceCop);

            DB::beginTransaction();

            // Generar referencia única
            $reference = $this->generateUniqueReference($user->id, $package->id);

            // Crear orden de compra
            $purchase = CoinPurchase::create([
                'user_id' => $user->id,
                'package_id' => $package->id,
                'coins' => $package->coins,
                'bonus_coins' => $package->bonus_coins ?? 0,
                'total_coins' => $package->coins + ($package->bonus_coins ?? 0),
                'amount' => $calculatedPriceUsd, // Precio calculado según moneda (USD)
                'currency' => 'USD',
                'payment_method' => 'wompi',
                'status' => 'pending',
                'transaction_id' => $reference,
                'payment_data' => json_encode([
                    'wompi_reference' => $reference,
                    'amount_cop' => $priceCop,
                    'amount_cop_cents' => $amountInCents,
                    'usd_to_cop_rate' => $usdToCop,
                    'currency_selected' => $currency, // Moneda seleccionada por el usuario
                    'price_usd_base' => $basePriceUsd, // Precio base (LATAM para minutos, fijo para regalos)
                    'price_usd_calculated' => $calculatedPriceUsd, // Precio calculado (dinámico para minutos, fijo para regalos)
                    'price_multiplier' => $package->type === 'gifts' ? 1.00 : (($currency === 'USD' || $currency === 'EUR') ? 1.10 : 1.00), // Regalos siempre 1.00
                    'created_at' => now()->toISOString(),
                    'environment' => config('app.env'),
                ])
            ]);

            // Generar firma de integridad usando el monto en centavos como entero
            $signature = $this->generateIntegritySignature($reference, $amountInCents, 'COP');
            
            Log::info("🔐 Firma de integridad generada", [
                'reference' => $reference,
                'amount_in_cents' => $amountInCents,
                'currency' => 'COP',
                'signature_preview' => substr($signature, 0, 20) . '...'
            ]);

            // Construir URL completa de checkout (para registrar en logs y en payment_data)
            $paymentParams = http_build_query([
                'public-key' => $this->wompiConfig['public_key'],
                'currency' => 'COP',
                'amount-in-cents' => $amountInCents,
                'reference' => $reference,
                'signature:integrity' => $signature,
                'redirect-url' => env('WOMPI_PAYMENT_SUCCESS_URL', env('APP_URL') . '/homecliente'),
                'cancel-url' => env('WOMPI_PAYMENT_CANCEL_URL', env('APP_URL') . '/homecliente')
            ]);

            $fullPaymentUrl = rtrim($this->wompiConfig['checkout_url'], '/') . '/p/?' . $paymentParams;

            // Guardar URL (sin revelar firma completa en los logs): obfuscar signature
            $obfuscatedUrl = preg_replace('/(signature:integrity=[^&]+)/', 'signature:integrity=[REDACTED]', $fullPaymentUrl);

            Log::info("🔗 URL de pago construida", [
                'purchase_id' => $purchase->id,
                'checkout_url' => $obfuscatedUrl
            ]);

            // Añadir checkout_url a los datos de pago guardados en la compra
            $paymentData = json_decode($purchase->payment_data, true) ?? [];
            $paymentData['checkout_url'] = $fullPaymentUrl;
            $purchase->payment_data = json_encode($paymentData);
            $purchase->save();

            DB::commit();

            Log::info("✅ Pago Wompi Widget creado", [
                'purchase_id' => $purchase->id,
                'user_id' => $user->id,
                'reference' => $reference,
                'amount_cop' => $priceCop,
                'package_type' => $package->type
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Datos de pago preparados',
                'purchase_id' => $purchase->id,
                'wompi_data' => [
                    'public_key' => $this->wompiConfig['public_key'],
                    'currency' => 'COP',
                    'amount_in_cents' => $amountInCents, // Usar el entero calculado
                    'reference' => $reference,
                    'signature_integrity' => $signature,
                    'checkout_url' => $this->wompiConfig['checkout_url'],
                    'redirect_url' => (env('WOMPI_PAYMENT_SUCCESS_URL', env('APP_URL') . '/homecliente') . '?payment=wompi&purchase_id=' . $purchase->id),
                    'cancel_url' => (env('WOMPI_PAYMENT_CANCEL_URL', env('APP_URL') . '/homecliente') . '?payment=cancelled&purchase_id=' . $purchase->id),
                    'customer_email' => $user->email,
                    'customer_full_name' => $user->name,
                ],
                'package_info' => [
                    'name' => $package->name,
                    'coins' => $package->coins,
                    'bonus_coins' => $package->bonus_coins,
                    'total_coins' => $purchase->total_coins,
                    'price_usd' => $calculatedPriceUsd, // Precio calculado según moneda
                    'price_usd_base' => $basePriceUsd, // Precio base LATAM
                    'price_cop' => $priceCop,
                    'currency' => $currency, // Moneda seleccionada
                    'type' => $package->type
                ],
                'environment' => config('app.env')
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'error' => 'Datos inválidos',
                'validation_errors' => $e->errors()
            ], 422);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error creando pago Wompi: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor. Por favor intenta nuevamente.',
                'error_code' => 'INTERNAL_ERROR'
            ], 500);
        }
    }

    /**
     * 🔑 Generar referencia única
     */
    private function generateUniqueReference($userId, $packageId)
    {
        $timestamp = time();
        $random = strtoupper(substr(md5(uniqid(rand(), true)), 0, 6));
        // Wompi requiere referencias alfanuméricas sin caracteres especiales complejos
        // Usar solo letras, números, guiones y guiones bajos
        $reference = "WMP{$timestamp}{$userId}{$packageId}{$random}";
        
        // Limpiar referencia para asegurar que solo tenga caracteres válidos
        $reference = preg_replace('/[^a-zA-Z0-9_-]/', '', $reference);
        
        return $reference;
    }

    /**
     * 🔐 Generar firma de integridad según documentación Wompi
     */
    private function generateIntegritySignature($reference, $amountInCents, $currency, $expirationTime = null)
    {
        $integritySecret = $this->wompiConfig['integrity_secret'];
        
        // Concatenar según documentación: <Referencia><Monto><Moneda><SecretoIntegridad>
        $concatenatedString = $reference . $amountInCents . $currency;
        
        // Si hay fecha de expiración, incluirla
        if ($expirationTime) {
            $concatenatedString = $reference . $amountInCents . $currency . $expirationTime;
        }
        
        $concatenatedString .= $integritySecret;
        
        // Generar hash SHA256
        return hash('sha256', $concatenatedString);
    }

    /**
     * 💰 Validar límites de transacción
     */
    private function validateTransactionLimits($amountCop)
    {
        $minAmount = config('wompi.limits.min_amount', 1000); // $5,000 COP
        $maxAmount = config('wompi.limits.max_amount', 2000000); // $2,000,000 COP
        
        if ($amountCop < $minAmount) {
            throw new Exception("Monto mínimo de transacción: $" . number_format($minAmount, 0) . " COP");
        }
        
        if ($amountCop > $maxAmount) {
            throw new Exception("Monto máximo de transacción: $" . number_format($maxAmount, 0) . " COP");
        }
    }

    /**
     * 💱 Calcular precio según moneda
     * Aplica +10% para USD/EUR, precio base para LATAM
     * 
     * @param float $basePrice Precio base en USD (LATAM)
     * @param string $currency Moneda de pago (COP, USD, EUR, MXN, ARS, CLP, PEN, etc.)
     * @return float Precio calculado en USD
     */
    private function calculatePriceByCurrency($basePrice, $currency = 'COP')
    {
        // Monedas LATAM: precio base
        $latamCurrencies = ['COP', 'MXN', 'ARS', 'CLP', 'PEN', 'BRL', 'UYU', 'PYG', 'BOB', 'VES', 'GTQ', 'HNL', 'NIO', 'CRC', 'PAB', 'DOP', 'HTG', 'JMD', 'BBD', 'BZD', 'XCD', 'AWG', 'SRD', 'GYD', 'TTD'];
        
        $currencyUpper = strtoupper($currency);
        
        // Si es USD o EUR, aplicar +10%
        if ($currencyUpper === 'USD' || $currencyUpper === 'EUR') {
            return round($basePrice * 1.10, 2);
        }
        
        // Para LATAM, precio base
        return round($basePrice, 2);
    }

    /**
     * 🪙 Agregar monedas al usuario según tipo de paquete
     */
    private function addCoinsToUser($purchase)
    {
        $package = $purchase->package;
        
        try {
            if ($package && $package->type === 'gifts') {
                // Paquetes de regalos
                Log::info('🪪 Agregando gift coins al usuario', ['user_id' => $purchase->user_id, 'amount' => $purchase->coins, 'purchase_id' => $purchase->id]);
                $giftController = new \App\Http\Controllers\GiftCoinsController();
                
                $giftController->addGiftCoins(new Request([
                    'user_id' => $purchase->user_id,
                    'amount' => $purchase->coins,
                    'source' => 'wompi_purchase',
                    'reference_id' => (string)$purchase->id
                ]));

                if ($purchase->bonus_coins > 0) {
                    Log::info('🪪 Agregando bonus gift coins', ['user_id' => $purchase->user_id, 'bonus' => $purchase->bonus_coins, 'purchase_id' => $purchase->id]);
                    $giftController->addGiftCoins(new Request([
                        'user_id' => $purchase->user_id,
                        'amount' => $purchase->bonus_coins,
                        'source' => 'purchase_bonus_wompi',
                        'reference_id' => (string)$purchase->id
                    ]));
                }
            } else {
                // Paquetes de minutos
                Log::info('🪙 Agregando coins al usuario', ['user_id' => $purchase->user_id, 'amount' => $purchase->coins, 'purchase_id' => $purchase->id]);
                $coinController = new VideoChatCoinController();
                
                $coinController->addCoins(new Request([
                        'user_id' => $purchase->user_id,
                        'amount' => $purchase->coins,
                        'type' => 'purchased',
                        'source' => 'wompi_purchase',
                        'reference_id' => (string)$purchase->id
                    ]));

                if ($purchase->bonus_coins > 0) {
                    Log::info('🪙 Agregando bonus coins', ['user_id' => $purchase->user_id, 'bonus' => $purchase->bonus_coins, 'purchase_id' => $purchase->id]);
                    $coinController->addCoins(new Request([
                        'user_id' => $purchase->user_id,
                        'amount' => $purchase->bonus_coins,
                        'type' => 'purchased',
                        'source' => 'purchase_bonus_wompi',
                        'reference_id' => (string)$purchase->id
                    ]));
                }
            }

            Log::info('✅ Monedas añadidas (intentado) para purchase', ['purchase_id' => $purchase->id]);
        } catch (\Exception $e) {
            Log::error('❌ Error agregando monedas al usuario: ' . $e->getMessage(), ['purchase_id' => $purchase->id, 'trace' => $e->getTraceAsString()]);
            throw $e;
        }
    }

    /**
     * 🔐 Webhook Handler - Procesar confirmaciones de Wompi
     */
    public function handleWebhook(Request $request)
    {
        try {
            Log::info('📨 Webhook Wompi recibido', [
                'method' => $request->method(),
                'ip' => $request->ip(),
                'headers' => $request->headers->all(),
                'body' => $request->getContent()
            ]);

            // Validar firma del webhook
            $this->validateWebhookSignature($request);

            $payload = json_decode($request->getContent(), true);
            
            if (!$payload) {
                Log::warning('❌ Webhook sin payload válido');
                return response('Invalid payload', 400);
            }

            // Extraer datos de transacción - múltiples formatos posibles
            $transactionData = null;
            $eventType = 'transaction.updated';
            
            if (isset($payload['data']['transaction'])) {
                $transactionData = $payload['data']['transaction'];
                $eventType = $payload['event'] ?? 'transaction.updated';
            } elseif (isset($payload['transaction'])) {
                $transactionData = $payload['transaction'];
            } elseif (isset($payload['data'])) {
                $transactionData = $payload['data'];
            }

            if (!$transactionData) {
                Log::warning('❌ No se encontró data de transacción en webhook');
                return response('No transaction data', 400);
            }

            Log::info('📥 Evento Wompi procesando', [
                'event_type' => $eventType,
                'transaction_id' => $transactionData['id'] ?? 'unknown',
                'reference' => $transactionData['reference'] ?? 'unknown',
                'status' => $transactionData['status'] ?? 'unknown',
                'amount_in_cents' => $transactionData['amount_in_cents'] ?? 'unknown'
            ]);

            // Procesar la transacción
            return $this->handleTransactionUpdate($transactionData);

        } catch (Exception $e) {
            Log::error('❌ Error procesando webhook Wompi: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response('Error processing webhook', 500);
        }
    }

    /**
     * 🔄 Manejar actualización de transacción
     */
    private function handleTransactionUpdate($transactionData)
    {
        try {
            $reference = $transactionData['reference'] ?? null;
            $status = $transactionData['status'] ?? null;
            $transactionId = $transactionData['id'] ?? null;

            if (!$reference) {
                Log::warning('❌ Webhook sin referencia válida', [
                    'transaction_data' => $transactionData
                ]);
                return response('Missing reference', 400);
            }

            $purchase = CoinPurchase::where('transaction_id', $reference)
                ->where('payment_method', 'wompi')
                ->first();

            if (!$purchase) {
                Log::warning('❌ Compra no encontrada en webhook', [
                    'reference' => $reference,
                    'transaction_id' => $transactionId
                ]);
                return response('Purchase not found', 404);
            }

            Log::info('🔍 Compra encontrada', [
                'purchase_id' => $purchase->id,
                'current_status' => $purchase->status,
                'new_status' => $status
            ]);

            switch ($status) {
                case 'APPROVED':
                    return $this->handleTransactionApproved($purchase, $transactionData);
                    
                case 'DECLINED':
                case 'ERROR':
                    return $this->handleTransactionFailed($purchase, $transactionData);
                    
                case 'PENDING':
                    return $this->handleTransactionPending($purchase, $transactionData);
                    
                default:
                    Log::info('ℹ️ Estado no procesado: ' . $status);
                    return response('Status not processed', 200);
            }

        } catch (Exception $e) {
            Log::error('❌ Error procesando actualización de transacción: ' . $e->getMessage());
            return response('Error processing transaction update', 500);
        }
    }

    /**
     * ✅ Manejar transacción aprobada
     */
    private function handleTransactionApproved($purchase, $transactionData)
    {
        try {
            // Evitar procesamiento duplicado
            if ($purchase->status === 'completed') {
                Log::info('✅ Compra ya procesada', ['purchase_id' => $purchase->id]);
                return response('OK', 200);
            }

            DB::beginTransaction();

            // Actualizar payment_data con información de Wompi
            $currentPaymentData = json_decode($purchase->payment_data, true) ?? [];
            $updatedPaymentData = array_merge($currentPaymentData, [
                'webhook_approved' => $transactionData,
                'wompi_transaction_id' => $transactionData['id'] ?? null,
                'wompi_reference' => $transactionData['reference'] ?? $purchase->transaction_id,
                'completed_at' => now()->toISOString(),
                'environment' => config('app.env'),
                'verified_manually' => true // Marcar que fue verificado manualmente
            ]);

            // Marcar como completado
            $purchase->update([
                'status' => 'completed',
                'completed_at' => now(),
                'payment_data' => json_encode($updatedPaymentData)
            ]);

            // Agregar monedas al usuario
            $this->addCoinsToUser($purchase);

            DB::commit();

            Log::info("✅ Pago Wompi completado y monedas agregadas", [
                'purchase_id' => $purchase->id,
                'user_id' => $purchase->user_id,
                'reference' => $purchase->transaction_id,
                'wompi_transaction_id' => $transactionData['id'] ?? null,
                'coins_added' => $purchase->total_coins,
                'purchased_coins' => $purchase->coins,
                'bonus_coins' => $purchase->bonus_coins
            ]);

            return response('OK', 200);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error procesando pago aprobado: ' . $e->getMessage(), [
                'purchase_id' => $purchase->id,
                'trace' => $e->getTraceAsString()
            ]);
            throw $e; // Lanzar excepción para que el llamador pueda manejarla
        }
    }

    /**
     * ❌ Manejar transacción fallida
     */
    private function handleTransactionFailed($purchase, $transactionData)
    {
        try {
            DB::beginTransaction();

            $purchase->update([
                'status' => 'failed',
                'payment_data' => json_encode(array_merge(
                    json_decode($purchase->payment_data, true) ?? [],
                    [
                        'webhook_failed' => $transactionData,
                        'wompi_transaction_id' => $transactionData['id'] ?? null,
                        'failed_at' => now()->toISOString(),
                        'environment' => config('app.env')
                    ]
                ))
            ]);

            DB::commit();

            Log::info("❌ Pago Wompi fallido", [
                'purchase_id' => $purchase->id,
                'reference' => $purchase->transaction_id,
                'wompi_transaction_id' => $transactionData['id'] ?? null,
                'status' => $transactionData['status'] ?? 'unknown'
            ]);

            return response('OK', 200);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error procesando pago fallido: ' . $e->getMessage());
            return response('Error processing failed payment', 500);
        }
    }

    /**
     * ⏳ Manejar transacción pendiente
     */
    private function handleTransactionPending($purchase, $transactionData)
    {
        try {
            $purchase->update([
                'status' => 'pending_confirmation',
                'payment_data' => json_encode(array_merge(
                    json_decode($purchase->payment_data, true) ?? [],
                    [
                        'webhook_pending' => $transactionData,
                        'wompi_transaction_id' => $transactionData['id'] ?? null,
                        'pending_at' => now()->toISOString(),
                        'environment' => config('app.env')
                    ]
                ))
            ]);

            Log::info("⏳ Pago Wompi pendiente", [
                'purchase_id' => $purchase->id,
                'reference' => $purchase->transaction_id,
                'wompi_transaction_id' => $transactionData['id'] ?? null
            ]);

            return response('OK', 200);

        } catch (Exception $e) {
            Log::error('❌ Error procesando pago pendiente: ' . $e->getMessage());
            return response('Error processing pending payment', 500);
        }
    }

    /**
     * 🔐 Validar firma del webhook
     */
    private function validateWebhookSignature(Request $request)
    {
        // En modo sandbox, ser más permisivo con la validación del webhook
        // ya que puede haber problemas con el checksum en pruebas
        if (config('wompi.sandbox', false)) {
            Log::info('🧪 Modo sandbox: Validación de webhook más permisiva', [
                'ip' => $request->ip(),
                'has_checksum' => $request->header('X-Event-Checksum') ? 'yes' : 'no'
            ]);
            
            // En sandbox, solo validar que existe el checksum si está configurado verify_webhooks
            if (config('wompi.verify_webhooks', true)) {
                $checksum = $request->header('X-Event-Checksum');
                if (!$checksum) {
                    Log::warning('⚠️ Webhook sandbox sin checksum, pero continuando en modo permisivo');
                    // En sandbox, no lanzar excepción si falta el checksum
                }
            }
            return; // En sandbox, permitir el webhook sin validación estricta
        }
        
        if (!config('wompi.verify_webhooks', true)) {
            Log::info('⚠️ Validación de webhook deshabilitada');
            return; // Validación deshabilitada
        }

        $payload = $request->getContent();
        $eventsSecret = $this->wompiConfig['events_secret'] ?? config('wompi.events_secret');
        
        // Wompi envía el checksum en este header específico
        $checksum = $request->header('X-Event-Checksum');
        
        if (!$checksum) {
            Log::warning('⚠️ Webhook sin X-Event-Checksum header', [
                'headers' => $request->headers->all(),
                'ip' => $request->ip()
            ]);
            throw new Exception('Missing webhook checksum');
        }

        // Validar checksum según documentación de Wompi
        // El checksum se calcula como: SHA256(payload + events_secret)
        if ($eventsSecret) {
            $expectedChecksum = hash('sha256', $payload . $eventsSecret);
            
            if (!hash_equals($expectedChecksum, $checksum)) {
                // Registrar detalle y volcar a archivo para facilitar debug (sin events_secret)
                $failureInfo = [
                    'expected' => $expectedChecksum,
                    'received' => $checksum,
                    'ip' => $request->ip(),
                    'payload_length' => strlen($payload),
                    'headers' => $request->headers->all(),
                    'payload_snippet' => substr($payload, 0, 200)
                ];

                Log::error('❌ Webhook con checksum inválido', $failureInfo);

                // Escribir archivo de fallo en storage/logs para análisis posterior
                try {
                    $filename = storage_path('logs/wompi-webhook-failure-' . date('Ymd_His') . '.json');
                    file_put_contents($filename, json_encode($failureInfo, JSON_PRETTY_PRINT));
                    Log::warning('🗂️ Webhook inválido volcado a archivo', ['file' => $filename]);
                } catch (\Exception $e) {
                    Log::error('❌ No se pudo escribir el archivo de fallo del webhook: ' . $e->getMessage());
                }

                // Si la petición viene de localhost en entorno no producción, aceptar para pruebas locales
                $ip = $request->ip();
                if (in_array($ip, ['127.0.0.1', '::1']) && config('app.env') !== 'production') {
                    Log::warning('⚠️ Webhook con checksum inválido pero proveniente de localhost en entorno no prod — aceptando para pruebas', ['ip' => $ip]);
                    return; // permitir continuar sin lanzar excepción (modo debug)
                }

                throw new Exception('Invalid webhook checksum');
            }
            
            Log::info('✅ Webhook con checksum válido', [
                'checksum' => substr($checksum, 0, 20) . '...',
                'ip' => $request->ip()
            ]);
        } else {
            Log::warning('⚠️ No hay events_secret configurado, validando solo presencia de checksum');
            // Si no hay events_secret, solo validamos que existe el checksum
            Log::info('✅ Webhook con checksum presente', ['checksum' => substr($checksum, 0, 20) . '...']);
        }
    }

    /**
     * 🔍 Verificar estado de transacción
     */
    public function getTransactionStatus($transactionId)
    {
        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->wompiConfig['private_key'],
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json'
                ])
                ->get($this->wompiConfig['api_url'] . '/transactions/' . $transactionId);

            if ($response->successful()) {
                $data = $response->json();
                return $data['data'] ?? null;
            }

            return null;

        } catch (Exception $e) {
            Log::error('❌ Error verificando estado de transacción Wompi: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * 🔍 Verificar estado de compra
     */
    public function checkPurchaseStatus($purchaseId)
    {
        try {
            $user = Auth::user();
            
            $purchase = CoinPurchase::where('id', $purchaseId)
                ->where('user_id', $user->id)
                ->with('package')
                ->first();

            if (!$purchase) {
                return response()->json([
                    'success' => false,
                    'error' => 'Compra no encontrada'
                ], 404);
            }

            // Si el pago está pendiente, verificar con Wompi directamente
            // Wompi usa "reference" para buscar transacciones, no transaction_id
            $reference = $purchase->transaction_id; // transaction_id contiene la reference
            $wompiTransactionId = null;
            
            // Intentar obtener el transaction_id de Wompi desde payment_data
            if ($purchase->payment_data) {
                $paymentData = json_decode($purchase->payment_data, true);
                $wompiTransactionId = $paymentData['wompi_transaction_id'] ?? 
                                     $paymentData['transaction_id'] ?? null;
            }
            
            // Buscar por reference primero (más confiable), luego por transaction_id si está disponible
            $searchId = $wompiTransactionId ?: $reference;
            
            if ($purchase->status === 'pending' && $searchId) {
                try {
                    Log::info('🔍 Verificando estado con Wompi API', [
                        'purchase_id' => $purchase->id,
                        'reference' => $reference,
                        'wompi_transaction_id' => $wompiTransactionId,
                        'search_id' => $searchId,
                        'api_url' => $this->wompiConfig['api_url']
                    ]);

                    // Intentar buscar por reference primero (más confiable en sandbox)
                    // Wompi usa el parámetro ?reference= para buscar transacciones
                    $response = Http::timeout(10)
                        ->withHeaders([
                            'Authorization' => 'Bearer ' . $this->wompiConfig['private_key'],
                            'Accept' => 'application/json'
                        ])
                        ->get($this->wompiConfig['api_url'] . '/transactions?reference=' . urlencode($reference));
                    
                    // Si falla buscando por reference, intentar por transaction_id directo
                    if (!$response->successful() && $wompiTransactionId && $reference !== $wompiTransactionId) {
                        Log::info('🔄 Reintentando búsqueda por transaction_id', [
                            'purchase_id' => $purchase->id,
                            'wompi_transaction_id' => $wompiTransactionId
                        ]);
                        $response = Http::timeout(10)
                            ->withHeaders([
                                'Authorization' => 'Bearer ' . $this->wompiConfig['private_key'],
                                'Accept' => 'application/json'
                            ])
                            ->get($this->wompiConfig['api_url'] . '/transactions/' . $wompiTransactionId);
                    }
                    
                    // Si aún falla, intentar buscar todas las transacciones recientes y filtrar
                    if (!$response->successful()) {
                        Log::info('🔄 Intentando búsqueda en lista de transacciones', [
                            'purchase_id' => $purchase->id,
                            'reference' => $reference
                        ]);
                        // Buscar transacciones recientes (últimas 50)
                        $response = Http::timeout(10)
                            ->withHeaders([
                                'Authorization' => 'Bearer ' . $this->wompiConfig['private_key'],
                                'Accept' => 'application/json'
                            ])
                            ->get($this->wompiConfig['api_url'] . '/transactions');
                    }

                    if ($response->successful()) {
                        $responseData = $response->json();
                        
                        // Manejar diferentes estructuras de respuesta de Wompi
                        $transactionData = null;
                        
                        if (isset($responseData['data']) && is_array($responseData['data'])) {
                            // Si es un array, buscar la transacción que coincida con nuestra reference
                            $transactions = $responseData['data'];
                            foreach ($transactions as $tx) {
                                $txReference = $tx['reference'] ?? null;
                                $txId = $tx['id'] ?? null;
                                
                                // Buscar por reference exacta o por transaction_id
                                if ($txReference === $reference || 
                                    ($wompiTransactionId && $txId === $wompiTransactionId) ||
                                    ($txReference && strpos($txReference, $reference) !== false)) {
                                    $transactionData = $tx;
                                    Log::info('✅ Transacción encontrada por coincidencia', [
                                        'reference_match' => $txReference === $reference,
                                        'id_match' => $txId === $wompiTransactionId,
                                        'found_reference' => $txReference,
                                        'found_id' => $txId
                                    ]);
                                    break;
                                }
                            }
                            
                            // Si no encontramos coincidencia exacta pero hay transacciones, buscar la más reciente
                            if (!$transactionData && count($transactions) > 0) {
                                // Ordenar por fecha y tomar la más reciente que pueda ser nuestra
                                usort($transactions, function($a, $b) {
                                    $dateA = $a['created_at'] ?? $a['createdAt'] ?? '1970-01-01';
                                    $dateB = $b['created_at'] ?? $b['createdAt'] ?? '1970-01-01';
                                    return strtotime($dateB) - strtotime($dateA);
                                });
                                
                                // Tomar la más reciente que tenga un monto similar o que sea reciente (últimos 5 minutos)
                                foreach ($transactions as $tx) {
                                    $txDate = $tx['created_at'] ?? $tx['createdAt'] ?? null;
                                    if ($txDate && strtotime($txDate) > (time() - 300)) { // Últimos 5 minutos
                                        $transactionData = $tx;
                                        Log::info('📋 Usando transacción reciente como fallback', [
                                            'reference' => $tx['reference'] ?? 'unknown',
                                            'id' => $tx['id'] ?? 'unknown',
                                            'created_at' => $txDate
                                        ]);
                                        break;
                                    }
                                }
                                
                                // Si aún no encontramos, usar la más reciente
                                if (!$transactionData) {
                                    $transactionData = $transactions[0];
                                    Log::info('📋 Usando primera transacción de la lista', [
                                        'reference' => $transactionData['reference'] ?? 'unknown',
                                        'id' => $transactionData['id'] ?? 'unknown'
                                    ]);
                                }
                            }
                        } else {
                            $transactionData = $responseData['data'] ?? $responseData;
                        }
                        
                        $wompiStatus = $transactionData['status'] ?? null;

                        Log::info('🔍 Estado verificado con Wompi', [
                            'purchase_id' => $purchase->id,
                            'local_status' => $purchase->status,
                            'wompi_status' => $wompiStatus,
                            'reference' => $reference,
                            'wompi_transaction_id' => $transactionData['id'] ?? null,
                            'full_response' => $transactionData
                        ]);

                        // Si Wompi dice que está aprobado pero localmente está pendiente, procesarlo automáticamente
                        if (in_array($wompiStatus, ['APPROVED', 'APPROVED_PARTIAL']) && $purchase->status === 'pending') {
                            Log::info('🔄🔄🔄 PROCESANDO AUTOMÁTICAMENTE: Pago aprobado en Wompi pero pendiente localmente', [
                                'purchase_id' => $purchase->id,
                                'wompi_status' => $wompiStatus,
                                'transaction_id' => $transactionData['id'] ?? null,
                                'reference' => $reference,
                                'amount_in_cents' => $transactionData['amount_in_cents'] ?? null,
                                'user_id' => $purchase->user_id
                            ]);
                            
                            try {
                                $this->handleTransactionApproved($purchase, $transactionData);
                                
                                // Recargar el purchase para obtener el estado actualizado
                                $purchase->refresh();
                                
                                Log::info('✅✅✅ PAGO PROCESADO AUTOMÁTICAMENTE - Monedas agregadas al usuario', [
                                    'purchase_id' => $purchase->id,
                                    'new_status' => $purchase->status,
                                    'coins_added' => $purchase->total_coins,
                                    'purchased_coins' => $purchase->coins,
                                    'bonus_coins' => $purchase->bonus_coins,
                                    'user_id' => $purchase->user_id,
                                    'completed_at' => $purchase->completed_at
                                ]);
                            } catch (Exception $e) {
                                Log::error('❌ ERROR CRÍTICO al procesar pago aprobado automáticamente: ' . $e->getMessage(), [
                                    'purchase_id' => $purchase->id,
                                    'trace' => $e->getTraceAsString(),
                                    'wompi_status' => $wompiStatus,
                                    'transaction_data' => $transactionData
                                ]);
                                // No lanzar excepción, solo loguear para que el usuario pueda ver el estado
                            }
                        } else {
                            Log::info('ℹ️ Estado de Wompi no requiere procesamiento', [
                                'purchase_id' => $purchase->id,
                                'wompi_status' => $wompiStatus,
                                'local_status' => $purchase->status,
                                'needs_processing' => in_array($wompiStatus, ['APPROVED', 'APPROVED_PARTIAL']) && $purchase->status === 'pending',
                                'is_approved' => in_array($wompiStatus, ['APPROVED', 'APPROVED_PARTIAL']),
                                'is_pending' => $purchase->status === 'pending'
                            ]);
                        }
                    } else {
                        Log::warning('⚠️ Error en respuesta de Wompi API', [
                            'purchase_id' => $purchase->id,
                            'status_code' => $response->status(),
                            'response' => $response->body()
                        ]);
                    }
                } catch (Exception $e) {
                    Log::error('❌ Error verificando estado con Wompi API: ' . $e->getMessage(), [
                        'purchase_id' => $purchase->id,
                        'reference' => $reference,
                        'wompi_transaction_id' => $wompiTransactionId,
                        'search_id' => $searchId,
                        'trace' => $e->getTraceAsString()
                    ]);
                }
            } else {
                Log::info('ℹ️ No se puede verificar con Wompi', [
                    'purchase_id' => $purchase->id,
                    'status' => $purchase->status,
                    'has_transaction_id' => !empty($purchase->transaction_id),
                    'transaction_id_value' => $purchase->transaction_id,
                    'payment_data' => $purchase->payment_data
                ]);
                
                // Si no hay transaction_id pero el pago fue creado hace más de 5 minutos, 
                // podría ser un problema de sincronización - intentar buscar por reference
                if (empty($transactionId) && $purchase->created_at->diffInMinutes(now()) > 5) {
                    Log::warning('⚠️ Compra pendiente sin transaction_id después de 5 minutos', [
                        'purchase_id' => $purchase->id,
                        'created_at' => $purchase->created_at
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'purchase' => [
                    'id' => $purchase->id,
                    'status' => $purchase->status,
                    'coins' => $purchase->coins,
                    'bonus_coins' => $purchase->bonus_coins,
                    'total_coins' => $purchase->total_coins,
                    'amount' => $purchase->amount,
                    'package' => $purchase->package,
                    'payment_method' => $purchase->payment_method,
                    'created_at' => $purchase->created_at->toISOString(),
                    'completed_at' => $purchase->completed_at ? $purchase->completed_at->toISOString() : null,
                ],
                'environment' => config('app.env')
            ]);
        } catch (Exception $e) {
            Log::error('❌ Error verificando estado Wompi: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'error' => 'Error al verificar el estado',
                'environment' => config('app.env')
            ], 500);
        }

        // Si no se encontró la compra localmente, devolver success:false para que el frontend intente resolver por transaction_id
        return response()->json([
            'success' => false,
            'error' => 'Compra no encontrada localmente. Intenta resolver por transaction id si lo tienes.'
        ], 404);
    }

    /**
     * 🔎 Resolver transacción de Wompi por transaction id (param 'id' en la URL) y procesar la compra
     */
    public function resolveByTransactionId(Request $request, $transactionId)
    {
        try {
            $user = Auth::user();

            // Obtener la transacción desde Wompi
            $transactionData = $this->getTransactionStatus($transactionId);

            if (!$transactionData) {
                return response()->json(['success' => false, 'error' => 'Transacción Wompi no encontrada'], 404);
            }

            $reference = $transactionData['reference'] ?? null;

            if (!$reference) {
                return response()->json(['success' => false, 'error' => 'Transaction no contiene reference'], 400);
            }

            // Buscar compra local por reference
            $purchase = CoinPurchase::where('transaction_id', $reference)
                ->where('user_id', $user->id)
                ->where('payment_method', 'like', 'wompi%')
                ->first();

            if (!$purchase) {
                return response()->json(['success' => false, 'error' => 'No se encontró compra local para esta transacción', 'reference' => $reference], 404);
            }

            // Registrar que recibimos la transacción y procesarla según su estado
            Log::info('🔁 Resolviendo transacción Wompi por ID', ['transaction_id' => $transactionId, 'reference' => $reference, 'purchase_id' => $purchase->id]);

            // Procesar la actualización de estado (esto llamará a handleTransactionApproved si corresponde)
            $this->handleTransactionUpdate($transactionData);

            // Refrescar y devolver estado actualizado
            $purchase->refresh();

            return response()->json(['success' => true, 'message' => 'Compra resuelta', 'purchase' => [
                'id' => $purchase->id,
                'status' => $purchase->status,
                'total_coins' => $purchase->total_coins
            ]]);

        } catch (Exception $e) {
            Log::error('❌ Error resolviendo transacción Wompi: ' . $e->getMessage(), ['trace' => $e->getTraceAsString(), 'transaction_id' => $transactionId]);
            return response()->json(['success' => false, 'error' => 'Error interno al resolver transacción'], 500);
        }
    }

    /**
     * 📊 Obtener historial de compras Wompi
     */
    public function getPurchaseHistory()
    {
        try {
            $user = Auth::user();
            
            $purchases = CoinPurchase::where('user_id', $user->id)
                ->where('payment_method', 'wompi')
                ->with('package')
                ->orderBy('created_at', 'desc')
                ->paginate(50); // Aumentar a 50 para mostrar más pagos

            $formattedPurchases = $purchases->getCollection()->map(function ($purchase) {
                return [
                    'id' => $purchase->id,
                    'package_name' => $purchase->package->name ?? 'Paquete eliminado',
                    'package_type' => $purchase->package->type ?? 'minutes', // Agregar tipo de paquete
                    'coins' => $purchase->coins,
                    'bonus_coins' => $purchase->bonus_coins,
                    'total_coins' => $purchase->total_coins,
                    'amount' => $purchase->amount,
                    'currency' => $purchase->currency,
                    'status' => $purchase->status,
                    'transaction_id' => $purchase->transaction_id,
                    'payment_method' => $purchase->payment_method,
                    'created_at' => $purchase->created_at->toISOString(),
                    'completed_at' => $purchase->completed_at ? $purchase->completed_at->toISOString() : null,
                    'minutes_equivalent' => floor($purchase->total_coins / VideoChatCoinController::COST_PER_MINUTE)
                ];
            });

            $purchases->setCollection($formattedPurchases);

            return response()->json([
                'success' => true,
                'purchases' => $purchases,
                'environment' => config('app.env')
            ]);

        } catch (Exception $e) {
            Log::error('❌ Error obteniendo historial Wompi: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener el historial',
                'environment' => config('app.env')
            ], 500);
        }
    }

    /**
     * ✅ Procesar manualmente un pago pendiente
     * Este método verifica con Wompi y procesa el pago si está aprobado
     */
    public function processPendingPurchase(Request $request, $purchaseId)
    {
        try {
            $user = Auth::user();
            $purchase = CoinPurchase::where('id', $purchaseId)
                ->where('user_id', $user->id)
                ->where('payment_method', 'wompi')
                ->first();

            if (!$purchase) {
                return response()->json(['success' => false, 'error' => 'Compra no encontrada'], 404);
            }

            if ($purchase->status === 'completed') {
                return response()->json([
                    'success' => true, 
                    'message' => 'La compra ya está completada',
                    'purchase' => $purchase
                ], 200);
            }

            // Obtener el ID de transacción de Wompi
            $paymentData = json_decode($purchase->payment_data, true);
            $reference = $purchase->transaction_id;
            $wompiTransactionId = $paymentData['wompi_transaction_id'] ?? null;
            $searchId = $wompiTransactionId ?: $reference;

            if (!$searchId) {
                Log::warning('❌ Compra pendiente sin transaction_id ni reference', [
                    'purchase_id' => $purchase->id
                ]);
                return response()->json([
                    'success' => false, 
                    'error' => 'ID de transacción Wompi no encontrado para esta compra'
                ], 400);
            }

            // Verificar con Wompi - Intentar múltiples métodos de búsqueda
            Log::info('🔍 Verificando pago pendiente con Wompi', [
                'purchase_id' => $purchase->id,
                'reference' => $reference,
                'wompi_transaction_id' => $wompiTransactionId,
                'search_id' => $searchId,
                'created_at' => $purchase->created_at->toISOString()
            ]);

            $response = null;
            $transactionData = null;
            
            // Método 1: Buscar por transaction_id de Wompi si está disponible
            if ($wompiTransactionId) {
                try {
                    $response = Http::timeout(15)
                        ->withHeaders([
                            'Authorization' => 'Bearer ' . $this->wompiConfig['private_key'],
                            'Accept' => 'application/json'
                        ])
                        ->get($this->wompiConfig['api_url'] . '/transactions/' . $wompiTransactionId);
                    
                    if ($response->successful()) {
                        $responseData = $response->json();
                        $transactionData = $responseData['data'] ?? $responseData;
                        Log::info('✅ Transacción encontrada por wompi_transaction_id', [
                            'purchase_id' => $purchase->id,
                            'transaction_id' => $wompiTransactionId
                        ]);
                    }
                } catch (Exception $e) {
                    Log::warning('⚠️ Error buscando por wompi_transaction_id: ' . $e->getMessage());
                }
            }
            
            // Método 2: Si no se encontró, buscar por reference
            if (!$transactionData && $reference) {
                try {
                    $response = Http::timeout(15)
                        ->withHeaders([
                            'Authorization' => 'Bearer ' . $this->wompiConfig['private_key'],
                            'Accept' => 'application/json'
                        ])
                        ->get($this->wompiConfig['api_url'] . '/transactions?reference=' . urlencode($reference));
                    
                    if ($response->successful()) {
                        $responseData = $response->json();
                        if (isset($responseData['data']) && is_array($responseData['data']) && count($responseData['data']) > 0) {
                            // Buscar la transacción que coincida con nuestra reference
                            foreach ($responseData['data'] as $tx) {
                                if (($tx['reference'] ?? null) === $reference) {
                                    $transactionData = $tx;
                                    break;
                                }
                            }
                            if (!$transactionData) {
                                $transactionData = $responseData['data'][0];
                            }
                            Log::info('✅ Transacción encontrada por reference', [
                                'purchase_id' => $purchase->id,
                                'reference' => $reference
                            ]);
                        }
                    }
                } catch (Exception $e) {
                    Log::warning('⚠️ Error buscando por reference: ' . $e->getMessage());
                }
            }
            
            // Si aún no tenemos datos, intentar el método original
            if (!$transactionData) {
                $response = Http::timeout(15)
                    ->withHeaders([
                        'Authorization' => 'Bearer ' . $this->wompiConfig['private_key'],
                        'Accept' => 'application/json'
                    ])
                    ->get($this->wompiConfig['api_url'] . '/transactions/' . $searchId);
            }

            // Si aún no tenemos transactionData y la respuesta falló
            if (!$transactionData && (!$response || !$response->successful())) {
                // Intentar buscar por reference si falla
                if ($wompiTransactionId && $reference !== $wompiTransactionId) {
                    Log::info('🔄 Reintentando búsqueda por reference', [
                        'purchase_id' => $purchase->id,
                        'reference' => $reference
                    ]);
                    $response = Http::timeout(15)
                        ->withHeaders([
                            'Authorization' => 'Bearer ' . $this->wompiConfig['private_key'],
                            'Accept' => 'application/json'
                        ])
                        ->get($this->wompiConfig['api_url'] . '/transactions?reference=' . $reference);
                }

                if (!$response->successful()) {
                    $errorBody = $response->body();
                    $errorData = json_decode($errorBody, true);
                    
                    Log::error('❌ Error consultando Wompi API', [
                        'purchase_id' => $purchase->id,
                        'status_code' => $response->status(),
                        'reference' => $reference,
                        'wompi_transaction_id' => $wompiTransactionId,
                        'search_id' => $searchId,
                        'api_url' => $this->wompiConfig['api_url'],
                        'response' => $errorBody
                    ]);
                    
                    // Si es 404, puede ser que la transacción no existe en Wompi o el ID es incorrecto
                    if ($response->status() === 404) {
                        return response()->json([
                            'success' => false,
                            'error' => 'No se encontró la transacción en Wompi. Verifica que el pago se haya completado correctamente. Si el dinero ya fue descontado, contacta con soporte.',
                            'wompi_status_code' => 404,
                            'reference' => $reference
                        ], 400);
                    }
                    
                    return response()->json([
                        'success' => false,
                        'error' => 'No se pudo verificar el pago con Wompi. Estado HTTP: ' . $response->status(),
                        'wompi_status_code' => $response->status(),
                        'details' => $errorData['error'] ?? $errorBody
                    ], 400);
                }
            }

            $responseData = $response->json();
            
            // Manejar diferentes estructuras de respuesta
            $transactionData = null;
            if (isset($responseData['data']) && is_array($responseData['data'])) {
                // Si es un array, buscar la transacción que coincida
                foreach ($responseData['data'] as $tx) {
                    if (($tx['reference'] ?? null) === $reference || ($tx['id'] ?? null) === $wompiTransactionId) {
                        $transactionData = $tx;
                        break;
                    }
                }
                if (!$transactionData && count($responseData['data']) > 0) {
                    $transactionData = $responseData['data'][0];
                }
            } else {
                $transactionData = $responseData['data'] ?? $responseData;
            }

            $wompiStatus = $transactionData['status'] ?? null;

            Log::info('📊 Estado de Wompi', [
                'purchase_id' => $purchase->id,
                'wompi_status' => $wompiStatus,
                'local_status' => $purchase->status,
                'transaction_data' => $transactionData
            ]);

            if (in_array($wompiStatus, ['APPROVED', 'APPROVED_PARTIAL'])) {
                // Procesar el pago
                $this->handleTransactionApproved($purchase, $transactionData);
                $purchase->refresh();

                Log::info('✅ Pago procesado exitosamente', [
                    'purchase_id' => $purchase->id,
                    'new_status' => $purchase->status,
                    'coins_added' => $purchase->total_coins
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Pago procesado exitosamente. Monedas añadidas.',
                    'purchase' => [
                        'id' => $purchase->id,
                        'status' => $purchase->status,
                        'total_coins' => $purchase->total_coins,
                        'coins' => $purchase->coins,
                        'bonus_coins' => $purchase->bonus_coins
                    ]
                ], 200);
            } else if ($wompiStatus === null && $response->status() === 404) {
                // Si no encontramos la transacción pero el dinero ya fue descontado,
                // ofrecer procesar manualmente si el usuario confirma
                Log::warning('⚠️ Transacción no encontrada en Wompi pero dinero descontado', [
                    'purchase_id' => $purchase->id,
                    'reference' => $reference,
                    'amount' => $purchase->amount
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'No se encontró la transacción en Wompi. Si el dinero ya fue descontado de tu cuenta, el pago puede estar procesándose. Intenta de nuevo en unos minutos o contacta con soporte.',
                    'wompi_status' => null,
                    'can_retry' => true,
                    'reference' => $reference
                ], 400);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => 'El pago aún no ha sido aprobado por Wompi. Estado actual: ' . ($wompiStatus ?? 'Desconocido'),
                    'wompi_status' => $wompiStatus
                ], 400);
            }

        } catch (Exception $e) {
            Log::error('❌ Error procesando compra pendiente manualmente: ' . $e->getMessage(), [
                'purchase_id' => $purchaseId,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Error interno al procesar la compra pendiente: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 🧪 Crear pago de prueba (sandbox local)
     */
    public function createSandboxPurchase(Request $request)
    {
        // 🧪 SANDBOX: Usar la misma lógica de createPayment pero con credenciales de sandbox
        // Esto permite probar el flujo completo de redirección a Wompi sandbox
        try {
            // Validación de entrada
            $request->validate([
                'package_id' => 'required|exists:coin_packages,id',
                'currency' => 'nullable|string|max:3',
                'price_per_hour' => 'nullable|numeric|min:1',
            ]);

            $user = Auth::user();
            $package = CoinPackage::findOrFail($request->package_id);
            
            // 🔥 OBTENER PRECIO POR HORA DEL PAÍS (solo para minutos)
            $pricePerHour = $request->has('price_per_hour') && $request->input('price_per_hour')
                ? (float)$request->input('price_per_hour')
                : 30.0;
            
            // 🔥 DETECCIÓN DE MONEDA
            if ($request->has('currency') && $request->input('currency')) {
                $currency = strtoupper($request->input('currency'));
            } else {
                $userIp = $request->ip();
                $currency = $this->currencyDetectionService->detectCurrencyByIp($userIp);
            }

            // 🔥 CALCULAR PRECIO SEGÚN TIPO DE PAQUETE
            if ($package->type === 'gifts') {
                // REGALOS: Precio fijo 1 moneda = 1 USD
                $calculatedPriceUsd = $package->price;
                $basePriceUsd = $package->price;
            } else {
                // MINUTOS: Calcular precio dinámicamente según precio por hora del país
                $minutes = $package->minutes ?? ($package->coins / VideoChatCoinController::COST_PER_MINUTE);
                $calculatedPriceUsd = ($minutes / 60) * $pricePerHour;
                $basePriceUsd = $package->price;
            }
            
            // Convertir precio calculado a COP (Wompi siempre procesa en COP)
            $usdToCop = config('wompi.usd_to_cop_rate', 4000);
            $priceCop = $calculatedPriceUsd * $usdToCop;
            
            // Asegurar que el precio en centavos sea un entero
            $amountInCents = (int)round($priceCop * 100);
            
            // Validar que el monto mínimo sea al menos 1000 COP
            if ($amountInCents < 100000) {
                throw new Exception("El monto mínimo para transacciones en Wompi es de $1,000 COP");
            }

            // Validar límites de transacción
            $this->validateTransactionLimits($priceCop);

            DB::beginTransaction();

            // Generar referencia única
            $reference = $this->generateUniqueReference($user->id, $package->id);

            // Crear orden de compra (pendiente, se completará cuando Wompi confirme)
            $purchase = CoinPurchase::create([
                'user_id' => $user->id,
                'package_id' => $package->id,
                'coins' => $package->coins,
                'bonus_coins' => $package->bonus_coins ?? 0,
                'total_coins' => $package->coins + ($package->bonus_coins ?? 0),
                'amount' => $calculatedPriceUsd,
                'currency' => 'USD',
                'payment_method' => 'wompi_sandbox',
                'status' => 'pending',
                'transaction_id' => $reference,
                'payment_data' => json_encode([
                    'wompi_reference' => $reference,
                    'amount_cop' => $priceCop,
                    'amount_cop_cents' => $amountInCents,
                    'usd_to_cop_rate' => $usdToCop,
                    'currency_selected' => $currency,
                    'price_usd_base' => $basePriceUsd,
                    'price_usd_calculated' => $calculatedPriceUsd,
                    'price_multiplier' => $package->type === 'gifts' ? 1.00 : (($currency === 'USD' || $currency === 'EUR') ? 1.10 : 1.00),
                    'sandbox' => true,
                    'created_at' => now()->toISOString(),
                    'environment' => config('app.env'),
                ])
            ]);

            // Generar firma de integridad usando el monto en centavos como entero
            $signature = $this->generateIntegritySignature($reference, $amountInCents, 'COP');
            
            Log::info("🧪 Pago Wompi Sandbox Widget creado", [
                'user_id' => $user->id,
                'package_id' => $package->id,
                'package_type' => $package->type,
                'reference' => $reference,
                'amount_usd' => $calculatedPriceUsd,
                'amount_cop' => $priceCop,
                'amount_cop_cents' => $amountInCents,
                'currency' => $currency,
                'sandbox' => true
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Pago sandbox creado exitosamente',
                'purchase_id' => $purchase->id,
                'wompi_data' => [
                    'public_key' => $this->wompiConfig['public_key'],
                    'currency' => 'COP',
                    'amount_in_cents' => $amountInCents,
                    'reference' => $reference,
                    'signature_integrity' => $signature,
                    'checkout_url' => $this->wompiConfig['checkout_url'],
                    'redirect_url' => (env('WOMPI_PAYMENT_SUCCESS_URL', env('APP_URL') . '/homecliente') . '?payment=wompi&purchase_id=' . $purchase->id),
                    'cancel_url' => (env('WOMPI_PAYMENT_CANCEL_URL', env('APP_URL') . '/homecliente') . '?payment=cancelled&purchase_id=' . $purchase->id),
                    'customer_email' => $user->email,
                    'customer_full_name' => $user->name,
                    'sandbox' => true
                ],
                'package_info' => [
                    'name' => $package->name,
                    'coins' => $package->coins,
                    'bonus_coins' => $package->bonus_coins ?? 0,
                    'total_coins' => $package->coins + ($package->bonus_coins ?? 0),
                    'price_usd' => $calculatedPriceUsd,
                    'price_usd_base' => $basePriceUsd,
                ],
                'environment' => config('app.env'),
                'sandbox' => true
            ]);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error creando pago sandbox Wompi: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error creando el pago sandbox: ' . $e->getMessage()
            ], 500);
        }
    }
}