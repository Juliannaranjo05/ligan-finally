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
            // Agregar campo caller_id para identificar explícitamente quién inició la llamada
            $table->unsignedBigInteger('caller_id')->nullable()->after('modelo_id');
            $table->foreign('caller_id')->references('id')->on('users')->onDelete('cascade');
            
            // Agregar índice para búsquedas rápidas
            $table->index('caller_id');
        });
        
        // Migrar datos existentes: determinar caller_id basándose en la lógica actual
        // Si cliente_id tiene un cliente y modelo_id tiene un modelo, el caller es el que está en su campo de rol
        // Pero como no podemos determinarlo con certeza, lo haremos basándose en started_at más reciente
        // Por ahora, dejamos null y se actualizará cuando se creen nuevas llamadas
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chat_sessions', function (Blueprint $table) {
            $table->dropForeign(['caller_id']);
            $table->dropIndex(['caller_id']);
            $table->dropColumn('caller_id');
        });
    }
};
