<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sesion extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'room_name',
        'activa',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
