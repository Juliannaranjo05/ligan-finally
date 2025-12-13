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
        Schema::table('gift_requests', function (Blueprint $table) {
            // Verificar si las columnas ya existen antes de agregarlas
            if (!Schema::hasColumn('gift_requests', 'accepted_at')) {
                $table->timestamp('accepted_at')->nullable()->after('expires_at');
            }
            
            if (!Schema::hasColumn('gift_requests', 'processed_amount')) {
                $table->decimal('processed_amount', 10, 2)->nullable()->after('accepted_at');
            }
            
            if (!Schema::hasColumn('gift_requests', 'modelo_received')) {
                $table->decimal('modelo_received', 10, 2)->nullable()->after('processed_amount');
            }
            
            if (!Schema::hasColumn('gift_requests', 'platform_commission')) {
                $table->decimal('platform_commission', 10, 2)->nullable()->after('modelo_received');
            }
            
            if (!Schema::hasColumn('gift_requests', 'cancelled_reason')) {
                $table->string('cancelled_reason')->nullable()->after('platform_commission');
            }
            
            // Agregar índices para optimización
            $table->index(['modelo_id', 'status'], 'idx_modelo_status');
            $table->index(['client_id', 'status'], 'idx_client_status');
            $table->index(['status', 'created_at'], 'idx_status_date');
            $table->index(['expires_at', 'status'], 'idx_expires_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gift_requests', function (Blueprint $table) {
            $table->dropIndex('idx_modelo_status');
            $table->dropIndex('idx_client_status');
            $table->dropIndex('idx_status_date');
            $table->dropIndex('idx_expires_status');
            
            $table->dropColumn([
                'accepted_at',
                'processed_amount',
                'modelo_received',
                'platform_commission',
                'cancelled_reason'
            ]);
        });
    }
};