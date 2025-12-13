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
        Schema::table('users', function (Blueprint $table) {
            // Agregar columna last_activity si no existe
            if (!Schema::hasColumn('users', 'last_activity')) {
                $table->timestamp('last_activity')->nullable()->after('updated_at');
                $table->index('last_activity'); // Índice para consultas rápidas
            }
        });

        // Actualizar usuarios existentes con actividad reciente basada en updated_at
        DB::statement("UPDATE users SET last_activity = updated_at WHERE last_activity IS NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'last_activity')) {
                $table->dropIndex(['last_activity']);
                $table->dropColumn('last_activity');
            }
        });
    }
};