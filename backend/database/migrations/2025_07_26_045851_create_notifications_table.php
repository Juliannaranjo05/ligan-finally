<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('type', 50);
            $table->json('data');
            $table->boolean('read')->default(false);
            $table->timestamp('expires_at');
            $table->timestamps();
            
            // Índices para optimizar consultas
            $table->index(['user_id', 'read', 'expires_at']);
            $table->index(['expires_at']); // Para limpiezas
        });
    }

    public function down()
    {
        Schema::dropIfExists('notifications');
    }
};