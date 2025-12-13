<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class ModifyClienteIdNullableInChatSessions extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('chat_sessions', function (Blueprint $table) {
            // Hacer que cliente_id pueda ser NULL
            $table->unsignedBigInteger('cliente_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('chat_sessions', function (Blueprint $table) {
            // Revertir el cambio (volver a NOT NULL)
            $table->unsignedBigInteger('cliente_id')->nullable(false)->change();
        });
    }
}