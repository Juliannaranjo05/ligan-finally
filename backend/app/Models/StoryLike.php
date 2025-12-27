<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoryLike extends Model
{
    use HasFactory;

    protected $fillable = [
        'story_id',
        'user_id',
        'liked_at',
    ];

    protected $casts = [
        'liked_at' => 'datetime',
    ];

    public $timestamps = false;

    // Relaciones
    public function story()
    {
        return $this->belongsTo(Story::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}




