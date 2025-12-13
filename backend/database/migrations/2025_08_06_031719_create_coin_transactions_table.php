<?php

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
        Schema::create('coin_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->enum('type', ['purchased', 'gift']);
            $table->integer('amount');
            $table->decimal('usd_amount', 10, 2)->default(0.00);
            $table->string('source');
            $table->string('reference_id')->nullable();
            $table->integer('balance_after');
            $table->text('notes')->nullable();
            $table->timestamps();

            // Indices
            $table->index('user_id');
            $table->index('type');

            // Foreign key
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('coin_transactions');
    }
};