<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('user_blocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('blocked_user_id')->index();
            $table->string('reason')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('blocked_user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['user_id', 'blocked_user_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('user_blocks');
    }
};