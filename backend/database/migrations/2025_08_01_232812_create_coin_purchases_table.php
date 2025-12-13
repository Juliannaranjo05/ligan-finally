<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCoinPurchasesTable extends Migration
{
    public function up()
    {
        Schema::create('coin_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('package_id')->nullable()->constrained('coin_packages')->onDelete('set null');
            $table->integer('coins')->comment('Monedas base compradas');
            $table->integer('bonus_coins')->default(0)->comment('Monedas bonus recibidas');
            $table->integer('total_coins')->comment('Total de monedas (base + bonus)');
            $table->decimal('amount', 8, 2)->comment('Monto pagado');
            $table->string('currency', 3)->default('USD');
            $table->string('payment_method')->comment('stripe, paypal, admin, etc.');
            $table->enum('status', ['pending', 'completed', 'failed', 'cancelled', 'refunded'])->default('pending');
            $table->string('transaction_id')->unique()->comment('ID de transacción de Stripe/PayPal');
            $table->json('payment_data')->nullable()->comment('Datos adicionales del pago');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'status']);
            $table->index(['status', 'created_at']);
            $table->index(['transaction_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('coin_purchases');
    }
}
