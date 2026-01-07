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
        $driver = DB::connection()->getDriverName();
        
        if ($driver === 'sqlite') {
            // Verificar si las columnas ya existen
            $columns = DB::select("PRAGMA table_info(chat_sessions)");
            $columnNames = array_column($columns, 'name');
            
            // Agregar modelo_id_2 si no existe
            if (!in_array('modelo_id_2', $columnNames)) {
                DB::statement("ALTER TABLE chat_sessions ADD COLUMN modelo_id_2 INTEGER");
            }
            
            // Agregar modelo_2_invited_at si no existe
            if (!in_array('modelo_2_invited_at', $columnNames)) {
                DB::statement("ALTER TABLE chat_sessions ADD COLUMN modelo_2_invited_at TEXT");
            }
            
            // Agregar modelo_2_answered_at si no existe
            if (!in_array('modelo_2_answered_at', $columnNames)) {
                DB::statement("ALTER TABLE chat_sessions ADD COLUMN modelo_2_answered_at TEXT");
            }
            
            // Agregar modelo_2_status si no existe
            if (!in_array('modelo_2_status', $columnNames)) {
                DB::statement("ALTER TABLE chat_sessions ADD COLUMN modelo_2_status TEXT");
            }
        } else {
            // Para otros motores de base de datos (MySQL, PostgreSQL)
            Schema::table('chat_sessions', function (Blueprint $table) {
                if (!Schema::hasColumn('chat_sessions', 'modelo_id_2')) {
                    $table->unsignedBigInteger('modelo_id_2')->nullable()->after('modelo_id');
                    $table->foreign('modelo_id_2')->references('id')->on('users')->onDelete('set null');
                    $table->index('modelo_id_2');
                }
                
                if (!Schema::hasColumn('chat_sessions', 'modelo_2_invited_at')) {
                    $table->timestamp('modelo_2_invited_at')->nullable()->after('answered_at');
                }
                
                if (!Schema::hasColumn('chat_sessions', 'modelo_2_answered_at')) {
                    $table->timestamp('modelo_2_answered_at')->nullable()->after('modelo_2_invited_at');
                }
                
                if (!Schema::hasColumn('chat_sessions', 'modelo_2_status')) {
                    $table->enum('modelo_2_status', ['pending', 'accepted', 'rejected'])->nullable()->after('modelo_2_answered_at');
                }
            });
            
            // Agregar índice compuesto para SQLite (si no es SQLite, ya se agregó arriba)
            if ($driver !== 'sqlite') {
                Schema::table('chat_sessions', function (Blueprint $table) {
                    $table->index(['modelo_id_2', 'status']);
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::connection()->getDriverName();
        
        if ($driver === 'sqlite') {
            // SQLite no soporta DROP COLUMN directamente
            // En producción, esto requeriría una estrategia más compleja
            // Por ahora, solo marcamos como no usado
        } else {
            Schema::table('chat_sessions', function (Blueprint $table) {
                if (Schema::hasColumn('chat_sessions', 'modelo_2_status')) {
                    $table->dropColumn('modelo_2_status');
                }
                if (Schema::hasColumn('chat_sessions', 'modelo_2_answered_at')) {
                    $table->dropColumn('modelo_2_answered_at');
                }
                if (Schema::hasColumn('chat_sessions', 'modelo_2_invited_at')) {
                    $table->dropColumn('modelo_2_invited_at');
                }
                if (Schema::hasColumn('chat_sessions', 'modelo_id_2')) {
                    $table->dropForeign(['modelo_id_2']);
                    $table->dropIndex(['modelo_id_2']);
                    $table->dropColumn('modelo_id_2');
                }
            });
        }
    }
};
