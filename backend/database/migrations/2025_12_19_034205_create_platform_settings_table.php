<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePlatformSettingsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value');
            $table->string('type')->default('string'); // decimal, integer, string, boolean, json
            $table->text('description')->nullable();
            $table->string('category')->default('system'); // earnings, gifts, stories, payments, system
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
            $table->index('key');
            $table->index('category');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('platform_settings');
    }
}
