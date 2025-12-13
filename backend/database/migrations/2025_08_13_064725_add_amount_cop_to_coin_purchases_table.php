<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->decimal('amount_cop', 15, 2)->nullable()->after('amount');
        });

        // Actualizar registros existentes
        DB::table('coin_purchases')
            ->where('currency', 'USD')
            ->whereNull('amount_cop')
            ->update(['amount_cop' => DB::raw('amount * 4000')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->dropColumn('amount_cop');
        });
    }
};