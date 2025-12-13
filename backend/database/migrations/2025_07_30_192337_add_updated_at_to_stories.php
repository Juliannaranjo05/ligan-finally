<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // Agregar updated_at que falta
        DB::statement("ALTER TABLE stories ADD COLUMN updated_at TIMESTAMP NULL");
        echo "✅ Columna updated_at agregada\n";
    }

    public function down()
    {
        DB::statement("ALTER TABLE stories DROP COLUMN updated_at");
    }
};
