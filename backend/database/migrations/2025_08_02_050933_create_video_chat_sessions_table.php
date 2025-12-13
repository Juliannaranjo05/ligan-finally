<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateVideoChatSessionsTable extends Migration
{
    public function up()
    {
        Schema::create('video_chat_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('room_name');
            $table->enum('user_role', ['cliente', 'modelo']);
            $table->enum('status', ['active', 'ended'])->default('active');
            $table->boolean('is_consuming')->default(false);
            $table->decimal('consumption_rate', 8, 2)->default(10.00);
            $table->decimal('total_consumed', 10, 2)->default(0);
            $table->timestamp('started_at');
            $table->timestamp('last_consumption_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            
            $table->foreign('user_id')->references('id')->on('users');
            $table->index(['user_id', 'status']);
            $table->index(['room_name', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('video_chat_sessions');
    }
}
