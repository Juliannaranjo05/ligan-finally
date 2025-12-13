<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            // Agregar columna read_at para marcar mensajes como leídos
            $table->timestamp('read_at')->nullable()->after('created_at');
            
            // Índices para optimizar consultas de mensajes no leídos
            $table->index(['room_name', 'user_id', 'read_at'], 'idx_room_user_read');
            $table->index(['room_name', 'created_at'], 'idx_room_created');
            $table->index(['user_id', 'created_at'], 'idx_user_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            // Eliminar índices primero
            $table->dropIndex('idx_room_user_read');
            $table->dropIndex('idx_room_created');  
            $table->dropIndex('idx_user_created');
            
            // Eliminar columna
            $table->dropColumn('read_at');
        });
    }
};