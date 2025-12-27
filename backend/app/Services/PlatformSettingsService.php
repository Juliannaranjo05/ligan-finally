<?php

namespace App\Services;

use App\Models\PlatformSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PlatformSettingsService
{
    const CACHE_PREFIX = 'platform_setting_';
    const CACHE_TTL = 3600; // 1 hora

    /**
     * Obtener un valor de configuración
     */
    public static function get(string $key, $default = null)
    {
        $cacheKey = self::CACHE_PREFIX . $key;
        
        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($key, $default) {
            $setting = PlatformSetting::byKey($key)->first();
            
            if (!$setting) {
                return $default;
            }

            return $setting->getValue();
        });
    }

    /**
     * Obtener un valor decimal
     */
    public static function getDecimal(string $key, float $default = 0.0): float
    {
        $value = self::get($key, $default);
        return (float) $value;
    }

    /**
     * Obtener un valor entero
     */
    public static function getInteger(string $key, int $default = 0): int
    {
        $value = self::get($key, $default);
        return (int) $value;
    }

    /**
     * Obtener un valor booleano
     */
    public static function getBoolean(string $key, bool $default = false): bool
    {
        $value = self::get($key, $default);
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Establecer un valor de configuración
     */
    public static function set(string $key, $value, string $type = 'string', string $category = 'system', ?string $description = null, ?int $updatedBy = null)
    {
        $setting = PlatformSetting::byKey($key)->first();

        if ($setting) {
            $setting->update([
                'value' => is_array($value) ? json_encode($value) : (string) $value,
                'type' => $type,
                'category' => $category,
                'description' => $description ?? $setting->description,
                'updated_by' => $updatedBy
            ]);
        } else {
            $setting = PlatformSetting::create([
                'key' => $key,
                'value' => is_array($value) ? json_encode($value) : (string) $value,
                'type' => $type,
                'category' => $category,
                'description' => $description,
                'updated_by' => $updatedBy
            ]);
        }

        // Invalidar caché
        self::clearCache($key);

        return $setting;
    }

    /**
     * Obtener todas las configuraciones
     */
    public static function getAll()
    {
        return Cache::remember('platform_settings_all', self::CACHE_TTL, function () {
            return PlatformSetting::orderBy('category')->orderBy('key')->get()->map(function ($setting) {
                return [
                    'id' => $setting->id,
                    'key' => $setting->key,
                    'value' => $setting->getValue(),
                    'type' => $setting->type,
                    'description' => $setting->description,
                    'category' => $setting->category,
                    'updated_by' => $setting->updated_by,
                    'updated_at' => $setting->updated_at
                ];
            });
        });
    }

    /**
     * Obtener configuraciones por categoría
     */
    public static function getByCategory(string $category)
    {
        return PlatformSetting::byCategory($category)->get()->map(function ($setting) {
            return [
                'id' => $setting->id,
                'key' => $setting->key,
                'value' => $setting->getValue(),
                'type' => $setting->type,
                'description' => $setting->description,
                'category' => $setting->category
            ];
        });
    }

    /**
     * Limpiar caché de una configuración específica
     */
    public static function clearCache(?string $key = null)
    {
        if ($key) {
            Cache::forget(self::CACHE_PREFIX . $key);
        }
        Cache::forget('platform_settings_all');
    }

    /**
     * Limpiar todo el caché de configuraciones
     */
    public static function clearAllCache()
    {
        $settings = PlatformSetting::all();
        foreach ($settings as $setting) {
            Cache::forget(self::CACHE_PREFIX . $setting->key);
        }
        Cache::forget('platform_settings_all');
    }
}



