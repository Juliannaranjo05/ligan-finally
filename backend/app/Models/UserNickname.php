<?php
// app/Models/UserNickname.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserNickname extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'target_user_id',
        'nickname',
    ];

    // Relación con el usuario que pone el apodo
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // Relación con el usuario que recibe el apodo
    public function targetUser()
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }
}