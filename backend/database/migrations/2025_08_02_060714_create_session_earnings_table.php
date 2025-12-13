<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSessionEarningsTable extends Migration
{
    public function up()
    {
        Schema::create('session_earnings', function (Blueprint $table) {
            $table->id();
            $table->string('session_id')->nullable();
            $table->unsignedBigInteger('model_user_id');
            $table->unsignedBigInteger('client_user_id');
            $table->string('room_name');
            $table->integer('session_duration_seconds');
            $table->boolean('qualifying_session')->default(false);
            
            $table->decimal('total_time_coins_spent', 10, 2)->default(0);
            $table->decimal('total_gifts_coins_spent', 10, 2)->default(0);
            $table->decimal('total_coins_spent', 10, 2)->default(0);
            
            $table->decimal('model_time_earnings', 10, 2)->default(0);
            $table->decimal('model_gift_earnings', 10, 2)->default(0);
            $table->decimal('model_total_earnings', 10, 2)->default(0);
            
            $table->decimal('platform_time_earnings', 10, 2)->default(0);
            $table->decimal('platform_gift_earnings', 10, 2)->default(0);
            $table->decimal('platform_total_earnings', 10, 2)->default(0);
            
            $table->timestamp('session_started_at')->nullable();
            $table->timestamp('session_ended_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            
            $table->foreign('model_user_id')->references('id')->on('users');
            $table->foreign('client_user_id')->references('id')->on('users');
            $table->index(['model_user_id', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('session_earnings');
    }
}