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
use App\Services\PlatformSettingsService;

class SessionEarningsController extends Controller
{
    // 🔥 CONSTANTES ACTUALIZADAS - Ahora se obtienen dinámicamente desde PlatformSettingsService
    // Se mantienen como fallback por compatibilidad, pero se usan los valores dinámicos
    // 30 USD/hora = 0.50 USD/minuto total (20 USD modelo + 10 USD plataforma)
    const MODEL_EARNINGS_PER_MINUTE = 0.333; // Fallback (20 USD/hora / 60 minutos)
    const PLATFORM_EARNINGS_PER_MINUTE = 0.167; // Fallback (10 USD/hora / 60 minutos)
    const COINS_PER_MINUTE = 10; // Fallback

    /**
     * 🔥 NUEVO MÉTODO UNIFICADO: PROCESAR GANANCIAS POR TIEMPO
     */
    public function processSessionEarnings($sessionId, $modelUserId, $clientUserId, $roomName, $actualDurationSeconds = null)
    {
        // 🔒 LOCK PARA EVITAR PROCESAMIENTO DUPLICADO
        $lockKey = "process_earnings_{$sessionId}_{$modelUserId}_{$clientUserId}";
        $lock = \Illuminate\Support\Facades\Cache::lock($lockKey, 30); // 30 segundos de lock
        
        if (!$lock->get()) {
            Log::warning('⚠️ [UNIFICADO] Procesamiento de ganancias ya en curso, ignorando duplicado', [
                'session_id' => $sessionId,
                'lock_key' => $lockKey
            ]);
            return false;
        }

        try {
            Log::info('🧮 [UNIFICADO] Procesando ganancias de sesión', [
                'session_id' => $sessionId,
                'model_user_id' => $modelUserId,
                'client_user_id' => $clientUserId,
                'actual_duration_seconds' => $actualDurationSeconds
            ]);

            // 🔒 VALIDACIONES BÁSICAS
            if (!$modelUserId || !$clientUserId || !$roomName) {
                Log::error('❌ [UNIFICADO] Parámetros inválidos', [
                    'model_user_id' => $modelUserId,
                    'client_user_id' => $clientUserId,
                    'room_name' => $roomName
                ]);
                return false;
            }

            // 🔒 TRANSACCIÓN DE BASE DE DATOS PARA GARANTIZAR CONSISTENCIA
            DB::beginTransaction();

            // 🔍 BUSCAR/CREAR SESIÓN
            $session = $this->findOrCreateSession($sessionId, $modelUserId, $clientUserId, $roomName, $actualDurationSeconds);
            
            if (!$session) {
                DB::rollBack();
                Log::error('❌ No se pudo crear/encontrar la sesión: ' . $sessionId);
                return false;
            }

            // 🔒 PROTECCIÓN: RESPETAR DURACIÓN MANUAL
            $durationSeconds = $this->getDurationSeconds($session, $actualDurationSeconds);
            
            // 🔒 VALIDAR DURACIÓN
            if ($durationSeconds <= 0) {
                DB::rollBack();
                Log::warning('⚠️ [UNIFICADO] Duración inválida, ignorando', [
                    'duration_seconds' => $durationSeconds
                ]);
                return false;
            }
            
            // 💰 CALCULAR GANANCIAS POR TIEMPO
            $timeEarnings = $this->calculateTimeEarnings($durationSeconds);
            
            // 🔒 VALIDAR GANANCIAS CALCULADAS
            if (!isset($timeEarnings['model_earnings']) || !isset($timeEarnings['platform_earnings'])) {
                DB::rollBack();
                Log::error('❌ [UNIFICADO] Error calculando ganancias', [
                    'time_earnings' => $timeEarnings
                ]);
                return false;
            }
            
            // 🔄 CREAR O ACTUALIZAR SESSION_EARNINGS
            $this->createOrUpdateSessionEarning(
                $session,
                $modelUserId,
                $clientUserId,
                $roomName,
                $durationSeconds,
                $timeEarnings
            );

            // 🔒 COMMIT TRANSACCIÓN (la actualización de billetera se hace dentro de createOrUpdateSessionEarning)
            DB::commit();
            
            Log::info('✅ [UNIFICADO] Ganancias de sesión procesadas', [
                'session_id' => $session->id,
                'duration_seconds' => $durationSeconds,
                'time_earnings' => $timeEarnings['model_earnings'],
                'platform_earnings' => $timeEarnings['platform_earnings'],
                'qualifying' => $timeEarnings['qualifying']
            ]);

            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ Error procesando ganancias unificadas: ' . $e->getMessage(), [
                'session_id' => $sessionId,
                'model_user_id' => $modelUserId,
                'client_user_id' => $clientUserId,
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        } finally {
            // 🔒 LIBERAR LOCK
            $lock->release();
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

            // Obtener comisión de regalos dinámicamente
            $giftCommissionPercentage = PlatformSettingsService::getInteger('gift_commission_percentage', 40);
            $platformCommissionRate = $giftCommissionPercentage / 100;
            $modelRate = 1 - $platformCommissionRate;
            
            $modelGiftEarnings = round($giftValue * $modelRate, 2);
            $platformGiftEarnings = round($giftValue * $platformCommissionRate, 2);


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
     * 🎁 OBTENER SALDO DE REGALOS Y MINUTOS PARA MODELO (ENDPOINT ESPECÍFICO PARA VIDEOCHAT)
     */
    public function getModelVideoChatBalance(Request $request)
    {
        try {
            $user = Auth::user();
            
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo modelos pueden consultar este balance'
                ], 403);
            }

            // 🔥 OBTENER SALDO DEL CLIENTE (el usuario con quien está hablando la modelo)
            $roomName = $request->input('room_name');
            $clientUserIdProvided = $request->input('client_user_id');
            
            // 🔥 VERIFICAR SI EL client_user_id PROPORCIONADO ES VÁLIDO (debe ser cliente, no modelo)
            $clientUserId = null;
            if ($clientUserIdProvided) {
                $providedUser = \App\Models\User::find($clientUserIdProvided);
                if ($providedUser && $providedUser->rol === 'cliente' && $providedUser->id != $user->id) {
                    $clientUserId = $clientUserIdProvided;
                    Log::info('✅ [getModelVideoChatBalance] Cliente válido proporcionado:', ['client_id' => $clientUserId]);
                } else {
                    Log::warning('⚠️ [getModelVideoChatBalance] client_user_id proporcionado no es válido:', [
                        'provided_id' => $clientUserIdProvided,
                        'is_cliente' => $providedUser ? ($providedUser->rol === 'cliente') : false,
                        'is_modelo' => $providedUser ? ($providedUser->id == $user->id) : false
                    ]);
                }
            }
            
            // Si no se proporciona client_user_id válido, intentar encontrarlo desde la sesión
            if (!$clientUserId && $roomName) {
                // Buscar en ChatSession
                $session = \App\Models\ChatSession::where('room_name', $roomName)
                    ->where('modelo_id', $user->id)
                    ->whereIn('status', ['active', 'connected', 'ongoing', 'calling', 'waiting'])
                    ->first();
                
                if ($session) {
                    $clientUserId = $session->cliente_id;
                    Log::info('✅ [getModelVideoChatBalance] Cliente encontrado en ChatSession:', ['client_id' => $clientUserId]);
                } else {
                    // Intentar extraer desde roomName: "call_{caller_id}_{receiver_id}_{timestamp}"
                    if (preg_match('/call_(\d+)_(\d+)_/', $roomName, $matches)) {
                        $callerId = (int)$matches[1];
                        $receiverId = (int)$matches[2];
                        
                        // Si la modelo es el receiver, el cliente es el caller
                        // Si la modelo es el caller, el cliente es el receiver
                        if ($receiverId == $user->id) {
                            $clientUserId = $callerId;
                        } elseif ($callerId == $user->id) {
                            $clientUserId = $receiverId;
                        }
                        
                        if ($clientUserId) {
                            // Verificar que realmente sea un cliente
                            $extractedUser = \App\Models\User::find($clientUserId);
                            if ($extractedUser && $extractedUser->rol === 'cliente') {
                                Log::info('✅ [getModelVideoChatBalance] Cliente extraído del roomName:', [
                                    'room_name' => $roomName,
                                    'caller_id' => $callerId,
                                    'receiver_id' => $receiverId,
                                    'modelo_id' => $user->id,
                                    'client_id' => $clientUserId
                                ]);
                            } else {
                                $clientUserId = null;
                                Log::warning('⚠️ [getModelVideoChatBalance] ID extraído del roomName no es cliente:', [
                                    'extracted_id' => $clientUserId,
                                    'rol' => $extractedUser ? $extractedUser->rol : 'no encontrado'
                                ]);
                            }
                        }
                    }
                }
            }
            
            if (!$clientUserId) {
                return response()->json([
                    'success' => true,
                    'gift_balance' => 0,
                    'remaining_minutes' => 0,
                    'client_id' => null
                ]);
            }
            
            // 🔥 USAR LA MISMA LÓGICA QUE EL CLIENTE: UserCoins con available_minutes
            $clientCoins = \App\Models\UserCoins::where('user_id', $clientUserId)->first();
            
            if (!$clientCoins) {
                $clientCoins = \App\Models\UserCoins::create([
                    'user_id' => $clientUserId,
                    'purchased_balance' => 0,
                    'gift_balance' => 0,
                    'total_purchased' => 0,
                    'total_consumed' => 0
                ]);
            }
            
            // 🔥 USAR LOS MISMOS ACCESSORS QUE USA EL CLIENTE
            $remainingMinutes = $clientCoins->available_minutes; // Igual que getMyBalanceQuick
            $giftBalance = $clientCoins->gift_balance; // Saldo de regalos del cliente
            
            Log::info('✅ [getModelVideoChatBalance] Balance del cliente calculado:', [
                'modelo_id' => $user->id,
                'client_id' => $clientUserId,
                'purchased_balance' => $clientCoins->purchased_balance,
                'gift_balance' => $giftBalance,
                'total_balance' => $clientCoins->total_balance,
                'remaining_minutes' => $remainingMinutes
            ]);
            
            return response()->json([
                'success' => true,
                'gift_balance' => $giftBalance, // Saldo de regalos del cliente
                'remaining_minutes' => $remainingMinutes, // Minutos disponibles del cliente (igual que el cliente)
                'client_id' => $clientUserId,
                'debug' => [
                    'purchased_balance' => $clientCoins->purchased_balance,
                    'gift_balance' => $giftBalance,
                    'total_balance' => $clientCoins->total_balance
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('❌ Error obteniendo balance de videochat para modelo: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error al obtener balance'
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
                        'can_request_payout' => $currentBalance >= ($user->minimum_payout ?? 40.00),
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

        // 🔥 Obtener valores dinámicos desde PlatformSettingsService
        // 30 USD/hora = 0.50 USD/minuto total
        // 20 USD/hora para modelo = 0.333 USD/minuto
        // 10 USD/hora para plataforma = 0.167 USD/minuto
        $earningsPerMinute = PlatformSettingsService::getDecimal('earnings_per_minute', 0.333);
        $platformEarningsPerMinute = PlatformSettingsService::getDecimal('platform_earnings_per_minute', 0.167);
        $coinsPerMinute = PlatformSettingsService::getInteger('coins_per_minute', 10);
        
        $modelEarnings = $qualifyingSession ? round($payableMinutes * $earningsPerMinute, 2) : 0;
        $platformEarnings = $qualifyingSession ? round($payableMinutes * $platformEarningsPerMinute, 2) : 0;
        $theoreticalCoinsConsumed = ceil($payableMinutes * $coinsPerMinute);
        
        return [
            'qualifying' => $qualifyingSession,
            'payable_minutes' => $payableMinutes,
            'model_earnings' => $modelEarnings,
            'platform_earnings' => $platformEarnings,
            'theoretical_coins' => $theoreticalCoinsConsumed
        ];
    }

    private function createOrUpdateSessionEarning($session, $modelUserId, $clientUserId, $roomName, $durationSeconds, $timeEarnings)
    {
        // 🔒 USAR LOCK FOR UPDATE PARA EVITAR RACE CONDITIONS
        $existingEarning = SessionEarning::lockForUpdate()
            ->where('session_id', $session->id)
            ->where('model_user_id', $modelUserId)
            ->where('client_user_id', $clientUserId)
            ->first();

        $earningData = [
            'source_type' => 'video_session',
            'session_duration_seconds' => $durationSeconds,
            'qualifying_session' => $timeEarnings['qualifying'],
            'model_time_earnings' => $timeEarnings['model_earnings'],
            'model_total_earnings' => $timeEarnings['model_earnings'], // Se suma con regalos si los hay
            'platform_time_earnings' => $timeEarnings['platform_earnings'],
            'platform_total_earnings' => $timeEarnings['platform_earnings'], // Se suma con regalos si los hay
            'total_time_coins_spent' => $timeEarnings['theoretical_coins'],
            'total_coins_spent' => $timeEarnings['theoretical_coins'],
            'session_started_at' => $session->started_at,
            'session_ended_at' => $session->ended_at,
            'processed_at' => now()
        ];

        if ($existingEarning) {
            // Mantener ganancias de regalos existentes
            $earningData['model_total_earnings'] = $timeEarnings['model_earnings'] + $existingEarning->model_gift_earnings;
            $earningData['platform_total_earnings'] = $timeEarnings['platform_earnings'] + ($existingEarning->platform_gift_earnings ?? 0);
            
            // 🔥 CALCULAR DIFERENCIA DE GANANCIAS PARA ACTUALIZAR BILLETERA (evitar duplicados)
            $earningsDifference = $timeEarnings['model_earnings'] - ($existingEarning->model_time_earnings ?? 0);
            
            $existingEarning->update($earningData);
            
            // 🔥 ACTUALIZAR BILLETERA DE LA MODELO SOLO CON LA DIFERENCIA
            if ($earningsDifference > 0) {
                $this->updateModelWallet($modelUserId, $earningsDifference);
            }
            
            Log::info('💰 [UNIFICADO] Session earning actualizado', [
                'earning_id' => $existingEarning->id,
                'time_earnings' => $timeEarnings['model_earnings'],
                'platform_earnings' => $timeEarnings['platform_earnings'],
                'earnings_difference' => $earningsDifference,
                'total_earnings' => $earningData['model_total_earnings']
            ]);
        } else {
            $newEarning = SessionEarning::create(array_merge($earningData, [
                'session_id' => $session->id,
                'model_user_id' => $modelUserId,
                'client_user_id' => $clientUserId,
                'room_name' => $roomName,
                'model_gift_earnings' => 0,
                'platform_gift_earnings' => 0,
                'gift_count' => 0
            ]));
            
            // 🔥 ACTUALIZAR BILLETERA DE LA MODELO
            $this->updateModelWallet($modelUserId, $timeEarnings['model_earnings']);
            
            Log::info('💰 [UNIFICADO] Nuevo session earning creado', [
                'earning_id' => $newEarning->id,
                'time_earnings' => $timeEarnings['model_earnings'],
                'platform_earnings' => $timeEarnings['platform_earnings']
            ]);
        }
    }

    /**
     * 🔥 ACTUALIZAR BILLETERA DE LA MODELO CON GANANCIAS POR TIEMPO
     * 🔒 CON LOCK Y VALIDACIONES PARA EVITAR RACE CONDITIONS Y DUPLICADOS
     */
    private function updateModelWallet($modelUserId, $earningsAmount)
    {
        // 🔒 VALIDACIÓN INICIAL
        if ($earningsAmount <= 0 || !is_numeric($earningsAmount)) {
            Log::warning('⚠️ [WALLET] Monto inválido, ignorando actualización', [
                'model_user_id' => $modelUserId,
                'earnings_amount' => $earningsAmount
            ]);
            return false;
        }

        // 🔒 LOCK PARA EVITAR RACE CONDITIONS
        $lockKey = "update_wallet_{$modelUserId}";
        $lock = \Illuminate\Support\Facades\Cache::lock($lockKey, 10); // 10 segundos de lock
        
        if (!$lock->get()) {
            Log::warning('⚠️ [WALLET] Actualización de billetera ya en curso, reintentando...', [
                'model_user_id' => $modelUserId
            ]);
            // Reintentar después de 100ms
            usleep(100000);
            return $this->updateModelWallet($modelUserId, $earningsAmount);
        }

        try {
            // 🔒 USAR LOCK FOR UPDATE PARA EVITAR RACE CONDITIONS EN BD
            $model = User::lockForUpdate()->find($modelUserId);
            
            if (!$model) {
                Log::error('❌ [WALLET] Modelo no encontrada para actualizar billetera', [
                    'model_user_id' => $modelUserId
                ]);
                return false;
            }

            // 🔒 VALIDAR QUE EL MODELO SEA REALMENTE UNA MODELO
            if ($model->rol !== 'modelo' && $model->role !== 'modelo') {
                Log::warning('⚠️ [WALLET] Usuario no es modelo, ignorando actualización', [
                    'model_user_id' => $modelUserId,
                    'role' => $model->rol ?? $model->role
                ]);
                return false;
            }

            // 🔒 OBTENER VALORES ACTUALES ANTES DE ACTUALIZAR
            $oldBalance = $model->balance ?? 0;
            $oldTotalEarned = $model->total_earned ?? 0;

            // 🔒 ACTUALIZAR CON VALIDACIÓN
            $model->increment('balance', $earningsAmount);
            $model->increment('total_earned', $earningsAmount);
            $model->last_earning_at = now();
            
            // 🔒 VALIDAR QUE LA ACTUALIZACIÓN FUE EXITOSA
            if (!$model->save()) {
                throw new \Exception('Error al guardar modelo después de actualizar billetera');
            }

            // 🔒 VERIFICAR QUE LOS VALORES SE ACTUALIZARON CORRECTAMENTE
            $model->refresh();
            $newBalance = $model->balance ?? 0;
            $newTotalEarned = $model->total_earned ?? 0;
            
            $actualBalanceIncrease = $newBalance - $oldBalance;
            $actualEarnedIncrease = $newTotalEarned - $oldTotalEarned;

            // 🔒 VALIDAR QUE EL INCREMENTO FUE CORRECTO (con tolerancia de 0.01 por redondeo)
            if (abs($actualBalanceIncrease - $earningsAmount) > 0.01 || abs($actualEarnedIncrease - $earningsAmount) > 0.01) {
                Log::error('❌ [WALLET] Discrepancia en actualización de billetera', [
                    'model_user_id' => $modelUserId,
                    'expected_increase' => $earningsAmount,
                    'actual_balance_increase' => $actualBalanceIncrease,
                    'actual_earned_increase' => $actualEarnedIncrease,
                    'old_balance' => $oldBalance,
                    'new_balance' => $newBalance
                ]);
                // No lanzar excepción, solo loguear para no romper el flujo
            }

            Log::info('💰 [WALLET] Billetera de modelo actualizada exitosamente', [
                'model_user_id' => $modelUserId,
                'earnings_added' => $earningsAmount,
                'old_balance' => $oldBalance,
                'new_balance' => $newBalance,
                'old_total_earned' => $oldTotalEarned,
                'new_total_earned' => $newTotalEarned,
                'balance_increase' => $actualBalanceIncrease,
                'earned_increase' => $actualEarnedIncrease
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('❌ [WALLET] Error actualizando billetera de modelo: ' . $e->getMessage(), [
                'model_user_id' => $modelUserId,
                'earnings_amount' => $earningsAmount,
                'error' => $e->getTraceAsString()
            ]);
            // 🔒 RE-LANZAR EXCEPCIÓN PARA QUE LA TRANSACCIÓN HAGA ROLLBACK
            throw $e;
        } finally {
            // 🔒 LIBERAR LOCK
            $lock->release();
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

    /**
     * 📊 ADMIN: Obtener todos los pagos pendientes (para administradores)
     */
    public function getAllPendingPayments()
    {
        try {
            // Primero obtener pagos pendientes existentes
            $existingPayments = WeeklyPayment::where('status', 'pending')
                ->with(['model:id,name,email,payment_method,account_details,account_holder_name,country,country_name,payment_method_verified'])
                ->orderBy('processed_at', 'desc')
                ->get();

            // Si hay pagos pendientes, retornarlos
            if ($existingPayments->isNotEmpty()) {
                $pendingPayments = $existingPayments->map(function ($payment) {
                    return [
                        'id' => $payment->id,
                        'model_user_id' => $payment->model_user_id,
                        'model_name' => $payment->model->name ?? 'Usuario eliminado',
                        'model_email' => $payment->model->email ?? 'N/A',
                        'week_start' => $payment->week_start->format('d/m/Y'),
                        'week_end' => $payment->week_end->format('d/m/Y'),
                        'week_range' => $payment->week_start->format('d/m/Y') . ' - ' . $payment->week_end->format('d/m/Y'),
                        'amount' => round($payment->amount, 2),
                        'time_earnings' => round($payment->time_earnings ?? 0, 2),
                        'gift_earnings' => round($payment->gift_earnings ?? 0, 2),
                        'total_sessions' => $payment->total_sessions,
                        'status' => $payment->status,
                        'processed_at' => $payment->processed_at ? $payment->processed_at->format('d/m/Y H:i') : null,
                        'days_pending' => $payment->processed_at ? $payment->processed_at->diffInDays(now()) : 0,
                        'payment_method' => $payment->model->payment_method ?? null,
                        'account_details' => $payment->model->account_details ?? null,
                        'account_holder_name' => $payment->model->account_holder_name ?? null,
                        'country' => $payment->model->country ?? null,
                        'country_name' => $payment->model->country_name ?? null,
                        'payment_method_verified' => $payment->model->payment_method_verified ?? false,
                    ];
                });

                return response()->json([
                    'success' => true,
                    'data' => $pendingPayments,
                    'total_pending' => round($pendingPayments->sum('amount'), 2),
                    'pending_count' => $pendingPayments->count()
                ]);
            }

            // Si no hay pagos pendientes, buscar ganancias sin pagar y agruparlas por modelo
            $unpaidEarnings = SessionEarning::whereNull('weekly_payment_id')
                ->with(['model:id,name,email,payment_method,account_details,account_holder_name,country,country_name,payment_method_verified'])
                ->get();

            if ($unpaidEarnings->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'total_pending' => 0,
                    'pending_count' => 0
                ]);
            }

            // Agrupar por modelo
            $groupedByModel = $unpaidEarnings->groupBy('model_user_id');
            $pendingPayments = collect();

            foreach ($groupedByModel as $modelId => $earnings) {
                $model = $earnings->first()->model;
                $oldestEarning = $earnings->min('created_at');
                $newestEarning = $earnings->max('created_at');
                
                $timeEarnings = $earnings->sum('model_time_earnings');
                $giftEarnings = $earnings->sum('model_gift_earnings');
                $totalAmount = $earnings->sum('model_total_earnings');

                $pendingPayments->push([
                    'id' => null, // No tiene ID porque no es un WeeklyPayment aún
                    'model_user_id' => $modelId,
                    'model_name' => $model->name ?? 'Usuario eliminado',
                    'model_email' => $model->email ?? 'N/A',
                    'week_start' => Carbon::parse($oldestEarning)->format('d/m/Y'),
                    'week_end' => Carbon::parse($newestEarning)->format('d/m/Y'),
                    'week_range' => Carbon::parse($oldestEarning)->format('d/m/Y') . ' - ' . Carbon::parse($newestEarning)->format('d/m/Y'),
                    'amount' => round($totalAmount, 2),
                    'time_earnings' => round($timeEarnings, 2),
                    'gift_earnings' => round($giftEarnings, 2),
                    'total_sessions' => $earnings->count(),
                    'status' => 'pending',
                    'processed_at' => Carbon::parse($oldestEarning)->format('d/m/Y H:i'),
                    'days_pending' => Carbon::parse($oldestEarning)->diffInDays(now()),
                    'needs_creation' => true, // Flag para indicar que necesita crear el WeeklyPayment
                    'payment_method' => $model->payment_method ?? null,
                    'account_details' => $model->account_details ?? null,
                    'account_holder_name' => $model->account_holder_name ?? null,
                    'country' => $model->country ?? null,
                    'country_name' => $model->country_name ?? null,
                    'payment_method_verified' => $model->payment_method_verified ?? false,
                ]);
            }

            // Ordenar por fecha más antigua primero
            $pendingPayments = $pendingPayments->sortBy('processed_at')->values();

            return response()->json([
                'success' => true,
                'data' => $pendingPayments,
                'total_pending' => round($pendingPayments->sum('amount'), 2),
                'pending_count' => $pendingPayments->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo pagos pendientes (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ✅ ADMIN: Marcar pago como pagado
     */
    public function markPaymentAsPaid(Request $request, $id)
    {
        try {
            $request->validate([
                'payment_method' => 'required|string|max:255',
                'payment_reference' => 'nullable|string|max:255',
                'model_user_id' => 'nullable|exists:users,id' // Para crear WeeklyPayment si no existe
            ]);

            // Si el ID es "null" o "create", crear el WeeklyPayment primero
            if ($id === 'null' || $id === 'create' || $id === null) {
                if (!$request->has('model_user_id')) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Se requiere model_user_id para crear el pago'
                    ], 400);
                }

                $modelUserId = $request->model_user_id;
                
                // Obtener ganancias sin pagar para este modelo
                $unpaidEarnings = SessionEarning::whereNull('weekly_payment_id')
                    ->where('model_user_id', $modelUserId)
                    ->get();

                if ($unpaidEarnings->isEmpty()) {
                    return response()->json([
                        'success' => false,
                        'error' => 'No hay ganancias pendientes para este modelo'
                    ], 400);
                }

                // Crear WeeklyPayment
                $oldestEarning = $unpaidEarnings->min('created_at');
                $newestEarning = $unpaidEarnings->max('created_at');
                $totalAmount = $unpaidEarnings->sum('model_total_earnings');
                $timeEarnings = $unpaidEarnings->sum('model_time_earnings');
                $giftEarnings = $unpaidEarnings->sum('model_gift_earnings');

                $payment = WeeklyPayment::create([
                    'model_user_id' => $modelUserId,
                    'week_start' => Carbon::parse($oldestEarning)->startOfDay(),
                    'week_end' => Carbon::parse($newestEarning)->endOfDay(),
                    'amount' => round($totalAmount, 2),
                    'time_earnings' => round($timeEarnings, 2),
                    'gift_earnings' => round($giftEarnings, 2),
                    'total_sessions' => $unpaidEarnings->count(),
                    'status' => 'paid', // Marcar directamente como pagado
                    'payment_method' => $request->payment_method,
                    'payment_reference' => $request->payment_reference,
                    'paid_at' => now(),
                    'paid_by' => Auth::id() ?? $request->input('admin_user_id') ?? $request->header('ligand-admin-id'),
                    'processed_at' => now()
                ]);

                // Asociar ganancias al pago
                $unpaidEarnings->each(function ($earning) use ($payment) {
                    $earning->update(['weekly_payment_id' => $payment->id]);
                });

                Log::info('Pago creado y marcado como pagado (admin)', [
                    'payment_id' => $payment->id,
                    'model_user_id' => $modelUserId,
                    'amount' => $totalAmount
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Pago creado y marcado como pagado correctamente',
                    'payment' => [
                        'id' => $payment->id,
                        'status' => $payment->status,
                        'paid_at' => $payment->paid_at->format('d/m/Y H:i')
                    ]
                ]);
            }

            // Si existe el WeeklyPayment, marcarlo como pagado
            $payment = WeeklyPayment::findOrFail($id);

            if ($payment->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'error' => 'Este pago ya ha sido procesado'
                ], 400);
            }

            // Obtener admin_id del request si no hay usuario autenticado
            $adminId = Auth::id() ?? $request->input('admin_user_id') ?? $request->header('ligand-admin-id');

            $payment->markAsPaid(
                $request->payment_method,
                $request->payment_reference,
                $adminId
            );

            Log::info('Pago marcado como pagado (admin)', [
                'payment_id' => $payment->id,
                'model_user_id' => $payment->model_user_id,
                'amount' => $payment->amount,
                'admin_id' => $adminId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pago marcado como pagado correctamente',
                'payment' => [
                    'id' => $payment->id,
                    'status' => $payment->status,
                    'paid_at' => $payment->paid_at->format('d/m/Y H:i')
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error marcando pago como pagado (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * 📊 ADMIN: Estadísticas de ganancias y pagos
     */
    public function getAdminStats()
    {
        try {
            $totalPending = WeeklyPayment::where('status', 'pending')->sum('amount');
            $totalPaid = WeeklyPayment::where('status', 'paid')->sum('amount');
            $pendingCount = WeeklyPayment::where('status', 'pending')->count();
            $paidCount = WeeklyPayment::where('status', 'paid')->count();
            
            // Si no hay pagos pendientes, incluir ganancias sin pagar
            if ($pendingCount === 0) {
                $unpaidEarnings = SessionEarning::whereNull('weekly_payment_id')->get();
                if ($unpaidEarnings->isNotEmpty()) {
                    $totalPending = $unpaidEarnings->sum('model_total_earnings');
                    $pendingCount = $unpaidEarnings->groupBy('model_user_id')->count();
                }
            }
            
            // Pagos de esta semana
            $thisWeekPaid = WeeklyPayment::where('status', 'paid')
                ->whereBetween('paid_at', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()])
                ->sum('amount');
            
            // Pagos de este mes
            $thisMonthPaid = WeeklyPayment::where('status', 'paid')
                ->whereMonth('paid_at', Carbon::now()->month)
                ->whereYear('paid_at', Carbon::now()->year)
                ->sum('amount');

            // Modelos con pagos pendientes o ganancias sin pagar
            $modelsWithPending = WeeklyPayment::where('status', 'pending')
                ->distinct('model_user_id')
                ->count('model_user_id');
            
            // Si no hay pagos pendientes, contar modelos con ganancias sin pagar
            if ($modelsWithPending === 0) {
                $modelsWithPending = SessionEarning::whereNull('weekly_payment_id')
                    ->distinct('model_user_id')
                    ->count('model_user_id');
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'pending' => [
                        'total_amount' => round($totalPending, 2),
                        'count' => $pendingCount,
                        'models_affected' => $modelsWithPending
                    ],
                    'paid' => [
                        'total_amount' => round($totalPaid, 2),
                        'count' => $paidCount,
                        'this_week' => round($thisWeekPaid, 2),
                        'this_month' => round($thisMonthPaid, 2)
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo estadísticas de pagos (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }
}