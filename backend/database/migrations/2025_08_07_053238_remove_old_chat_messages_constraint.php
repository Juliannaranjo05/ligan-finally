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
            // Para MariaDB/MySQL - usar DROP CONSTRAINT
            DB::statement('ALTER TABLE chat_messages DROP CONSTRAINT `chat_messages_type_check`');
        } elseif ($driver === 'pgsql') {
            // Para PostgreSQL
            DB::statement('ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql') {
            // Restaurar el constraint viejo
            DB::statement("
                ALTER TABLE chat_messages 
                ADD CONSTRAINT `chat_messages_type_check` 
                CHECK (`type` IN ('text','image','video','system','gift','gift_request'))
            ");
        } elseif ($driver === 'pgsql') {
            DB::statement("
                ALTER TABLE chat_messages 
                ADD CONSTRAINT chat_messages_type_check 
                CHECK (type IN ('text','image','video','system','gift','gift_request'))
            ");
        }
    }
};