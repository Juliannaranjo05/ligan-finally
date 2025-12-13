// En database/migrations/xxxx_fix_coin_purchases_status_column.php

<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class FixCoinPurchasesStatusColumn extends Migration
{
    public function up()
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            // Cambiar status de VARCHAR(pequeño) a VARCHAR(50)
            $table->string('status', 50)->change();
        });
    }

    public function down()
    {
        Schema::table('coin_purchases', function (Blueprint $table) {
            $table->string('status', 10)->change();
        });
    }
}