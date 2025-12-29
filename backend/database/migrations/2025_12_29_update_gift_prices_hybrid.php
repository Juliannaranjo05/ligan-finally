<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     * - Backs up current prices for the first 10 active gifts ordered by price asc
     * - Updates those gifts to the hybrid price list
     */
    public function up(): void
    {
        // Hybrid price list (user-selected)
        $hybrid = [3, 5, 7, 10, 15, 22, 33, 50, 75, 100];

        // Create a backup table to allow rollback
        if (!Schema::hasTable('gift_price_backups')) {
            Schema::create('gift_price_backups', function ($table) {
                $table->string('gift_id')->primary();
                $table->integer('old_price')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }

        // Select first 10 active gifts ordered by price asc
        $gifts = DB::table('gifts')
            ->where('is_active', true)
            ->orderBy('price', 'asc')
            ->limit(count($hybrid))
            ->get();

        foreach ($gifts as $index => $gift) {
            $newPrice = $hybrid[$index] ?? null;
            if ($newPrice === null) continue;

            // Backup previous price
            DB::table('gift_price_backups')->updateOrInsert(
                ['gift_id' => $gift->id],
                ['old_price' => (int) $gift->price, 'created_at' => now()]
            );

            // Update gift price
            DB::table('gifts')->where('id', $gift->id)->update(['price' => $newPrice]);

            Log::info("[migration] Updated gift {$gift->id} price from {$gift->price} to {$newPrice}");
        }
    }

    /**
     * Reverse the migrations.
     * - Restores prices from the backup table and drops it
     */
    public function down(): void
    {
        if (!Schema::hasTable('gift_price_backups')) {
            return;
        }

        $backups = DB::table('gift_price_backups')->get();
        foreach ($backups as $b) {
            try {
                DB::table('gifts')->where('id', $b->gift_id)->update(['price' => (int) $b->old_price]);
                Log::info("[migration rollback] Restored price for gift {$b->gift_id} to {$b->old_price}");
            } catch (\Exception $e) {
                Log::error("[migration rollback] Failed to restore price for {$b->gift_id}: " . $e->getMessage());
            }
        }

        Schema::dropIfExists('gift_price_backups');
    }
};
