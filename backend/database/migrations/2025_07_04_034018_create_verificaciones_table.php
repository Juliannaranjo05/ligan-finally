<?php

// database/migrations/xxxx_xx_xx_create_verificaciones_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateVerificacionesTable extends Migration
{
    public function up()
    {
        Schema::create('verificaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('selfie');
            $table->string('documento');
            $table->string('selfie_doc');
            $table->string('video');
            $table->enum('estado', ['pendiente', 'aprobada', 'rechazada'])->default('pendiente');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('verificaciones');
    }
}

