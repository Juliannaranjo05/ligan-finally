<?php
// database/migrations/xxxx_xx_xx_create_user_nicknames_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterNicknameLengthInUserNicknamesTable extends Migration
{
    public function up()
    {
        Schema::create('user_nicknames', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id'); // Quien pone el apodo
            $table->unsignedBigInteger('target_user_id'); // A quien le pone el apodo
            $table->string('nickname', 8); // El apodo personalizado
            $table->timestamps();
            
            // Índices y claves foráneas
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('target_user_id')->references('id')->on('users')->onDelete('cascade');
            
            // Un usuario solo puede tener un apodo por cada usuario target
            $table->unique(['user_id', 'target_user_id'], 'unique_user_nickname');
            
            // Índices para búsquedas rápidas
            $table->index(['user_id', 'target_user_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('user_nicknames');
    }
}