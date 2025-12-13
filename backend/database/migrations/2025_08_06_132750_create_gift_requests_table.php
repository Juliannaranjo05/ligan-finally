<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('gift_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('modelo_id');
            $table->unsignedBigInteger('client_id');
            $table->string('gift_id');
            $table->integer('amount');
            $table->string('message')->nullable();
            $table->string('room_name');
            $table->unsignedBigInteger('chat_session_id')->nullable();
            $table->enum('status', ['pending', 'accepted', 'rejected', 'expired'])->default('pending');
            $table->timestamp('expires_at');
            $table->timestamp('processed_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->json('gift_data')->nullable();
            $table->timestamps();

            // Índices
            $table->index(['modelo_id', 'status']);
            $table->index(['client_id', 'status']);
            $table->index(['room_name']);
            $table->index(['expires_at']);

            // Foreign keys
            $table->foreign('modelo_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('client_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('gift_id')->references('id')->on('gifts')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::dropIfExists('gift_requests');
    }
};