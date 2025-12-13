<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql') {
            // Para MySQL/MariaDB - usar un nombre único para el constraint
            $constraintName = 'chat_messages_type_check_v2';
            
            // Eliminar constraint anterior con diferentes nombres posibles
            $possibleNames = ['chat_messages_type_check', 'chat_messages_chk_1', 'chat_messages_chk_type'];
            
            foreach ($possibleNames as $name) {
                try {
                    DB::statement("ALTER TABLE chat_messages DROP CHECK `{$name}`");
                } catch (\Exception $e) {
                    // Continuar si no existe
                }
            }
            
            // Cambiar la columna a VARCHAR
            DB::statement("
                ALTER TABLE chat_messages 
                MODIFY COLUMN `type` VARCHAR(50) NOT NULL
            ");
            
            // Crear el nuevo constraint con nombre único
            DB::statement("
                ALTER TABLE chat_messages 
                ADD CONSTRAINT `{$constraintName}` 
                CHECK (`type` IN (
                    'text', 
                    'image', 
                    'video', 
                    'audio', 
                    'system', 
                    'gift_request',
                    'gift_sent',
                    'gift_received'
                ))
            ");
            
        } elseif ($driver === 'pgsql') {
            // Para PostgreSQL
            $constraintName = 'chat_messages_type_check_v2';
            
            // Eliminar constraints anteriores
            $possibleNames = ['chat_messages_type_check', 'chat_messages_type_check_v1'];
            
            foreach ($possibleNames as $name) {
                DB::statement("ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS {$name}");
            }
            
            // Crear el nuevo constraint
            DB::statement("
                ALTER TABLE chat_messages 
                ADD CONSTRAINT {$constraintName} 
                CHECK (type IN (
                    'text', 
                    'image', 
                    'video', 
                    'audio', 
                    'system', 
                    'gift_request',
                    'gift_sent',
                    'gift_received'
                ))
            ");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql') {
            // Eliminar el constraint v2
            try {
                DB::statement('ALTER TABLE chat_messages DROP CHECK `chat_messages_type_check_v2`');
            } catch (\Exception $e) {
                // Continuar si no existe
            }
            
            // Restaurar el constraint original
            try {
                DB::statement("
                    ALTER TABLE chat_messages 
                    ADD CONSTRAINT `chat_messages_type_check` 
                    CHECK (`type` IN (
                        'text', 
                        'image', 
                        'video', 
                        'audio', 
                        'system', 
                        'gift_request'
                    ))
                ");
            } catch (\Exception $e) {
                // Continuar si falla
            }
            
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check_v2');
            
            DB::statement("
                ALTER TABLE chat_messages 
                ADD CONSTRAINT chat_messages_type_check 
                CHECK (type IN (
                    'text', 
                    'image', 
                    'video', 
                    'audio', 
                    'system', 
                    'gift_request'
                ))
            ");
        }
    }
};