<?php

// Crear nueva migración:
// php artisan make:migration add_actual_duration_to_videochat_sessions_table

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('video_chat_sessions', function (Blueprint $table) {
            $table->integer('actual_duration_seconds')->nullable()->after('total_consumed');
            $table->boolean('is_manual_duration')->default(false)->after('actual_duration_seconds');
            $table->string('end_reason')->nullable()->after('is_manual_duration');
        });
    }

    public function down()
    {
        Schema::table('video_chat_sessions', function (Blueprint $table) {
            $table->dropColumn(['actual_duration_seconds', 'is_manual_duration', 'end_reason']);
        });
    }
};