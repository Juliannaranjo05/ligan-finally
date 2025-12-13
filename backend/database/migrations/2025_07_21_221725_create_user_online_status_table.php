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
        Schema::create('user_online_status', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->boolean('is_online')->default(false);
            $table->timestamp('last_seen')->nullable();
            $table->timestamp('connected_at')->nullable(); // Cuándo se conectó
            $table->timestamp('disconnected_at')->nullable(); // Cuándo se desconectó
            $table->string('session_id')->nullable(); // ID de sesión del navegador
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->string('current_room')->nullable(); // En qué sala está actualmente
            $table->enum('activity_type', ['videochat', 'browsing', 'idle'])->default('browsing');
            $table->integer('heartbeat_interval')->default(30); // Cada cuántos segundos hace ping
            $table->json('metadata')->nullable(); // Info adicional (navegador, dispositivo, etc.)
            $table->timestamps();
            
            // Índices para optimizar consultas
            $table->unique('user_id'); // Un usuario solo puede tener un registro
            $table->index('is_online');
            $table->index('last_seen');
            $table->index('current_room');
            $table->index('activity_type');
            $table->index(['is_online', 'activity_type']);
            $table->index(['user_id', 'is_online']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_online_status');
    }
};