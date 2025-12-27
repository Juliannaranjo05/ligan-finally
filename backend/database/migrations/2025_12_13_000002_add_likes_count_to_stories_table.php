<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('stories', function (Blueprint $table) {
            if (!Schema::hasColumn('stories', 'likes_count')) {
                $table->unsignedInteger('likes_count')->default(0)->after('views_count');
            }
        });
    }

    public function down()
    {
        Schema::table('stories', function (Blueprint $table) {
            if (Schema::hasColumn('stories', 'likes_count')) {
                $table->dropColumn('likes_count');
            }
        });
    }
};




