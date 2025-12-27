<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\UserNotificationPreference;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class UserNotificationPreferencesController extends Controller
{
    /**
     * Obtener preferencias de notificaciones del usuario
     */
    public function getPreferences()
    {
        try {
            $user = Auth::user();
            
            // Verificar si la tabla existe antes de intentar acceder
            if (!\Schema::hasTable('user_notification_preferences')) {
                // Retornar preferencias por defecto si la tabla no existe
                return response()->json([
                    'success' => true,
                    'preferences' => [
                        'user_id' => $user->id,
                        'email_notifications' => true,
                        'push_notifications' => true,
                        'message_notifications' => true,
                        'call_notifications' => true,
                        'favorite_online_notifications' => true,
                        'gift_notifications' => true,
                        'payment_notifications' => true,
                        'system_notifications' => true
                    ],
                    'note' => 'Tabla de preferencias no disponible aún. Usando valores por defecto.'
                ]);
            }
            
            // Obtener o crear preferencias por defecto
            $preferences = UserNotificationPreference::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'email_notifications' => true,
                    'push_notifications' => true,
                    'message_notifications' => true,
                    'call_notifications' => true,
                    'favorite_online_notifications' => true,
                    'gift_notifications' => true,
                    'payment_notifications' => true,
                    'system_notifications' => true
                ]
            );

            return response()->json([
                'success' => true,
                'preferences' => $preferences
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo preferencias de notificaciones: ' . $e->getMessage());
            
            // Si el error es porque la tabla no existe, retornar valores por defecto
            if (str_contains($e->getMessage(), "doesn't exist") || str_contains($e->getMessage(), 'Base table')) {
                $user = Auth::user();
                return response()->json([
                    'success' => true,
                    'preferences' => [
                        'user_id' => $user->id,
                        'email_notifications' => true,
                        'push_notifications' => true,
                        'message_notifications' => true,
                        'call_notifications' => true,
                        'favorite_online_notifications' => true,
                        'gift_notifications' => true,
                        'payment_notifications' => true,
                        'system_notifications' => true
                    ],
                    'note' => 'Tabla de preferencias no disponible aún. Usando valores por defecto.'
                ]);
            }
            
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener preferencias'
            ], 500);
        }
    }

    /**
     * Actualizar preferencias de notificaciones
     */
    public function updatePreferences(Request $request)
    {
        try {
            $request->validate([
                'email_notifications' => 'nullable|boolean',
                'push_notifications' => 'nullable|boolean',
                'message_notifications' => 'nullable|boolean',
                'call_notifications' => 'nullable|boolean',
                'favorite_online_notifications' => 'nullable|boolean',
                'gift_notifications' => 'nullable|boolean',
                'payment_notifications' => 'nullable|boolean',
                'system_notifications' => 'nullable|boolean'
            ]);

            $user = Auth::user();
            
            // Verificar si la tabla existe
            if (!Schema::hasTable('user_notification_preferences')) {
                // Si la tabla no existe, solo retornar éxito (las preferencias se guardan en localStorage del frontend)
                return response()->json([
                    'success' => true,
                    'message' => 'Preferencias guardadas localmente (tabla no disponible aún)',
                    'preferences' => $request->only([
                        'email_notifications',
                        'push_notifications',
                        'message_notifications',
                        'call_notifications',
                        'favorite_online_notifications',
                        'gift_notifications',
                        'payment_notifications',
                        'system_notifications'
                    ])
                ]);
            }
            
            // Obtener o crear preferencias
            $preferences = UserNotificationPreference::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'email_notifications' => true,
                    'push_notifications' => true,
                    'message_notifications' => true,
                    'call_notifications' => true,
                    'favorite_online_notifications' => true,
                    'gift_notifications' => true,
                    'payment_notifications' => true,
                    'system_notifications' => true
                ]
            );

            // Actualizar solo los campos proporcionados
            $preferences->update($request->only([
                'email_notifications',
                'push_notifications',
                'message_notifications',
                'call_notifications',
                'favorite_online_notifications',
                'gift_notifications',
                'payment_notifications',
                'system_notifications'
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Preferencias actualizadas exitosamente',
                'preferences' => $preferences
            ]);
        } catch (\Exception $e) {
            Log::error('Error actualizando preferencias de notificaciones: ' . $e->getMessage());
            
            // Si el error es porque la tabla no existe, retornar éxito de todas formas
            if (str_contains($e->getMessage(), "doesn't exist") || str_contains($e->getMessage(), 'Base table')) {
                return response()->json([
                    'success' => true,
                    'message' => 'Preferencias guardadas localmente (tabla no disponible aún)',
                    'preferences' => $request->only([
                        'email_notifications',
                        'push_notifications',
                        'message_notifications',
                        'call_notifications',
                        'favorite_online_notifications',
                        'gift_notifications',
                        'payment_notifications',
                        'system_notifications'
                    ])
                ]);
            }
            
            return response()->json([
                'success' => false,
                'error' => 'Error al actualizar preferencias'
            ], 500);
        }
    }
}
