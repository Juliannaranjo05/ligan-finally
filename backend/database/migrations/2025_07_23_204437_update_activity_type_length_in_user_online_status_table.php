<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class UpdateActivityTypeLengthInUserOnlineStatusTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('user_online_status', function (Blueprint $table) {
            $table->string('activity_type', 30)->change(); // antes podía ser 10, ahora lo haces más largo
        });

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('user_online_status', function (Blueprint $table) {
            //
        });
    }
}
