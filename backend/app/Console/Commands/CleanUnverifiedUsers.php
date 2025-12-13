<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\UserOnlineStatus;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class CleanUnverifiedUsers extends Command
{
    protected $signature = 'users:clean-unverified {--dry-run : Solo mostrar qué usuarios se eliminarían}';
    protected $description = 'Elimina usuarios no verificados después de 2 horas';

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        $cutoffTime = Carbon::now()->subHours(2);
        
        $this->info("🧹 Iniciando limpieza de usuarios no verificados...");
        $this->info("⏰ Eliminando usuarios creados antes de: {$cutoffTime->format('Y-m-d H:i:s')}");
        
        // Buscar usuarios no verificados creados hace más de 2 horas
        $unverifiedUsers = User::whereNull('email_verified_at')
            ->where('created_at', '<', $cutoffTime)
            ->get();

        if ($unverifiedUsers->isEmpty()) {
            $this->info("✅ No hay usuarios no verificados para eliminar");
            return Command::SUCCESS;
        }

        $this->info("🔍 Encontrados {$unverifiedUsers->count()} usuarios no verificados para eliminar:");

        if ($dryRun) {
            $this->warn("🔍 MODO DRY-RUN - Solo mostrando lo que se eliminaría:");
            foreach ($unverifiedUsers as $user) {
                $this->line("  - {$user->email} (creado: {$user->created_at->format('Y-m-d H:i:s')})");
            }
            return Command::SUCCESS;
        }

        $deletedCount = 0;
        $bar = $this->output->createProgressBar($unverifiedUsers->count());
        $bar->start();

        foreach ($unverifiedUsers as $user) {
            try {
                DB::transaction(function () use ($user) {
                    // Eliminar tokens de acceso
                    $user->tokens()->delete();
                    
                    // Eliminar registro de estado online si existe
                    UserOnlineStatus::where('user_id', $user->id)->delete();
                    
                    // Eliminar usuario
                    $user->delete();
                });
                
                $deletedCount++;
                
                Log::info("🗑️ Usuario no verificado eliminado: {$user->email} (creado: {$user->created_at})");
                
            } catch (\Exception $e) {
                Log::error("❌ Error eliminando usuario {$user->email}: " . $e->getMessage());
                $this->error("Error eliminando {$user->email}: " . $e->getMessage());
            }
            
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("✅ Limpieza completada: {$deletedCount} usuarios no verificados eliminados");
        Log::info("🧹 Limpieza automática: {$deletedCount} usuarios no verificados eliminados");

        return Command::SUCCESS;
    }
}