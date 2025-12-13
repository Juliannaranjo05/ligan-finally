<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CleanupNotifications extends Command
{
    protected $signature = 'notifications:cleanup';
    protected $description = 'Limpiar notificaciones expiradas y leídas antiguas';

    public function handle()
    {
        try {
            // Eliminar notificaciones expiradas
            $expiredDeleted = DB::table('notifications')
                ->where('expires_at', '<', now())
                ->delete();
            
            // Eliminar notificaciones leídas de más de 1 hora
            $oldReadDeleted = DB::table('notifications')
                ->where('read', true)
                ->where('updated_at', '<', now()->subHours(1))
                ->delete();
            
            Log::info('🧹 [CLEANUP] Limpieza completada', [
                'expired_deleted' => $expiredDeleted,
                'old_read_deleted' => $oldReadDeleted
            ]);
            
            $this->info("✅ Eliminadas {$expiredDeleted} expiradas, {$oldReadDeleted} leídas");
            
            return 0;
            
        } catch (\Exception $e) {
            Log::error('❌ [CLEANUP] Error:', ['error' => $e->getMessage()]);
            return 1;
        }
    }
}