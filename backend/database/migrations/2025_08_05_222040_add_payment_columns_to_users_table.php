<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('payment_method')->nullable();
            $table->string('account_details')->nullable();
            $table->string('account_holder_name')->nullable();
            $table->boolean('payment_method_verified')->default(false);
            $table->string('verification_code', 6)->nullable();
            $table->timestamp('verification_code_expires_at')->nullable();
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'payment_method',
                'account_details', 
                'account_holder_name',
                'payment_method_verified',
                'verification_code',
                'verification_code_expires_at'
            ]);
        });
    }
};