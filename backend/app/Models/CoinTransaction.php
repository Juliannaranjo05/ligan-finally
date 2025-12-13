<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CoinTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'type',
        'amount',
        'source',
        'reference_id',
        'balance_after',
        'notes'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    // Relaciones
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Accessors
    public function getTypeDisplayAttribute()
    {
        return [
            'purchased' => 'Monedas Compradas',
            'gift' => 'Monedas de Regalo'
        ][$this->type] ?? $this->type;
    }

    public function getSourceDisplayAttribute()
    {
        $sources = [
            'stripe_purchase' => 'Compra con Stripe',
            'stripe_webhook' => 'Stripe (Webhook)',
            'admin_gift' => 'Regalo del Administrador',
            'purchase_bonus' => 'Bonus por Compra',
            'purchase_bonus_webhook' => 'Bonus (Webhook)',
            'sandbox_purchase' => 'Compra de Prueba',
            'sandbox_bonus' => 'Bonus de Prueba',
            'promotion' => 'Promoción',
            'referral_bonus' => 'Bonus por Referido'
        ];

        return $sources[$this->source] ?? $this->source;
    }

    // Scopes
    public function scopePurchased($query)
    {
        return $query->where('type', 'purchased');
    }

    public function scopeGift($query)
    {
        return $query->where('type', 'gift');
    }

    public function scopeBySource($query, $source)
    {
        return $query->where('source', $source);
    }

    public function scopeRecent($query, $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }
}
