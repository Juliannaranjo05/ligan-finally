<?php

// Ejecuta este comando en terminal:
// php artisan make:migration update_security_codes_code_field

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('security_codes', function (Blueprint $table) {
            // Cambiar el campo code de VARCHAR(6) a VARCHAR(255) para soportar tokens largos
            $table->string('code', 255)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('security_codes', function (Blueprint $table) {
            // Volver al tamaño original (ajusta según tu migración original)
            $table->string('code', 6)->change();
        });
    }
};