<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // Verificar y configurar todo lo necesario para stories
        echo "🔧 Configurando sistema de historias...\n";

        // 1. Verificar que todas las columnas existan (PostgreSQL syntax)
        $columns = DB::select("
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'stories' 
            AND table_schema = 'public'
        ");
        
        $columnNames = collect($columns)->pluck('column_name')->toArray();
        
        $requiredColumns = ['status', 'approved_at', 'approved_by', 'rejection_reason', 'views_count'];
        
        foreach ($requiredColumns as $col) {
            if (!in_array($col, $columnNames)) {
                echo "❌ Falta columna: $col\n";
                return false;
            } else {
                echo "✅ Columna $col existe\n";
            }
        }

        // 2. Asegurar que expires_at sea nullable (PostgreSQL syntax)
        try {
            DB::statement("ALTER TABLE stories ALTER COLUMN expires_at DROP NOT NULL");
            echo "✅ expires_at configurado como nullable\n";
        } catch (Exception $e) {
            echo "⚠️ expires_at: " . $e->getMessage() . "\n";
        }

        // 3. Agregar índices necesarios (si no existen)
        $this->addIndexIfNotExists('stories', 'idx_stories_status', 'status');
        $this->addIndexIfNotExists('stories', 'idx_stories_status_approved', 'status, approved_at');
        $this->addIndexIfNotExists('stories', 'idx_stories_views', 'views_count');

        // 4. Agregar foreign key si no existe
        $this->addForeignKeyIfNotExists();

        echo "🎉 Sistema de historias configurado correctamente\n";
    }

    private function addIndexIfNotExists($table, $indexName, $columns) 
    {
        try {
            // PostgreSQL: verificar si el índice existe
            $exists = DB::select("
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = '$table' 
                AND indexname = '$indexName'
            ");
            
            if (empty($exists)) {
                DB::statement("CREATE INDEX $indexName ON $table ($columns)");
                echo "✅ Índice $indexName creado\n";
            } else {
                echo "⚠️ Índice $indexName ya existe\n";
            }
        } catch (Exception $e) {
            echo "❌ Error con índice $indexName: " . $e->getMessage() . "\n";
        }
    }

    private function addForeignKeyIfNotExists() 
    {
        try {
            // PostgreSQL: verificar si la foreign key existe
            $exists = DB::select("
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'stories' 
                AND constraint_type = 'FOREIGN KEY'
                AND constraint_name = 'fk_stories_approved_by'
            ");
            
            if (empty($exists)) {
                DB::statement("ALTER TABLE stories ADD CONSTRAINT fk_stories_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL");
                echo "✅ Foreign key approved_by creado\n";
            } else {
                echo "⚠️ Foreign key approved_by ya existe\n";
            }
        } catch (Exception $e) {
            echo "❌ Error con foreign key: " . $e->getMessage() . "\n";
        }
    }

    public function down()
    {
        // No hacer nada en down para evitar problemas
        echo "⚠️ No se realizará rollback para evitar problemas\n";
    }
};