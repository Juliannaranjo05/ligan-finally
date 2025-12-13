<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class WeeklyPayment extends Model
{
    use HasFactory;

    protected $table = 'weekly_payments';

    protected $fillable = [
        'model_user_id',
        'week_start',
        'week_end', 
        'amount',
        'total_sessions',
        'status',
        'payment_method',
        'payment_reference',
        'paid_at',
        'paid_by',
        'processed_at'
    ];

    protected $casts = [
        'week_start' => 'date',
        'week_end' => 'date',
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'processed_at' => 'datetime'
    ];

    // Relaciones
    public function model()
    {
        return $this->belongsTo(\App\Models\User::class, 'model_user_id');
    }

    public function paidBy()
    {
        return $this->belongsTo(\App\Models\User::class, 'paid_by');
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    // Métodos auxiliares
    public function getWeekRangeAttribute()
    {
        return $this->week_start->format('d/m/Y') . ' - ' . $this->week_end->format('d/m/Y');
    }

    public function isPending()
    {
        return $this->status === 'pending';
    }

    public function isPaid()
    {
        return $this->status === 'paid';
    }

    public function markAsPaid($paymentMethod, $paymentReference = null, $paidBy = null)
    {
        $this->update([
            'status' => 'paid',
            'payment_method' => $paymentMethod,
            'payment_reference' => $paymentReference,
            'paid_at' => now(),
            'paid_by' => $paidBy ?? auth()->id()
        ]);
    }
    public function sessionEarnings(): HasMany
    {
        return $this->hasMany(SessionEarning::class, 'weekly_payment_id');
    }
}