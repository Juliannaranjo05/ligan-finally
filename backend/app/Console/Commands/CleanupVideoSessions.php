<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\VideoChatSession;
use App\Models\ChatSession;
use Illuminate\Support\Facades\Log;

class CleanupVideoSessions extends Command
{
    protected $signature = 'videochat:cleanup-sessions';
    protected $description = 'Limpiar sesiones de videochat abandonadas o huérfanas';

    public function handle()
    {
        $this->info('🧹 Iniciando limpieza de sesiones...');

        try {
            $cleaned = 0;

            // 🔥 1. SESIONES SIN CHAT SESSION CORRESPONDIENTE
            $orphanedSessions = VideoChatSession::where('status', 'active')
                ->where('started_at', '<', now()->subMinutes(10))
                ->get()
                ->filter(function($videoSession) {
                    $chatSession = ChatSession::where('room_name', $videoSession->room_name)
                        ->where('status', 'active')
                        ->first();
                    return !$chatSession;
                });

            foreach ($orphanedSessions as $session) {
                $session->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'is_consuming' => false,
                    'end_reason' => 'orphaned_session'
                ]);
                $cleaned++;
            }

            // 🔥 2. SESIONES MUY ANTIGUAS (más de 6 horas)
            $oldSessions = VideoChatSession::where('status', 'active')
                ->where('started_at', '<', now()->subHours(6))
                ->get();

            foreach ($oldSessions as $session) {
                $session->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'is_consuming' => false,
                    'end_reason' => 'session_timeout'
                ]);
                $cleaned++;
            }

            $this->info("✅ Limpieza completada: {$cleaned} sesiones limpiadas");

        } catch (\Exception $e) {
            $this->error('❌ Error en limpieza: ' . $e->getMessage());
            Log::error('Error en limpieza de sesiones', [
                'error' => $e->getMessage()
            ]);
        }
    }
}

// =============================================================================
// 🔥 ARCHIVO 4: VideoChatCoinController.php - MÉTODO ADICIONAL
// =============================================================================

// Agregar este método al VideoChatCoinController existente:

/**
 * 🔥 MÉTODO PARA PROCESAMIENTO INTERNO (usado por el command)
 */


// =============================================================================
// 🔥 INSTRUCCIONES DE IMPLEMENTACIÓN
// =============================================================================

/*
PASOS PARA IMPLEMENTAR:

1. CREAR LOS ARCHIVOS:
   - app/Console/Commands/ProcessVideoChatConsumption.php
   - app/Console/Commands/CleanupVideoSessions.php
   - Actualizar app/Console/Kernel.php

2. EJECUTAR COMANDOS:
   php artisan make:command ProcessVideoChatConsumption
   php artisan make:command CleanupVideoSessions

3. CONFIGURAR CRON (en servidor):
   * * * * * cd /path-to-your-project && php artisan schedule:run >> /dev/null 2>&1

4. PARA DESARROLLO LOCAL:
   php artisan schedule:work

5. TESTING MANUAL:
   php artisan videochat:process-consumption
   php artisan videochat:cleanup-sessions

VENTAJAS DE ESTA SOLUCIÓN:
✅ Más segura (backend only)
✅ No puede ser manipulada por el usuario
✅ Funciona aunque el usuario cierre el navegador
✅ Manejo robusto de errores
✅ Limpieza automática de sesiones
✅ Logging detallado
✅ Procesamiento de ganancias automático
✅ Notificaciones de saldo bajo

MONITOREO:
- Revisa los logs en storage/logs/laravel.log
- Verifica que el cron esté ejecutándose
- Monitorea el consumo de CPU (cada 30 segundos)
*/