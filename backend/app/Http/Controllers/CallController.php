<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ChatSession;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class CallController extends Controller
{
    /**
     * 📞 INICIAR LLAMADA A USUARIO ESPECÍFICO
     */
    public function startCall(Request $request)
    {
        try {
            $request->validate([
                'receiver_id' => 'required|integer|exists:users,id',
                'call_type' => 'required|string|in:video,audio'
            ]);

            $caller = auth()->user();
            $receiverId = $request->receiver_id;
            $callType = $request->call_type;

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

            // Verificar que el caller no esté en otra llamada
            $callerActiveCall = ChatSession::where(function($query) use ($caller) {
                $query->where('cliente_id', $caller->id)
                      ->orWhere('modelo_id', $caller->id);
            })
            ->whereIn('status', ['calling', 'active'])
            ->where('session_type', 'call')
            ->first();

            if ($callerActiveCall) {
                return response()->json([
                    'success' => false,
                    'error' => 'Ya tienes una llamada activa'
                ], 409);
            }

            // Verificar que el receiver no esté ocupado
            $receiverActiveCall = ChatSession::where(function($query) use ($receiverId) {
                $query->where('cliente_id', $receiverId)
                      ->orWhere('modelo_id', $receiverId);
            })
            ->whereIn('status', ['calling', 'active'])
            ->where('session_type', 'call')
            ->first();

            if ($receiverActiveCall) {
                return response()->json([
                    'success' => false,
                    'error' => 'El usuario está ocupado en otra llamada'
                ], 409);
            }

            // 🔥 CREAR ROOM NAME ÚNICO
            $roomName = "call_" . $caller->id . "_" . $receiverId . "_" . time();

            // 🔥 CREAR REGISTRO DE LLAMADA
            DB::beginTransaction();
            try {
                // 🔥 ASIGNAR IDs SEGÚN ROL DEL CALLER
                $sessionData = [
                    'room_name' => $roomName,
                    'session_type' => 'call',
                    'call_type' => $callType,
                    'status' => 'calling',
                    'started_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now()
                ];

                // 🔥 LÓGICA: Quien llama va en cliente_id, quien recibe en modelo_id
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
                    'modelo_id' => $call->modelo_id
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
        try {
            $request->validate([
                'call_id' => 'required|integer|exists:chat_sessions,id',
                'action' => 'required|string|in:accept,reject'
            ]);

            $user = auth()->user();
            $callId = $request->call_id;
            $action = $request->action;

            Log::info('📱 [CALL] Respondiendo llamada', [
                'user_id' => $user->id,
                'call_id' => $callId,
                'action' => $action
            ]);

            $call = ChatSession::find($callId);
            if (!$call || $call->session_type !== 'call') {
                return response()->json([
                    'success' => false,
                    'error' => 'Llamada no encontrada'
                ], 404);
            }

            // Verificar que el usuario sea el receiver (esté en cliente_id o modelo_id)
            $isReceiver = ($call->cliente_id === $user->id) || ($call->modelo_id === $user->id);
            if (!$isReceiver) {
                return response()->json([
                    'success' => false,
                    'error' => 'No autorizado para responder esta llamada'
                ], 403);
            }

            // Verificar que la llamada esté en estado 'calling'
            if ($call->status !== 'calling') {
                return response()->json([
                    'success' => false,
                    'error' => 'Esta llamada ya no está disponible'
                ], 409);
            }

            // Obtener datos del caller
            $callerId = ($call->cliente_id === $user->id) ? $call->modelo_id : $call->cliente_id;
            $caller = User::find($callerId);

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

                // 🎉 ACEPTAR LLAMADA
                $call->update([
                    'status' => 'active',
                    'answered_at' => now()
                ]);

                Log::info('✅ [CALL] Llamada aceptada', [
                    'call_id' => $call->id,
                    'caller' => $caller->name,
                    'receiver' => $user->name
                ]);

                return response()->json([
                    'success' => true,
                    'action' => 'accepted',
                    'call_id' => $call->id,
                    'room_name' => $call->room_name,
                    'caller' => [
                        'id' => $caller->id,
                        'name' => $caller->name,
                        'avatar' => $caller->avatar ?? null
                    ],
                    'message' => 'Llamada aceptada'
                ]);

            } else {
                // ❌ RECHAZAR LLAMADA
                $call->update([
                    'status' => 'rejected',
                    'ended_at' => now(),
                    'end_reason' => 'rejected_by_receiver'
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

            $call = ChatSession::with(['cliente', 'modelo'])->find($callId);
            if (!$call || $call->session_type !== 'call') {
                return response()->json([
                    'success' => false,
                    'error' => 'Llamada no encontrada'
                ], 404);
            }

            // Verificar que el usuario sea participante
            $isParticipant = ($call->cliente_id === $user->id) || ($call->modelo_id === $user->id);
            if (!$isParticipant) {
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

            // Buscar llamadas entrantes sin responder
            $incomingCall = ChatSession::where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                      ->orWhere('modelo_id', $user->id);
            })
            ->where('session_type', 'call')
            ->where('status', 'calling')
            ->with(['cliente', 'modelo'])
            ->orderBy('started_at', 'desc')
            ->first();

            if (!$incomingCall) {
                return response()->json([
                    'success' => true,
                    'has_incoming' => false
                ]);
            }

            // Verificar que no haya expirado (más de 30 segundos)
            if ($incomingCall->started_at->addSeconds(30)->isPast()) {
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

            // Determinar quién es el caller
            $callerId = ($incomingCall->cliente_id === $user->id) ? $incomingCall->modelo_id : $incomingCall->cliente_id;
            $caller = User::find($callerId);

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
                        'avatar' => $caller->avatar ?? null
                    ],
                    'started_at' => $incomingCall->started_at,
                    'duration_calling' => $incomingCall->started_at->diffInSeconds(now())
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CALL] Error verificando llamadas entrantes', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error verificando llamadas'
            ], 500);
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
}