<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // Usar SQL directo para evitar problemas con Doctrine
        try {
            DB::statement("ALTER TABLE stories ADD COLUMN approved_at TIMESTAMP NULL AFTER status");
            echo "✅ approved_at agregada\n";
        } catch (Exception $e) {
            echo "⚠️ approved_at ya existe\n";
        }

        try {
            DB::statement("ALTER TABLE stories ADD COLUMN approved_by BIGINT UNSIGNED NULL AFTER approved_at");
            echo "✅ approved_by agregada\n";
        } catch (Exception $e) {
            echo "⚠️ approved_by ya existe\n";
        }

        try {
            DB::statement("ALTER TABLE stories ADD COLUMN rejection_reason TEXT NULL AFTER approved_by");
            echo "✅ rejection_reason agregada\n";
        } catch (Exception $e) {
            echo "⚠️ rejection_reason ya existe\n";
        }

        try {
            DB::statement("ALTER TABLE stories ADD COLUMN views_count INT UNSIGNED DEFAULT 0 AFTER rejection_reason");
            echo "✅ views_count agregada\n";
        } catch (Exception $e) {
            echo "⚠️ views_count ya existe\n";
        }
        
        // Modificar expires_at para que sea nullable
        try {
            DB::statement("ALTER TABLE stories MODIFY expires_at TIMESTAMP NULL");
            echo "✅ expires_at modificado\n";
        } catch (Exception $e) {
            echo "⚠️ Error con expires_at: " . $e->getMessage() . "\n";
        }
        
        // Agregar índices
        try {
            DB::statement("CREATE INDEX idx_stories_status ON stories (status)");
            echo "✅ Índice status creado\n";
        } catch (Exception $e) {
            echo "⚠️ Índice status ya existe\n";
        }

        try {
            DB::statement("CREATE INDEX idx_stories_status_approved ON stories (status, approved_at)");
            echo "✅ Índice status+approved creado\n";
        } catch (Exception $e) {
            echo "⚠️ Índice status+approved ya existe\n";
        }

        try {
            DB::statement("CREATE INDEX idx_stories_views ON stories (views_count)");
            echo "✅ Índice views creado\n";
        } catch (Exception $e) {
            echo "⚠️ Índice views ya existe\n";
        }
        
        // Foreign key
        try {
            DB::statement("ALTER TABLE stories ADD CONSTRAINT fk_stories_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL");
            echo "✅ Foreign key creado\n";
        } catch (Exception $e) {
            echo "⚠️ Foreign key ya existe\n";
        }
    }

    public function down()
    {
        DB::statement("ALTER TABLE stories DROP FOREIGN KEY IF EXISTS fk_stories_approved_by");
        DB::statement("DROP INDEX IF EXISTS idx_stories_status ON stories");
        DB::statement("DROP INDEX IF EXISTS idx_stories_status_approved ON stories");
        DB::statement("DROP INDEX IF EXISTS idx_stories_views ON stories");
        
        DB::statement("ALTER TABLE stories DROP COLUMN IF EXISTS approved_at");
        DB::statement("ALTER TABLE stories DROP COLUMN IF EXISTS approved_by");
        DB::statement("ALTER TABLE stories DROP COLUMN IF EXISTS rejection_reason");
        DB::statement("ALTER TABLE stories DROP COLUMN IF EXISTS views_count");
    }
};