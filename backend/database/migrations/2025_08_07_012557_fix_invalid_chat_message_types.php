<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up(): void
    {
        $validTypes = ['text', 'image', 'video', 'system', 'gift', 'gift_request'];

        // Buscar registros inválidos
        $invalidRows = DB::table('chat_messages')
            ->whereNotIn('type', $validTypes)
            ->get();

        if ($invalidRows->isEmpty()) {
            Log::info('✅ No se encontraron registros inválidos en chat_messages.type');
        } else {
            foreach ($invalidRows as $row) {
                Log::warning('⚠️ Registro con tipo inválido:', (array) $row);
            }

            // ✅ Opción segura: cambiar a 'text' (u otro valor válido)
            DB::table('chat_messages')
                ->whereNotIn('type', $validTypes)
                ->update(['type' => 'text']);

            Log::info('🔧 Se corrigieron los tipos inválidos en chat_messages a "text"');
        }
    }

    public function down(): void
    {
        // No revertimos los cambios
    }
};
