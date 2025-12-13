<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCoinConsumptionsTable extends Migration
{
    public function up()
    {
        Schema::create('coin_consumptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('room_name')->comment('Nombre de la sala de videochat');
            $table->string('session_id')->nullable()->comment('ID de sesión de videochat');
            $table->decimal('minutes_consumed', 8, 2)->comment('Minutos de videochat consumidos');
            $table->integer('coins_consumed')->comment('Total de monedas consumidas');
            $table->integer('gift_coins_used')->default(0)->comment('Monedas de regalo utilizadas');
            $table->integer('purchased_coins_used')->default(0)->comment('Monedas compradas utilizadas');
            $table->integer('balance_after')->comment('Balance total después del consumo');
            $table->timestamp('consumed_at')->comment('Momento del consumo');
            $table->timestamps();
            
            $table->index(['user_id', 'consumed_at']);
            $table->index(['room_name']);
            $table->index(['session_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('coin_consumptions');
    }
}
