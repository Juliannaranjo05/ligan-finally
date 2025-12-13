<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->string('room_name');
            $table->unsignedBigInteger('user_id');
            $table->string('user_name');
            $table->enum('user_role', ['cliente', 'modelo']);
            $table->text('message');
            $table->enum('type', ['text', 'gift', 'emoji'])->default('text');
            $table->json('extra_data')->nullable(); // Para regalos, etc.
            $table->timestamps();
            
            // Índices para optimizar consultas
            $table->index(['room_name', 'created_at']);
            $table->index('created_at');
            
            // Relación con usuarios
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::dropIfExists('chat_messages');
    }
};