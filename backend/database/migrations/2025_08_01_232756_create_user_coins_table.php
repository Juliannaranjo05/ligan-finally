<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUserCoinsTable extends Migration
{
    public function up()
    {
        Schema::create('user_coins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->integer('purchased_balance')->default(0)->comment('Monedas compradas disponibles');
            $table->integer('gift_balance')->default(0)->comment('Monedas de regalo disponibles');
            $table->integer('total_purchased')->default(0)->comment('Total de monedas compradas históricamente');
            $table->integer('total_consumed')->default(0)->comment('Total de monedas consumidas históricamente');
            $table->timestamp('last_purchase_at')->nullable()->comment('Última vez que compró monedas');
            $table->timestamp('last_consumption_at')->nullable()->comment('Última vez que consumió monedas');
            $table->timestamps();
            
            $table->index(['user_id']);
            $table->index(['purchased_balance', 'gift_balance']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('user_coins');
    }
}