<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class UserPaymentMethod extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'payment_type',
        'last_four_digits',
        'bank_name',
        'account_type',
        'is_default',
        'is_active',
        'last_used_at',
        'usage_count',
        'metadata'
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'last_used_at' => 'datetime',
        'usage_count' => 'integer',
        'metadata' => 'array'
    ];

    // Relaciones
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('payment_type', $type);
    }

    // Accessors
    public function getDisplayNameAttribute()
    {
        $types = [
            'card' => 'Tarjeta',
            'pse' => 'PSE',
            'nequi' => 'Nequi',
            'bancolombia_transfer' => 'Bancolombia'
        ];

        $typeName = $types[$this->payment_type] ?? $this->payment_type;

        if ($this->payment_type === 'card' && $this->last_four_digits) {
            return "Tarjeta •••• {$this->last_four_digits}";
        }

        if ($this->bank_name) {
            return "{$typeName} - {$this->bank_name}";
        }

        return $typeName;
    }

    public function getFormattedLastUsedAttribute()
    {
        if (!$this->last_used_at) {
            return 'Nunca usado';
        }

        return $this->last_used_at->diffForHumans();
    }

    // Métodos
    public function markAsDefault()
    {
        // Desmarcar otros métodos como default del mismo usuario
        static::where('user_id', $this->user_id)
            ->where('id', '!=', $this->id)
            ->update(['is_default' => false]);

        $this->update(['is_default' => true]);
    }

    public function deactivate()
    {
        $this->update(['is_active' => false]);

        // Si era el default, quitar el flag
        if ($this->is_default) {
            $this->update(['is_default' => false]);
        }
    }

    public function incrementUsage()
    {
        $this->increment('usage_count');
        $this->update(['last_used_at' => now()]);
    }
}
