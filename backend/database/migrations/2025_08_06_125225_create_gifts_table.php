<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('gifts', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('image_path');
            $table->integer('price');
            $table->enum('category', ['basic', 'premium', 'luxury', 'exclusive']);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('gifts');
    }
};
