<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GiftRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'modelo_id',
        'client_id',
        'gift_id',
        'amount',
        'message',
        'room_name',
        'chat_session_id',
        'status',
        'expires_at',
        'processed_at',
        'rejection_reason',
        'gift_data'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'processed_at' => 'datetime',
        'gift_data' => 'array'
    ];

    /**
     * Relación con la modelo que pide el regalo
     */
    public function modelo()
    {
        return $this->belongsTo(User::class, 'modelo_id');
    }

    /**
     * Relación con el cliente que da el regalo
     */
    public function client()
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * Relación con el regalo
     */
    public function gift()
    {
        return $this->belongsTo(Gift::class, 'gift_id');
    }

    /**
     * Verificar si la solicitud está expirada
     */
    public function isExpired()
    {
        return $this->expires_at < now();
    }

    /**
     * Verificar si está pendiente
     */
    public function isPending()
    {
        return $this->status === 'pending' && !$this->isExpired();
    }

    /**
     * Marcar como expirada
     */
    public function markAsExpired()
    {
        $this->update([
            'status' => 'expired',
            'processed_at' => now()
        ]);
    }

    /**
     * Scope para solicitudes pendientes
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending')
                    ->where('expires_at', '>', now());
    }

    /**
     * Scope para solicitudes expiradas
     */
    public function scopeExpired($query)
    {
        return $query->where('status', 'pending')
                    ->where('expires_at', '<=', now());
    }
}