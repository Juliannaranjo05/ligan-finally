<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CoinConsumption extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'room_name',
        'session_id',
        'minutes_consumed',
        'coins_consumed',
        'gift_coins_used',
        'purchased_coins_used',
        'balance_after',
        'consumed_at'
    ];

    protected $casts = [
        'minutes_consumed' => 'decimal:2',
        'consumed_at' => 'datetime'
    ];

    // Relaciones
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Accessors
    public function getConsumptionBreakdownAttribute()
    {
        return [
            'gift_percentage' => $this->coins_consumed > 0 ? round(($this->gift_coins_used / $this->coins_consumed) * 100, 1) : 0,
            'purchased_percentage' => $this->coins_consumed > 0 ? round(($this->purchased_coins_used / $this->coins_consumed) * 100, 1) : 0
        ];
    }

    public function getCostPerMinuteAttribute()
    {
        return $this->minutes_consumed > 0 ? round($this->coins_consumed / $this->minutes_consumed, 2) : 0;
    }

    // Scopes
    public function scopeByRoom($query, $roomName)
    {
        return $query->where('room_name', $roomName);
    }

    public function scopeBySession($query, $sessionId)
    {
        return $query->where('session_id', $sessionId);
    }

    public function scopeRecent($query, $days = 30)
    {
        return $query->where('consumed_at', '>=', now()->subDays($days));
    }

    public function scopeToday($query)
    {
        return $query->whereDate('consumed_at', today());
    }

    public function scopeThisWeek($query)
    {
        return $query->where('consumed_at', '>=', now()->startOfWeek());
    }

    public function scopeThisMonth($query)
    {
        return $query->where('consumed_at', '>=', now()->startOfMonth());
    }
}