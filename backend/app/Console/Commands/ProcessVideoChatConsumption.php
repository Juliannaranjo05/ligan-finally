<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\VideoChatSession;
use App\Models\ChatSession;
use App\Http\Controllers\VideoChatCoinController;
use App\Http\Controllers\SessionEarningsController;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ProcessVideoChatConsumption extends Command
{
    protected $signature = 'videochat:process-consumption 
                           {--debug : Mostrar información detallada de debug}
                           {--work : Ejecutar continuamente como worker}
                           {--sleep=30 : Segundos de espera entre ejecuciones en modo worker}';
    protected $description = 'Procesar consumo automático de monedas en videochats activos';

    protected $coinController;
    protected $earningsController;
    protected $debugMode = false;

    public function __construct()
    {
        parent::__construct();
        $this->coinController = new VideoChatCoinController();
        $this->earningsController = new SessionEarningsController();
    }

    public function handle()
    {
        $this->debugMode = $this->option('debug');
        $workMode = $this->option('work');
        $sleepTime = (int) $this->option('sleep');

        if ($workMode) {
            $this->info('🔥 INICIANDO WORKER MODE - Procesamiento continuo...');
            $this->info("⏰ Intervalo: {$sleepTime} segundos");
            $this->info('🛑 Presiona Ctrl+C para detener');
            $this->info('================================');
            
            // Ejecutar continuamente
            while (true) {
                try {
                    $this->processSingleExecution();
                    
                    if ($this->debugMode) {
                        $this->info("😴 Esperando {$sleepTime} segundos...\n");
                    }
                    
                    sleep($sleepTime);
                    
                } catch (\Exception $e) {
                    $this->error('💥 Error crítico en worker: ' . $e->getMessage());
                    Log::error('Error crítico en worker mode', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    
                    // Esperar un poco antes de continuar
                    sleep(5);
                }
            }
        } else {
            // Modo normal - una sola ejecución
            return $this->processSingleExecution();
        }
    }

    /**
     * 🔄 Ejecutar una sola iteración del procesamiento
     */
    private function processSingleExecution()
    {
        $startTime = microtime(true);
        
        if (!$this->option('work')) {
            $this->info('🔄 Iniciando procesamiento de consumo de monedas...');
        }
        
        if ($this->debugMode) {
            if (!$this->option('work')) {
                $this->warn('🐛 MODO DEBUG ACTIVADO');
            }
            $this->info('📅 ' . now()->format('H:i:s') . ' - Procesando...');
            if (!$this->option('work')) {
                $this->info('🔧 Configuración actual:');
                $this->info('   - Costo por minuto: ' . VideoChatCoinController::COST_PER_MINUTE);
                $this->info('   - Intervalo mínimo: 25 segundos');
                $this->info('   - Tiempo máximo sesión: 6 horas');
            }
        }

        try {
            // 🔥 1. OBTENER SESIONES ACTIVAS CON DEBUG
            $activeSessions = $this->getActiveVideoSessions();
            
            if ($activeSessions->isEmpty()) {
                if (!$this->option('work')) {
                    $this->info('📭 No hay sesiones activas para procesar');
                }
                
                if ($this->debugMode) {
                    if ($this->option('work')) {
                        $this->comment('📭 Sin sesiones activas');
                    } else {
                        $this->debugNoActiveSessions();
                    }
                }
                
                return 0;
            }

            if (!$this->option('work')) {
                $this->info("📊 Procesando {$activeSessions->count()} sesiones activas");
            } else if ($this->debugMode) {
                $this->info("📊 {$activeSessions->count()} sesiones activas");
            }

            if ($this->debugMode && !$this->option('work')) {
                $this->debugActiveSessionsDetail($activeSessions);
            }

            $processed = 0;
            $errors = 0;
            $sessionsEnded = 0;
            $skipped = 0;

            foreach ($activeSessions as $session) {
                try {
                    if ($this->debugMode) {
                        $this->warn("🔍 PROCESANDO SESIÓN #{$session->id}");
                        $this->info("   Usuario: {$session->user_id}");
                        $this->info("   Room: {$session->room_name}");
                        $this->info("   Iniciada: {$session->started_at}");
                        $lastConsumptionDisplay = $session->last_consumption_at ?? 'NUNCA';
                        $this->info("   Último consumo: {$lastConsumptionDisplay}");
                    }

                    $result = $this->processSessionConsumption($session);
                    
                    if ($result['processed']) {
                        $processed++;
                        if ($this->debugMode) {
                            $this->info("   ✅ PROCESADA - Monedas consumidas");
                        }
                    } elseif ($result['ended']) {
                        $sessionsEnded++;
                        if ($this->debugMode) {
                            $endReason = $result['end_reason'] ?? 'unknown';
                            $this->error("   🛑 FINALIZADA - Razón: {$endReason}");
                        }
                    } else {
                        $skipped++;
                        if ($this->debugMode) {
                            $skipReason = $result['skip_reason'] ?? 'unknown';
                            $this->comment("   ⏭️ OMITIDA - Razón: {$skipReason}");
                        }
                    }
                    
                } catch (\Exception $e) {
                    $errors++;
                    $errorMsg = "❌ Error procesando sesión {$session->id}: " . $e->getMessage();
                    
                    $this->error($errorMsg);
                    
                    Log::error($errorMsg, [
                        'session_id' => $session->id,
                        'user_id' => $session->user_id,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);

                    // Actualizar error en la sesión
                    try {
                        $session->update([
                            'last_error_at' => now(),
                            'last_error_message' => $e->getMessage()
                        ]);
                    } catch (\Exception $updateError) {
                        Log::error('Error actualizando sesión con error info', [
                            'session_id' => $session->id,
                            'update_error' => $updateError->getMessage()
                        ]);
                    }
                }

                if ($this->debugMode) {
                    $this->info(""); // Línea en blanco para separar
                }
            }

            $executionTime = round((microtime(true) - $startTime) * 1000, 2);

            if (!$this->option('work')) {
                $this->info("✅ Procesamiento completado:");
                $this->info("   - Sesiones procesadas: {$processed}");
                $this->info("   - Sesiones omitidas: {$skipped}");
                $this->info("   - Sesiones finalizadas: {$sessionsEnded}");
                $this->info("   - Errores: {$errors}");
                $this->info("   - Tiempo: {$executionTime}ms");
            } else if ($processed > 0 || $sessionsEnded > 0 || $errors > 0) {
                $this->info("✅ [" . now()->format('H:i:s') . "] P:{$processed} | S:{$skipped} | F:{$sessionsEnded} | E:{$errors} | {$executionTime}ms");
            }

            if ($this->debugMode && !$this->option('work')) {
                $this->debugFinalStats($processed, $skipped, $sessionsEnded, $errors);
            }

            return 0;

        } catch (\Exception $e) {
            $this->error('❌ Error crítico: ' . $e->getMessage());
            
            if ($this->debugMode) {
                $this->error('🐛 Stack trace:');
                $this->error($e->getTraceAsString());
            }
            
            Log::error('Error crítico en procesamiento de consumo', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return 1;
        }
    }

    /**
     * 🔍 Obtener sesiones activas de videochat con debug
     */
    private function getActiveVideoSessions()
    {
        if ($this->debugMode) {
            $this->info('🔍 Buscando sesiones activas...');
            
            // Contar todas las sesiones por estado
            $allCounts = VideoChatSession::select('status', DB::raw('count(*) as count'))
                ->groupBy('status')
                ->get()
                ->pluck('count', 'status');
            
            $this->info('📊 Estados de todas las sesiones:');
            foreach ($allCounts as $status => $count) {
                $this->info("   - {$status}: {$count}");
            }
        }

        $query = VideoChatSession::where('status', 'active')
            ->where('is_consuming', true)
            ->where('user_role', 'cliente')
            ->where('started_at', '>=', now()->subHours(6));

        if ($this->debugMode) {
            $this->info('🔍 Aplicando filtros:');
            $this->info('   - status = active');
            $this->info('   - is_consuming = true');
            $this->info('   - user_role = cliente');
            $this->info('   - started_at >= ' . now()->subHours(6)->toISOString());
            
            $countAfterFilters = (clone $query)->count();
            $this->info("📊 Sesiones que cumplen filtros: {$countAfterFilters}");
        }

        return $query->with(['user'])->get();
    }

    /**
     * 💰 Procesar consumo de una sesión con debug detallado
     */
    private function processSessionConsumption($session)
    {
        $result = ['processed' => false, 'ended' => false, 'skip_reason' => null, 'end_reason' => null];

        Log::info('🔄 Procesando consumo para sesión', [
            'session_id' => $session->id,
            'user_id' => $session->user_id,
            'room_name' => $session->room_name,
            'debug_mode' => $this->debugMode
        ]);

        // 🔥 1. CALCULAR TIEMPO DESDE ÚLTIMO CONSUMO
        $lastConsumption = $session->last_consumption_at ?? $session->started_at;
        $timeSinceLastConsumption = now()->diffInSeconds($lastConsumption);

        if ($this->debugMode) {
            $this->info("   ⏰ Análisis temporal:");
            $this->info("     - Último consumo: {$lastConsumption}");
            $this->info("     - Tiempo actual: " . now()->toISOString());
            $this->info("     - Segundos transcurridos: {$timeSinceLastConsumption}");
            $this->info("     - Minutos transcurridos: " . round($timeSinceLastConsumption / 60, 2));
        }

        // Verificar intervalo mínimo
        if ($timeSinceLastConsumption < 25) {
            $result['skip_reason'] = "timing_too_soon_{$timeSinceLastConsumption}s";
            
            if ($this->debugMode) {
                $this->comment("   ⏰ MUY PRONTO - Faltan " . (25 - $timeSinceLastConsumption) . " segundos");
            }
            
            Log::info('⏰ Aún no es tiempo de consumir', [
                'session_id' => $session->id,
                'seconds_since_last' => $timeSinceLastConsumption,
                'required_minimum' => 25
            ]);
            
            return $result;
        }

        // 🔥 2. VERIFICAR QUE LA SESIÓN DE CHAT SIGUE ACTIVA
        if ($this->debugMode) {
            $this->info("   🔍 Verificando sesión de chat...");
        }

        $chatSession = $this->findAndDebugChatSession($session);

        if (!$chatSession) {
            $result['ended'] = true;
            $result['end_reason'] = 'chat_session_not_found';
            
            if ($this->debugMode) {
                $this->error("   🛑 NO SE ENCONTRÓ CHAT SESSION ACTIVA");
            }
            
            Log::info('🛑 Chat session no activa - finalizando videochat session', [
                'session_id' => $session->id,
                'room_name' => $session->room_name
            ]);
            
            $this->endVideoSession($session, 'chat_session_ended');
            return $result;
        }

        if ($this->debugMode) {
            $this->info("   ✅ Chat session encontrada: #{$chatSession->id}");
            $this->info("     - Estado: {$chatSession->status}");
            $this->info("     - Cliente: {$chatSession->cliente_id}");
            $this->info("     - Modelo: {$chatSession->modelo_id}");
        }

        // 🔥 3. CALCULAR MONEDAS A CONSUMIR
        $minutesToConsume = $timeSinceLastConsumption / 60;
        $coinsToConsume = ceil($minutesToConsume * VideoChatCoinController::COST_PER_MINUTE);

        if ($this->debugMode) {
            $this->info("   💰 Cálculo de consumo:");
            $this->info("     - Minutos a consumir: " . round($minutesToConsume, 3));
            $this->info("     - Costo por minuto: " . VideoChatCoinController::COST_PER_MINUTE);
            $this->info("     - Monedas a consumir: {$coinsToConsume}");
        }

        Log::info('💰 Calculando consumo', [
            'session_id' => $session->id,
            'minutes_to_consume' => round($minutesToConsume, 2),
            'coins_to_consume' => $coinsToConsume,
            'seconds_since_last' => $timeSinceLastConsumption
        ]);

        // 🔥 4. VERIFICAR SALDO Y PROCESAR CONSUMO
        if ($this->debugMode) {
            $this->info("   🏦 Verificando saldo del usuario...");
        }

        $balanceCheck = $this->coinController->canStartVideoChat($session->user_id);
        
        if ($this->debugMode) {
            $totalBalance = $balanceCheck['total_balance'] ?? 'N/A';
            $this->info("   💳 Estado del saldo:");
            $this->info("     - Puede iniciar: " . ($balanceCheck['can_start'] ? 'SÍ' : 'NO'));
            $this->info("     - Saldo total: {$totalBalance}");
            $this->info("     - Requerido: {$coinsToConsume}");
            $this->info("     - Suficiente: " . (($balanceCheck['total_balance'] ?? 0) >= $coinsToConsume ? 'SÍ' : 'NO'));
        }
        
        if (!$balanceCheck['can_start'] || ($balanceCheck['total_balance'] ?? 0) < $coinsToConsume) {
            $result['ended'] = true;
            $result['end_reason'] = 'insufficient_balance';
            
            if ($this->debugMode) {
                $this->error("   🚫 SALDO INSUFICIENTE");
            }
            
            Log::warning('🚫 Saldo insuficiente - finalizando sesión', [
                'session_id' => $session->id,
                'user_id' => $session->user_id,
                'current_balance' => $balanceCheck['total_balance'] ?? 0,
                'required' => $coinsToConsume
            ]);

            $this->endVideoSession($session, 'insufficient_balance');
            return $result;
        }

        // 🔥 5. PROCESAR EL CONSUMO
        if ($this->debugMode) {
            $this->info("   🔄 Procesando consumo...");
        }

        try {
            $consumptionResult = $this->coinController->processConsumption(
                $session->user_id,
                $session->room_name,
                $minutesToConsume,
                $coinsToConsume,
                $session->session_id
            );

            if ($this->debugMode) {
                $this->info("   📋 Resultado del consumo:");
                $this->info("     - Éxito: " . ($consumptionResult['success'] ? 'SÍ' : 'NO'));
                if (isset($consumptionResult['remaining_balance'])) {
                    $remainingBalance = $consumptionResult['remaining_balance'];
                    $this->info("     - Saldo restante: {$remainingBalance}");
                }
                if (isset($consumptionResult['error'])) {
                    $errorMsg = $consumptionResult['error'];
                    $this->error("     - Error: {$errorMsg}");
                }
            }

            if ($consumptionResult['success']) {
                // Actualizar sesión
                $oldTotalConsumed = $session->total_consumed;
                
                $session->update([
                    'last_consumption_at' => now(),
                    'total_consumed' => $session->total_consumed + $coinsToConsume,
                    'consumption_count' => ($session->consumption_count ?? 0) + 1
                ]);

                if ($this->debugMode) {
                    $this->info("   📊 Sesión actualizada:");
                    $this->info("     - Total anterior: {$oldTotalConsumed}");
                    $this->info("     - Total actual: " . ($oldTotalConsumed + $coinsToConsume));
                    $this->info("     - Consumos realizados: " . (($session->consumption_count ?? 0) + 1));
                    $this->info("     - Último consumo: " . now()->toISOString());
                }

                Log::info('✅ Consumo procesado exitosamente', [
                    'session_id' => $session->id,
                    'coins_consumed' => $coinsToConsume,
                    'total_consumed' => $session->total_consumed + $coinsToConsume,
                    'remaining_balance' => $consumptionResult['remaining_balance']
                ]);

                $result['processed'] = true;

                // 🔥 6. VERIFICAR SI EL SALDO ES MUY BAJO
                $remainingBalance = $consumptionResult['remaining_balance'] ?? 0;
                $remainingMinutes = floor($remainingBalance / VideoChatCoinController::COST_PER_MINUTE);
                
                if ($this->debugMode) {
                    $this->info("   ⏳ Tiempo restante: {$remainingMinutes} minutos");
                }
                
                if ($remainingMinutes <= 1) {
                    if ($this->debugMode) {
                        $this->warn("   ⚠️ SALDO MUY BAJO - Enviando notificación");
                    }
                    
                    Log::warning('⚠️ Saldo muy bajo - notificar usuario', [
                        'session_id' => $session->id,
                        'user_id' => $session->user_id,
                        'remaining_minutes' => $remainingMinutes
                    ]);

                    $this->notifyLowBalance($session->user_id, $remainingMinutes);
                }

            } else {
                if ($this->debugMode) {
                    $this->error("   ❌ FALLO EN EL CONSUMO");
                }
                
                Log::error('❌ Error procesando consumo', [
                    'session_id' => $session->id,
                    'error' => $consumptionResult['error'] ?? 'Unknown error'
                ]);
            }

        } catch (\Exception $e) {
            if ($this->debugMode) {
                $this->error("   💥 EXCEPCIÓN: " . $e->getMessage());
            }
            
            Log::error('💥 Excepción procesando consumo', [
                'session_id' => $session->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            throw $e; // Re-lanzar para que se maneje en el nivel superior
        }

        return $result;
    }

    /**
     * 🔍 Buscar y debuggear sesión de chat
     */
    private function findAndDebugChatSession($session)
    {
        if ($this->debugMode) {
            $this->info("     🔍 Buscando por room_name: {$session->room_name}");
        }

        // Búsqueda principal
        $chatSession = ChatSession::where('room_name', $session->room_name)
            ->where('status', 'active')
            ->where(function($query) use ($session) {
                $query->where('cliente_id', $session->user_id)
                      ->orWhere('modelo_id', $session->user_id);
            })
            ->first();

        if ($this->debugMode && !$chatSession) {
            $this->comment("     🔍 No encontrada en búsqueda principal, buscando alternativas...");
            
            // Buscar todas las sesiones de chat para este room
            $allChatSessions = ChatSession::where('room_name', $session->room_name)->get();
            
            $this->info("     📊 Todas las chat sessions para room '{$session->room_name}':");
            if ($allChatSessions->isEmpty()) {
                $this->comment("       - Ninguna encontrada");
            } else {
                foreach ($allChatSessions as $cs) {
                    $this->info("       - ID: {$cs->id}, Estado: {$cs->status}, Cliente: {$cs->cliente_id}, Modelo: {$cs->modelo_id}");
                }
            }

            // Buscar por usuario sin importar room
            $userChatSessions = ChatSession::where(function($query) use ($session) {
                $query->where('cliente_id', $session->user_id)
                      ->orWhere('modelo_id', $session->user_id);
            })
            ->where('status', 'active')
            ->get();

            $this->info("     📊 Chat sessions activas para usuario {$session->user_id}:");
            if ($userChatSessions->isEmpty()) {
                $this->comment("       - Ninguna encontrada");
            } else {
                foreach ($userChatSessions as $cs) {
                    $this->info("       - ID: {$cs->id}, Room: {$cs->room_name}, Estado: {$cs->status}");
                }
            }
        }

        return $chatSession;
    }

    /**
     * 🛑 Finalizar sesión de videochat con debug
     */
    private function endVideoSession($session, $reason)
    {
        try {
            if ($this->debugMode) {
                $this->error("   🛑 FINALIZANDO SESIÓN");
                $this->info("     - Razón: {$reason}");
                $this->info("     - Tiempo activa: " . $session->started_at->diffForHumans());
                $this->info("     - Total consumido: {$session->total_consumed}");
            }

            Log::info('🛑 Finalizando sesión de videochat', [
                'session_id' => $session->id,
                'user_id' => $session->user_id,
                'room_name' => $session->room_name,
                'reason' => $reason,
                'total_consumed' => $session->total_consumed,
                'duration_minutes' => $session->started_at->diffInMinutes(now())
            ]);

            // Finalizar sesión de videochat
            $session->update([
                'status' => 'ended',
                'ended_at' => now(),
                'is_consuming' => false,
                'end_reason' => $reason
            ]);

            // 🔥 PROCESAR GANANCIAS PARA LA MODELO
            $this->processSessionEarnings($session);

            // 🔥 FINALIZAR SESIÓN DE CHAT TAMBIÉN
            $chatSession = ChatSession::where('room_name', $session->room_name)
                ->whereIn('status', ['active', 'waiting'])
                ->first();

            if ($chatSession) {
                $chatSession->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => $reason
                ]);

                if ($this->debugMode) {
                    $this->info("     ✅ Chat session #{$chatSession->id} también finalizada");
                }

                Log::info('✅ Chat session también finalizada', [
                    'chat_session_id' => $chatSession->id
                ]);
            }

        } catch (\Exception $e) {
            if ($this->debugMode) {
                $this->error("     💥 ERROR FINALIZANDO: " . $e->getMessage());
            }
            
            Log::error('❌ Error finalizando sesión', [
                'session_id' => $session->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * 💰 Procesar ganancias de la sesión
     */
    private function processSessionEarnings($session)
    {
        try {
            $chatSession = ChatSession::where('room_name', $session->room_name)->first();
            
            if ($chatSession && $chatSession->modelo_id && $chatSession->cliente_id) {
                // 🔥 VERIFICAR PRIMERO SI YA HAY DURACIÓN MANUAL (NO SOBRESCRIBIR)
                $actualDurationSeconds = null;
                
                // 🔒 PASO 1: VERIFICAR SI YA EXISTE DURACIÓN MANUAL (PRIORIDAD MÁXIMA)
                $currentSession = $session->fresh(); // Obtener datos frescos de la BD
                
                if ($currentSession->actual_duration_seconds && $currentSession->actual_duration_seconds > 0) {
                    // 🚨 HAY DURACIÓN MANUAL - NO TOCAR NUNCA
                    $actualDurationSeconds = $currentSession->actual_duration_seconds;
                    
                    Log::info('🔒 [MANUAL] Duración manual detectada - NO MODIFICAR', [
                        'session_id' => $session->id,
                        'manual_duration' => $actualDurationSeconds,
                        'minutes' => round($actualDurationSeconds / 60, 2),
                        'source' => 'manual_from_frontend'
                    ]);
                    
                    // ✅ NO hacer ningún cálculo ni actualización
                    
                } elseif ($session->ended_at && $session->started_at) {
                    // 🔧 PASO 2: SOLO SI NO HAY MANUAL, calcular automáticamente
                    Log::info('🔍 [AUTO] No hay duración manual, calculando automáticamente', [
                        'session_id' => $session->id
                    ]);
                    
                    $calculatedDuration = $session->ended_at->diffInSeconds($session->started_at);
                    
                    // 🛡️ VALIDACIÓN DE SEGURIDAD
                    if ($calculatedDuration > 3600) { // > 1 hora = bug probable
                        Log::error('🚨 [SEGURIDAD] Duración calculada excesiva - usando fallback', [
                            'session_id' => $session->id,
                            'calculated_duration' => $calculatedDuration,
                            'started_at' => $session->started_at->toISOString(),
                            'ended_at' => $session->ended_at->toISOString()
                        ]);
                        
                        // Usar duración desde consumo de monedas (más seguro)
                        $actualDurationSeconds = $this->calculateSafeDurationFromSession($session);
                        
                    } elseif ($calculatedDuration > 0 && $calculatedDuration <= 3600) {
                        // Duración razonable
                        $actualDurationSeconds = $calculatedDuration;
                        
                        Log::info('✅ [AUTO] Duración calculada válida', [
                            'session_id' => $session->id,
                            'calculated_duration' => $actualDurationSeconds,
                            'calculated_minutes' => round($actualDurationSeconds / 60, 2),
                            'source' => 'timestamps_auto'
                        ]);
                        
                    } else {
                        // Duración inválida
                        Log::warning('⚠️ [AUTO] Duración calculada inválida, usando fallback', [
                            'session_id' => $session->id,
                            'invalid_duration' => $calculatedDuration
                        ]);
                        
                        $actualDurationSeconds = $this->calculateSafeDurationFromSession($session);
                    }
                    
                    // 🔒 GUARDAR DURACIÓN CALCULADA AUTOMÁTICAMENTE SOLO SI NO HAY MANUAL
                    try {
                        // 🚨 VERIFICAR NUEVAMENTE QUE NO HAY DURACIÓN MANUAL
                        $freshSession = VideoChatSession::find($session->id);
                        
                        if (!$freshSession->actual_duration_seconds || $freshSession->actual_duration_seconds <= 0) {
                            $freshSession->update(['actual_duration_seconds' => $actualDurationSeconds]);
                            Log::info('💾 [AUTO] Duración automática guardada - NO HAY MANUAL');
                        } else {
                            Log::info('🛡️ [PROTECCIÓN] Duración manual detectada durante procesamiento - NO SOBRESCRIBIR', [
                                'existing_manual' => $freshSession->actual_duration_seconds,
                                'would_be_auto' => $actualDurationSeconds
                            ]);
                            // Usar la duración manual que se encontró
                            $actualDurationSeconds = $freshSession->actual_duration_seconds;
                        }
                    } catch (\Exception $updateError) {
                        Log::error('❌ [AUTO] Error verificando/guardando duración automática: ' . $updateError->getMessage());
                    }
                    
                } else {
                    // Sin timestamps válidos - usar fallback seguro SOLO SI NO HAY MANUAL
                    $freshSession = VideoChatSession::find($session->id);
                    
                    if (!$freshSession->actual_duration_seconds || $freshSession->actual_duration_seconds <= 0) {
                        Log::warning('⚠️ [FALLBACK] Sin timestamps válidos y sin manual, usando método alternativo', [
                            'session_id' => $session->id
                        ]);
                        
                        $actualDurationSeconds = $this->calculateSafeDurationFromSession($session);
                        
                        try {
                            $freshSession->update(['actual_duration_seconds' => $actualDurationSeconds]);
                            Log::info('💾 [FALLBACK] Duración fallback guardada');
                        } catch (\Exception $updateError) {
                            Log::error('❌ [FALLBACK] Error guardando duración: ' . $updateError->getMessage());
                        }
                    } else {
                        // Había duración manual
                        $actualDurationSeconds = $freshSession->actual_duration_seconds;
                        Log::info('🔒 [MANUAL] Duración manual encontrada en fallback', [
                            'manual_duration' => $actualDurationSeconds
                        ]);
                    }
                    
                    if ($this->debugMode) {
                        $this->warn("     ⚠️ [FALLBACK] Sin timestamps, duración final: {$actualDurationSeconds}s");
                    }
                }
                
                // 🔥 LOG FINAL DE AUDITORÍA
                Log::info('📊 [AUDITORÍA] Duración final procesada', [
                    'session_id' => $session->id,
                    'final_duration_seconds' => $actualDurationSeconds,
                    'final_duration_minutes' => round($actualDurationSeconds / 60, 2),
                    'final_duration_formatted' => sprintf('%02d:%02d', 
                        floor($actualDurationSeconds / 60), 
                        $actualDurationSeconds % 60
                    ),
                    'source_type' => $currentSession->actual_duration_seconds > 0 ? 'manual' : 'automatic',
                    'is_qualifying' => $actualDurationSeconds >= 60,
                    'expected_earnings' => $actualDurationSeconds >= 60 ? round(($actualDurationSeconds / 60) * 0.27, 2) : 0
                ]);
                
                if ($this->debugMode) {
                    $source = $currentSession->actual_duration_seconds > 0 ? 'MANUAL' : 'AUTO';
                    $this->info("     ⏱️ [$source] Duración final: {$actualDurationSeconds}s (" . round($actualDurationSeconds / 60, 2) . " min)");
                }
                
                // Procesar ganancias con duración final (ya sea manual o automática)
                $this->earningsController->processSessionEarnings(
                    $session->id,
                    $chatSession->modelo_id,
                    $chatSession->cliente_id,
                    $session->room_name,
                    $actualDurationSeconds
                );

                if ($this->debugMode) {
                    $this->info("     💰 Ganancias procesadas para modelo #{$chatSession->modelo_id}");
                }

                Log::info('💰 Ganancias procesadas', [
                    'session_id' => $session->id,
                    'modelo_id' => $chatSession->modelo_id,
                    'cliente_id' => $chatSession->cliente_id,
                    'final_duration' => $actualDurationSeconds
                ]);
            } else {
                if ($this->debugMode) {
                    $this->comment("     ⚠️ No se pudieron procesar ganancias - falta información");
                }
            }

        } catch (\Exception $e) {
            if ($this->debugMode) {
                $this->error("     💥 ERROR PROCESANDO GANANCIAS: " . $e->getMessage());
            }
            
            Log::error('❌ Error procesando ganancias', [
                'session_id' => $session->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * 🔔 Notificar saldo bajo
     */
    private function notifyLowBalance($userId, $remainingMinutes, $critical = false)
    {
        try {
            $type = $critical ? 'critical_balance_warning' : 'low_balance_warning';
            $urgency = $critical ? 'critical' : 'high';
            
            $message = $critical 
                ? "¡CRÍTICO! Tu sesión terminará automáticamente. Solo tienes {$remainingMinutes} minuto(s) restante(s)"
                : "¡Atención! Solo tienes {$remainingMinutes} minuto(s) restante(s)";

            DB::table('notifications')->insert([
                'user_id' => $userId,
                'type' => $type,
                'data' => json_encode([
                    'message' => $message,
                    'remaining_minutes' => $remainingMinutes,
                    'action' => 'buy_more_coins',
                    'urgency' => $urgency,
                    'critical' => $critical,
                    'auto_close_warning' => $critical
                ]),
                'read' => false,
                'expires_at' => now()->addMinutes($critical ? 2 : 5),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            if ($this->debugMode) {
                $criticalText = $critical ? 'CRÍTICA' : '';
                $this->info("     🔔 Notificación {$criticalText} enviada");
            }

            Log::info("🔔 Notificación de saldo {$type} enviada", [
                'user_id' => $userId,
                'remaining_minutes' => $remainingMinutes,
                'critical' => $critical
            ]);

        } catch (\Exception $e) {
            if ($this->debugMode) {
                $this->error("     💥 ERROR ENVIANDO NOTIFICACIÓN: " . $e->getMessage());
            }
            
            Log::error('❌ Error enviando notificación', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    // ========================= MÉTODOS DE DEBUG =========================

    /**
     * 🐛 Debug cuando no hay sesiones activas
     */
    private function debugNoActiveSessions()
    {
        $this->warn('🐛 DEBUG: Analizando por qué no hay sesiones activas...');
        
        // Contar videochat sessions por estado
        $videoStats = VideoChatSession::select('status', 'user_role', 'is_consuming', DB::raw('count(*) as count'))
            ->groupBy('status', 'user_role', 'is_consuming')
            ->get();

        $this->info('📊 Estado de videochat sessions:');
        foreach ($videoStats as $stat) {
            $this->info("   - {$stat->status} | {$stat->user_role} | consuming: {$stat->is_consuming} = {$stat->count}");
        }

        // Sesiones que podrían ser candidatas
        $candidates = VideoChatSession::where('status', 'active')
            ->where('user_role', 'cliente')
            ->get();

        if ($candidates->count() > 0) {
            $this->info("📋 Sesiones activas de clientes (pero no consuming):");
            foreach ($candidates as $candidate) {
                $this->info("   - ID: {$candidate->id} | User: {$candidate->user_id} | Consuming: {$candidate->is_consuming} | Started: {$candidate->started_at}");
            }
        }

        // Sesiones muy antiguas
        $oldSessions = VideoChatSession::where('status', 'active')
            ->where('started_at', '<', now()->subHours(6))
            ->count();

        if ($oldSessions > 0) {
            $this->comment("⚠️ Hay {$oldSessions} sesiones activas de más de 6 horas");
        }
    }

    /**
     * 🐛 Debug detalle de sesiones activas
     */
    private function debugActiveSessionsDetail($sessions)
    {
        $this->warn('🐛 DEBUG: Detalle de sesiones activas encontradas:');
        
        foreach ($sessions as $session) {
            $lastConsumption = $session->last_consumption_at ?? $session->started_at;
            $timeSince = now()->diffInSeconds($lastConsumption);
            
            $userName = $session->user->name ?? 'N/A';
            $this->info("📋 Sesión #{$session->id}:");
            $this->info("   - Usuario: {$session->user_id} ({$userName})");
            $this->info("   - Room: {$session->room_name}");
            $this->info("   - Iniciada: {$session->started_at} (" . $session->started_at->diffForHumans() . ")");
            $this->info("   - Último consumo: {$lastConsumption}");
            $this->info("   - Segundos desde último: {$timeSince}");
            $this->info("   - Total consumido: {$session->total_consumed}");
            $this->info("   - Listo para procesar: " . ($timeSince >= 25 ? 'SÍ' : 'NO'));
            
            // Verificar chat session correspondiente
            $chatSession = ChatSession::where('room_name', $session->room_name)
                ->where('status', 'active')
                ->first();
            
            if ($chatSession) {
                $this->info("   - Chat session: #{$chatSession->id} (activa)");
            } else {
                $this->comment("   - Chat session: NO ENCONTRADA O INACTIVA");
            }
            
            $this->info("");
        }
    }

    /**
     * 🐛 Debug estadísticas finales
     */
    private function debugFinalStats($processed, $skipped, $ended, $errors)
    {
        $this->warn('🐛 DEBUG: Estadísticas finales detalladas:');
        
        if ($processed > 0) {
            $this->info("✅ Sesiones procesadas correctamente: {$processed}");
        }
        
        if ($skipped > 0) {
            $this->comment("⏭️ Sesiones omitidas: {$skipped}");
            $this->info("   Razones comunes: timing_too_soon, chat_not_ready");
        }
        
        if ($ended > 0) {
            $this->error("🛑 Sesiones finalizadas: {$ended}");
            $this->info("   Razones comunes: insufficient_balance, chat_session_ended");
        }
        
        if ($errors > 0) {
            $this->error("❌ Errores encontrados: {$errors}");
            $this->info("   Revisa los logs para más detalles");
        }

        // Estadísticas de sistema
        $this->info("🔧 Estado del sistema:");
        $this->info("   - Memoria usada: " . round(memory_get_usage(true) / 1024 / 1024, 2) . " MB");
        $this->info("   - Memoria pico: " . round(memory_get_peak_usage(true) / 1024 / 1024, 2) . " MB");
        
        // Verificar próximas sesiones que podrían necesitar procesamiento
        $nextCandidates = VideoChatSession::where('status', 'active')
            ->where('is_consuming', true)
            ->where('user_role', 'cliente')
            ->get()
            ->filter(function($session) {
                $lastConsumption = $session->last_consumption_at ?? $session->started_at;
                $timeSince = now()->diffInSeconds($lastConsumption);
                return $timeSince >= 20 && $timeSince < 25; // Próximas a ser procesadas
            });

        if ($nextCandidates->count() > 0) {
            $this->info("⏰ Próximas sesiones a procesar en < 5 segundos: " . $nextCandidates->count());
            foreach ($nextCandidates as $candidate) {
                $lastConsumption = $candidate->last_consumption_at ?? $candidate->started_at;
                $timeSince = now()->diffInSeconds($lastConsumption);
                $remaining = 25 - $timeSince;
                $this->info("   - Sesión #{$candidate->id}: en {$remaining}s");
            }
        }

        $this->info("🔄 Recomendación: Ejecutar nuevamente en 30 segundos");
    }
    private function calculateSafeDurationFromSession($session)
    {
        try {
            Log::info('🔍 [SAFE] Calculando duración segura', [
                'session_id' => $session->id,
                'total_consumed' => $session->total_consumed ?? 0,
                'consumption_count' => $session->consumption_count ?? 0
            ]);
            
            // MÉTODO 1: Usar consumo total de monedas (10 coins = 1 minuto)
            if ($session->total_consumed && $session->total_consumed > 0) {
                $estimatedSeconds = ($session->total_consumed / 10) * 60;
                
                if ($estimatedSeconds > 0 && $estimatedSeconds <= 3600) {
                    Log::info('✅ [SAFE] Duración desde total_consumed', [
                        'session_id' => $session->id,
                        'total_consumed' => $session->total_consumed,
                        'estimated_seconds' => $estimatedSeconds,
                        'estimated_minutes' => round($estimatedSeconds / 60, 2)
                    ]);
                    return (int) $estimatedSeconds;
                }
            }
            
            // MÉTODO 2: Usar número de consumos (cada 60 segundos aprox)
            if (isset($session->consumption_count) && $session->consumption_count > 0) {
                $estimatedSeconds = $session->consumption_count * 60;
                
                if ($estimatedSeconds <= 3600) {
                    Log::info('✅ [SAFE] Duración desde consumption_count', [
                        'session_id' => $session->id,
                        'consumption_count' => $session->consumption_count,
                        'estimated_seconds' => $estimatedSeconds
                    ]);
                    return (int) $estimatedSeconds;
                }
            }
            
            // MÉTODO 3: Tiempo desde inicio (máximo 1 hora para seguridad)
            if ($session->started_at) {
                $timeFromStart = now()->diffInSeconds($session->started_at);
                
                if ($timeFromStart > 0 && $timeFromStart <= 3600) {
                    Log::info('✅ [SAFE] Duración desde started_at', [
                        'session_id' => $session->id,
                        'time_from_start' => $timeFromStart
                    ]);
                    return (int) $timeFromStart;
                }
            }
            
            // FALLBACK FINAL: 60 segundos por defecto
            Log::warning('⚠️ [SAFE] Usando duración fallback', [
                'session_id' => $session->id,
                'fallback_duration' => 60
            ]);
            return 60;
            
        } catch (\Exception $e) {
            Log::error('❌ [SAFE] Error calculando duración segura: ' . $e->getMessage(), [
                'session_id' => $session->id
            ]);
            return 60; // Fallback ultra-seguro
        }
    }
}