<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Gift extends Model
{
    protected $table = 'gifts';

    protected $primaryKey = 'id';
    public $incrementing = false; // porque estás usando strings como 'bailarina', 'yate', etc.
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'image_path',
        'price',
        'category',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'price' => 'integer',
    ];
}
