<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\ChatSession;
use App\Models\ChatMessage;
use App\Models\User;
use Carbon\Carbon;

class AdminChatController extends Controller
{
    /**
     * Obtener todas las conversaciones con filtros
     */
    public function getConversations(Request $request)
    {
        try {
            $query = ChatSession::query()
                ->with(['cliente:id,name,email,avatar', 'modelo:id,name,email,avatar'])
                ->where('session_type', 'chat');

            // Filtros
            if ($request->has('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            if ($request->has('user_id')) {
                $query->where(function($q) use ($request) {
                    $q->where('cliente_id', $request->user_id)
                      ->orWhere('modelo_id', $request->user_id);
                });
            }

            if ($request->has('date_from')) {
                $query->where('created_at', '>=', $request->date_from);
            }

            if ($request->has('date_to')) {
                $query->where('created_at', '<=', $request->date_to);
            }

            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->whereHas('cliente', function($q) use ($search) {
                        $q->where('name', 'LIKE', "%{$search}%")
                          ->orWhere('email', 'LIKE', "%{$search}%");
                    })
                    ->orWhereHas('modelo', function($q) use ($search) {
                        $q->where('name', 'LIKE', "%{$search}%")
                          ->orWhere('email', 'LIKE', "%{$search}%");
                    })
                    ->orWhere('room_name', 'LIKE', "%{$search}%");
                });
            }

            $perPage = $request->get('per_page', 20);
            $conversations = $query->latest('created_at')->paginate($perPage);

            $formattedConversations = $conversations->map(function ($session) {
                // Contar mensajes de esta conversación
                $messageCount = ChatMessage::where('room_name', $session->room_name)->count();
                
                // Obtener último mensaje
                $lastMessage = ChatMessage::where('room_name', $session->room_name)
                    ->latest('created_at')
                    ->first();

                return [
                    'id' => $session->id,
                    'room_name' => $session->room_name,
                    'cliente' => $session->cliente ? [
                        'id' => $session->cliente->id,
                        'name' => $session->cliente->name,
                        'email' => $session->cliente->email,
                        'avatar' => $session->cliente->avatar
                    ] : null,
                    'modelo' => $session->modelo ? [
                        'id' => $session->modelo->id,
                        'name' => $session->modelo->name,
                        'email' => $session->modelo->email,
                        'avatar' => $session->modelo->avatar
                    ] : null,
                    'status' => $session->status,
                    'message_count' => $messageCount,
                    'last_message' => $lastMessage ? [
                        'id' => $lastMessage->id,
                        'message' => $lastMessage->message,
                        'type' => $lastMessage->type,
                        'user_name' => $lastMessage->user_name,
                        'created_at' => $lastMessage->created_at
                    ] : null,
                    'started_at' => $session->started_at,
                    'ended_at' => $session->ended_at,
                    'created_at' => $session->created_at,
                    'updated_at' => $session->updated_at
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $formattedConversations,
                'pagination' => [
                    'current_page' => $conversations->currentPage(),
                    'last_page' => $conversations->lastPage(),
                    'per_page' => $conversations->perPage(),
                    'total' => $conversations->total()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo conversaciones (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Obtener mensajes de una conversación específica
     */
    public function getMessages($roomName)
    {
        try {
            $session = ChatSession::where('room_name', $roomName)
                ->with(['cliente:id,name,email,avatar', 'modelo:id,name,email,avatar'])
                ->first();

            if (!$session) {
                return response()->json([
                    'success' => false,
                    'error' => 'Conversación no encontrada'
                ], 404);
            }

            $messages = ChatMessage::where('room_name', $roomName)
                ->with('user:id,name,email,avatar')
                ->orderBy('created_at', 'asc')
                ->get()
                ->map(function ($message) {
                    return [
                        'id' => $message->id,
                        'user_id' => $message->user_id,
                        'user' => $message->user ? [
                            'id' => $message->user->id,
                            'name' => $message->user->name,
                            'email' => $message->user->email,
                            'avatar' => $message->user->avatar
                        ] : [
                            'id' => null,
                            'name' => $message->user_name,
                            'email' => null,
                            'avatar' => null
                        ],
                        'user_name' => $message->user_name,
                        'user_role' => $message->user_role,
                        'message' => $message->message,
                        'type' => $message->type,
                        'extra_data' => $message->extra_data,
                        'created_at' => $message->created_at,
                        'updated_at' => $message->updated_at
                    ];
                });

            return response()->json([
                'success' => true,
                'conversation' => [
                    'id' => $session->id,
                    'room_name' => $session->room_name,
                    'cliente' => $session->cliente,
                    'modelo' => $session->modelo,
                    'status' => $session->status,
                    'started_at' => $session->started_at,
                    'ended_at' => $session->ended_at
                ],
                'messages' => $messages,
                'total_messages' => $messages->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo mensajes (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Eliminar mensaje (moderación)
     */
    public function deleteMessage($id)
    {
        try {
            $adminId = auth()->id() ?? request()->input('admin_user_id') ?? request()->header('ligand-admin-id');

            $message = ChatMessage::find($id);

            if (!$message) {
                return response()->json([
                    'success' => false,
                    'error' => 'Mensaje no encontrado'
                ], 404);
            }

            $messageData = [
                'id' => $message->id,
                'room_name' => $message->room_name,
                'user_id' => $message->user_id,
                'message' => $message->message
            ];

            $message->delete();

            Log::info('Mensaje eliminado por admin', [
                'admin_id' => $adminId,
                'message_id' => $id,
                'message_data' => $messageData
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Mensaje eliminado correctamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error eliminando mensaje (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Bloquear usuario desde admin
     */
    public function blockUser($userId, Request $request)
    {
        try {
            $adminId = auth()->id() ?? $request->input('admin_user_id') ?? $request->header('ligand-admin-id');

            $request->validate([
                'reason' => 'nullable|string|max:500'
            ]);

            $user = User::find($userId);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no encontrado'
                ], 404);
            }

            // Verificar si el usuario ya está bloqueado (hay algún bloqueo activo hacia él)
            $existingActiveBlock = DB::table('user_blocks')
                ->where('blocked_user_id', $userId)
                ->where('is_active', true)
                ->first();

            if ($existingActiveBlock) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario ya está bloqueado'
                ], 400);
            }

            // Crear bloqueo (bloqueado por admin)
            // Nota: En este caso, bloqueamos al usuario para todos, no desde un usuario específico
            // Podríamos usar un user_id especial o crear un campo admin_blocked
            // Por ahora, crearemos un bloqueo desde el mismo usuario (auto-bloqueo administrativo)
            // O mejor: crear bloqueos desde todos los usuarios hacia este usuario
            
            // Alternativa: crear un bloqueo desde un usuario "sistema" o marcar el usuario como bloqueado
            // Por simplicidad, bloquearemos desde todos los usuarios activos hacia este usuario
            // O mejor aún: agregar un campo is_blocked_by_admin en users
            
            // Crear bloqueo desde todos los usuarios activos hacia este usuario
            // Esto efectivamente bloquea al usuario de toda la plataforma
            // Obtener todos los usuarios activos (excepto el bloqueado)
            $activeUsers = User::where('id', '!=', $userId)
                ->whereNotNull('email_verified_at')
                ->pluck('id')
                ->toArray();

            // Crear bloqueos desde todos los usuarios hacia el usuario bloqueado
            $blocksToInsert = [];
            foreach ($activeUsers as $activeUserId) {
                // Verificar si ya existe un bloqueo
                $existingBlock = DB::table('user_blocks')
                    ->where('user_id', $activeUserId)
                    ->where('blocked_user_id', $userId)
                    ->first();

                if (!$existingBlock) {
                    $blocksToInsert[] = [
                        'user_id' => $activeUserId,
                        'blocked_user_id' => $userId,
                        'reason' => $request->reason ?? 'Bloqueado por administrador',
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ];
                } else if (!$existingBlock->is_active) {
                    // Reactivar bloqueo existente
                    DB::table('user_blocks')
                        ->where('id', $existingBlock->id)
                        ->update([
                            'is_active' => true,
                            'reason' => $request->reason ?? $existingBlock->reason,
                            'updated_at' => now()
                        ]);
                }
            }

            // Insertar nuevos bloqueos en lote
            if (!empty($blocksToInsert)) {
                DB::table('user_blocks')->insert($blocksToInsert);
            }

            Log::info('Usuario bloqueado por admin', [
                'admin_id' => $adminId,
                'blocked_user_id' => $userId,
                'reason' => $request->reason
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Usuario bloqueado correctamente',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error bloqueando usuario (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Desbloquear usuario
     */
    public function unblockUser($userId)
    {
        try {
            $adminId = auth()->id() ?? request()->input('admin_user_id') ?? request()->header('ligand-admin-id');

            $user = User::find($userId);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no encontrado'
                ], 404);
            }

            // Desactivar todos los bloqueos hacia este usuario
            $updated = DB::table('user_blocks')
                ->where('blocked_user_id', $userId)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'updated_at' => now()
                ]);

            Log::info('Usuario desbloqueado por admin', [
                'admin_id' => $adminId,
                'unblocked_user_id' => $userId,
                'blocks_updated' => $updated
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Usuario desbloqueado correctamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error desbloqueando usuario (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de chat
     */
    public function getStats()
    {
        try {
            $totalConversations = ChatSession::where('session_type', 'chat')->count();
            $activeConversations = ChatSession::where('session_type', 'chat')
                ->where('status', 'active')
                ->count();
            $totalMessages = ChatMessage::count();
            $messagesToday = ChatMessage::whereDate('created_at', today())->count();
            $messagesThisWeek = ChatMessage::whereBetween('created_at', [
                Carbon::now()->startOfWeek(),
                Carbon::now()->endOfWeek()
            ])->count();
            
            // Usuarios bloqueados
            $blockedUsers = DB::table('user_blocks')
                ->where('is_active', true)
                ->distinct('blocked_user_id')
                ->count('blocked_user_id');

            // Conversaciones más activas (top 5 por cantidad de mensajes)
            $topConversations = DB::table('chat_messages')
                ->select('room_name', DB::raw('COUNT(*) as message_count'))
                ->groupBy('room_name')
                ->orderBy('message_count', 'desc')
                ->limit(5)
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_conversations' => $totalConversations,
                    'active_conversations' => $activeConversations,
                    'total_messages' => $totalMessages,
                    'messages_today' => $messagesToday,
                    'messages_this_week' => $messagesThisWeek,
                    'blocked_users' => $blockedUsers,
                    'top_conversations' => $topConversations
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo estadísticas de chat (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Buscar conversaciones
     */
    public function searchConversations(Request $request)
    {
        try {
            $request->validate([
                'query' => 'required|string|min:2'
            ]);

            $searchQuery = $request->query;

            $conversations = ChatSession::where('session_type', 'chat')
                ->where(function($q) use ($searchQuery) {
                    $q->whereHas('cliente', function($q) use ($searchQuery) {
                        $q->where('name', 'LIKE', "%{$searchQuery}%")
                          ->orWhere('email', 'LIKE', "%{$searchQuery}%");
                    })
                    ->orWhereHas('modelo', function($q) use ($searchQuery) {
                        $q->where('name', 'LIKE', "%{$searchQuery}%")
                          ->orWhere('email', 'LIKE', "%{$searchQuery}%");
                    })
                    ->orWhere('room_name', 'LIKE', "%{$searchQuery}%");
                })
                ->with(['cliente:id,name,email,avatar', 'modelo:id,name,email,avatar'])
                ->latest('created_at')
                ->limit(20)
                ->get()
                ->map(function ($session) {
                    $messageCount = ChatMessage::where('room_name', $session->room_name)->count();
                    return [
                        'id' => $session->id,
                        'room_name' => $session->room_name,
                        'cliente' => $session->cliente,
                        'modelo' => $session->modelo,
                        'status' => $session->status,
                        'message_count' => $messageCount,
                        'created_at' => $session->created_at
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $conversations,
                'count' => $conversations->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error buscando conversaciones (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Buscar mensajes
     */
    public function searchMessages(Request $request)
    {
        try {
            $request->validate([
                'query' => 'required|string|min:2'
            ]);

            $searchQuery = $request->query;

            $messages = ChatMessage::where('message', 'LIKE', "%{$searchQuery}%")
                ->with('user:id,name,email,avatar')
                ->latest('created_at')
                ->limit(50)
                ->get()
                ->map(function ($message) {
                    return [
                        'id' => $message->id,
                        'room_name' => $message->room_name,
                        'user' => $message->user ? [
                            'id' => $message->user->id,
                            'name' => $message->user->name,
                            'email' => $message->user->email
                        ] : [
                            'id' => null,
                            'name' => $message->user_name,
                            'email' => null
                        ],
                        'message' => $message->message,
                        'type' => $message->type,
                        'created_at' => $message->created_at
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $messages,
                'count' => $messages->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error buscando mensajes (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }
}



