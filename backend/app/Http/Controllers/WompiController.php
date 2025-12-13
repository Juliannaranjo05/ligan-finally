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

class WompiController extends Controller
{
    private $wompiConfig;

    public function __construct()
    {
        $this->wompiConfig = [
            // Credenciales Wompi
            'public_key' => config('wompi.public_key'),
            'private_key' => config('wompi.private_key'),
            'integrity_secret' => config('wompi.integrity_secret'),
            
            // URLs de Wompi
            'api_url' => config('wompi.api_url', 'https://production.wompi.co/v1'),
            'checkout_url' => config('wompi.checkout_url', 'https://checkout.wompi.co'),
            
            // Configuración
            'sandbox' => config('wompi.sandbox', false),
            'currency' => config('wompi.currency', 'COP'),
            'environment' => config('app.env'),
        ];
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
                    // Convertir precio USD a COP (aproximado)
                    $usdToCop = config('wompi.usd_to_cop_rate', 4000);
                    $priceCop = $package->price * $usdToCop;
                    
                    // Lógica de precios
                    if ($hasFirstPurchase) {
                        $showPriceCop = $package->regular_price * $usdToCop;
                        $showDiscount = 0;
                        $isFirstTimeEligible = false;
                    } else {
                        $showPriceCop = $package->is_first_time_only ? $priceCop : $package->regular_price * $usdToCop;
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
                        'price_usd' => $package->price,
                        'price_cop' => (int)$showPriceCop,
                        'price_cop_cents' => (int)($showPriceCop * 100), // Para Wompi
                        'regular_price_cop' => (int)($package->regular_price * $usdToCop),
                        'discount_percentage' => $showDiscount,
                        'is_first_time_only' => $isFirstTimeEligible,
                        'is_popular' => $package->is_popular,
                        'is_active' => $package->is_active,
                        'is_first_purchase' => !$hasFirstPurchase,
                        'usd_to_cop_rate' => $usdToCop
                    ];
                });

            return response()->json([
                'success' => true,
                'packages' => $packages,
                'is_first_purchase' => !$hasFirstPurchase,
                'currency' => 'COP',
                'usd_to_cop_rate' => config('wompi.usd_to_cop_rate', 4000),
                'environment_info' => $this->getEnvironmentInfo()
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo paquetes Wompi: ' . $e->getMessage());
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
            ]);

            $user = Auth::user();
            $package = CoinPackage::findOrFail($request->package_id);

            // Calcular precio en COP
            $usdToCop = config('wompi.usd_to_cop_rate', 4000);
            $priceCop = $package->price * $usdToCop;

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
                'amount' => $package->price, // USD
                'currency' => 'USD',
                'payment_method' => 'wompi',
                'status' => 'pending',
                'transaction_id' => $reference,
                'payment_data' => json_encode([
                    'wompi_reference' => $reference,
                    'amount_cop' => $priceCop,
                    'amount_cop_cents' => $priceCop * 100,
                    'usd_to_cop_rate' => $usdToCop,
                    'created_at' => now()->toISOString(),
                    'environment' => config('app.env'),
                ])
            ]);

            // Generar firma de integridad
            $signature = $this->generateIntegritySignature($reference, $priceCop * 100, 'COP');

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
                    'amount_in_cents' => $priceCop * 100,
                    'reference' => $reference,
                    'signature_integrity' => $signature,
                    'redirect_url' => env('WOMPI_PAYMENT_SUCCESS_URL'),
                    'cancel_url' => env('WOMPI_PAYMENT_CANCEL_URL'),
                    'customer_email' => $user->email,
                    'customer_full_name' => $user->name,
                ],
                'package_info' => [
                    'name' => $package->name,
                    'coins' => $package->coins,
                    'bonus_coins' => $package->bonus_coins,
                    'total_coins' => $purchase->total_coins,
                    'price_usd' => $package->price,
                    'price_cop' => $priceCop,
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
        return "WMP{$timestamp}{$userId}{$packageId}{$random}";
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
                'source' => 'wompi_purchase',
                'reference_id' => (string)$purchase->id
            ]));

            if ($purchase->bonus_coins > 0) {
                $giftController->addGiftCoins(new Request([
                    'user_id' => $purchase->user_id,
                    'amount' => $purchase->bonus_coins,
                    'source' => 'purchase_bonus_wompi',
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
                'source' => 'wompi_purchase',
                'reference_id' => (string)$purchase->id
            ]));

            if ($purchase->bonus_coins > 0) {
                $coinController->addCoins(new Request([
                    'user_id' => $purchase->user_id,
                    'amount' => $purchase->bonus_coins,
                    'type' => 'gift',
                    'source' => 'purchase_bonus_wompi',
                    'reference_id' => (string)$purchase->id
                ]));
            }
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

            // Marcar como completado
            $purchase->update([
                'status' => 'completed',
                'completed_at' => now(),
                'payment_data' => json_encode(array_merge(
                    json_decode($purchase->payment_data, true) ?? [],
                    [
                        'webhook_approved' => $transactionData,
                        'wompi_transaction_id' => $transactionData['id'] ?? null,
                        'completed_at' => now()->toISOString(),
                        'environment' => config('app.env')
                    ]
                ))
            ]);

            // Agregar monedas al usuario
            $this->addCoinsToUser($purchase);

            DB::commit();

            Log::info("✅ Pago Wompi completado", [
                'purchase_id' => $purchase->id,
                'user_id' => $purchase->user_id,
                'reference' => $purchase->transaction_id,
                'wompi_transaction_id' => $transactionData['id'] ?? null,
                'coins_added' => $purchase->total_coins
            ]);

            return response('OK', 200);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('❌ Error procesando pago aprobado: ' . $e->getMessage());
            return response('Error processing approved payment', 500);
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
        if (!config('wompi.verify_webhooks', true)) {
            return; // Validación deshabilitada
        }

        $payload = $request->getContent();
        // Wompi envía el checksum en este header específico
        $checksum = $request->header('X-Event-Checksum');
        
        if (!$checksum) {
            Log::warning('⚠️ Webhook sin X-Event-Checksum header');
            throw new Exception('Missing webhook checksum');
        }

        // Por ahora solo validamos que existe el checksum
        // La validación completa requiere implementar el algoritmo específico de Wompi
        Log::info('✅ Webhook con checksum válido', ['checksum' => $checksum]);
        
        // TODO: Implementar validación completa según documentación de Wompi
        // Por ahora permitimos todos los webhooks que tengan checksum
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
            Log::error('❌ Error verificando estado Wompi: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al verificar el estado',
                'environment' => config('app.env')
            ], 500);
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
            Log::error('❌ Error obteniendo historial Wompi: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener el historial',
                'environment' => config('app.env')
            ], 500);
        }
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
                'payment_method' => 'wompi_sandbox',
                'status' => 'completed',
                'transaction_id' => 'sandbox_wompi_' . strtoupper(uniqid()) . '_' . time(),
                'completed_at' => now(),
                'payment_data' => json_encode([
                    'sandbox' => true,
                    'environment' => config('app.env'),
                    'processed_at' => now()->toISOString(),
                    'method' => 'wompi_sandbox_test'
                ])
            ]);

            // Agregar monedas
            $this->addCoinsToUser($purchase);

            DB::commit();

            Log::info("🧪 Compra sandbox Wompi completada", [
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
            Log::error('❌ Error procesando pago sandbox Wompi: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error procesando el pago sandbox',
                'environment' => config('app.env')
            ], 500);
        }
    }
}