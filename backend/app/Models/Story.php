<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Story extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'file_path',
        'mime_type',
        'source_type',
        'status',
        'approved_at',
        'approved_by',
        'rejection_reason',
        'views_count',
        'expires_at',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['file_url'];

    // Relaciones
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function views()
    {
        return $this->hasMany(StoryView::class);
    }

    // Accessors
    public function getFileUrlAttribute()
    {
        if ($this->file_path) {
            return Storage::url($this->file_path);
        }
        return null;
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    public function scopeActive($query)
    {
        return $query->approved()
                    ->where('expires_at', '>', now());
    }

    public function scopeExpired($query)
    {
        return $query->approved()
                    ->where('expires_at', '<=', now());
    }

    // Métodos de negocio
    public function approve($adminId = null)
    {
        $this->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => $adminId,
            'expires_at' => now()->addHours(24), // Aquí empieza el countdown de 24h
        ]);

        return $this;
    }

    public function reject($reason = null, $adminId = null)
    {
        $this->update([
            'status' => 'rejected',
            'rejection_reason' => $reason,
            'approved_by' => $adminId,
        ]);

        return $this;
    }

    public function addView($userId = null, $ipAddress = null)
    {
        // Solo contar vistas en historias aprobadas
        if ($this->status !== 'approved') {
            return false;
        }

        try {
            StoryView::create([
                'story_id' => $this->id,
                'user_id' => $userId,
                'ip_address' => $ipAddress,
                'viewed_at' => now(),
            ]);

            // Incrementar contador
            $this->increment('views_count');
            
            return true;
        } catch (\Exception $e) {
            // Ya existe una vista de este usuario/IP, no hacer nada
            return false;
        }
    }

    public function isExpired()
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function isPending()
    {
        return $this->status === 'pending';
    }

    public function isApproved()
    {
        return $this->status === 'approved';
    }

    public function isRejected()
    {
        return $this->status === 'rejected';
    }

    public function isActive()
    {
        return $this->isApproved() && !$this->isExpired();
    }

    // Limpiar historias expiradas (para comando/job)
    public static function cleanExpired()
    {
        $expiredStories = self::expired()->get();
        
        foreach ($expiredStories as $story) {
            // Eliminar archivo
            if ($story->file_path && Storage::disk('public')->exists($story->file_path)) {
                Storage::disk('public')->delete($story->file_path);
            }
            
            // Eliminar registro
            $story->delete();
        }

        return $expiredStories->count();
    }
}