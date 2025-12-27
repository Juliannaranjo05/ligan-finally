<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ChatMessage;
use App\Models\ChatSession;
use App\Models\User;
use App\Models\UserNickname;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\ProfileSettingsController;

class ChatController extends Controller
{
    /**
     * Verificar si el avatar es de Google
     */
    private function isGoogleAvatar($filename)
    {
        if (!$filename) return false;
        
        return str_contains($filename, 'googleusercontent.com') || 
               str_contains($filename, 'googleapis.com') ||
               str_contains($filename, 'google.com');
    }

    /**
     * Obtener perfil del usuario actual
     */
    public function getUserProfile()
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
            }
            
            return response()->json([
                'id' => $user->id,
                'name' => $user->name,
                'alias' => $user->alias ?? null,
                'rol' => $user->rol
            ]);
            
        } catch (\Exception $e) {
        }
    }

    /**
     * Obtener conversaciones del usuario (CON DEBUG EXTENDIDO)
     */
    public function getConversations()
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['error' => 'No autenticado'], 401);
            }

            // 🔥 OBTENER USUARIOS BLOQUEADOS (AMBAS DIRECCIONES)
            
            // Usuarios que YO he bloqueado
            $myBlockedUsers = DB::table('user_blocks')
                ->where('user_id', $user->id)
                ->where('is_active', true)
                ->pluck('blocked_user_id')
                ->toArray();

            // Usuarios que ME han bloqueado
            $blockedByUsers = DB::table('user_blocks')
                ->where('blocked_user_id', $user->id)
                ->where('is_active', true)
                ->pluck('user_id')
                ->toArray();

            // Combinar ambas listas para filtro completo
            $allBlockedUsers = array_unique(array_merge($myBlockedUsers, $blockedByUsers));

            Log::info('🔍 Filtros de bloqueo aplicados:', [
                'user_id' => $user->id,
                'my_blocked' => $myBlockedUsers,
                'blocked_by' => $blockedByUsers,
                'total_filtered' => $allBlockedUsers
            ]);

            // DEBUG: Contar sesiones totales del usuario
            $totalSessions = ChatSession::where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                    ->orWhere('modelo_id', $user->id);
            })->count();

            // Obtener sesiones SIN filtro de status
            $sessionsWithoutStatusFilter = ChatSession::where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                    ->orWhere('modelo_id', $user->id);
            })
            ->where(function($query) use ($user) {
                // Debe tener ambos participantes (cliente y modelo)
                if ($user->rol === 'cliente') {
                    $query->whereNotNull('modelo_id');
                } else {
                    $query->whereNotNull('cliente_id');
                }
            })
            ->orderBy('updated_at', 'desc')
            ->get();

            $sessions = $sessionsWithoutStatusFilter;
            
            $conversations = [];
            $processedUsers = []; // Evitar duplicados
            
            foreach ($sessions as $session) {
                // Determinar quién es el "otro usuario"
                $otherUserId = ($session->cliente_id === $user->id) 
                    ? $session->modelo_id 
                    : $session->cliente_id;
                
                if (!$otherUserId || in_array($otherUserId, $processedUsers)) {
                    continue; // Saltar si no hay otro usuario o ya fue procesado
                }

                // 🔥 FILTRAR USUARIOS BLOQUEADOS
                if (in_array($otherUserId, $allBlockedUsers)) {
                    Log::info('🚫 Conversación filtrada por bloqueo:', [
                        'user_id' => $user->id,
                        'blocked_user_id' => $otherUserId,
                        'in_my_blocked' => in_array($otherUserId, $myBlockedUsers),
                        'in_blocked_by' => in_array($otherUserId, $blockedByUsers)
                    ]);
                    continue; // Saltar usuarios bloqueados
                }

                $otherUser = User::find($otherUserId);
                if (!$otherUser) {
                    continue;
                }

                // Marcar como procesado
                $processedUsers[] = $otherUserId;

                // Obtener nickname si existe
                $nickname = UserNickname::where('user_id', $otherUserId)
                    ->where('target_user_id', $user->id)
                    ->first();
                
                // Si no hay nickname del usuario actual, buscar el nickname que el otro usuario se puso a sí mismo
                if (!$nickname && $otherUser->rol === 'modelo') {
                    $nickname = UserNickname::where('user_id', $otherUserId)
                        ->where('target_user_id', $otherUserId)
                        ->first();
                }
                
                $displayName = $nickname ? $nickname->nickname : $otherUser->name;

                // Generar avatar_url
                // 🔒 PRIVACIDAD: Clientes solo muestran foto si la subieron manualmente (no de Google)
                // Modelos pueden mostrar cualquier foto (incluyendo Google)
                $avatar = $otherUser->avatar;
                $avatarUrl = null;
                
                if ($otherUser->rol === 'modelo') {
                    // Modelo: mostrar cualquier foto
                    $profileController = new \App\Http\Controllers\ProfileSettingsController();
                    $avatarUrl = $profileController->generateAvatarUrl($avatar);
                } else if ($otherUser->rol === 'cliente') {
                    // Cliente: solo mostrar foto si NO es de Google
                    if ($avatar && !$this->isGoogleAvatar($avatar)) {
                        $profileController = new \App\Http\Controllers\ProfileSettingsController();
                        $avatarUrl = $profileController->generateAvatarUrl($avatar);
                    }
                } else {
                    // Otros roles: mostrar cualquier foto
                    $profileController = new \App\Http\Controllers\ProfileSettingsController();
                    $avatarUrl = $profileController->generateAvatarUrl($avatar);
                }

                // Crear room_name único para esta conversación
                $roomName = $this->generateRoomName($user->id, $otherUserId);

                // Obtener último mensaje de esta conversación
                $lastMessage = ChatMessage::where('room_name', $roomName)
                    ->orderBy('created_at', 'desc')
                    ->first();

                // Contar mensajes no leídos
                $unreadCount = ChatMessage::where('room_name', $roomName)
                    ->where('user_id', '!=', $user->id)
                    ->where('read_at', null)
                    ->count();

                $sessionDate = $session->ended_at ?? $session->updated_at ?? $session->created_at;

                $conversations[] = [
                    'id' => $session->id,
                    'other_user_id' => $otherUserId,
                    'other_user_name' => $displayName,
                    'other_user_display_name' => $displayName,
                    'other_user_role' => $otherUser->rol,
                    'room_name' => $roomName,
                    'last_message' => $lastMessage ? $lastMessage->message : 'Conversación disponible',
                    'last_message_time' => $lastMessage ? $lastMessage->created_at->toISOString() : $sessionDate->toISOString(),
                    'last_message_sender_id' => $lastMessage ? $lastMessage->user_id : null,
                    'unread_count' => $unreadCount,
                    'session_date' => $sessionDate->toISOString(),
                    'avatar' => $otherUser->avatar,
                    'avatar_url' => $avatarUrl
                ];
            }

            // Ordenar por último mensaje más reciente
            usort($conversations, function($a, $b) {
                return strtotime($b['last_message_time']) - strtotime($a['last_message_time']);
            });

            Log::info('✅ Conversaciones cargadas con filtro de bloqueo:', [
                'user_id' => $user->id,
                'total_sessions' => $totalSessions,
                'filtered_conversations' => count($conversations),
                'blocked_users_filtered' => count($allBlockedUsers)
            ]);

            return response()->json([
                'success' => true,
                'conversations' => $conversations,
                'debug' => [
                    'user_id' => $user->id,
                    'user_role' => $user->rol,
                    'total_sessions' => $totalSessions,
                    'final_conversations' => count($conversations),
                    'blocked_users_count' => count($allBlockedUsers)
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error obteniendo conversaciones:', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'trace' => $e->getTraceAsString()
            ]);
        
            return response()->json([
                'error' => 'Error interno',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener mensajes de una conversación específica (CON DEBUG)
     */
    public function getMessages($roomName)
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
            }

            // 🔥 DEBUG: Verificar acceso
            $hasAccess = $this->userHasAccessToRoom($user->id, $roomName);
            if (!$hasAccess) {
            }

            // 🔥 DEBUG: Contar mensajes total
            $totalMessages = ChatMessage::where('room_name', $roomName)->count();

            $messages = ChatMessage::where('room_name', $roomName)
                ->orderBy('created_at', 'asc')
                ->limit(100)
                ->get()
                ->map(function ($message) {
                    $result = [
                        'id' => $message->id,
                        'user_id' => $message->user_id,
                        'user_name' => $message->user_name,
                        'user_role' => $message->user_role,
                        'message' => $message->message,
                        'type' => $message->type,
                        'extra_data' => $message->extra_data,
                        'created_at' => $message->created_at->toISOString()
                    ];
                    
                    // Si extra_data contiene información de regalo, también incluirla como gift_data
                    if ($message->extra_data) {
                        $extraData = is_string($message->extra_data) 
                            ? json_decode($message->extra_data, true) 
                            : $message->extra_data;
                        
                        if ($extraData && (isset($extraData['gift_name']) || isset($extraData['gift_image']))) {
                            $result['gift_data'] = $extraData;
                        }
                    }
                    
                    return $result;
                });


            return response()->json([
                'success' => true,
                'messages' => $messages,
                'room_name' => $roomName,
                'debug' => [
                    'total_in_db' => $totalMessages,
                    'returned_count' => $messages->count(),
                    'user_has_access' => $hasAccess
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error interno',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Enviar mensaje a una conversación
     */
    public function sendMessage(Request $request)
    {
        try {
            $request->validate([
                'room_name' => 'required|string|max:255',
                'message' => 'required|string|max:500',
                'type' => 'string|in:text,gift,emoji,gift_request'
            ]);

            $user = Auth::user();
            $roomName = $request->room_name;
            $message = $request->message;
            $type = $request->type ?? 'text';
            $extraData = $request->extra_data ?? null;

            Log::info('📤 [ChatController] Intento de envío de mensaje', [
                'user_id' => $user->id,
                'user_name' => $user->name,
                'user_role' => $user->rol,
                'room_name' => $roomName,
                'message_length' => strlen($message),
                'type' => $type
            ]);

            // Verificar acceso a la conversación
            if (!$this->userHasAccessToRoom($user->id, $roomName)) {
                Log::warning('🚫 [ChatController] Acceso denegado al intentar enviar mensaje', [
                    'user_id' => $user->id,
                    'room_name' => $roomName,
                    'room_name_type' => strpos($roomName, 'omegle_') === 0 ? 'videochat' : 'chat'
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'Acceso denegado',
                    'message' => 'No tienes acceso a esta conversación. Verifica que la sesión esté activa.'
                ], 403);
            }

            // 🔥 VALIDACIONES DE BLOQUEO - EXTRAER RECEPTOR DEL ROOM NAME
            
            // Extraer IDs de usuarios del room_name (formato: chat_user_1_2)
            preg_match('/chat_user_(\d+)_(\d+)/', $roomName, $matches);
            
            if (count($matches) === 3) {
                $userId1 = (int)$matches[1];
                $userId2 = (int)$matches[2];
                
                // Determinar el receptor
                $recipientId = ($user->id == $userId1) ? $userId2 : $userId1;

                // 🔥 VALIDACIÓN 1: Verificar si el usuario actual bloqueó al destinatario
                $blockedByMe = DB::table('user_blocks')
                    ->where('user_id', $user->id)
                    ->where('blocked_user_id', $recipientId)
                    ->where('is_active', true)
                    ->exists();

                if ($blockedByMe) {
                    Log::info('🚫 Mensaje bloqueado: Usuario bloqueó al destinatario', [
                        'sender_id' => $user->id,
                        'recipient_id' => $recipientId,
                        'room_name' => $roomName
                    ]);

                    return response()->json([
                        'success' => false,
                        'error' => 'blocked',
                        'message' => 'No puedes enviar mensajes a un usuario bloqueado'
                    ], 403);
                }

                // 🔥 VALIDACIÓN 2: Verificar si el destinatario bloqueó al usuario actual
                $blockedByThem = DB::table('user_blocks')
                    ->where('user_id', $recipientId)
                    ->where('blocked_user_id', $user->id)
                    ->where('is_active', true)
                    ->exists();

                if ($blockedByThem) {
                    Log::info('🚫 Mensaje bloqueado: Destinatario bloqueó al usuario', [
                        'sender_id' => $user->id,
                        'recipient_id' => $recipientId,
                        'room_name' => $roomName
                    ]);

                    return response()->json([
                        'success' => false,
                        'error' => 'blocked_by_user',
                        'message' => 'Este usuario te ha bloqueado'
                    ], 403);
                }

                Log::info('✅ Validaciones de bloqueo pasadas', [
                    'sender_id' => $user->id,
                    'recipient_id' => $recipientId,
                    'room_name' => $roomName
                ]);
            }

            // Si pasa todas las validaciones, crear el mensaje
            $chatMessage = ChatMessage::create([
                'room_name' => $roomName,
                'user_id' => $user->id,
                'user_name' => $user->alias ?? $user->name,
                'user_role' => $user->rol,
                'message' => $message,
                'type' => $type,
                'extra_data' => $extraData
            ]);

            Log::info('✅ Mensaje enviado exitosamente', [
                'message_id' => $chatMessage->id,
                'sender_id' => $user->id,
                'room_name' => $roomName,
                'type' => $type
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Mensaje enviado correctamente',
                'data' => [
                    'id' => $chatMessage->id,
                    'user_name' => $chatMessage->user_name,
                    'user_role' => $chatMessage->user_role,
                    'message' => $chatMessage->message,
                    'type' => $chatMessage->type,
                    'created_at' => $chatMessage->created_at->toISOString()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error enviando mensaje:', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'room_name' => $request->room_name ?? 'N/A',
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Marcar mensajes como leídos
     */
    public function markAsRead(Request $request)
    {
        try {
            $request->validate([
                'room_name' => 'required|string'
            ]);

            $user = Auth::user();
            $roomName = $request->room_name;

            // Verificar acceso
            if (!$this->userHasAccessToRoom($user->id, $roomName)) {
                return response()->json(['error' => 'Acceso denegado'], 403);
            }

            // Marcar mensajes del otro usuario como leídos
            $updatedCount = ChatMessage::where('room_name', $roomName)
                ->where('user_id', '!=', $user->id)
                ->whereNull('read_at')
                ->update(['read_at' => now()]);


            return response()->json([
                'success' => true,
                'marked_count' => $updatedCount
            ]);

        } catch (\Exception $e) {
        }
    }

    /**
     * Eliminar mensaje (solo del usuario actual)
     */
    public function deleteMessage($id)
    {
        try {
            $user = Auth::user();
            
            $message = ChatMessage::where('id', $id)
                ->where('user_id', $user->id)
                ->first();

            if (!$message) {
                return response()->json(['error' => 'Mensaje no encontrado'], 404);
            }

            $message->delete();
            
            
            return response()->json([
                'success' => true,
                'message' => 'Mensaje eliminado'
            ]);

        } catch (\Exception $e) {
    
        }
    }

    /**
     * Generar nombre único para room de conversación
     */
    private function generateRoomName($userId1, $userId2)
    {
        // Ordenar IDs para que siempre genere el mismo room_name
        $ids = [$userId1, $userId2];
        sort($ids);
        return "chat_user_{$ids[0]}_{$ids[1]}";
    }

    /**
     * Verificar si el usuario tiene acceso a esta conversación
     */
    private function userHasAccessToRoom($userId, $roomName)
    {
        Log::debug('🔍 [ChatController] Validando acceso a sala', [
            'user_id' => $userId,
            'room_name' => $roomName,
            'is_videochat' => strpos($roomName, 'omegle_') === 0
        ]);

        // Para salas de videochat (omegle_*), verificar participación en sesiones activas
        if (strpos($roomName, 'omegle_') === 0) {
            $hasAccess = $this->userParticipatesInVideoSession($userId, $roomName);
            Log::debug('🎥 [ChatController] Resultado validación videollamada', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'has_access' => $hasAccess
            ]);
            return $hasAccess;
        }
        
        // Para chats normales, usar la lógica original
        $hasAccess = strpos($roomName, "_{$userId}_") !== false || 
                    strpos($roomName, "chat_user_{$userId}_") === 0 ||
                    preg_match("/chat_user_\d+_{$userId}$/", $roomName);
        
        Log::debug('💬 [ChatController] Resultado validación chat normal', [
            'user_id' => $userId,
            'room_name' => $roomName,
            'has_access' => $hasAccess
        ]);
        
        return $hasAccess;
    }

    private function userParticipatesInVideoSession($userId, $roomName)
    {
        try {
            Log::info('🔍 [ChatController] Validando acceso a sala de videollamada', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'room_name_length' => strlen($roomName)
            ]);

            // Buscar sesión con este room_name exacto - estados más permisivos
            $session = ChatSession::where('room_name', $roomName)
                ->whereIn('status', ['active', 'waiting', 'connected', 'ongoing', 'calling'])
                ->where(function($query) use ($userId) {
                    $query->where('cliente_id', $userId)
                          ->orWhere('modelo_id', $userId);
                })
                ->first();

            if ($session) {
                Log::info('✅ [ChatController] Sesión encontrada con room_name exacto', [
                    'user_id' => $userId,
                    'room_name' => $roomName,
                    'session_id' => $session->id,
                    'status' => $session->status,
                    'cliente_id' => $session->cliente_id,
                    'modelo_id' => $session->modelo_id
                ]);
                return true;
            }

            // Si no encuentra con room_name exacto, intentar búsqueda parcial
            // Esto ayuda si hay diferencias menores en el formato
            $partialSession = ChatSession::where('room_name', 'like', $roomName . '%')
                ->orWhere('room_name', 'like', '%' . $roomName)
                ->whereIn('status', ['active', 'waiting', 'connected', 'ongoing', 'calling'])
                ->where(function($query) use ($userId) {
                    $query->where('cliente_id', $userId)
                          ->orWhere('modelo_id', $userId);
                })
                ->first();

            if ($partialSession) {
                Log::info('✅ [ChatController] Sesión encontrada con búsqueda parcial', [
                    'user_id' => $userId,
                    'requested_room_name' => $roomName,
                    'found_room_name' => $partialSession->room_name,
                    'session_id' => $partialSession->id,
                    'status' => $partialSession->status
                ]);
                return true;
            }

            // Último intento: verificar si el usuario está en alguna sesión activa
            // aunque el room_name no coincida exactamente (por si hay problemas de sincronización)
            $anyActiveSession = ChatSession::whereIn('status', ['active', 'waiting', 'connected', 'ongoing', 'calling'])
                ->where(function($query) use ($userId) {
                    $query->where('cliente_id', $userId)
                          ->orWhere('modelo_id', $userId);
                })
                ->where('session_type', 'call')
                ->first();

            if ($anyActiveSession) {
                Log::warning('⚠️ [ChatController] Usuario tiene sesión activa pero room_name no coincide', [
                    'user_id' => $userId,
                    'requested_room_name' => $roomName,
                    'found_session_room_name' => $anyActiveSession->room_name,
                    'session_id' => $anyActiveSession->id,
                    'status' => $anyActiveSession->status
                ]);
                // Permitir acceso si el usuario está en una sesión activa
                // Esto previene bloqueos por problemas de sincronización de nombres
                return true;
            }

            Log::warning('❌ [ChatController] No se encontró sesión válida para el usuario', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'searched_states' => ['active', 'waiting', 'connected', 'ongoing', 'calling']
            ]);

            return false;
            
        } catch (\Exception $e) {
            Log::error('❌ [ChatController] Error validando acceso a sala de videollamada', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    public function getMessagesByUser($otherUserId)
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['error' => 'No autenticado'], 401);
            }

            // Validar que el otro usuario existe
            $otherUser = User::find($otherUserId);
            if (!$otherUser) {
                return response()->json(['error' => 'Usuario no encontrado'], 404);
            }

            // 🔥 VERIFICAR BLOQUEOS
            $isBlocked = DB::table('user_blocks')
                ->where(function($query) use ($user, $otherUserId) {
                    // Yo bloqueé al otro usuario
                    $query->where('user_id', $user->id)
                        ->where('blocked_user_id', $otherUserId);
                })
                ->orWhere(function($query) use ($user, $otherUserId) {
                    // El otro usuario me bloqueó
                    $query->where('user_id', $otherUserId)
                        ->where('blocked_user_id', $user->id);
                })
                ->where('is_active', true)
                ->exists();

            if ($isBlocked) {
                Log::info('🚫 Acceso denegado por bloqueo:', [
                    'user_id' => $user->id,
                    'other_user_id' => $otherUserId
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'Usuario bloqueado'
                ], 403);
            }

            // 🔥 GENERAR TODAS LAS POSIBLES SALAS ENTRE ESTOS DOS USUARIOS
            $mainRoomName = $this->generateRoomName($user->id, $otherUserId);
            
            // Salas posibles:
            $possibleRooms = [
                $mainRoomName,                                    // chat_user_1_2
                "{$mainRoomName}_client",                        // chat_user_1_2_client  
                "{$mainRoomName}_modelo",                        // chat_user_1_2_modelo
                "conversation_{$user->id}_{$otherUserId}",       // conversation_1_2
                "conversation_{$otherUserId}_{$user->id}",       // conversation_2_1
            ];

            // También incluir salas de videochat si existen
            $videoSessions = ChatSession::where(function($query) use ($user, $otherUserId) {
                $query->where('cliente_id', $user->id)->where('modelo_id', $otherUserId);
            })->orWhere(function($query) use ($user, $otherUserId) {
                $query->where('cliente_id', $otherUserId)->where('modelo_id', $user->id);
            })->pluck('room_name')->toArray();

            $possibleRooms = array_merge($possibleRooms, $videoSessions);
            $possibleRooms = array_unique($possibleRooms);

            Log::info('🔍 Buscando mensajes en salas:', [
                'user_id' => $user->id,
                'other_user_id' => $otherUserId,
                'possible_rooms' => $possibleRooms
            ]);

            // 🔥 BUSCAR MENSAJES EN TODAS LAS SALAS POSIBLES
            $allMessages = ChatMessage::whereIn('room_name', $possibleRooms)
                ->where(function($query) use ($user, $otherUserId) {
                    // Solo mensajes entre estos dos usuarios
                    $query->where('user_id', $user->id)
                        ->orWhere('user_id', $otherUserId);
                })
                ->orderBy('created_at', 'asc')
                ->get()
                ->map(function ($message) {
                    return [
                        'id' => $message->id,
                        'user_id' => $message->user_id,
                        'user_name' => $message->user_name,
                        'user_role' => $message->user_role,
                        'message' => $message->message,
                        'type' => $message->type ?? 'text',
                        'extra_data' => $message->extra_data,
                        'room_name' => $message->room_name,
                        'created_at' => $message->created_at->toISOString()
                    ];
                });

            // 🔥 DEBUG: Contar mensajes por sala
            $messagesByRoom = [];
            foreach ($possibleRooms as $room) {
                $count = ChatMessage::where('room_name', $room)
                    ->where(function($query) use ($user, $otherUserId) {
                        $query->where('user_id', $user->id)
                            ->orWhere('user_id', $otherUserId);
                    })
                    ->count();
                
                if ($count > 0) {
                    $messagesByRoom[$room] = $count;
                }
            }

            Log::info('✅ Mensajes encontrados por sala:', [
                'user_id' => $user->id,
                'other_user_id' => $otherUserId,
                'messages_by_room' => $messagesByRoom,
                'total_messages' => $allMessages->count()
            ]);

            return response()->json([
                'success' => true,
                'messages' => $allMessages,
                'other_user' => [
                    'id' => $otherUser->id,
                    'name' => $otherUser->alias ?? $otherUser->name,
                    'role' => $otherUser->rol
                ],
                'debug' => [
                    'total_messages' => $allMessages->count(),
                    'searched_rooms' => $possibleRooms,
                    'messages_by_room' => $messagesByRoom,
                    'main_room_name' => $mainRoomName
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error obteniendo mensajes por usuario:', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'other_user_id' => $otherUserId,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function startConversation(Request $request)
    {
        try {
            $request->validate([
                'other_user_id' => 'required|integer|exists:users,id'
            ]);

            $user = Auth::user();
            $otherUserId = $request->other_user_id;
            
            // No permitir conversación consigo mismo
            if ($user->id == $otherUserId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No puedes iniciar conversación contigo mismo'
                ], 400);
            }

            // Obtener información del otro usuario
            $otherUser = User::find($otherUserId);
            if (!$otherUser) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no encontrado'
                ], 404);
            }

            // 🔥 VALIDAR QUE LOS ROLES SEAN COMPATIBLES
            // Un modelo solo puede chatear con clientes, y viceversa
            if ($user->rol === 'modelo' && $otherUser->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Los modelos solo pueden iniciar conversaciones con clientes'
                ], 400);
            }

            if ($user->rol === 'cliente' && $otherUser->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Los clientes solo pueden iniciar conversaciones con modelos'
                ], 400);
            }

            Log::info('🚀 Iniciando conversación', [
                'current_user_id' => $user->id,
                'current_user_role' => $user->rol,
                'other_user_id' => $otherUserId,
                'other_user_role' => $otherUser->rol
            ]);

            // 🔥 VERIFICAR BLOQUEOS ANTES DE CREAR LA CONVERSACIÓN
            
            // Verificar si YO bloqueé al otro usuario
            $iBlockedThem = DB::table('user_blocks')
                ->where('user_id', $user->id)
                ->where('blocked_user_id', $otherUserId)
                ->where('is_active', true)
                ->exists();

            // Verificar si el otro usuario ME bloqueó
            $theyBlockedMe = DB::table('user_blocks')
                ->where('user_id', $otherUserId)
                ->where('blocked_user_id', $user->id)
                ->where('is_active', true)
                ->exists();

            if ($iBlockedThem) {
                Log::info('🚫 Conversación bloqueada: Usuario bloqueó al destinatario', [
                    'user_id' => $user->id,
                    'blocked_user_id' => $otherUserId
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'blocked_by_you',
                    'message' => 'Has bloqueado a este usuario'
                ], 403);
            }

            if ($theyBlockedMe) {
                Log::info('🚫 Conversación bloqueada: Destinatario bloqueó al usuario', [
                    'user_id' => $user->id,
                    'blocked_by' => $otherUserId
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'blocked_by_them',
                    'message' => 'Este usuario te ha bloqueado'
                ], 403);
            }

            // Generar room_name consistente
            $roomName = $this->generateRoomName($user->id, $otherUserId);

            Log::info('🏠 Room name generado', [
                'room_name' => $roomName,
                'user1_id' => $user->id,
                'user2_id' => $otherUserId
            ]);

            // 🔥 BUSCAR SESIÓN EXISTENTE O CREAR NUEVA
            
            // Primero buscar si ya existe una sesión entre estos usuarios
            $existingSession = ChatSession::where(function($query) use ($user, $otherUserId) {
                $query->where(function($subQuery) use ($user, $otherUserId) {
                    $subQuery->where('cliente_id', $user->id)
                            ->where('modelo_id', $otherUserId);
                })->orWhere(function($subQuery) use ($user, $otherUserId) {
                    $subQuery->where('cliente_id', $otherUserId)
                            ->where('modelo_id', $user->id);
                });
            })
            ->whereIn('status', ['waiting', 'active', 'ended']) // Incluir ended para permitir reactivar
            ->orderBy('updated_at', 'desc')
            ->first();

            if ($existingSession) {
                Log::info('✅ Sesión existente encontrada', [
                    'session_id' => $existingSession->id,
                    'room_name' => $existingSession->room_name,
                    'status' => $existingSession->status
                ]);

                // Si la sesión está ended, actualizarla para reactivar
                if ($existingSession->status === 'ended') {
                    $existingSession->update([
                        'status' => 'waiting',
                        'updated_at' => now()
                    ]);
                    
                    Log::info('🔄 Sesión reactivada', [
                        'session_id' => $existingSession->id
                    ]);
                }

                $session = $existingSession;
                $roomName = $session->room_name; // Usar el room_name de la sesión existente
            } else {
                // Crear nueva sesión de chat
                
                // Determinar roles: el cliente siempre va en cliente_id, modelo en modelo_id
                $clienteId = null;
                $modeloId = null;

                if ($user->rol === 'cliente') {
                    $clienteId = $user->id;
                    $modeloId = ($otherUser->rol === 'modelo') ? $otherUserId : null;
                } elseif ($user->rol === 'modelo') {
                    $modeloId = $user->id;
                    $clienteId = ($otherUser->rol === 'cliente') ? $otherUserId : null;
                }

                Log::info('👥 Roles asignados', [
                    'cliente_id' => $clienteId,
                    'modelo_id' => $modeloId,
                    'current_user_role' => $user->rol,
                    'other_user_role' => $otherUser->rol
                ]);

                // 🔥 VALIDAR QUE TENEMOS AMBOS ROLES ANTES DE CREAR
                if (!$clienteId || !$modeloId) {
                    Log::error('❌ Error: Faltan roles para crear sesión', [
                        'cliente_id' => $clienteId,
                        'modelo_id' => $modeloId,
                        'current_user_role' => $user->rol,
                        'other_user_role' => $otherUser->rol
                    ]);

                    return response()->json([
                        'success' => false,
                        'error' => 'No se pudo determinar los roles de la conversación'
                    ], 400);
                }

                // 🔥 VERIFICAR SI EL ROOM_NAME YA EXISTE
                $existingRoom = ChatSession::where('room_name', $roomName)->first();
                if ($existingRoom) {
                    Log::info('🔄 Room name ya existe, usando sesión existente', [
                        'existing_session_id' => $existingRoom->id,
                        'room_name' => $roomName
                    ]);
                    $session = $existingRoom;
                } else {
                    try {
                        $session = ChatSession::create([
                            'cliente_id' => $clienteId,
                            'modelo_id' => $modeloId,
                            'session_type' => 'chat',
                            'room_name' => $roomName,
                            'status' => 'waiting'
                        ]);

                        Log::info('✅ Nueva sesión de chat creada', [
                            'session_id' => $session->id,
                            'room_name' => $roomName
                        ]);
                    } catch (\Illuminate\Database\QueryException $e) {
                        // Si falla por room_name duplicado, buscar la sesión existente
                        if ($e->getCode() == 23000) { // Integrity constraint violation
                            Log::warning('⚠️ Room name duplicado, buscando sesión existente', [
                                'room_name' => $roomName,
                                'error' => $e->getMessage()
                            ]);
                            
                            $session = ChatSession::where('room_name', $roomName)->first();
                            if (!$session) {
                                throw $e; // Si no existe, lanzar el error original
                            }
                        } else {
                            throw $e; // Otro tipo de error, lanzarlo
                        }
                    }
                }
            }

            // 🔥 FORMATEAR RESPUESTA DE CONVERSACIÓN
            
            // Obtener último mensaje si existe
            $lastMessage = ChatMessage::where('room_name', $roomName)
                ->orderBy('created_at', 'desc')
                ->first();

            // Contar mensajes no leídos
            $unreadCount = ChatMessage::where('room_name', $roomName)
                ->where('user_id', '!=', $user->id)
                ->where('read_at', null)
                ->count();

            $conversationData = [
                'id' => $session->id,
                'other_user_id' => $otherUserId,
                'other_user_name' => $otherUser->alias ?? $otherUser->name,
                'other_user_role' => $otherUser->rol,
                'room_name' => $roomName,
                'last_message' => $lastMessage ? $lastMessage->message : 'Conversación iniciada',
                'last_message_time' => $lastMessage ? $lastMessage->created_at->toISOString() : $session->updated_at->toISOString(),
                'last_message_sender_id' => $lastMessage ? $lastMessage->user_id : null,
                'unread_count' => $unreadCount,
                'session_status' => $session->status,
                'avatar' => "https://i.pravatar.cc/40?u={$otherUserId}"
            ];

            Log::info('✅ Conversación iniciada exitosamente', [
                'session_id' => $session->id,
                'room_name' => $roomName,
                'conversation_data' => $conversationData
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Conversación iniciada correctamente',
                'conversation' => $conversationData,
                'room_name' => $roomName,
                'session_id' => $session->id
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Datos inválidos',
                'errors' => $e->errors()
            ], 422);
            
        } catch (\Illuminate\Database\QueryException $e) {
            Log::error('❌ Error de base de datos iniciando conversación:', [
                'error' => $e->getMessage(),
                'error_code' => $e->getCode(),
                'sql_state' => $e->errorInfo[0] ?? null,
                'user_id' => Auth::id() ?? 'null',
                'other_user_id' => $request->other_user_id ?? 'null',
                'sql' => $e->getSql() ?? null
            ]);

            // Si es un error de constraint único, dar mensaje más específico
            if ($e->getCode() == 23000) {
                return response()->json([
                    'success' => false,
                    'error' => 'Ya existe una conversación con este usuario'
                ], 409);
            }

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor',
                'message' => 'Error de base de datos al crear la conversación'
            ], 500);
            
        } catch (\Exception $e) {
            Log::error('❌ Error iniciando conversación:', [
                'error' => $e->getMessage(),
                'error_class' => get_class($e),
                'user_id' => Auth::id() ?? 'null',
                'other_user_id' => $request->other_user_id ?? 'null',
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'stack_trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor',
                'message' => $e->getMessage()
            ], 500);
        }
    }

}