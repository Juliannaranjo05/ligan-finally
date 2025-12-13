<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class ChatMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_name',
        'user_id', 
        'user_name',
        'user_role',
        'message',
        'type',
        'extra_data'
    ];

    protected $casts = [
        'extra_data' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    // Relación con usuario
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Scope para mensajes recientes (últimos 10 minutos)
    public function scopeRecent($query)
    {
        return $query->where('created_at', '>=', Carbon::now()->subMinutes(10));
    }

    // Scope para una sala específica
    public function scopeForRoom($query, $roomName)
    {
        return $query->where('room_name', $roomName);
    }
}