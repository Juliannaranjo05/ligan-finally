<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\SessionEarning;
use App\Models\VideoChatSession;
use App\Models\WeeklyPayment;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SessionEarningsController extends Controller
{
    // 🔥 CONSTANTES ACTUALIZADAS
    const MODEL_EARNINGS_PER_MINUTE = 0.24; // $0.24 por minuto FIJO
    const COINS_PER_MINUTE = 10; // 10 coins = 1 minuto

    /**
     * 🔥 NUEVO MÉTODO UNIFICADO: PROCESAR GANANCIAS POR TIEMPO
     */
    public function processSessionEarnings($sessionId, $modelUserId, $clientUserId, $roomName, $actualDurationSeconds = null)
    {
        try {
            Log::info('🧮 [UNIFICADO] Procesando ganancias de sesión', [
                'session_id' => $sessionId,
                'model_user_id' => $modelUserId,
                'client_user_id' => $clientUserId,
                'actual_duration_seconds' => $actualDurationSeconds
            ]);

            // 🔍 BUSCAR/CREAR SESIÓN
            $session = $this->findOrCreateSession($sessionId, $modelUserId, $clientUserId, $roomName, $actualDurationSeconds);
            
            if (!$session) {
                Log::error('❌ No se pudo crear/encontrar la sesión: ' . $sessionId);
                return false;
            }

            // 🔒 PROTECCIÓN: RESPETAR DURACIÓN MANUAL
            $durationSeconds = $this->getDurationSeconds($session, $actualDurationSeconds);
            
            // 💰 CALCULAR GANANCIAS POR TIEMPO
            $timeEarnings = $this->calculateTimeEarnings($durationSeconds);
            
            // 🔄 CREAR O ACTUALIZAR SESSION_EARNINGS
            $this->createOrUpdateSessionEarning(
                $session,
                $modelUserId,
                $clientUserId,
                $roomName,
                $durationSeconds,
                $timeEarnings
            );

            // ❌ NO ACTUALIZAR User.balance (se calcula dinámicamente)
            
            Log::info('✅ [UNIFICADO] Ganancias de sesión procesadas', [
                'session_id' => $session->id,
                'duration_seconds' => $durationSeconds,
                'time_earnings' => $timeEarnings['model_earnings'],
                'qualifying' => $timeEarnings['qualifying']
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('❌ Error procesando ganancias unificadas: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * 🎁 NUEVO MÉTODO: PROCESAR GANANCIAS POR REGALOS
     */
    public function processGiftEarnings($modelUserId, $clientUserId, $giftValue, $roomName = null, $giftDetails = [])
    {
        try {
            Log::info('🎁 [UNIFICADO] Procesando ganancias de regalo', [
                'model_user_id' => $modelUserId,
                'client_user_id' => $clientUserId,
                'gift_value' => $giftValue,
                'room_name' => $roomName
            ]);

            // 🔍 BUSCAR SESIÓN ACTIVA O CREAR ENTRADA PARA REGALO
            $existingEarning = SessionEarning::where('model_user_id', $modelUserId)
                ->where('client_user_id', $clientUserId)
                ->where('room_name', $roomName ?: 'direct_gift')
                ->whereNull('weekly_payment_id')
                ->orderBy('created_at', 'desc')
                ->first();

            // 💰 CALCULAR GANANCIAS DEL REGALO (70% para modelo)
            $modelGiftEarnings = round($giftValue * 0.60, 2);
            $platformGiftEarnings = round($giftValue * 0.40, 2);

            if ($existingEarning && $roomName && $existingEarning->source_type === 'video_session') {
                // 🔄 ACTUALIZAR SESIÓN EXISTENTE CON REGALO
                $existingEarning->update([
                    'model_gift_earnings' => $existingEarning->model_gift_earnings + $modelGiftEarnings,
                    'model_total_earnings' => $existingEarning->model_total_earnings + $modelGiftEarnings,
                    'platform_gift_earnings' => $existingEarning->platform_gift_earnings + $platformGiftEarnings,
                    'platform_total_earnings' => $existingEarning->platform_total_earnings + $platformGiftEarnings,
                    'gift_count' => $existingEarning->gift_count + 1,
                    'gift_details' => array_merge($existingEarning->gift_details ?: [], [$giftDetails])
                ]);

                Log::info('✅ [UNIFICADO] Regalo agregado a sesión existente', [
                    'earning_id' => $existingEarning->id,
                    'new_gift_earnings' => $existingEarning->model_gift_earnings,
                    'new_total_earnings' => $existingEarning->model_total_earnings
                ]);

            } else {
                // 🆕 CREAR NUEVA ENTRADA SOLO PARA REGALO
                $newEarning = SessionEarning::create([
                    'session_id' => 'gift_' . time() . '_' . $modelUserId,
                    'model_user_id' => $modelUserId,
                    'client_user_id' => $clientUserId,
                    'room_name' => $roomName ?: 'direct_gift',
                    'source_type' => $roomName ? 'chat_gift' : 'direct_gift',
                    'session_duration_seconds' => 0,
                    'qualifying_session' => true, // Los regalos siempre califican
                    'total_time_coins_spent' => 0,
                    'total_gifts_coins_spent' => $giftValue,
                    'total_coins_spent' => $giftValue,
                    'client_usd_spent' => $this->calculateUSDFromGiftCoins($giftValue),
                    'stripe_commission' => 0,
                    'after_stripe_amount' => $this->calculateUSDFromGiftCoins($giftValue),
                    'model_time_earnings' => 0,
                    'model_gift_earnings' => $modelGiftEarnings,
                    'model_total_earnings' => $modelGiftEarnings,
                    'platform_time_earnings' => 0,
                    'platform_gift_earnings' => $platformGiftEarnings,
                    'platform_total_earnings' => $platformGiftEarnings,
                    'gift_count' => 1,
                    'gift_details' => [$giftDetails],
                    'session_started_at' => now(),
                    'session_ended_at' => now(),
                    'processed_at' => now()
                ]);

                Log::info('✅ [UNIFICADO] Nueva entrada de regalo creada', [
                    'earning_id' => $newEarning->id,
                    'gift_earnings' => $modelGiftEarnings,
                    'source_type' => $newEarning->source_type
                ]);
            }

            return true;

        } catch (\Exception $e) {
            Log::error('❌ Error procesando ganancias de regalo: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * 💰 NUEVO MÉTODO: OBTENER BALANCE DINÁMICO
     */
    public function getUserBalance()
    {
        try {
            $user = Auth::user();
            
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo modelos pueden consultar balance'
                ], 403);
            }

            // 🔥 CALCULAR BALANCE DINÁMICAMENTE
            $balanceData = SessionEarning::getModelBalance($user->id);
            
            return response()->json([
                'success' => true,
                'balance' => [
                    'current_balance' => round($balanceData['current_balance'], 2),
                    'time_earnings' => round($balanceData['time_earnings'], 2),
                    'gift_earnings' => round($balanceData['gift_earnings'], 2),
                    'total_earned' => round($user->total_earned ?? 0, 2), // Histórico
                    'last_earning_at' => $user->last_earning_at ? $user->last_earning_at->toISOString() : null
                ],
                'weekly_breakdown' => [
                    'time_earnings' => round($balanceData['weekly_time_earnings'], 2),
                    'gift_earnings' => round($balanceData['weekly_gift_earnings'], 2),
                    'total_weekly' => round($balanceData['weekly_total_earnings'], 2),
                    'sessions_count' => $balanceData['weekly_sessions_count'],
                    'gifts_count' => $balanceData['weekly_gifts_count'],
                    'week_range' => $this->getCurrentWeekRange()
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error obteniendo balance dinámico: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * 🔥 ACTUALIZAR: GANANCIAS SEMANALES CON PESTAÑAS
     */
    public function getWeeklyEarnings()
    {
        try {
            $user = Auth::user();
            
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Acceso denegado - Solo modelos'
                ], 403);
            }

            // ✅ OBTENER SOLO GANANCIAS SIN PROCESAR
            $unpaidEarnings = SessionEarning::unpaid()
                ->forModel($user->id)
                ->with(['client'])
                ->orderBy('created_at', 'desc')
                ->get();

            $currentBalance = $unpaidEarnings->sum('model_total_earnings');
            $totalUnpaidSessions = $unpaidEarnings->count();
            $qualifyingUnpaidSessions = $unpaidEarnings->where('qualifying_session', true)->count();

            // ✅ VERIFICAR PAGO PENDIENTE
            $pendingPayment = WeeklyPayment::where('model_user_id', $user->id)
                ->where('status', 'pending')
                ->first();

            // 🔥 FORMATEAR GANANCIAS PARA PESTAÑAS
            $formattedEarnings = $unpaidEarnings->map(function ($earning) {
                return [
                    'id' => $earning->id,
                    'client_name' => $earning->client->name ?? 'Cliente',
                    'session_date' => $earning->created_at->format('d/m/Y'),
                    'session_time' => $earning->created_at->format('H:i'),
                    'session_duration_seconds' => $earning->session_duration_seconds,
                    'session_duration_formatted' => $earning->getDurationFormatted(),
                    'session_duration_minutes' => round($earning->session_duration_seconds / 60, 1),
                    'earning_amount_gross' => round($earning->model_total_earnings, 2),
                    'time_earnings' => round($earning->model_time_earnings, 2),
                    'gift_earnings' => round($earning->model_gift_earnings, 2),
                    'gift_count' => $earning->gift_count,
                    'source_type' => $earning->source_type,
                    'source_label' => $earning->getSourceTypeLabel(),
                    'qualifying_session' => $earning->qualifying_session,
                    'is_gift_only' => $earning->isGiftOnly(),
                    'is_time_only' => $earning->isTimeOnly(),
                    'is_mixed' => $earning->isMixed(),
                    'created_at' => $earning->created_at->toISOString()
                ];
            });

            // 🔄 SEPARAR POR PESTAÑAS
            $sessionEarnings = $formattedEarnings->filter(fn($e) => $e['time_earnings'] > 0);
            $giftEarnings = $formattedEarnings->filter(fn($e) => $e['gift_earnings'] > 0);

            return response()->json([
                'success' => true,
                'current_week' => [
                    'week_start' => $this->getCurrentWeekStart()->format('d/m/Y'),
                    'week_end' => $this->getCurrentWeekEnd()->format('d/m/Y'),
                    
                    'net_earnings' => [
                        'total_earnings' => round($currentBalance, 2),
                        'time_earnings' => round($unpaidEarnings->sum('model_time_earnings'), 2),
                        'gift_earnings' => round($unpaidEarnings->sum('model_gift_earnings'), 2)
                    ],
                    
                    'session_stats' => [
                        'total_sessions' => $totalUnpaidSessions,
                        'qualifying_sessions' => $qualifyingUnpaidSessions,
                        'qualification_rate' => $totalUnpaidSessions > 0 ? round(($qualifyingUnpaidSessions / $totalUnpaidSessions) * 100, 1) : 0
                    ],
                    
                    // 🔥 NUEVA ESTRUCTURA CON PESTAÑAS
                    'earnings_list' => $formattedEarnings->values(),
                    'session_earnings' => $sessionEarnings->values(),
                    'gift_earnings' => $giftEarnings->values(),
                    
                    'payment_status' => [
                        'is_paid' => false,
                        'paid_at' => null,
                        'final_amount_to_pay' => round($currentBalance, 2),
                        'minimum_payout' => round($user->minimum_payout ?? 40.00, 2),
                        'can_request_payout' => $currentBalance >= ($user->minimum_payout ?? 40.00),
                        'has_pending_payment' => $pendingPayment !== null
                    ]
                ],
                
                'pending_payment' => $pendingPayment ? [
                    'id' => $pendingPayment->id,
                    'amount' => round($pendingPayment->amount, 2),
                    'status' => $pendingPayment->status,
                    'created_at' => $pendingPayment->processed_at->format('d/m/Y H:i'),
                    'sessions_included' => $pendingPayment->total_sessions,
                    'message' => "Tienes un pago pendiente de $" . number_format($pendingPayment->amount, 2) . " esperando aprobación del administrador."
                ] : null
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo ganancias semanales unificadas: ' . $e->getMessage());
            return response()->json([
                'success' => false, 
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    // ========================= MÉTODOS PRIVADOS AUXILIARES =========================

    private function findOrCreateSession($sessionId, $modelUserId, $clientUserId, $roomName, $actualDurationSeconds)
    {
        // Buscar sesión existente
        $session = VideoChatSession::find($sessionId);
        
        if (!$session) {
            $session = VideoChatSession::where('room_name', $roomName)
                ->where(function($query) use ($modelUserId, $clientUserId) {
                    $query->where('user_id', $modelUserId)
                        ->orWhere('user_id', $clientUserId);
                })
                ->orderBy('created_at', 'desc')
                ->first();
        }
        
        if (!$session) {
            Log::warning('⚠️ Sesión no encontrada, creando nueva');
            
            $session = VideoChatSession::create([
                'id' => $sessionId,
                'user_id' => $clientUserId,
                'room_name' => $roomName,
                'user_role' => 'cliente',
                'status' => 'ended',
                'is_consuming' => false,
                'total_consumed' => 0,
                'actual_duration_seconds' => $actualDurationSeconds ?? 60,
                'is_manual_duration' => false,
                'end_reason' => 'auto_created_for_earnings'
            ]);
        }

        return $session;
    }

    private function getDurationSeconds($session, $actualDurationSeconds)
    {
        $session = $session->fresh();
        
        if ($session->is_manual_duration && $session->actual_duration_seconds > 0) {
            Log::info('🔒 [PROTECCIÓN] Respetando duración manual', [
                'manual_duration' => $session->actual_duration_seconds
            ]);
            return (int) $session->actual_duration_seconds;
        }
        
        // Calcular duración automática
        if ($actualDurationSeconds !== null && $actualDurationSeconds > 0) {
            $durationSeconds = (int) $actualDurationSeconds;
            
            try {
                $freshSession = VideoChatSession::find($session->id);
                if (!$freshSession->is_manual_duration) {
                    $freshSession->update([
                        'actual_duration_seconds' => $durationSeconds,
                        'is_manual_duration' => false
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('❌ Error actualizando duración: ' . $e->getMessage());
            }
            
            return $durationSeconds;
        }
        
        // Fallback
        return $session->actual_duration_seconds ?: 30;
    }

    private function calculateTimeEarnings($durationSeconds)
    {
        $durationMinutes = $durationSeconds / 60;
        $payableMinutes = floor($durationSeconds / 60); // Solo minutos completos
        $qualifyingSession = $payableMinutes >= 1;

        $modelEarnings = $qualifyingSession ? round($payableMinutes * self::MODEL_EARNINGS_PER_MINUTE, 2) : 0;
        $theoreticalCoinsConsumed = ceil($payableMinutes * self::COINS_PER_MINUTE);
        
        return [
            'qualifying' => $qualifyingSession,
            'payable_minutes' => $payableMinutes,
            'model_earnings' => $modelEarnings,
            'theoretical_coins' => $theoreticalCoinsConsumed
        ];
    }

    private function createOrUpdateSessionEarning($session, $modelUserId, $clientUserId, $roomName, $durationSeconds, $timeEarnings)
    {
        $existingEarning = SessionEarning::where('session_id', $session->id)
            ->where('model_user_id', $modelUserId)
            ->where('client_user_id', $clientUserId)
            ->first();

        $earningData = [
            'source_type' => 'video_session',
            'session_duration_seconds' => $durationSeconds,
            'qualifying_session' => $timeEarnings['qualifying'],
            'model_time_earnings' => $timeEarnings['model_earnings'],
            'model_total_earnings' => $timeEarnings['model_earnings'], // Se suma con regalos si los hay
            'total_time_coins_spent' => $timeEarnings['theoretical_coins'],
            'total_coins_spent' => $timeEarnings['theoretical_coins'],
            'session_started_at' => $session->started_at,
            'session_ended_at' => $session->ended_at,
            'processed_at' => now()
        ];

        if ($existingEarning) {
            // Mantener ganancias de regalos existentes
            $earningData['model_total_earnings'] = $timeEarnings['model_earnings'] + $existingEarning->model_gift_earnings;
            $existingEarning->update($earningData);
            
            Log::info('💰 [UNIFICADO] Session earning actualizado', [
                'earning_id' => $existingEarning->id,
                'time_earnings' => $timeEarnings['model_earnings'],
                'total_earnings' => $earningData['model_total_earnings']
            ]);
        } else {
            $newEarning = SessionEarning::create(array_merge($earningData, [
                'session_id' => $session->id,
                'model_user_id' => $modelUserId,
                'client_user_id' => $clientUserId,
                'room_name' => $roomName,
                'model_gift_earnings' => 0,
                'platform_time_earnings' => 0,
                'platform_gift_earnings' => 0,
                'platform_total_earnings' => 0,
                'gift_count' => 0
            ]));
            
            Log::info('💰 [UNIFICADO] Nuevo session earning creado', [
                'earning_id' => $newEarning->id,
                'time_earnings' => $timeEarnings['model_earnings']
            ]);
        }
    }

    private function calculateUSDFromGiftCoins($giftCoins)
    {
        try {
            $averageCostPerCoin = $this->getAverageCoinCost();
            return round($giftCoins * $averageCostPerCoin, 2);
        } catch (\Exception $e) {
            Log::error('Error calculando USD desde gift coins: ' . $e->getMessage());
            return round($giftCoins * 0.15, 2); // Fallback
        }
    }

    private function getAverageCoinCost()
    {
        try {
            $packages = \App\Models\CoinPackage::where('is_active', true)
                ->where('type', 'gifts')
                ->get();

            if ($packages->isEmpty()) {
                return 0.15; // Fallback
            }

            $totalCost = 0;
            $totalCoins = 0;

            foreach ($packages as $package) {
                $packageCoins = $package->coins + ($package->bonus_coins ?? 0);
                $totalCost += $package->regular_price;
                $totalCoins += $packageCoins;
            }

            return $totalCoins > 0 ? ($totalCost / $totalCoins) : 0.15;
        } catch (\Exception $e) {
            Log::error('Error obteniendo costo promedio: ' . $e->getMessage());
            return 0.15;
        }
    }

    private function getCurrentWeekRange()
    {
        $start = $this->getCurrentWeekStart();
        $end = $this->getCurrentWeekEnd();
        return $start->format('d/m/Y') . ' - ' . $end->format('d/m/Y');
    }

    private function getCurrentWeekStart()
    {
        return now()->startOfWeek(Carbon::MONDAY);
    }

    private function getCurrentWeekEnd()
    {
        return now()->endOfWeek(Carbon::SUNDAY)->endOfDay();
    }

    /**
     * 🔄 ACTUALIZADO: PAGO SEMANAL UNIFICADO
     */
    public function processWeeklyPayment(Request $request)
    {
        try {
            $request->validate([
                'model_user_id' => 'required|exists:users,id',
                'payment_method' => 'required|string',
                'payment_reference' => 'nullable|string'
            ]);

            $modelUserId = $request->model_user_id;

            DB::beginTransaction();

            // ✅ OBTENER TODAS LAS GANANCIAS SIN PAGAR
            $unpaidEarnings = SessionEarning::unpaid()
                ->forModel($modelUserId)
                ->get();

            if ($unpaidEarnings->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'error' => 'No hay ganancias pendientes para este modelo'
                ], 400);
            }

            // 💰 CALCULAR TOTALES
            $totalAmount = $unpaidEarnings->sum('model_total_earnings');
            $timeEarnings = $unpaidEarnings->sum('model_time_earnings');
            $giftEarnings = $unpaidEarnings->sum('model_gift_earnings');
            $totalSessions = $unpaidEarnings->count();

            // 📅 RANGO DE FECHAS
            $oldestEarning = $unpaidEarnings->min('created_at');
            $newestEarning = $unpaidEarnings->max('created_at');

            // 🆕 CREAR PAGO SEMANAL
            $payment = WeeklyPayment::create([
                'model_user_id' => $modelUserId,
                'week_start' => Carbon::parse($oldestEarning)->startOfDay(),
                'week_end' => Carbon::parse($newestEarning)->endOfDay(),
                'gross_amount' => round($totalAmount, 2),
                'stripe_fee' => 0, // Se puede calcular después si es necesario
                'amount' => round($totalAmount, 2),
                'total_sessions' => $totalSessions,
                'time_earnings' => round($timeEarnings, 2),
                'gift_earnings' => round($giftEarnings, 2),
                'payment_method' => $request->payment_method,
                'payment_reference' => $request->payment_reference,
                'status' => 'pending',
                'processed_at' => now()
            ]);

            // 🔗 MARCAR GANANCIAS COMO PAGADAS
            $unpaidEarnings->each(function ($earning) use ($payment) {
                $earning->update(['weekly_payment_id' => $payment->id]);
            });

            DB::commit();

            Log::info('💰 [UNIFICADO] Pago semanal procesado', [
                'payment_id' => $payment->id,
                'model_user_id' => $modelUserId,
                'total_amount' => $totalAmount,
                'time_earnings' => $timeEarnings,
                'gift_earnings' => $giftEarnings,
                'sessions_count' => $totalSessions
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pago semanal procesado exitosamente',
                'payment' => [
                    'id' => $payment->id,
                    'total_amount' => $payment->amount,
                    'time_earnings' => $payment->time_earnings,
                    'gift_earnings' => $payment->gift_earnings,
                    'sessions_included' => $payment->total_sessions,
                    'status' => $payment->status
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ Error procesando pago semanal unificado: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error procesando pago'
            ], 500);
        }
    }

    /**
     * 🔄 ACTUALIZADO: PAGOS PENDIENTES
     */
    public function getPendingPayments()
    {
        try {
            $user = Auth::user();
            
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Acceso denegado - Solo modelos'
                ], 403);
            }

            $pendingPayments = WeeklyPayment::where('model_user_id', $user->id)
                ->where('status', 'pending')
                ->orderBy('processed_at', 'desc')
                ->get()
                ->map(function ($payment) {
                    return [
                        'id' => $payment->id,
                        'week_start' => $payment->week_start->format('d/m/Y'),
                        'week_end' => $payment->week_end->format('d/m/Y'),
                        'week_range' => $payment->week_start->format('d/m/Y') . ' - ' . $payment->week_end->format('d/m/Y'),
                        'amount' => round($payment->amount, 2),
                        'time_earnings' => round($payment->time_earnings ?? 0, 2),
                        'gift_earnings' => round($payment->gift_earnings ?? 0, 2),
                        'total_sessions' => $payment->total_sessions,
                        'status' => $payment->status,
                        'processed_at' => $payment->processed_at ? $payment->processed_at->format('d/m/Y H:i') : null,
                        'days_pending' => $payment->processed_at ? $payment->processed_at->diffInDays(now()) : 0
                    ];
                });

            return response()->json([
                'success' => true,
                'pending_payments' => $pendingPayments,
                'total_pending' => round($pendingPayments->sum('amount'), 2),
                'pending_count' => $pendingPayments->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo pagos pendientes unificados: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * 🔄 ACTUALIZADO: HISTORIAL DE PAGOS
     */
    public function getPaymentHistory()
    {
        try {
            $user = Auth::user();
            
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Acceso denegado - Solo modelos'
                ], 403);
            }

            $paidPayments = WeeklyPayment::where('model_user_id', $user->id)
                ->where('status', 'paid')
                ->with(['paidBy'])
                ->orderBy('paid_at', 'desc')
                ->paginate(20);

            $formattedPayments = $paidPayments->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'week_range' => $payment->week_start->format('d/m/Y') . ' - ' . $payment->week_end->format('d/m/Y'),
                    'amount' => round($payment->amount, 2),
                    'time_earnings' => round($payment->time_earnings ?? 0, 2),
                    'gift_earnings' => round($payment->gift_earnings ?? 0, 2),
                    'total_sessions' => $payment->total_sessions,
                    'payment_method' => $payment->payment_method,
                    'payment_reference' => $payment->payment_reference,
                    'paid_at' => $payment->paid_at->format('d/m/Y H:i'),
                    'paid_by' => $payment->paidBy ? $payment->paidBy->name : 'Sistema'
                ];
            });

            return response()->json([
                'success' => true,
                'payment_history' => $formattedPayments,
                'pagination' => [
                    'current_page' => $paidPayments->currentPage(),
                    'last_page' => $paidPayments->lastPage(),
                    'total' => $paidPayments->total()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo historial de pagos unificado: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ⏱️ ACTUALIZAR DURACIÓN MANUAL (SIN CAMBIOS)
     */
    public function updateSessionDuration(Request $request)
    {
        try {
            $request->validate([
                'session_id' => 'required|string',
                'duration_seconds' => 'required|integer|min:0|max:21600'
            ]);

            $sessionIdentifier = $request->session_id;
            $durationSeconds = (int) $request->duration_seconds;

            // Buscar sesión
            $session = null;
            
            if (is_numeric($sessionIdentifier)) {
                $session = VideoChatSession::find($sessionIdentifier);
            }
            
            if (!$session) {
                $session = VideoChatSession::where('room_name', $sessionIdentifier)
                    ->orderBy('created_at', 'desc')
                    ->first();
            }

            if (!$session) {
                return response()->json([
                    'success' => false,
                    'error' => 'Sesión no encontrada'
                ], 404);
            }

            // Actualizar con duración manual
            $session->update([
                'actual_duration_seconds' => $durationSeconds,
                'is_manual_duration' => true,
                'updated_at' => now()
            ]);

            // Recalcular ganancias si existe session_earning
            $sessionEarning = SessionEarning::where('session_id', $session->id)->first();
            
            if ($sessionEarning) {
                $timeEarnings = $this->calculateTimeEarnings($durationSeconds);
                
                $sessionEarning->update([
                    'session_duration_seconds' => $durationSeconds,
                    'qualifying_session' => $timeEarnings['qualifying'],
                    'model_time_earnings' => $timeEarnings['model_earnings'],
                    'model_total_earnings' => $timeEarnings['model_earnings'] + $sessionEarning->model_gift_earnings
                ]);
            }

            Log::info('⏱️ [UNIFICADO] Duración manual actualizada', [
                'session_id' => $session->id,
                'new_duration' => $durationSeconds,
                'earnings_updated' => $sessionEarning ? 'yes' : 'no'
            ]);

            return response()->json([
                'success' => true,
                'session_id' => $session->id,
                'duration_seconds' => $durationSeconds,
                'duration_formatted' => floor($durationSeconds / 60) . ' min',
                'is_manual' => true,
                'earnings_recalculated' => $sessionEarning ? true : false
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error actualizando duración manual: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }
}