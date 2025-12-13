<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('story_views', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('story_id');
            $table->unsignedBigInteger('user_id')->nullable(); // nullable para usuarios no registrados
            $table->string('ip_address')->nullable(); // para trackear usuarios no registrados
            $table->dateTime('viewed_at'); // 👈 Cambiado de timestamp a dateTime
            
            // Índices para optimizar consultas
            $table->index(['story_id', 'user_id']);
            $table->index(['story_id', 'ip_address']);
            $table->index('viewed_at');
            
            // Foreign keys
            $table->foreign('story_id')->references('id')->on('stories')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });

        // Crear índices únicos por separado para evitar problemas con nombres largos
        Schema::table('story_views', function (Blueprint $table) {
            $table->unique(['story_id', 'user_id'], 'story_user_unique');
            $table->unique(['story_id', 'ip_address'], 'story_ip_unique');
        });
    }

    public function down()
    {
        Schema::dropIfExists('story_views');
    }
};