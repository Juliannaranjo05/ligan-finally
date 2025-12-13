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
        Schema::table('chat_sessions', function (Blueprint $table) {
            // Agregar campos específicos para llamadas
            $table->enum('session_type', ['chat', 'call'])->default('chat')->after('modelo_id');
            $table->enum('call_type', ['video', 'audio'])->nullable()->after('session_type');
            $table->timestamp('answered_at')->nullable()->after('started_at');
            
            // Actualizar el enum status para incluir estados de llamadas
            $table->dropColumn('status');
        });

        // Agregar el nuevo enum con todos los estados
        Schema::table('chat_sessions', function (Blueprint $table) {
            $table->enum('status', [
                'waiting',    // Para chats en espera
                'active',     // Para chats/llamadas activas
                'ended',      // Para chats/llamadas terminadas
                'calling',    // Para llamadas iniciadas sin respuesta
                'rejected',   // Para llamadas rechazadas
                'cancelled'   // Para llamadas canceladas/timeout
            ])->default('waiting')->after('room_name');
        });

        // Crear índices para optimizar consultas
        Schema::table('chat_sessions', function (Blueprint $table) {
            $table->index(['cliente_id', 'status']);
            $table->index(['modelo_id', 'status']);
            $table->index(['session_type', 'status']);
            $table->index('room_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chat_sessions', function (Blueprint $table) {
            // Eliminar campos agregados
            $table->dropColumn(['session_type', 'call_type', 'answered_at']);
            
            // Eliminar índices
            $table->dropIndex(['cliente_id', 'status']);
            $table->dropIndex(['modelo_id', 'status']);
            $table->dropIndex(['session_type', 'status']);
            $table->dropIndex(['room_name']);
            
            // Restaurar enum original
            $table->dropColumn('status');
        });

        Schema::table('chat_sessions', function (Blueprint $table) {
            $table->enum('status', ['waiting', 'active', 'ended'])->default('waiting')->after('room_name');
        });
    }
};