<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;

class UserBlockController extends Controller
{

    public function blockUser(Request $request)
    {
        try {
            $request->validate([
                'blocked_user_id' => 'required|integer|exists:users,id',
                'reason' => 'nullable|string|max:255'
            ]);

            $user = auth()->user();
            $blockedUserId = $request->blocked_user_id;

            if ($user->id == $blockedUserId) {
                return response()->json(['success' => false, 'error' => 'No puedes bloquearte a ti mismo'], 400);
            }

            // 🔥 VERIFICAR SI YA EXISTE UN BLOQUEO ACTIVO (NO INACTIVO)
            $activeBlock = DB::table('user_blocks')
                ->where('user_id', $user->id)
                ->where('blocked_user_id', $blockedUserId)
                ->where('is_active', true)
                ->first();

            if ($activeBlock) {
                return response()->json(['success' => false, 'error' => 'Usuario ya bloqueado'], 409);
            }

            // 🔥 VERIFICAR SI EXISTE UN BLOQUEO INACTIVO PARA REACTIVARLO
            $inactiveBlock = DB::table('user_blocks')
                ->where('user_id', $user->id)
                ->where('blocked_user_id', $blockedUserId)
                ->where('is_active', false)
                ->first();

            if ($inactiveBlock) {
                // Reactivar el bloqueo existente
                DB::table('user_blocks')
                    ->where('id', $inactiveBlock->id)
                    ->update([
                        'is_active' => true,
                        'reason' => $request->reason ?? $inactiveBlock->reason,
                        'updated_at' => now()
                    ]);
                    
                \Log::info('✅ Bloqueo reactivado', [
                    'block_id' => $inactiveBlock->id,
                    'user_id' => $user->id,
                    'blocked_user_id' => $blockedUserId
                ]);
            } else {
                // Crear nuevo bloqueo
                DB::table('user_blocks')->insert([
                    'user_id' => $user->id,
                    'blocked_user_id' => $blockedUserId,
                    'reason' => $request->reason ?? '',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
                
                \Log::info('✅ Nuevo bloqueo creado', [
                    'user_id' => $user->id,
                    'blocked_user_id' => $blockedUserId
                ]);
            }

            $blockedUser = User::find($blockedUserId);

            return response()->json([
                'success' => true,
                'message' => 'Usuario bloqueado',
                'blocked_user' => [
                    'id' => $blockedUser->id,
                    'name' => $blockedUser->name
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('❌ Error en bloqueo:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error interno: ' . $e->getMessage()
            ], 500);
        }
    }

    // Desbloquear usuario
    public function unblockUser(Request $request)
    {
        $request->validate([
            'blocked_user_id' => 'required|integer'
        ]);

        $user = auth()->user();
        
        $updated = DB::table('user_blocks')
            ->where('user_id', $user->id)
            ->where('blocked_user_id', $request->blocked_user_id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'updated_at' => now()
            ]);

        if (!$updated) {
            return response()->json(['success' => false, 'error' => 'Usuario no estaba bloqueado'], 404);
        }

        return response()->json(['success' => true, 'message' => 'Usuario desbloqueado']);
    }

    // Obtener usuarios bloqueados
    public function getBlockedUsers()
    {
        $user = auth()->user();
        
        $blocked = DB::table('user_blocks')
            ->join('users', 'user_blocks.blocked_user_id', '=', 'users.id')
            ->where('user_blocks.user_id', $user->id)
            ->where('user_blocks.is_active', true)
            ->select('users.id', 'users.name', 'user_blocks.reason', 'user_blocks.created_at')
            ->get();

        return response()->json([
            'success' => true,
            'blocked_users' => $blocked
        ]);
    }

    // Obtener IDs de usuarios bloqueados (para exclusiones)
    public function getBlockedUserIds($userId)
    {
        return DB::table('user_blocks')
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->pluck('blocked_user_id')
            ->toArray();
    }
    // 🔥 AGREGAR ESTE MÉTODO EN UserBlockController.php

/**
 * Verificar si un usuario específico me bloqueó
 */
public function checkIfBlockedBy(Request $request)
{
    $request->validate([
        'user_id' => 'required|integer|exists:users,id'
    ]);

    $currentUser = auth()->user();
    $targetUserId = $request->user_id;

    // Verificar si el usuario target me bloqueó a mí
    $isBlockedByThem = DB::table('user_blocks')
        ->where('user_id', $targetUserId)
        ->where('blocked_user_id', $currentUser->id)
        ->where('is_active', true)
        ->exists();

    return response()->json([
        'success' => true,
        'is_blocked_by_them' => $isBlockedByThem,
        'user_id' => $targetUserId
    ]);
}

/**
 * Obtener todos los usuarios que me han bloqueado
 */
public function getWhoBlockedMe()
{
    $currentUser = auth()->user();
    
    $blockedByUsers = DB::table('user_blocks')
        ->join('users', 'user_blocks.user_id', '=', 'users.id')
        ->where('user_blocks.blocked_user_id', $currentUser->id)
        ->where('user_blocks.is_active', true)
        ->select('users.id', 'users.name', 'user_blocks.created_at as blocked_at')
        ->get();

    return response()->json([
        'success' => true,
        'blocked_by_users' => $blockedByUsers
    ]);
}

/**
 * Obtener estado completo de bloqueos (quien bloqueo y quien me bloqueó)
 */
public function getBlockStatus()
{
    $currentUser = auth()->user();
    
    // Usuarios que YO he bloqueado
    $myBlocked = DB::table('user_blocks')
        ->join('users', 'user_blocks.blocked_user_id', '=', 'users.id')
        ->where('user_blocks.user_id', $currentUser->id)
        ->where('user_blocks.is_active', true)
        ->select('users.id', 'users.name', 'user_blocks.reason', 'user_blocks.created_at')
        ->get();

    // Usuarios que ME han bloqueado
    $blockedByUsers = DB::table('user_blocks')
        ->join('users', 'user_blocks.user_id', '=', 'users.id')
        ->where('user_blocks.blocked_user_id', $currentUser->id)
        ->where('user_blocks.is_active', true)
        ->select('users.id', 'users.name', 'user_blocks.created_at as blocked_at')
        ->get();

    return response()->json([
        'success' => true,
        'my_blocked_users' => $myBlocked,
        'blocked_by_users' => $blockedByUsers
    ]);
}
}