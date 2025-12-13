<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddMissingFieldsToCoinPackages extends Migration
{
    public function up()
    {
        Schema::table('coin_packages', function (Blueprint $table) {
            // Solo agregar los que NO existen
            if (!Schema::hasColumn('coin_packages', 'discount_percentage')) {
                $table->integer('discount_percentage')->default(0);
            }
        });
    }

    public function down()
    {
        Schema::table('coin_packages', function (Blueprint $table) {
            $table->dropColumn('discount_percentage');
        });
    }
}