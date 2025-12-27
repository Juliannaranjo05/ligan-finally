<?php

namespace App\Http\Controllers;

use App\Models\CoinPurchase;
use App\Models\CoinTransaction;
use App\Models\CoinConsumption;
use App\Models\GiftTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class TransactionHistoryController extends Controller
{
    /**
     * 📊 Obtener historial unificado de transacciones
     */
    public function getTransactionHistory(Request $request)
    {
        try {
            $user = Auth::user();
            $type = $request->input('type', 'all'); // all, purchase, consumption, gift
            $perPage = $request->input('per_page', 20);
            $page = $request->input('page', 1);

            $allTransactions = collect();

            // 1. Compras de monedas (CoinPurchase)
            if ($type === 'all' || $type === 'purchase') {
                $purchases = CoinPurchase::where('user_id', $user->id)
                    ->with('package')
                    ->orderBy('created_at', 'desc')
                    ->get();

                foreach ($purchases as $purchase) {
                    $allTransactions->push([
                        'id' => 'purchase_' . $purchase->id,
                        'transaction_type' => 'purchase',
                        'amount' => (float) $purchase->amount,
                        'currency' => $purchase->currency ?? 'COP',
                        'coins' => $purchase->total_coins,
                        'description' => $purchase->package ? $purchase->package->name : 'Compra de monedas',
                        'status' => $purchase->status,
                        'payment_method' => $purchase->payment_method,
                        'reference_id' => $purchase->transaction_id,
                        'date' => $purchase->created_at->toISOString(),
                        'completed_at' => $purchase->completed_at ? $purchase->completed_at->toISOString() : null,
                        'metadata' => [
                            'package_id' => $purchase->package_id,
                            'coins' => $purchase->coins,
                            'bonus_coins' => $purchase->bonus_coins,
                            'total_coins' => $purchase->total_coins,
                            'package_name' => $purchase->package ? $purchase->package->name : null
                        ]
                    ]);
                }
            }

            // 2. Transacciones de monedas (CoinTransaction) - compras y regalos
            if ($type === 'all' || $type === 'purchase' || $type === 'gift') {
                $coinTransactions = CoinTransaction::where('user_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get();

                foreach ($coinTransactions as $transaction) {
                    // Solo incluir si coincide con el filtro
                    if ($type === 'gift' && $transaction->type !== 'gift') continue;
                    if ($type === 'purchase' && $transaction->type !== 'purchased') continue;
                    
                    $transactionType = $transaction->type === 'purchased' ? 'coin_purchase' : 'coin_gift';

                    $allTransactions->push([
                        'id' => 'coin_transaction_' . $transaction->id,
                        'transaction_type' => $transactionType,
                        'amount' => (float) $transaction->amount,
                        'currency' => 'coins',
                        'coins' => $transaction->amount,
                        'description' => $this->getCoinTransactionDescription($transaction),
                        'status' => 'completed',
                        'payment_method' => $transaction->source,
                        'reference_id' => $transaction->reference_id,
                        'date' => $transaction->created_at->toISOString(),
                        'completed_at' => $transaction->created_at->toISOString(),
                        'metadata' => [
                            'type' => $transaction->type,
                            'source' => $transaction->source,
                            'balance_after' => $transaction->balance_after,
                            'notes' => $transaction->notes
                        ]
                    ]);
                }
            }

            // 3. Consumo de monedas (CoinConsumption)
            if ($type === 'all' || $type === 'consumption') {
                $consumptions = CoinConsumption::where('user_id', $user->id)
                    ->orderBy('consumed_at', 'desc')
                    ->get();

                foreach ($consumptions as $consumption) {
                    $allTransactions->push([
                        'id' => 'consumption_' . $consumption->id,
                        'transaction_type' => 'consumption',
                        'amount' => -(float) $consumption->coins_consumed, // Negativo porque es consumo
                        'currency' => 'coins',
                        'coins' => $consumption->coins_consumed,
                        'description' => 'Consumo en videochat - ' . ($consumption->room_name ?? 'Sala desconocida'),
                        'status' => 'completed',
                        'payment_method' => null,
                        'reference_id' => $consumption->session_id,
                        'date' => $consumption->consumed_at->toISOString(),
                        'completed_at' => $consumption->consumed_at->toISOString(),
                        'metadata' => [
                            'room_name' => $consumption->room_name,
                            'minutes_consumed' => $consumption->minutes_consumed,
                            'gift_coins_used' => $consumption->gift_coins_used,
                            'purchased_coins_used' => $consumption->purchased_coins_used,
                            'balance_after' => $consumption->balance_after
                        ]
                    ]);
                }
            }

            // 4. Regalos enviados/recibidos (GiftTransaction)
            if ($type === 'all' || $type === 'gift') {
                $gifts = GiftTransaction::where(function($query) use ($user) {
                    $query->where('sender_id', $user->id)
                          ->orWhere('receiver_id', $user->id);
                })
                ->with(['sender', 'receiver'])
                ->orderBy('created_at', 'desc')
                ->get();

                foreach ($gifts as $gift) {
                    $isSender = $gift->sender_id === $user->id;
                    $transactionType = $isSender ? 'gift_sent' : 'gift_received';
                    $otherUser = $isSender ? $gift->receiver : $gift->sender;

                    $allTransactions->push([
                        'id' => 'gift_' . $gift->id,
                        'transaction_type' => $transactionType,
                        'amount' => (float) $gift->amount,
                        'currency' => 'coins',
                        'coins' => $gift->amount,
                        'description' => $isSender 
                            ? 'Regalo enviado a ' . ($otherUser->name ?? 'Usuario eliminado')
                            : 'Regalo recibido de ' . ($otherUser->name ?? 'Usuario eliminado'),
                        'status' => 'completed',
                        'payment_method' => $gift->source,
                        'reference_id' => $gift->reference_id,
                        'date' => $gift->created_at->toISOString(),
                        'completed_at' => $gift->created_at->toISOString(),
                        'metadata' => [
                            'sender_id' => $gift->sender_id,
                            'receiver_id' => $gift->receiver_id,
                            'sender_name' => $gift->sender->name ?? null,
                            'receiver_name' => $gift->receiver->name ?? null,
                            'message' => $gift->message,
                            'type' => $gift->type,
                            'source' => $gift->source
                        ]
                    ]);
                }
            }

            // Ordenar todas las transacciones por fecha (más recientes primero)
            $sortedTransactions = $allTransactions->sortByDesc('date')->values();

            // Paginación manual
            $total = $sortedTransactions->count();
            $offset = ($page - 1) * $perPage;
            $paginatedTransactions = $sortedTransactions->slice($offset, $perPage)->values();

            return response()->json([
                'success' => true,
                'transactions' => $paginatedTransactions,
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'last_page' => (int) ceil($total / $perPage),
                    'from' => $offset + 1,
                    'to' => min($offset + $perPage, $total)
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

    /**
     * Obtener descripción para transacciones de monedas
     */
    private function getCoinTransactionDescription($transaction)
    {
        $sources = [
            'stripe_purchase' => 'Compra con Stripe',
            'stripe_webhook' => 'Compra Stripe confirmada',
            'admin_gift' => 'Regalo del administrador',
            'purchase_bonus' => 'Bonus por compra',
            'purchase_bonus_webhook' => 'Bonus confirmado',
            'sandbox_purchase' => 'Compra de prueba',
            'sandbox_bonus' => 'Bonus de prueba',
            'promotion' => 'Promoción',
            'referral_bonus' => 'Bonus por referido'
        ];

        $description = $sources[$transaction->source] ?? 'Transacción de monedas';
        
        if ($transaction->type === 'gift') {
            $description = 'Monedas de regalo - ' . $description;
        }

        return $description;
    }
}

