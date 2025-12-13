<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWeeklyPaymentsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('weekly_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('model_user_id');
            $table->date('week_start');
            $table->date('week_end');
            $table->decimal('amount', 10, 2);
            $table->string('payment_method'); // transferencia, paypal, etc
            $table->string('payment_reference')->nullable();
            $table->timestamp('paid_at');
            $table->unsignedBigInteger('paid_by'); // admin que procesó
            $table->timestamps();
            
            $table->foreign('model_user_id')->references('id')->on('users');
            $table->foreign('paid_by')->references('id')->on('users');
            $table->unique(['model_user_id', 'week_start']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('weekly_payments');
    }
}
