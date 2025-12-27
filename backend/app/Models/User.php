<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar',
        'preferred_language',
        'rol',
        'code_verify',
        'verification_expires_at',
        'current_access_token_id',
        'email_verified_at',
        'google_id',
        'profile_slug',
    ];
    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'balance' => 'decimal:2',
        'total_earned' => 'decimal:2',
        'last_earning_at' => 'datetime',
    ];

    public function verificacion()
    {
        return $this->hasOne(\App\Models\Verificacion::class, 'user_id', 'id');
    }

    // Accessor para verificación completa
    public function getVerificacionCompletaAttribute()
    {
        return $this->verificacion &&
            $this->verificacion->selfie &&
            $this->verificacion->documento &&
            $this->verificacion->selfie_doc &&
            $this->verificacion->video &&
            $this->verificacion->estado === 'pendiente';
    }
    public function onlineStatus()
    {
        return $this->hasOne(UserOnlineStatus::class);
    }

    /**
     * Scope para usuarios online
     */
    public function scopeOnline($query)
    {
        return $query->whereHas('onlineStatus', function($q) {
            $q->where('is_online', true)
            ->where('last_seen', '>', now()->subMinutes(5));
        });
    }

    /**
     * Scope para usuarios disponibles para chat
     */
    public function scopeAvailableForChat($query, $role = null)
    {
        $query = $query->whereHas('onlineStatus', function($q) {
            $q->where('is_online', true)
            ->whereIn('activity_type', ['browsing', 'idle'])
            ->where('last_seen', '>', now()->subMinutes(5));
        });

        if ($role) {
            $query->where('rol', $role);
        }

        return $query;
    }

    /**
     * Verificar si el usuario está online
     */
    public function isOnline()
    {
        return $this->onlineStatus && 
            $this->onlineStatus->is_online && 
            $this->onlineStatus->isRecentlyActive();
    }

    /**
     * Marcar usuario como online
     */
    public function markAsOnline($sessionId = null, $ipAddress = null, $userAgent = null, $room = null)
    {
        return $this->onlineStatus()->updateOrCreate(
            ['user_id' => $this->id],
            [
                'is_online' => true,
                'last_seen' => now(),
                'connected_at' => now(),
                'disconnected_at' => null,
                'session_id' => $sessionId,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'current_room' => $room,
                'activity_type' => $room ? 'videochat' : 'browsing',
            ]
        );
    }

    /**
     * Marcar usuario como offline
     */
    public function markAsOffline()
    {
        if ($this->onlineStatus) {
            return $this->onlineStatus->markAsOffline();
        }
        return false;
    }

    /**
     * Actualizar heartbeat del usuario
     */
    public function updateHeartbeat($room = null, $activityType = 'browsing')
    {
        if ($this->onlineStatus) {
            return $this->onlineStatus->updateHeartbeat($room, $activityType);
        }
        return false;
    }
    public function session()
    {
        return $this->hasOne(Sesion::class);
    }
    public function toArray()
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'rol' => $this->rol,
            'email_verified' => !!$this->email_verified_at,
            'verificacion_estado' => optional($this->verificacion)->estado,
            'verificacion_completa' => $this->verificacion_completa,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }



}
