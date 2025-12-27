<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('story_likes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('story_id');
            $table->unsignedBigInteger('user_id');
            $table->dateTime('liked_at');
            
            // Índices para optimizar consultas
            $table->index(['story_id', 'user_id']);
            $table->index('liked_at');
            
            // Foreign keys
            $table->foreign('story_id')->references('id')->on('stories')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            
            // Índice único para evitar likes duplicados
            $table->unique(['story_id', 'user_id'], 'story_user_like_unique');
        });
    }

    public function down()
    {
        Schema::dropIfExists('story_likes');
    }
};




