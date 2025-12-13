<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;


class Verificacion extends Model
{
    use HasFactory;

    protected $table = 'verificaciones'; // ✅ AÑADE ESTO

    protected $fillable = [
        'user_id', 'selfie', 'documento', 'selfie_doc', 'video', 'estado', 'observaciones'
    ];

    public function user()
    {
    return $this->belongsTo(User::class, 'user_id');
    }
}

