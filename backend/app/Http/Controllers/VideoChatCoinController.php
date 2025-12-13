<?php

// =============================================================================
// 🎯 1. NUEVO CONTROLADOR: VideoChatCoinController.php
// =============================================================================

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Models\UserCoins;
use App\Models\CoinTransaction;
use App\Models\CoinConsumption;
use Exception;
use Carbon\Carbon;

class VideoChatCoinController extends Controller
{
    // 🔥 CONFIGURACIÓN
    const COST_PER_MINUTE = 10; // 10 monedas por minuto
    const MINIMUM_BALANCE = 30; // Mínimo 3 minutos para iniciar
    
    /**
     * 📊 Obtener balance del usuario
     */
    public function getBalance()
    {
        try {
            $user = Auth::user();
            $userCoins = $this->getUserCoins($user->id);

            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance;
            $minutesAvailable = floor($totalBalance / self::COST_PER_MINUTE);

            return response()->json([
                'success' => true,
                'balance' => [
                    'purchased_coins' => $userCoins->purchased_balance,
                    'gift_coins' => $userCoins->gift_balance,
                    'total_coins' => $totalBalance,
                    'minutes_available' => $minutesAvailable,
                    'cost_per_minute' => self::COST_PER_MINUTE,
                    'minimum_required' => self::MINIMUM_BALANCE
                ],
                'can_start_call' => $totalBalance >= self::MINIMUM_BALANCE
            ]);
            
        } catch (Exception $e) {
            Log::error('Error obteniendo balance: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Error al obtener balance'], 500);
        }
    }

    /**
     * ✅ Verificar si usuario puede iniciar videochat
     */
    public function canStartVideoChat($userId = null)
    {
        try {
            $userId = $userId ?? Auth::id();
            $userCoins = $this->getUserCoins($userId);
            
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance;
            $canStart = $totalBalance >= self::MINIMUM_BALANCE;
            
            Log::info('🔍 Verificación de saldo para videochat', [
                'user_id' => $userId,
                'total_balance' => $totalBalance,
                'minimum_required' => self::MINIMUM_BALANCE,
                'can_start' => $canStart
            ]);
            
            return [
                'can_start' => $canStart,
                'total_balance' => $totalBalance,
                'minutes_available' => floor($totalBalance / self::COST_PER_MINUTE),
                'deficit' => $canStart ? 0 : (self::MINIMUM_BALANCE - $totalBalance)
            ];
            
        } catch (Exception $e) {
            Log::error('Error verificando saldo: ' . $e->getMessage());
            return ['can_start' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * 💰 Consumir monedas durante videochat
     */
    public function consumeCoins(Request $request)
    {
        try {
            $request->validate([
                'room_name' => 'required|string',
                'minutes_consumed' => 'required|numeric|min:0.1',
                'session_id' => 'nullable|string'
            ]);

            $user = Auth::user();
            $minutesConsumed = $request->minutes_consumed;
            $coinsToConsume = ceil($minutesConsumed * self::COST_PER_MINUTE);
            
            Log::info('💳 Iniciando consumo de monedas', [
                'user_id' => $user->id,
                'room_name' => $request->room_name,
                'minutes' => $minutesConsumed,
                'coins_to_consume' => $coinsToConsume
            ]);

            DB::beginTransaction();

            $userCoins = $this->getUserCoins($user->id);
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance;

            if ($totalBalance < $coinsToConsume) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'error' => 'Saldo insuficiente',
                    'current_balance' => $totalBalance,
                    'required' => $coinsToConsume,
                    'action' => 'end_call'
                ], 400);
            }

            // 🔥 CONSUMIR PRIMERO MONEDAS DE REGALO, LUEGO COMPRADAS
            $remainingToConsume = $coinsToConsume;
            $giftConsumed = 0;
            $purchasedConsumed = 0;

            // Consumir de regalo primero
            if ($userCoins->gift_balance > 0 && $remainingToConsume > 0) {
                $giftConsumed = min($userCoins->gift_balance, $remainingToConsume);
                $userCoins->gift_balance -= $giftConsumed;
                $remainingToConsume -= $giftConsumed;
            }

            // Consumir de compradas si es necesario
            if ($remainingToConsume > 0) {
                $purchasedConsumed = min($userCoins->purchased_balance, $remainingToConsume);
                $userCoins->purchased_balance -= $purchasedConsumed;
                $remainingToConsume -= $purchasedConsumed;
            }

            $userCoins->total_consumed += $coinsToConsume;
            $userCoins->last_consumption_at = now();
            $userCoins->save();

            // Registrar transacción
            CoinConsumption::create([
                'user_id' => $user->id,
                'room_name' => $request->room_name,
                'session_id' => $request->session_id,
                'minutes_consumed' => $minutesConsumed,
                'coins_consumed' => $coinsToConsume,
                'gift_coins_used' => $giftConsumed,
                'purchased_coins_used' => $purchasedConsumed,
                'balance_after' => $userCoins->purchased_balance + $userCoins->gift_balance,
                'consumed_at' => now()
            ]);

            DB::commit();

            $newBalance = $userCoins->purchased_balance + $userCoins->gift_balance;
            
            Log::info('✅ Monedas consumidas exitosamente', [
                'user_id' => $user->id,
                'coins_consumed' => $coinsToConsume,
                'gift_used' => $giftConsumed,
                'purchased_used' => $purchasedConsumed,
                'new_balance' => $newBalance
            ]);

            return response()->json([
                'success' => true,
                'consumed' => $coinsToConsume,
                'breakdown' => [
                    'gift_coins_used' => $giftConsumed,
                    'purchased_coins_used' => $purchasedConsumed
                ],
                'remaining_balance' => $newBalance,
                'minutes_remaining' => floor($newBalance / self::COST_PER_MINUTE),
                'can_continue' => $newBalance >= self::COST_PER_MINUTE
            ]);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Error consumiendo monedas: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error procesando consumo'
            ], 500);
        }
    }

    /**
     * 🎁 Agregar monedas (compradas o regalo)
     */
    public function addCoins(Request $request)
    {
        try {
            $request->validate([
                'user_id' => 'required|integer|exists:users,id',
                'amount' => 'required|integer|min:1',
                'type' => 'required|string|in:purchased,gift',
                'source' => 'required|string',
                'reference_id' => 'nullable|string'
            ]);

            $userId = $request->user_id;
            $amount = $request->amount;
            $type = $request->type;
            $source = $request->source;

            DB::beginTransaction();

            $userCoins = $this->getUserCoins($userId);

            if ($type === 'purchased') {
                $userCoins->purchased_balance += $amount;
                $userCoins->total_purchased += $amount;
            } else {
                $userCoins->gift_balance += $amount;
            }

            $userCoins->last_purchase_at = now();
            $userCoins->save();

            // Registrar transacción
            CoinTransaction::create([
                'user_id' => $userId,
                'type' => $type,
                'amount' => $amount,
                'source' => $source,
                'reference_id' => $request->reference_id,
                'balance_after' => $userCoins->purchased_balance + $userCoins->gift_balance,
                'created_at' => now()
            ]);

            DB::commit();

            Log::info('💰 Monedas agregadas', [
                'user_id' => $userId,
                'amount' => $amount,
                'type' => $type,
                'source' => $source,
                'new_balance' => $userCoins->purchased_balance + $userCoins->gift_balance
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Monedas agregadas exitosamente',
                'added' => $amount,
                'type' => $type,
                'new_balance' => $userCoins->purchased_balance + $userCoins->gift_balance
            ]);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Error agregando monedas: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error agregando monedas'
            ], 500);
        }
    }

    /**
     * 📈 Obtener historial de consumo
     */
    public function getConsumptionHistory($limit = 20)
    {
        try {
            $user = Auth::user();
            
            $history = CoinConsumption::where('user_id', $user->id)
                ->orderBy('consumed_at', 'desc')
                ->limit($limit)
                ->get()
                ->map(function ($consumption) {
                    return [
                        'id' => $consumption->id,
                        'room_name' => $consumption->room_name,
                        'minutes_consumed' => $consumption->minutes_consumed,
                        'coins_consumed' => $consumption->coins_consumed,
                        'gift_coins_used' => $consumption->gift_coins_used,
                        'purchased_coins_used' => $consumption->purchased_coins_used,
                        'consumed_at' => $consumption->consumed_at->toISOString(),
                        'balance_after' => $consumption->balance_after
                    ];
                });

            return response()->json([
                'success' => true,
                'history' => $history
            ]);

        } catch (Exception $e) {
            Log::error('Error obteniendo historial: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Error obteniendo historial'], 500);
        }
    }

    /**
     * 🛠️ Obtener o crear registro de monedas de usuario
     */
    private function getUserCoins($userId)
    {
        return UserCoins::firstOrCreate(
            ['user_id' => $userId],
            [
                'purchased_balance' => 0,
                'gift_balance' => 0,
                'total_purchased' => 0,
                'total_consumed' => 0
            ]
        );
    }

    /**
     * 🔄 Endpoint para sistema automático de descuento
     */
    public function processPeriodicConsumption(Request $request)
    {
        try {
            $request->validate([
                'room_name' => 'required|string',
                'session_duration_seconds' => 'required|integer|min:1'
            ]);

            $user = Auth::user();
            $durationSeconds = $request->session_duration_seconds;
            $minutesConsumed = $durationSeconds / 60; // Convertir a minutos decimales

            return $this->consumeCoins(new Request([
                'room_name' => $request->room_name,
                'minutes_consumed' => $minutesConsumed,
                'session_id' => $request->session_id ?? null
            ]));

        } catch (Exception $e) {
            Log::error('Error en descuento periódico: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Error en descuento'], 500);
        }
    }
    public function processConsumption($userId, $roomName, $minutes, $coins, $sessionId)
    {
        try {
            DB::beginTransaction();

            $userCoins = $this->getUserCoins($userId);
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance;

            if ($totalBalance < $coins) {
                DB::rollBack();
                return ['success' => false, 'error' => 'Saldo insuficiente'];
            }

            // Consumir monedas (primero regalo, luego compradas)
            $remainingToConsume = $coins;
            $giftConsumed = 0;
            $purchasedConsumed = 0;

            if ($userCoins->gift_balance > 0 && $remainingToConsume > 0) {
                $giftConsumed = min($userCoins->gift_balance, $remainingToConsume);
                $userCoins->gift_balance -= $giftConsumed;
                $remainingToConsume -= $giftConsumed;
            }

            if ($remainingToConsume > 0) {
                $purchasedConsumed = min($userCoins->purchased_balance, $remainingToConsume);
                $userCoins->purchased_balance -= $purchasedConsumed;
                $remainingToConsume -= $purchasedConsumed;
            }

            $userCoins->total_consumed += $coins;
            $userCoins->last_consumption_at = now();
            $userCoins->save();

            // Registrar consumo
            \App\Models\CoinConsumption::create([
                'user_id' => $userId,
                'room_name' => $roomName,
                'session_id' => $sessionId,
                'minutes_consumed' => $minutes,
                'coins_consumed' => $coins,
                'gift_coins_used' => $giftConsumed,
                'purchased_coins_used' => $purchasedConsumed,
                'balance_after' => $userCoins->purchased_balance + $userCoins->gift_balance,
                'consumed_at' => now()
            ]);

            DB::commit();

            return [
                'success' => true,
                'remaining_balance' => $userCoins->purchased_balance + $userCoins->gift_balance
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error procesando consumo interno: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    public function getDetailedBalance()
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no autenticado'
                ], 401);
            }

            Log::info("📊 Consultando balance detallado para usuario: {$user->id}");

            // Usar el método privado existente que ya maneja la creación automática
            $userCoins = $this->getUserCoins($user->id);

            $purchasedBalance = (int) $userCoins->purchased_balance;
            $giftBalance = (int) $userCoins->gift_balance;
            $totalBalance = $purchasedBalance + $giftBalance;
            $minutesAvailable = floor($totalBalance / self::COST_PER_MINUTE);
            $canStartCall = $totalBalance >= self::MINIMUM_BALANCE;

            Log::info("✅ Balance obtenido", [
                'user_id' => $user->id,
                'purchased' => $purchasedBalance,
                'gift' => $giftBalance,
                'total' => $totalBalance,
                'minutes' => $minutesAvailable,
                'can_start_call' => $canStartCall
            ]);

            return response()->json([
                'success' => true,
                'balance' => [
                    'purchased_balance' => $purchasedBalance,
                    'gift_balance' => $giftBalance,
                    'total_purchased' => (int) $userCoins->total_purchased,
                    'total_consumed' => (int) $userCoins->total_consumed,
                    'total_available' => $totalBalance,
                    'minutes_available' => $minutesAvailable,
                    'cost_per_minute' => self::COST_PER_MINUTE,
                    'minimum_required' => self::MINIMUM_BALANCE,
                    'last_purchase_at' => $userCoins->last_purchase_at,
                    'last_consumption_at' => $userCoins->last_consumption_at,
                    'created_at' => $userCoins->created_at,
                    'updated_at' => $userCoins->updated_at
                ],
                'has_record' => true,
                'has_balance' => $totalBalance > 0,
                'can_start_call' => $canStartCall,
                'validation' => [
                    'sufficient_for_call' => $canStartCall,
                    'deficit_coins' => $canStartCall ? 0 : (self::MINIMUM_BALANCE - $totalBalance),
                    'deficit_minutes' => $canStartCall ? 0 : ceil((self::MINIMUM_BALANCE - $totalBalance) / self::COST_PER_MINUTE)
                ]
            ], 200);

        } catch (Exception $e) {
            Log::error("❌ Error consultando balance detallado: " . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor',
                'message' => 'No se pudo consultar el saldo del usuario'
            ], 500);
        }
    }

    /**
     * 🎯 Método específico para validación rápida antes de videollamada
     */
    public function validateForVideoCall()
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no autenticado'
                ], 401);
            }

            $userCoins = $this->getUserCoins($user->id);
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance;
            $canStart = $totalBalance >= self::MINIMUM_BALANCE;
            $minutesAvailable = floor($totalBalance / self::COST_PER_MINUTE);

            Log::info("🔍 Validación para videollamada", [
                'user_id' => $user->id,
                'total_balance' => $totalBalance,
                'can_start' => $canStart,
                'minutes_available' => $minutesAvailable
            ]);

            if (!$canStart) {
                $deficit = self::MINIMUM_BALANCE - $totalBalance;
                return response()->json([
                    'success' => false,
                    'can_start' => false,
                    'error' => 'Saldo insuficiente para iniciar videollamada',
                    'current_balance' => $totalBalance,
                    'minimum_required' => self::MINIMUM_BALANCE,
                    'deficit' => $deficit,
                    'deficit_minutes' => ceil($deficit / self::COST_PER_MINUTE),
                    'action_required' => 'recharge'
                ], 400);
            }

            return response()->json([
                'success' => true,
                'can_start' => true,
                'message' => 'Usuario puede iniciar videollamada',
                'balance' => [
                    'total_coins' => $totalBalance,
                    'minutes_available' => $minutesAvailable,
                    'purchased_balance' => $userCoins->purchased_balance,
                    'gift_balance' => $userCoins->gift_balance
                ]
            ], 200);

        } catch (Exception $e) {
            Log::error("❌ Error validando para videollamada: " . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }
}