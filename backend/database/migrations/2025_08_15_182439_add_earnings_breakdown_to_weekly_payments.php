<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('weekly_payments', function (Blueprint $table) {
            $table->decimal('time_earnings', 10, 2)->default(0)->after('total_sessions')
                ->comment('Ganancias solo por tiempo de sesiones');
            
            $table->decimal('gift_earnings', 10, 2)->default(0)->after('time_earnings')
                ->comment('Ganancias solo por regalos');
            
            // Índice para consultas rápidas
            $table->index(['model_user_id', 'status'], 'idx_model_status');
        });
    }

    public function down()
    {
        Schema::table('weekly_payments', function (Blueprint $table) {
            $table->dropIndex('idx_model_status');
            $table->dropColumn(['time_earnings', 'gift_earnings']);
        });
    }
};