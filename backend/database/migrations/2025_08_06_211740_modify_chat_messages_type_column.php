<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            // Si es ENUM, cambiar a VARCHAR
            $table->string('type', 50)->change();
            
            // O si quieres mantener ENUM, agregar el nuevo valor:
            // $table->enum('type', ['text', 'image', 'file', 'emoji', 'gift', 'gift_request'])->change();
        });
    }

    public function down()
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            // Revertir cambios si es necesario
        });
    }
};