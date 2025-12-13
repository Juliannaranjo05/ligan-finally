<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class UserGiftCoins extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'balance',
        'total_received',
        'total_sent',
        'last_received_at',
        'last_sent_at'
    ];

    protected $casts = [
        'last_received_at' => 'datetime',
        'last_sent_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}