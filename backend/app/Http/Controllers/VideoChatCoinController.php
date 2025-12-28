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
use App\Models\CoinPurchase;
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

            // 🔥 CORRECCIÓN: Solo purchased_balance se usa para minutos de llamada
            // gift_balance es solo para regalos, no para llamadas
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance; // Total para mostrar
            $minutesAvailable = floor($userCoins->purchased_balance / self::COST_PER_MINUTE); // Solo purchased para minutos

            return response()->json([
                'success' => true,
                'balance' => [
                    'purchased_coins' => $userCoins->purchased_balance,
                    'gift_coins' => $userCoins->gift_balance,
                    'total_coins' => $totalBalance,
                    'minutes_available' => $minutesAvailable,
                    'remaining_minutes' => $minutesAvailable, // 🔥 AGREGAR remaining_minutes basado solo en purchased
                    'cost_per_minute' => self::COST_PER_MINUTE,
                    'minimum_required' => self::MINIMUM_BALANCE
                ],
                'can_start_call' => $userCoins->purchased_balance >= self::MINIMUM_BALANCE // 🔥 Solo purchased para validar
            ]);
            
        } catch (Exception $e) {
            Log::error('Error obteniendo balance: ' . $e->getMessage(), [
                'user_id' => Auth::id(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false, 
                'error' => 'Error al obtener balance: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 📊 Obtener balance de un cliente específico (para modelos)
     */
    public function getClientBalanceForModel(Request $request)
    {
        try {
            $user = Auth::user();
            
            // Solo modelos pueden verificar el saldo de clientes
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo las modelos pueden verificar el saldo de clientes'
                ], 403);
            }
            
            $request->validate([
                'client_id' => 'required|integer|exists:users,id'
            ]);
            
            $clientId = $request->client_id;
            $client = User::find($clientId);
            
            // Verificar que el usuario es un cliente
            if ($client->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'El usuario especificado no es un cliente'
                ], 400);
            }
            
            $userCoins = $this->getUserCoins($clientId);
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance; // Total para mostrar
            $minutesAvailable = floor($userCoins->purchased_balance / self::COST_PER_MINUTE); // Solo purchased para minutos
            
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
                'can_start_call' => $userCoins->purchased_balance >= self::MINIMUM_BALANCE, // 🔥 Solo purchased para validar
                'client_name' => $client->name
            ]);
            
        } catch (Exception $e) {
            Log::error('Error obteniendo balance del cliente: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener balance del cliente'
            ], 500);
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
            
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance; // Total para mostrar
            // 🔥 CORRECCIÓN: Solo purchased_balance se usa para validar si puede iniciar llamada
            $canStart = $userCoins->purchased_balance >= self::MINIMUM_BALANCE;
            
            Log::info('🔍 Verificación de saldo para videochat', [
                'user_id' => $userId,
                'purchased_balance' => $userCoins->purchased_balance,
                'gift_balance' => $userCoins->gift_balance,
                'total_balance' => $totalBalance,
                'minimum_required' => self::MINIMUM_BALANCE,
                'can_start' => $canStart
            ]);
            
            return [
                'can_start' => $canStart,
                'total_balance' => $totalBalance,
                'minutes_available' => floor($userCoins->purchased_balance / self::COST_PER_MINUTE), // Solo purchased
                'deficit' => $canStart ? 0 : (self::MINIMUM_BALANCE - $userCoins->purchased_balance)
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
            
            // 🔥 REDONDEO: Solo redondear hacia arriba si pasó la mitad del minuto (1.5 minutos = 90 segundos)
            // Si es menos de 1.5 minutos, redondear hacia abajo (floor)
            // Si es 1.5 minutos o más, redondear hacia arriba (ceil)
            // Ejemplo: 1.4 minutos = 1 minuto (10 monedas), 1.5 minutos = 2 minutos (20 monedas)
            if ($minutesConsumed >= 1.5) {
                $coinsToConsume = ceil($minutesConsumed * self::COST_PER_MINUTE);
            } else {
                $coinsToConsume = floor($minutesConsumed * self::COST_PER_MINUTE);
            }
            
            Log::info('💳 [DEBUG] Iniciando consumo de monedas', [
                'user_id' => $user->id,
                'room_name' => $request->room_name,
                'minutes_consumed' => round($minutesConsumed, 3),
                'minutes_consumed_raw' => $minutesConsumed,
                'coins_to_consume' => $coinsToConsume,
                'redondeo_aplicado' => $minutesConsumed >= 1.5 ? 'ceil (>=1.5)' : 'floor (<1.5)',
                'balance_antes' => $this->getUserCoins($user->id)->purchased_balance
            ]);

            DB::beginTransaction();

            $userCoins = $this->getUserCoins($user->id);
            
            // 🔥 PARA CONSUMO POR MINUTOS: SOLO usar purchased_balance
            // gift_balance es SOLO para regalos, NO para minutos de videochat
            if ($userCoins->purchased_balance < $coinsToConsume) {
                DB::rollBack();
                Log::warning('❌ [VIDEOCHAT] Saldo de minutos insuficiente (solo purchased_balance cuenta)', [
                    'user_id' => $user->id,
                    'purchased_balance' => $userCoins->purchased_balance,
                    'gift_balance' => $userCoins->gift_balance,
                    'required' => $coinsToConsume,
                    'note' => 'gift_balance NO se usa para minutos de videochat'
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Saldo de minutos insuficiente',
                    'current_balance' => $userCoins->purchased_balance,
                    'gift_balance' => $userCoins->gift_balance,
                    'required' => $coinsToConsume,
                    'action' => 'end_call',
                    'note' => 'El saldo de regalos no se usa para minutos de videochat'
                ], 400);
            }

            // 🔥 CONSUMIR SOLO DE purchased_balance (NO de gift_balance)
            // gift_balance es SOLO para regalos, NO para minutos de videochat
            $giftConsumed = 0; // Siempre 0 para consumo por minutos
            $purchasedConsumed = $coinsToConsume;

            // Consumir SOLO de purchased_balance
            $userCoins->purchased_balance -= $purchasedConsumed;

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

            // 🔥 ACTUALIZAR VideoChatSession.last_consumption_at para que endCoinSession pueda calcular correctamente
            $videoChatSession = \App\Models\VideoChatSession::where('user_id', $user->id)
                ->where('room_name', $request->room_name)
                ->where('status', 'active')
                ->first();
            
            if ($videoChatSession) {
                $oldLastConsumption = $videoChatSession->last_consumption_at;
                $videoChatSession->update([
                    'last_consumption_at' => now()
                ]);
                
                Log::info('🔍 [DEBUG] ✅ VideoChatSession.last_consumption_at actualizado', [
                    'user_id' => $user->id,
                    'room_name' => $request->room_name,
                    'session_id' => $videoChatSession->id,
                    'old_last_consumption_at' => $oldLastConsumption ? $oldLastConsumption->toDateTimeString() : 'NULL',
                    'new_last_consumption_at' => now()->toDateTimeString(),
                    'coins_consumed' => $coinsToConsume,
                    'minutes_consumed' => round($minutesConsumed, 3)
                ]);
            } else {
                Log::warning('⚠️ [DEBUG] No se encontró VideoChatSession para actualizar last_consumption_at', [
                    'user_id' => $user->id,
                    'room_name' => $request->room_name,
                    'note' => 'Esto puede causar problemas en endCoinSession'
                ]);
            }

            DB::commit();

            $newBalance = $userCoins->purchased_balance + $userCoins->gift_balance;
            
            Log::info('✅ [DEBUG] Monedas consumidas exitosamente', [
                'user_id' => $user->id,
                'room_name' => $request->room_name,
                'coins_consumed' => $coinsToConsume,
                'gift_used' => $giftConsumed,
                'purchased_used' => $purchasedConsumed,
                'balance_antes' => ($userCoins->purchased_balance + $purchasedConsumed) . ' (purchased)',
                'balance_despues' => $userCoins->purchased_balance . ' (purchased)',
                'new_total_balance' => $newBalance,
                'minutes_consumed' => round($minutesConsumed, 3)
            ]);

            return response()->json([
                'success' => true,
                'consumed' => $coinsToConsume,
                'breakdown' => [
                    'gift_coins_used' => $giftConsumed,
                    'purchased_coins_used' => $purchasedConsumed
                ],
                'remaining_balance' => $newBalance,
                // 🔥 CORRECCIÓN: minutes_remaining debe basarse solo en purchased_balance, NO en newBalance (que incluye gift)
                'minutes_remaining' => floor($userCoins->purchased_balance / self::COST_PER_MINUTE),
                'can_continue' => $userCoins->purchased_balance >= self::COST_PER_MINUTE // 🔥 Solo purchased para continuar
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

            Log::info('🔍 [DEBUG] processPeriodicConsumption', [
                'user_id' => $user->id,
                'room_name' => $request->room_name,
                'duration_seconds' => $durationSeconds,
                'minutes_consumed' => round($minutesConsumed, 3),
                'source' => 'endCoinSession o descuento periódico'
            ]);

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
            Log::info('🔍 [DEBUG] processConsumption INICIADO', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'minutes' => round($minutes, 3),
                'coins' => $coins,
                'session_id' => $sessionId,
                'timestamp' => now()->toDateTimeString()
            ]);
            
            DB::beginTransaction();

            $userCoins = $this->getUserCoins($userId);
            
            Log::info('🔍 [DEBUG] Saldo antes de consumo', [
                'user_id' => $userId,
                'purchased_balance' => $userCoins->purchased_balance,
                'gift_balance' => $userCoins->gift_balance,
                'total_balance' => $userCoins->purchased_balance + $userCoins->gift_balance,
                'coins_required' => $coins
            ]);
            
            // 🔥 PARA CONSUMO POR MINUTOS: SOLO usar purchased_balance
            // gift_balance es SOLO para regalos, NO para minutos de videochat
            if ($userCoins->purchased_balance < $coins) {
                DB::rollBack();
                Log::warning('❌ [DEBUG] Saldo de minutos insuficiente en processConsumption', [
                    'user_id' => $userId,
                    'purchased_balance' => $userCoins->purchased_balance,
                    'gift_balance' => $userCoins->gift_balance,
                    'required' => $coins,
                    'note' => 'gift_balance NO se usa para minutos de videochat'
                ]);
                return ['success' => false, 'error' => 'Saldo de minutos insuficiente'];
            }

            // 🔥 CONSUMIR SOLO DE purchased_balance (NO de gift_balance)
            // gift_balance es SOLO para regalos, NO para minutos de videochat
            $giftConsumed = 0; // Siempre 0 para consumo por minutos
            $purchasedConsumed = $coins;
            
            $balanceBefore = $userCoins->purchased_balance;

            // Consumir SOLO de purchased_balance
            $userCoins->purchased_balance -= $purchasedConsumed;

            $userCoins->total_consumed += $coins;
            $userCoins->last_consumption_at = now();
            $userCoins->save();

            // Registrar consumo
            $consumption = \App\Models\CoinConsumption::create([
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

            Log::info('✅ [DEBUG] processConsumption EXITOSO', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'consumption_id' => $consumption->id,
                'coins_consumed' => $coins,
                'minutes_consumed' => round($minutes, 3),
                'purchased_balance_before' => $balanceBefore,
                'purchased_balance_after' => $userCoins->purchased_balance,
                'gift_balance' => $userCoins->gift_balance,
                'total_balance_after' => $userCoins->purchased_balance + $userCoins->gift_balance,
                'session_id' => $sessionId
            ]);

            return [
                'success' => true,
                'remaining_balance' => $userCoins->purchased_balance + $userCoins->gift_balance, // Total para mostrar
                'purchased_balance' => $userCoins->purchased_balance, // Solo purchased para calcular minutos
                'gift_balance' => $userCoins->gift_balance
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
            $totalBalance = $purchasedBalance + $giftBalance; // Total para mostrar
            // 🔥 CORRECCIÓN: Solo purchased_balance se usa para minutos de llamada
            $minutesAvailable = floor($purchasedBalance / self::COST_PER_MINUTE);
            $canStartCall = $purchasedBalance >= self::MINIMUM_BALANCE;

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
                    'deficit_coins' => $canStartCall ? 0 : (self::MINIMUM_BALANCE - $purchasedBalance), // 🔥 Solo purchased
                    'deficit_minutes' => $canStartCall ? 0 : ceil((self::MINIMUM_BALANCE - $purchasedBalance) / self::COST_PER_MINUTE) // 🔥 Solo purchased
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
            $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance; // Total para mostrar
            // 🔥 CORRECCIÓN: Solo purchased_balance se usa para validar si puede iniciar llamada
            $canStart = $userCoins->purchased_balance >= self::MINIMUM_BALANCE;
            $minutesAvailable = floor($userCoins->purchased_balance / self::COST_PER_MINUTE); // Solo purchased

            Log::info("🔍 Validación para videollamada", [
                'user_id' => $user->id,
                'total_balance' => $totalBalance,
                'can_start' => $canStart,
                'minutes_available' => $minutesAvailable
            ]);

            if (!$canStart) {
                $deficit = self::MINIMUM_BALANCE - $userCoins->purchased_balance; // 🔥 Solo purchased
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

    /**
     * 📊 Estadísticas globales de monedas para administrador
     */
    public function getAdminStats(Request $request)
    {
        try {
            // Rango de días para estadísticas rápidas (por defecto 30)
            $days = (int) ($request->query('days', 30));
            if ($days <= 0) {
                $days = 30;
            }

            $fromDate = Carbon::now()->subDays($days);

            // Totales globales basados en user_coins
            $totalPurchasedBalance = (int) UserCoins::sum('purchased_balance');
            $totalGiftBalance = (int) UserCoins::sum('gift_balance');
            $totalAvailableCoins = $totalPurchasedBalance + $totalGiftBalance;

            $totalPurchasedLifetime = (int) UserCoins::sum('total_purchased');
            $totalConsumedLifetime = (int) UserCoins::sum('total_consumed');

            // Compras completadas (dinero real)
            $totalRevenue = (float) CoinPurchase::completed()->sum('amount');
            $totalPurchases = (int) CoinPurchase::completed()->count();

            // Estadísticas recientes usando CoinTransaction y CoinConsumption
            $recentPurchasedCoins = (int) CoinTransaction::purchased()
                ->where('created_at', '>=', $fromDate)
                ->sum('amount');

            $recentGiftCoins = (int) CoinTransaction::gift()
                ->where('created_at', '>=', $fromDate)
                ->sum('amount');

            $recentConsumedCoins = (int) CoinConsumption::where('consumed_at', '>=', $fromDate)
                ->sum('coins_consumed');

            $activeUsersWithBalance = (int) UserCoins::whereRaw('(purchased_balance + gift_balance) > 0')->count();
            $usersWithCriticalBalance = (int) UserCoins::withCriticalBalance()->count();
            $usersWithLowBalance = (int) UserCoins::withLowBalance()->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'coins' => [
                        'total_purchased_balance' => $totalPurchasedBalance,
                        'total_gift_balance' => $totalGiftBalance,
                        'total_available_coins' => $totalAvailableCoins,
                        'total_purchased_lifetime' => $totalPurchasedLifetime,
                        'total_consumed_lifetime' => $totalConsumedLifetime,
                    ],
                    'recent_activity' => [
                        'days' => $days,
                        'purchased_coins' => $recentPurchasedCoins,
                        'gift_coins' => $recentGiftCoins,
                        'consumed_coins' => $recentConsumedCoins,
                    ],
                    'revenue' => [
                        'total_revenue' => $totalRevenue,
                        'total_purchases' => $totalPurchases,
                    ],
                    'users' => [
                        'active_with_balance' => $activeUsersWithBalance,
                        'low_balance' => $usersWithLowBalance,
                        'critical_balance' => $usersWithCriticalBalance,
                    ],
                ],
            ]);
        } catch (Exception $e) {
            Log::error('❌ Error obteniendo estadísticas de monedas para admin: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo estadísticas de monedas',
            ], 500);
        }
    }

    /**
     * 📜 Listado paginado de transacciones de monedas para administrador
     */
    public function getAdminTransactions(Request $request)
    {
        try {
            $perPage = (int) $request->query('per_page', 50);
            if ($perPage <= 0) {
                $perPage = 50;
            }
            $perPage = min($perPage, 200);

            $query = CoinTransaction::with('user')->orderBy('created_at', 'desc');

            if ($request->filled('type')) {
                $query->where('type', $request->query('type'));
            }

            if ($request->filled('user_id')) {
                $query->where('user_id', $request->query('user_id'));
            }

            if ($request->filled('source')) {
                $query->where('source', $request->query('source'));
            }

            if ($request->filled('date_from')) {
                try {
                    $from = Carbon::parse($request->query('date_from'))->startOfDay();
                    $query->where('created_at', '>=', $from);
                } catch (\Exception $e) {
                    // Ignorar parseo inválido y no aplicar filtro
                }
            }

            if ($request->filled('date_to')) {
                try {
                    $to = Carbon::parse($request->query('date_to'))->endOfDay();
                    $query->where('created_at', '<=', $to);
                } catch (\Exception $e) {
                    // Ignorar parseo inválido y no aplicar filtro
                }
            }

            if ($request->filled('search')) {
                $search = $request->query('search');
                $query->whereHas('user', function ($q) use ($search) {
                    $q->where('name', 'like', '%' . $search . '%')
                        ->orWhere('email', 'like', '%' . $search . '%');
                });
            }

            $paginator = $query->paginate($perPage);

            $paginator->getCollection()->transform(function (CoinTransaction $tx) {
                return [
                    'id' => $tx->id,
                    'user_id' => $tx->user_id,
                    'user_name' => $tx->user->name ?? null,
                    'user_email' => $tx->user->email ?? null,
                    'type' => $tx->type,
                    'type_display' => $tx->type_display,
                    'source' => $tx->source,
                    'source_display' => $tx->source_display,
                    'amount' => (int) $tx->amount,
                    'balance_after' => (int) $tx->balance_after,
                    'reference_id' => $tx->reference_id,
                    'notes' => $tx->notes,
                    'created_at' => optional($tx->created_at)->toISOString(),
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                ],
            ]);
        } catch (Exception $e) {
            Log::error('❌ Error obteniendo transacciones de monedas para admin: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo transacciones de monedas',
            ], 500);
        }
    }

    /**
     * 👥 Listado de balances de usuarios para administrador
     */
    public function getAdminUsersBalance(Request $request)
    {
        try {
            $perPage = (int) $request->query('per_page', 50);
            if ($perPage <= 0) {
                $perPage = 50;
            }
            $perPage = min($perPage, 200);

            $query = UserCoins::with('user')
                ->orderByRaw('(purchased_balance + gift_balance) DESC');

            // Filtro por rol de usuario (modelo, cliente, etc.)
            if ($request->filled('rol')) {
                $rol = $request->query('rol');
                $query->whereHas('user', function ($q) use ($rol) {
                    $q->where('rol', $rol);
                });
            }

            // Búsqueda por nombre o email
            if ($request->filled('search')) {
                $search = $request->query('search');
                $query->whereHas('user', function ($q) use ($search) {
                    $q->where('name', 'like', '%' . $search . '%')
                        ->orWhere('email', 'like', '%' . $search . '%');
                });
            }

            // Filtros por balance mínimo/máximo
            if ($request->filled('min_balance')) {
                $min = (int) $request->query('min_balance');
                $query->whereRaw('(purchased_balance + gift_balance) >= ?', [$min]);
            }

            if ($request->filled('max_balance')) {
                $max = (int) $request->query('max_balance');
                $query->whereRaw('(purchased_balance + gift_balance) <= ?', [$max]);
            }

            // Filtro por estado de balance (normal, low, warning, critical)
            if ($request->filled('balance_status')) {
                $status = $request->query('balance_status');
                if ($status === 'critical') {
                    $query->withCriticalBalance();
                } elseif ($status === 'low') {
                    $query->withLowBalance();
                }
            }

            $paginator = $query->paginate($perPage);

            $paginator->getCollection()->transform(function (UserCoins $coins) {
                $totalBalance = (int) $coins->total_balance;

                return [
                    'user_id' => $coins->user_id,
                    'user_name' => optional($coins->user)->name,
                    'user_email' => optional($coins->user)->email,
                    'user_role' => optional($coins->user)->rol,
                    'purchased_balance' => (int) $coins->purchased_balance,
                    'gift_balance' => (int) $coins->gift_balance,
                    'total_balance' => $totalBalance,
                    'minutes_available' => (int) $coins->available_minutes,
                    'total_purchased' => (int) $coins->total_purchased,
                    'total_consumed' => (int) $coins->total_consumed,
                    'balance_status' => $coins->balance_status,
                    'last_purchase_at' => optional($coins->last_purchase_at)->toISOString(),
                    'last_consumption_at' => optional($coins->last_consumption_at)->toISOString(),
                    'created_at' => optional($coins->created_at)->toISOString(),
                    'updated_at' => optional($coins->updated_at)->toISOString(),
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                ],
            ]);
        } catch (Exception $e) {
            Log::error('❌ Error obteniendo balances de usuarios para admin: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo balances de usuarios',
            ], 500);
        }
    }
}