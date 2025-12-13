<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddAvatarAndLanguageToUsersTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Agregar avatar después de country_name
            $table->string('avatar')->nullable()->after('country_name');
            
            // Agregar preferred_language después de avatar
            $table->string('preferred_language', 5)->default('es')->after('avatar');
            
            // Índice para preferred_language
            $table->index('preferred_language');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['preferred_language']);
            $table->dropColumn(['avatar', 'preferred_language']);
        });
    }
}