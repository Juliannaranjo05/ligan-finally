<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserNotificationPreference extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'email_notifications',
        'push_notifications',
        'message_notifications',
        'call_notifications',
        'favorite_online_notifications',
        'gift_notifications',
        'payment_notifications',
        'system_notifications'
    ];

    protected $casts = [
        'email_notifications' => 'boolean',
        'push_notifications' => 'boolean',
        'message_notifications' => 'boolean',
        'call_notifications' => 'boolean',
        'favorite_online_notifications' => 'boolean',
        'gift_notifications' => 'boolean',
        'payment_notifications' => 'boolean',
        'system_notifications' => 'boolean'
    ];

    // Relación con User
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
