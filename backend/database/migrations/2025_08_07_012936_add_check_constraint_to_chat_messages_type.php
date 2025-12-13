<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Elimina la restricción anterior (si existía)
	// Agrega nueva restricción CHECK
        DB::statement("
            ALTER TABLE chat_messages
            ADD CONSTRAINT chat_messages_type_check
            CHECK (type IN ('text', 'image', 'video', 'system', 'gift', 'gift_request'))
        ");
    }

    public function down(): void
    {
        // Revertir: eliminar la restricción
        DB::statement("ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check");
    }
};
