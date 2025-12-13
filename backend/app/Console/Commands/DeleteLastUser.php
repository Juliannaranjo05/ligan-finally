<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DeleteLastUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:delete-last {--confirm : Confirmar eliminación sin preguntar}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Elimina el último usuario registrado en la tabla users';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // Obtener el último usuario registrado (más reciente por ID)
        $lastUser = User::orderBy('id', 'desc')->first();

        if (!$lastUser) {
            $this->error('❌ No hay usuarios en la base de datos.');
            return Command::FAILURE;
        }

        // Mostrar información del usuario
        $this->info('🔍 Usuario encontrado:');
        $this->line("   ID: {$lastUser->id}");
        $this->line("   Email: {$lastUser->email}");
        $this->line("   Nombre: " . ($lastUser->name ?? 'N/A'));
        $this->line("   Rol: " . ($lastUser->rol ?? 'N/A'));
        $this->line("   Creado: {$lastUser->created_at}");

        // Confirmar eliminación
        if (!$this->option('confirm')) {
            if (!$this->confirm('¿Estás seguro de que deseas eliminar este usuario?', false)) {
                $this->info('❌ Operación cancelada.');
                return Command::SUCCESS;
            }
        }

        try {
            DB::transaction(function () use ($lastUser) {
                // Eliminar tokens de acceso
                $lastUser->tokens()->delete();
                
                // Eliminar registro de estado online si existe
                if (DB::getSchemaBuilder()->hasTable('user_online_status')) {
                    DB::table('user_online_status')->where('user_id', $lastUser->id)->delete();
                }
                
                // Eliminar verificaciones relacionadas
                if (DB::getSchemaBuilder()->hasTable('verificaciones')) {
                    DB::table('verificaciones')->where('user_id', $lastUser->id)->delete();
                }
                
                // Eliminar sesiones de chat
                if (DB::getSchemaBuilder()->hasTable('chat_sessions')) {
                    DB::table('chat_sessions')
                        ->where('cliente_id', $lastUser->id)
                        ->orWhere('modelo_id', $lastUser->id)
                        ->delete();
                }
                
                // Eliminar sesiones de videochat
                if (DB::getSchemaBuilder()->hasTable('video_chat_sessions')) {
                    DB::table('video_chat_sessions')->where('user_id', $lastUser->id)->delete();
                }
                
                // Eliminar códigos de seguridad
                if (DB::getSchemaBuilder()->hasTable('security_codes')) {
                    DB::table('security_codes')->where('user_id', $lastUser->id)->delete();
                }
                
                // Eliminar usuario
                $lastUser->delete();
            });

            $this->info("✅ Usuario eliminado exitosamente: {$lastUser->email} (ID: {$lastUser->id})");
            Log::info("🗑️ Último usuario eliminado: {$lastUser->email} (ID: {$lastUser->id})");

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->error("❌ Error al eliminar usuario: " . $e->getMessage());
            Log::error("❌ Error eliminando último usuario: " . $e->getMessage());
            return Command::FAILURE;
        }
    }
}

