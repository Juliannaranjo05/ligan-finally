<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUserPaymentMethodsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('user_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('payment_type'); // 'card', 'pse', 'nequi', 'bancolombia_transfer'
            $table->string('last_four_digits')->nullable(); // Para tarjetas
            $table->string('bank_name')->nullable(); // Para PSE/Bancolombia
            $table->string('account_type')->nullable(); // Para Nequi/PSE
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_used_at')->nullable();
            $table->integer('usage_count')->default(0);
            $table->json('metadata')->nullable(); // Para datos adicionales
            $table->timestamps();
            
            // Índices
            $table->index(['user_id', 'is_active']);
            $table->index(['user_id', 'is_default']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('user_payment_methods');
    }
}
