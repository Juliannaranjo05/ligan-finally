<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\UserOnlineStatus;
use App\Models\ChatSession;
use App\Models\User;

class UserController extends Controller
{
public function getMyContacts(Request $request)
{
    try {
        $userId = auth()->id();
        $userRole = auth()->user()->rol;
        
        if ($userRole === 'modelo') {
            $clientesConHistorial = ChatSession::where('modelo_id', $userId)
                ->distinct('cliente_id')
                ->whereNotNull('cliente_id')
                ->pluck('cliente_id')
                ->toArray();
                
            \Log::info('👥 Clientes con historial:', ['clientes' => $clientesConHistorial]);
            
            $clientesDisponibles = UserOnlineStatus::availableForChat()
                ->whereIn('user_id', $clientesConHistorial)
                ->with('user:id,name,rol') // 🔥 QUITADO 'alias'
                ->get();
                
            \Log::info('🟢 Clientes disponibles:', ['count' => $clientesDisponibles->count()]);
            
            $contacts = $clientesDisponibles->map(function($status) {
                return [
                    'id' => $status->user->id,
                    'name' => $status->user->name,
                    'alias' => $status->user->name, // 🔥 USAR name como alias
                    'role' => $status->user->rol,
                    'is_online' => true,
                    'activity_type' => $status->activity_type,
                    'last_seen' => $status->last_seen
                ];
            });
            
        } else {
            $modelosConHistorial = ChatSession::where('cliente_id', $userId)
                ->distinct('modelo_id')
                ->whereNotNull('modelo_id')
                ->pluck('modelo_id')
                ->toArray();
                
            $modelosDisponibles = UserOnlineStatus::availableForChat()
                ->whereIn('user_id', $modelosConHistorial)
                ->with('user:id,name,rol') // 🔥 QUITADO 'alias'
                ->get();
                
            $contacts = $modelosDisponibles->map(function($status) {
                return [
                    'id' => $status->user->id,
                    'name' => $status->user->name,
                    'alias' => $status->user->name, // 🔥 USAR name como alias
                    'role' => $status->user->rol,
                    'is_online' => true,
                    'activity_type' => $status->activity_type,
                    'last_seen' => $status->last_seen
                ];
            });
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