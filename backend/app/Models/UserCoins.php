<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserCoins extends Model
{
    use HasFactory;

    protected $table = 'user_coins';

    protected $fillable = [
        'user_id',
        'purchased_balance',
        'gift_balance',
        'total_purchased',
        'total_consumed',
        'last_purchase_at',
        'last_consumption_at'
    ];

    protected $casts = [
        'last_purchase_at' => 'datetime',
        'last_consumption_at' => 'datetime'
    ];

    // Relaciones
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function package()
    {
        return $this->belongsTo(CoinPackage::class, 'package_id');
    }

    // 🔥 NUEVOS ACCESSORS PARA SALDO
    /**
     * Obtener saldo total (compradas + regalo)
     */
    public function getTotalBalanceAttribute()
    {
        return $this->purchased_balance + $this->gift_balance;
    }

    /**
     * Obtener minutos disponibles basado SOLO en purchased_balance
     * gift_balance es solo para regalos, no para llamadas
     */
    public function getAvailableMinutesAttribute()
    {
        return floor($this->purchased_balance / 10); // 10 monedas = 1 minuto, solo purchased
    }

    /**
     * Verificar si tiene saldo suficiente
     */
    public function hasSufficientBalance($amount)
    {
        return $this->total_balance >= $amount;
    }

    /**
     * Verificar si puede pagar X minutos de videochat
     */
    public function canAffordMinutes($minutes)
    {
        $requiredCoins = $minutes * 10;
        return $this->hasSufficientBalance($requiredCoins);
    }

    /**
     * Obtener estado del saldo (normal, low, warning, critical)
     */
    public function getBalanceStatusAttribute()
    {
        $minutes = $this->available_minutes;
        
        if ($minutes <= 1) {
            return 'critical';
        } elseif ($minutes <= 3) {
            return 'warning';
        } elseif ($minutes <= 5) {
            return 'low';
        }
        
        return 'normal';
    }

    // Accessors existentes actualizados
    public function getMinutesEquivalentAttribute()
    {
        return $this->available_minutes; // Usar el nuevo método
    }

    public function getIsCompletedAttribute()
    {
        return $this->status === 'completed';
    }

    public function getIsPendingAttribute()
    {
        return $this->status === 'pending';
    }

    // Scopes existentes
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    // 🔥 NUEVOS SCOPES PARA SALDO
    public function scopeWithSufficientBalance($query, $minimumCoins)
    {
        return $query->whereRaw('(purchased_balance + gift_balance) >= ?', [$minimumCoins]);
    }

    public function scopeWithLowBalance($query)
    {
        return $query->whereRaw('(purchased_balance + gift_balance) <= ?', [50]); // Menos de 5 minutos
    }

    public function scopeWithCriticalBalance($query)
    {
        return $query->whereRaw('(purchased_balance + gift_balance) <= ?', [10]); // Menos de 1 minuto
    }

    // 🔥 MÉTODO PARA CONSUMIR MONEDAS
    public function consumeCoins($amount, $type = 'videochat')
    {
        if (!$this->hasSufficientBalance($amount)) {
            return false;
        }

        // Consumir primero de gift_balance, luego de purchased_balance
        if ($this->gift_balance >= $amount) {
            $this->gift_balance -= $amount;
        } else {
            $remaining = $amount - $this->gift_balance;
            $this->gift_balance = 0;
            $this->purchased_balance -= $remaining;
        }

        $this->total_consumed += $amount;
        $this->last_consumption_at = now();
        $this->save();

        return true;
    }

    // 🔥 MÉTODO PARA AGREGAR MONEDAS
    public function addCoins($amount, $type = 'purchase')
    {
        if ($type === 'gift') {
            $this->gift_balance += $amount;
        } else {
            $this->purchased_balance += $amount;
            $this->total_purchased += $amount;
            $this->last_purchase_at = now();
        }

        $this->save();
        return true;
    }
}