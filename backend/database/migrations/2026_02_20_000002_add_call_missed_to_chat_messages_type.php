<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            $constraintName = 'chat_messages_type_check_v4';
            $possibleNames = [
                'chat_messages_type_check_v3',
                'chat_messages_type_check_v2',
                'chat_messages_type_check',
                'chat_messages_chk_1',
                'chat_messages_chk_type'
            ];

            foreach ($possibleNames as $name) {
                try {
                    DB::statement("ALTER TABLE chat_messages DROP CHECK `{$name}`");
                } catch (\Exception $e) {
                    // Ignore if constraint does not exist
                }
            }

            DB::statement('
                ALTER TABLE chat_messages
                MODIFY COLUMN `type` VARCHAR(50) NOT NULL
            ');

            DB::statement("
                ALTER TABLE chat_messages
                ADD CONSTRAINT `{$constraintName}`
                CHECK (`type` IN (
                    'text',
                    'image',
                    'video',
                    'audio',
                    'system',
                    'gift_request',
                    'gift_sent',
                    'gift_received',
                    'call_ended',
                    'call_missed'
                ))
            ");
        } elseif ($driver === 'pgsql') {
            $constraintName = 'chat_messages_type_check_v4';
            $possibleNames = ['chat_messages_type_check_v3', 'chat_messages_type_check_v2', 'chat_messages_type_check'];

            foreach ($possibleNames as $name) {
                DB::statement("ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS {$name}");
            }

            DB::statement("
                ALTER TABLE chat_messages
                ADD CONSTRAINT {$constraintName}
                CHECK (type IN (
                    'text',
                    'image',
                    'video',
                    'audio',
                    'system',
                    'gift_request',
                    'gift_sent',
                    'gift_received',
                    'call_ended',
                    'call_missed'
                ))
            ");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            try {
                DB::statement('ALTER TABLE chat_messages DROP CHECK `chat_messages_type_check_v4`');
            } catch (\Exception $e) {
                // Ignore if constraint does not exist
            }

            DB::statement("
                ALTER TABLE chat_messages
                ADD CONSTRAINT `chat_messages_type_check_v3`
                CHECK (`type` IN (
                    'text',
                    'image',
                    'video',
                    'audio',
                    'system',
                    'gift_request',
                    'gift_sent',
                    'gift_received',
                    'call_ended'
                ))
            ");
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check_v4');

            DB::statement("
                ALTER TABLE chat_messages
                ADD CONSTRAINT chat_messages_type_check_v3
                CHECK (type IN (
                    'text',
                    'image',
                    'video',
                    'audio',
                    'system',
                    'gift_request',
                    'gift_sent',
                    'gift_received',
                    'call_ended'
                ))
            ");
        }
    }
};
