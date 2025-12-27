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
        Schema::create('user_notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->boolean('email_notifications')->default(true);
            $table->boolean('push_notifications')->default(true);
            $table->boolean('message_notifications')->default(true);
            $table->boolean('call_notifications')->default(true);
            $table->boolean('favorite_online_notifications')->default(true);
            $table->boolean('gift_notifications')->default(true);
            $table->boolean('payment_notifications')->default(true);
            $table->boolean('system_notifications')->default(true);
            $table->timestamps();
            
            // Clave foránea
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_notification_preferences');
    }
};
