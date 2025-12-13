<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddStripeFieldsToSessionEarningsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('session_earnings', function (Blueprint $table) {
            $table->decimal('client_usd_spent', 10, 2)->default(0)->after('total_coins_spent');
            $table->decimal('stripe_commission', 10, 2)->default(0)->after('client_usd_spent');
            $table->decimal('after_stripe_amount', 10, 2)->default(0)->after('stripe_commission');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('session_earnings', function (Blueprint $table) {
            //
        });
    }
}
