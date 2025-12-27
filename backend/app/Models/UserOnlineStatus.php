<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class UserOnlineStatus extends Model
{
    use HasFactory;

    protected $table = 'user_online_status';

    protected $fillable = [
        'user_id',
        'is_online',
        'last_seen',
        'connected_at',
        'disconnected_at',
        'session_id',
        'ip_address',
        'user_agent',
        'current_room',
        'activity_type',
        'heartbeat_interval',
        'metadata',
    ];

    protected $casts = [
        'is_online' => 'boolean',
        'last_seen' => 'datetime',
        'connected_at' => 'datetime',
        'disconnected_at' => 'datetime',
        'metadata' => 'array',
    ];

    // Relación con User
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Scopes para consultas comunes
    public function scopeOnline($query)
    {
        return $query->where('is_online', true);
    }

    public function scopeInVideochat($query)
    {
        return $query->where('activity_type', 'videochat');
    }

    public function scopeAvailableForChat($query)
    {
        return $query->where('is_online', true)
                    ->where('last_seen', '>', now()->subMinutes(2)) // 🔥 AUMENTAR A 2 MINUTOS para dar más margen
                    ->whereIn('activity_type', ['browsing', 'searching', 'idle'])
                    ->whereNotIn('activity_type', ['videochat', 'videochat_model', 'videochat_client']);
    }


    public function scopeRecentlyActive($query, $minutes = 5)
    {
        return $query->where('last_seen', '>', Carbon::now()->subMinutes($minutes));
    }

    // Métodos útiles
    public function markAsOnline($sessionId = null, $ipAddress = null, $userAgent = null, $room = null)
    {
        $this->update([
            'is_online' => true,
            'last_seen' => now(),
            'connected_at' => now(),
            'disconnected_at' => null,
            'session_id' => $sessionId,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'current_room' => $room,
            'activity_type' => $room ? 'videochat' : 'browsing',
        ]);
    }

    public function markAsOffline()
    {
        $this->update([
            'is_online' => false,
            'disconnected_at' => now(),
            'current_room' => null,
            'activity_type' => 'idle',
        ]);
    }

    public function updateHeartbeat($room = null, $activityType = 'browsing')
    {
        $this->update([
            'last_seen' => now(),
            'current_room' => $room,
            'activity_type' => $activityType,
        ]);
    }

    public function isRecentlyActive($minutes = 5)
    {
        return $this->last_seen && $this->last_seen->gt(Carbon::now()->subMinutes($minutes));
    }

    public function getConnectionDuration()
    {
        if (!$this->connected_at) return null;
        
        $endTime = $this->disconnected_at ?? now();
        return $this->connected_at->diffInSeconds($endTime);
    }

    // Método estático para obtener usuarios online por rol
    public static function getOnlineUsersByRole($role, $excludeUserIds = [], $activityType = null)
    {
        $query = static::online()
                      ->recentlyActive()
                      ->whereHas('user', function($q) use ($role) {
                          $q->where('rol', $role);
                      })
                      ->whereNotIn('user_id', $excludeUserIds);

        if ($activityType) {
            $query->where('activity_type', $activityType);
        }

        return $query->with('user')->get();
    }

    // 🔥 FIX: MÉTODO DE LIMPIEZA MEJORADO - EXCLUYE VIDEOCHAT
    public static function cleanupInactiveConnections($minutesThreshold = 10, $excludeUserIds = [])
    {
        Log::info("🧹 Iniciando cleanup de conexiones inactivas", [
            'minutes_threshold' => $minutesThreshold,
            'exclude_count' => count($excludeUserIds)
        ]);

        // 🔥 OBTENER USUARIOS EN VIDEOCHAT ACTIVA
        $usersInVideoChat = static::getUsersInActiveVideoChat();
        
        // 🔥 COMBINAR EXCLUSIONES
        $allExcludedUsers = array_unique(array_merge($excludeUserIds, $usersInVideoChat));
        
        Log::info("👥 Usuarios excluidos del cleanup", [
            'manually_excluded' => $excludeUserIds,
            'in_videochat' => $usersInVideoChat,
            'total_excluded' => count($allExcludedUsers)
        ]);

        // 🔥 QUERY PRINCIPAL EXCLUYENDO VIDEOCHAT
        $query = static::where('is_online', true)
                      ->where('last_seen', '<', Carbon::now()->subMinutes($minutesThreshold));

        // 🔥 EXCLUIR USUARIOS EN VIDEOCHAT
        if (!empty($allExcludedUsers)) {
            $query->whereNotIn('user_id', $allExcludedUsers);
        }

        // 🔥 TAMBIÉN EXCLUIR POR ACTIVITY_TYPE
        $query->whereNotIn('activity_type', [
            'videochat', 
            'videochat_model', 
            'videochat_client'
        ]);

        $affectedRows = $query->update([
            'is_online' => false,
            'disconnected_at' => now(),
            'current_room' => null,
            'activity_type' => 'idle'
        ]);

        Log::info("✅ Cleanup completado", [
            'users_marked_offline' => $affectedRows,
            'users_in_videochat_protected' => count($usersInVideoChat),
            'total_excluded' => count($allExcludedUsers)
        ]);

        return $affectedRows;
    }

    // 🔥 NUEVO: MÉTODO PARA DETECTAR USUARIOS EN VIDEOCHAT
    public static function getUsersInActiveVideoChat()
    {
        // Obtener de ChatSession
        $activeSessions = \App\Models\ChatSession::where('status', 'active')
            ->where('created_at', '>', now()->subMinutes(20)) // Sesiones de últimos 20 minutos
            ->get();

        $usersInVideoChat = [];
        
        foreach ($activeSessions as $session) {
            if ($session->cliente_id) {
                $usersInVideoChat[] = $session->cliente_id;
            }
            if ($session->modelo_id) {
                $usersInVideoChat[] = $session->modelo_id;
            }
        }

        // También obtener de UserOnlineStatus con activity_type de videochat
        $videochatUsers = static::whereIn('activity_type', [
            'videochat', 
            'videochat_model', 
            'videochat_client'
        ])
        ->where('last_seen', '>', now()->subMinutes(10))
        ->pluck('user_id')
        ->toArray();

        // Combinar ambas fuentes
        return array_unique(array_merge($usersInVideoChat, $videochatUsers));
    }

    // 🔥 NUEVO: MÉTODO ESPECÍFICO PARA VIDEOCHAT
    public static function cleanupInactiveConnectionsExcludingVideoChat($minutesThreshold = 10)
    {
        return static::cleanupInactiveConnections($minutesThreshold, []);
    }

    public static function getAvailableUsersForChat($role, $excludeUserIds = [])
    {
        \Illuminate\Support\Facades\Log::info('🔍 Buscando usuarios disponibles para chat', [
            'role' => $role,
            'exclude_count' => count($excludeUserIds)
        ]);

        $query = self::online()
            ->recentlyActive(2) // 🔥 AUMENTAR A 2 MINUTOS para dar más margen al heartbeat
            ->whereHas('user', function($userQuery) use ($role) {
                $userQuery->where('rol', $role);
            })
            ->whereNotIn('user_id', $excludeUserIds)
            ->whereIn('activity_type', ['browsing', 'searching', 'idle']) // 🔥 SOLO ESTADOS DISPONIBLES
            ->whereNotIn('activity_type', ['videochat', 'videochat_model', 'videochat_client']) // 🔥 EXCLUIR VIDEOCHAT
            ->with('user');

        $results = $query->get();

        \Illuminate\Support\Facades\Log::info('✅ Usuarios disponibles encontrados', [
            'role' => $role,
            'total_found' => $results->count(),
            'user_ids' => $results->pluck('user_id')->toArray()
        ]);

        return $results;
    }
    public static function isUserAvailableForChat($userId)
    {
        try {
            $userStatus = self::where('user_id', $userId)
                ->where('is_online', true)
                ->where('last_seen', '>', now()->subMinutes(2)) // 🔥 AUMENTAR A 2 MINUTOS para dar más margen
                ->whereIn('activity_type', ['browsing', 'searching', 'idle'])
                ->first();

            if (!$userStatus) {
                return false;
            }

            // 🔥 VERIFICAR QUE NO ESTÉ EN SESIÓN ACTIVA
            $hasActiveSession = \App\Models\ChatSession::where(function($query) use ($userId) {
                $query->where('cliente_id', $userId)
                    ->orWhere('modelo_id', $userId);
            })
            ->where('status', 'active')
            ->where('updated_at', '>=', now()->subMinutes(5))
            ->exists();

            return !$hasActiveSession;

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('❌ Error verificando disponibilidad de usuario', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    // 3. NUEVO MÉTODO: ACTUALIZAR ESTADO DE HEARTBEAT CON VALIDACIONES
    public function updateHeartbeatSafe($room = null, $activityType = 'browsing')
    {
        try {
            // 🔥 VALIDAR activity_type
            $validActivityTypes = [
                'browsing', 'searching', 'idle', 
                'videochat', 'videochat_model', 'videochat_client'
            ];
            
            if (!in_array($activityType, $validActivityTypes)) {
                $activityType = 'browsing';
            }

            $this->update([
                'last_seen' => now(),
                'current_room' => $room,
                'activity_type' => $activityType,
                'is_online' => true // Asegurar que esté online
            ]);

            \Illuminate\Support\Facades\Log::info('💓 Heartbeat actualizado', [
                'user_id' => $this->user_id,
                'activity_type' => $activityType,
                'current_room' => $room,
                'timestamp' => now()->toISOString()
            ]);

            return true;

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('❌ Error actualizando heartbeat', [
                'user_id' => $this->user_id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
    public function scopeInState($query, $activityType)
    {
        return $query->where('activity_type', $activityType);
    }

    public function scopeNotInVideoChat($query)
    {
        return $query->whereNotIn('activity_type', ['videochat', 'videochat_model', 'videochat_client']);
    }

    // 6. MÉTODO ESTÁTICO: LIMPIAR USUARIOS ZOMBIE (que están online pero sin heartbeat)
    public static function cleanupZombieUsers($minutesThreshold = 5)
    {
        try {
            \Illuminate\Support\Facades\Log::info('🧟 Iniciando limpieza de usuarios zombie');
            
            // Usuarios marcados como online pero sin heartbeat reciente
            $zombieCount = self::where('is_online', true)
                ->where('last_seen', '<', now()->subMinutes($minutesThreshold))
                ->whereNotIn('activity_type', ['videochat', 'videochat_model', 'videochat_client']) // Proteger videochat
                ->update([
                    'is_online' => false,
                    'disconnected_at' => now(),
                    'activity_type' => 'idle',
                    'current_room' => null
                ]);

            \Illuminate\Support\Facades\Log::info('✅ Limpieza de zombies completada', [
                'zombie_users_cleaned' => $zombieCount
            ]);

            return $zombieCount;

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('❌ Error limpiando usuarios zombie', [
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }

    // 7. MÉTODO PARA ESTADÍSTICAS (ÚTIL PARA DEBUG)
    public static function getStatusStats()
    {
        try {
            $stats = [
                'total_online' => self::where('is_online', true)->count(),
                'recently_active' => self::where('is_online', true)
                    ->where('last_seen', '>', now()->subMinutes(5))->count(),
                'by_activity' => self::where('is_online', true)
                    ->groupBy('activity_type')
                    ->selectRaw('activity_type, count(*) as count')
                    ->pluck('count', 'activity_type')
                    ->toArray(),
                'available_for_chat' => self::availableForChat()->count()
            ];

            return $stats;

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('❌ Error obteniendo estadísticas', [
                'error' => $e->getMessage()
            ]);
            
            return [
                'total_online' => 0,
                'recently_active' => 0,
                'by_activity' => [],
                'available_for_chat' => 0
            ];
        }
    }

}