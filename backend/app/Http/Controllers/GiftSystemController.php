<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\UserGiftCoins;
use App\Models\GiftRequest;
use Exception;
use Carbon\Carbon;
use App\Models\ChatMessage; // En lugar de Message
use App\Services\PlatformSettingsService;

class GiftSystemController extends Controller
{
    /**
     * 🎁 Obtener todos los regalos disponibles
     */
    public function getAvailableGifts()
    {
        try {
            $gifts = Gift::where('is_active', true)
                ->orderBy('price', 'asc')
                ->get()
                ->map(function ($gift) {
                    // Construir URL de imagen completa
                    $imageUrl = null;
                    if ($gift->image_path) {
                        // Si ya es una URL completa, usarla directamente
                        if (preg_match('/^https?:\/\//', $gift->image_path)) {
                            $imageUrl = $gift->image_path;
                        } else {
                            // Limpiar la ruta
                            $cleanPath = str_replace('\\', '/', trim($gift->image_path, '/'));
                            // Si no empieza con storage/, agregarlo
                            if (!str_starts_with($cleanPath, 'storage/')) {
                                $cleanPath = 'storage/gifts/' . basename($cleanPath);
                            }
                            
                            // Codificar la URL correctamente (separar directorio y archivo)
                            $pathParts = explode('/', $cleanPath);
                            $fileName = array_pop($pathParts);
                            $directory = implode('/', $pathParts);
                            
                            // Codificar solo el nombre del archivo para preservar caracteres especiales
                            $encodedFileName = rawurlencode($fileName);
                            
                            // Construir URL base y añadir la ruta codificada
                            $baseUrl = rtrim(config('app.url'), '/');
                            $imageUrl = $baseUrl . '/' . $directory . '/' . $encodedFileName;
                        }
                    }
                    
                    return [
                        'id' => $gift->id,
                        'name' => $gift->name,
                        'image_path' => $imageUrl ?: 'https://via.placeholder.com/80x80/ff007a/ffffff?text=NO',
                        'price' => $gift->price,
                        'category' => $gift->category ?? 'basic'
                    ];
                });

            return response()->json([
                'success' => true,
                'gifts' => $gifts,
                'total_available' => $gifts->count()
            ])->header('Cache-Control', 'no-cache, no-store, must-revalidate')
              ->header('Pragma', 'no-cache')
              ->header('Expires', '0');

        } catch (Exception $e) {
            Log::error('Error obteniendo regalos disponibles: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener regalos disponibles'
            ], 500);
        }
    }

    /**
     * 🙏 MODELO pide regalo al cliente (Step 1)
     */
    /**
     * 🎁 SOLICITAR REGALO - MÉTODO COMPLETO CON SEGURIDAD
     */
    public function requestGift(Request $request)
    {
        try {
            DB::beginTransaction();
            
            $user = Auth::user();
            $clientId = $request->input('client_id');
            $giftId = $request->input('gift_id');
            
            // Validaciones básicas
            if (!$clientId || !$giftId) {
                return response()->json([
                    'success' => false,
                    'error' => 'missing_parameters',
                    'message' => 'Faltan parámetros requeridos'
                ], 400);
            }

            // Verificar que el regalo existe y está activo
            $gift = Gift::where('id', $giftId)
                ->where('is_active', true)
                ->first();
                
            if (!$gift) {
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_gift',
                    'message' => 'El regalo no existe o no está disponible'
                ], 400);
            }

            // Verificar que el cliente existe
            $client = User::where('id', $clientId)
                ->where('rol', 'cliente')
                ->first();
                
            if (!$client) {
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_client',
                    'message' => 'El cliente no es válido'
                ], 400);
            }

            // 🔐 GENERAR HASH DE SEGURIDAD AVANZADO
            $middleware = new \App\Http\Middleware\GiftSecurityMiddleware();
            $securityData = $middleware->generateAdvancedSecurityHash(
                $user->id,
                $clientId,
                $giftId,
                $gift->price
            );

            // Generar hash de integridad
            $integrityHash = hash('sha256', implode('|', [
                $user->id,
                $clientId,
                $giftId,
                $gift->price,
                now()->timestamp
            ]));

            // Verificar si ya existe una solicitud pendiente similar
            $existingRequest = GiftRequest::where('modelo_id', $user->id)
                ->where('client_id', $clientId)
                ->where('gift_id', $giftId)
                ->where('status', 'pending')
                ->where('created_at', '>=', now()->subSeconds(30))
                ->first();

            if ($existingRequest) {
                return response()->json([
                    'success' => false,
                    'error' => 'duplicate_request',
                    'message' => 'Ya existe una solicitud similar reciente'
                ], 409);
            }

            // Crear la solicitud de regalo con datos de seguridad
            $giftRequest = GiftRequest::create([
                'modelo_id' => $user->id,
                'client_id' => $clientId,
                'gift_id' => $giftId,
                'amount' => $gift->price,
                'status' => 'pending',
                'expires_at' => now()->addMinutes(15),
                'room_name' => $request->input('room_name', ''),  // ← AGREGAR ESTA LÍNEA
                'message' => $request->input('message', ''),      // ← AGREGAR ESTA LÍNEA
                'gift_data' => json_encode([
                    'security_hash' => $securityData['hash'],
                    'timestamp' => $securityData['timestamp'],
                    'nonce' => $securityData['nonce'],
                    'expires_at' => $securityData['expires_at'],
                    'session_id' => $securityData['session_id'],
                    'ip' => $securityData['ip'],
                    'integrity_hash' => $integrityHash,
                    'gift_name' => $gift->name,
                    'gift_image' => $gift->image_path,  // ← CAMBIAR image_url por image_path
                    'gift_price' => $gift->price,       // ← AGREGAR PRECIO
                    'modelo_name' => $user->name,
                    'client_name' => $client->name,
                    'original_message' => $request->input('message', '') // ← AGREGAR MENSAJE
                ])
            ]);
            // AGREGAR DESPUÉS DE $giftRequest = GiftRequest::create([...]);
            Log::info('💬 Creando mensaje de chat para solicitud de regalo');

            try {
                $chatMessageRecord = ChatMessage::create([
                    'room_name' => $request->input('room_name', "chat_user_{$user->id}_{$clientId}"),
                    'user_id' => $user->id,
                    'user_name' => $user->name,
                    'user_role' => $user->rol,
                    'message' => "Solicitud de regalo: {$gift->name}",
                    'type' => 'gift_request',
                    'extra_data' => json_encode([
                        'gift_name' => $gift->name,
                        'gift_image' => $gift->image_path,
                        'gift_price' => $gift->price,
                        'original_message' => $request->input('message', ''),
                        'request_id' => $giftRequest->id
                    ])
                ]);
            } catch (Exception $chatError) {
                Log::error('❌ Error creando mensaje de chat: ' . $chatError->getMessage());
            }
            $chatMessage = [
                'id' => $giftRequest->id,
                'user_id' => $user->id,
                'user_name' => $user->name,              // ← 🔥 AGREGAR
                'user_role' => $user->rol,               // ← 🔥 AGREGAR
                'message' => "Solicitud de regalo: {$gift->name}",
                'type' => 'gift_request',
                'created_at' => now()->toISOString(),
                'room_name' => $request->input('room_name', ''),
                'gift_data' => [
                    'gift_name' => $gift->name,
                    'gift_image' => $gift->image_path,
                    'gift_price' => $gift->price,
                    'original_message' => $request->input('message', '')
                ],
                'extra_data' => [
                    'gift_name' => $gift->name,
                    'gift_image' => $gift->image_path,
                    'gift_price' => $gift->price,
                    'original_message' => $request->input('message', '')
                ]
            ];
            // Log de la solicitud exitosa
            Log::info('Solicitud de regalo creada exitosamente', [
                'request_id' => $giftRequest->id,
                'modelo_id' => $user->id,
                'client_id' => $clientId,
                'gift_id' => $giftId,
                'amount' => $gift->price
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Solicitud de regalo enviada exitosamente',
                'chat_message' => $chatMessage, // ← AGREGAR ESTA LÍNEA
                'data' => [
                    'request_id' => $giftRequest->id,
                    'expires_at' => $giftRequest->expires_at->toISOString(),
                    'security_hash' => $securityData['hash'], // 🚨 IMPORTANTE: Para usar en aceptación
                    'gift' => [
                        'id' => $gift->id,
                        'name' => $gift->name,
                        'price' => $gift->price,
                        'image_url' => $gift->image_url
                    ],
                    'client' => [
                        'id' => $client->id,
                        'name' => $client->name
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Error en solicitud de regalo', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'modelo_id' => $user->id ?? null,
                'client_id' => $request->input('client_id'),
                'gift_id' => $request->input('gift_id')
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'request_failed',
                'message' => 'Error interno al procesar la solicitud'
            ], 500);
        }
    }

    public function getPendingRequests()
    {
        try {
            $client = Auth::user();

            Log::info("🔍 Cargando solicitudes pendientes para cliente {$client->id}");

            $requests = GiftRequest::where('client_id', $client->id)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->with(['modelo', 'gift'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($request) {
                    // 🔥 PARSEAR gift_data PARA OBTENER SECURITY HASH
                    $giftData = null;
                    $securityHash = null;
                    
                    if ($request->gift_data) {
                        try {
                            $giftData = json_decode($request->gift_data, true);
                            $securityHash = $giftData['security_hash'] ?? null;
                        } catch (\Exception $e) {
                            Log::warning("❌ Error parseando gift_data para request {$request->id}: {$e->getMessage()}");
                        }
                    }

                    // 🔥 GENERAR SECURITY HASH SI NO EXISTE
                    if (!$securityHash) {
                        Log::info("🔑 Generando security hash para request {$request->id}");
                        
                        $middleware = new \App\Http\Middleware\GiftSecurityMiddleware();
                        $securityData = $middleware->generateAdvancedSecurityHash(
                            $request->modelo_id,
                            $request->client_id,
                            $request->gift_id,
                            $request->amount
                        );
                        
                        $securityHash = $securityData['hash'];
                        
                        // 🔥 ACTUALIZAR gift_data CON EL HASH
                        $updatedGiftData = array_merge($giftData ?? [], $securityData);
                        
                        $request->update([
                            'gift_data' => json_encode($updatedGiftData)
                        ]);
                        
                        Log::info("✅ Security hash generado y guardado para request {$request->id}");
                    }

                    return [
                        'id' => $request->id,
                        'modelo_id' => $request->modelo_id,
                        'client_id' => $request->client_id,
                        'gift_id' => $request->gift_id,           // 🔥 CAMPO CRÍTICO
                        'amount' => (int) $request->amount,       // 🔥 CAMPO CRÍTICO
                        'message' => $request->message,
                        'room_name' => $request->room_name,
                        'status' => $request->status,
                        'expires_at' => $request->expires_at->toISOString(),
                        'created_at' => $request->created_at->toISOString(),
                        'updated_at' => $request->updated_at->toISOString(),
                        
                        // 🔥 DATOS CRÍTICOS PARA EL FRONTEND
                        'security_hash' => $securityHash,         // 🔥 CAMPO CRÍTICO
                        'gift_data' => $giftData,                // 🔥 CAMPO CRÍTICO
                        
                        // 🔥 RELACIONES COMPLETAS
                        'modelo' => [
                            'id' => $request->modelo->id,
                            'name' => $request->modelo->name,
                            'username' => $request->modelo->username ?? $request->modelo->name,
                            'avatar' => $request->modelo->avatar
                        ],
                        'gift' => [
                            'id' => $request->gift->id,
                            'name' => $request->gift->name,
                            'image' => $request->gift->image_path ? asset($request->gift->image_path) : null,
                            'price' => (int) $request->gift->price,
                            'category' => $request->gift->category ?? 'basic',
                            'is_active' => $request->gift->is_active
                        ],
                        
                        // 🔥 CAMPOS ADICIONALES PARA COMPATIBILIDAD
                        'requested_at' => $request->created_at->toISOString(),
                        'time_remaining' => now()->diffInSeconds($request->expires_at, false)
                    ];
                });

            Log::info("✅ {$requests->count()} solicitudes formateadas correctamente");

            return response()->json([
                'success' => true,
                'requests' => $requests,
                'total_pending' => $requests->count(),
                'total' => $requests->count(), // 🔥 AGREGAR PARA COMPATIBILIDAD
                'debug' => [
                    'user_id' => $client->id,
                    'timestamp' => now()->toISOString(),
                    'requests_with_hash' => $requests->filter(function($req) {
                        return !empty($req['security_hash']);
                    })->count()
                ]
            ]);

        } catch (Exception $e) {
            Log::error('❌ Error obteniendo solicitudes pendientes: ' . $e->getMessage(), [
                'user_id' => $client->id ?? null,
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener solicitudes',
                'message' => config('app.debug') ? $e->getMessage() : 'Error interno del servidor'
            ], 500);
        }
    }


    /**
     * ✅ ACEPTAR REGALO - MÉTODO COMPLETO CON VALIDACIÓN EXTREMA
     */
    public function acceptGiftRequest(Request $request, $requestId)
    {
        try {
            DB::beginTransaction();
            
            $user = Auth::user();
            $securityHash = $request->input('security_hash');
            
            Log::info("🎁 Cliente {$user->id} intentando aceptar regalo {$requestId}");
            Log::info("🔐 Security hash recibido: " . ($securityHash ? 'SÍ (' . substr($securityHash, 0, 16) . '...)' : 'NO'));

            // 1. Verificar que sea cliente
            if (!$user || $user->rol !== 'cliente') {
                Log::error("❌ Usuario no es cliente", ['user_id' => $user->id ?? null, 'role' => $user->rol ?? null]);
                return response()->json([
                    'success' => false,
                    'error' => 'Solo clientes pueden aceptar regalos'
                ], 403);
            }

            // 2. Buscar la solicitud de regalo
            $giftRequest = GiftRequest::where('id', $requestId)
                ->where('client_id', $user->id)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->with(['modelo', 'gift'])
                ->first();

            if (!$giftRequest) {
                Log::error("❌ Solicitud no encontrada", [
                    'request_id' => $requestId,
                    'client_id' => $user->id
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_request',
                    'message' => 'La solicitud no existe, ya fue procesada o ha expirado'
                ], 404);
            }

            Log::info("📋 Solicitud encontrada", [
                'request_id' => $requestId,
                'modelo_id' => $giftRequest->modelo_id,
                'gift_id' => $giftRequest->gift_id,
                'amount' => $giftRequest->amount
            ]);

            // 3. Verificar que la modelo y el regalo son válidos
            if (!$giftRequest->modelo || $giftRequest->modelo->rol !== 'modelo') {
                Log::critical('❌ FRAUDE: receptor no es modelo válida', [
                    'request_id' => $requestId,
                    'client_id' => $user->id,
                    'fake_modelo_id' => $giftRequest->modelo_id
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_modelo',
                    'message' => 'Error de validación'
                ], 400);
            }

            if (!$giftRequest->gift || !$giftRequest->gift->is_active) {
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_gift',
                    'message' => 'El regalo ya no está disponible'
                ], 400);
            }

            // 4. 🚨 VALIDAR HASH DE SEGURIDAD
            $giftData = null;
            $storedHash = null;
            
            if ($giftRequest->gift_data) {
                try {
                    $giftData = json_decode($giftRequest->gift_data, true);
                    $storedHash = $giftData['security_hash'] ?? null;
                } catch (\Exception $e) {
                    Log::error("❌ Error parseando gift_data", ['error' => $e->getMessage()]);
                }
            }

            // 🔥 SI NO HAY HASH ALMACENADO, GENERARLO
            if (!$storedHash) {
                Log::warning("⚠️ Security hash no encontrado en gift_data - generando...");
                
                $middleware = new \App\Http\Middleware\GiftSecurityMiddleware();
                $securityData = $middleware->generateAdvancedSecurityHash(
                    $giftRequest->modelo_id,
                    $giftRequest->client_id,
                    $giftRequest->gift_id,
                    $giftRequest->amount
                );
                
                $storedHash = $securityData['hash'];
                
                // Actualizar gift_data
                $updatedGiftData = array_merge($giftData ?? [], $securityData);
                $giftRequest->update([
                    'gift_data' => json_encode($updatedGiftData)
                ]);
                
                Log::info("✅ Security hash generado y almacenado");
            }

            // 🔥 COMPARAR HASHES
            if ($securityHash && $securityHash !== $storedHash) {
                Log::critical('❌ FRAUDE: Hash de seguridad no coincide', [
                    'request_id' => $requestId,
                    'client_id' => $user->id,
                    'provided' => substr($securityHash, 0, 16) . '...',
                    'stored' => substr($storedHash, 0, 16) . '...'
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'security_violation', 
                    'message' => 'Error de validación de seguridad'
                ], 403);
            }

            // 🔥 SI NO SE PROPORCIONA HASH, USAR EL ALMACENADO (PARA DEBUGGING)
            if (!$securityHash) {
                Log::warning("⚠️ No se proporcionó security_hash - usando hash almacenado para continuar");
                $securityHash = $storedHash;
            }

            // 5. 🔐 VERIFICAR Y BLOQUEAR SALDO (Prevenir doble gasto)
            $lockKey = "balance_lock_{$user->id}_{$requestId}";
            if (\Illuminate\Support\Facades\Cache::has($lockKey)) {
                return response()->json([
                    'success' => false,
                    'error' => 'already_processing',
                    'message' => 'Esta transacción ya se está procesando'
                ], 409);
            }

            // Crear lock temporal
            \Illuminate\Support\Facades\Cache::put($lockKey, true, 300); // 5 minutos

            // 6. Verificar saldo del cliente con bloqueo de fila
            $clientCoins = UserGiftCoins::lockForUpdate()
                ->where('user_id', $user->id)
                ->first();

            if (!$clientCoins) {
                $clientCoins = UserGiftCoins::create([
                    'user_id' => $user->id,
                    'balance' => 0,
                    'total_received' => 0,
                    'total_sent' => 0
                ]);
            }

            if ($clientCoins->balance < $giftRequest->amount) {
                \Illuminate\Support\Facades\Cache::forget($lockKey);
                
                Log::warning("❌ Saldo insuficiente", [
                    'client_id' => $user->id,
                    'balance' => $clientCoins->balance,
                    'required' => $giftRequest->amount
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'insufficient_balance',
                    'message' => 'Saldo insuficiente para este regalo',
                    'data' => [
                        'current_balance' => $clientCoins->balance,
                        'required_amount' => $giftRequest->amount,
                        'missing_amount' => $giftRequest->amount - $clientCoins->balance
                    ]
                ], 400);
            }

            // 7. 💰 PROCESAR TRANSACCIÓN
            Log::info("💰 Iniciando transacción", [
                'client_balance_before' => $clientCoins->balance,
                'amount' => $giftRequest->amount
            ]);
            
            // 1. Descontar del cliente
            $clientCoins->decrement('balance', $giftRequest->amount);
            $clientCoins->increment('total_sent', $giftRequest->amount);

            // 2. Obtener/crear monedas de la modelo
            $modeloCoins = UserGiftCoins::lockForUpdate()
                ->where('user_id', $giftRequest->modelo_id)
                ->first();

            if (!$modeloCoins) {
                $modeloCoins = UserGiftCoins::create([
                    'user_id' => $giftRequest->modelo_id,
                    'balance' => 0,
                    'total_received' => 0,
                    'total_sent' => 0
                ]);
            }

            // 3. Calcular comisión usando configuración dinámica
            $giftCommissionPercentage = PlatformSettingsService::getInteger('gift_commission_percentage', 40);
            $platformCommissionRate = $giftCommissionPercentage / 100;
            $modeloRate = 1 - $platformCommissionRate;
            
            $modeloAmount = $giftRequest->amount * $modeloRate;
            $platformCommission = $giftRequest->amount * $platformCommissionRate;

            // 4. Agregar monedas a la modelo
            $modeloCoins->increment('balance', $modeloAmount);
            $modeloCoins->increment('total_received', $modeloAmount);

            // 5. Actualizar estado de la solicitud
            $giftRequest->update([
                'status' => 'accepted',
                'accepted_at' => now(),
                'processed_at' => now(),
                'processed_amount' => $giftRequest->amount,
                'modelo_received' => $modeloAmount,
                'platform_commission' => $platformCommission
            ]);

                // 6. Registrar la transacción
            DB::table('gift_transactions')->insert([
                'gift_request_id' => $giftRequest->id,
                'client_id' => $user->id,
                'modelo_id' => $giftRequest->modelo_id,
                'sender_id' => $user->id,
                'receiver_id' => $giftRequest->modelo_id,
                'gift_id' => $giftRequest->gift_id,
                'amount' => $giftRequest->amount,
                'amount_total' => $giftRequest->amount,
                'amount_modelo' => $modeloAmount,
                'amount_commission' => $platformCommission,
                'type' => 'gift',
                'transaction_type' => 'gift_accepted',
                'status' => 'completed',
                'source' => 'gift_request_system',
                'message' => "Regalo: {$giftRequest->gift->name}",
                'reference_id' => "GR-{$giftRequest->id}",
                'room_name' => $giftRequest->room_name ?? ''
            ]);

            // Limpiar lock
            \Illuminate\Support\Facades\Cache::forget($lockKey);

            // Log de transacción exitosa
            Log::info('✅ Regalo aceptado y procesado exitosamente', [
                'request_id' => $requestId,
                'client_id' => $user->id,
                'modelo_id' => $giftRequest->modelo_id,
                'gift_id' => $giftRequest->gift_id,
                'amount' => $giftRequest->amount,
                'modelo_received' => $modeloAmount,
                'platform_commission' => $platformCommission,
                'client_new_balance' => $clientCoins->fresh()->balance
            ]);

                $duplicatesUpdated = GiftRequest::where('modelo_id', $giftRequest->modelo_id)
                    ->where('client_id', $user->id)
                    ->where('status', 'pending')
                    ->where('id', '!=', $requestId)
                    ->where('created_at', '>', now()->subMinutes(5)) // Solo duplicados recientes
                    ->update([
                        'status' => 'cancelled', 
                        'cancelled_reason' => 'duplicate_accepted'
                    ]);

                if ($duplicatesUpdated > 0) {
                    Log::info("🧹 {$duplicatesUpdated} solicitudes duplicadas canceladas");
                }

                Log::info('💬 INICIO: Creando mensajes específicos');

            // Verificar variables
            Log::info('🔍 Variables:', [
                'room_name' => $giftRequest->room_name ?? 'NULL',
                'gift_name' => $giftRequest->gift->name ?? 'NULL',
                'user_id' => $user->id ?? 'NULL',
                'user_name' => $user->name ?? 'NULL'
            ]);

            try {
                Log::info('🚀 Creando mensaje cliente...');
                
                $clientMessage = ChatMessage::create([
                'room_name' => ($giftRequest->room_name ?? 'chat_default') . '_client',
                'user_id' => $user->id,
                'user_name' => $user->name ?? 'Usuario',
                'user_role' => 'cliente',
                'message' => "Envió: " . ($giftRequest->gift->name ?? 'Regalo'),
                'type' => 'gift_sent',
                'extra_data' => json_encode([
                    'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                    'gift_image' => $giftRequest->gift->image_path ?? null, // ← 🔥 AGREGAR ESTA LÍNEA
                    'gift_price' => $giftRequest->amount ?? 0,
                    'client_name' => $user->name ?? 'Cliente',
                    'modelo_name' => $giftRequest->modelo->name ?? 'Modelo',
                    'transaction_id' => $giftRequest->id ?? 0
                    ])
                ]);
                    
                Log::info('✅ Cliente creado ID: ' . $clientMessage->id);

            } catch (Exception $e) {
                Log::error('❌ Error cliente: ' . $e->getMessage());
                Log::error('📍 Archivo: ' . $e->getFile() . ':' . $e->getLine());
            }

            try {
                Log::info('🚀 Creando mensaje modelo...');
                
                // 🔥 Priorizar imagen personalizada del cliente (avatar) sobre imagen del regalo estándar
                // Recargar el usuario para asegurar que tenemos el avatar más reciente
                $user->refresh();
                
                $giftImage = null;
                Log::info('🔍 Verificando avatar del cliente', [
                    'user_id' => $user->id,
                    'avatar' => $user->avatar,
                    'avatar_exists' => !empty($user->avatar),
                    'gift_image_path' => $giftRequest->gift->image_path ?? null
                ]);
                
                if ($user->avatar && !empty(trim($user->avatar))) {
                    // Si el cliente tiene avatar personalizado, usarlo
                    $giftImage = $user->avatar;
                    Log::info('✅ Usando avatar personalizado del cliente', ['avatar' => $giftImage]);
                } else {
                    // Si no, usar la imagen del regalo estándar
                    $giftImage = $giftRequest->gift->image_path ?? null;
                    Log::info('⚠️ Usando imagen del regalo estándar', ['gift_image' => $giftImage]);
                }
                
                $modeloMessage = ChatMessage::create([
                'room_name' => ($giftRequest->room_name ?? 'chat_default') . '_modelo',
                'user_id' => $user->id,
                'user_name' => $user->name ?? 'Usuario',
                'user_role' => 'cliente',
                'message' => "Te envió: " . ($giftRequest->gift->name ?? 'Regalo'),
                'type' => 'gift_received',
                'extra_data' => json_encode([
                    'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                    'gift_image' => $giftImage, // ← 🔥 USAR IMAGEN PERSONALIZADA DEL CLIENTE SI EXISTE
                    'gift_price' => $giftRequest->amount ?? 0,
                    'client_name' => $user->name ?? 'Cliente',
                    'modelo_name' => $giftRequest->modelo->name ?? 'Modelo',
                    'transaction_id' => $giftRequest->id ?? 0
                    ])
                ]);
                Log::info('✅ Modelo creado ID: ' . $modeloMessage->id);

            } catch (Exception $e) {
                Log::error('❌ Error modelo: ' . $e->getMessage());
                Log::error('📍 Archivo: ' . $e->getFile() . ':' . $e->getLine());
            }

            Log::info('🏁 FIN proceso mensajes');
            DB::commit();

            try {
                // 🔥 INTEGRAR CON SISTEMA UNIFICADO
                $earningsController = new \App\Http\Controllers\SessionEarningsController();
                $giftDetails = [
                    'gift_id' => $giftRequest->gift_id,
                    'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                    'gift_image' => $giftRequest->gift->image_path ?? null,
                    'gift_price' => $giftRequest->amount,
                    'transaction_id' => $giftRequest->id,
                    'context' => 'chat_request'
                ];

                $earningsResult = $earningsController->processGiftEarnings(
                    $giftRequest->modelo_id,     // modelUserId
                    $user->id,                   // clientUserId
                    $giftRequest->amount,        // giftValue
                    $giftRequest->room_name ?? 'chat_gift',     // roomName
                    $giftDetails                 // giftDetails
                );

                if ($earningsResult) {
                    Log::info('✅ [UNIFICADO] Ganancias de regalo de chat integradas', [
                        'gift_request_id' => $giftRequest->id,
                        'modelo_id' => $giftRequest->modelo_id,
                        'client_id' => $user->id,
                        'amount' => $giftRequest->amount,
                        'context' => 'chat_request'
                    ]);
                } else {
                    Log::warning('⚠️ [UNIFICADO] Error integrando ganancias de regalo de chat', [
                        'gift_request_id' => $giftRequest->id
                    ]);
                }

            } catch (\Exception $e) {
                Log::error('❌ [UNIFICADO] Excepción integrando ganancias de regalo: ' . $e->getMessage(), [
                    'gift_request_id' => $giftRequest->id ?? null,
                    'trace' => $e->getTraceAsString()
                ]);
                // NO hacer rollback aquí - la transacción ya se completó exitosamente
            }

            return response()->json([
                'success' => true,
                'message' => '¡Regalo enviado exitosamente!',
                'data' => [
                    'transaction_id' => $giftRequest->id,
                    'gift' => [
                        'id' => $giftRequest->gift->id,
                        'name' => $giftRequest->gift->name,
                        'image' => $giftRequest->gift->image_path ? asset($giftRequest->gift->image_path) : null,
                        'amount' => $giftRequest->amount
                    ],
                    'modelo' => [
                        'id' => $giftRequest->modelo->id,
                        'name' => $giftRequest->modelo->name,
                        'received_amount' => $modeloAmount
                    ],
                    'client_balance' => [
                        'new_balance' => $clientCoins->fresh()->balance,
                        'spent_amount' => $giftRequest->amount
                    ],
                    'transaction_details' => [
                        'processed_at' => now()->toISOString(),
                        'modelo_received' => $modeloAmount,
                        'platform_fee' => $platformCommission
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            // Limpiar lock en caso de error
            if (isset($lockKey)) {
                \Illuminate\Support\Facades\Cache::forget($lockKey);
            }
            
            Log::error('❌ Error al aceptar regalo', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $requestId,
                'client_id' => $user->id ?? null,
                'security_hash_provided' => $request->input('security_hash') ? 'SÍ' : 'NO'
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'processing_failed',
                'message' => config('app.debug') ? $e->getMessage() : 'Error interno al procesar el regalo'
            ], 500);
        }
    }
    /**
     * ❌ CLIENTE rechaza la solicitud
     */
    public function rejectGiftRequest(Request $request, $requestId) // ← Agregar parámetro
    {
        try {
            $request->validate([
                // 'request_id' => 'required|integer|exists:gift_requests,id', ← QUITAR ESTA LÍNEA
                'reason' => 'nullable|string|max:255'
            ]);

            $client = Auth::user();
            // $requestId = $request->request_id; ← QUITAR ESTA LÍNEA
            // El $requestId ya viene del parámetro de la URL

            Log::info('❌ Cliente rechazando solicitud', [
                'client_id' => $client->id,
                'request_id' => $requestId
            ]);

            // Validar que el requestId existe en la base de datos
            $giftRequest = GiftRequest::where('id', $requestId)
                ->where('client_id', $client->id)
                ->where('status', 'pending')
                ->first();

            if (!$giftRequest) {
                return response()->json([
                    'success' => false,
                    'error' => 'Solicitud no encontrada'
                ], 404);
            }

            $giftRequest->update([
                'status' => 'rejected',
                'processed_at' => now(),
                'rejection_reason' => $request->reason
            ]);

            Log::info('✅ Solicitud rechazada', [
                'request_id' => $requestId,
                'reason' => $request->reason
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Solicitud rechazada'
            ]);

        } catch (Exception $e) {
            Log::error('Error rechazando solicitud: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al rechazar solicitud'
            ], 500);
        }
    }

    public function sendDirectGift(Request $request)
    {
        try {
            DB::beginTransaction();
            
            $user = Auth::user();
            $recipientId = $request->input('recipient_id');
            $giftId = $request->input('gift_id');
            $message = $request->input('message', '');
            $roomName = $request->input('room_name', 'direct_message');
            
            Log::info('🎁 [CHAT] Enviando regalo directo', [
                'sender_id' => $user->id,
                'recipient_id' => $recipientId,
                'gift_id' => $giftId,
                'room_name' => $roomName
            ]);

            // Validaciones básicas
            if (!$recipientId || !$giftId) {
                return response()->json([
                    'success' => false,
                    'error' => 'missing_parameters',
                    'message' => 'Faltan parámetros requeridos (recipient_id, gift_id)'
                ], 400);
            }

            // Verificar que el usuario puede enviar regalos (cliente)
            if ($user->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'unauthorized',
                    'message' => 'Solo los clientes pueden enviar regalos directamente'
                ], 403);
            }

            // Verificar que el regalo existe y está activo
            $gift = Gift::where('id', $giftId)
                ->where('is_active', true)
                ->first();
                
            if (!$gift) {
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_gift',
                    'message' => 'El regalo no existe o no está disponible'
                ], 400);
            }

            // Verificar que el destinatario existe y es modelo
            $recipient = User::where('id', $recipientId)
                ->where('rol', 'modelo')
                ->first();
                
            if (!$recipient) {
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_recipient',
                    'message' => 'El destinatario no es válido'
                ], 400);
            }

            // 🔐 VERIFICAR SALDO DEL CLIENTE CON BLOQUEO
            $lockKey = "chat_direct_gift_lock_{$user->id}_{$giftId}";
            if (\Illuminate\Support\Facades\Cache::has($lockKey)) {
                return response()->json([
                    'success' => false,
                    'error' => 'already_processing',
                    'message' => 'Ya hay un regalo siendo procesado'
                ], 409);
            }

            // Crear lock temporal
            \Illuminate\Support\Facades\Cache::put($lockKey, true, 300); // 5 minutos

            // Verificar saldo del cliente con bloqueo de fila - USAR UserCoins (sistema unificado)
            $clientCoins = \App\Models\UserCoins::lockForUpdate()
                ->where('user_id', $user->id)
                ->first();

            if (!$clientCoins) {
                $clientCoins = \App\Models\UserCoins::create([
                    'user_id' => $user->id,
                    'purchased_balance' => 0,
                    'gift_balance' => 0,
                    'total_purchased' => 0,
                    'total_consumed' => 0
                ]);
            }

            // 🔥 VERIFICAR SALDO DE REGALOS (solo `gift_balance`) — no consumir `purchased_balance` para regalos
            $giftOnlyBalance = $clientCoins->gift_balance;

            if ($giftOnlyBalance < $gift->price) {
                \Illuminate\Support\Facades\Cache::forget($lockKey);
                
                Log::warning("❌ [CHAT] Saldo de regalos insuficiente para regalo directo", [
                    'client_id' => $user->id,
                    'gift_balance' => $clientCoins->gift_balance,
                    'required' => $gift->price
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'insufficient_balance',
                    'message' => 'Saldo de regalos insuficiente para este regalo',
                    'data' => [
                        'current_gift_balance' => $giftOnlyBalance,
                        'required_amount' => $gift->price,
                        'missing_amount' => $gift->price - $giftOnlyBalance
                    ]
                ], 400);
            }

            // 💰 PROCESAR TRANSACCIÓN DIRECTA
            Log::info("💰 [CHAT] Procesando regalo directo", [
                'client_total_balance_before' => $totalBalance,
                'purchased_balance' => $clientCoins->purchased_balance,
                'gift_balance' => $clientCoins->gift_balance,
                'amount' => $gift->price,
                'room_name' => $roomName
            ]);
            
            // 1. Descontar exclusivamente de gift_balance
            $clientCoins->gift_balance -= $gift->price;
            $clientCoins->total_consumed += $gift->price;
            $clientCoins->last_consumption_at = now();
            $clientCoins->save();

            // 2. Obtener/crear monedas de la modelo - USAR UserCoins (sistema unificado)
            $modeloCoins = \App\Models\UserCoins::lockForUpdate()
                ->where('user_id', $recipientId)
                ->first();

            if (!$modeloCoins) {
                $modeloCoins = \App\Models\UserCoins::create([
                    'user_id' => $recipientId,
                    'purchased_balance' => 0,
                    'gift_balance' => 0,
                    'total_purchased' => 0,
                    'total_consumed' => 0
                ]);
            }

            // 3. Calcular comisión usando configuración dinámica
            $giftCommissionPercentage = PlatformSettingsService::getInteger('gift_commission_percentage', 40);
            $platformCommissionRate = $giftCommissionPercentage / 100;
            $modeloRate = 1 - $platformCommissionRate;
            
            $modeloAmount = $gift->price * $modeloRate;
            $platformCommission = $gift->price * $platformCommissionRate;

            // 4. Agregar monedas a la modelo (en purchased_balance ya que son ganancias)
            $modeloCoins->increment('purchased_balance', $modeloAmount);
            $modeloCoins->increment('total_purchased', $modeloAmount);
            $modeloCoins->save();

            // 5. Registrar la transacción directa
            $transactionId = DB::table('gift_transactions')->insertGetId([
                'gift_request_id' => null, // No hay request previo
                'client_id' => $user->id,
                'modelo_id' => $recipientId,
                'sender_id' => $user->id,
                'receiver_id' => $recipientId,
                'gift_id' => $giftId,
                'amount' => $gift->price,
                'amount_total' => $gift->price,
                'amount_modelo' => $modeloAmount,
                'amount_commission' => $platformCommission,
                'type' => 'direct_gift',
                'transaction_type' => 'chat_direct_gift',
                'status' => 'completed',
                'source' => 'chat_gift_system',
                'message' => $message ?: "Regalo directo: {$gift->name}",
                'reference_id' => "CHG-DIRECT-" . time(),
                'room_name' => $roomName,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            // 6. Limpiar lock
            \Illuminate\Support\Facades\Cache::forget($lockKey);

            // 🔥 OBTENER BALANCE TOTAL ACTUALIZADO
            $clientCoinsFresh = $clientCoins->fresh();
            $newTotalBalance = $clientCoinsFresh->purchased_balance + $clientCoinsFresh->gift_balance;
            
            Log::info('✅ [CHAT] Regalo directo enviado exitosamente', [
                'transaction_id' => $transactionId,
                'client_id' => $user->id,
                'modelo_id' => $recipientId,
                'gift_id' => $giftId,
                'amount' => $gift->price,
                'modelo_received' => $modeloAmount,
                'platform_commission' => $platformCommission,
                'client_new_total_balance' => $newTotalBalance,
                'client_new_purchased_balance' => $clientCoinsFresh->purchased_balance,
                'client_new_gift_balance' => $clientCoinsFresh->gift_balance,
                'room_name' => $roomName
            ]);

            // 🔥 INTEGRAR CON SISTEMA UNIFICADO
            try {
                $earningsController = new \App\Http\Controllers\SessionEarningsController();
                $giftDetails = [
                    'gift_id' => $gift->id,
                    'gift_name' => $gift->name,
                    'gift_image' => $gift->image_path,
                    'gift_price' => $gift->price,
                    'transaction_id' => $transactionId,
                    'context' => 'direct_gift'
                ];

                $earningsResult = $earningsController->processGiftEarnings(
                    $recipientId,                // modelUserId
                    $user->id,                   // clientUserId
                    $gift->price,                // giftValue
                    $roomName,                   // roomName
                    $giftDetails                 // giftDetails
                );

                if ($earningsResult) {
                    Log::info('✅ [UNIFICADO] Ganancias de regalo directo integradas', [
                        'transaction_id' => $transactionId,
                        'modelo_id' => $recipientId,
                        'client_id' => $user->id,
                        'amount' => $gift->price,
                        'context' => 'direct_gift'
                    ]);
                } else {
                    Log::warning('⚠️ [UNIFICADO] Error integrando ganancias de regalo directo', [
                        'transaction_id' => $transactionId
                    ]);
                }

            } catch (\Exception $e) {
                Log::error('❌ [UNIFICADO] Excepción integrando ganancias de regalo directo: ' . $e->getMessage(), [
                    'transaction_id' => $transactionId,
                    'trace' => $e->getTraceAsString()
                ]);
            }

            // 6. 💬 CREAR MENSAJES DE CHAT PARA REGALO DIRECTO
            Log::info('💬 [CHAT] Creando mensajes de chat para regalo directo', [
                'room_name' => $roomName,
                'gift_name' => $gift->name ?? 'NULL',
                'user_id' => $user->id ?? 'NULL',
                'user_name' => $user->name ?? 'NULL',
                'modelo_id' => $recipientId ?? 'NULL'
            ]);
            
            // 🔥 DETECTAR SI ES VIDEOCHAT (room_name no tiene sufijos _modelo/_client y no empieza con chat_user_)
            $isVideoChat = !empty($roomName) && 
                          $roomName !== 'direct_message' && 
                          !str_starts_with($roomName, 'chat_user_') &&
                          !str_ends_with($roomName, '_modelo') && 
                          !str_ends_with($roomName, '_client');
            
            // 🔥 Asegurar que el room_name no tenga sufijos ya agregados
            $baseRoomName = $roomName;
            if (str_ends_with($roomName, '_modelo') || str_ends_with($roomName, '_client')) {
                $baseRoomName = substr($roomName, 0, -7); // Remover '_modelo' o '_client'
            }
            
            // 🔥 Si el room_name está vacío, construir uno basado en los IDs
            if (empty($baseRoomName) || $baseRoomName === 'direct_message') {
                $baseRoomName = "chat_user_{$recipientId}_{$user->id}";
                Log::info('💬 [CHAT] Room_name vacío, construyendo nuevo:', ['base_room_name' => $baseRoomName]);
                $isVideoChat = false; // No es videochat si construimos el room_name
            }
            
            Log::info('💬 [CHAT] Detección de contexto:', [
                'is_videochat' => $isVideoChat,
                'base_room_name' => $baseRoomName,
                'original_room_name' => $roomName
            ]);
            
            $giftDataForModelo = [
                'gift_name' => $gift->name ?? 'Regalo',
                'gift_image' => $gift->image_path ?? null,
                'gift_price' => $gift->price ?? 0,
                'client_name' => $user->name ?? 'Cliente',
                'modelo_name' => $recipient->name ?? 'Modelo',
                'transaction_id' => $transactionId ?? 0,
                'context' => $isVideoChat ? 'videochat_direct' : 'chat_direct',
                'room_name' => $baseRoomName,
                'action_text' => "Recibiste de",
                'sender_name' => $user->name ?? 'Cliente',
                'original_message' => $message
            ];
            
            $chatMessage = null;
            $modeloMessage = null;

            try {
                // Mensaje para el cliente (SENDER)
                // 🔥 Si es videochat, usar el mismo room_name sin sufijos
                $clientRoomName = $isVideoChat ? $baseRoomName : ($baseRoomName . '_client');
                
                $chatMessage = ChatMessage::create([
                    'room_name' => $clientRoomName,
                    'user_id' => $user->id,
                    'user_name' => $user->name ?? 'Cliente',
                    'user_role' => 'cliente',
                    'message' => $message ?: "Enviaste: {$gift->name}",
                    'type' => 'gift_sent',
                    'extra_data' => json_encode([
                        'gift_name' => $gift->name,
                        'gift_image' => $gift->image_path,
                        'gift_price' => $gift->price,
                        'client_name' => $user->name ?? 'Cliente',
                        'modelo_name' => $recipient->name ?? 'Modelo',
                        'transaction_id' => $transactionId,
                        'context' => $isVideoChat ? 'videochat_direct' : 'chat_direct',
                        'room_name' => $baseRoomName,
                        'action_text' => "Enviaste",
                        'recipient_name' => $recipient->name ?? 'Modelo',
                        'message' => $message
                    ]),
                    'gift_data' => json_encode([
                        'gift_name' => $gift->name,
                        'gift_image' => $gift->image_path,
                        'gift_price' => $gift->price,
                        'original_message' => $message
                    ])
                ]);
                
                Log::info('✅ [CHAT] Mensaje cliente creado ID: ' . $chatMessage->id);

            } catch (\Exception $e) {
                Log::error('❌ [CHAT] Error creando mensaje cliente: ' . $e->getMessage(), [
                    'trace' => $e->getTraceAsString()
                ]);
            }

            try {
                // Mensaje para la modelo (RECEIVER)
                // 🔥 Si es videochat, usar el mismo room_name sin sufijos
                $modeloRoomName = $isVideoChat ? $baseRoomName : ($baseRoomName . '_modelo');
                
                Log::info('🚀 [CHAT] Creando mensaje para modelo con room_name:', [
                    'room_name' => $modeloRoomName,
                    'base_room_name' => $baseRoomName,
                    'is_videochat' => $isVideoChat,
                    'gift_data' => $giftDataForModelo
                ]);
                
                $modeloMessage = ChatMessage::create([
                    'room_name' => $modeloRoomName,
                    'user_id' => $user->id,
                    'user_name' => $user->name ?? 'Usuario',
                    'user_role' => 'cliente',
                    'message' => $message ?: "Te envió: {$gift->name}",
                    'type' => 'gift_received',
                    'extra_data' => json_encode($giftDataForModelo)
                ]);
                
                // 🔥 Actualizar gift_data si la columna existe
                try {
                    if (Schema::hasColumn('chat_messages', 'gift_data')) {
                        DB::table('chat_messages')
                            ->where('id', $modeloMessage->id)
                            ->update(['gift_data' => json_encode($giftDataForModelo)]);
                    }
                } catch (\Exception $e) {
                    Log::warning('⚠️ [CHAT] No se pudo actualizar gift_data (columna puede no existir): ' . $e->getMessage());
                }
                
                // 🔥 Verificar que el mensaje se creó correctamente
                $verificationMessage = ChatMessage::find($modeloMessage->id);
                
                Log::info('✅ [CHAT] Modelo creado ID: ' . $modeloMessage->id, [
                    'room_name' => $modeloRoomName,
                    'base_room_name' => $baseRoomName,
                    'type' => 'gift_received',
                    'gift_name' => $gift->name ?? 'N/A',
                    'gift_data' => $giftDataForModelo,
                    'message_id' => $modeloMessage->id,
                    'message_created_at' => $modeloMessage->created_at,
                    'verification' => [
                        'exists' => !!$verificationMessage,
                        'room_name_stored' => $verificationMessage->room_name ?? 'NOT FOUND',
                        'type_stored' => $verificationMessage->type ?? 'NOT FOUND',
                        'has_extra_data' => !!$verificationMessage->extra_data
                    ],
                    'expected_room_name_for_modelo' => $baseRoomName . '_modelo',
                    'actual_room_name_stored' => $verificationMessage->room_name ?? 'NOT FOUND',
                    'match' => ($verificationMessage->room_name ?? '') === ($baseRoomName . '_modelo')
                ]);

            } catch (\Exception $e) {
                Log::error('❌ [CHAT] Error creando mensaje modelo: ' . $e->getMessage());
                Log::error('📍 [CHAT] Archivo: ' . $e->getFile() . ':' . $e->getLine());
            }
            
            Log::info('🏁 [CHAT] FIN proceso mensajes para regalo directo');

            DB::commit();

            // 🔥 OBTENER BALANCE TOTAL ACTUALIZADO PARA LA RESPUESTA
            $clientCoinsFresh = $clientCoins->fresh();
            $newTotalBalance = $clientCoinsFresh->purchased_balance + $clientCoinsFresh->gift_balance;
            
            // 🔥 Log final de confirmación
            Log::info('✅ [CHAT] Regalo directo completado exitosamente', [
                'transaction_id' => $transactionId,
                'client_message_id' => $chatMessage->id ?? null,
                'modelo_message_id' => $modeloMessage->id ?? null,
                'client_room_name' => $chatMessage->room_name ?? null,
                'modelo_room_name' => $modeloMessage->room_name ?? null,
                'base_room_name' => $baseRoomName
            ]);
            
            return response()->json([
                'success' => true,
                'message' => '¡Regalo enviado exitosamente!',
                'context' => 'chat_direct',
                'gift_name' => $gift->name,
                'gift_image' => $gift->image_path,
                'gift_price' => $gift->price,
                'amount' => $gift->price,
                'new_balance' => $newTotalBalance, // 🔥 Balance total (purchased + gift)
                'purchased_balance' => $clientCoinsFresh->purchased_balance,
                'gift_balance' => $clientCoinsFresh->gift_balance,
                'chat_message' => $chatMessage ? [
                    'id' => $chatMessage->id,
                    'room_name' => $chatMessage->room_name,
                    'user_id' => $chatMessage->user_id,
                    'user_name' => $chatMessage->user_name,
                    'user_role' => $chatMessage->user_role,
                    'message' => $chatMessage->message,
                    'type' => $chatMessage->type,
                    'extra_data' => json_decode($chatMessage->extra_data, true),
                    'created_at' => $chatMessage->created_at->toISOString()
                ] : null,
                'modelo_message_created' => $modeloMessage ? [
                    'id' => $modeloMessage->id,
                    'room_name' => $modeloMessage->room_name,
                    'type' => $modeloMessage->type,
                    'created_at' => $modeloMessage->created_at->toISOString()
                ] : null,
                'data' => [
                    'transaction_id' => $transactionId,
                    'gift' => [
                        'id' => $gift->id,
                        'name' => $gift->name,
                        'image' => $gift->image_path ? asset($gift->image_path) : null,
                        'price' => $gift->price
                    ],
                    'recipient' => [
                        'id' => $recipient->id,
                        'name' => $recipient->name,
                        'received_amount' => $modeloAmount
                    ],
                    'client_balance' => [
                        'new_balance' => $newTotalBalance, // 🔥 Balance total (purchased + gift)
                        'total_balance' => $newTotalBalance, // 🔥 Alias para compatibilidad
                        'purchased_balance' => $clientCoinsFresh->purchased_balance,
                        'gift_balance' => $clientCoinsFresh->gift_balance,
                        'spent_amount' => $gift->price
                    ],
                    'transaction_details' => [
                        'processed_at' => now()->toISOString(),
                        'modelo_received' => $modeloAmount,
                        'platform_fee' => $platformCommission,
                        'room_name' => $roomName,
                        'base_room_name' => $baseRoomName,
                        'type' => 'direct_gift'
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            // Limpiar lock en caso de error
            if (isset($lockKey)) {
                \Illuminate\Support\Facades\Cache::forget($lockKey);
            }
            
            Log::error('❌ [CHAT] Error enviando regalo directo', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'sender_id' => $user->id ?? null,
                'recipient_id' => $recipientId,
                'gift_id' => $giftId
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'processing_failed',
                'message' => config('app.debug') ? $e->getMessage() : 'Error interno al enviar el regalo'
            ], 500);
        }
    }


    /**
     * 📊 Obtener historial de regalos
     */
    public function getGiftHistory($limit = 20)
    {
        try {
            $user = Auth::user();

            $transactions = GiftTransaction::where(function($query) use ($user) {
                $query->where('sender_id', $user->id)
                      ->orWhere('receiver_id', $user->id);
            })
            ->with(['sender', 'receiver'])
            ->leftJoin('gifts', 'gift_transactions.gift_id', '=', 'gifts.id')
            ->select('gift_transactions.*', 'gifts.name as gift_name', 'gifts.image_path as gift_image')
            ->orderBy('gift_transactions.created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($transaction) use ($user) {
                $isSender = $transaction->sender_id === $user->id;
                
                return [
                    'id' => $transaction->id,
                    'type' => $isSender ? 'sent' : 'received',
                    'gift' => [
                        'id' => $transaction->gift_id,
                        'name' => $transaction->gift_name ?? 'Regalo eliminado',
                        'image' => $transaction->gift_image ?? null
                    ],
                    'amount' => $transaction->amount,
                    'other_user' => $isSender ? 
                        ($transaction->receiver->name ?? 'Usuario eliminado') : 
                        ($transaction->sender->name ?? 'Usuario eliminado'),
                    'message' => $transaction->message,
                    'room_name' => $transaction->room_name,
                    'sent_at' => $transaction->created_at->toISOString()
                ];
            });

            return response()->json([
                'success' => true,
                'history' => $transactions,
                'total_sent' => GiftTransaction::where('sender_id', $user->id)->sum('amount'),
                'total_received' => GiftTransaction::where('receiver_id', $user->id)->sum('amount')
            ]);

        } catch (Exception $e) {
            Log::error('Error obteniendo historial de regalos: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener historial'
            ], 500);
        }
    }

    /**
     * 🔄 Limpiar solicitudes expiradas (ejecutar por cron)
     */
    public function cleanExpiredRequests()
    {
        try {
            $expiredCount = GiftRequest::where('status', 'pending')
                ->where('expires_at', '<', now())
                ->update([
                    'status' => 'expired',
                    'processed_at' => now()
                ]);

            Log::info('🧹 Solicitudes expiradas limpiadas', [
                'expired_count' => $expiredCount
            ]);

            return response()->json([
                'success' => true,
                'expired_requests' => $expiredCount
            ]);

        } catch (Exception $e) {
            Log::error('Error limpiando solicitudes expiradas: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al limpiar solicitudes'
            ], 500);
        }
    }

    // ========================= MÉTODOS PRIVADOS =========================

    /**
     * 💰 PROCESAR GANANCIAS DE REGALOS EN SESSION_EARNINGS
     */
    private function processGiftEarnings($modeloId, $clientId, $giftValue, $roomName, $transactionId)
    {
        try {
            Log::info('💰 Procesando gift earnings', [
                'modelo_id' => $modeloId,
                'client_id' => $clientId,
                'gift_value' => $giftValue,
                'room_name' => $roomName,
                'transaction_id' => $transactionId
            ]);

            // Buscar si ya existe un registro de earnings para esta sesión
            $existingEarning = \App\Models\SessionEarning::where('model_user_id', $modeloId)
                ->where('client_user_id', $clientId)
                ->where('room_name', $roomName)
                ->orderBy('created_at', 'desc')
                ->first();

            // Convertir gift coins a USD
            $usdValue = $this->calculateUSDFromGiftCoins($giftValue);
            
            // Calcular earnings usando configuración dinámica
            $giftCommissionPercentage = PlatformSettingsService::getInteger('gift_commission_percentage', 40);
            $platformCommissionRate = $giftCommissionPercentage / 100;
            $modelRate = 1 - $platformCommissionRate;
            
            $modelGiftEarnings = round($usdValue * $modelRate, 2);
            $platformGiftEarnings = round($usdValue * $platformCommissionRate, 2);

            if ($existingEarning) {
                // Actualizar earnings existente
                $existingEarning->update([
                    'total_gifts_coins_spent' => ($existingEarning->total_gifts_coins_spent ?? 0) + $giftValue,
                    'total_coins_spent' => ($existingEarning->total_coins_spent ?? 0) + $giftValue,
                    'model_gift_earnings' => ($existingEarning->model_gift_earnings ?? 0) + $modelGiftEarnings,
                    'model_total_earnings' => ($existingEarning->model_total_earnings ?? 0) + $modelGiftEarnings,
                    'platform_gift_earnings' => ($existingEarning->platform_gift_earnings ?? 0) + $platformGiftEarnings,
                    'platform_total_earnings' => ($existingEarning->platform_total_earnings ?? 0) + $platformGiftEarnings,
                    'client_usd_spent' => ($existingEarning->client_usd_spent ?? 0) + $usdValue,
                    'updated_at' => now()
                ]);

                Log::info('✅ Gift earnings actualizado en registro existente', [
                    'earning_id' => $existingEarning->id,
                    'new_model_gift_earnings' => $existingEarning->model_gift_earnings,
                    'new_total_earnings' => $existingEarning->model_total_earnings
                ]);
            } else {
                // Crear nuevo registro de earnings solo para regalos
                $newEarning = \App\Models\SessionEarning::create([
                    'session_id' => 'gift_' . $transactionId,
                    'model_user_id' => $modeloId,
                    'client_user_id' => $clientId,
                    'room_name' => $roomName,
                    'session_duration_seconds' => 0,
                    'qualifying_session' => true,
                    'total_time_coins_spent' => 0,
                    'total_gifts_coins_spent' => $giftValue,
                    'total_coins_spent' => $giftValue,
                    'client_usd_spent' => $usdValue,
                    'stripe_commission' => 0,
                    'after_stripe_amount' => $usdValue,
                    'model_time_earnings' => 0,
                    'model_gift_earnings' => $modelGiftEarnings,
                    'model_total_earnings' => $modelGiftEarnings,
                    'platform_time_earnings' => 0,
                    'platform_gift_earnings' => $platformGiftEarnings,
                    'platform_total_earnings' => $platformGiftEarnings,
                    'session_started_at' => now(),
                    'session_ended_at' => now(),
                    'processed_at' => now()
                ]);

                Log::info('✅ Nuevo gift earning creado', [
                    'earning_id' => $newEarning->id,
                    'model_gift_earnings' => $modelGiftEarnings,
                    'platform_gift_earnings' => $platformGiftEarnings
                ]);
            }

            return true;

        } catch (Exception $e) {
            Log::error('❌ Error procesando gift earnings: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * 💱 Calcular USD desde gift coins
     */
    private function calculateUSDFromGiftCoins($giftCoins)
    {
        try {
            $averageCostPerCoin = $this->getAverageCoinCost();
            return round($giftCoins * $averageCostPerCoin, 2);

        } catch (Exception $e) {
            Log::error('Error calculando USD desde gift coins: ' . $e->getMessage());
            return round($giftCoins * 0.15, 2); // Fallback
        }
    }

    /**
     * 💰 Obtener costo promedio por coin
     */
    private function getAverageCoinCost()
    {
        try {
            $packages = \App\Models\CoinPackage::where('is_active', true)
                ->where('type', 'minutes')
                ->get();

            if ($packages->isEmpty()) {
                return 0.15; // Fallback
            }

            $totalCost = 0;
            $totalCoins = 0;

            foreach ($packages as $package) {
                $packageCoins = $package->coins + ($package->bonus_coins ?? 0);
                $totalCost += $package->regular_price;
                $totalCoins += $packageCoins;
            }

            return $totalCoins > 0 ? ($totalCost / $totalCoins) : 0.15;

        } catch (Exception $e) {
            Log::error('Error obteniendo costo promedio: ' . $e->getMessage());
            return 0.15; // Fallback
        }
    }

    /**
     * 🛠️ Obtener o crear registro de coins de regalo
     */
    private function getUserGiftCoins($userId)
    {
        try {
            return UserGiftCoins::firstOrCreate(
                ['user_id' => $userId],
                [
                    'balance' => 0,
                    'total_received' => 0,
                    'total_sent' => 0
                ]
            );
        } catch (Exception $e) {
            Log::error('Error obteniendo UserGiftCoins: ' . $e->getMessage());
            throw $e;
        }
    }

    public function generateSecurityHash($modeloId, $clientId, $giftId, $amount): array
    {
        return $this->generateAdvancedSecurityHash($modeloId, $clientId, $giftId, $amount);
    }

    /**
     * 🎁 ENVIAR REGALO SIMPLE - Endpoint directo sin validaciones complejas
     * Este endpoint permite al cliente enviar un regalo directamente desde el request_id
     */
    public function sendGiftSimple(Request $request)
    {
        try {
            DB::beginTransaction();
            
            $user = Auth::user();
            $requestId = $request->input('request_id');
            
            Log::info("🎁 [SIMPLE] Cliente {$user->id} intentando enviar regalo con request_id: {$requestId}");
            
            // 1. Verificar que sea cliente
            if (!$user || $user->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo clientes pueden enviar regalos'
                ], 403);
            }
            
            // 2. Validar request_id
            if (!$requestId) {
                return response()->json([
                    'success' => false,
                    'error' => 'request_id es requerido'
                ], 400);
            }
            
            // 3. Buscar la solicitud de regalo
            $giftRequest = GiftRequest::where('id', $requestId)
                ->where('client_id', $user->id)
                ->where('status', 'pending')
                ->with(['modelo', 'gift'])
                ->first();
            
            if (!$giftRequest) {
                Log::warning("❌ [SIMPLE] Solicitud no encontrada", [
                    'request_id' => $requestId,
                    'client_id' => $user->id
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'La solicitud no existe, ya fue procesada o no te pertenece'
                ], 404);
            }
            
            // 4. Verificar que el regalo esté activo
            if (!$giftRequest->gift || !$giftRequest->gift->is_active) {
                return response()->json([
                    'success' => false,
                    'error' => 'El regalo ya no está disponible'
                ], 400);
            }
            
            // 5. Verificar saldo del cliente
            $clientCoins = UserGiftCoins::lockForUpdate()
                ->where('user_id', $user->id)
                ->first();
            
            if (!$clientCoins) {
                $clientCoins = UserGiftCoins::create([
                    'user_id' => $user->id,
                    'balance' => 0,
                    'total_received' => 0,
                    'total_sent' => 0
                ]);
            }
            
            if ($clientCoins->balance < $giftRequest->amount) {
                return response()->json([
                    'success' => false,
                    'error' => 'insufficient_balance',
                    'message' => 'Saldo insuficiente para este regalo',
                    'data' => [
                        'current_balance' => $clientCoins->balance,
                        'required_amount' => $giftRequest->amount,
                        'missing_amount' => $giftRequest->amount - $clientCoins->balance
                    ]
                ], 400);
            }
            
            // 6. Prevenir doble procesamiento
            $lockKey = "gift_simple_lock_{$user->id}_{$requestId}";
            if (\Illuminate\Support\Facades\Cache::has($lockKey)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Esta transacción ya se está procesando'
                ], 409);
            }
            \Illuminate\Support\Facades\Cache::put($lockKey, true, 300); // 5 minutos
            
            // 7. Procesar transacción
            Log::info("💰 [SIMPLE] Procesando transacción", [
                'client_balance_before' => $clientCoins->balance,
                'amount' => $giftRequest->amount
            ]);
            
            // Descontar del cliente
            $clientCoins->decrement('balance', $giftRequest->amount);
            $clientCoins->increment('total_sent', $giftRequest->amount);
            
            // Obtener/crear monedas de la modelo
            $modeloCoins = UserGiftCoins::lockForUpdate()
                ->where('user_id', $giftRequest->modelo_id)
                ->first();
            
            if (!$modeloCoins) {
                $modeloCoins = UserGiftCoins::create([
                    'user_id' => $giftRequest->modelo_id,
                    'balance' => 0,
                    'total_received' => 0,
                    'total_sent' => 0
                ]);
            }
            
            // Calcular comisión
            $giftCommissionPercentage = PlatformSettingsService::getInteger('gift_commission_percentage', 40);
            $platformCommissionRate = $giftCommissionPercentage / 100;
            $modeloRate = 1 - $platformCommissionRate;
            
            $modeloAmount = $giftRequest->amount * $modeloRate;
            $platformCommission = $giftRequest->amount * $platformCommissionRate;
            
            // Agregar monedas a la modelo
            $modeloCoins->increment('balance', $modeloAmount);
            $modeloCoins->increment('total_received', $modeloAmount);
            
            // Actualizar estado de la solicitud
            $giftRequest->update([
                'status' => 'accepted',
                'accepted_at' => now(),
                'processed_at' => now(),
                'processed_amount' => $giftRequest->amount,
                'modelo_received' => $modeloAmount,
                'platform_commission' => $platformCommission
            ]);
            
            // Registrar la transacción
            DB::table('gift_transactions')->insert([
                'gift_request_id' => $giftRequest->id,
                'client_id' => $user->id,
                'modelo_id' => $giftRequest->modelo_id,
                'sender_id' => $user->id,
                'receiver_id' => $giftRequest->modelo_id,
                'gift_id' => $giftRequest->gift_id,
                'amount' => $giftRequest->amount,
                'amount_total' => $giftRequest->amount,
                'amount_modelo' => $modeloAmount,
                'amount_commission' => $platformCommission,
                'type' => 'gift',
                'transaction_type' => 'gift_accepted',
                'status' => 'completed',
                'source' => 'gift_simple_system',
                'message' => "Regalo: {$giftRequest->gift->name}",
                'reference_id' => "GR-{$giftRequest->id}",
                'room_name' => $giftRequest->room_name ?? ''
            ]);
            
            // Crear mensajes de chat
            $roomName = $giftRequest->room_name ?? 'chat_default';
            
            // 🔥 Asegurar que el room_name no tenga sufijos ya agregados
            $baseRoomName = $roomName;
            if (str_ends_with($roomName, '_modelo') || str_ends_with($roomName, '_client')) {
                $baseRoomName = substr($roomName, 0, -7); // Remover '_modelo' o '_client'
            }
            
            // 🔥 Si el room_name está vacío o es 'chat_default', construir uno basado en los IDs
            if (empty($baseRoomName) || $baseRoomName === 'chat_default') {
                $baseRoomName = "chat_user_{$giftRequest->modelo_id}_{$user->id}";
                Log::info('💬 [SIMPLE] Room_name vacío, construyendo nuevo:', ['base_room_name' => $baseRoomName]);
            }
            
            Log::info('💬 [SIMPLE] INICIO: Creando mensajes', [
                'room_name_original' => $roomName,
                'base_room_name' => $baseRoomName,
                'room_name_modelo' => $baseRoomName . '_modelo',
                'room_name_client' => $baseRoomName . '_client',
                'gift_name' => $giftRequest->gift->name ?? 'NULL',
                'user_id' => $user->id ?? 'NULL',
                'user_name' => $user->name ?? 'NULL',
                'modelo_id' => $giftRequest->modelo_id ?? 'NULL',
                'client_id' => $user->id ?? 'NULL'
            ]);
            
            try {
                Log::info('🚀 [SIMPLE] Creando mensaje cliente...');
                
                // Mensaje para el cliente
                $clientMessage = ChatMessage::create([
                    'room_name' => $baseRoomName . '_client',
                    'user_id' => $user->id,
                    'user_name' => $user->name ?? 'Usuario',
                    'user_role' => 'cliente',
                    'message' => "Envió: " . ($giftRequest->gift->name ?? 'Regalo'),
                    'type' => 'gift_sent',
                    'extra_data' => json_encode([
                        'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                        'gift_image' => $giftRequest->gift->image_path ?? null,
                        'gift_price' => $giftRequest->amount ?? 0,
                        'client_name' => $user->name ?? 'Cliente',
                        'modelo_name' => $giftRequest->modelo->name ?? 'Modelo',
                        'transaction_id' => $giftRequest->id ?? 0,
                        'request_id' => $giftRequest->id
                    ])
                ]);
                
                Log::info('✅ [SIMPLE] Cliente creado ID: ' . $clientMessage->id);
                
            } catch (Exception $e) {
                Log::error('❌ [SIMPLE] Error cliente: ' . $e->getMessage());
                Log::error('📍 [SIMPLE] Archivo: ' . $e->getFile() . ':' . $e->getLine());
            }

            try {
                Log::info('🚀 [SIMPLE] Creando mensaje modelo...');
                
                // 🔥 Priorizar imagen personalizada del cliente (avatar) sobre imagen del regalo estándar
                // Recargar el usuario para asegurar que tenemos el avatar más reciente
                $user->refresh();
                
                $giftImage = null;
                Log::info('🔍 [SIMPLE] Verificando avatar del cliente', [
                    'user_id' => $user->id,
                    'avatar' => $user->avatar,
                    'avatar_exists' => !empty($user->avatar),
                    'gift_image_path' => $giftRequest->gift->image_path ?? null
                ]);
                
                if ($user->avatar && !empty(trim($user->avatar))) {
                    // Si el cliente tiene avatar personalizado, usarlo
                    $giftImage = $user->avatar;
                    Log::info('✅ [SIMPLE] Usando avatar personalizado del cliente', ['avatar' => $giftImage]);
                } else {
                    // Si no, usar la imagen del regalo estándar
                    $giftImage = $giftRequest->gift->image_path ?? null;
                    Log::info('⚠️ [SIMPLE] Usando imagen del regalo estándar', ['gift_image' => $giftImage]);
                }
                
                // Mensaje para la modelo
                $giftDataForModelo = [
                    'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                    'gift_image' => $giftImage, // ← 🔥 USAR IMAGEN PERSONALIZADA DEL CLIENTE SI EXISTE
                    'gift_price' => $giftRequest->amount ?? 0,
                    'client_name' => $user->name ?? 'Cliente',
                    'modelo_name' => $giftRequest->modelo->name ?? 'Modelo',
                    'transaction_id' => $giftRequest->id ?? 0,
                    'request_id' => $giftRequest->id
                ];
                
                $modeloRoomName = $baseRoomName . '_modelo';
                
                Log::info('🚀 [SIMPLE] Creando mensaje para modelo con room_name:', [
                    'room_name' => $modeloRoomName,
                    'base_room_name' => $baseRoomName,
                    'gift_data' => $giftDataForModelo
                ]);
                
                $modeloMessage = ChatMessage::create([
                    'room_name' => $modeloRoomName,
                    'user_id' => $user->id,
                    'user_name' => $user->name ?? 'Usuario',
                    'user_role' => 'cliente',
                    'message' => "Te envió: " . ($giftRequest->gift->name ?? 'Regalo'),
                    'type' => 'gift_received',
                    'extra_data' => json_encode($giftDataForModelo)
                ]);
                
                // 🔥 Actualizar gift_data si la columna existe (usando update directo)
                try {
                    if (Schema::hasColumn('chat_messages', 'gift_data')) {
                        DB::table('chat_messages')
                            ->where('id', $modeloMessage->id)
                            ->update(['gift_data' => json_encode($giftDataForModelo)]);
                    }
                } catch (\Exception $e) {
                    Log::warning('⚠️ [SIMPLE] No se pudo actualizar gift_data (columna puede no existir): ' . $e->getMessage());
                }
                
                // 🔥 Verificar que el mensaje se creó correctamente
                $verificationMessage = ChatMessage::find($modeloMessage->id);
                
                Log::info('✅ [SIMPLE] Modelo creado ID: ' . $modeloMessage->id, [
                    'room_name' => $modeloRoomName,
                    'base_room_name' => $baseRoomName,
                    'type' => 'gift_received',
                    'gift_name' => $giftRequest->gift->name ?? 'N/A',
                    'gift_data' => $giftDataForModelo,
                    'message_id' => $modeloMessage->id,
                    'message_created_at' => $modeloMessage->created_at,
                    'verification' => [
                        'exists' => !!$verificationMessage,
                        'room_name_stored' => $verificationMessage->room_name ?? 'NOT FOUND',
                        'type_stored' => $verificationMessage->type ?? 'NOT FOUND',
                        'has_extra_data' => !!$verificationMessage->extra_data
                    ]
                ]);
                
            } catch (Exception $e) {
                Log::error('❌ [SIMPLE] Error modelo: ' . $e->getMessage());
                Log::error('📍 [SIMPLE] Archivo: ' . $e->getFile() . ':' . $e->getLine());
            }
            
            Log::info('🏁 [SIMPLE] FIN proceso mensajes');
            
            // Limpiar lock
            \Illuminate\Support\Facades\Cache::forget($lockKey);
            
            // Cancelar solicitudes duplicadas
            GiftRequest::where('modelo_id', $giftRequest->modelo_id)
                ->where('client_id', $user->id)
                ->where('status', 'pending')
                ->where('id', '!=', $requestId)
                ->where('created_at', '>', now()->subMinutes(5))
                ->update([
                    'status' => 'cancelled',
                    'cancelled_reason' => 'duplicate_accepted'
                ]);
            
            DB::commit();
            
            // 🔥 INTEGRAR CON SISTEMA UNIFICADO DE EARNINGS
            try {
                $earningsController = new \App\Http\Controllers\SessionEarningsController();
                $giftDetails = [
                    'gift_id' => $giftRequest->gift_id,
                    'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                    'gift_image' => $giftRequest->gift->image_path ?? null,
                    'gift_price' => $giftRequest->amount,
                    'transaction_id' => $giftRequest->id,
                    'context' => 'chat_request'
                ];

                $earningsResult = $earningsController->processGiftEarnings(
                    $giftRequest->modelo_id,     // modelUserId
                    $user->id,                   // clientUserId
                    $giftRequest->amount,        // giftValue
                    $giftRequest->room_name ?? 'chat_gift',     // roomName
                    $giftDetails                 // giftDetails
                );

                if ($earningsResult) {
                    Log::info('✅ [SIMPLE] [UNIFICADO] Ganancias de regalo integradas', [
                        'gift_request_id' => $giftRequest->id,
                        'modelo_id' => $giftRequest->modelo_id,
                        'client_id' => $user->id,
                        'amount' => $giftRequest->amount
                    ]);
                } else {
                    Log::warning('⚠️ [SIMPLE] [UNIFICADO] Error integrando ganancias de regalo', [
                        'gift_request_id' => $giftRequest->id
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('❌ [SIMPLE] [UNIFICADO] Excepción integrando ganancias: ' . $e->getMessage(), [
                    'gift_request_id' => $giftRequest->id ?? null,
                    'trace' => $e->getTraceAsString()
                ]);
                // NO hacer rollback aquí - la transacción ya se completó exitosamente
            }
            
            Log::info('✅ [SIMPLE] Regalo enviado exitosamente', [
                'request_id' => $requestId,
                'client_id' => $user->id,
                'modelo_id' => $giftRequest->modelo_id,
                'amount' => $giftRequest->amount,
                'modelo_received' => $modeloAmount,
                'new_balance' => $clientCoins->fresh()->balance
            ]);
            
            return response()->json([
                'success' => true,
                'message' => '¡Regalo enviado exitosamente!',
                'data' => [
                    'transaction_id' => $giftRequest->id,
                    'gift' => [
                        'id' => $giftRequest->gift->id,
                        'name' => $giftRequest->gift->name,
                        'image' => $giftRequest->gift->image_path,
                        'amount' => $giftRequest->amount
                    ],
                    'client_balance' => [
                        'old_balance' => $clientCoins->balance + $giftRequest->amount,
                        'new_balance' => $clientCoins->fresh()->balance,
                        'amount_spent' => $giftRequest->amount
                    ],
                    'modelo_received' => $modeloAmount,
                    'platform_commission' => $platformCommission
                ]
            ]);
            
        } catch (Exception $e) {
            DB::rollBack();
            
            // Limpiar lock en caso de error
            if (isset($lockKey)) {
                \Illuminate\Support\Facades\Cache::forget($lockKey);
            }
            
            Log::error('❌ [SIMPLE] Error enviando regalo: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_id' => $request->input('request_id')
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error al procesar el regalo. Por favor intenta nuevamente.',
                'message' => config('app.debug') ? $e->getMessage() : 'Error interno del servidor'
            ], 500);
        }
    }
}