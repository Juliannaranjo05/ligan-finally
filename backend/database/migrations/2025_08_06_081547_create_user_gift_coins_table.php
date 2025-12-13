<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_gift_coins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->integer('balance')->default(0); // Saldo actual de regalos
            $table->integer('total_received')->default(0); // Total recibido
            $table->integer('total_sent')->default(0); // Total enviado
            $table->timestamp('last_received_at')->nullable();
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamps();
            
            $table->unique('user_id');
            $table->index(['user_id', 'balance']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_gift_coins');
    }
};