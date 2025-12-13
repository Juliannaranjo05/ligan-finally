<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddStatusAndVerificationFieldsToStoriesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('stories', function (Blueprint $table) {
            if (!Schema::hasColumn('stories', 'status')) {
                $table->string('status')->default('pending');
            }
            if (!Schema::hasColumn('stories', 'approved_at')) {
                $table->timestamp('approved_at')->nullable();
            }
            if (!Schema::hasColumn('stories', 'approved_by')) {
                $table->unsignedBigInteger('approved_by')->nullable();
            }
            if (!Schema::hasColumn('stories', 'rejection_reason')) {
                $table->string('rejection_reason')->nullable();
            }
            if (!Schema::hasColumn('stories', 'views_count')) {
                $table->unsignedInteger('views_count')->default(0);
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('stories', function (Blueprint $table) {
            if (Schema::hasColumn('stories', 'status')) {
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('stories', 'approved_at')) {
                $table->dropColumn('approved_at');
            }
            if (Schema::hasColumn('stories', 'approved_by')) {
                $table->dropColumn('approved_by');
            }
            if (Schema::hasColumn('stories', 'rejection_reason')) {
                $table->dropColumn('rejection_reason');
            }
            if (Schema::hasColumn('stories', 'views_count')) {
                $table->dropColumn('views_count');
            }
        });
    }
}
