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
        Schema::create('room_participants', function (Blueprint $table) {
            $table->id();
            $table->string('room_name')->index();
            $table->unsignedBigInteger('user_id');
            $table->enum('user_type', ['cliente', 'modelo'])->default('cliente');
            $table->string('user_name');
            $table->unsignedBigInteger('session_id')->nullable();
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('left_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('connection_data')->nullable();
            $table->timestamps();

            // Índices para mejorar performance
            $table->index(['room_name', 'is_active']);
            $table->index(['user_id', 'is_active']);
            $table->index('session_id');

            // Relaciones foráneas (opcional, ajusta según tus tablas)
            // $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            // $table->foreign('session_id')->references('id')->on('chat_sessions')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_participants');
    }
};