<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Opción simple: agregar solo las columnas necesarias
        Schema::table('gift_transactions', function (Blueprint $table) {
            $table->string('gift_id')->nullable()->after('receiver_id');
            $table->string('room_name')->nullable()->after('reference_id');
            $table->json('gift_data')->nullable()->after('room_name');
        });
    }

    public function down()
    {
        Schema::table('gift_transactions', function (Blueprint $table) {
            $table->dropColumn(['gift_id', 'room_name', 'gift_data']);
        });
    }
};

// Si usas esta migración simple, puedes crear los índices después manualmente:
// ALTER TABLE gift_transactions ADD INDEX idx_room_name (room_name);
// ALTER TABLE gift_transactions ADD INDEX idx_type (type);