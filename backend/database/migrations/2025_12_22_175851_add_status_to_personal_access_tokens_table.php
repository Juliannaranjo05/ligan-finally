<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddStatusToPersonalAccessTokensTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            // Agregar columna status con valores 'active' o 'suspended'
            $table->enum('status', ['active', 'suspended'])->default('active')->after('abilities');
            // Agregar índice para consultas rápidas
            $table->index('status');
        });

        // Actualizar todos los tokens existentes a 'active'
        DB::table('personal_access_tokens')->update(['status' => 'active']);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn('status');
        });
    }
}
