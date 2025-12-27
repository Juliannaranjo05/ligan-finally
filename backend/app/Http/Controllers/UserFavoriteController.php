<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use Illuminate\Support\Facades\Log; // 🔥 AGREGAR ESTA LÍNEA

class UserFavoriteController extends Controller
{
    // Agregar a favoritos
    // Y simplificar addToFavorites para que solo verifique activos:

    public function addToFavorites(Request $request)
    {
        try {
            $request->validate([
                'favorite_user_id' => 'required|integer|exists:users,id',
                'note' => 'nullable|string|max:255'
            ]);

            $user = auth()->user();
            $favoriteUserId = $request->favorite_user_id;

            if ($user->id == $favoriteUserId) {
                return response()->json(['success' => false, 'error' => 'No puedes agregarte como favorito'], 400);
            }

            // 🔥 VERIFICAR SI YA EXISTE (ahora no importa si está inactivo porque los inactivos se eliminan)
            $exists = DB::table('user_favorites')
                ->where('user_id', $user->id)
                ->where('favorite_user_id', $favoriteUserId)
                ->exists();

            if ($exists) {
                return response()->json(['success' => false, 'error' => 'Ya está en favoritos'], 409);
            }

            // Agregar nuevo favorito
            DB::table('user_favorites')->insert([
                'user_id' => $user->id,
                'favorite_user_id' => $favoriteUserId,
                'note' => $request->note ?? '',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            $favoriteUser = User::find($favoriteUserId);

            return response()->json([
                'success' => true,
                'message' => 'Agregado a favoritos',
                'favorite' => [
                    'id' => $favoriteUser->id,
                    'name' => $favoriteUser->name
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error en addToFavorites: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Error interno del servidor'], 500);
        }
    }


    public function removeFromFavorites(Request $request)
    {
        try {
            $request->validate([
                'favorite_user_id' => 'required|integer'
            ]);

            $user = auth()->user();
            
            // 🔥 ELIMINAR COMPLETAMENTE DE LA BASE DE DATOS
            $deleted = DB::table('user_favorites')
                ->where('user_id', $user->id)
                ->where('favorite_user_id', $request->favorite_user_id)
                ->delete(); // 🔥 delete() en lugar de update()

            if (!$deleted) {
                return response()->json(['success' => false, 'error' => 'No estaba en favoritos'], 404);
            }

            Log::info('Favorito eliminado completamente', [
                'user_id' => $user->id,
                'favorite_user_id' => $request->favorite_user_id
            ]);

            return response()->json(['success' => true, 'message' => 'Removido de favoritos']);

        } catch (\Exception $e) {
            Log::error('Error en removeFromFavorites: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Error interno del servidor'], 500);
        }
    }

    // Obtener favoritos
    public function getFavorites()
    {
        $user = auth()->user();
        
        $favorites = DB::table('user_favorites')
            ->join('users', 'user_favorites.favorite_user_id', '=', 'users.id')
            ->where('user_favorites.user_id', $user->id)
            ->where('user_favorites.is_active', true)
            ->select(
                'users.id',
                'users.name',
                'users.avatar',
                'user_favorites.note',
                'user_favorites.created_at'
            )
            ->get()
            ->map(function ($fav) {
                // Generar URL pública del avatar si existe
                if (!empty($fav->avatar)) {
                    $avatarName = basename($fav->avatar);
                    $fav->avatar_url = url('/storage/avatars/' . $avatarName);
                } else {
                    $fav->avatar_url = null;
                }
                return $fav;
            });

        return response()->json([
            'success' => true,
            'favorites' => $favorites
        ]);
    }

    // Iniciar chat con favorito
    public function startChatWithFavorite(Request $request)
    {
        $request->validate([
            'favorite_user_id' => 'required|integer'
        ]);

        $user = auth()->user();
        $favoriteUserId = $request->favorite_user_id;

        // Verificar que es favorito
        $isFavorite = DB::table('user_favorites')
            ->where('user_id', $user->id)
            ->where('favorite_user_id', $favoriteUserId)
            ->where('is_active', true)
            ->exists();

        if (!$isFavorite) {
            return response()->json(['success' => false, 'error' => 'No está en favoritos'], 400);
        }

        // Crear sala directa
        $roomName = "favorite_" . min($user->id, $favoriteUserId) . "_" . max($user->id, $favoriteUserId) . "_" . time();
        
        DB::table('video_sessions')->insert([
            'room_name' => $roomName,
            'cliente_id' => $user->rol === 'cliente' ? $user->id : $favoriteUserId,
            'modelo_id' => $user->rol === 'modelo' ? $user->id : $favoriteUserId,
            'status' => 'active',
            'type' => 'favorite_chat',
            'created_at' => now(),
            'updated_at' => now()
        ]);

        $favoriteUser = User::find($favoriteUserId);

        return response()->json([
            'success' => true,
            'message' => 'Chat iniciado',
            'room_name' => $roomName,
            'partner' => [
                'id' => $favoriteUser->id,
                'name' => $favoriteUser->name
            ]
        ]);
    }
}