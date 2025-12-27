<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlatformSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'value',
        'type',
        'description',
        'category',
        'updated_by'
    ];

    protected $casts = [
        'value' => 'string'
    ];

    // Relaciones
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // Scopes
    public function scopeByCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    public function scopeByKey($query, $key)
    {
        return $query->where('key', $key);
    }

    // Métodos auxiliares para obtener valores tipados
    public function getValue()
    {
        switch ($this->type) {
            case 'boolean':
                return filter_var($this->value, FILTER_VALIDATE_BOOLEAN);
            case 'integer':
                return (int) $this->value;
            case 'decimal':
                return (float) $this->value;
            case 'json':
                return json_decode($this->value, true);
            default:
                return $this->value;
        }
    }

    public function getDecimal()
    {
        return (float) $this->value;
    }

    public function getInteger()
    {
        return (int) $this->value;
    }

    public function getBoolean()
    {
        return filter_var($this->value, FILTER_VALIDATE_BOOLEAN);
    }
}



