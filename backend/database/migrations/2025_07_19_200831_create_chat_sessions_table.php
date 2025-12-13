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
        Schema::create('chat_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cliente_id');
            $table->unsignedBigInteger('modelo_id')->nullable();
            $table->string('room_name')->unique();
            $table->enum('status', ['waiting', 'active', 'ended'])->default('waiting');
            $table->json('modelo_data')->nullable(); // Info del modelo seleccionado por ruleta
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('cliente_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('modelo_id')->references('id')->on('users')->onDelete('set null');
            
            // Índices para optimizar consultas
            $table->index(['status', 'created_at']);
            $table->index('cliente_id');
            $table->index('modelo_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_sessions');
    }
};