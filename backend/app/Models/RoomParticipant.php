<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomParticipant extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_name',
        'user_id',
        'user_type', // 'cliente' o 'modelo'
        'user_name',
        'session_id',
        'joined_at',
        'left_at',
        'is_active',
        'connection_data'
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'is_active' => 'boolean',
        'connection_data' => 'json'
    ];

    /**
     * Relación con la sesión de chat
     */
    public function chatSession(): BelongsTo
    {
        return $this->belongsTo(ChatSession::class, 'session_id');
    }

    /**
     * Relación con el usuario (si tienes un modelo User)
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope para participantes activos
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope para participantes de una sala específica
     */
    public function scopeInRoom($query, $roomName)
    {
        return $query->where('room_name', $roomName);
    }

    /**
     * Marcar participante como desconectado
     */
    public function markAsLeft()
    {
        $this->update([
            'left_at' => now(),
            'is_active' => false
        ]);
    }

    /**
     * Obtener duración de la participación
     */
    public function getDurationAttribute()
    {
        if (!$this->left_at) {
            return null;
        }
        
        return $this->joined_at->diffInSeconds($this->left_at);
    }
}