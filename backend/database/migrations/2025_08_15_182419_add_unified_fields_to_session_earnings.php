<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('session_earnings', function (Blueprint $table) {
            // 🔥 NUEVOS CAMPOS PARA UNIFICACIÓN
            $table->string('source_type')->default('video_session')->after('room_name')
                ->comment('video_session, direct_gift, chat_gift');
            
            $table->integer('gift_count')->default(0)->after('source_type')
                ->comment('Cantidad de regalos en esta sesión/transacción');
            
            $table->text('gift_details')->nullable()->after('gift_count')
                ->comment('JSON con detalles de regalos enviados');
            
            // 🔥 ÍNDICES PARA OPTIMIZACIÓN
            $table->index(['model_user_id', 'weekly_payment_id'], 'idx_model_payment');
            $table->index(['source_type', 'model_user_id'], 'idx_source_model');
            $table->index(['created_at', 'model_user_id'], 'idx_date_model');
        });
    }

    public function down()
    {
        Schema::table('session_earnings', function (Blueprint $table) {
            $table->dropIndex('idx_model_payment');
            $table->dropIndex('idx_source_model'); 
            $table->dropIndex('idx_date_model');
            
            $table->dropColumn([
                'source_type',
                'gift_count', 
                'gift_details'
            ]);
        });
    }
};