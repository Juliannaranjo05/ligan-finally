<?php
// database/migrations/xxxx_xx_xx_add_story_approval_fields.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('stories', function (Blueprint $table) {
            // Campos de aprobación
            if (!Schema::hasColumn('stories', 'approved_at')) {
                $table->timestamp('approved_at')->nullable();
            }
            if (!Schema::hasColumn('stories', 'approved_by')) {
                $table->unsignedBigInteger('approved_by')->nullable();
            }
            
            // Campos de rechazo
            if (!Schema::hasColumn('stories', 'rejected_at')) {
                $table->timestamp('rejected_at')->nullable();
            }
            if (!Schema::hasColumn('stories', 'rejected_by')) {
                $table->unsignedBigInteger('rejected_by')->nullable();
            }
            if (!Schema::hasColumn('stories', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable();
            }
            
            // Campo de expiración (si no existe)
            if (!Schema::hasColumn('stories', 'expires_at')) {
                $table->timestamp('expires_at')->nullable();
            }
            
            // Campo de conteo de vistas (si no existe)
            if (!Schema::hasColumn('stories', 'views_count')) {
                $table->unsignedInteger('views_count')->default(0);
            }
            
            // Índices para mejor performance
            $table->index(['user_id', 'status']);
            $table->index(['status', 'expires_at']);
            $table->index('approved_at');
        });
    }

    public function down()
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->dropColumn([
                'approved_at', 'approved_by', 
                'rejected_at', 'rejected_by', 'rejection_reason',
                'expires_at', 'views_count'
            ]);
        });
    }
};