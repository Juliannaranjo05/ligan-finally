<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\UserCoins; // 🔥 CAMBIO AQUÍ
use App\Models\ChatSession;
use App\Models\VideoChatSession;
use App\Models\CoinConsumption;
use App\Models\CoinPurchase;
use App\Models\CoinTransaction;
use App\Models\GiftTransaction;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Services\PlatformSettingsService;

class ClientBalanceController extends Controller
{
    const COINS_PER_MINUTE = 10;

    /**
     * Obtener saldo del cliente para que lo vea la modelo
     */
    public function getClientBalance(Request $request)
    {
        try {
            $request->validate([
                'room_name' => 'required|string',
                'client_user_id' => 'nullable|integer'
            ]);

            $user = Auth::user();
            
            // Verificar que es una modelo
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo las modelos pueden ver el saldo'
                ], 403);
            }

            $roomName = $request->room_name;
            $clientUserId = $request->client_user_id;

            // Buscar cliente desde la sesión si no se proporciona
            if (!$clientUserId) {
                $clientUserId = $this->findClientFromSession($roomName, $user->id);
            }

            if (!$clientUserId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo identificar al cliente'
                ], 400);
            }

            // Obtener datos del balance desde user_coins
            $balanceData = $this->calculateClientBalance($clientUserId, $roomName);

            return response()->json([
                'success' => true,
                'client_balance' => $balanceData
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo saldo del cliente: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Buscar cliente desde la sesión de chat
     */
    private function findClientFromSession($roomName, $modeloId)
    {
        $chatSession = ChatSession::where('room_name', $roomName)
            ->where('status', 'active')
            ->where('modelo_id', $modeloId)
            ->first();

        return $chatSession ? $chatSession->cliente_id : null;
    }

    /**
     * Calcular datos del balance del cliente desde user_coins
     */
    private function calculateClientBalance($clientUserId, $roomName)
    {
        // 🔥 OBTENER SALDO DESDE user_coins usando UserCoins
        $userCoins = UserCoins::where('user_id', $clientUserId)->first();
        
        if (!$userCoins) {
            // Si no existe registro, crear uno vacío
            $userCoins = UserCoins::create([
                'user_id' => $clientUserId,
                'purchased_balance' => 0,
                'gift_balance' => 0,
                'total_purchased' => 0,
                'total_consumed' => 0
            ]);
        }

        // 🔥 USAR LOS NUEVOS ACCESSORS DEL MODELO
        $totalCoins = $userCoins->total_balance; // purchased_balance + gift_balance
        // 🔥 IMPORTANTE: available_minutes solo usa purchased_balance, NO gift_balance
        // gift_balance es solo para regalos, no para minutos de videochat
        $remainingMinutes = $userCoins->available_minutes; // floor(purchased_balance / 10)
        $balanceStatus = $userCoins->balance_status; // normal, low, warning, critical

        // Consumo en esta sesión
        $sessionConsumption = CoinConsumption::where('user_id', $clientUserId)
            ->where('room_name', $roomName)
            ->sum('coins_consumed');

        // Duración de la sesión actual
        $sessionDuration = $this->getSessionDuration($clientUserId, $roomName);

        return [
            'current_coins' => $totalCoins,
            'purchased_balance' => $userCoins->purchased_balance,
            'gift_balance' => $userCoins->gift_balance,
            'remaining_minutes' => $remainingMinutes,
            'remaining_seconds' => $remainingMinutes * 60,
            'coins_per_minute' => self::COINS_PER_MINUTE,
            'balance_status' => $balanceStatus,
            'session_consumption' => $sessionConsumption,
            'session_duration_seconds' => $sessionDuration,
            'total_consumed_historically' => $userCoins->total_consumed,
            'formatted_remaining_time' => sprintf('%02d:%02d', 
                $remainingMinutes, 
                0
            ),
            'warnings' => $this->getBalanceWarnings($remainingMinutes, $balanceStatus)
        ];
    }

    /**
     * Obtener duración de la sesión actual
     */
    private function getSessionDuration($clientUserId, $roomName)
    {
        $videoChatSession = VideoChatSession::where('room_name', $roomName)
            ->where('user_id', $clientUserId)
            ->where('status', 'active')
            ->first();

        if ($videoChatSession && $videoChatSession->started_at) {
            return now()->diffInSeconds($videoChatSession->started_at);
        }

        return 0;
    }

    /**
     * Obtener advertencias según el balance
     */
    private function getBalanceWarnings($remainingMinutes, $status)
    {
        $warnings = [];

        switch ($status) {
            case 'critical':
                $warnings[] = 'El cliente se quedará sin monedas muy pronto';
                $warnings[] = 'La sesión puede terminar en cualquier momento';
                break;
            case 'warning':
                $warnings[] = 'Quedan pocas monedas al cliente';
                $warnings[] = 'Considera sugerir que recargue';
                break;
            case 'low':
                $warnings[] = 'El saldo está bajando';
                break;
        }

        return $warnings;
    }

    public function getMyBalance(Request $request)
    {
        try {
            $user = Auth::user();
            
            // 🔥 VERIFICAR QUE ES UN CLIENTE
            if ($user->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo los clientes pueden ver su propio saldo'
                ], 403);
            }

            $clientUserId = $user->id;
            
            // 🔥 OBTENER SALDO DESDE user_coins usando UserCoins
            $userCoins = UserCoins::where('user_id', $clientUserId)->first();
            
            if (!$userCoins) {
                // Si no existe registro, crear uno vacío
                $userCoins = UserCoins::create([
                    'user_id' => $clientUserId,
                    'purchased_balance' => 0,
                    'gift_balance' => 0,
                    'total_purchased' => 0,
                    'total_consumed' => 0
                ]);
            }

            // 🔥 USAR LOS ACCESSORS DEL MODELO
            $totalCoins = $userCoins->total_balance; // purchased_balance + gift_balance
            // 🔥 IMPORTANTE: available_minutes solo usa purchased_balance, NO gift_balance
            // gift_balance es solo para regalos, no para minutos de videochat
            $remainingMinutes = $userCoins->available_minutes; // floor(purchased_balance / 10)
            $balanceStatus = $userCoins->balance_status; // normal, low, warning, critical

            // 🔥 INFORMACIÓN ADICIONAL PARA EL CLIENTE
            $data = [
                'current_coins' => $totalCoins,
                'purchased_balance' => $userCoins->purchased_balance,
                'gift_balance' => $userCoins->gift_balance,
                'total_balance' => $totalCoins,
                'remaining_minutes' => $remainingMinutes,
                'remaining_seconds' => $remainingMinutes * 60,
                'coins_per_minute' => PlatformSettingsService::getInteger('coins_per_minute', 10),
                'balance_status' => $balanceStatus,
                'total_consumed_historically' => $userCoins->total_consumed,
                'total_purchased_historically' => $userCoins->total_purchased,
                'last_purchase_at' => $userCoins->last_purchase_at,
                'last_consumption_at' => $userCoins->last_consumption_at,
                'formatted_remaining_time' => sprintf('%02d:%02d', 
                    floor($remainingMinutes), 
                    ($remainingMinutes * 60) % 60
                ),
                'warnings' => $this->getClientWarnings($remainingMinutes, $balanceStatus),
                'recommendations' => $this->getClientRecommendations($totalCoins, $balanceStatus)
            ];

            return response()->json([
                'success' => true,
                'balance' => $data,
                'user_info' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->rol
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo mi saldo: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Obtener advertencias específicas para el cliente
     */
    private function getClientWarnings($remainingMinutes, $status)
    {
        $warnings = [];

        switch ($status) {
            case 'critical':
                if ($remainingMinutes <= 1) {
                    $warnings[] = '🚨 Te queda menos de 1 minuto';
                    $warnings[] = '⚠️ Tu sesión terminará muy pronto';
                } else {
                    $warnings[] = '🚨 Te quedan muy pocas monedas';
                    $warnings[] = '⚠️ Considera recargar ahora';
                }
                break;
            case 'warning':
                $warnings[] = '⚠️ Te quedan pocas monedas';
                $warnings[] = '💡 Considera recargar para continuar';
                break;
            case 'low':
                $warnings[] = '📉 Tu saldo está bajando';
                break;
        }

        return $warnings;
    }

    /**
     * Obtener recomendaciones específicas para el cliente
     */
    private function getClientRecommendations($totalCoins, $status)
    {
        $recommendations = [];

        if ($totalCoins <= 20) {
            $recommendations[] = '💰 Recarga monedas para continuar chateando';
            $recommendations[] = '🎁 Aprovecha nuestras ofertas especiales';
        } elseif ($totalCoins <= 50) {
            $recommendations[] = '💡 Considera recargar pronto';
        } elseif ($totalCoins >= 200) {
            $recommendations[] = '🎉 ¡Tienes un buen saldo para disfrutar!';
        }

        return $recommendations;
    }

    /**
     * Obtener saldo simplificado para verificaciones rápidas
     * Endpoint: GET /api/my-balance/quick
     */
    public function getMyBalanceQuick(Request $request)
    {
        try {
            $user = Auth::user();
            
            if ($user->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo los clientes pueden ver su saldo'
                ], 403);
            }

            $userCoins = UserCoins::where('user_id', $user->id)->first();
            
            if (!$userCoins) {
                $userCoins = UserCoins::create([
                    'user_id' => $user->id,
                    'purchased_balance' => 0,
                    'gift_balance' => 0,
                    'total_purchased' => 0,
                    'total_consumed' => 0
                ]);
            }

            $totalCoins = $userCoins->total_balance;
            $remainingMinutes = $userCoins->available_minutes;

            return response()->json([
                'success' => true,
                'total_coins' => $totalCoins,
                'remaining_minutes' => $remainingMinutes,
                'status' => $userCoins->balance_status,
                // 🔥 CORRECCIÓN: should_end_session debe basarse en remaining_minutes (solo purchased), NO en total_coins
                // Cambiar a < 2 en lugar de <= 2 para evitar cortes prematuros
                'should_end_session' => $remainingMinutes < 2, // < 2 minutos (solo purchased_balance) - menos estricto
                'should_show_warning' => $remainingMinutes <= 5  // ≤ 5 minutos (solo purchased_balance)
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo saldo rápido: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Obtener historial de transacciones del cliente
     * Endpoint: GET /api/transactions/history
     */
    public function getTransactionHistory(Request $request)
    {
        try {
            $user = Auth::user();
            
            if ($user->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo los clientes pueden ver su historial'
                ], 403);
            }

            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 20);
            $type = $request->input('type', 'all'); // all, purchase, consumption, gift

            $transactions = collect();

            // 1. Compras de monedas (CoinPurchase)
            if ($type === 'all' || $type === 'purchase') {
                $purchases = CoinPurchase::where('user_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(function ($purchase) {
                        return [
                            'id' => 'purchase_' . $purchase->id,
                            'transaction_type' => 'coin_purchase',
                            'description' => "Compra de {$purchase->total_coins} monedas" . ($purchase->package ? " - {$purchase->package->name}" : ''),
                            'amount' => $purchase->total_coins,
                            'currency' => 'coins',
                            'status' => $purchase->status,
                            'date' => $purchase->created_at->toISOString(),
                            'reference_id' => $purchase->transaction_id ?? $purchase->id,
                            'payment_method' => $purchase->payment_method,
                            'metadata' => [
                                'package_id' => $purchase->package_id,
                                'coins' => $purchase->coins,
                                'bonus_coins' => $purchase->bonus_coins,
                                'amount_paid' => $purchase->amount,
                                'currency_paid' => $purchase->currency
                            ]
                        ];
                    });
                $transactions = $transactions->merge($purchases);
            }

            // 2. Transacciones de monedas (CoinTransaction)
            if ($type === 'all' || $type === 'purchase') {
                $coinTransactions = CoinTransaction::where('user_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(function ($transaction) {
                        $description = $transaction->type === 'purchased' 
                            ? "Monedas compradas: {$transaction->amount}" 
                            : "Monedas de regalo: {$transaction->amount}";
                        
                        return [
                            'id' => 'coin_trans_' . $transaction->id,
                            'transaction_type' => $transaction->type === 'purchased' ? 'purchase' : 'gift_received',
                            'description' => $description,
                            'amount' => $transaction->amount,
                            'currency' => 'coins',
                            'status' => 'completed',
                            'date' => $transaction->created_at->toISOString(),
                            'reference_id' => $transaction->reference_id ?? $transaction->id,
                            'metadata' => [
                                'source' => $transaction->source,
                                'balance_after' => $transaction->balance_after,
                                'notes' => $transaction->notes
                            ]
                        ];
                    });
                $transactions = $transactions->merge($coinTransactions);
            }

            // 3. Consumo de monedas (CoinConsumption)
            if ($type === 'all' || $type === 'consumption') {
                $consumptions = CoinConsumption::where('user_id', $user->id)
                    ->orderBy('consumed_at', 'desc')
                    ->get()
                    ->map(function ($consumption) {
                        return [
                            'id' => 'consumption_' . $consumption->id,
                            'transaction_type' => 'consumption',
                            'description' => "Consumo de {$consumption->coins_consumed} monedas ({$consumption->minutes_consumed} min)",
                            'amount' => -$consumption->coins_consumed, // Negativo porque es consumo
                            'currency' => 'coins',
                            'status' => 'completed',
                            'date' => $consumption->consumed_at->toISOString(),
                            'reference_id' => $consumption->session_id ?? $consumption->id,
                            'metadata' => [
                                'room_name' => $consumption->room_name,
                                'minutes_consumed' => $consumption->minutes_consumed,
                                'gift_coins_used' => $consumption->gift_coins_used,
                                'purchased_coins_used' => $consumption->purchased_coins_used,
                                'balance_after' => $consumption->balance_after
                            ]
                        ];
                    });
                $transactions = $transactions->merge($consumptions);
            }

            // 4. Regalos enviados y recibidos (GiftTransaction)
            if ($type === 'all' || $type === 'gift') {
                $giftsSent = GiftTransaction::where('sender_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(function ($gift) {
                        return [
                            'id' => 'gift_sent_' . $gift->id,
                            'transaction_type' => 'gift_sent',
                            'description' => "Regalo enviado: {$gift->amount} monedas" . ($gift->receiver ? " a {$gift->receiver->name}" : ''),
                            'amount' => -$gift->amount, // Negativo porque se envía
                            'currency' => 'coins',
                            'status' => 'completed',
                            'date' => $gift->created_at->toISOString(),
                            'reference_id' => $gift->reference_id ?? $gift->id,
                            'metadata' => [
                                'receiver_id' => $gift->receiver_id,
                                'type' => $gift->type,
                                'message' => $gift->message
                            ]
                        ];
                    });
                $transactions = $transactions->merge($giftsSent);

                $giftsReceived = GiftTransaction::where('receiver_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(function ($gift) {
                        return [
                            'id' => 'gift_received_' . $gift->id,
                            'transaction_type' => 'gift_received',
                            'description' => "Regalo recibido: {$gift->amount} monedas" . ($gift->sender ? " de {$gift->sender->name}" : ''),
                            'amount' => $gift->amount,
                            'currency' => 'coins',
                            'status' => 'completed',
                            'date' => $gift->created_at->toISOString(),
                            'reference_id' => $gift->reference_id ?? $gift->id,
                            'metadata' => [
                                'sender_id' => $gift->sender_id,
                                'type' => $gift->type,
                                'message' => $gift->message
                            ]
                        ];
                    });
                $transactions = $transactions->merge($giftsReceived);
            }

            // Ordenar por fecha descendente
            $transactions = $transactions->sortByDesc('date')->values();

            // Paginación manual
            $total = $transactions->count();
            $totalPages = ceil($total / $perPage);
            $offset = ($page - 1) * $perPage;
            $paginatedTransactions = $transactions->slice($offset, $perPage)->values();

            return response()->json([
                'success' => true,
                'transactions' => $paginatedTransactions,
                'pagination' => [
                    'current_page' => (int)$page,
                    'per_page' => (int)$perPage,
                    'total' => $total,
                    'total_pages' => $totalPages,
                    'has_next_page' => $page < $totalPages,
                    'has_prev_page' => $page > 1
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo historial de transacciones: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener el historial de transacciones'
            ], 500);
        }
    }
}