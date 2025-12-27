<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use App\Models\StoryLike;
use App\Models\StoryView;
use App\Services\PlatformSettingsService;

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
        'likes_count',
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

    public function likes()
    {
        return $this->hasMany(StoryLike::class);
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
        $storyDurationHours = PlatformSettingsService::getInteger('story_duration_hours', 24);
        $this->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => $adminId,
            'expires_at' => now()->addHours($storyDurationHours),
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

    public function addLike($userId)
    {
        \Log::info('🔍 [STORY MODEL] addLike llamado', [
            'story_id' => $this->id,
            'user_id' => $userId,
            'status' => $this->status
        ]);

        // Solo permitir likes en historias aprobadas
        if ($this->status !== 'approved') {
            \Log::warning('⚠️ [STORY MODEL] Historia no aprobada, no se puede dar like', [
                'story_id' => $this->id,
                'status' => $this->status
            ]);
            return false;
        }

        try {
            // Verificar si ya existe el like antes de crear
            $existingLike = StoryLike::where('story_id', $this->id)
                ->where('user_id', $userId)
                ->first();

            if ($existingLike) {
                \Log::info('ℹ️ [STORY MODEL] Like ya existe', [
                    'story_id' => $this->id,
                    'user_id' => $userId
                ]);
                return false;
            }

            \Log::info('💾 [STORY MODEL] Creando like en base de datos');
            StoryLike::create([
                'story_id' => $this->id,
                'user_id' => $userId,
                'liked_at' => now(),
            ]);

            \Log::info('📈 [STORY MODEL] Incrementando contador de likes');
            // Incrementar contador
            $this->increment('likes_count');
            
            \Log::info('✅ [STORY MODEL] Like agregado exitosamente', [
                'new_likes_count' => $this->fresh()->likes_count
            ]);
            
            return true;
        } catch (\Exception $e) {
            \Log::error('💥 [STORY MODEL] Error en addLike', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            // Ya existe un like de este usuario o error de BD
            return false;
        }
    }

    public function removeLike($userId)
    {
        \Log::info('🔍 [STORY MODEL] removeLike llamado', [
            'story_id' => $this->id,
            'user_id' => $userId
        ]);

        try {
            $deleted = StoryLike::where('story_id', $this->id)
                ->where('user_id', $userId)
                ->delete();

            \Log::info('🗑️ [STORY MODEL] Resultado de delete', [
                'deleted' => $deleted
            ]);

            if ($deleted) {
                \Log::info('📉 [STORY MODEL] Decrementando contador de likes');
                // Decrementar contador
                $this->decrement('likes_count');
                
                \Log::info('✅ [STORY MODEL] Like removido exitosamente', [
                    'new_likes_count' => $this->fresh()->likes_count
                ]);
                
                return true;
            }
            
            \Log::warning('⚠️ [STORY MODEL] No se encontró like para remover');
            return false;
        } catch (\Exception $e) {
            \Log::error('💥 [STORY MODEL] Error en removeLike', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    public function hasUserLiked($userId)
    {
        return $this->likes()->where('user_id', $userId)->exists();
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