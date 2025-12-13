<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::dropIfExists('user_favorites'); // Por si existe mal
        
        Schema::create('user_favorites', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('favorite_user_id')->index();
            $table->text('note')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('favorite_user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['user_id', 'favorite_user_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('user_favorites');
    }
};