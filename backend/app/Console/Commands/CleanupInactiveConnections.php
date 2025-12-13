<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\UserOnlineStatus;
use App\Models\ChatSession;
use Illuminate\Support\Facades\Log;

class CleanupInactiveConnections extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'users:cleanup-inactive {--minutes=10 : Minutes of inactivity before marking as offline}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cleanup inactive user connections and mark them as offline (excluding video chat users)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $minutes = $this->option('minutes');
        
        $this->info("Cleaning up connections inactive for more than {$minutes} minutes...");
        
        // 🔥 FIX: OBTENER USUARIOS EN VIDEOCHAT ACTIVA ANTES DE LIMPIAR
        $usersInVideoChat = $this->getUsersInActiveVideoChat();
        
        $this->info("Found " . count($usersInVideoChat) . " users currently in video chat (will be excluded)");
        
        // 🔥 FIX: PASAR LA LISTA DE EXCLUSIÓN AL MÉTODO DE LIMPIEZA
        $affectedRows = UserOnlineStatus::cleanupInactiveConnectionsExcludingVideoChat($minutes);
        
        $this->info("Marked {$affectedRows} users as offline due to inactivity.");
        $this->info("Excluded " . count($usersInVideoChat) . " users in active video chat.");
        
        // 🔥 FIX: LOG DETALLADO
        Log::info("🧹 Cleanup de usuarios inactivos completado", [
            'minutes_threshold' => $minutes,
            'users_marked_offline' => $affectedRows,
            'users_in_videochat_excluded' => count($usersInVideoChat),
            'excluded_user_ids' => $usersInVideoChat
        ]);
        
        return Command::SUCCESS;
    }

    /**
     * Obtener usuarios que están actualmente en videochat
     */
    private function getUsersInActiveVideoChat()
    {
        $activeSessions = ChatSession::where('status', 'active')
            ->where('created_at', '>', now()->subMinutes(15)) // Sesiones de últimos 15 minutos
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

        return array_unique($usersInVideoChat);
    }
}

// 🔥 TAMBIÉN NECESITAS ACTUALIZAR EL MODELO UserOnlineStatus
// Agrega este método al modelo UserOnlineStatus:

/*
// En app/Models/UserOnlineStatus.php

public static function cleanupInactiveConnections($minutes, $excludeUserIds = [])
{
    $cutoffTime = now()->subMinutes($minutes);
    
    $query = self::where('last_activity', '<', $cutoffTime)
                 ->where('status', 'online');
    
    // 🔥 FIX: EXCLUIR USUARIOS EN VIDEOCHAT
    if (!empty($excludeUserIds)) {
        $query->whereNotIn('user_id', $excludeUserIds);
        
        Log::info("🎥 Excluyendo usuarios en videochat del cleanup", [
            'excluded_count' => count($excludeUserIds),
            'excluded_ids' => $excludeUserIds
        ]);
    }
    
    $affectedRows = $query->update([
        'status' => 'offline',
        'updated_at' => now()
    ]);
    
    if ($affectedRows > 0) {
        Log::info("👥 Usuarios marcados como offline por inactividad", [
            'count' => $affectedRows,
            'minutes_threshold' => $minutes,
            'cutoff_time' => $cutoffTime,
            'excluded_videochat_users' => count($excludeUserIds)
        ]);
    }
    
    return $affectedRows;
}
*/