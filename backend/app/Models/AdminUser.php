<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class AdminUser extends Authenticatable
{
    use Notifiable;

    protected $table = 'admin_users';

    protected $fillable = [
        'email',
        'password',
        'last_code',
        'attempts',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];
}