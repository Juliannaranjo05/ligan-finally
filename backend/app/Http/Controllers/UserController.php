<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\UserOnlineStatus;
use App\Models\ChatSession;
use App\Models\User;
use App\Models\UserNickname;
use App\Http\Controllers\ProfileSettingsController;

class UserController extends Controller
{
    /**
     * Verificar si el avatar es de Google
     */
    private function isGoogleAvatar($filename)
    {
        if (!$filename) return false;
        
        return str_contains($filename, 'googleusercontent.com') || 
               str_contains($filename, 'googleapis.com') ||
               str_contains($filename, 'google.com');
    }

    public function getMyContacts(Request $request)
{
    try {
        $userId = auth()->id();
        $userRole = auth()->user()->rol;
        
        if ($userRole === 'modelo') {
            // 🔥 LÓGICA SIMPLE: Obtener clientes con historial
            $clientesConHistorial = ChatSession::where('modelo_id', $userId)
                ->distinct('cliente_id')
                ->whereNotNull('cliente_id')
                ->pluck('cliente_id')
                ->toArray();
            
            \Log::info('🔍 [getMyContacts] Modelo - Clientes con historial:', ['count' => count($clientesConHistorial), 'ids' => $clientesConHistorial]);
            
            // 🔥 SI NO HAY HISTORIAL, DEVOLVER VACÍO
            if (empty($clientesConHistorial)) {
                \Log::info('⚠️ [getMyContacts] No hay clientes con historial');
                $contacts = collect([]);
            } else {
                // 🔥 LÓGICA SIMPLE: Usuarios online en últimos 15 minutos (más permisivo)
                $clientesDisponibles = UserOnlineStatus::where('is_online', true)
                    ->where('last_seen', '>=', now()->subMinutes(15))
                    ->whereIn('user_id', $clientesConHistorial)
                    ->whereHas('user', function($q) {
                        $q->where('rol', 'cliente');
                    })
                    ->with('user:id,name,rol,avatar')
                    ->get();
                
                \Log::info('🔍 [getMyContacts] Clientes disponibles (con last_seen):', ['count' => $clientesDisponibles->count()]);
                
                // 🔥 SI NO HAY DISPONIBLES, INTENTAR SIN FILTRO DE LAST_SEEN (solo is_online)
                if ($clientesDisponibles->isEmpty()) {
                    \Log::info('⚠️ [getMyContacts] No hay clientes con last_seen, intentando sin filtro');
                    $clientesDisponibles = UserOnlineStatus::where('is_online', true)
                        ->whereIn('user_id', $clientesConHistorial)
                        ->whereHas('user', function($q) {
                            $q->where('rol', 'cliente');
                        })
                        ->with('user:id,name,rol,avatar')
                        ->get();
                    \Log::info('🔍 [getMyContacts] Clientes disponibles (sin last_seen):', ['count' => $clientesDisponibles->count()]);
                }
            
                $profileController = new ProfileSettingsController();
                $contacts = $clientesDisponibles->map(function($status) use ($profileController) {
                // Obtener nickname si existe
                $nickname = UserNickname::where('user_id', $status->user->id)
                    ->where('target_user_id', auth()->id())
                    ->first();
                
                $displayName = $nickname ? $nickname->nickname : $status->user->name;
                
                // 🔒 PRIVACIDAD: Clientes solo muestran foto si la subieron manualmente (no de Google)
                $avatar = $status->user->avatar;
                $avatarUrl = null;
                if ($avatar && !$this->isGoogleAvatar($avatar)) {
                    $avatarUrl = $profileController->generateAvatarUrl($avatar);
                }
                
                return [
                    'id' => $status->user->id,
                    'name' => $status->user->name,
                    'display_name' => $displayName,
                    'alias' => $displayName,
                    'avatar' => $avatar,
                    'avatar_url' => $avatarUrl,
                    'role' => $status->user->rol,
                    'is_online' => true,
                    'activity_type' => $status->activity_type,
                    'last_seen' => $status->last_seen
                ];
                });
            }
            
        } else {
            // 🔥 LÓGICA SIMPLE: Obtener modelos con historial
            $modelosConHistorial = ChatSession::where('cliente_id', $userId)
                ->distinct('modelo_id')
                ->whereNotNull('modelo_id')
                ->pluck('modelo_id')
                ->toArray();
            
            \Log::info('🔍 [getMyContacts] Cliente - Modelos con historial:', ['count' => count($modelosConHistorial), 'ids' => $modelosConHistorial]);
            
            // 🔥 SI NO HAY HISTORIAL, DEVOLVER VACÍO
            if (empty($modelosConHistorial)) {
                \Log::info('⚠️ [getMyContacts] No hay modelos con historial');
                $contacts = collect([]);
            } else {
                // 🔥 LÓGICA SIMPLE: Modelos online en últimos 15 minutos (más permisivo)
                $modelosDisponibles = UserOnlineStatus::where('is_online', true)
                    ->where('last_seen', '>=', now()->subMinutes(15))
                    ->whereIn('user_id', $modelosConHistorial)
                    ->whereHas('user', function($q) {
                        $q->where('rol', 'modelo');
                    })
                    ->with('user:id,name,rol,avatar')
                    ->get();
                
                \Log::info('🔍 [getMyContacts] Modelos disponibles (con last_seen):', ['count' => $modelosDisponibles->count()]);
                
                // 🔥 SI NO HAY DISPONIBLES, INTENTAR SIN FILTRO DE LAST_SEEN (solo is_online)
                if ($modelosDisponibles->isEmpty()) {
                    \Log::info('⚠️ [getMyContacts] No hay modelos con last_seen, intentando sin filtro');
                    $modelosDisponibles = UserOnlineStatus::where('is_online', true)
                        ->whereIn('user_id', $modelosConHistorial)
                        ->whereHas('user', function($q) {
                            $q->where('rol', 'modelo');
                        })
                        ->with('user:id,name,rol,avatar')
                        ->get();
                    \Log::info('🔍 [getMyContacts] Modelos disponibles (sin last_seen):', ['count' => $modelosDisponibles->count()]);
                }
                
                $profileController = new ProfileSettingsController();
                $contacts = $modelosDisponibles->map(function($status) use ($profileController) {
                // Obtener nickname si existe (el cliente puede tener un nickname para esta modelo)
                $nickname = UserNickname::where('user_id', $status->user->id)
                    ->where('target_user_id', auth()->id())
                    ->first();
                
                // Si no hay nickname del cliente, buscar el nickname que la modelo se puso a sí misma
                if (!$nickname) {
                    $nickname = UserNickname::where('user_id', $status->user->id)
                        ->where('target_user_id', $status->user->id)
                        ->first();
                }
                
                $displayName = $nickname ? $nickname->nickname : $status->user->name;
                
                // Modelos pueden mostrar cualquier foto (incluyendo Google)
                $avatar = $status->user->avatar;
                $avatarUrl = $profileController->generateAvatarUrl($avatar);
                
                return [
                    'id' => $status->user->id,
                    'name' => $status->user->name,
                    'display_name' => $displayName,
                    'alias' => $displayName,
                    'avatar' => $avatar,
                    'avatar_url' => $avatarUrl,
                    'role' => $status->user->rol,
                    'is_online' => true,
                    'activity_type' => $status->activity_type,
                    'last_seen' => $status->last_seen
                ];
                });
            }
        }

        \Log::info('✅ Contactos finales:', [
            'contacts_count' => $contacts->count(),
            'contact_ids' => $contacts->pluck('id')->toArray()
        ]);

        return response()->json([
            'success' => true,
            'contacts' => $contacts
        ]);

    } catch (\Exception $e) {
        \Log::error('❌ ERROR:', ['message' => $e->getMessage()]);
        return response()->json(['success' => true, 'contacts' => []]);
    }
}
}