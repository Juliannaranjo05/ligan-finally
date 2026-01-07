<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddSecondModelToChatSessions extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('chat_sessions', function (Blueprint $table) {
            $table->unsignedBigInteger('modelo_id_2')->nullable();
            $table->timestamp('modelo_2_invited_at')->nullable();
            $table->timestamp('modelo_2_answered_at')->nullable();
            $table->enum('modelo_2_status', ['pending', 'accepted', 'rejected'])->nullable();

            // Índices
            $table->index('modelo_id_2');
            $table->index(['modelo_id_2', 'modelo_2_status']);

            // Foreign Key
            $table->foreign('modelo_id_2')->references('id')->on('users')->onDelete('set null');
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
            $table->dropForeign(['modelo_id_2']);
            $table->dropIndex(['modelo_id_2', 'modelo_2_status']);
            $table->dropIndex(['modelo_id_2']);
            $table->dropColumn(['modelo_id_2', 'modelo_2_invited_at', 'modelo_2_answered_at', 'modelo_2_status']);
        });
    }
}
