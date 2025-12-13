<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('gift_transactions', function (Blueprint $table) {
            // Agregar nuevas columnas necesarias para el sistema de regalos
            $table->bigInteger('gift_request_id')->unsigned()->nullable()->after('id');
            $table->bigInteger('client_id')->unsigned()->nullable()->after('gift_request_id');
            $table->bigInteger('modelo_id')->unsigned()->nullable()->after('client_id');
            
            // Cambiar gift_id a bigint para consistencia
            $table->bigInteger('gift_id_new')->unsigned()->nullable()->after('modelo_id');
            
            // Cambiar amount a decimal
            $table->decimal('amount_total', 10, 2)->default(0)->after('gift_id_new');
            $table->decimal('amount_modelo', 10, 2)->default(0)->after('amount_total');
            $table->decimal('amount_commission', 10, 2)->default(0)->after('amount_modelo');
            
            // Agregar tipo de transacción más específico
            $table->string('transaction_type', 50)->default('gift_accepted')->after('amount_commission');
            
            // Agregar status de la transacción
            $table->string('status', 20)->default('completed')->after('transaction_type');
            
            // Agregar índices para optimización
            $table->index('gift_request_id', 'idx_gift_request_id');
            $table->index('client_id', 'idx_client_id');
            $table->index('modelo_id', 'idx_modelo_id');
            $table->index(['client_id', 'created_at'], 'idx_client_date');
            $table->index(['modelo_id', 'created_at'], 'idx_modelo_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gift_transactions', function (Blueprint $table) {
            $table->dropIndex('idx_gift_request_id');
            $table->dropIndex('idx_client_id');
            $table->dropIndex('idx_modelo_id');
            $table->dropIndex('idx_client_date');
            $table->dropIndex('idx_modelo_date');
            
            $table->dropColumn([
                'gift_request_id',
                'client_id', 
                'modelo_id',
                'gift_id_new',
                'amount_total',
                'amount_modelo',
                'amount_commission',
                'transaction_type',
                'status'
            ]);
        });
    }
};