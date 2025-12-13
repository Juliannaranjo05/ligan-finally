<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddWeeklyPaymentIdToSessionEarningsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
{
    Schema::table('session_earnings', function (Blueprint $table) {
        $table->unsignedBigInteger('weekly_payment_id')->nullable()->after('id');
        $table->foreign('weekly_payment_id')->references('id')->on('weekly_payments')->onDelete('set null');
    });
}

public function down()
{
    Schema::table('session_earnings', function (Blueprint $table) {
        $table->dropForeign(['weekly_payment_id']);
        $table->dropColumn('weekly_payment_id');
    });
}
}
