<?php
// app/Http/Controllers/UserNicknameController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\UserNickname;
use App\Models\User;

class UserNicknameController extends Controller
{
    /**
     * Establecer o actualizar apodo para un usuario
     */
    public function setNickname(Request $request)
    {
        try {
            $request->validate([
                'target_user_id' => 'required|integer|exists:users,id',
                'nickname' => 'required|string|min:1|max:100'
            ]);

            $currentUser = auth()->user();
            $targetUserId = $request->target_user_id;
            $nickname = trim($request->nickname);

            // No puedes ponerte apodo a ti mismo
            if ($currentUser->id == $targetUserId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No puedes ponerte un apodo a ti mismo'
                ], 400);
            }

            // Verificar que el usuario target existe
            $targetUser = User::find($targetUserId);
            if (!$targetUser) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no encontrado'
                ], 404);
            }

            // Crear o actualizar el apodo
            $userNickname = UserNickname::updateOrCreate(
                [
                    'user_id' => $currentUser->id,
                    'target_user_id' => $targetUserId,
                ],
                [
                    'nickname' => $nickname,
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'Apodo actualizado correctamente',
                'data' => [
                    'target_user_id' => $targetUserId,
                    'target_user_name' => $targetUser->name,
                    'nickname' => $nickname,
                    'created_at' => $userNickname->created_at,
                    'updated_at' => $userNickname->updated_at,
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Datos inválidos',
                'details' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error estableciendo apodo:', [
                'user_id' => auth()->id(),
                'target_user_id' => $request->target_user_id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Obtener apodo de un usuario específico
     */
    public function getNickname(Request $request)
    {
        try {
            $request->validate([
                'target_user_id' => 'required|integer|exists:users,id'
            ]);

            $currentUser = auth()->user();
            $targetUserId = $request->target_user_id;

            $nickname = UserNickname::where('user_id', $currentUser->id)
                ->where('target_user_id', $targetUserId)
                ->first();

            if ($nickname) {
                return response()->json([
                    'success' => true,
                    'has_nickname' => true,
                    'data' => [
                        'target_user_id' => $targetUserId,
                        'nickname' => $nickname->nickname,
                        'created_at' => $nickname->created_at,
                        'updated_at' => $nickname->updated_at,
                    ]
                ]);
            } else {
                return response()->json([
                    'success' => true,
                    'has_nickname' => false,
                    'data' => null
                ]);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo apodo'
            ], 500);
        }
    }

    /**
     * Eliminar apodo de un usuario
     */
    public function removeNickname(Request $request)
    {
        try {
            $request->validate([
                'target_user_id' => 'required|integer|exists:users,id'
            ]);

            $currentUser = auth()->user();
            $targetUserId = $request->target_user_id;

            $deleted = UserNickname::where('user_id', $currentUser->id)
                ->where('target_user_id', $targetUserId)
                ->delete();

            if ($deleted) {
                return response()->json([
                    'success' => true,
                    'message' => 'Apodo eliminado correctamente'
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => 'No se encontró apodo para eliminar'
                ], 404);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Error eliminando apodo'
            ], 500);
        }
    }

    /**
     * Obtener todos los apodos que he puesto
     */
    public function getMyNicknames()
    {
        try {
            $currentUser = auth()->user();

            $nicknames = UserNickname::where('user_id', $currentUser->id)
                ->join('users', 'user_nicknames.target_user_id', '=', 'users.id')
                ->select(
                    'user_nicknames.target_user_id',
                    'users.name as original_name',
                    'user_nicknames.nickname',
                    'user_nicknames.created_at',
                    'user_nicknames.updated_at'
                )
                ->orderBy('user_nicknames.updated_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'nicknames' => $nicknames
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo apodos'
            ], 500);
        }
    }
}