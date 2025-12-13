<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SessionEarning extends Model
{
    protected $fillable = [
        'session_id',
        'model_user_id',
        'client_user_id', 
        'room_name',
        'source_type',
        'session_duration_seconds',
        'qualifying_session',
        'total_time_coins_spent',
        'total_gifts_coins_spent',
        'total_coins_spent',
        'client_usd_spent',
        'stripe_commission',
        'after_stripe_amount',
        'model_time_earnings',
        'model_gift_earnings', 
        'model_total_earnings',
        'platform_time_earnings',
        'platform_gift_earnings',
        'platform_total_earnings',
        'gift_count',
        'gift_details',
        'session_started_at',
        'session_ended_at',
        'processed_at',
        'weekly_payment_id'
    ];

    protected $casts = [
        'qualifying_session' => 'boolean',
        'session_duration_seconds' => 'integer',
        'total_time_coins_spent' => 'decimal:2',
        'total_gifts_coins_spent' => 'decimal:2', 
        'total_coins_spent' => 'decimal:2',
        'client_usd_spent' => 'decimal:2',
        'stripe_commission' => 'decimal:2',
        'after_stripe_amount' => 'decimal:2',
        'model_time_earnings' => 'decimal:2',
        'model_gift_earnings' => 'decimal:2',
        'model_total_earnings' => 'decimal:2',
        'platform_time_earnings' => 'decimal:2',
        'platform_gift_earnings' => 'decimal:2',
        'platform_total_earnings' => 'decimal:2',
        'gift_count' => 'integer',
        'gift_details' => 'array',
        'session_started_at' => 'datetime',
        'session_ended_at' => 'datetime',
        'processed_at' => 'datetime'
    ];

    // 🔥 RELACIONES
    public function model(): BelongsTo
    {
        return $this->belongsTo(User::class, 'model_user_id');
    }

    public function client(): BelongsTo  
    {
        return $this->belongsTo(User::class, 'client_user_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(VideoChatSession::class, 'session_id');
    }

    public function weeklyPayment(): BelongsTo
    {
        return $this->belongsTo(WeeklyPayment::class, 'weekly_payment_id');
    }

    // 🔥 SCOPES ÚTILES
    public function scopeUnpaid($query)
    {
        return $query->whereNull('weekly_payment_id');
    }

    public function scopeTimeEarnings($query)
    {
        return $query->where('model_time_earnings', '>', 0);
    }

    public function scopeGiftEarnings($query) 
    {
        return $query->where('model_gift_earnings', '>', 0);
    }

    public function scopeQualifying($query)
    {
        return $query->where('qualifying_session', true);
    }

    public function scopeForModel($query, $modelId)
    {
        return $query->where('model_user_id', $modelId);
    }

    public function scopeThisWeek($query)
    {
        $now = now();
        $startOfWeek = $now->copy()->startOfWeek(\Carbon\Carbon::MONDAY);
        $endOfWeek = $now->copy()->endOfWeek(\Carbon\Carbon::SUNDAY)->endOfDay();
        
        return $query->whereBetween('created_at', [$startOfWeek, $endOfWeek]);
    }

    // 🔥 MÉTODOS ÚTILES
    public function getDurationFormatted(): string
    {
        if ($this->session_duration_seconds < 60) {
            return "< 1 min";
        }
        
        $minutes = floor($this->session_duration_seconds / 60);
        return "{$minutes} min";
    }

    public function getSourceTypeLabel(): string
    {
        return match($this->source_type) {
            'video_session' => 'Videochat',
            'direct_gift' => 'Regalo Directo',
            'chat_gift' => 'Regalo en Chat',
            default => 'Sesión'
        };
    }

    public function isGiftOnly(): bool
    {
        return $this->model_time_earnings == 0 && $this->model_gift_earnings > 0;
    }

    public function isTimeOnly(): bool
    {
        return $this->model_time_earnings > 0 && $this->model_gift_earnings == 0;
    }

    public function isMixed(): bool
    {
        return $this->model_time_earnings > 0 && $this->model_gift_earnings > 0;
    }

    // 🔥 MÉTODO ESTÁTICO PARA BALANCE DINÁMICO
    public static function getModelBalance($modelId): array
    {
        $unpaidEarnings = self::unpaid()
            ->forModel($modelId)
            ->get();

        $thisWeekEarnings = self::thisWeek()
            ->forModel($modelId)
            ->get();

        return [
            'current_balance' => $unpaidEarnings->sum('model_total_earnings'),
            'time_earnings' => $unpaidEarnings->sum('model_time_earnings'),
            'gift_earnings' => $unpaidEarnings->sum('model_gift_earnings'),
            'weekly_time_earnings' => $thisWeekEarnings->sum('model_time_earnings'),
            'weekly_gift_earnings' => $thisWeekEarnings->sum('model_gift_earnings'), 
            'weekly_total_earnings' => $thisWeekEarnings->sum('model_total_earnings'),
            'weekly_sessions_count' => $thisWeekEarnings->where('model_time_earnings', '>', 0)->count(),
            'weekly_gifts_count' => $thisWeekEarnings->sum('gift_count')
        ];
    }


   

}
