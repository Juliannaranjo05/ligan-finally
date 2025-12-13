<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Models\UserGiftCoins;
use App\Models\GiftTransaction;
use Exception;
use Illuminate\Validation\ValidationException;

class GiftCoinsController extends Controller
{
    /**
     * 🎁 Agregar coins de regalo (desde compras) - CON DEBUG MEJORADO
     */
    public function addGiftCoins(Request $request)
    {
        try {
            // 🔍 DEBUGGING: Log de datos recibidos
            Log::info('🎁 DEBUGGING - Datos recibidos en addGiftCoins:', [
                'all_request_data' => $request->all(),
                'user_id' => $request->user_id,
                'amount' => $request->amount,
                'source' => $request->source,
                'reference_id' => $request->reference_id
            ]);

            // Validación con mensajes personalizados
            $validator = \Validator::make($request->all(), [
                'user_id' => 'required|integer|exists:users,id',
                'amount' => 'required|integer|min:1',
                'source' => 'required|string|max:255',
                'reference_id' => 'nullable|string|max:255'
            ], [
                'user_id.required' => 'El user_id es requerido',
                'user_id.integer' => 'El user_id debe ser un número entero',
                'user_id.exists' => 'El usuario no existe',
                'amount.required' => 'La cantidad es requerida',
                'amount.integer' => 'La cantidad debe ser un número entero',
                'amount.min' => 'La cantidad debe ser mínimo 1',
                'source.required' => 'El source es requerido',
                'source.string' => 'El source debe ser texto'
            ]);

            if ($validator->fails()) {
                Log::error('❌ DEBUGGING - Validación fallida:', [
                    'errors' => $validator->errors()->all(),
                    'request_data' => $request->all()
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Datos de validación inválidos: ' . implode(', ', $validator->errors()->all())
                ], 422);
            }

            $userId = $request->user_id;
            $amount = $request->amount;
            $source = $request->source;

            Log::info('✅ DEBUGGING - Validación pasada, iniciando transacción');

            DB::beginTransaction();

            // Verificar que el usuario existe
            $user = User::find($userId);
            if (!$user) {
                Log::error('❌ Usuario no encontrado:', ['user_id' => $userId]);
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no encontrado'
                ], 404);
            }

            Log::info('✅ DEBUGGING - Usuario encontrado:', ['user_id' => $userId, 'name' => $user->name]);

            // Obtener o crear registro de coins de regalo
            $giftCoins = $this->getUserGiftCoins($userId);

            Log::info('✅ DEBUGGING - Registro de gift coins obtenido:', [
                'current_balance' => $giftCoins->balance,
                'total_received' => $giftCoins->total_received
            ]);

            // Actualizar balance
            $oldBalance = $giftCoins->balance;
            $giftCoins->balance += $amount;
            $giftCoins->total_received += $amount;
            $giftCoins->last_received_at = now();
            $giftCoins->save();

            Log::info('✅ DEBUGGING - Balance actualizado:', [
                'old_balance' => $oldBalance,
                'new_balance' => $giftCoins->balance,
                'amount_added' => $amount
            ]);

            // Registrar transacción
            $transaction = GiftTransaction::create([
                'sender_id' => $userId,
                'receiver_id' => $userId,
                'amount' => $amount,
                'type' => 'purchase',
                'source' => $source,
                'reference_id' => $request->reference_id,
                'message' => 'Coins de regalo desde compra'
            ]);

            Log::info('✅ DEBUGGING - Transacción creada:', [
                'transaction_id' => $transaction->id
            ]);

            DB::commit();

            Log::info('💝 Coins de regalo agregados exitosamente', [
                'user_id' => $userId,
                'amount' => $amount,
                'source' => $source,
                'new_balance' => $giftCoins->balance
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Coins de regalo agregados exitosamente',
                'added' => $amount,
                'new_gift_balance' => $giftCoins->balance,
                'transaction_id' => $transaction->id
            ]);

        } catch (ValidationException $e) {
            Log::error('❌ Error de validación en addGiftCoins:', [
                'errors' => $e->errors(),
                'request' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Error de validación: ' . $e->getMessage()
            ], 422);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error('💥 Error agregando coins de regalo:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * 📊 Obtener balance de regalos
     */
    public function getGiftBalance()
    {
        try {
            $user = Auth::user();
            $giftCoins = $this->getUserGiftCoins($user->id);

            return response()->json([
                'success' => true,
                'balance' => [
                    'gift_balance' => $giftCoins->balance,
                    'total_received' => $giftCoins->total_received,
                    'total_sent' => $giftCoins->total_sent,
                    'last_received_at' => $giftCoins->last_received_at,
                    'last_sent_at' => $giftCoins->last_sent_at
                ]
            ]);
            
        } catch (Exception $e) {
            Log::error('Error obteniendo balance de regalos: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Error al obtener balance'], 500);
        }
    }

    /**
     * 🛠️ Obtener o crear registro de coins de regalo
     */
    private function getUserGiftCoins($userId)
    {
        try {
            Log::info('🔍 DEBUGGING - Buscando/creando UserGiftCoins:', ['user_id' => $userId]);
            
            $giftCoins = UserGiftCoins::firstOrCreate(
                ['user_id' => $userId],
                [
                    'balance' => 0,
                    'total_received' => 0,
                    'total_sent' => 0
                ]
            );

            Log::info('✅ DEBUGGING - UserGiftCoins obtenido:', [
                'id' => $giftCoins->id,
                'user_id' => $giftCoins->user_id,
                'balance' => $giftCoins->balance
            ]);

            return $giftCoins;
        } catch (Exception $e) {
            Log::error('💥 Error obteniendo UserGiftCoins:', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * 🎁 Enviar regalo a otro usuario (para implementar después)
     */
    public function sendGift(Request $request)
    {
        // TODO: Implementar después
        return response()->json([
            'success' => false,
            'error' => 'Función no implementada aún'
        ], 501);
    }

    /**
     * 📈 Historial de regalos (para implementar después)
     */
    public function getGiftHistory($limit = 20)
    {
        // TODO: Implementar después
        return response()->json([
            'success' => true,
            'history' => []
        ]);
    }
}