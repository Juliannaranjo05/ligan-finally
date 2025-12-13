<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('country_code', 2)->nullable(); // CO, MX, etc.
            $table->string('city', 100)->nullable();
            $table->string('ip_address', 45)->nullable(); // Para IPv4 e IPv6
            // country_name ya existe en tu BD, así que no la agregamos
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['country_code', 'city', 'ip_address']);
        });
    }
};