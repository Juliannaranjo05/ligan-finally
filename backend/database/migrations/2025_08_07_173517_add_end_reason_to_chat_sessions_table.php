<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddEndReasonToChatSessionsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
{
    Schema::table('chat_sessions', function (Blueprint $table) {
        $table->string('end_reason')->nullable()->after('ended_at');
        $table->index('end_reason'); // Agregar el índice después de la columna
    });
}

public function down()
{
    Schema::table('chat_sessions', function (Blueprint $table) {
        $table->dropIndex('chat_sessions_end_reason_index');
        $table->dropColumn('end_reason');
    });
}

}
