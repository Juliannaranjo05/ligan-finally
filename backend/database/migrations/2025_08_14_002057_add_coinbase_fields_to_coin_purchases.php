<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            // Campos específicos para Coinbase Commerce
            $table->string('charge_id')->nullable()->after('transaction_id');
            $table->string('hosted_url')->nullable()->after('charge_id');
            $table->json('coinbase_data')->nullable()->after('payment_data');
            $table->timestamp('webhook_received_at')->nullable()->after('completed_at');
            $table->string('payment_currency')->nullable()->after('currency'); // BTC, ETH, etc.
            $table->decimal('payment_amount_crypto', 20, 8)->nullable()->after('amount'); // Cantidad en crypto
            $table->json('timeline')->nullable()->after('coinbase_data'); // Timeline de eventos
            
            // Índices para optimización
            $table->index('charge_id', 'idx_coin_purchases_charge_id');
            $table->index(['payment_method', 'status'], 'idx_coin_purchases_method_status');
            $table->index('webhook_received_at', 'idx_coin_purchases_webhook_received');
        });
    }

    public function down()
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->dropIndex('idx_coin_purchases_charge_id');
            $table->dropIndex('idx_coin_purchases_method_status');
            $table->dropIndex('idx_coin_purchases_webhook_received');
            
            $table->dropColumn([
                'charge_id',
                'hosted_url', 
                'coinbase_data',
                'webhook_received_at',
                'payment_currency',
                'payment_amount_crypto',
                'timeline'
            ]);
        });
    }
};