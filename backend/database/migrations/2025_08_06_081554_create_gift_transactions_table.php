<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gift_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('receiver_id')->constrained('users')->onDelete('cascade');
            $table->integer('amount');
            $table->string('type')->default('gift'); // 'gift', 'purchase', 'bonus'
            $table->string('source')->nullable(); // 'direct_gift', 'package_purchase', etc.
            $table->string('message')->nullable(); // Mensaje del regalo
            $table->string('reference_id')->nullable(); // ID de compra, etc.
            $table->timestamps();
            
            $table->index(['sender_id', 'created_at']);
            $table->index(['receiver_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gift_transactions');
    }
};