<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CoinPurchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'package_id',
        'coins',
        'bonus_coins',
        'total_coins',
        'amount',
        'currency',
        'payment_method',
        'status',
        'transaction_id',
        'payment_data',
        'completed_at'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_data' => 'array',
        'completed_at' => 'datetime'
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

    public function coinTransactions()
    {
        return $this->hasMany(CoinTransaction::class, 'reference_id', 'id')
                   ->where('source', 'LIKE', '%purchase%');
    }

    // Accessors
    public function getMinutesEquivalentAttribute()
    {
        return floor($this->total_coins / 10); // 10 monedas por minuto
    }

    public function getIsCompletedAttribute()
    {
        return $this->status === 'completed';
    }

    public function getIsPendingAttribute()
    {
        return $this->status === 'pending';
    }

    public function getStatusDisplayAttribute()
    {
        $statuses = [
            'pending' => 'Pendiente',
            'completed' => 'Completado',
            'failed' => 'Fallido',
            'cancelled' => 'Cancelado',
            'refunded' => 'Reembolsado'
        ];

        return $statuses[$this->status] ?? $this->status;
    }

    public function getPaymentMethodDisplayAttribute()
    {
        $methods = [
            'stripe' => 'Tarjeta de Crédito (Stripe)',
            'paypal' => 'PayPal',
            'sandbox' => 'Pago de Prueba',
            'admin' => 'Agregado por Administrador'
        ];

        return $methods[$this->payment_method] ?? $this->payment_method;
    }

    // Scopes
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

    public function scopeCancelled($query)
    {
        return $query->where('status', 'cancelled');
    }

    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeByPaymentMethod($query, $method)
    {
        return $query->where('payment_method', $method);
    }

    public function scopeRecent($query, $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    public function scopeThisMonth($query)
    {
        return $query->where('created_at', '>=', now()->startOfMonth());
    }

    public function scopeLastMonth($query)
    {
        return $query->whereBetween('created_at', [
            now()->subMonth()->startOfMonth(),
            now()->subMonth()->endOfMonth()
        ]);
    }

    // Métodos de utilidad
    public function markAsCompleted($paymentData = null)
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
            'payment_data' => $paymentData ? array_merge($this->payment_data ?? [], $paymentData) : $this->payment_data
        ]);

        return $this;
    }

    public function markAsFailed($reason = null)
    {
        $failureData = $this->payment_data ?? [];
        if ($reason) {
            $failureData['failure_reason'] = $reason;
            $failureData['failed_at'] = now()->toISOString();
        }

        $this->update([
            'status' => 'failed',
            'payment_data' => $failureData
        ]);

        return $this;
    }

    public function markAsCancelled($reason = null)
    {
        $cancelData = $this->payment_data ?? [];
        if ($reason) {
            $cancelData['cancellation_reason'] = $reason;
            $cancelData['cancelled_at'] = now()->toISOString();
        }

        $this->update([
            'status' => 'cancelled',
            'payment_data' => $cancelData
        ]);

        return $this;
    }
}