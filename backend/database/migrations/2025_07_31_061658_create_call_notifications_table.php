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
        Schema::create('call_notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('type', 50); // 'incoming_call', 'call_accepted', 'call_rejected', etc.
            $table->json('data'); // Datos de la notificación
            $table->boolean('read')->default(false);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            // Índices para optimizar consultas
            $table->index(['user_id', 'read']);
            $table->index(['user_id', 'type']);
            $table->index('expires_at');
            
            // Clave foránea
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('call_notifications');
    }
};