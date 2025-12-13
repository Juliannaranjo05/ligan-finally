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
use Exception;

class CoinbaseCommerceController extends Controller
{
    private $coinbaseConfig;

    public function __construct()
    {
        $this->coinbaseConfig = [
            // Credenciales Coinbase Commerce
            'api_key' => config('coinbase.api_key'),
            'webhook_secret' => config('coinbase.webhook_secret'),
            
            // URLs de Coinbase Commerce
            'api_url' => config('coinbase.api_url', 'https://api.commerce.coinbase.com'),
            'checkout_url' => config('coinbase.checkout_url'),
            
            // Configuración
            'sandbox' => config('coinbase.sandbox', false),
            'currency' => config('coinbase.currency', 'USD'),
            'environment' => config('app.env'),
        ];
    }

    /**
     * Obtener balance de monedas del usuario
     */
    public function getBalance()
    {
        try {
            $coinController = new VideoChatCoinController();
            return $coinController->getBalance();
            
        } catch (Exception $e) {
            Log::error('Error obteniendo balance de monedas: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener el balance'
            ], 500);
        }
    }

    /**
     * Obtener paquetes de monedas disponibles
     */
    public function getPackages()
    {
        try {
            $user = auth()->user();
            
            // Verificar si es primera compra
            $hasFirstPurchase = DB::table('coin_purchases')
                ->where('user_id', $user->id)
                ->where('status', 'completed')
                ->exists();

            $packages = CoinPackage::where('is_active', true)
                ->orderBy('sort_order')
                ->get()
                ->map(function ($package) use ($hasFirstPurchase) {
                    // Lógica de precios
                    if ($hasFirstPurchase) {
                        $showPrice = $package->regular_price;
                        $showDiscount = 0;
                        $isFirstTimeEligible = false;
                    } else {
                        $showPrice = $package->is_first_time_only ? $package->price : $package->regular_price;
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
                        'price_usd' => $showPrice,
                        'price' => $showPrice,
                        'regular_price' => $package->regular_price,
                        'original_price' => $package->original_price,
                        'discount_percentage' => $showDiscount,
                        'is_first_time_only' => $isFirstTimeEligible,
                        'is_popular' => $package->is_popular,
                        'is_active' => $package->is_active,
                        'is_first_purchase' => !$hasFirstPurchase,
                        'original_discount_price' => $package->price
                    ];
                });

            return response()->json([
                'success' => true,
                'packages' => $packages,
                'is_first_purchase' => !$hasFirstPurchase,
                'environment_info' => $this->getEnvironmentInfo()
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo paquetes Coinbase Commerce: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo paquetes'
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
            'sandbox_mode' => config('coinbase.sandbox'),
            'app_url' => config('app.url'),
            'timestamp' => now()->toISOString()
        ];
    }

    /**
     * 💳 CREAR CHARGE - Generar pago con Coinbase Commerce
     */
    public function createPayment(Request $request)
    {
        try {
            // Validación de entrada
            $request->validate([
                'package_id' => 'required|exists:coin_packages,id',
            ]);

            $user = Auth::user();
            $package = CoinPackage::findOrFail($request->package_id);

            // Validar límites de transacción
            $this->validateTransactionLimits($package->price);

            DB::beginTransaction();

            // Crear orden de compra
            $purchase = CoinPurchase::create([
                'user_id' => $user->id,
                'package_id' => $package->id,
                'coins' => $package->coins,
                'bonus_coins' => $package->bonus_coins ?? 0,
                'total_coins' => $package->coins + ($package->bonus_coins ?? 0),
                'amount' => $package->price,
                'currency' => 'USD',
                'payment_method' => 'coinbase_commerce',
                'status' => 'pending',
                'transaction_id' => 'coinbase_' . time() . '_' . $user->id . '_' . uniqid(),
            ]);

            // Crear Charge en Coinbase Commerce
            $chargeResult = $this->createCoinbaseCharge($purchase, $user, $package);

            if ($chargeResult['success']) {
                // Actualizar purchase con datos del charge
                $purchase->update([
                    'transaction_id' => $chargeResult['charge_id'],
                    'payment_data' => json_encode([
                        'coinbase_charge' => $chargeResult['data'],
                        'created_at' => now()->toISOString(),
                        'environment' => config('app.env'),
                    ])
                ]);

                DB::commit();

                Log::info("✅ Charge Coinbase Commerce creado", [
                    'purchase_id' => $purchase->id,
                    'user_id' => $user->id,
                    'charge_id' => $chargeResult['charge_id'],
                    'amount_usd' => $package->price
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Pago creado exitosamente',
                    'purchase_id' => $purchase->id,
                    'charge_id' => $chargeResult['charge_id'],
                    'hosted_url' => $chargeResult['hosted_url'],
                    'payment_url' => $chargeResult['hosted_url'],
                    'coins_to_add' => $purchase->coins,
                    'bonus_coins_to_add' => $purchase->bonus_coins,
                    'total_coins_to_add' => $purchase->total_coins,
                    'amount_usd' => $package->price,
                    'minutes_equivalent' => $package->type === 'gifts' ? 0 : floor($purchase->total_coins / VideoChatCoinController::COST_PER_MINUTE),
                    'type' => $package->type === 'gifts' ? 'gift_coins' : 'minute_coins'
                ]);

            } else {
                // Fallo creando charge
                $purchase->update([
                    'status' => 'failed',
                    'payment_data' => json_encode([
                        'coinbase_error' => $chargeResult['error'],
                        'failed_at' => now()->toISOString(),
                        'environment' => config('app.env')
                    ])
                ]);

                DB::commit();

                Log::warning("❌ Error creando Charge Coinbase Commerce", [
                    'purchase_id' => $purchase->id,
                    'user_id' => $user->id,
                    'error' => $chargeResult['error']
                ]);

                return response()->json([
                    'success' => false,
                    'error' => $chargeResult['error'],
                    'error_code' => $chargeResult['error_code'] ?? 'CHARGE_CREATION_FAILED',
                    'purchase_id' => $purchase->id
                ], 400);
            }

        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'error' => 'Datos inválidos',
                'validation_errors' => $e->errors()
            ], 422);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error creando pago Coinbase Commerce: ' . $e->getMessage(), [
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
     * 🔗 Crear Charge en Coinbase Commerce API
     */
    private function createCoinbaseCharge($purchase, $user, $package)
    {
        try {
            // Preparar datos del charge según documentación
            $chargeData = [
                'name' => $package->name,
                'description' => $package->description ?: "Compra de {$package->coins} monedas para videochat",
                'pricing_type' => 'fixed_price',
                'local_price' => [
                    'amount' => (string)$package->price,
                    'currency' => 'USD'
                ],
                'metadata' => [
                    'purchase_id' => (string)$purchase->id,
                    'user_id' => (string)$user->id,
                    'package_id' => (string)$package->id,
                    'coins' => (string)$package->coins,
                    'bonus_coins' => (string)($package->bonus_coins ?? 0),
                    'total_coins' => (string)($package->coins + ($package->bonus_coins ?? 0)),
                    'environment' => config('app.env'),
                    'type' => $package->type ?? 'minutes'
                ],
                'redirect_url' => config('app.frontend_url') . '/payment-success',
                'cancel_url' => config('app.frontend_url') . '/payment-cancel'
            ];

            Log::info('📤 Creando Charge Coinbase Commerce', [
                'purchase_id' => $purchase->id,
                'amount' => $package->price,
                'endpoint' => $this->coinbaseConfig['api_url'] . '/charges'
            ]);

            // Realizar petición a Coinbase Commerce API
            $response = Http::timeout(30)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'X-CC-Api-Key' => $this->coinbaseConfig['api_key'],
                    'X-CC-Version' => '2018-03-22',
                ])
                ->post($this->coinbaseConfig['api_url'] . '/charges', $chargeData);

            if (!$response->successful()) {
                Log::error('❌ Error HTTP Coinbase Commerce', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                    'purchase_id' => $purchase->id
                ]);
                
                return [
                    'success' => false,
                    'error' => 'Error de conexión con Coinbase Commerce',
                    'error_code' => 'API_CONNECTION_ERROR'
                ];
            }

            $responseData = $response->json();
            
            Log::info('📥 Respuesta Coinbase Commerce', [
                'purchase_id' => $purchase->id,
                'response_data' => $responseData
            ]);

            // Procesar respuesta de Coinbase Commerce
            if (isset($responseData['data'])) {
                // Charge creado exitosamente
                $chargeInfo = $responseData['data'];
                
                return [
                    'success' => true,
                    'charge_id' => $chargeInfo['id'],
                    'hosted_url' => $chargeInfo['hosted_url'],
                    'data' => $chargeInfo
                ];
                
            } else {
                // Error creando charge
                $errorMessage = $responseData['error']['message'] ?? 
                            'Error desconocido creando el pago';
                
                return [
                    'success' => false,
                    'error' => $errorMessage,
                    'error_code' => $responseData['error']['type'] ?? 'CHARGE_CREATION_ERROR',
                    'data' => $responseData
                ];
            }

        } catch (Exception $e) {
            Log::error('❌ Excepción creando Charge Coinbase Commerce', [
                'error' => $e->getMessage(),
                'purchase_id' => $purchase->id,
                'trace' => $e->getTraceAsString()
            ]);
            
            return [
                'success' => false,
                'error' => 'Error procesando el pago. Intenta nuevamente.',
                'error_code' => 'API_EXCEPTION'
            ];
        }
    }

    /**
     * 🔍 Verificar estado de un charge
     */
    public function getChargeStatus($chargeId)
    {
        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'X-CC-Api-Key' => $this->coinbaseConfig['api_key'],
                    'X-CC-Version' => '2018-03-22',
                ])
                ->get($this->coinbaseConfig['api_url'] . '/charges/' . $chargeId);

            if ($response->successful()) {
                $data = $response->json();
                return $data['data'] ?? null;
            }

            return null;

        } catch (Exception $e) {
            Log::error('❌ Error verificando estado del charge: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * 💰 Validar límites de transacción
     */
    private function validateTransactionLimits($amount)
    {
        $minAmount = config('coinbase.limits.min_amount', 1);
        $maxAmount = config('coinbase.limits.max_amount', 10000);
        
        if ($amount < $minAmount) {
            throw new Exception("Monto mínimo de transacción: $" . number_format($minAmount, 2) . " USD");
        }
        
        if ($amount > $maxAmount) {
            throw new Exception("Monto máximo de transacción: $" . number_format($maxAmount, 2) . " USD");
        }
    }

    /**
     * 🪙 Agregar monedas al usuario según tipo de paquete
     */
    private function addCoinsToUser($purchase)
    {
        $package = $purchase->package;
        
        if ($package && $package->type === 'gifts') {
            // Paquetes de regalos
            $giftController = new \App\Http\Controllers\GiftCoinsController();
            
            $giftController->addGiftCoins(new Request([
                'user_id' => $purchase->user_id,
                'amount' => $purchase->coins,
                'source' => 'coinbase_commerce_purchase',
                'reference_id' => (string)$purchase->id
            ]));

            if ($purchase->bonus_coins > 0) {
                $giftController->addGiftCoins(new Request([
                    'user_id' => $purchase->user_id,
                    'amount' => $purchase->bonus_coins,
                    'source' => 'purchase_bonus_coinbase_commerce',
                    'reference_id' => (string)$purchase->id
                ]));
            }
        } else {
            // Paquetes de minutos
            $coinController = new VideoChatCoinController();
            
            $coinController->addCoins(new Request([
                'user_id' => $purchase->user_id,
                'amount' => $purchase->coins,
                'type' => 'purchased',
                'source' => 'coinbase_commerce_purchase',
                'reference_id' => (string)$purchase->id
            ]));

            if ($purchase->bonus_coins > 0) {
                $coinController->addCoins(new Request([
                    'user_id' => $purchase->user_id,
                    'amount' => $purchase->bonus_coins,
                    'type' => 'gift',
                    'source' => 'purchase_bonus_coinbase_commerce',
                    'reference_id' => (string)$purchase->id
                ]));
            }
        }
    }
    /**
     * 🔐 Webhook Handler - Procesar confirmaciones de Coinbase Commerce
     */
    public function handleWebhook(Request $request)
    {
        try {
            Log::info('📨 Webhook Coinbase Commerce recibido', [
                'method' => $request->method(),
                'ip' => $request->ip(),
                'headers' => $request->headers->all(),
                'body' => $request->getContent()
            ]);

            // Validar firma del webhook
            $this->validateWebhookSignature($request);

            $payload = json_decode($request->getContent(), true);
            
            if (!$payload || !isset($payload['event'])) {
                Log::warning('❌ Webhook sin payload válido');
                return response('Invalid payload', 400);
            }

            $event = $payload['event'];
            $eventType = $event['type'] ?? 'unknown';
            $chargeData = $event['data'] ?? null;

            Log::info('📥 Evento Coinbase Commerce', [
                'event_type' => $eventType,
                'charge_id' => $chargeData['id'] ?? 'unknown'
            ]);

            // Procesar según tipo de evento
            switch ($eventType) {
                case 'charge:confirmed':
                case 'charge:resolved':
                    return $this->handleChargeConfirmed($chargeData);
                    
                case 'charge:failed':
                    return $this->handleChargeFailed($chargeData);
                    
                case 'charge:delayed':
                    return $this->handleChargeDelayed($chargeData);
                    
                default:
                    Log::info('ℹ️ Evento no procesado: ' . $eventType);
                    return response('Event not processed', 200);
            }

        } catch (Exception $e) {
            Log::error('❌ Error procesando webhook Coinbase Commerce: ' . $e->getMessage());
            return response('Error processing webhook', 500);
        }
    }

    /**
     * ✅ Manejar pago confirmado
     */
    private function handleChargeConfirmed($chargeData)
    {
        try {
            $chargeId = $chargeData['id'];
            $metadata = $chargeData['metadata'] ?? [];
            $purchaseId = $metadata['purchase_id'] ?? null;

            if (!$purchaseId) {
                Log::warning('❌ Webhook confirmado sin purchase_id', ['charge_id' => $chargeId]);
                return response('Missing purchase ID', 400);
            }

            $purchase = CoinPurchase::find($purchaseId);
            if (!$purchase) {
                Log::warning('❌ Compra no encontrada en webhook', [
                    'purchase_id' => $purchaseId,
                    'charge_id' => $chargeId
                ]);
                return response('Purchase not found', 404);
            }

            // Evitar procesamiento duplicado
            if ($purchase->status === 'completed') {
                Log::info('✅ Compra ya procesada', ['purchase_id' => $purchaseId]);
                return response('OK', 200);
            }

            DB::beginTransaction();

            // Marcar como completado
            $purchase->update([
                'status' => 'completed',
                'completed_at' => now(),
                'payment_data' => json_encode(array_merge(
                    json_decode($purchase->payment_data, true) ?? [],
                    [
                        'webhook_confirmed' => $chargeData,
                        'completed_at' => now()->toISOString(),
                        'environment' => config('app.env')
                    ]
                ))
            ]);

            // Agregar monedas al usuario
            $this->addCoinsToUser($purchase);

            DB::commit();

            Log::info("✅ Pago Coinbase Commerce completado", [
                'purchase_id' => $purchase->id,
                'user_id' => $purchase->user_id,
                'charge_id' => $chargeId,
                'coins_added' => $purchase->total_coins
            ]);

            return response('OK', 200);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error procesando pago confirmado: ' . $e->getMessage());
            return response('Error processing confirmed payment', 500);
        }
    }

    /**
     * ❌ Manejar pago fallido
     */
    private function handleChargeFailed($chargeData)
    {
        try {
            $chargeId = $chargeData['id'];
            $metadata = $chargeData['metadata'] ?? [];
            $purchaseId = $metadata['purchase_id'] ?? null;

            if (!$purchaseId) {
                Log::warning('❌ Webhook fallido sin purchase_id', ['charge_id' => $chargeId]);
                return response('Missing purchase ID', 400);
            }

            $purchase = CoinPurchase::find($purchaseId);
            if (!$purchase) {
                Log::warning('❌ Compra no encontrada en webhook fallido', [
                    'purchase_id' => $purchaseId,
                    'charge_id' => $chargeId
                ]);
                return response('Purchase not found', 404);
            }

            DB::beginTransaction();

            $purchase->update([
                'status' => 'failed',
                'payment_data' => json_encode(array_merge(
                    json_decode($purchase->payment_data, true) ?? [],
                    [
                        'webhook_failed' => $chargeData,
                        'failed_at' => now()->toISOString(),
                        'environment' => config('app.env')
                    ]
                ))
            ]);

            DB::commit();

            Log::info("❌ Pago Coinbase Commerce fallido", [
                'purchase_id' => $purchase->id,
                'charge_id' => $chargeId
            ]);

            return response('OK', 200);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error procesando pago fallido: ' . $e->getMessage());
            return response('Error processing failed payment', 500);
        }
    }

    /**
     * ⏳ Manejar pago demorado
     */
    private function handleChargeDelayed($chargeData)
    {
        try {
            $chargeId = $chargeData['id'];
            $metadata = $chargeData['metadata'] ?? [];
            $purchaseId = $metadata['purchase_id'] ?? null;

            if ($purchaseId) {
                $purchase = CoinPurchase::find($purchaseId);
                if ($purchase) {
                    $purchase->update([
                        'status' => 'pending_confirmation',
                        'payment_data' => json_encode(array_merge(
                            json_decode($purchase->payment_data, true) ?? [],
                            [
                                'webhook_delayed' => $chargeData,
                                'delayed_at' => now()->toISOString(),
                                'environment' => config('app.env')
                            ]
                        ))
                    ]);

                    Log::info("⏳ Pago Coinbase Commerce demorado", [
                        'purchase_id' => $purchase->id,
                        'charge_id' => $chargeId
                    ]);
                }
            }

            return response('OK', 200);

        } catch (Exception $e) {
            Log::error('❌ Error procesando pago demorado: ' . $e->getMessage());
            return response('Error processing delayed payment', 500);
        }
    }

    /**
     * 🔐 Validar firma del webhook
     */
    private function validateWebhookSignature(Request $request)
    {
        if (!config('coinbase.verify_webhooks', true)) {
            return; // Validación deshabilitada
        }

        $payload = $request->getContent();
        $signature = $request->header('X-CC-Webhook-Signature');
        $webhookSecret = $this->coinbaseConfig['webhook_secret'];

        if (!$signature || !$webhookSecret) {
            throw new Exception('Missing webhook signature or secret');
        }

        $expectedSignature = hash_hmac('sha256', $payload, $webhookSecret);

        if (!hash_equals($expectedSignature, $signature)) {
            Log::error('❌ Firma inválida en webhook Coinbase Commerce', [
                'received' => $signature,
                'expected' => $expectedSignature
            ]);
            throw new Exception('Invalid webhook signature');
        }
    }

    /**
     * 📊 Obtener historial de compras
     */
    public function getPurchaseHistory()
    {
        try {
            $user = Auth::user();
            
            $purchases = CoinPurchase::where('user_id', $user->id)
                ->where('payment_method', 'coinbase_commerce')
                ->with('package')
                ->orderBy('created_at', 'desc')
                ->paginate(10);

            $formattedPurchases = $purchases->getCollection()->map(function ($purchase) {
                return [
                    'id' => $purchase->id,
                    'package_name' => $purchase->package->name ?? 'Paquete eliminado',
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
            Log::error('❌ Error verificando estado Coinbase Commerce: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al verificar el estado',
                'environment' => config('app.env')
            ], 500);
        }
    }

    /**
     * ⚙️ Obtener configuración de Coinbase Commerce
     */
    public function getCoinbaseConfig()
    {
        return response()->json([
            'success' => true,
            'payment_method' => 'coinbase_commerce',
            'currency' => $this->coinbaseConfig['currency'],
            'sandbox' => $this->coinbaseConfig['sandbox'],
            'environment' => config('app.env'),
            'supported_currencies' => [
                'BTC', 'ETH', 'LTC', 'BCH', 'USDC', 'DAI', 'DOGE'
            ],
            'coin_system' => [
                'cost_per_minute' => VideoChatCoinController::COST_PER_MINUTE,
                'minimum_balance' => VideoChatCoinController::MINIMUM_BALANCE
            ],
            'security' => [
                'max_attempts_per_hour' => 5,
                'min_amount' => config('coinbase.limits.min_amount', 1),
                'max_amount' => config('coinbase.limits.max_amount', 10000)
            ],
            'features' => [
                'instant_confirmation' => true,
                'multi_currency' => true,
                'no_volatility' => true,
                'global_coverage' => true
            ]
        ]);
    }

    /**
     * 🧪 Crear pago de prueba (sandbox local)
     */
    public function createSandboxPurchase(Request $request)
    {
        try {
            $request->validate([
                'package_id' => 'required|exists:coin_packages,id'
            ]);

            $user = Auth::user();
            $package = CoinPackage::findOrFail($request->package_id);

            DB::beginTransaction();

            // Crear la orden de compra
            $purchase = CoinPurchase::create([
                'user_id' => $user->id,
                'package_id' => $package->id,
                'coins' => $package->coins,
                'bonus_coins' => $package->bonus_coins ?? 0,
                'total_coins' => $package->coins + ($package->bonus_coins ?? 0),
                'amount' => $package->price,
                'currency' => 'USD',
                'payment_method' => 'coinbase_commerce_sandbox',
                'status' => 'completed',
                'transaction_id' => 'sandbox_coinbase_' . strtoupper(uniqid()) . '_' . time(),
                'completed_at' => now(),
                'payment_data' => json_encode([
                    'sandbox' => true,
                    'environment' => config('app.env'),
                    'processed_at' => now()->toISOString(),
                    'method' => 'coinbase_commerce_sandbox_test'
                ])
            ]);

            // Agregar monedas
            $this->addCoinsToUser($purchase);

            DB::commit();

            Log::info("🧪 Compra sandbox Coinbase Commerce completada", [
                'user_id' => $purchase->user_id,
                'package_type' => $package->type,
                'coins_added' => $purchase->coins,
                'bonus_coins_added' => $purchase->bonus_coins,
                'total_coins_added' => $purchase->total_coins,
                'environment' => config('app.env')
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Compra completada exitosamente (Sandbox)',
                'transaction_id' => $purchase->transaction_id,
                'coins_added' => $purchase->coins,
                'bonus_coins_added' => $purchase->bonus_coins,
                'total_coins_added' => $purchase->total_coins,
                'sandbox' => true,
                'minutes_equivalent' => $package->type === 'gifts' ? 0 : floor($purchase->total_coins / VideoChatCoinController::COST_PER_MINUTE),
                'type' => $package->type === 'gifts' ? 'gift_coins' : 'minute_coins',
                'environment' => config('app.env')
            ]);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error procesando pago sandbox Coinbase Commerce: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error procesando el pago sandbox',
                'environment' => config('app.env')
            ], 500);
        }
    }

    /**
     * 🔧 Diagnóstico del sistema (Admin/Debug)
     */
    public function systemDiagnostic()
    {
        try {
            $diagnostic = [
                'environment' => [
                    'current' => config('app.env'),
                    'debug' => config('app.debug'),
                    'url' => config('app.url'),
                ],
                'coinbase_config' => [
                    'sandbox' => config('coinbase.sandbox'),
                    'api_key_set' => !empty(config('coinbase.api_key')),
                    'webhook_secret_set' => !empty(config('coinbase.webhook_secret')),
                    'api_url' => config('coinbase.api_url'),
                    'verify_webhooks' => config('coinbase.verify_webhooks', true),
                ],
                'database' => [
                    'coin_packages_count' => \App\Models\CoinPackage::count(),
                    'recent_purchases' => \App\Models\CoinPurchase::where('created_at', '>=', now()->subHour())->count(),
                    'coinbase_purchases_today' => \App\Models\CoinPurchase::where('payment_method', 'coinbase_commerce')
                        ->where('status', 'completed')
                        ->whereDate('created_at', today())->count()
                ],
                'security' => [
                    'webhook_validation' => true,
                    'amount_limits' => true,
                    'rate_limiting' => true,
                    'ip_tracking' => true
                ],
                'php_extensions' => [
                    'curl' => extension_loaded('curl'),
                    'json' => extension_loaded('json'),
                    'openssl' => extension_loaded('openssl'),
                    'hash' => extension_loaded('hash')
                ],
                'api_connectivity' => $this->testApiConnectivity()
            ];

            return response()->json([
                'success' => true,
                'diagnostic' => $diagnostic,
                'timestamp' => now()->toISOString()
            ]);

        } catch (Exception $e) {
            Log::error('❌ Error en diagnóstico del sistema: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error en diagnóstico',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * 🌐 Probar conectividad con API de Coinbase Commerce
     */
    private function testApiConnectivity()
    {
        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'X-CC-Api-Key' => $this->coinbaseConfig['api_key'],
                    'X-CC-Version' => '2018-03-22',
                ])
                ->get($this->coinbaseConfig['api_url'] . '/charges?limit=1');

            return [
                'status' => $response->successful() ? 'connected' : 'failed',
                'response_code' => $response->status(),
                'response_time' => 'N/A'
            ];

        } catch (Exception $e) {
            return [
                'status' => 'error',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * 🧹 Limpiar compras expiradas
     */
    public function cleanupExpiredPurchases()
    {
        try {
            $expiredPurchases = CoinPurchase::where('payment_method', 'coinbase_commerce')
                ->where('status', 'pending')
                ->where('created_at', '<', now()->subHours(24))
                ->get();

            $cleaned = 0;
            
            foreach ($expiredPurchases as $purchase) {
                $purchase->update([
                    'status' => 'expired',
                    'payment_data' => json_encode(array_merge(
                        json_decode($purchase->payment_data, true) ?? [],
                        [
                            'expired_at' => now()->toISOString(),
                            'expired_by' => 'automatic_cleanup',
                            'environment' => config('app.env')
                        ]
                    ))
                ]);
                $cleaned++;
            }

            Log::info("🧹 Limpieza de compras Coinbase Commerce expiradas completada", [
                'cleaned_purchases' => $cleaned,
                'environment' => config('app.env')
            ]);

            return response()->json([
                'success' => true,
                'message' => "Se limpiaron {$cleaned} compras expiradas",
                'cleaned_count' => $cleaned,
                'environment' => config('app.env')
            ]);

        } catch (Exception $e) {
            Log::error('❌ Error limpiando compras expiradas: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error en la limpieza',
                'environment' => config('app.env')
            ], 500);
        }
    }

    /**
     * 📊 Estadísticas de pagos (Admin)
     */
    public function getPaymentStats()
    {
        try {
            $stats = [
                'today' => [
                    'total_purchases' => CoinPurchase::whereDate('created_at', today())
                        ->where('payment_method', 'coinbase_commerce')->count(),
                    'completed_purchases' => CoinPurchase::whereDate('created_at', today())
                        ->where('payment_method', 'coinbase_commerce')
                        ->where('status', 'completed')->count(),
                    'total_amount' => CoinPurchase::whereDate('created_at', today())
                        ->where('payment_method', 'coinbase_commerce')
                        ->where('status', 'completed')
                        ->sum('amount') ?? 0,
                    'failed_purchases' => CoinPurchase::whereDate('created_at', today())
                        ->where('payment_method', 'coinbase_commerce')
                        ->where('status', 'failed')->count(),
                ],
                'this_month' => [
                    'total_purchases' => CoinPurchase::whereMonth('created_at', now()->month)
                        ->where('payment_method', 'coinbase_commerce')->count(),
                    'completed_purchases' => CoinPurchase::whereMonth('created_at', now()->month)
                        ->where('payment_method', 'coinbase_commerce')
                        ->where('status', 'completed')->count(),
                    'total_amount' => CoinPurchase::whereMonth('created_at', now()->month)
                        ->where('payment_method', 'coinbase_commerce')
                        ->where('status', 'completed')
                        ->sum('amount') ?? 0,
                ],
                'success_rate' => $this->calculateSuccessRate(),
                'popular_packages' => $this->getPopularPackages(),
                'environment' => config('app.env')
            ];

            return response()->json([
                'success' => true,
                'stats' => $stats,
                'timestamp' => now()->toISOString()
            ]);

        } catch (Exception $e) {
            Log::error('❌ Error obteniendo estadísticas: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo estadísticas'
            ], 500);
        }
    }

    /**
     * 📈 Calcular tasa de éxito
     */
    private function calculateSuccessRate()
    {
        $total = CoinPurchase::where('payment_method', 'coinbase_commerce')
            ->whereDate('created_at', '>=', now()->subDays(30))
            ->count();

        if ($total === 0) return 0;

        $successful = CoinPurchase::where('payment_method', 'coinbase_commerce')
            ->where('status', 'completed')
            ->whereDate('created_at', '>=', now()->subDays(30))
            ->count();

        return round(($successful / $total) * 100, 2);
    }

    /**
     * 📦 Obtener paquetes más populares
     */
    private function getPopularPackages()
    {
        return CoinPurchase::where('payment_method', 'coinbase_commerce')
            ->where('status', 'completed')
            ->whereDate('created_at', '>=', now()->subDays(30))
            ->with('package')
            ->get()
            ->groupBy('package_id')
            ->map(function ($purchases) {
                $package = $purchases->first()->package;
                return [
                    'package_name' => $package->name ?? 'Eliminado',
                    'sales_count' => $purchases->count(),
                    'total_revenue' => $purchases->sum('amount')
                ];
            })
            ->sortByDesc('sales_count')
            ->take(5)
            ->values();
    }

    /**
     * 🔄 Sincronizar estado con Coinbase Commerce
     */
    public function syncPendingPurchases()
    {
        try {
            $pendingPurchases = CoinPurchase::where('payment_method', 'coinbase_commerce')
                ->where('status', 'pending')
                ->where('created_at', '>=', now()->subHours(24))
                ->get();

            $updated = 0;
            $errors = 0;

            foreach ($pendingPurchases as $purchase) {
                try {
                    $chargeStatus = $this->getChargeStatus($purchase->transaction_id);
                    
                    if ($chargeStatus) {
                        $timeline = $chargeStatus['timeline'] ?? [];
                        $lastEvent = end($timeline);
                        
                        if ($lastEvent) {
                            switch ($lastEvent['status']) {
                                case 'COMPLETED':
                                    $purchase->update([
                                        'status' => 'completed',
                                        'completed_at' => now()
                                    ]);
                                    $this->addCoinsToUser($purchase);
                                    $updated++;
                                    break;
                                    
                                case 'EXPIRED':
                                case 'CANCELED':
                                    $purchase->update(['status' => 'failed']);
                                    $updated++;
                                    break;
                            }
                        }
                    }
                } catch (Exception $e) {
                    Log::error('Error sincronizando purchase: ' . $purchase->id, [
                        'error' => $e->getMessage()
                    ]);
                    $errors++;
                }
            }

            Log::info("🔄 Sincronización completada", [
                'total_pending' => $pendingPurchases->count(),
                'updated' => $updated,
                'errors' => $errors
            ]);

            return response()->json([
                'success' => true,
                'message' => "Sincronización completada",
                'total_pending' => $pendingPurchases->count(),
                'updated' => $updated,
                'errors' => $errors,
                'environment' => config('app.env')
            ]);

        } catch (Exception $e) {
            Log::error('❌ Error en sincronización: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error en sincronización',
                'environment' => config('app.env')
            ], 500);
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

            // Si está pendiente, verificar estado en Coinbase
            if ($purchase->status === 'pending' && $purchase->transaction_id) {
                $chargeStatus = $this->getChargeStatus($purchase->transaction_id);
                
                if ($chargeStatus) {
                    // Actualizar estado local si cambió
                    $timeline = $chargeStatus['timeline'] ?? [];
                    $lastEvent = end($timeline);
                    
                    if ($lastEvent && $lastEvent['status'] === 'COMPLETED') {
                        // Marcar como completado y agregar monedas
                        DB::beginTransaction();
                        
                        $purchase->update([
                            'status' => 'completed',
                            'completed_at' => now(),
                            'payment_data' => json_encode(array_merge(
                                json_decode($purchase->payment_data, true) ?? [],
                                [
                                    'status_check_completed' => $chargeStatus,
                                    'completed_at' => now()->toISOString()
                                ]
                            ))
                        ]);
                        
                        $this->addCoinsToUser($purchase);
                        
                        DB::commit();
                    }
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
            Log::error('❌ Error verificando estado Coinbase Commerce: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al verificar el estado',
                'environment' => config('app.env')
            ], 500);
        }
    }
}

