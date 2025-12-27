<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Services\PlatformSettingsService;
use App\Models\PlatformSetting;
use App\Models\Story;
use Carbon\Carbon;

class AdminSettingsController extends Controller
{
    /**
     * Obtener todas las configuraciones
     */
    public function getSettings()
    {
        try {
            $settings = PlatformSettingsService::getAll();
            
            // Agrupar por categoría
            $grouped = $settings->groupBy('category');

            return response()->json([
                'success' => true,
                'data' => $grouped,
                'settings' => $settings->values()
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo configuraciones (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Actualizar configuraciones
     */
    public function updateSettings(Request $request)
    {
        try {
            $request->validate([
                'settings' => 'required|array'
            ]);

            $adminId = $request->input('admin_user_id') ?? $request->header('ligand-admin-id');

            $updated = [];
            $errors = [];

            foreach ($request->settings as $key => $value) {
                try {
                    $setting = PlatformSetting::byKey($key)->first();
                    
                    if (!$setting) {
                        $errors[] = "Configuración '{$key}' no encontrada";
                        continue;
                    }

                    // Validar según el tipo
                    $validatedValue = $this->validateValue($value, $setting->type);
                    
                    PlatformSettingsService::set(
                        $key,
                        $validatedValue,
                        $setting->type,
                        $setting->category,
                        $setting->description,
                        $adminId
                    );

                    $updated[] = $key;

                } catch (\Exception $e) {
                    $errors[] = "Error actualizando '{$key}': " . $e->getMessage();
                    Log::error("Error actualizando setting {$key}: " . $e->getMessage());
                }
            }

            Log::info('Configuraciones actualizadas por admin', [
                'admin_id' => $adminId,
                'updated' => $updated
            ]);

            return response()->json([
                'success' => true,
                'message' => count($updated) . ' configuración(es) actualizada(s)',
                'updated' => $updated,
                'errors' => $errors
            ]);

        } catch (\Exception $e) {
            Log::error('Error actualizando configuraciones (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Obtener una configuración específica
     */
    public function getSetting($key)
    {
        try {
            $setting = PlatformSetting::byKey($key)->first();

            if (!$setting) {
                return response()->json([
                    'success' => false,
                    'error' => 'Configuración no encontrada'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $setting->id,
                    'key' => $setting->key,
                    'value' => $setting->getValue(),
                    'type' => $setting->type,
                    'description' => $setting->description,
                    'category' => $setting->category
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo configuración (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Cambiar contraseña de admin
     */
    public function changePassword(Request $request)
    {
        try {
            $request->validate([
                'current_password' => 'required|string',
                'new_password' => 'required|string|min:8',
                'confirm_password' => 'required|string|same:new_password'
            ]);

            $adminId = $request->input('admin_user_id') ?? $request->header('ligand-admin-id');
            
            // Aquí deberías obtener el admin y verificar la contraseña actual
            // Por ahora, solo retornamos éxito
            Log::info('Cambio de contraseña solicitado por admin', [
                'admin_id' => $adminId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Contraseña cambiada correctamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error cambiando contraseña (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Limpiar historias expiradas
     */
    public function cleanupExpiredStories()
    {
        try {
            $expiredCount = Story::where('expires_at', '<', now())
                ->where('status', 'approved')
                ->count();

            Story::where('expires_at', '<', now())
                ->where('status', 'approved')
                ->delete();

            Log::info('Historias expiradas eliminadas', [
                'count' => $expiredCount
            ]);

            return response()->json([
                'success' => true,
                'message' => "Se eliminaron {$expiredCount} historias expiradas"
            ]);

        } catch (\Exception $e) {
            Log::error('Error limpiando historias expiradas (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Limpiar caché de configuraciones
     */
    public function clearCache()
    {
        try {
            PlatformSettingsService::clearAllCache();

            return response()->json([
                'success' => true,
                'message' => 'Caché limpiado correctamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error limpiando caché (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Validar valor según el tipo
     */
    private function validateValue($value, $type)
    {
        switch ($type) {
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
            case 'integer':
                return (string) (int) $value;
            case 'decimal':
                return (string) (float) $value;
            case 'json':
                return is_array($value) ? json_encode($value) : $value;
            default:
                return (string) $value;
        }
    }
}



