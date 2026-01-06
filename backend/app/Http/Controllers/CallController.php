<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ChatSession;
use App\Models\User;
use App\Models\UserNickname;
use App\Models\UserCoins;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\ProfileSettingsController;
use App\Helpers\VideoChatLogger;
use Firebase\JWT\JWT;

class CallController extends Controller
{
    /**
     * 📞 INICIAR LLAMADA A USUARIO ESPECÍFICO
     */
    public function startCall(Request $request)
    {
        try {
            $request->validate([
                'receiver_id' => 'nullable|integer|exists:users,id',
                'modelo_ids' => 'nullable|array|size:2',
                'modelo_ids.*' => 'integer|exists:users,id',
                'call_type' => 'required|string|in:video,audio'
            ]);

            // 🔥 BLOQUEAR LLAMADAS 2VS1 EN PRODUCCIÓN
            if ($request->has('modelo_ids') && is_array($request->modelo_ids) && count($request->modelo_ids) === 2) {
                $appEnv = config('app.env');
                if ($appEnv === 'production') {
                    Log::warning('🚫 [CALL] Intento de llamada 2vs1 bloqueada en producción', [
                        'caller_id' => auth()->id(),
                        'modelo_ids' => $request->modelo_ids
                    ]);
                    
                    return response()->json([
                        'success' => false,
                        'error' => 'La función 2vs1 no está disponible temporalmente',
                        'message' => 'Esta función está deshabilitada por mantenimiento'
                    ], 503);
                }
            }

            // Validar que al menos uno de los dos parámetros esté presente
            if (!$request->has('receiver_id') && !$request->has('modelo_ids')) {
                return response()->json([
                    'success' => false,
                    'error' => 'Debe proporcionar receiver_id o modelo_ids'
                ], 400);
            }

            $caller = auth()->user();
            $receiverId = $request->receiver_id;
            $modeloIds = $request->modelo_ids;
            $callType = $request->call_type;

            // Determinar si es llamada con 2 modelos
            $isDualModelCall = !is_null($modeloIds) && count($modeloIds) === 2;

            // 🔥 LÓGICA PARA LLAMADAS CON 2 MODELOS
            if ($isDualModelCall) {
                Log::info('📞 [CALL] Iniciando llamada con 2 modelos', [
                    'caller_id' => $caller->id,
                    'modelo1_id' => $modeloIds[0],
                    'modelo2_id' => $modeloIds[1],
                    'call_type' => $callType
                ]);

                // Validar que el caller sea cliente
                if ($caller->rol !== 'cliente') {
                    return response()->json([
                        'success' => false,
                        'error' => 'Solo clientes pueden iniciar llamadas con 2 modelos'
                    ], 403);
                }

                // Validar que ambos modelos existen y son modelos
                $modelo1 = User::find($modeloIds[0]);
                $modelo2 = User::find($modeloIds[1]);

                if (!$modelo1 || !$modelo2) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Uno o ambos modelos no encontrados'
                    ], 404);
                }

                if ($modelo1->rol !== 'modelo' || $modelo2->rol !== 'modelo') {
                    return response()->json([
                        'success' => false,
                        'error' => 'Ambos participantes deben ser modelos'
                    ], 400);
                }

                // Validar que los modelos sean diferentes
                if ($modeloIds[0] === $modeloIds[1]) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Los modelos deben ser diferentes'
                    ], 400);
                }

                // Validar disponibilidad de ambos modelos
                $activeCall1 = ChatSession::where(function($query) use ($modeloIds) {
                    $query->where('cliente_id', $modeloIds[0])
                          ->orWhere('modelo_id', $modeloIds[0])
                          ->orWhere('modelo_id_2', $modeloIds[0]);
                })
                ->whereIn('status', ['calling', 'active'])
                ->where('session_type', 'call')
                ->first();

                $activeCall2 = ChatSession::where(function($query) use ($modeloIds) {
                    $query->where('cliente_id', $modeloIds[1])
                          ->orWhere('modelo_id', $modeloIds[1])
                          ->orWhere('modelo_id_2', $modeloIds[1]);
                })
                ->whereIn('status', ['calling', 'active'])
                ->where('session_type', 'call')
                ->first();

                if ($activeCall1 || $activeCall2) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Uno o ambos modelos no están disponibles'
                    ], 400);
                }

                // Validar bloqueos mutuos con ambos modelos
                $bloqueadoConModelo1 = DB::table('user_blocks')
                    ->where(function($query) use ($caller, $modeloIds) {
                        $query->where('user_id', $caller->id)->where('blocked_user_id', $modeloIds[0])
                              ->orWhere('user_id', $modeloIds[0])->where('blocked_user_id', $caller->id);
                    })
                    ->where('is_active', true)
                    ->exists();

                $bloqueadoConModelo2 = DB::table('user_blocks')
                    ->where(function($query) use ($caller, $modeloIds) {
                        $query->where('user_id', $caller->id)->where('blocked_user_id', $modeloIds[1])
                              ->orWhere('user_id', $modeloIds[1])->where('blocked_user_id', $caller->id);
                    })
                    ->where('is_active', true)
                    ->exists();

                if ($bloqueadoConModelo1 || $bloqueadoConModelo2) {
                    return response()->json([
                        'success' => false,
                        'error' => 'No puedes iniciar una llamada con uno o ambos modelos'
                    ], 403);
                }

                // Validar saldo suficiente para doble costo
                $minimumBalance = 60; // 60 monedas = 6 minutos (doble costo)
                $userCoins = UserCoins::firstOrCreate(
                    ['user_id' => $caller->id],
                    ['purchased_balance' => 0, 'gift_balance' => 0]
                );

                if ($userCoins->purchased_balance < $minimumBalance) {
                    $deficit = $minimumBalance - $userCoins->purchased_balance;
                    Log::warning('💰 [CALL] Cliente sin saldo suficiente para llamada con 2 modelos', [
                        'caller_id' => $caller->id,
                        'purchased_balance' => $userCoins->purchased_balance,
                        'minimum_required' => $minimumBalance,
                        'deficit' => $deficit
                    ]);

                    return response()->json([
                        'success' => false,
                        'error' => 'Saldo insuficiente para llamada con 2 modelos',
                        'current_balance' => $userCoins->purchased_balance,
                        'minimum_required' => $minimumBalance,
                        'deficit' => $deficit,
                        'deficit_minutes' => ceil($deficit / 10),
                        'action_required' => 'recharge'
                    ], 402);
                }

                // Cancelar llamadas activas previas del caller
                $callerActiveCalls = ChatSession::where(function($query) use ($caller) {
                    $query->where('cliente_id', $caller->id)
                          ->orWhere('modelo_id', $caller->id);
                })
                ->whereIn('status', ['calling', 'active'])
                ->where('session_type', 'call')
                ->get();

                foreach ($callerActiveCalls as $activeCall) {
                    $activeCall->update([
                        'status' => 'cancelled',
                        'ended_at' => now(),
                        'end_reason' => 'replaced_by_new_call'
                    ]);

                    Log::info('🔄 [CALL] Llamada previa cancelada automáticamente', [
                        'old_call_id' => $activeCall->id,
                        'caller_id' => $caller->id
                    ]);
                }

                // Crear room_name único con ambos modelos
                $roomName = "call_" . $caller->id . "_" . $modeloIds[0] . "_" . $modeloIds[1] . "_" . time();

                // Crear ChatSession para llamada con 2 modelos
                DB::beginTransaction();
                try {
                    $sessionData = [
                        'room_name' => $roomName,
                        'session_type' => 'call',
                        'call_type' => $callType,
                        'status' => 'calling',
                        'started_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                        'caller_id' => $caller->id,
                        'cliente_id' => $caller->id,
                        'modelo_id' => $modeloIds[0],
                        'modelo_id_2' => $modeloIds[1],
                        'modelo_2_invited_at' => now(),
                        'modelo_2_status' => 'pending'
                    ];

                    $call = ChatSession::create($sessionData);

                    DB::commit();

                    Log::info('✅ [CALL] Llamada con 2 modelos creada', [
                        'call_id' => $call->id,
                        'room_name' => $roomName,
                        'caller' => $caller->name,
                        'modelo1' => $modelo1->name,
                        'modelo2' => $modelo2->name,
                        'started_at' => $call->started_at ? $call->started_at->toDateTimeString() : 'NULL',
                        'status' => $call->status
                    ]);

                } catch (\Exception $e) {
                    DB::rollback();
                    throw $e;
                }

                // Enviar notificaciones a AMBOS modelos
                // Notificación para modelo1
                DB::table('notifications')->insert([
                    'user_id' => $modeloIds[0],
                    'type' => 'call_incoming',
                    'data' => json_encode([
                        'message' => 'Tienes una llamada entrante',
                        'call_id' => $call->id,
                        'room_name' => $roomName,
                        'caller' => [
                            'id' => $caller->id,
                            'name' => $caller->name,
                            'avatar' => $caller->avatar ?? null
                        ],
                        'call_type' => $callType,
                        'is_dual_model_call' => true,
                        'other_model' => [
                            'id' => $modelo2->id,
                            'name' => $modelo2->name,
                            'avatar' => $modelo2->avatar ?? null
                        ]
                    ]),
                    'read' => false,
                    'expires_at' => now()->addMinutes(5),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);

                // Notificación para modelo2
                DB::table('notifications')->insert([
                    'user_id' => $modeloIds[1],
                    'type' => 'second_model_invitation',
                    'data' => json_encode([
                        'call_id' => $call->id,
                        'cliente' => [
                            'id' => $caller->id,
                            'name' => $caller->name,
                            'avatar' => $caller->avatar ?? null
                        ],
                        'modelo1' => [
                            'id' => $modelo1->id,
                            'name' => $modelo1->name,
                            'avatar' => $modelo1->avatar ?? null
                        ],
                        'room_name' => $roomName,
                        'message' => 'Tienes una invitación para unirte a una llamada existente'
                    ]),
                    'read' => false,
                    'expires_at' => now()->addMinutes(5),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);

                return response()->json([
                    'success' => true,
                    'call_id' => $call->id,
                    'room_name' => $roomName,
                    'status' => 'calling',
                    'modelos' => [
                        [
                            'id' => $modelo1->id,
                            'name' => $modelo1->name,
                            'avatar' => $modelo1->avatar ?? null,
                            'status' => 'pending'
                        ],
                        [
                            'id' => $modelo2->id,
                            'name' => $modelo2->name,
                            'avatar' => $modelo2->avatar ?? null,
                            'status' => 'pending'
                        ]
                    ],
                    'message' => 'Llamada con 2 modelos iniciada, esperando respuestas...'
                ]);

            }

            // 🔥 LÓGICA PARA LLAMADAS NORMALES (1vs1) - CONTINÚA ABAJO
            // ❌ VALIDAR BLOQUEOS MUTUOS - CORREGIDO
            $bloqueadoPorCaller = DB::table('user_blocks')
                ->where('user_id', $caller->id)
                ->where('blocked_user_id', $receiverId)
                ->where('is_active', true)
                ->exists();

            $bloqueadoPorReceiver = DB::table('user_blocks')
                ->where('user_id', $receiverId)
                ->where('blocked_user_id', $caller->id)
                ->where('is_active', true)
                ->exists();

            if ($bloqueadoPorCaller || $bloqueadoPorReceiver) {
                Log::warning('🚫 [CALL] Llamada bloqueada', [
                    'caller_id' => $caller->id,
                    'receiver_id' => $receiverId,
                    'blocked_by_caller' => $bloqueadoPorCaller,
                    'blocked_by_receiver' => $bloqueadoPorReceiver
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'No puedes iniciar una llamada con este usuario'
                ], 403);
            }

            Log::info('📞 [CALL] Iniciando llamada', [
                'caller_id' => $caller->id,
                'caller_name' => $caller->name,
                'receiver_id' => $receiverId,
                'call_type' => $callType
            ]);

            // 🔥 VERIFICACIONES PREVIAS
            if ($caller->id == $receiverId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No puedes llamarte a ti mismo'
                ], 400);
            }

            $receiver = User::find($receiverId);
            if (!$receiver) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no encontrado'
                ], 404);
            }

            // 💰 VALIDAR SALDO MÍNIMO PARA CLIENTES (30 monedas = 3 minutos)
            // Si el caller es cliente, validar su saldo
            if ($caller->rol === 'cliente') {
                $minimumBalance = 30; // 30 monedas = 3 minutos (más de 2 minutos requeridos)
                $userCoins = UserCoins::firstOrCreate(
                    ['user_id' => $caller->id],
                    ['purchased_balance' => 0, 'gift_balance' => 0]
                );
                
                if ($userCoins->purchased_balance < $minimumBalance) {
                    $deficit = $minimumBalance - $userCoins->purchased_balance;
                    Log::warning('💰 [CALL] Cliente sin saldo suficiente para iniciar llamada', [
                        'caller_id' => $caller->id,
                        'purchased_balance' => $userCoins->purchased_balance,
                        'minimum_required' => $minimumBalance,
                        'deficit' => $deficit
                    ]);
                    
                    return response()->json([
                        'success' => false,
                        'error' => 'Saldo insuficiente para iniciar videollamada',
                        'current_balance' => $userCoins->purchased_balance,
                        'minimum_required' => $minimumBalance,
                        'deficit' => $deficit,
                        'deficit_minutes' => ceil($deficit / 10), // 10 monedas por minuto
                        'action_required' => 'recharge'
                    ], 402);
                }
            }

            // 💰 VALIDAR SALDO DEL CLIENTE SI LA MODELO LO ESTÁ LLAMANDO
            // Si el caller es modelo y el receiver es cliente, validar saldo del cliente
            // El cliente debe tener MÁS de 2 minutos (más de 20 monedas) para recibir llamadas
            if ($caller->rol === 'modelo' && $receiver->rol === 'cliente') {
                $minimumBalanceForCall = 21; // Más de 20 monedas (más de 2 minutos) = al menos 21 monedas
                $clientCoins = UserCoins::firstOrCreate(
                    ['user_id' => $receiverId],
                    ['purchased_balance' => 0, 'gift_balance' => 0]
                );
                
                // Verificar si el cliente tiene <= 20 monedas (2 minutos o menos) - NO permitir llamada
                if ($clientCoins->purchased_balance <= 20) {
                    $minutesAvailable = floor($clientCoins->purchased_balance / 10);
                    Log::warning('💰 [CALL] Modelo intentó llamar a cliente sin saldo suficiente (<= 2 minutos)', [
                        'modelo_id' => $caller->id,
                        'cliente_id' => $receiverId,
                        'cliente_purchased_balance' => $clientCoins->purchased_balance,
                        'minutes_available' => $minutesAvailable,
                        'minimum_required' => $minimumBalanceForCall
                    ]);
                    
                    return response()->json([
                        'success' => false,
                        'error' => 'Este cliente tiene saldo insuficiente',
                        'message' => 'Este cliente tiene saldo insuficiente para realizar videollamadas',
                        'client_balance' => $clientCoins->purchased_balance,
                        'client_minutes' => $minutesAvailable,
                        'minimum_required' => $minimumBalanceForCall,
                        'deficit' => $minimumBalanceForCall - $clientCoins->purchased_balance
                    ], 402);
                }
            }

            // Verificar y cancelar automáticamente llamadas activas previas del caller
            $callerActiveCalls = ChatSession::where(function($query) use ($caller) {
                $query->where('cliente_id', $caller->id)
                      ->orWhere('modelo_id', $caller->id);
            })
            ->whereIn('status', ['calling', 'active'])
            ->where('session_type', 'call')
            ->get();

            // Cancelar automáticamente llamadas activas previas
            foreach ($callerActiveCalls as $activeCall) {
                $activeCall->update([
                    'status' => 'cancelled',
                    'ended_at' => now(),
                    'end_reason' => 'replaced_by_new_call'
                ]);
                
                Log::info('🔄 [CALL] Llamada previa cancelada automáticamente', [
                    'old_call_id' => $activeCall->id,
                    'caller_id' => $caller->id
                ]);
            }

            // 🔥 REMOVIDO: Permitir llamadas incluso si el receiver está en otra llamada
            // Las personas pueden recibir múltiples llamadas y decidir cuál contestar
            // La lógica de cancelar la llamada anterior se maneja cuando aceptan la nueva

            // 🔥 CREAR ROOM NAME ÚNICO
            $roomName = "call_" . $caller->id . "_" . $receiverId . "_" . time();

            // 🔥 CREAR REGISTRO DE LLAMADA
            DB::beginTransaction();
            try {
                // 🔥 NUEVA LÓGICA SIMPLIFICADA: Usar caller_id explícito
                $sessionData = [
                    'room_name' => $roomName,
                    'session_type' => 'call',
                    'call_type' => $callType,
                    'status' => 'calling',
                    'started_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                    'caller_id' => $caller->id, // 🔥 NUEVO: Caller explícito
                ];

                // Asignar cliente_id y modelo_id según los roles
                // Esto se mantiene para compatibilidad con el resto del sistema
                if ($caller->rol === 'cliente') {
                    $sessionData['cliente_id'] = $caller->id;
                    $sessionData['modelo_id'] = $receiverId;
                } else {
                    // Si el caller es modelo, invertir
                    $sessionData['cliente_id'] = $receiverId;  
                    $sessionData['modelo_id'] = $caller->id;
                }

                $call = ChatSession::create($sessionData);

                DB::commit();

                Log::info('✅ [CALL] Llamada creada', [
                    'call_id' => $call->id,
                    'room_name' => $roomName,
                    'caller' => $caller->name,
                    'receiver' => $receiver->name,
                    'cliente_id' => $call->cliente_id,
                    'modelo_id' => $call->modelo_id,
                    'started_at' => $call->started_at ? $call->started_at->toDateTimeString() : 'NULL',
                    'status' => $call->status
                ]);

            } catch (\Exception $e) {
                DB::rollback();
                throw $e;
            }

            // 🔥 AQUÍ PODRÍAS ENVIAR NOTIFICACIÓN AL RECEIVER
            // (pusher, websockets, etc.)

            return response()->json([
                'success' => true,
                'call_id' => $call->id,
                'room_name' => $roomName,
                'status' => 'calling',
                'receiver' => [
                    'id' => $receiver->id,
                    'name' => $receiver->name,
                    'avatar' => $receiver->avatar ?? null
                ],
                'message' => 'Llamada iniciada, esperando respuesta...'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CALL] Error iniciando llamada', [
                'error' => $e->getMessage(),
                'caller_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error iniciando llamada: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 📱 RESPONDER LLAMADA (ACEPTAR/RECHAZAR)
     */
    public function answerCall(Request $request)
    {
        VideoChatLogger::start('ANSWER_CALL', 'Modelo respondiendo llamada');
        VideoChatLogger::request('ANSWER_CALL', $request);
        
        try {
            $request->validate([
                'call_id' => 'required|integer|exists:chat_sessions,id',
                'action' => 'required|string|in:accept,reject'
            ]);

            $user = auth()->user();
            $callId = $request->call_id;
            $action = $request->action;

            VideoChatLogger::log('ANSWER_CALL', 'Validación pasada', [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'user_name' => $user->name,
                'call_id' => $callId,
                'action' => $action,
                'is_modelo' => $user->rol === 'modelo'
            ]);

            Log::info('📱 [CALL] Respondiendo llamada', [
                'user_id' => $user->id,
                'call_id' => $callId,
                'action' => $action
            ]);

            $call = ChatSession::find($callId);
            
            VideoChatLogger::log('ANSWER_CALL', 'Llamada buscada en BD', [
                'call_id' => $callId,
                'call_found' => $call !== null,
                'call_session_type' => $call?->session_type,
                'call_status' => $call?->status,
                'call_cliente_id' => $call?->cliente_id,
                'call_modelo_id' => $call?->modelo_id,
                'call_caller_id' => $call?->caller_id,
                'call_room_name' => $call?->room_name,
            ]);
            
            if (!$call || $call->session_type !== 'call') {
                VideoChatLogger::error('ANSWER_CALL', 'Llamada no encontrada o tipo incorrecto', [
                    'call_id' => $callId,
                    'call_exists' => $call !== null,
                    'session_type' => $call?->session_type
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Llamada no encontrada'
                ], 404);
            }

            // Verificar que el usuario sea un receiver válido (cliente_id, modelo_id o modelo_id_2)
            $isReceiver = ($call->cliente_id === $user->id) || ($call->modelo_id === $user->id);
            $isSecondModel = $call->modelo_id_2 === $user->id;

            VideoChatLogger::log('ANSWER_CALL', 'Verificación de receiver', [
                'user_id' => $user->id,
                'call_cliente_id' => $call->cliente_id,
                'call_modelo_id' => $call->modelo_id,
                'call_modelo_id_2' => $call->modelo_id_2,
                'is_receiver' => $isReceiver,
                'is_second_model' => $isSecondModel,
                'user_is_cliente' => $call->cliente_id === $user->id,
                'user_is_modelo' => $call->modelo_id === $user->id,
                'user_is_second_model' => $call->modelo_id_2 === $user->id,
            ]);

            if (!$isReceiver && !$isSecondModel) {
                VideoChatLogger::error('ANSWER_CALL', 'Usuario no autorizado para responder', [
                    'user_id' => $user->id,
                    'call_cliente_id' => $call->cliente_id,
                    'call_modelo_id' => $call->modelo_id,
                    'call_modelo_id_2' => $call->modelo_id_2,
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'No autorizado para responder esta llamada'
                ], 403);
            }

            // 🔥 LÓGICA ESPECIAL PARA SEGUNDO MODELO
            if ($isSecondModel) {
                VideoChatLogger::log('ANSWER_CALL', 'Procesando respuesta de segundo modelo', [
                    'user_id' => $user->id,
                    'call_id' => $call->id,
                    'modelo_2_status' => $call->modelo_2_status,
                    'action' => $action
                ]);

                // Validar que la invitación esté pendiente
                if ($call->modelo_2_status !== 'pending') {
                    VideoChatLogger::error('ANSWER_CALL', 'Invitación de segundo modelo no está pendiente', [
                        'call_id' => $call->id,
                        'modelo_2_status' => $call->modelo_2_status,
                        'expected' => 'pending'
                    ]);

                    return response()->json([
                        'success' => false,
                        'error' => 'Esta invitación ya no está disponible'
                    ], 409);
                }

                if ($action === 'accept') {
                    // Aceptar invitación de segundo modelo
                    $call->update([
                        'modelo_2_status' => 'accepted',
                        'modelo_2_answered_at' => now()
                    ]);

                    VideoChatLogger::log('ANSWER_CALL', 'Segundo modelo aceptó invitación', [
                        'call_id' => $call->id,
                        'modelo2_id' => $user->id,
                        'modelo2_name' => $user->name
                    ]);

                    // Generar token LiveKit para unirse a la room existente
                    try {
                        // 🔥 GENERAR TOKEN DIRECTAMENTE sin usar generateToken (evita problemas de validación)
                        $roomName = preg_replace('/\s+/', '', trim($call->room_name));
                        $participantName = "user_{$user->id}_{$user->rol}";
                        
                        // Obtener credenciales LiveKit
                        $apiKey = config('livekit.api_key');
                        $apiSecret = config('livekit.api_secret');
                        $serverUrl = config('livekit.ws_url');
                        
                        if (!$apiKey || !$apiSecret || !$serverUrl) {
                            throw new \Exception('Faltan credenciales de LiveKit en .env');
                        }
                        
                        // Crear payload del JWT
                        $now = time();
                        $payload = [
                            'iss' => $apiKey,
                            'sub' => $participantName,
                            'iat' => $now,
                            'exp' => $now + 3600,
                            'video' => [
                                'room' => $roomName,
                                'roomJoin' => true,
                                'canPublish' => true,
                                'canSubscribe' => true,
                                'canPublishData' => true
                            ]
                        ];
                        
                        // Generar token JWT
                        $liveKitToken = \Firebase\JWT\JWT::encode($payload, $apiSecret, 'HS256');
                        
                        Log::info('✅ [CALL] Token LiveKit generado exitosamente para segundo modelo', [
                            'call_id' => $call->id,
                            'modelo2_id' => $user->id,
                            'room_name' => $call->room_name
                        ]);

                    } catch (\Exception $e) {
                        Log::error('❌ [CALL] Error generando token LiveKit para segundo modelo', [
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                            'call_id' => $call->id,
                            'modelo2_id' => $user->id,
                            'room_name' => $call->room_name ?? 'N/A'
                        ]);
                        
                        VideoChatLogger::error('ANSWER_CALL', 'Error generando token LiveKit para segundo modelo', [
                            'error' => $e->getMessage(),
                            'call_id' => $call->id,
                            'modelo2_id' => $user->id
                        ]);

                        return response()->json([
                            'success' => false,
                            'error' => 'Error generando token de acceso: ' . $e->getMessage()
                        ], 500);
                    }

                    // Notificar al cliente y modelo1 que el segundo modelo se unió
                    $cliente = User::find($call->cliente_id);
                    $modelo1 = User::find($call->modelo_id);

                    if ($cliente) {
                        DB::table('notifications')->insert([
                            'user_id' => $cliente->id,
                            'type' => 'second_model_joined',
                            'data' => json_encode([
                                'message' => $user->name . ' se ha unido a la llamada',
                                'call_id' => $call->id,
                                'room_name' => $call->room_name,
                                'modelo2' => [
                                    'id' => $user->id,
                                    'name' => $user->name,
                                    'avatar' => $user->avatar ?? null
                                ]
                            ]),
                            'read' => false,
                            'expires_at' => now()->addMinutes(5),
                            'created_at' => now(),
                            'updated_at' => now()
                        ]);
                    }

                    if ($modelo1) {
                        DB::table('notifications')->insert([
                            'user_id' => $modelo1->id,
                            'type' => 'second_model_joined',
                            'data' => json_encode([
                                'message' => $user->name . ' se ha unido a la llamada',
                                'call_id' => $call->id,
                                'room_name' => $call->room_name,
                                'modelo2' => [
                                    'id' => $user->id,
                                    'name' => $user->name,
                                    'avatar' => $user->avatar ?? null
                                ]
                            ]),
                            'read' => false,
                            'expires_at' => now()->addMinutes(5),
                            'created_at' => now(),
                            'updated_at' => now()
                        ]);
                    }

                    VideoChatLogger::log('ANSWER_CALL', 'Segundo modelo se unió exitosamente', [
                        'call_id' => $call->id,
                        'modelo2_id' => $user->id,
                        'cliente_notificado' => $cliente ? true : false,
                        'modelo1_notificado' => $modelo1 ? true : false
                    ]);

                    $responseData = [
                        'success' => true,
                        'action' => 'accepted',
                        'call_id' => $call->id,
                        'room_name' => $call->room_name,
                        'token' => $liveKitToken,
                        'is_second_model' => true,
                        'otros_participantes' => [
                            'cliente' => $cliente ? [
                                'id' => $cliente->id,
                                'name' => $cliente->name,
                                'avatar' => $cliente->avatar ?? null
                            ] : null,
                            'modelo1' => $modelo1 ? [
                                'id' => $modelo1->id,
                                'name' => $modelo1->name,
                                'avatar' => $modelo1->avatar ?? null
                            ] : null
                        ],
                        'message' => 'Te has unido a la llamada'
                    ];

                    VideoChatLogger::end('ANSWER_CALL', 'Segundo modelo aceptó invitación exitosamente', [
                        'call_id' => $call->id,
                        'modelo2' => $user->name,
                        'response_data' => $responseData,
                    ]);

                    return response()->json($responseData);

                } else {
                    // Rechazar invitación de segundo modelo
                    $call->update([
                        'modelo_2_status' => 'rejected'
                    ]);

                    VideoChatLogger::log('ANSWER_CALL', 'Segundo modelo rechazó invitación', [
                        'call_id' => $call->id,
                        'modelo2_id' => $user->id,
                        'modelo2_name' => $user->name
                    ]);

                    // Notificar al cliente que el segundo modelo rechazó
                    $cliente = User::find($call->cliente_id);
                    if ($cliente) {
                        DB::table('notifications')->insert([
                            'user_id' => $cliente->id,
                            'type' => 'second_model_rejected',
                            'data' => json_encode([
                                'message' => $user->name . ' rechazó la invitación',
                                'call_id' => $call->id,
                                'modelo2' => [
                                    'id' => $user->id,
                                    'name' => $user->name,
                                    'avatar' => $user->avatar ?? null
                                ]
                            ]),
                            'read' => false,
                            'expires_at' => now()->addMinutes(5),
                            'created_at' => now(),
                            'updated_at' => now()
                        ]);
                    }

                    return response()->json([
                        'success' => true,
                        'action' => 'rejected',
                        'is_second_model' => true,
                        'message' => 'Invitación rechazada'
                    ]);
                }
            }

            // 🔥 LÓGICA NORMAL PARA PRIMER MODELO (continúa como antes)
            // Verificar que la llamada esté en estado 'calling'
            VideoChatLogger::log('ANSWER_CALL', 'Verificación de estado de llamada para primer modelo', [
                'call_status' => $call->status,
                'expected_status' => 'calling',
                'status_match' => $call->status === 'calling',
            ]);

            if ($call->status !== 'calling') {
                VideoChatLogger::warning('ANSWER_CALL', 'Llamada no está en estado calling', [
                    'call_status' => $call->status,
                    'call_id' => $call->id,
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'Esta llamada ya no está disponible'
                ], 409);
            }

            // Obtener datos del caller
            $callerId = ($call->cliente_id === $user->id) ? $call->modelo_id : $call->cliente_id;
            
            VideoChatLogger::log('ANSWER_CALL', 'Identificando caller', [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'call_cliente_id' => $call->cliente_id,
                'call_modelo_id' => $call->modelo_id,
                'calculated_caller_id' => $callerId,
                'logic' => $call->cliente_id === $user->id ? 'modelo' : 'cliente',
            ]);
            
            $caller = User::find($callerId);
            
            // Validar que el caller existe
            if (!$caller) {
                VideoChatLogger::error('ANSWER_CALL', 'Caller no encontrado', [
                    'call_id' => $callId,
                    'caller_id' => $callerId,
                    'user_id' => $user->id
                ]);
                
                Log::error('❌ [CALL] Caller no encontrado', [
                    'call_id' => $callId,
                    'caller_id' => $callerId,
                    'user_id' => $user->id
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Error: Usuario no encontrado'
                ], 404);
            }
            
            VideoChatLogger::log('ANSWER_CALL', 'Caller identificado', [
                'caller_id' => $caller->id,
                'caller_name' => $caller->name,
                'caller_role' => $caller->rol,
            ]);

            // 🔥 VERIFICAR BLOQUEOS ANTES DE ACEPTAR
            if ($action === 'accept') {
                $bloqueadoPorReceiver = DB::table('user_blocks')
                    ->where('user_id', $user->id)
                    ->where('blocked_user_id', $callerId)
                    ->where('is_active', true)
                    ->exists();

                $bloqueadoPorCaller = DB::table('user_blocks')
                    ->where('user_id', $callerId)
                    ->where('blocked_user_id', $user->id)
                    ->where('is_active', true)
                    ->exists();

                if ($bloqueadoPorReceiver || $bloqueadoPorCaller) {
                    // Auto-rechazar si hay bloqueo
                    $call->update([
                        'status' => 'rejected',
                        'ended_at' => now(),
                        'end_reason' => 'blocked_user'
                    ]);

                    Log::warning('🚫 [CALL] Llamada auto-rechazada por bloqueo', [
                        'call_id' => $call->id,
                        'caller_id' => $callerId,
                        'receiver_id' => $user->id
                    ]);

                    return response()->json([
                        'success' => false,
                        'error' => 'No se puede aceptar la llamada'
                    ], 403);
                }

                // 🔥 CANCELAR LLAMADAS ACTIVAS PREVIAS DEL RECEIVER
                // Cuando el receiver acepta una nueva llamada, cancelar automáticamente cualquier otra llamada activa
                $receiverActiveCalls = ChatSession::where(function($query) use ($user, $callId) {
                    $query->where('cliente_id', $user->id)
                          ->orWhere('modelo_id', $user->id);
                })
                ->whereIn('status', ['calling', 'active'])
                ->where('session_type', 'call')
                ->where('id', '!=', $callId) // Excluir la llamada actual que estamos aceptando
                ->get();

                // Cancelar automáticamente llamadas activas previas del receiver
                foreach ($receiverActiveCalls as $activeCall) {
                    // Identificar al cliente de la llamada anterior (el que será notificado)
                    $previousCallClientId = $activeCall->cliente_id;
                    $previousCallModelId = $activeCall->modelo_id;
                    
                    // Determinar quién es el cliente (el que debe ser redirigido a ruletear)
                    $clientToNotify = null;
                    if ($user->rol === 'modelo') {
                        // Si el modelo acepta nueva llamada, el cliente de la llamada anterior debe ser notificado
                        $clientToNotify = $previousCallClientId;
                    } else {
                        // Si el cliente acepta nueva llamada, el modelo de la llamada anterior debe ser notificado
                        $clientToNotify = $previousCallModelId;
                    }
                    
                    // Actualizar estado de la llamada anterior
                    $activeCall->update([
                        'status' => 'cancelled',
                        'ended_at' => now(),
                        'end_reason' => 'replaced_by_new_call'
                    ]);
                    
                    Log::info('🔄 [CALL] Llamada previa del receiver cancelada automáticamente', [
                        'old_call_id' => $activeCall->id,
                        'receiver_id' => $user->id,
                        'new_call_id' => $callId,
                        'client_to_notify' => $clientToNotify
                    ]);
                    
                    // 🔥 NOTIFICAR AL CLIENTE/MODELO DE LA LLAMADA ANTERIOR
                    if ($clientToNotify) {
                        try {
                            // Determinar el partner que debe ser notificado
                            $partnerToNotify = User::find($clientToNotify);
                            
                            if ($partnerToNotify) {
                                // Crear notificación para redirigir a ruletear
                                DB::table('notifications')->insert([
                                    'user_id' => $clientToNotify,
                                    'type' => 'call_replaced',
                                    'data' => json_encode([
                                        'message' => 'La modelo aceptó otra llamada. Serás redirigido a buscar otra persona.',
                                        'call_id' => $activeCall->id,
                                        'redirect_url' => '/usersearch',
                                        'redirect_params' => [
                                            'role' => $partnerToNotify->rol,
                                            'action' => 'siguiente',
                                            'from' => 'call_replaced',
                                            'reason' => 'model_accepted_other_call'
                                        ]
                                    ]),
                                    'read' => false,
                                    'expires_at' => now()->addMinutes(5),
                                    'created_at' => now(),
                                    'updated_at' => now()
                                ]);
                                
                                Log::info('📢 [CALL] Notificación enviada al partner de llamada anterior', [
                                    'partner_id' => $clientToNotify,
                                    'partner_name' => $partnerToNotify->name,
                                    'old_call_id' => $activeCall->id
                                ]);
                                
                                // También notificar vía LiveKit si hay una sesión activa
                                if ($activeCall->room_name) {
                                    try {
                                        $liveKitController = new \App\Http\Controllers\LiveKitController();
                                        $request = new \Illuminate\Http\Request();
                                        $request->merge(['roomName' => $activeCall->room_name]);
                                        
                                        // Usar el método de notificación existente
                                        $liveKitController->notifyPartnerStop($request);
                                    } catch (\Exception $e) {
                                        Log::warning('⚠️ [CALL] Error notificando vía LiveKit', [
                                            'error' => $e->getMessage(),
                                            'room_name' => $activeCall->room_name
                                        ]);
                                    }
                                }
                            }
                        } catch (\Exception $e) {
                            Log::error('❌ [CALL] Error creando notificación para partner', [
                                'error' => $e->getMessage(),
                                'client_id' => $clientToNotify
                            ]);
                        }
                    }
                }

                // 🎉 ACEPTAR LLAMADA
                VideoChatLogger::log('ANSWER_CALL', 'Actualizando estado de llamada a active', [
                    'call_id' => $call->id,
                    'old_status' => $call->status,
                    'new_status' => 'active',
                    'room_name' => $call->room_name,
                ]);
                
                $call->update([
                    'status' => 'active',
                    'answered_at' => now()
                ]);
                
                VideoChatLogger::log('ANSWER_CALL', 'Llamada actualizada a active', [
                    'call_id' => $call->id,
                    'room_name' => $call->room_name,
                    'answered_at' => $call->answered_at,
                ]);

                // 🔥 CREAR NOTIFICACIÓN PARA EL CALLER (quien inició la llamada)
                try {
                    $notificationData = [
                        'message' => 'Tu llamada fue aceptada',
                        'call_id' => $call->id,
                        'room_name' => $call->room_name,
                        'receiver' => [
                            'id' => $user->id,
                            'name' => $user->name,
                            'avatar' => $user->avatar ?? null
                        ],
                        'redirect_url' => '/videochat',
                        'redirect_params' => [
                            'roomName' => $call->room_name,
                            'userName' => $user->name,
                            'from' => 'call_accepted'
                        ]
                    ];
                    
                    VideoChatLogger::log('ANSWER_CALL', 'Creando notificación para caller', [
                        'caller_id' => $callerId,
                        'notification_data' => $notificationData,
                    ]);
                    
                    DB::table('notifications')->insert([
                        'user_id' => $callerId,
                        'type' => 'call_accepted',
                        'data' => json_encode($notificationData),
                        'read' => false,
                        'expires_at' => now()->addMinutes(5),
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                    
                    VideoChatLogger::log('ANSWER_CALL', 'Notificación creada exitosamente', [
                        'caller_id' => $callerId,
                        'call_id' => $call->id
                    ]);
                    
                    Log::info('📢 [CALL] Notificación de llamada aceptada creada para caller', [
                        'caller_id' => $callerId,
                        'call_id' => $call->id
                    ]);
                } catch (\Exception $e) {
                    VideoChatLogger::error('ANSWER_CALL', 'Error creando notificación para caller', [
                        'error' => $e->getMessage(),
                        'caller_id' => $callerId
                    ], $e);
                    
                    Log::error('❌ [CALL] Error creando notificación para caller', [
                        'error' => $e->getMessage(),
                        'caller_id' => $callerId
                    ]);
                }

                // 🔥 DETECTAR SI ES LLAMADA 2VS1
                $isDualCall = !empty($call->modelo_id_2);
                $modelo2 = null;
                if ($isDualCall) {
                    $modelo2 = User::find($call->modelo_id_2);
                }
                
                $responseData = [
                    'success' => true,
                    'action' => 'accepted',
                    'call_id' => $call->id,
                    'room_name' => $call->room_name,
                    'is_dual_call' => $isDualCall,
                    'modelo_id_2' => $call->modelo_id_2,
                    'modelo_2_status' => $call->modelo_2_status,
                    'caller' => [
                        'id' => $caller->id,
                        'name' => $caller->name,
                        'avatar' => $caller->avatar ?? null
                    ],
                    'receiver' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'avatar' => $user->avatar ?? null
                    ],
                    'modelo2' => $modelo2 ? [
                        'id' => $modelo2->id,
                        'name' => $modelo2->name,
                        'avatar' => $modelo2->avatar ?? null
                    ] : null,
                    'message' => 'Llamada aceptada'
                ];
                
                VideoChatLogger::end('ANSWER_CALL', 'Llamada aceptada exitosamente', [
                    'call_id' => $call->id,
                    'caller' => $caller->name,
                    'receiver' => $user->name,
                    'room_name' => $call->room_name,
                    'response_data' => $responseData,
                ]);

                Log::info('✅ [CALL] Llamada aceptada', [
                    'call_id' => $call->id,
                    'caller' => $caller->name,
                    'receiver' => $user->name
                ]);

                $response = response()->json($responseData);
                VideoChatLogger::response('ANSWER_CALL', $response);
                
                return $response;

            } else {
                // ❌ RECHAZAR LLAMADA
                VideoChatLogger::log('ANSWER_CALL', 'Rechazando llamada', [
                    'call_id' => $call->id,
                    'caller' => $caller->name,
                    'receiver' => $user->name,
                ]);
                
                $call->update([
                    'status' => 'rejected',
                    'ended_at' => now(),
                    'end_reason' => 'rejected_by_receiver'
                ]);

                VideoChatLogger::end('ANSWER_CALL', 'Llamada rechazada', [
                    'call_id' => $call->id,
                    'caller' => $caller->name,
                    'receiver' => $user->name
                ]);

                Log::info('❌ [CALL] Llamada rechazada', [
                    'call_id' => $call->id,
                    'caller' => $caller->name,
                    'receiver' => $user->name
                ]);

                return response()->json([
                    'success' => true,
                    'action' => 'rejected',
                    'message' => 'Llamada rechazada'
                ]);
            }

        } catch (\Exception $e) {
            VideoChatLogger::error('ANSWER_CALL', 'Error respondiendo llamada', [
                'error' => $e->getMessage(),
                'call_id' => $request->call_id ?? null,
                'action' => $request->action ?? null,
                'user_id' => auth()->id(),
            ], $e);
            
            Log::error('❌ [CALL] Error respondiendo llamada', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error respondiendo llamada: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ➕ INVITAR SEGUNDO MODELO DURANTE LLAMADA ACTIVA
     */
    public function inviteSecondModel(Request $request, $callId)
    {
        try {
            $request->validate([
                'modelo_id' => 'required|integer|exists:users,id'
            ]);

            $user = auth()->user();
            $modeloId = $request->modelo_id;

            Log::info('➕ [CALL] Invitando segundo modelo', [
                'user_id' => $user->id,
                'user_rol' => $user->rol,
                'call_id' => $callId,
                'modelo_id' => $modeloId
            ]);

            // 1. Buscar la llamada
            $call = ChatSession::find($callId);
            if (!$call || $call->session_type !== 'call') {
                return response()->json([
                    'success' => false,
                    'error' => 'Llamada no encontrada'
                ], 404);
            }

            // 2. Validar que la llamada esté activa
            if ($call->status !== 'active') {
                return response()->json([
                    'success' => false,
                    'error' => 'La llamada debe estar activa para invitar un segundo modelo'
                ], 400);
            }

            // 3. Validar que el usuario sea el caller (cliente)
            if ($call->caller_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo el cliente puede invitar un segundo modelo'
                ], 403);
            }

            // 4. Validar que el caller sea cliente
            if ($user->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo clientes pueden invitar segundos modelos'
                ], 403);
            }

            // 5. Validar que no haya segundo modelo ya
            if (!is_null($call->modelo_id_2)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Ya hay un segundo modelo en esta llamada'
                ], 400);
            }

            // 6. Validar que el segundo modelo sea diferente al primero
            if ($modeloId === $call->modelo_id) {
                return response()->json([
                    'success' => false,
                    'error' => 'El segundo modelo debe ser diferente al primero'
                ], 400);
            }

            // 7. Validar que el segundo modelo exista
            $segundoModelo = User::find($modeloId);
            if (!$segundoModelo) {
                return response()->json([
                    'success' => false,
                    'error' => 'Segundo modelo no encontrado'
                ], 404);
            }

            // 8. Validar que el segundo modelo sea modelo
            if ($segundoModelo->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'El segundo modelo debe ser un modelo'
                ], 400);
            }

            // 9. Validar que el segundo modelo esté disponible (no en llamada activa)
            $activeCall = ChatSession::where(function($query) use ($modeloId) {
                $query->where('cliente_id', $modeloId)
                      ->orWhere('modelo_id', $modeloId)
                      ->orWhere('modelo_id_2', $modeloId);
            })
            ->whereIn('status', ['calling', 'active'])
            ->where('session_type', 'call')
            ->first();

            if ($activeCall) {
                return response()->json([
                    'success' => false,
                    'error' => 'El modelo seleccionado no está disponible'
                ], 400);
            }

            // 10. Validar bloqueos mutuos entre cliente y segundo modelo
            $bloqueadoPorCliente = DB::table('user_blocks')
                ->where('user_id', $user->id)
                ->where('blocked_user_id', $modeloId)
                ->where('is_active', true)
                ->exists();

            $bloqueadoPorModelo = DB::table('user_blocks')
                ->where('user_id', $modeloId)
                ->where('blocked_user_id', $user->id)
                ->where('is_active', true)
                ->exists();

            if ($bloqueadoPorCliente || $bloqueadoPorModelo) {
                return response()->json([
                    'success' => false,
                    'error' => 'No puedes invitar a este modelo'
                ], 403);
            }

            // 11. Validar saldo suficiente para doble costo
            $minimumBalance = 60; // 60 monedas = 6 minutos (doble costo: 30 monedas * 2)
            $userCoins = UserCoins::firstOrCreate(
                ['user_id' => $user->id],
                ['purchased_balance' => 0, 'gift_balance' => 0]
            );

            if ($userCoins->purchased_balance < $minimumBalance) {
                $deficit = $minimumBalance - $userCoins->purchased_balance;
                Log::warning('💰 [CALL] Cliente sin saldo suficiente para invitar segundo modelo', [
                    'caller_id' => $user->id,
                    'purchased_balance' => $userCoins->purchased_balance,
                    'minimum_required' => $minimumBalance,
                    'deficit' => $deficit
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'Saldo insuficiente para invitar un segundo modelo',
                    'current_balance' => $userCoins->purchased_balance,
                    'minimum_required' => $minimumBalance,
                    'deficit' => $deficit,
                    'deficit_minutes' => ceil($deficit / 10),
                    'action_required' => 'recharge'
                ], 402);
            }

            // Actualizar ChatSession
            $call->update([
                'modelo_id_2' => $modeloId,
                'modelo_2_invited_at' => now(),
                'modelo_2_status' => 'pending'
            ]);

            // Enviar notificación al segundo modelo
            DB::table('notifications')->insert([
                'user_id' => $modeloId,
                'type' => 'second_model_invitation',
                'data' => json_encode([
                    'call_id' => $call->id,
                    'cliente' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'avatar' => $user->avatar ?? null
                    ],
                    'modelo1' => [
                        'id' => $call->modelo->id,
                        'name' => $call->modelo->name,
                        'avatar' => $call->modelo->avatar ?? null
                    ],
                    'room_name' => $call->room_name,
                    'message' => 'Tienes una invitación para unirte a una llamada existente'
                ]),
                'read' => false,
                'expires_at' => now()->addMinutes(5),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            Log::info('✅ [CALL] Segundo modelo invitado exitosamente', [
                'call_id' => $call->id,
                'cliente_id' => $user->id,
                'modelo1_id' => $call->modelo_id,
                'modelo2_id' => $modeloId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Invitación enviada',
                'call' => $call->load(['modelo', 'modelo2'])
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CALL] Error invitando segundo modelo', [
                'error' => $e->getMessage(),
                'call_id' => $callId,
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error invitando segundo modelo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ❌ RECHAZAR INVITACIÓN DE SEGUNDO MODELO
     */
    public function rejectSecondModelInvitation(Request $request, $callId)
    {
        try {
            $user = auth()->user();

            Log::info('❌ [CALL] Rechazando invitación de segundo modelo', [
                'user_id' => $user->id,
                'user_rol' => $user->rol,
                'call_id' => $callId
            ]);

            // 1. Buscar la llamada
            $call = ChatSession::find($callId);
            if (!$call || $call->session_type !== 'call') {
                return response()->json([
                    'success' => false,
                    'error' => 'Llamada no encontrada'
                ], 404);
            }

            // 2. Validar que el usuario sea el segundo modelo
            if ($call->modelo_id_2 !== $user->id) {
                return response()->json([
                    'success' => false,
                    'error' => 'No autorizado para rechazar esta invitación'
                ], 403);
            }

            // 3. Validar que la invitación esté pendiente
            if ($call->modelo_2_status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'error' => 'Esta invitación ya no está disponible'
                ], 409);
            }

            // Actualizar estado de la invitación
            $call->update([
                'modelo_2_status' => 'rejected'
                // Opcional: mantener modelo_id_2 para historial
            ]);

            // Notificar al cliente que el segundo modelo rechazó
            $cliente = User::find($call->cliente_id);
            if ($cliente) {
                DB::table('notifications')->insert([
                    'user_id' => $cliente->id,
                    'type' => 'second_model_rejected',
                    'data' => json_encode([
                        'message' => $user->name . ' rechazó la invitación para unirse a la llamada',
                        'call_id' => $call->id,
                        'modelo2' => [
                            'id' => $user->id,
                            'name' => $user->name,
                            'avatar' => $user->avatar ?? null
                        ]
                    ]),
                    'read' => false,
                    'expires_at' => now()->addMinutes(5),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            Log::info('✅ [CALL] Invitación de segundo modelo rechazada', [
                'call_id' => $call->id,
                'modelo2_id' => $user->id,
                'cliente_notificado' => $cliente ? true : false
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Invitación rechazada',
                'call' => $call->load(['modelo', 'modelo2'])
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CALL] Error rechazando invitación de segundo modelo', [
                'error' => $e->getMessage(),
                'call_id' => $callId,
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error rechazando invitación: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 🛑 CANCELAR LLAMADA (desde quien llama)
     */
    public function cancelCall(Request $request)
    {
        try {
            $request->validate([
                'call_id' => 'required|integer|exists:chat_sessions,id'
            ]);

            $user = auth()->user();
            $callId = $request->call_id;

            Log::info('🛑 [CALL] Cancelando llamada', [
                'user_id' => $user->id,
                'call_id' => $callId
            ]);

            $call = ChatSession::find($callId);
            if (!$call || $call->session_type !== 'call') {
                return response()->json([
                    'success' => false,
                    'error' => 'Llamada no encontrada'
                ], 404);
            }

            // Verificar que el usuario sea participante de la llamada
            $isParticipant = ($call->cliente_id === $user->id) || ($call->modelo_id === $user->id);
            if (!$isParticipant) {
                return response()->json([
                    'success' => false,
                    'error' => 'No autorizado para cancelar esta llamada'
                ], 403);
            }

            // Solo cancelar si está en calling
            if ($call->status === 'calling') {
                $call->update([
                    'status' => 'cancelled',
                    'ended_at' => now(),
                    'end_reason' => 'cancelled_by_caller'
                ]);

                Log::info('✅ [CALL] Llamada cancelada', [
                    'call_id' => $call->id,
                    'cancelled_by' => $user->name
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Llamada cancelada correctamente'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CALL] Error cancelando llamada', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error cancelando llamada: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 📋 OBTENER ESTADO DE LLAMADA
     */
    public function getCallStatus(Request $request)
    {
        try {
            $request->validate([
                'call_id' => 'required|integer|exists:chat_sessions,id'
            ]);

            $user = auth()->user();
            $callId = $request->call_id;

            // 🔥 LOG DETALLADO PARA DEBUG
            Log::info('📋 [CALL] Verificando estado de llamada', [
                'user_id' => $user->id ?? 'NO_USER',
                'user_rol' => $user->rol ?? 'NO_ROL',
                'call_id' => $callId,
                'has_user' => $user !== null
            ]);

            if (!$user) {
                Log::warning('❌ [CALL] Usuario no autenticado en getCallStatus');
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no autenticado'
                ], 401);
            }

            $call = ChatSession::with(['cliente', 'modelo'])->find($callId);
            if (!$call || $call->session_type !== 'call') {
                Log::warning('❌ [CALL] Llamada no encontrada o tipo incorrecto', [
                    'call_id' => $callId,
                    'call_exists' => $call !== null,
                    'call_type' => $call->session_type ?? 'N/A'
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Llamada no encontrada'
                ], 404);
            }

            // Verificar que el usuario sea participante
            // 🔥 USAR MÚLTIPLES CRITERIOS: cliente_id, modelo_id, y caller_id como respaldo
            $isParticipant = ($call->cliente_id === $user->id) 
                          || ($call->modelo_id === $user->id)
                          || ($call->caller_id && $call->caller_id === $user->id);
            
            // 🔥 LOG DETALLADO PARA DEBUG
            Log::info('📋 [CALL] Verificación de participante', [
                'user_id' => $user->id,
                'call_cliente_id' => $call->cliente_id,
                'call_modelo_id' => $call->modelo_id,
                'call_caller_id' => $call->caller_id ?? 'NO_CALLER_ID',
                'is_participant' => $isParticipant,
                'match_cliente' => $call->cliente_id === $user->id,
                'match_modelo' => $call->modelo_id === $user->id,
                'match_caller' => $call->caller_id && $call->caller_id === $user->id
            ]);
            
            if (!$isParticipant) {
                Log::warning('❌ [CALL] Usuario no es participante de la llamada', [
                    'user_id' => $user->id,
                    'user_rol' => $user->rol,
                    'call_id' => $callId,
                    'call_cliente_id' => $call->cliente_id,
                    'call_modelo_id' => $call->modelo_id,
                    'call_caller_id' => $call->caller_id ?? 'NO_CALLER_ID',
                    'call_status' => $call->status
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'No autorizado'
                ], 403);
            }

            return response()->json([
                'success' => true,
                'call' => [
                    'id' => $call->id,
                    'status' => $call->status,
                    'call_type' => $call->call_type,
                    'room_name' => $call->room_name,
                    'caller' => [
                        'id' => $call->cliente->id ?? null,
                        'name' => $call->cliente->name ?? 'Usuario',
                        'avatar' => $call->cliente->avatar ?? null
                    ],
                    'receiver' => [
                        'id' => $call->modelo->id ?? null,
                        'name' => $call->modelo->name ?? 'Usuario',
                        'avatar' => $call->modelo->avatar ?? null
                    ],
                    'started_at' => $call->started_at,
                    'answered_at' => $call->answered_at,
                    'ended_at' => $call->ended_at
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CALL] Error obteniendo estado', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo estado: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 🔔 VERIFICAR LLAMADAS ENTRANTES (POLLING)
     */
    public function checkIncomingCalls(Request $request)
    {
        try {
            $user = auth()->user();
            
            // 🔥 VALIDAR AUTENTICACIÓN
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'has_incoming' => false,
                    'error' => 'No autenticado'
                ], 401);
            }

            Log::info('📞 [CALL] Verificando llamadas entrantes', [
                'user_id' => $user->id,
                'user_rol' => $user->rol
            ]);

            // 🔥 NUEVA LÓGICA SIMPLIFICADA: Buscar llamadas donde el usuario es el receiver (NO el caller)
            // Usar caller_id para identificar explícitamente quién inició la llamada
            $incomingCall = ChatSession::where(function($query) use ($user) {
                // Buscar llamadas donde el usuario participa (cliente_id o modelo_id)
                $query->where(function($q) use ($user) {
                    $q->where('cliente_id', $user->id)
                      ->orWhere('modelo_id', $user->id);
                });
            })
            ->where('session_type', 'call')
            ->where('status', 'calling')
            ->where('caller_id', '!=', $user->id) // 🔥 NUEVO: Excluir llamadas donde el usuario es el caller
            ->with(['cliente:id,name,rol,avatar', 'modelo:id,name,rol,avatar', 'caller:id,name,rol,avatar'])
            ->orderBy('started_at', 'desc')
            ->first();

            Log::info('📞 [CALL] Resultado de búsqueda', [
                'user_id' => $user->id,
                'user_rol' => $user->rol,
                'found_call' => $incomingCall ? true : false,
                'call_id' => $incomingCall?->id,
                'call_cliente_id' => $incomingCall?->cliente_id,
                'call_modelo_id' => $incomingCall?->modelo_id,
                'call_caller_id' => $incomingCall?->caller_id
            ]);

            if (!$incomingCall) {
                return response()->json([
                    'success' => true,
                    'has_incoming' => false
                ]);
            }

            // Validar que started_at existe antes de usarlo
            if (!$incomingCall->started_at) {
                Log::warning('⚠️ [CALL] Llamada sin started_at, estableciendo started_at ahora', [
                    'call_id' => $incomingCall->id,
                    'user_id' => $user->id
                ]);
                
                // Si no tiene started_at, establecerlo ahora (puede ser una llamada recién creada)
                $incomingCall->update([
                    'started_at' => now()
                ]);
                
                // No cancelar, solo establecer started_at y continuar
            }

            // Verificar que no haya expirado (más de 30 segundos)
            // 🔥 FIX: Usar copy() para no modificar el objeto original
            // 🔥 IMPORTANTE: Solo verificar expiración si started_at existe y han pasado más de 30 segundos
            if ($incomingCall->started_at) {
                $secondsSinceStart = $incomingCall->started_at->diffInSeconds(now());
                
                // Solo cancelar si han pasado MÁS de 30 segundos (no igual, para evitar cancelaciones prematuras)
                if ($secondsSinceStart > 30) {
                    Log::info('⏰ [CALL] Llamada expirada por timeout', [
                        'call_id' => $incomingCall->id,
                        'seconds_since_start' => $secondsSinceStart,
                        'user_id' => $user->id
                    ]);
                    
                    $incomingCall->update([
                        'status' => 'cancelled',
                        'ended_at' => now(),
                        'end_reason' => 'timeout'
                    ]);

                    return response()->json([
                        'success' => true,
                        'has_incoming' => false
                    ]);
                }
            }

            // 🔥 NUEVA LÓGICA SIMPLIFICADA: Usar caller_id directamente
            // Si caller_id está definido, usarlo directamente
            // Si no, usar la lógica antigua como fallback (para compatibilidad con llamadas antiguas)
            $callerId = $incomingCall->caller_id;
            
            // Si caller_id no está definido (llamadas antiguas), determinar usando la lógica antigua
            if (!$callerId) {
                // Fallback: determinar caller basándose en cliente_id y modelo_id
                if ($incomingCall->cliente_id === $user->id) {
                    $callerId = $incomingCall->modelo_id;
                } elseif ($incomingCall->modelo_id === $user->id) {
                    $callerId = $incomingCall->cliente_id;
                }
            }
            
            // Validar que callerId no sea null
            if (!$callerId) {
                Log::warning('⚠️ [CALL] Llamada con callerId null, cancelando', [
                    'call_id' => $incomingCall->id,
                    'user_id' => $user->id,
                    'user_rol' => $user->rol,
                    'cliente_id' => $incomingCall->cliente_id,
                    'modelo_id' => $incomingCall->modelo_id
                ]);
                
                $incomingCall->update([
                    'status' => 'cancelled',
                    'ended_at' => now(),
                    'end_reason' => 'invalid_caller_id'
                ]);

                return response()->json([
                    'success' => true,
                    'has_incoming' => false
                ]);
            }
            
            $caller = User::find($callerId);

            // Validar que el caller existe
            if (!$caller) {
                Log::warning('⚠️ [CALL] Caller no encontrado, cancelando llamada', [
                    'call_id' => $incomingCall->id,
                    'caller_id' => $callerId,
                    'user_id' => $user->id,
                    'user_rol' => $user->rol
                ]);
                
                $incomingCall->update([
                    'status' => 'cancelled',
                    'ended_at' => now(),
                    'end_reason' => 'caller_not_found'
                ]);

                return response()->json([
                    'success' => true,
                    'has_incoming' => false
                ]);
            }

            // 🔥 VERIFICAR SI EL CALLER ESTÁ BLOQUEADO
            $isCallerBlocked = DB::table('user_blocks')
                ->where('user_id', $user->id)
                ->where('blocked_user_id', $callerId)
                ->where('is_active', true)
                ->exists();

            if ($isCallerBlocked) {
                // Auto-cancelar la llamada si el caller está bloqueado
                $incomingCall->update([
                    'status' => 'cancelled',
                    'ended_at' => now(),
                    'end_reason' => 'blocked_caller'
                ]);

                Log::info('🚫 [CALL] Llamada auto-cancelada por caller bloqueado', [
                    'call_id' => $incomingCall->id,
                    'caller_id' => $callerId,
                    'receiver_id' => $user->id
                ]);

                return response()->json([
                    'success' => true,
                    'has_incoming' => false
                ]);
            }

            // Obtener nickname y avatar_url del caller
            // 🔥 IMPORTANTE: Cuando el receiver recibe una llamada, debe ver el NICKNAME PROPIO del caller
            // Ejemplo: Si la modelo llama al cliente, el cliente debe ver el nickname que la modelo se puso a sí misma
            // Primero buscar el nickname propio del caller (el que se puso a sí mismo)
            $nicknamePropio = UserNickname::where('user_id', $caller->id)
                ->where('target_user_id', $caller->id)
                ->first();
            
            // Si no hay nickname propio, usar el nombre real del caller
            $displayName = $nicknamePropio ? $nicknamePropio->nickname : $caller->name;
            
            $profileController = new ProfileSettingsController();
            $avatarUrl = null;

            // Aplicar lógica de privacidad: para clientes, solo mostrar foto si fue subida manualmente
            if ($caller->rol === 'modelo' || ($caller->rol === 'cliente' && !$this->isGoogleAvatar($caller->avatar))) {
                try {
                    $avatarUrl = $profileController->generateAvatarUrl($caller->avatar);
                } catch (\Exception $e) {
                    Log::warning('⚠️ [CALL] Error generando avatar URL', [
                        'caller_id' => $caller->id,
                        'avatar' => $caller->avatar,
                        'error' => $e->getMessage()
                    ]);
                    $avatarUrl = null; // Usar null si hay error
                }
            }

            Log::info('📞 [CALL] Datos de llamada entrante', [
                'caller_id' => $caller->id,
                'caller_name' => $caller->name,
                'caller_display_name' => $displayName,
                'caller_avatar' => $caller->avatar,
                'caller_avatar_url' => $avatarUrl,
                'caller_rol' => $caller->rol,
                'is_google_avatar' => $this->isGoogleAvatar($caller->avatar)
            ]);

            // Calcular duración solo si started_at existe (ya validado anteriormente)
            $durationCalling = $incomingCall->started_at ? $incomingCall->started_at->diffInSeconds(now()) : 0;

            return response()->json([
                'success' => true,
                'has_incoming' => true,
                'incoming_call' => [
                    'id' => $incomingCall->id,
                    'call_type' => $incomingCall->call_type,
                    'room_name' => $incomingCall->room_name,
                    'caller' => [
                        'id' => $caller->id,
                        'name' => $caller->name,
                        'display_name' => $displayName,
                        'avatar' => $caller->avatar ?? null,
                        'avatar_url' => $avatarUrl
                    ],
                    'started_at' => $incomingCall->started_at,
                    'duration_calling' => $durationCalling
                ]
            ]);

        } catch (\Illuminate\Database\QueryException $dbError) {
            Log::error('❌ [CALL] Error de base de datos verificando llamadas entrantes', [
                'error' => $dbError->getMessage(),
                'sql' => $dbError->getSql() ?? 'N/A',
                'user_id' => auth()->id()
            ]);

            // 🔥 IMPORTANTE: Devolver 200 con success=false para errores de BD
            return response()->json([
                'success' => false,
                'has_incoming' => false,
                'error' => 'Error de base de datos'
            ], 200);
        } catch (\Exception $e) {
            Log::error('❌ [CALL] Error verificando llamadas entrantes', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'user_id' => auth()->id()
            ]);

            // 🔥 IMPORTANTE: Devolver 200 con success=false para no interrumpir el polling
            return response()->json([
                'success' => false,
                'has_incoming' => false,
                'error' => 'Error verificando llamadas'
            ], 200);
        }
    }

    /**
     * 🧹 LIMPIAR LLAMADAS EXPIRADAS
     */
    public function cleanupExpiredCalls()
    {
        try {
            Log::info('🧹 [CALL] Iniciando limpieza de llamadas expiradas');

            // Cancelar llamadas sin respuesta después de 30 segundos
            $expiredCalls = ChatSession::where('session_type', 'call')
                ->where('status', 'calling')
                ->where('started_at', '<', now()->subSeconds(30))
                ->get();

            foreach ($expiredCalls as $call) {
                $call->update([
                    'status' => 'cancelled',
                    'ended_at' => now(),
                    'end_reason' => 'timeout'
                ]);
            }

            Log::info('✅ [CALL] Limpieza completada', [
                'expired_calls' => $expiredCalls->count()
            ]);

            return response()->json([
                'success' => true,
                'cleaned_calls' => $expiredCalls->count()
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CALL] Error en limpieza', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error en limpieza: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 📜 OBTENER HISTORIAL DE VIDEOLLAMADAS Y FAVORITOS
     * Devuelve las últimas 5 videollamadas y notificaciones de favoritos del usuario autenticado
     */
    public function getCallHistory(Request $request)
    {
        try {
            $user = auth()->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no autenticado'
                ], 401);
            }

            // Obtener las últimas 5 videollamadas donde el usuario participó
            // Incluye llamadas desde mensajes (status: ended, rejected, cancelled)
            // y llamadas desde ruleteo que hayan terminado (ended_at no null)
            $calls = ChatSession::where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                      ->orWhere('modelo_id', $user->id);
            })
            ->where('session_type', 'call')
            ->where(function($query) {
                // Incluir llamadas terminadas explícitamente
                $query->whereIn('status', ['ended', 'rejected', 'cancelled'])
                      // O llamadas que tienen ended_at (terminaron de alguna forma)
                      ->orWhereNotNull('ended_at');
            })
            ->with(['cliente:id,name', 'modelo:id,name'])
            ->where(function($query) {
                // Solo incluir si tiene al menos cliente_id o modelo_id definido (no solo waiting)
                $query->whereNotNull('cliente_id')
                      ->whereNotNull('modelo_id');
            })
            ->orderByRaw('COALESCE(ended_at, started_at, created_at) DESC')
            ->limit(5)
            ->get();

            // Formatear las llamadas para el frontend
            $callHistory = $calls->map(function($call) use ($user) {
                // Determinar el otro usuario (no el autenticado)
                $otherUser = $call->cliente_id == $user->id 
                    ? $call->modelo 
                    : $call->cliente;
                
                // Determinar la fecha de la llamada
                $callDate = $call->ended_at ?? $call->started_at ?? now();
                
                return [
                    'id' => $call->id,
                    'type' => 'call',
                    'user_id' => $otherUser->id ?? null,
                    'user_name' => $otherUser->name ?? 'Usuario desconocido',
                    'call_type' => $call->call_type,
                    'status' => $call->status,
                    'ended_at' => $call->ended_at ? $call->ended_at->toISOString() : null,
                    'started_at' => $call->started_at ? $call->started_at->toISOString() : null,
                    'timestamp' => $callDate->toISOString(),
                    'formatted_date' => $this->formatCallDate($callDate)
                ];
            });

            // Obtener las últimas notificaciones de favoritos donde el usuario fue agregado a favoritos
            // Solo para modelos (cuando un cliente los agrega a favoritos)
            $favorites = DB::table('user_favorites')
                ->join('users', 'user_favorites.user_id', '=', 'users.id')
                ->where('user_favorites.favorite_user_id', $user->id)
                ->where('user_favorites.is_active', true)
                ->select(
                    'user_favorites.id',
                    'user_favorites.user_id',
                    'user_favorites.created_at',
                    'users.name as user_name'
                )
                ->orderBy('user_favorites.created_at', 'DESC')
                ->limit(5)
                ->get();

            // Formatear las notificaciones de favoritos
            $favoriteHistory = $favorites->map(function($favorite) {
                return [
                    'id' => 'favorite_' . $favorite->id,
                    'type' => 'favorite',
                    'user_id' => $favorite->user_id,
                    'user_name' => $favorite->user_name ?? 'Usuario desconocido',
                    'timestamp' => \Carbon\Carbon::parse($favorite->created_at)->toISOString(),
                    'formatted_date' => $this->formatCallDate(\Carbon\Carbon::parse($favorite->created_at))
                ];
            });

            // Combinar y ordenar por fecha (más reciente primero)
            $combinedHistory = $callHistory->concat($favoriteHistory)
                ->sortByDesc(function($item) {
                    return $item['timestamp'];
                })
                ->take(5)
                ->values();

            return response()->json([
                'success' => true,
                'history' => $combinedHistory
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CALL HISTORY] Error obteniendo historial', [
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error al obtener el historial'
            ], 500);
        }
    }

    /**
     * 📅 Formatear fecha de llamada de manera amigable
     */
    private function formatCallDate($date)
    {
        if (!$date) {
            return 'Fecha desconocida';
        }
        
        $now = \Carbon\Carbon::now();
        $callTime = \Carbon\Carbon::parse($date);
        
        // Formatear hora
        $timeFormatted = $callTime->format('g:i A');
        
        if ($callTime->isToday()) {
            return 'Hoy, ' . $timeFormatted;
        } elseif ($callTime->isYesterday()) {
            return 'Ayer, ' . $timeFormatted;
        } elseif ($callTime->isCurrentWeek()) {
            $days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            return $days[$callTime->dayOfWeek] . ', ' . $timeFormatted;
        } elseif ($callTime->isCurrentYear()) {
            $months = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return $callTime->format('d') . ' ' . $months[$callTime->month] . ', ' . $timeFormatted;
        } else {
            return $callTime->format('d/m/Y, g:i A');
        }
    }

    /**
     * 🔍 MÉTODO AUXILIAR: Verificar si existe bloqueo entre dos usuarios
     */
    private function isBlocked($userId1, $userId2)
    {
        return DB::table('user_blocks')
            ->where(function($query) use ($userId1, $userId2) {
                $query->where(function($q) use ($userId1, $userId2) {
                    $q->where('user_id', $userId1)
                      ->where('blocked_user_id', $userId2);
                })
                ->orWhere(function($q) use ($userId1, $userId2) {
                    $q->where('user_id', $userId2)
                      ->where('blocked_user_id', $userId1);
                });
            })
            ->where('is_active', true)
            ->exists();
    }

    /**
     * 🔍 MÉTODO AUXILIAR: Verificar si el avatar es de Google
     */
    private function isGoogleAvatar($filename)
    {
        if (!$filename) return false;
        return str_contains($filename, 'googleusercontent.com') ||
               str_contains($filename, 'googleapis.com') ||
               str_contains($filename, 'google.com');
    }
}