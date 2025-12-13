
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
        Schema::create('coin_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('coins');
            $table->integer('bonus_coins')->default(0);
            $table->decimal('price', 8, 2);
            $table->decimal('original_price', 8, 2);
            $table->decimal('regular_price', 8, 2);
            $table->boolean('is_first_time_only')->default(false);
            $table->integer('minutes')->default(0);
            $table->enum('type', ['minutes', 'gifts'])->default('minutes');
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_popular')->default(false);
            $table->integer('sort_order')->default(0);
            $table->integer('discount_percentage')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('coin_packages');
    }
};
