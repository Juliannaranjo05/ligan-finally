<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Para SQLite, necesitamos usar DB::statement directamente
        $driver = DB::connection()->getDriverName();
        
        if ($driver === 'sqlite') {
            // Verificar si las columnas ya existen
            $columns = DB::select("PRAGMA table_info(chat_sessions)");
            $columnNames = array_column($columns, 'name');
            
            // Agregar session_type si no existe
            if (!in_array('session_type', $columnNames)) {
                DB::statement("ALTER TABLE chat_sessions ADD COLUMN session_type TEXT DEFAULT 'chat'");
            }
            
            // Agregar call_type si no existe
            if (!in_array('call_type', $columnNames)) {
                DB::statement("ALTER TABLE chat_sessions ADD COLUMN call_type TEXT");
            }
            
            // Agregar answered_at si no existe
            if (!in_array('answered_at', $columnNames)) {
                DB::statement("ALTER TABLE chat_sessions ADD COLUMN answered_at TEXT");
            }
        } else {
            // Para otros motores de base de datos (MySQL, PostgreSQL)
            Schema::table('chat_sessions', function (Blueprint $table) {
                if (!Schema::hasColumn('chat_sessions', 'session_type')) {
                    $table->enum('session_type', ['chat', 'call'])->default('chat')->after('modelo_id');
                }
                if (!Schema::hasColumn('chat_sessions', 'call_type')) {
                    $table->enum('call_type', ['video', 'audio'])->nullable()->after('session_type');
                }
                if (!Schema::hasColumn('chat_sessions', 'answered_at')) {
                    $table->timestamp('answered_at')->nullable()->after('started_at');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::connection()->getDriverName();
        
        if ($driver === 'sqlite') {
            // SQLite no soporta DROP COLUMN directamente, necesitaríamos recrear la tabla
            // Por ahora, solo marcamos como no usado
            // En producción, esto requeriría una estrategia más compleja
        } else {
            Schema::table('chat_sessions', function (Blueprint $table) {
                if (Schema::hasColumn('chat_sessions', 'session_type')) {
                    $table->dropColumn('session_type');
                }
                if (Schema::hasColumn('chat_sessions', 'call_type')) {
                    $table->dropColumn('call_type');
                }
                if (Schema::hasColumn('chat_sessions', 'answered_at')) {
                    $table->dropColumn('answered_at');
                }
            });
        }
    }
};





