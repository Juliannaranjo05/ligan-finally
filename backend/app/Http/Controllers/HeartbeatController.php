<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Models\UserOnlineStatus;     // ← Línea 67 (o donde esté el modelo)
use App\Models\ChatSession;

class HeartbeatController extends Controller
{
    public function updateHeartbeat(Request $request)
    {
        try {
            $user = auth()->user();
            if (!$user) {
                return response()->json(['success' => false, 'error' => 'No autenticado'], 401);
            }

            $activityType = $request->input('activity_type', 'browsing');
            $roomName = $request->input('room');
            
            if (config('app.debug')) {
                Log::info('💓 Heartbeat recibido', [
                    'user_id' => $user->id,
                    'activity_type' => $activityType,
                    'room' => $roomName,
                    'timestamp' => now()->toISOString()
                ]);
            }

            // 🔥 VALIDACIONES ESPECÍFICAS PARA VIDEOCHAT (con manejo de errores)
            if (in_array($activityType, ['videochat', 'videochat_client', 'videochat_model'])) {
                try {
                    if (!$roomName) {
                        Log::warning('⚠️ Heartbeat de videochat sin room_name', [
                            'user_id' => $user->id,
                            'activity_type' => $activityType
                        ]);
                        // No fallar, solo cambiar a browsing
                        $activityType = 'browsing';
                        $roomName = null;
                    } else {
                        // Verificar que la sesión existe y el usuario pertenece a ella
                        $session = ChatSession::where('room_name', $roomName)
                            ->whereIn('status', ['active', 'waiting'])
                            ->where(function($query) use ($user) {
                                $query->where('cliente_id', $user->id)
                                    ->orWhere('modelo_id', $user->id);
                            })
                            ->first();
                            
                        if (!$session) {
                            Log::warning('⚠️ Usuario enviando heartbeat para sesión inexistente', [
                                'user_id' => $user->id,
                                'room_name' => $roomName,
                                'activity_type' => $activityType
                            ]);
                            // No fallar, cambiar a browsing
                            $activityType = 'browsing';
                            $roomName = null;
                        } else {
                            // Actualizar timestamp de la sesión
                            $session->touch();
                        }
                    }
                } catch (\Exception $sessionError) {
                    Log::warning('⚠️ Error validando sesión de videochat, continuando como browsing', [
                        'error' => $sessionError->getMessage(),
                        'user_id' => $user->id
                    ]);
                    $activityType = 'browsing';
                    $roomName = null;
                }
            }

            // Actualizar o crear estado online - CON MANEJO DE ERRORES ROBUSTO
            try {
                // Validar activity_type antes de guardar
                $validActivityTypes = ['browsing', 'searching', 'idle', 'videochat', 'videochat_model', 'videochat_client'];
                if (!in_array($activityType, $validActivityTypes)) {
                    $activityType = 'browsing';
                }
                
                $userStatus = UserOnlineStatus::firstOrCreate(
                    ['user_id' => $user->id],
                    [
                        'is_online' => true,
                        'last_seen' => now(),
                        'connected_at' => now(),
                        'activity_type' => $activityType,
                        'current_room' => $roomName ?: null,
                    ]
                );
                
                // Actualizar heartbeat de forma segura
                if ($userStatus && method_exists($userStatus, 'updateHeartbeatSafe')) {
                    $updateResult = $userStatus->updateHeartbeatSafe($roomName ?: null, $activityType);
                    if (!$updateResult) {
                        Log::warning('⚠️ updateHeartbeatSafe retornó false', [
                            'user_id' => $user->id
                        ]);
                    }
                } else {
                    // Fallback si el método no existe
                    $userStatus->update([
                        'last_seen' => now(),
                        'activity_type' => $activityType,
                        'current_room' => $roomName ?: null,
                        'is_online' => true
                    ]);
                }
            } catch (\Illuminate\Database\QueryException $dbError) {
                Log::error('❌ Error de base de datos actualizando UserOnlineStatus', [
                    'user_id' => $user->id,
                    'error' => $dbError->getMessage(),
                    'sql' => $dbError->getSql() ?? 'N/A'
                ]);
                // Continuar sin lanzar excepción
            } catch (\Exception $e) {
                Log::error('❌ Error actualizando UserOnlineStatus en heartbeat', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                // No lanzar excepción, solo loggear - el heartbeat puede continuar
            }

            // 🔥 CLEANUP AUTOMÁTICO: Finalizar sesiones de usuarios inactivos (con manejo de errores)
            if (in_array($activityType, ['videochat', 'videochat_client', 'videochat_model'])) {
                $cleanupKey = "heartbeat_cleanup_{$user->id}";
                if (Cache::add($cleanupKey, true, 60)) {
                    try {
                        $this->cleanupInactiveVideoSessions($roomName, $user->id);
                    } catch (\Exception $cleanupError) {
                        // No fallar el heartbeat por errores en cleanup
                        Log::warning('⚠️ Error en cleanup de sesiones inactivas', [
                            'error' => $cleanupError->getMessage(),
                            'user_id' => $user->id
                        ]);
                    }
                }
            }

            // 🔥 SIEMPRE DEVOLVER ÉXITO, incluso si hubo errores menores
            return response()->json([
                'success' => true,
                'timestamp' => now()->toISOString(),
                'activity_type' => $activityType
            ]);

        } catch (\Illuminate\Database\QueryException $dbError) {
            Log::error('❌ Error de base de datos procesando heartbeat', [
                'error' => $dbError->getMessage(),
                'user_id' => auth()->id(),
                'sql' => $dbError->getSql() ?? 'N/A'
            ]);

            // 🔥 IMPORTANTE: Devolver 200 con success=false para errores de BD
            return response()->json([
                'success' => false,
                'error' => 'Error de base de datos',
                'message' => 'El heartbeat no pudo ser procesado, pero la sesión sigue activa'
            ], 200);
            
        } catch (\Exception $e) {
            Log::error('❌ Error procesando heartbeat', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id(),
                'trace' => $e->getTraceAsString()
            ]);

            // 🔥 IMPORTANTE: No devolver 500 para errores de heartbeat
            // Devolver 200 con success=false para que no dispare modales de sesión cerrada
            return response()->json([
                'success' => false,
                'error' => 'Error procesando heartbeat',
                'message' => 'El heartbeat no pudo ser procesado, pero la sesión sigue activa'
            ], 200); // 🔥 CAMBIAR A 200 en lugar de 500
        }
    }

    // 🔥 NUEVA FUNCIÓN: Limpiar sesiones inactivas automáticamente
    private function cleanupInactiveVideoSessions($currentRoomName, $currentUserId)
    {
        try {
            if (config('app.debug')) {
                Log::info('🧹 Iniciando cleanup automático de sesiones inactivas', [
                    'current_room' => $currentRoomName,
                    'current_user' => $currentUserId
                ]);
            }

            // Buscar sesiones activas donde hay usuarios sin heartbeat reciente
            $activeSessions = ChatSession::where('status', 'active')
                ->where('updated_at', '>=', now()->subMinutes(10)) // Solo sesiones relativamente recientes
                ->get();

            foreach ($activeSessions as $session) {
                // Saltar la sesión actual del usuario
                if ($session->room_name === $currentRoomName) {
                    continue;
                }

                $shouldCleanup = false;
                $inactiveUsers = [];

                // Verificar cliente
                if ($session->cliente_id) {
                    $clienteActive = UserOnlineStatus::where('user_id', $session->cliente_id)
                        ->where('last_seen', '>=', now()->subSeconds(60)) // 60 segundos de tolerancia
                        ->where('activity_type', 'videochat_client')
                        ->exists();

                    if (!$clienteActive) {
                        $inactiveUsers[] = "cliente_{$session->cliente_id}";
                        $shouldCleanup = true;
                    }
                }

                // Verificar modelo
                if ($session->modelo_id) {
                    $modeloActive = UserOnlineStatus::where('user_id', $session->modelo_id)
                        ->where('last_seen', '>=', now()->subSeconds(60)) // 60 segundos de tolerancia
                        ->where('activity_type', 'videochat')
                        ->exists();

                    if (!$modeloActive) {
                        $inactiveUsers[] = "modelo_{$session->modelo_id}";
                        $shouldCleanup = true;
                    }
                }

                // Limpiar sesión si hay usuarios inactivos
                if ($shouldCleanup) {
                    Log::warning('🧹 Finalizando sesión con usuarios inactivos', [
                        'session_id' => $session->id,
                        'room_name' => $session->room_name,
                        'inactive_users' => $inactiveUsers
                    ]);

                    $session->update([
                        'status' => 'ended',
                        'ended_at' => now(),
                        'end_reason' => 'users_inactive_cleanup'
                    ]);

                    // Notificar a usuarios activos restantes
                    $this->notifyRemainingUsers($session, $inactiveUsers);
                }
            }

        } catch (\Exception $e) {
            Log::error('❌ Error en cleanup automático', [
                'error' => $e->getMessage(),
                'current_room' => $currentRoomName
            ]);
        }
    }

    // 🔥 NOTIFICAR A USUARIOS RESTANTES CUANDO HAY CLEANUP
    private function notifyRemainingUsers($session, $inactiveUsers)
    {
        try {
            $activeUsers = [];
            
            // Identificar usuarios que siguen activos
            if ($session->cliente_id) {
                $clienteActive = UserOnlineStatus::where('user_id', $session->cliente_id)
                    ->where('last_seen', '>=', now()->subSeconds(60))
                    ->exists();
                    
                if ($clienteActive && !in_array("cliente_{$session->cliente_id}", $inactiveUsers)) {
                    $activeUsers[] = [
                        'id' => $session->cliente_id,
                        'role' => 'cliente'
                    ];
                }
            }
            
            if ($session->modelo_id) {
                $modeloActive = UserOnlineStatus::where('user_id', $session->modelo_id)
                    ->where('last_seen', '>=', now()->subSeconds(60))
                    ->exists();
                    
                if ($modeloActive && !in_array("modelo_{$session->modelo_id}", $inactiveUsers)) {
                    $activeUsers[] = [
                        'id' => $session->modelo_id,
                        'role' => 'modelo'
                    ];
                }
            }

            // Enviar notificaciones a usuarios activos
            foreach ($activeUsers as $user) {
                DB::table('notifications')->insert([
                    'user_id' => $user['id'],
                    'type' => 'partner_disconnected_cleanup',
                    'data' => json_encode([
                        'message' => 'Tu partner se desconectó inesperadamente',
                        'room_name' => $session->room_name,
                        'reason' => 'partner_inactive',
                        'redirect_url' => '/usersearch',
                        'redirect_params' => [
                            'role' => $user['role'],
                            'from' => 'partner_disconnected',
                            'action' => 'find_new_partner'
                        ]
                    ]),
                    'read' => false,
                    'expires_at' => now()->addMinutes(10),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
                
                Log::info('📨 Notificación de desconexión enviada', [
                    'user_id' => $user['id'],
                    'user_role' => $user['role'],
                    'session_id' => $session->id
                ]);
            }

        } catch (\Exception $e) {
            Log::error('❌ Error notificando usuarios restantes', [
                'error' => $e->getMessage(),
                'session_id' => $session->id
            ]);
        }
    }

    // 🔥 ENDPOINT PARA VERIFICAR ESTADO GLOBAL DEL USUARIO
    public function checkUserGlobalStatus(Request $request)
    {
        try {
            $user = auth()->user();
            if (!$user) {
                return response()->json(['success' => false, 'error' => 'No autenticado'], 401);
            }

            // Verificar si tiene sesiones activas
            $activeSessions = ChatSession::where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                    ->orWhere('modelo_id', $user->id);
            })
            ->whereIn('status', ['active', 'waiting'])
            ->get();

            $currentStatus = UserOnlineStatus::where('user_id', $user->id)->first();

            $response = [
                'success' => true,
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'active_sessions_count' => $activeSessions->count(),
                'current_activity' => $currentStatus ? $currentStatus->activity_type : 'offline',
                'current_room' => $currentStatus ? $currentStatus->current_room : null,
                'last_seen' => $currentStatus ? $currentStatus->last_seen->toISOString() : null,
                'sessions' => []
            ];

            // Detalles de sesiones activas
            foreach ($activeSessions as $session) {
                $response['sessions'][] = [
                    'id' => $session->id,
                    'room_name' => $session->room_name,
                    'status' => $session->status,
                    'created_at' => $session->created_at->toISOString(),
                    'user_role_in_session' => $session->cliente_id == $user->id ? 'cliente' : 'modelo'
                ];
            }

            // 🔥 DETECTAR INCONSISTENCIAS
            if ($activeSessions->count() > 1) {
                Log::warning('⚠️ Usuario con múltiples sesiones activas', [
                    'user_id' => $user->id,
                    'sessions_count' => $activeSessions->count(),
                    'sessions' => $activeSessions->pluck('room_name')->toArray()
                ]);

                $response['warning'] = 'multiple_active_sessions';
                $response['action'] = 'cleanup_required';
            }

            if ($currentStatus && 
                in_array($currentStatus->activity_type, ['videochat', 'videochat_client']) && 
                $activeSessions->isEmpty()) {
                
                Log::warning('⚠️ Usuario con heartbeat de videochat pero sin sesiones', [
                    'user_id' => $user->id,
                    'activity_type' => $currentStatus->activity_type,
                    'current_room' => $currentStatus->current_room
                ]);

                $response['warning'] = 'heartbeat_without_session';
                $response['action'] = 'sync_required';
            }

            return response()->json($response);

        } catch (\Exception $e) {
            Log::error('❌ Error verificando estado global', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error verificando estado'
            ], 500);
        }
    }

    // 🔥 ENDPOINT PARA CLEANUP FORZADO
    public function forceUserCleanup(Request $request)
    {
        try {
            $user = auth()->user();
            if (!$user) {
                return response()->json(['success' => false, 'error' => 'No autenticado'], 401);
            }

            $reason = $request->input('reason', 'manual_cleanup');
            
            Log::info('🧹 Iniciando cleanup forzado', [
                'user_id' => $user->id,
                'reason' => $reason
            ]);

            DB::beginTransaction();

            // 1. Finalizar todas las sesiones del usuario
            $userSessions = ChatSession::where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                    ->orWhere('modelo_id', $user->id);
            })
            ->whereIn('status', ['active', 'waiting'])
            ->get();

            foreach ($userSessions as $session) {
                $session->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => $reason
                ]);

                Log::info('✅ Sesión finalizada en cleanup', [
                    'session_id' => $session->id,
                    'room_name' => $session->room_name
                ]);
            }

            // 2. Actualizar estado del usuario
            UserOnlineStatus::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'is_online' => true,
                    'last_seen' => now(),
                    'activity_type' => 'browsing',
                    'current_room' => null,
                    'updated_at' => now()
                ]
            );

            // 3. Finalizar sesiones de videochat si existen
            VideoChatSession::where('user_id', $user->id)
                ->where('status', 'active')
                ->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'is_consuming' => false,
                    'end_reason' => $reason
                ]);

            DB::commit();

            Log::info('✅ Cleanup forzado completado', [
                'user_id' => $user->id,
                'sessions_cleaned' => $userSessions->count(),
                'reason' => $reason
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cleanup completado exitosamente',
                'sessions_cleaned' => $userSessions->count()
            ]);

        } catch (\Exception $e) {
            DB::rollback();
            
            Log::error('❌ Error en cleanup forzado', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error en cleanup forzado'
            ], 500);
        }
    }
}