<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class ChatSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'cliente_id',
        'modelo_id',
        'room_name',
        'session_type',
        'call_type',
        'status',
        'end_reason',
        'modelo_data',
        'started_at',
        'answered_at',
        'ended_at'
    ];

    protected $casts = [
        'modelo_data' => 'array',
        'started_at' => 'datetime',
        'answered_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    // Relaciones
    public function cliente()
    {
        return $this->belongsTo(User::class, 'cliente_id');
    }

    public function modelo()
    {
        return $this->belongsTo(User::class, 'modelo_id');
    }

    // Alias para compatibilidad con CallController
    public function caller()
    {
        return $this->belongsTo(User::class, 'cliente_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'modelo_id');
    }

    // Scopes generales
    public function scopeWaiting($query)
    {
        return $query->where('status', 'waiting');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeForCliente($query, $clienteId)
    {
        return $query->where('cliente_id', $clienteId);
    }

    public function scopeForModelo($query, $modeloId)
    {
        return $query->where('modelo_id', $modeloId);
    }

    // Scopes específicos para llamadas
    public function scopeCalls($query)
    {
        return $query->where('session_type', 'call');
    }

    public function scopeChats($query)
    {
        return $query->where('session_type', 'chat');
    }

    public function scopeCalling($query)
    {
        return $query->where('status', 'calling');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    public function scopeCancelled($query)
    {
        return $query->where('status', 'cancelled');
    }

    // Scopes para estados activos de llamadas
    public function scopeActiveCallStates($query)
    {
        return $query->whereIn('status', ['calling', 'active']);
    }

    public function scopeFinishedCallStates($query)
    {
        return $query->whereIn('status', ['ended', 'rejected', 'cancelled']);
    }

    // Métodos de utilidad
    public function isCall()
    {
        return $this->session_type === 'call';
    }

    public function isChat()
    {
        return $this->session_type === 'chat';
    }

    public function isVideoCall()
    {
        return $this->isCall() && $this->call_type === 'video';
    }

    public function isAudioCall()
    {
        return $this->isCall() && $this->call_type === 'audio';
    }

    public function isActive()
    {
        return $this->status === 'active';
    }

    public function isCalling()
    {
        return $this->status === 'calling';
    }

    public function isFinished()
    {
        return in_array($this->status, ['ended', 'rejected', 'cancelled']);
    }

    // Calcular duración
    public function getDurationAttribute()
    {
        if (!$this->started_at) {
            return 0;
        }

        $endTime = $this->ended_at ?? now();
        $startTime = $this->answered_at ?? $this->started_at;

        return $startTime->diffInSeconds($endTime);
    }

    public function getCallDurationAttribute()
    {
        if (!$this->isCall() || !$this->answered_at) {
            return 0;
        }

        $endTime = $this->ended_at ?? now();
        return $this->answered_at->diffInSeconds($endTime);
    }

    public function getRingingDurationAttribute()
    {
        if (!$this->isCall() || !$this->started_at) {
            return 0;
        }

        $endTime = $this->answered_at ?? $this->ended_at ?? now();
        return $this->started_at->diffInSeconds($endTime);
    }

    // Formatear duraciones
    public function getFormattedDurationAttribute()
    {
        return $this->formatDuration($this->duration);
    }

    public function getFormattedCallDurationAttribute()
    {
        return $this->formatDuration($this->call_duration);
    }

    private function formatDuration($seconds)
    {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $seconds = $seconds % 60;

        if ($hours > 0) {
            return sprintf('%02d:%02d:%02d', $hours, $minutes, $seconds);
        }

        return sprintf('%02d:%02d', $minutes, $seconds);
    }

    // Métodos para obtener participantes según el contexto
    public function getCallerAttribute()
    {
        return $this->cliente;
    }

    public function getReceiverAttribute()
    {
        return $this->modelo;
    }

    // Scope para buscar por participante (cliente o modelo)
    public function scopeForParticipant($query, $userId)
    {
        return $query->where(function($q) use ($userId) {
            $q->where('cliente_id', $userId)
              ->orWhere('modelo_id', $userId);
        });
    }
}