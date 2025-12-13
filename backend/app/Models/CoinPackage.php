<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CoinPackage extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'coins',
        'bonus_coins',
        'price',
        'original_price',
        'regular_price',
        'is_first_time_only',
        'minutes',
        'type',
        'is_active',
        'is_popular',
        'sort_order',
        'discount_percentage'
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
        'is_popular' => 'boolean'
    ];

    // Relaciones
    public function purchases()
    {
        return $this->hasMany(CoinPurchase::class, 'package_id');
    }

    // Accessors
    public function getTotalCoinsAttribute()
    {
        return $this->coins + $this->bonus_coins;
    }

    public function getMinutesEquivalentAttribute()
    {
        return floor($this->total_coins / 10); // 10 monedas por minuto
    }

    public function getValuePerCoinAttribute()
    {
        return $this->total_coins > 0 ? round($this->price / $this->total_coins, 4) : 0;
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopePopular($query)
    {
        return $query->where('is_popular', true);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('coins');
    }
}
