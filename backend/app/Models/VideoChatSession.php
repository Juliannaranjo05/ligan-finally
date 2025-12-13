<?php

// En app/Models/VideoChatSession.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VideoChatSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'room_name',
        'user_role',
        'status',
        'is_consuming',
        'consumption_rate',
        'total_consumed',
        'actual_duration_seconds',    // 🔥 NUEVO CAMPO
        'is_manual_duration',         // 🔥 NUEVO CAMPO
        'end_reason',                 // 🔥 NUEVO CAMPO
        'started_at',
        'last_consumption_at',
        'ended_at'
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'last_consumption_at' => 'datetime',
        'ended_at' => 'datetime',
        'is_consuming' => 'boolean',
        'is_manual_duration' => 'boolean',  // 🔥 NUEVO CAST
        'consumption_rate' => 'decimal:2',
        'total_consumed' => 'decimal:2',
        'actual_duration_seconds' => 'integer'  // 🔥 NUEVO CAST
    ];

    // Relaciones existentes...
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // 🔥 NUEVOS MÉTODOS HELPER
    public function getDurationFormattedAttribute()
    {
        if (!$this->actual_duration_seconds) {
            return '00:00';
        }
        
        $minutes = floor($this->actual_duration_seconds / 60);
        $seconds = $this->actual_duration_seconds % 60;
        
        return sprintf('%02d:%02d', $minutes, $seconds);
    }

    public function getDurationMinutesAttribute()
    {
        if (!$this->actual_duration_seconds) {
            return 0;
        }
        
        return round($this->actual_duration_seconds / 60, 2);
    }

    public function isQualifyingSession()
    {
        return $this->actual_duration_seconds >= 60;
    }

    // 🔥 SCOPE PARA BUSCAR SESIONES CON DURACIÓN MANUAL
    public function scopeWithManualDuration($query)
    {
        return $query->where('is_manual_duration', true);
    }

    public function scopeWithAutomaticDuration($query)
    {
        return $query->where('is_manual_duration', false);
    }
}