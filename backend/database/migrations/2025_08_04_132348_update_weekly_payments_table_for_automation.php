<?php

// =============================================================================
// 🔥 MIGRACIÓN CORREGIDA: update_weekly_payments_table_for_automation
// =============================================================================

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class UpdateWeeklyPaymentsTableForAutomation extends Migration
{
    public function up()
    {
        Schema::table('weekly_payments', function (Blueprint $table) {
            // 🔥 HACER CAMPOS NULLABLE PARA PAGOS PENDIENTES
            $table->string('payment_method')->nullable()->change();
            $table->dateTime('paid_at')->nullable()->change(); // 🔥 USAR dateTime en lugar de timestamp
            $table->unsignedBigInteger('paid_by')->nullable()->change();
            
            // 🔥 AGREGAR CAMPOS NUEVOS
            $table->integer('total_sessions')->default(0)->after('amount');
            $table->enum('status', ['pending', 'paid', 'cancelled'])->default('pending')->after('total_sessions');
            $table->dateTime('processed_at')->nullable()->after('paid_by'); // 🔥 USAR dateTime
        });

        // 🔥 AGREGAR ÍNDICES EN COMANDO SEPARADO
        Schema::table('weekly_payments', function (Blueprint $table) {
            $table->index(['model_user_id', 'week_start'], 'idx_model_week');
            $table->index('status', 'idx_status');
            $table->index('week_start', 'idx_week_start');
        });
    }

    public function down()
    {
        Schema::table('weekly_payments', function (Blueprint $table) {
            // Remover índices primero
            $table->dropIndex('idx_model_week');
            $table->dropIndex('idx_status');
            $table->dropIndex('idx_week_start');
        });

        Schema::table('weekly_payments', function (Blueprint $table) {
            // Revertir cambios
            $table->string('payment_method')->nullable(false)->change();
            $table->dateTime('paid_at')->nullable(false)->change();
            $table->unsignedBigInteger('paid_by')->nullable(false)->change();
            
            $table->dropColumn(['total_sessions', 'status', 'processed_at']);
        });
    }
}