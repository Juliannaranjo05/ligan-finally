<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\UserGiftCoins;
use App\Models\UserCoins;
use App\Models\GiftRequest;
use App\Models\ChatSession;
use App\Models\ChatMessage;
use App\Services\PlatformSettingsService;
use Exception;
use Carbon\Carbon;

class VideoChatGiftController extends Controller
{
    /**
     * 🎁 Obtener todos los regalos disponibles para videochat
     */
    public function getAvailableGifts()
    {
        try {
            $gifts = Gift::where('is_active', true)
                ->orderBy('price', 'asc')
                ->get()
                ->map(function ($gift) {
                    return [
                        'id' => $gift->id,
                        'name' => $gift->name,
                        'image_path' => $gift->image_path ? asset($gift->image_path) : 'https://via.placeholder.com/80x80/ff007a/ffffff?text=NO',
                        'price' => $gift->price,
                        'category' => $gift->category ?? 'basic'
                    ];
                });

            return response()->json([
                'success' => true,
                'gifts' => $gifts,
                'total_available' => $gifts->count(),
                'context' => 'videochat'
            ]);

        } catch (Exception $e) {
            Log::error('❌ [VIDEOCHAT] Error obteniendo regalos: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener regalos disponibles'
            ], 500);
        }
    }
    /**
     * 🎁 ENVIAR REGALO DIRECTAMENTE (SIN SOLICITUD PREVIA)
     * Para clientes que quieren enviar regalos instantáneamente
     */
    public function sendDirectGift(Request $request)
    {
        try {
            DB::beginTransaction();
            
            $user = Auth::user();
            $recipientId = $request->input('recipient_id');
            $giftId = $request->input('gift_id');
            $roomName = $request->input('room_name');
            $message = $request->input('message', '');
            $senderType = $request->input('sender_type', 'cliente');
            
            Log::info('🎁 [VIDEOCHAT] Enviando regalo directo', [
                'sender_id' => $user->id,
                'sender_type' => $senderType,
                'recipient_id' => $recipientId,
                'gift_id' => $giftId,
                'room_name' => $roomName
            ]);

            // Validaciones básicas
            if (!$recipientId || !$giftId || !$roomName) {
                return response()->json([
                    'success' => false,
                    'error' => 'missing_parameters',
                    'message' => 'Faltan parámetros requeridos (recipient_id, gift_id, room_name)'
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

            // 🔥 VERIFICAR SESIÓN ACTIVA DE VIDEOCHAT
            $session = ChatSession::where('room_name', $roomName)
                ->where('status', 'active')
                ->where('cliente_id', $user->id)
                ->where('modelo_id', $recipientId)
                ->first();

            if (!$session) {
                Log::warning('❌ [VIDEOCHAT] Sesión no encontrada para regalo directo', [
                    'room_name' => $roomName,
                    'cliente_id' => $user->id,
                    'modelo_id' => $recipientId
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'invalid_session',
                    'message' => 'No hay sesión activa de videochat entre ambos usuarios'
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
            $lockKey = "videochat_direct_gift_lock_{$user->id}_{$giftId}";
            if (\Illuminate\Support\Facades\Cache::has($lockKey)) {
                return response()->json([
                    'success' => false,
                    'error' => 'already_processing',
                    'message' => 'Ya hay un regalo siendo procesado'
                ], 409);
            }

            // Crear lock temporal
            \Illuminate\Support\Facades\Cache::put($lockKey, true, 300); // 5 minutos

            // 🔥 VERIFICAR SALDO DEL CLIENTE USANDO SOLO `gift_balance` (saldo exclusivo para regalos)
            $clientUserCoins = UserCoins::lockForUpdate()
                ->where('user_id', $user->id)
                ->first();

            if (!$clientUserCoins) {
                $clientUserCoins = UserCoins::create([
                    'user_id' => $user->id,
                    'purchased_balance' => 0,
                    'gift_balance' => 0,
                    'total_purchased' => 0,
                    'total_consumed' => 0
                ]);
            }

            // Validar que el cliente tiene suficientes `gift_balance` para este regalo
            $giftOnlyBalance = $clientUserCoins->gift_balance;

            if ($giftOnlyBalance < $gift->price) {
                \Illuminate\Support\Facades\Cache::forget($lockKey);
                
                Log::warning("❌ [VIDEOCHAT] Saldo de regalos insuficiente para regalo directo", [
                    'client_id' => $user->id,
                    'gift_balance' => $clientUserCoins->gift_balance,
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
            // Calcular balance total antes de procesar
            $totalBalance = $clientUserCoins->purchased_balance + $clientUserCoins->gift_balance;
            
            Log::info("💰 [VIDEOCHAT] Procesando regalo directo", [
                'client_balance_before' => $totalBalance,
                'purchased_balance' => $clientUserCoins->purchased_balance,
                'gift_balance' => $clientUserCoins->gift_balance,
                'amount' => $gift->price,
                'room_name' => $roomName
            ]);
            
            // 1. Descontar exclusivamente de gift_balance
            $clientUserCoins->gift_balance -= $gift->price;
            $clientUserCoins->total_consumed += $gift->price;
            $clientUserCoins->last_consumption_at = now();
            $clientUserCoins->save();

            // 2. Obtener/crear monedas de la modelo
            $modeloCoins = UserGiftCoins::lockForUpdate()
                ->where('user_id', $recipientId)
                ->first();

            if (!$modeloCoins) {
                $modeloCoins = UserGiftCoins::create([
                    'user_id' => $recipientId,
                    'balance' => 0,
                    'total_received' => 0,
                    'total_sent' => 0
                ]);
            }

            // 3. Calcular comisión dinámicamente desde configuración
            $giftCommissionPercentage = \App\Services\PlatformSettingsService::getInteger('gift_commission_percentage', 40);
            $giftCommissionDecimal = $giftCommissionPercentage / 100;
            $modeloPercentage = 1 - $giftCommissionDecimal;
            
            $modeloAmount = $gift->price * $modeloPercentage;
            $platformCommission = $gift->price * $giftCommissionDecimal;

            // 4. Agregar monedas a la modelo
            $modeloCoins->increment('balance', $modeloAmount);
            $modeloCoins->increment('total_received', $modeloAmount);

            // 5. Registrar la transacción directa
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
                'transaction_type' => 'videochat_direct_gift',
                'status' => 'completed',
                'source' => 'videochat_gift_system',
                'message' => $message ?: "Regalo directo: {$gift->name}",
                'reference_id' => "VCG-DIRECT-" . time(), // ← LÍNEA CORREGIDA
                'room_name' => $roomName,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            // 6. 💬 CREAR MENSAJES DE CHAT PARA REGALO DIRECTO
            Log::info('💬 [VIDEOCHAT] Creando mensajes de chat para regalo directo');

            try {
                // Mensaje para el cliente (SENDER)
                $clientMessage = ChatMessage::create([
                    'room_name' => $roomName,
                    'user_id' => $user->id,
                    'user_name' => $user->name ?? 'Cliente',
                    'user_role' => 'cliente',
                    'message' => "🎁 Enviaste: {$gift->name}",
                    'type' => 'gift_sent',
                    'extra_data' => json_encode([
                        'gift_name' => $gift->name,
                        'gift_image' => $gift->image_path,
                        'gift_price' => $gift->price,
                        'client_name' => $user->name ?? 'Cliente',
                        'modelo_name' => $recipient->name ?? 'Modelo',
                        'transaction_id' => $transactionId,
                        'context' => 'videochat_direct',
                        'room_name' => $roomName,
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
                
                Log::info('✅ [VIDEOCHAT] Mensaje cliente creado ID: ' . $clientMessage->id);

            } catch (Exception $e) {
                Log::error('❌ [VIDEOCHAT] Error creando mensaje cliente: ' . $e->getMessage());
            }

            try {
                // Mensaje para la modelo (RECEIVER)
                $modeloMessage = ChatMessage::create([
                    'room_name' => $roomName,
                    'user_id' => $user->id,
                    'user_name' => $user->name ?? 'Cliente',
                    'user_role' => 'cliente',
                    'message' => "🎁 Recibiste: {$gift->name}",
                    'type' => 'gift_received',
                    'extra_data' => json_encode([
                        'gift_name' => $gift->name,
                        'gift_image' => $gift->image_path,
                        'gift_price' => $gift->price,
                        'client_name' => $user->name ?? 'Cliente',
                        'modelo_name' => $recipient->name ?? 'Modelo',
                        'transaction_id' => $transactionId,
                        'context' => 'videochat_direct',
                        'room_name' => $roomName,
                        'action_text' => "Recibiste de",
                        'sender_name' => $user->name ?? 'Cliente',
                        'message' => $message
                    ]),
                    'gift_data' => json_encode([
                        'gift_name' => $gift->name,
                        'gift_image' => $gift->image_path,
                        'gift_price' => $gift->price,
                        'original_message' => $message
                    ])
                ]);
                
                Log::info('✅ [VIDEOCHAT] Mensaje modelo creado ID: ' . $modeloMessage->id);

            } catch (Exception $e) {
                Log::error('❌ [VIDEOCHAT] Error creando mensaje modelo: ' . $e->getMessage());
            }

            // 7. Limpiar lock
            \Illuminate\Support\Facades\Cache::forget($lockKey);

            // 8. Procesar earnings específicos para videochat
           $earningsController = new \App\Http\Controllers\SessionEarningsController();
            $giftDetails = [
                'gift_id' => $giftId,
                'gift_name' => $gift->name,
                'gift_image' => $gift->image_path,
                'gift_price' => $gift->price,
                'transaction_id' => $transactionId,
                'context' => 'videochat_direct'
            ];

            $earningsController->processGiftEarnings(
                $recipientId,                // modelUserId
                $user->id,                   // clientUserId
                $gift->price,                // giftValue
                $roomName,                   // roomName
                $giftDetails                 // giftDetails
            );

            Log::info('✅ [UNIFICADO] Ganancias de regalo directo integradas', [
                'transaction_id' => $transactionId,
                'modelo_id' => $recipientId,
                'client_id' => $user->id,
                'amount' => $gift->price
            ]);


            Log::info('✅ [VIDEOCHAT] Regalo directo enviado exitosamente', [
                'transaction_id' => $transactionId,
                'client_id' => $user->id,
                'modelo_id' => $recipientId,
                'gift_id' => $giftId,
                'amount' => $gift->price,
                'modelo_received' => $modeloAmount,
                'platform_commission' => $platformCommission,
                'client_new_balance' => $clientUserCoins->fresh()->gift_balance,
                'room_name' => $roomName
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => '¡Regalo enviado exitosamente!',
                'context' => 'videochat_direct',
                'gift_name' => $gift->name,
                'gift_image' => $gift->image_path,
                'gift_price' => $gift->price,
                'amount' => $gift->price,
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
                        'new_balance' => $clientUserCoins->fresh()->gift_balance,
                        'spent_amount' => $gift->price
                    ],
                    'transaction_details' => [
                        'processed_at' => now()->toISOString(),
                        'modelo_received' => $modeloAmount,
                        'platform_fee' => $platformCommission,
                        'room_name' => $roomName,
                        'type' => 'direct_gift'
                    ],
                    'chat_messages' => [
                        'client_message_created' => isset($clientMessage),
                        'modelo_message_created' => isset($modeloMessage)
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            // Limpiar lock en caso de error
            if (isset($lockKey)) {
                \Illuminate\Support\Facades\Cache::forget($lockKey);
            }
            
            Log::error('❌ [VIDEOCHAT] Error enviando regalo directo', [
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
     * 🎁 SOLICITAR REGALO EN VIDEOCHAT - MÉTODO COMPLETO CON SEGURIDAD
     */
    public function requestGift(Request $request)
    {
        try {
            DB::beginTransaction();
            
            $user = Auth::user();
            $clientId = $request->input('client_id');
            $giftId = $request->input('gift_id');
            $roomName = $request->input('room_name');
            
            Log::info('🎁 [VIDEOCHAT] Iniciando solicitud de regalo', [
                'modelo_id' => $user->id,
                'client_id' => $clientId,
                'gift_id' => $giftId,
                'room_name' => $roomName
            ]);

            // Validaciones básicas
            if (!$clientId || !$giftId || !$roomName) {
                return response()->json([
                    'success' => false,
                    'error' => 'missing_parameters',
                    'message' => 'Faltan parámetros requeridos (client_id, gift_id, room_name)'
                ], 400);
            }

            // Verificar que es modelo
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'unauthorized',
                    'message' => 'Solo las modelos pueden solicitar regalos'
                ], 403);
            }

            // 🔥 VERIFICAR SESIÓN ACTIVA DE VIDEOCHAT
            $session = ChatSession::where('room_name', $roomName)
                ->where('status', 'active')
                ->where('modelo_id', $user->id)
                ->where('cliente_id', $clientId)
                ->first();

            if (!$session) {
                Log::warning('❌ [VIDEOCHAT] Sesión no encontrada', [
                    'room_name' => $roomName,
                    'modelo_id' => $user->id,
                    'client_id' => $clientId
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'invalid_session',
                    'message' => 'No hay sesión activa de videochat entre ambos usuarios'
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

            // 🔐 GENERAR HASH DE SEGURIDAD ESPECÍFICO PARA VIDEOCHAT
            $securityData = $this->generateVideoChatSecurityHash(
                $user->id,
                $clientId,
                $giftId,
                $gift->price,
                $roomName
            );

            // Verificar si ya existe una solicitud pendiente similar
            $existingRequest = GiftRequest::where('modelo_id', $user->id)
                ->where('client_id', $clientId)
                ->where('gift_id', $giftId)
                ->where('room_name', $roomName)
                ->where('status', 'pending')
                ->where('created_at', '>=', now()->subSeconds(30))
                ->first();

            if ($existingRequest) {
                return response()->json([
                    'success' => false,
                    'error' => 'duplicate_request',
                    'message' => 'Ya existe una solicitud similar reciente en esta sala'
                ], 409);
            }

            // 🎁 CREAR SOLICITUD DE REGALO ESPECÍFICA PARA VIDEOCHAT
            $giftRequest = GiftRequest::create([
                'modelo_id' => $user->id,
                'client_id' => $clientId,
                'gift_id' => $giftId,
                'amount' => $gift->price,
                'status' => 'pending',
                'expires_at' => now()->addMinutes(15),
                'room_name' => $roomName,
                'message' => $request->input('message', ''),
                'gift_data' => json_encode([
                    'security_hash' => $securityData['hash'],
                    'timestamp' => $securityData['timestamp'],
                    'nonce' => $securityData['nonce'],
                    'expires_at' => $securityData['expires_at'],
                    'session_id' => $securityData['session_id'],
                    'ip' => $securityData['ip'],
                    'integrity_hash' => $securityData['integrity_hash'],
                    'gift_name' => $gift->name,
                    'gift_image' => $gift->image_path,
                    'gift_price' => $gift->price,
                    'modelo_name' => $user->name,
                    'client_name' => $client->name,
                    'original_message' => $request->input('message', ''),
                    'context' => 'videochat',
                    'room_name' => $roomName,
                    'session_type' => 'videochat'
                ])
            ]);

            // 💬 CREAR MENSAJE DE CHAT ESPECÍFICO PARA VIDEOCHAT
            Log::info('💬 [VIDEOCHAT] Creando mensaje de chat para solicitud');

            try {
                // En VideoChatGiftController.php - requestGift()
                $chatMessageRecord = ChatMessage::create([
                    'room_name' => $roomName,
                    'user_id' => $user->id,
                    'user_name' => $user->name,
                    'user_role' => $user->rol,
                    'message' => "🎁 Solicitud de regalo: {$gift->name}",
                    'type' => 'gift_request',
                    'extra_data' => json_encode([
                        'request_id' => $giftRequest->id, // ← CRÍTICO: FALTABA ESTO
                        'security_hash' => $securityData['hash'], // ← CRÍTICO: FALTABA ESTO
                        'gift_name' => $gift->name,
                        'gift_image' => $gift->image_path,
                        'gift_price' => $gift->price,
                        'original_message' => $request->input('message', ''),
                        'context' => 'videochat',
                        'room_name' => $roomName
                    ]),
                    // 🔥 AGREGAR CAMPO gift_data TAMBIÉN
                    'gift_data' => json_encode([
                        'request_id' => $giftRequest->id,
                        'security_hash' => $securityData['hash'],
                        'gift_name' => $gift->name,
                        'gift_image' => $gift->image_path,
                        'gift_price' => $gift->price,
                        'original_message' => $request->input('message', '')
                    ])
                ]);

                Log::info('✅ [VIDEOCHAT] Mensaje de chat creado', [
                    'chat_message_id' => $chatMessageRecord->id
                ]);

            } catch (Exception $chatError) {
                Log::error('❌ [VIDEOCHAT] Error creando mensaje de chat: ' . $chatError->getMessage());
            }

            // 📨 PREPARAR MENSAJE PARA EL FRONTEND
            $chatMessage = [
                'id' => $giftRequest->id,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_role' => $user->rol,
                'message' => "🎁 Solicitud de regalo: {$gift->name}",
                'type' => 'gift_request',
                'created_at' => now()->toISOString(),
                'room_name' => $roomName,
                'context' => 'videochat',
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
                    'original_message' => $request->input('message', ''),
                    'context' => 'videochat'
                ]
            ];

            Log::info('✅ [VIDEOCHAT] Solicitud de regalo creada exitosamente', [
                'request_id' => $giftRequest->id,
                'modelo_id' => $user->id,
                'client_id' => $clientId,
                'gift_id' => $giftId,
                'amount' => $gift->price,
                'room_name' => $roomName
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Solicitud de regalo enviada exitosamente en videochat',
                'chat_message' => $chatMessage,
                'context' => 'videochat',
                'data' => [
                    'request_id' => $giftRequest->id,
                    'expires_at' => $giftRequest->expires_at->toISOString(),
                    'security_hash' => $securityData['hash'],
                    'room_name' => $roomName,
                    'gift' => [
                        'id' => $gift->id,
                        'name' => $gift->name,
                        'price' => $gift->price,
                        'image' => $gift->image_path
                    ],
                    'client' => [
                        'id' => $client->id,
                        'name' => $client->name
                    ],
                    'videochat_info' => [
                        'session_id' => $session->id,
                        'session_status' => $session->status
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('❌ [VIDEOCHAT] Error en solicitud de regalo', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'modelo_id' => $user->id ?? null,
                'client_id' => $request->input('client_id'),
                'gift_id' => $request->input('gift_id'),
                'room_name' => $request->input('room_name')
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'request_failed',
                'message' => 'Error interno al procesar la solicitud de regalo en videochat'
            ], 500);
        }
    }

    /**
     * 📋 CLIENTE ve sus solicitudes pendientes en videochat
     */
    public function getPendingRequests(Request $request)
    {
        try {
            $client = Auth::user();
            $roomName = $request->input('room_name');

            Log::info("🔍 [VIDEOCHAT] Cargando solicitudes pendientes", [
                'client_id' => $client->id,
                'room_name' => $roomName
            ]);

            // Verificar que es cliente
            if ($client->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo clientes pueden ver solicitudes de regalos'
                ], 403);
            }

            // Query base
            $query = GiftRequest::where('client_id', $client->id)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->with(['modelo', 'gift']);

            // Filtrar por sala si se especifica
            if ($roomName) {
                $query->where('room_name', $roomName);
            }

            $requests = $query->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($request) {
                    // 🔐 PARSEAR gift_data PARA OBTENER SECURITY HASH
                    $giftData = null;
                    $securityHash = null;
                    
                    if ($request->gift_data) {
                        try {
                            $giftData = json_decode($request->gift_data, true);
                            $securityHash = $giftData['security_hash'] ?? null;
                        } catch (\Exception $e) {
                            Log::warning("❌ [VIDEOCHAT] Error parseando gift_data para request {$request->id}");
                        }
                    }

                    // 🔐 GENERAR HASH SI NO EXISTE
                    if (!$securityHash) {
                        Log::info("🔑 [VIDEOCHAT] Generando security hash para request {$request->id}");
                        
                        $securityData = $this->generateVideoChatSecurityHash(
                            $request->modelo_id,
                            $request->client_id,
                            $request->gift_id,
                            $request->amount,
                            $request->room_name
                        );
                        
                        $securityHash = $securityData['hash'];
                        
                        // Actualizar gift_data
                        $updatedGiftData = array_merge($giftData ?? [], $securityData, [
                            'context' => 'videochat'
                        ]);
                        
                        $request->update([
                            'gift_data' => json_encode($updatedGiftData)
                        ]);
                    }

                    return [
                        'id' => $request->id,
                        'modelo_id' => $request->modelo_id,
                        'client_id' => $request->client_id,
                        'gift_id' => $request->gift_id,
                        'amount' => (int) $request->amount,
                        'message' => $request->message,
                        'room_name' => $request->room_name,
                        'status' => $request->status,
                        'expires_at' => $request->expires_at->toISOString(),
                        'created_at' => $request->created_at->toISOString(),
                        'updated_at' => $request->updated_at->toISOString(),
                        'context' => 'videochat',
                        
                        // 🔐 DATOS CRÍTICOS
                        'security_hash' => $securityHash,
                        'gift_data' => $giftData,
                        
                        // 🔗 RELACIONES
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
                        
                        // ⏱️ CAMPOS ADICIONALES
                        'requested_at' => $request->created_at->toISOString(),
                        'time_remaining' => now()->diffInSeconds($request->expires_at, false)
                    ];
                });

            Log::info("✅ [VIDEOCHAT] {$requests->count()} solicitudes formateadas", [
                'room_filter' => $roomName,
                'requests_with_hash' => $requests->filter(fn($req) => !empty($req['security_hash']))->count()
            ]);

            return response()->json([
                'success' => true,
                'requests' => $requests,
                'total_pending' => $requests->count(),
                'context' => 'videochat',
                'room_filter' => $roomName,
                'debug' => [
                    'user_id' => $client->id,
                    'timestamp' => now()->toISOString(),
                    'filtered_by_room' => !!$roomName
                ]
            ]);

        } catch (Exception $e) {
            Log::error('❌ [VIDEOCHAT] Error obteniendo solicitudes: ' . $e->getMessage(), [
                'user_id' => $client->id ?? null,
                'room_name' => $roomName ?? null
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener solicitudes de videochat'
            ], 500);
        }
    }

    /**
     * ✅ ACEPTAR REGALO EN VIDEOCHAT - MÉTODO COMPLETO CON VALIDACIÓN EXTREMA
     */
    public function acceptGiftRequest(Request $request, $requestId)
    {
        try {
            DB::beginTransaction();
            
            $user = Auth::user();
            $securityHash = $request->input('security_hash');
            
            // 🔥 CONVERTIR security_hash A STRING SI ES ARRAY
            if (is_array($securityHash)) {
                $securityHash = json_encode($securityHash);
            }
            $securityHash = (string) ($securityHash ?? '');
            
            Log::info("✅ [VIDEOCHAT] Cliente {$user->id} intentando aceptar regalo {$requestId}");
            Log::info("🔐 [VIDEOCHAT] Security hash recibido: " . ($securityHash ? 'SÍ (' . substr($securityHash, 0, 16) . '...)' : 'NO'));

            // 1. Verificar que sea cliente
            if (!$user || $user->rol !== 'cliente') {
                Log::error("❌ [VIDEOCHAT] Usuario no es cliente", ['user_id' => $user->id ?? null, 'role' => $user->rol ?? null]);
                return response()->json([
                    'success' => false,
                    'error' => 'Solo clientes pueden aceptar regalos en videochat'
                ], 403);
            }

            // 2. Buscar la solicitud de regalo específica de videochat
            $giftRequest = GiftRequest::where('id', $requestId)
                ->where('client_id', $user->id)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->with(['modelo', 'gift'])
                ->first();

            if (!$giftRequest) {
                Log::error("❌ [VIDEOCHAT] Solicitud no encontrada", [
                    'request_id' => $requestId,
                    'client_id' => $user->id
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_request',
                    'message' => 'La solicitud no existe, ya fue procesada o ha expirado'
                ], 404);
            }

            // 3. Verificar que la sesión de videochat sigue activa
            if ($giftRequest->room_name) {
                $activeSession = ChatSession::where('room_name', $giftRequest->room_name)
                    ->where('status', 'active')
                    ->where('cliente_id', $user->id)
                    ->where('modelo_id', $giftRequest->modelo_id)
                    ->first();

                if (!$activeSession) {
                    Log::warning("⚠️ [VIDEOCHAT] Sesión de videochat no activa", [
                        'room_name' => $giftRequest->room_name,
                        'client_id' => $user->id,
                        'modelo_id' => $giftRequest->modelo_id
                    ]);
                }
            }

            Log::info("📋 [VIDEOCHAT] Solicitud encontrada", [
                'request_id' => $requestId,
                'modelo_id' => $giftRequest->modelo_id,
                'gift_id' => $giftRequest->gift_id,
                'amount' => $giftRequest->amount,
                'room_name' => $giftRequest->room_name
            ]);

            // 4. Verificar que la modelo y el regalo son válidos
            if (!$giftRequest->modelo || $giftRequest->modelo->rol !== 'modelo') {
                Log::critical('❌ [VIDEOCHAT] FRAUDE: receptor no es modelo válida', [
                    'request_id' => $requestId,
                    'client_id' => $user->id,
                    'fake_modelo_id' => $giftRequest->modelo_id
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_modelo',
                    'message' => 'Error de validación de modelo'
                ], 400);
            }

            if (!$giftRequest->gift || !$giftRequest->gift->is_active) {
                return response()->json([
                    'success' => false,
                    'error' => 'invalid_gift',
                    'message' => 'El regalo ya no está disponible'
                ], 400);
            }

            // 5. 🚨 VALIDAR HASH DE SEGURIDAD ESPECÍFICO PARA VIDEOCHAT
            $giftData = null;
            $storedHash = null;
            
            if ($giftRequest->gift_data) {
                try {
                    $giftData = json_decode($giftRequest->gift_data, true);
                    $storedHash = $giftData['security_hash'] ?? null;
                } catch (\Exception $e) {
                    Log::error("❌ [VIDEOCHAT] Error parseando gift_data", ['error' => $e->getMessage()]);
                }
            }

            // 🔐 SI NO HAY HASH ALMACENADO, GENERARLO
            if (!$storedHash) {
                Log::warning("⚠️ [VIDEOCHAT] Security hash no encontrado - generando...");
                
                $securityData = $this->generateVideoChatSecurityHash(
                    $giftRequest->modelo_id,
                    $giftRequest->client_id,
                    $giftRequest->gift_id,
                    $giftRequest->amount,
                    $giftRequest->room_name
                );
                
                $storedHash = $securityData['hash'];
                
                // Actualizar gift_data
                $updatedGiftData = array_merge($giftData ?? [], $securityData);
                $giftRequest->update([
                    'gift_data' => json_encode($updatedGiftData)
                ]);
                
                Log::info("✅ [VIDEOCHAT] Security hash generado y almacenado");
            }

            // 🔐 COMPARAR HASHES
            if ($securityHash && $securityHash !== $storedHash) {
                Log::critical('❌ [VIDEOCHAT] FRAUDE: Hash de seguridad no coincide', [
                    'request_id' => $requestId,
                    'client_id' => $user->id,
                    'provided' => substr($securityHash, 0, 16) . '...',
                    'stored' => substr($storedHash, 0, 16) . '...'
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'security_violation', 
                    'message' => 'Error de validación de seguridad en videochat'
                ], 403);
            }

            // 🔐 SI NO SE PROPORCIONA HASH, USAR EL ALMACENADO
            if (!$securityHash) {
                Log::warning("⚠️ [VIDEOCHAT] No se proporcionó security_hash - usando hash almacenado");
                $securityHash = $storedHash;
            }

            // 6. 🔐 VERIFICAR Y BLOQUEAR SALDO (Prevenir doble gasto)
            $lockKey = "videochat_balance_lock_{$user->id}_{$requestId}";
            if (\Illuminate\Support\Facades\Cache::has($lockKey)) {
                return response()->json([
                    'success' => false,
                    'error' => 'already_processing',
                    'message' => 'Esta transacción de videochat ya se está procesando'
                ], 409);
            }

            // Crear lock temporal
            \Illuminate\Support\Facades\Cache::put($lockKey, true, 300); // 5 minutos

            // 7. 🔥 VERIFICAR SALDO DEL CLIENTE USANDO UserCoins (igual que sendDirectGift)
            $clientUserCoins = UserCoins::lockForUpdate()
                ->where('user_id', $user->id)
                ->first();

            if (!$clientUserCoins) {
                $clientUserCoins = UserCoins::create([
                    'user_id' => $user->id,
                    'purchased_balance' => 0,
                    'gift_balance' => 0,
                    'total_purchased' => 0,
                    'total_consumed' => 0
                ]);
            }

            // Validar que el cliente tiene suficientes `gift_balance` para este request
            $giftOnlyBalance = $clientUserCoins->gift_balance;

            if ($giftOnlyBalance < $giftRequest->amount) {
                \Illuminate\Support\Facades\Cache::forget($lockKey);
                
                Log::warning("❌ [VIDEOCHAT] Saldo de regalos insuficiente para request", [
                    'client_id' => $user->id,
                    'gift_balance' => $clientUserCoins->gift_balance,
                    'required' => $giftRequest->amount
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'insufficient_balance',
                    'message' => 'Saldo de regalos insuficiente para este request',
                    'data' => [
                        'current_gift_balance' => $giftOnlyBalance,
                        'required_amount' => $giftRequest->amount,
                        'missing_amount' => $giftRequest->amount - $giftOnlyBalance
                    ]
                ], 400);
            }

            // 8. 💰 PROCESAR TRANSACCIÓN ESPECÍFICA PARA VIDEOCHAT (igual que sendDirectGift)
            // Calcular balance total antes de procesar
            $totalBalance = $clientUserCoins->purchased_balance + $clientUserCoins->gift_balance;
            
            Log::info("💰 [VIDEOCHAT] Iniciando transacción", [
                'client_balance_before' => $totalBalance,
                'purchased_balance' => $clientUserCoins->purchased_balance,
                'gift_balance' => $clientUserCoins->gift_balance,
                'amount' => $giftRequest->amount,
                'room_name' => $giftRequest->room_name
            ]);
            
            // 1. Descontar exclusivamente de gift_balance
            $clientUserCoins->gift_balance -= $giftRequest->amount;
            $clientUserCoins->total_consumed += $giftRequest->amount;
            $clientUserCoins->last_consumption_at = now();
            $clientUserCoins->save();

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

            // 3. Calcular comisión (70% para la modelo, 30% para la plataforma)
            // Usar configuración dinámica de comisión
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

            // 6. Registrar la transacción específica para videochat
            $transactionId = DB::table('gift_transactions')->insertGetId([
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
                'transaction_type' => 'videochat_gift_accepted',
                'status' => 'completed',
                'source' => 'videochat_gift_system',
                'message' => "Regalo en videochat: {$giftRequest->gift->name}",
                'reference_id' => "VCG-{$giftRequest->id}",
                'room_name' => $giftRequest->room_name ?? '',
                'created_at' => now(),
                'updated_at' => now()
            ]);

            // 7. 💬 CREAR MENSAJES DE CHAT ESPECÍFICOS PARA VIDEOCHAT
            Log::info('💬 [VIDEOCHAT] Creando mensajes de chat específicos');

           try {
                // Mensaje para el cliente (SENDER)
                $clientMessage = ChatMessage::create([
                    'room_name' => $giftRequest->room_name,
                    'user_id' => $user->id,
                    'user_name' => $user->name ?? 'Cliente',
                    'user_role' => 'cliente',
                    'message' => "🎁 Enviaste: {$giftRequest->gift->name}",  // ← CAMBIAR ESTE TEXTO
                    'type' => 'gift_sent',
                    'extra_data' => json_encode([
                        'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                        'gift_image' => $giftRequest->gift->image_path,  // ← RUTA DIRECTA
                        'gift_price' => $giftRequest->amount ?? 0,
                        'client_name' => $user->name ?? 'Cliente',
                        'modelo_name' => $giftRequest->modelo->name ?? 'Modelo',
                        'transaction_id' => $giftRequest->id ?? 0,
                        'context' => 'videochat',
                        'room_name' => $giftRequest->room_name,
                        'action_text' => "Enviaste",  // ← AGREGAR ESTO
                        'recipient_name' => $giftRequest->modelo->name ?? 'Modelo'  // ← AGREGAR ESTO
                    ])
                ]);
                
                Log::info('✅ [VIDEOCHAT] Mensaje cliente creado ID: ' . $clientMessage->id);

            } catch (Exception $e) {
                Log::error('❌ [VIDEOCHAT] Error creando mensaje cliente: ' . $e->getMessage());
            }

            try {
                // Mensaje para la modelo (RECEIVER)
                $modeloMessage = ChatMessage::create([
                    'room_name' => $giftRequest->room_name,
                    'user_id' => $user->id,
                    'user_name' => $user->name ?? 'Cliente',
                    'user_role' => 'cliente',
                    'message' => "🎁 Recibiste: {$giftRequest->gift->name}",  // ← CAMBIAR ESTE TEXTO
                    'type' => 'gift_received',
                    'extra_data' => json_encode([
                        'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                        'gift_image' => $giftRequest->gift->image_path,  // ← RUTA DIRECTA
                        'gift_price' => $giftRequest->amount ?? 0,
                        'client_name' => $user->name ?? 'Cliente',
                        'modelo_name' => $giftRequest->modelo->name ?? 'Modelo',
                        'transaction_id' => $giftRequest->id ?? 0,
                        'context' => 'videochat',
                        'room_name' => $giftRequest->room_name,
                        'action_text' => "Recibiste de",  // ← AGREGAR ESTO
                        'sender_name' => $user->name ?? 'Cliente'  // ← AGREGAR ESTO
                    ])
                ]);
                
                Log::info('✅ [VIDEOCHAT] Mensaje modelo creado ID: ' . $modeloMessage->id);

            } catch (Exception $e) {
                Log::error('❌ [VIDEOCHAT] Error creando mensaje modelo: ' . $e->getMessage());
            }


           // 8. Limpiar lock
           \Illuminate\Support\Facades\Cache::forget($lockKey);

           // 9. Cancelar solicitudes duplicadas (usar 'rejected' ya que 'cancelled' no está en el enum)
           $duplicatesUpdated = GiftRequest::where('modelo_id', $giftRequest->modelo_id)
               ->where('client_id', $user->id)
               ->where('room_name', $giftRequest->room_name)
               ->where('status', 'pending')
               ->where('id', '!=', $requestId)
               ->where('created_at', '>', now()->subMinutes(5))
               ->update([
                   'status' => 'rejected', 
                   'rejection_reason' => 'duplicate_accepted_videochat',
                   'processed_at' => now()
               ]);

           if ($duplicatesUpdated > 0) {
               Log::info("🧹 [VIDEOCHAT] {$duplicatesUpdated} solicitudes duplicadas canceladas");
           }

           // 10. Procesar earnings específicos para videochat
           $earningsController = new \App\Http\Controllers\SessionEarningsController();
            $giftDetails = [
                'gift_id' => $giftRequest->gift_id,
                'gift_name' => $giftRequest->gift->name,
                'gift_image' => $giftRequest->gift->image_path,
                'gift_price' => $giftRequest->amount,
                'transaction_id' => $transactionId,
                'context' => 'videochat_request'
            ];

            $earningsController->processGiftEarnings(
                $giftRequest->modelo_id,     // modelUserId
                $user->id,                   // clientUserId
                $giftRequest->amount,        // giftValue
                $giftRequest->room_name,     // roomName
                $giftDetails                 // giftDetails
            );

            Log::info('✅ [UNIFICADO] Ganancias de regalo aceptado integradas', [
                'request_id' => $giftRequest->id,
                'transaction_id' => $transactionId,
                'modelo_id' => $giftRequest->modelo_id,
                'client_id' => $user->id,
                'amount' => $giftRequest->amount
            ]);

           Log::info('✅ [VIDEOCHAT] Regalo aceptado y procesado exitosamente', [
               'request_id' => $requestId,
               'client_id' => $user->id,
               'modelo_id' => $giftRequest->modelo_id,
               'gift_id' => $giftRequest->gift_id,
               'amount' => $giftRequest->amount,
               'modelo_received' => $modeloAmount,
               'platform_commission' => $platformCommission,
               'client_new_balance' => $clientUserCoins->fresh()->gift_balance,
               'room_name' => $giftRequest->room_name,
               'transaction_id' => $transactionId
           ]);

           DB::commit();

           return response()->json([
               'success' => true,
               'message' => '¡Regalo enviado exitosamente en videochat!',
               'context' => 'videochat',
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
                       'new_balance' => $clientUserCoins->fresh()->gift_balance,
                       'spent_amount' => $giftRequest->amount
                   ],
                   'transaction_details' => [
                       'processed_at' => now()->toISOString(),
                       'modelo_received' => $modeloAmount,
                       'platform_fee' => $platformCommission,
                       'room_name' => $giftRequest->room_name
                   ],
                   'chat_messages' => [
                       'client_message_created' => isset($clientMessage),
                       'modelo_message_created' => isset($modeloMessage)
                   ]
               ]
           ]);

       } catch (\Exception $e) {
           DB::rollBack();
           
           // Limpiar lock en caso de error
           if (isset($lockKey)) {
               \Illuminate\Support\Facades\Cache::forget($lockKey);
           }
           
           Log::error('❌ [VIDEOCHAT] Error al aceptar regalo', [
               'error' => $e->getMessage(),
               'trace' => $e->getTraceAsString(),
               'request_id' => $requestId,
               'client_id' => $user->id ?? null,
               'security_hash_provided' => $request->input('security_hash') ? 'SÍ' : 'NO'
           ]);
           
           return response()->json([
               'success' => false,
               'error' => 'processing_failed',
               'message' => config('app.debug') ? $e->getMessage() : 'Error interno al procesar el regalo en videochat'
           ], 500);
       }
   }

   /**
    * ❌ CLIENTE rechaza la solicitud en videochat
    */
   public function rejectGiftRequest(Request $request, $requestId)
   {
       try {
           $request->validate([
               'reason' => 'nullable|string|max:255'
           ]);

           $client = Auth::user();

           Log::info('❌ [VIDEOCHAT] Cliente rechazando solicitud', [
               'client_id' => $client->id,
               'request_id' => $requestId
           ]);

           // Verificar que es cliente
           if ($client->rol !== 'cliente') {
               return response()->json([
                   'success' => false,
                   'error' => 'Solo clientes pueden rechazar regalos en videochat'
               ], 403);
           }

           // Validar que el requestId existe en la base de datos
           $giftRequest = GiftRequest::where('id', $requestId)
               ->where('client_id', $client->id)
               ->where('status', 'pending')
               ->first();

           if (!$giftRequest) {
               return response()->json([
                   'success' => false,
                   'error' => 'Solicitud de videochat no encontrada'
               ], 404);
           }

           // Verificar que la sesión de videochat sigue activa
           if ($giftRequest->room_name) {
               $activeSession = ChatSession::where('room_name', $giftRequest->room_name)
                   ->where('status', 'active')
                   ->where('cliente_id', $client->id)
                   ->first();

               if (!$activeSession) {
                   Log::warning("⚠️ [VIDEOCHAT] Sesión no activa al rechazar regalo", [
                       'room_name' => $giftRequest->room_name
                   ]);
               }
           }

           $giftRequest->update([
               'status' => 'rejected',
               'processed_at' => now(),
               'rejection_reason' => $request->reason
           ]);

           // Crear mensaje de chat para el rechazo
           try {
               ChatMessage::create([
                   'room_name' => $giftRequest->room_name,
                   'user_id' => $client->id,
                   'user_name' => $client->name,
                   'user_role' => 'cliente',
                   'message' => "❌ Rechazó solicitud de regalo",
                   'type' => 'gift_rejected',
                   'extra_data' => json_encode([
                       'gift_name' => $giftRequest->gift->name ?? 'Regalo',
                       'reason' => $request->reason ?? 'Sin razón especificada',
                       'context' => 'videochat',
                       'room_name' => $giftRequest->room_name
                   ])
               ]);
           } catch (Exception $e) {
               Log::error('❌ [VIDEOCHAT] Error creando mensaje de rechazo: ' . $e->getMessage());
           }

           Log::info('✅ [VIDEOCHAT] Solicitud rechazada', [
               'request_id' => $requestId,
               'reason' => $request->reason,
               'room_name' => $giftRequest->room_name
           ]);

           return response()->json([
               'success' => true,
               'message' => 'Solicitud de regalo rechazada en videochat',
               'context' => 'videochat'
           ]);

       } catch (Exception $e) {
           Log::error('❌ [VIDEOCHAT] Error rechazando solicitud: ' . $e->getMessage());
           return response()->json([
               'success' => false,
               'error' => 'Error al rechazar solicitud de videochat'
           ], 500);
       }
   }

   /**
    * 💰 Obtener balance de coins del usuario para videochat
    */
   public function getUserBalance()
   {
       try {
           $user = Auth::user();
           
           // 🔥 USAR UserCoins EN LUGAR DE UserGiftCoins
           $userCoins = UserCoins::where('user_id', $user->id)->first();
           
           if (!$userCoins) {
               $userCoins = UserCoins::create([
                   'user_id' => $user->id,
                   'purchased_balance' => 0,
                   'gift_balance' => 0,
                   'total_purchased' => 0,
                   'total_consumed' => 0
               ]);
           }

           // Devolver balances separados: `purchased_balance` (minutos) y `gift_balance` (monedas para regalos)
           return response()->json([
               'success' => true,
               'balance' => $userCoins->gift_balance, // legacy: mostrar el balance de regalos
               'gift_balance' => $userCoins->gift_balance,
               'gift_balance_coins' => $userCoins->gift_balance,
               'purchased_balance' => $userCoins->purchased_balance,
               'total_balance' => $userCoins->purchased_balance + $userCoins->gift_balance,
               'total_consumed' => $userCoins->total_consumed,
               'user_role' => $user->rol,
               'context' => 'videochat'
           ]);

       } catch (\Exception $e) {
           Log::error('❌ [VIDEOCHAT] Error obteniendo balance: ' . $e->getMessage());
           return response()->json([
               'success' => false,
               'error' => 'Error obteniendo balance para videochat'
           ], 500);
       }
   }

   /**
    * 📊 Obtener historial de regalos para videochat
    */
   public function getGiftHistory(Request $request)
   {
       try {
           $user = Auth::user();
           $limit = $request->input('limit', 20);
           $roomName = $request->input('room_name');

           $query = GiftTransaction::where(function($query) use ($user) {
               $query->where('sender_id', $user->id)
                     ->orWhere('receiver_id', $user->id);
           })
           ->where('source', 'videochat_gift_system')
           ->with(['sender', 'receiver']);

           // Filtrar por sala específica si se proporciona
           if ($roomName) {
               $query->where('room_name', $roomName);
           }

           $transactions = $query->leftJoin('gifts', 'gift_transactions.gift_id', '=', 'gifts.id')
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
                       'sent_at' => $transaction->created_at->toISOString(),
                       'context' => 'videochat'
                   ];
               });

           return response()->json([
               'success' => true,
               'history' => $transactions,
               'total_sent' => GiftTransaction::where('sender_id', $user->id)
                   ->where('source', 'videochat_gift_system')
                   ->sum('amount'),
               'total_received' => GiftTransaction::where('receiver_id', $user->id)
                   ->where('source', 'videochat_gift_system')
                   ->sum('amount'),
               'context' => 'videochat',
               'room_filter' => $roomName
           ]);

       } catch (Exception $e) {
           Log::error('❌ [VIDEOCHAT] Error obteniendo historial: ' . $e->getMessage());
           return response()->json([
               'success' => false,
               'error' => 'Error al obtener historial de videochat'
           ], 500);
       }
   }

   /**
    * 🔄 Limpiar solicitudes expiradas de videochat
    */
   public function cleanExpiredRequests()
   {
       try {
           $expiredCount = GiftRequest::where('status', 'pending')
               ->where('expires_at', '<', now())
               ->whereNotNull('room_name') // Solo solicitudes de videochat
               ->update([
                   'status' => 'expired',
                   'processed_at' => now()
               ]);

           Log::info('🧹 [VIDEOCHAT] Solicitudes expiradas limpiadas', [
               'expired_count' => $expiredCount
           ]);

           return response()->json([
               'success' => true,
               'expired_requests' => $expiredCount,
               'context' => 'videochat'
           ]);

       } catch (Exception $e) {
           Log::error('❌ [VIDEOCHAT] Error limpiando solicitudes: ' . $e->getMessage());
           return response()->json([
               'success' => false,
               'error' => 'Error al limpiar solicitudes de videochat'
           ], 500);
       }
   }

   // ========================= MÉTODOS PRIVADOS ESPECÍFICOS PARA VIDEOCHAT =========================

   /**
    * 🔐 GENERAR HASH DE SEGURIDAD ESPECÍFICO PARA VIDEOCHAT
    */
   private function generateVideoChatSecurityHash($modeloId, $clientId, $giftId, $amount, $roomName)
   {
       $timestamp = time();
       $nonce = bin2hex(random_bytes(16));
       $sessionId = 'videochat_' . $roomName . '_' . $timestamp;
       $ip = request()->ip();
       
       // Data específica para videochat con room_name como factor crítico
       $data = [
           $modeloId,
           $clientId,
           $giftId,
           $amount,
           $roomName, // ← Factor específico de videochat
           $timestamp,
           $nonce,
           $sessionId,
           'videochat_context',
           env('APP_KEY', 'default-key')
       ];
       
       $hash = hash('sha256', implode('|', $data));
       $integrityHash = hash('sha256', implode('|', array_merge($data, [$hash])));
       
       return [
           'hash' => $hash,
           'timestamp' => $timestamp,
           'nonce' => $nonce,
           'expires_at' => $timestamp + 900, // 15 minutos
           'session_id' => $sessionId,
           'ip' => $ip,
           'integrity_hash' => $integrityHash,
           'context' => 'videochat',
           'room_name' => $roomName
       ];
   }


   /**
    * 💱 Calcular USD desde gift coins (específico para videochat)
    */
   private function calculateUSDFromGiftCoins($giftCoins)
   {
       try {
           $averageCostPerCoin = $this->getAverageCoinCost();
           return round($giftCoins * $averageCostPerCoin, 2);

       } catch (Exception $e) {
           Log::error('❌ [VIDEOCHAT] Error calculando USD: ' . $e->getMessage());
           return round($giftCoins * 0.15, 2); // Fallback específico para videochat
       }
   }

   /**
    * 💰 Obtener costo promedio por coin
    */
   private function getAverageCoinCost()
   {
       try {
           $packages = \App\Models\CoinPackage::where('is_active', true)
               ->where('type', 'gifts') // Específico para regalos
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
           Log::error('❌ [VIDEOCHAT] Error obteniendo costo promedio: ' . $e->getMessage());
           return 0.15; // Fallback
       }
   }

   /**
    * 🛠️ Obtener o crear registro de coins de regalo para videochat
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
           Log::error('❌ [VIDEOCHAT] Error obteniendo UserGiftCoins: ' . $e->getMessage());
           throw $e;
       }
   }

   /**
    * 🔐 Método público para generar hash (para testing/debugging)
    */
   public function generateSecurityHash($modeloId, $clientId, $giftId, $amount, $roomName): array
   {
       return $this->generateVideoChatSecurityHash($modeloId, $clientId, $giftId, $amount, $roomName);
   }
}