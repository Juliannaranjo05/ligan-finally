<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // Agregar columnas si no existen usando SQL directo
        $columns = [
            'approved_at' => "ALTER TABLE stories ADD COLUMN approved_at TIMESTAMP NULL AFTER status",
            'approved_by' => "ALTER TABLE stories ADD COLUMN approved_by BIGINT UNSIGNED NULL AFTER approved_at",
            'rejection_reason' => "ALTER TABLE stories ADD COLUMN rejection_reason TEXT NULL AFTER approved_by",
            'views_count' => "ALTER TABLE stories ADD COLUMN views_count INT UNSIGNED DEFAULT 0 AFTER rejection_reason"
        ];

        foreach ($columns as $column => $sql) {
            try {
                // Verificar si la columna existe
                $exists = DB::select("SHOW COLUMNS FROM stories LIKE '$column'");
                if (empty($exists)) {
                    DB::statement($sql);
                    echo "✅ Columna $column agregada\n";
                } else {
                    echo "⚠️  Columna $column ya existe\n";
                }
            } catch (Exception $e) {
                echo "❌ Error con columna $column: " . $e->getMessage() . "\n";
            }
        }

        // Agregar índices
        try {
            DB::statement("CREATE INDEX idx_stories_status ON stories (status)");
        } catch (Exception $e) {
            echo "⚠️  Índice status ya existe o error: " . $e->getMessage() . "\n";
        }

        try {
            DB::statement("CREATE INDEX idx_stories_status_approved ON stories (status, approved_at)");
        } catch (Exception $e) {
            echo "⚠️  Índice status+approved_at ya existe o error: " . $e->getMessage() . "\n";
        }

        try {
            DB::statement("CREATE INDEX idx_stories_views ON stories (views_count)");
        } catch (Exception $e) {
            echo "⚠️  Índice views_count ya existe o error: " . $e->getMessage() . "\n";
        }

        // Foreign key
        try {
            DB::statement("ALTER TABLE stories ADD CONSTRAINT fk_stories_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL");
        } catch (Exception $e) {
            echo "⚠️  Foreign key ya existe o error: " . $e->getMessage() . "\n";
        }
    }

    public function down()
    {
        DB::statement("ALTER TABLE stories DROP FOREIGN KEY IF EXISTS fk_stories_approved_by");
        DB::statement("ALTER TABLE stories DROP INDEX IF EXISTS idx_stories_status");
        DB::statement("ALTER TABLE stories DROP INDEX IF EXISTS idx_stories_status_approved");
        DB::statement("ALTER TABLE stories DROP INDEX IF EXISTS idx_stories_views");
        
        DB::statement("ALTER TABLE stories DROP COLUMN IF EXISTS approved_at");
        DB::statement("ALTER TABLE stories DROP COLUMN IF EXISTS approved_by");
        DB::statement("ALTER TABLE stories DROP COLUMN IF EXISTS rejection_reason");
        DB::statement("ALTER TABLE stories DROP COLUMN IF EXISTS views_count");
    }
};