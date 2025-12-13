<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SessionEarning;
use App\Models\WeeklyPayment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB; // 🔥 AGREGAR ESTE USE
use App\Http\Controllers\SessionEarningsController;

class ProcessWeeklyPayments extends Command
{
    protected $signature = 'payments:process-weekly {--dry-run} {--force}';
    protected $description = 'Procesar pagos semanales respetando el pago mínimo configurado';

    public function handle()
    {
        try {
            $isDryRun = $this->option('dry-run');
            
            $this->info('🔄 Iniciando procesamiento de pagos con PAGO MÍNIMO...');
            if ($isDryRun) {
                $this->warn('🧪 MODO DRY-RUN: No se crearán pagos reales');
            }

            // 🔥 OBTENER TODOS LOS MODELOS ACTIVOS CON MÉTODO DE PAGO
            $models = User::where('rol', 'modelo')
                ->whereNotNull('payment_method')
                ->where('payment_method_verified', true)
                ->get();

            if ($models->isEmpty()) {
                $this->info('📭 No hay modelos con métodos de pago verificados');
                return 0;
            }

            $this->info("👩‍💼 Modelos a procesar: {$models->count()}");

            $processed = 0;
            $skipped = 0;
            $errors = 0;

            foreach ($models as $model) {
                try {
                    $result = $this->processModelWithMinimumPayout($model, $isDryRun);
                    
                    if ($result === 'processed') {
                        $processed++;
                    } elseif ($result === 'skipped') {
                        $skipped++;
                    }

                } catch (\Exception $e) {
                    $errors++;
                    $this->error("❌ Error procesando modelo {$model->name} (ID: {$model->id}): " . $e->getMessage());
                    Log::error('Error procesando modelo en comando', [
                        'model_id' => $model->id,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            $this->info("✅ Procesamiento completado:");
            $this->info("   - Pagos procesados: {$processed}");
            $this->info("   - Modelos sin mínimo: {$skipped}");
            $this->info("   - Errores: {$errors}");

            return 0;

        } catch (\Exception $e) {
            $this->error('❌ Error crítico: ' . $e->getMessage());
            Log::error('Error crítico en comando de pagos', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }
    }

    private function processModelWithMinimumPayout(User $model, bool $isDryRun = false)
    {
        // 🔥 OBTENER PAGO MÍNIMO CONFIGURADO
        $minimumPayout = $model->minimum_payout ?? 40.00;

        // 🔥 CALCULAR SALDO ACUMULADO (SOLO ganancias SIN weekly_payment_id)
        $accumulatedEarnings = SessionEarning::where('model_user_id', $model->id)
            ->whereNull('weekly_payment_id') // ✅ SOLO las que NO están asociadas a ningún pago
            ->get();

        if ($accumulatedEarnings->isEmpty()) {
            $this->line("⏭️ {$model->name}: No hay ganancias acumuladas sin procesar");
            return 'skipped';
        }

        $totalEarnings = $accumulatedEarnings->sum('model_total_earnings');
        $totalSessions = $accumulatedEarnings->count();

        $this->line("🔍 {$model->name}:");
        $this->line("   - Saldo acumulado: $" . number_format($totalEarnings, 2));
        $this->line("   - Mínimo requerido: $" . number_format($minimumPayout, 2));
        $this->line("   - Sesiones sin procesar: {$totalSessions}");

        // 🔥 VERIFICAR SI ALCANZA EL MÍNIMO
        if ($totalEarnings < $minimumPayout) {
            $remaining = $minimumPayout - $totalEarnings;
            $this->line("   ⏳ No alcanza mínimo (faltan $" . number_format($remaining, 2) . ")");
            return 'skipped';
        }

        if ($isDryRun) {
            $weekStart = now()->startOfWeek()->toDateString();
            $existingWeekPayment = WeeklyPayment::where('model_user_id', $model->id)
                ->where('week_start', $weekStart)
                ->first();
                
            if ($existingWeekPayment) {
                $this->info("   ✅ [DRY-RUN] Se actualizaría pago existente: $" . number_format($existingWeekPayment->amount + $totalEarnings, 2));
            } else {
                $this->info("   ✅ [DRY-RUN] Se crearía nuevo pago semanal: $" . number_format($totalEarnings, 2));
            }
            return 'processed';
        }

        // 🔥 VERIFICAR SI YA EXISTE UN PAGO PARA ESTA SEMANA
        $weekStart = now()->startOfWeek()->toDateString();
        $weekEnd = now()->endOfWeek()->toDateString();
        
        $existingWeekPayment = WeeklyPayment::where('model_user_id', $model->id)
            ->where('week_start', $weekStart)
            ->first();

        if ($existingWeekPayment) {
            if ($existingWeekPayment->status === 'paid') {
                $this->line("   ⏭️ Ya existe un pago PAGADO para esta semana (${$existingWeekPayment->amount})");
                return 'skipped';
            }
            
            // ✅ ACTUALIZAR EL PAGO EXISTENTE DE LA SEMANA
            $newAmount = $existingWeekPayment->amount + $totalEarnings;
            $existingWeekPayment->update([
                'gross_amount' => $newAmount,
                'amount' => $newAmount,
                'total_sessions' => $existingWeekPayment->total_sessions + $totalSessions,
                'processed_at' => now()
            ]);
            
            $payment = $existingWeekPayment;
            $this->info("   🔄 Pago de la semana actualizado (nuevo total: $" . number_format($newAmount, 2) . ")");
            
        } else {
            // ✅ CREAR NUEVO PAGO PARA LA SEMANA
            $paymentData = [
                'model_user_id' => $model->id,
                'week_start' => $weekStart,
                'week_end' => $weekEnd,
                'gross_amount' => round($totalEarnings, 2),
                'stripe_fee' => 0,
                'amount' => round($totalEarnings, 2),
                'total_sessions' => $totalSessions,
                'status' => 'pending',
                'payment_method' => null,
                'payment_reference' => null,
                'paid_at' => null,
                'paid_by' => null,
                'processed_at' => now()
            ];
            
            $payment = WeeklyPayment::create($paymentData);
            $this->info("   ✅ Nuevo pago semanal creado (ID: {$payment->id})");
        }

        // 🔥 MARCAR GANANCIAS COMO ASOCIADAS A ESTE PAGO CON TRANSACCIÓN
        $updatedEarnings = 0;
        $updateErrors = [];
        
        DB::transaction(function () use ($accumulatedEarnings, $payment, &$updatedEarnings, &$updateErrors) {
            foreach ($accumulatedEarnings as $earning) {
                try {
                    $result = $earning->update(['weekly_payment_id' => $payment->id]);
                    if ($result) {
                        $updatedEarnings++;
                        $this->line("      ✅ Ganancia ID {$earning->id} asociada correctamente");
                    } else {
                        $updateErrors[] = "Ganancia ID {$earning->id} - Update retornó false";
                        $this->error("      ❌ Ganancia ID {$earning->id} - Update falló");
                    }
                } catch (\Exception $e) {
                    $updateErrors[] = "Ganancia ID {$earning->id} - Error: " . $e->getMessage();
                    $this->error("      ❌ Ganancia ID {$earning->id} - Error: " . $e->getMessage());
                }
            }
        });
        
        $this->line("   📝 Ganancias asociadas exitosamente: {$updatedEarnings} de {$accumulatedEarnings->count()}");
        
        if (!empty($updateErrors)) {
            $this->error("   ❌ Errores encontrados:");
            foreach ($updateErrors as $error) {
                $this->error("      - {$error}");
            }
        }
        
        // ✅ VERIFICAR QUE SE ASOCIARON CORRECTAMENTE (forzar recarga desde DB)
        $associatedCount = DB::table('session_earnings')
            ->where('weekly_payment_id', $payment->id)
            ->count();
        $this->line("   ✅ Total asociadas al pago (verificación directa): {$associatedCount}");
        
        // 🔍 VERIFICACIÓN ADICIONAL: Intentar con SQL directo si falló
        if ($associatedCount === 0 && $updatedEarnings > 0) {
            $this->warn("   ⚠️ Update con Eloquent falló, intentando con SQL directo...");
            
            $earningIds = $accumulatedEarnings->pluck('id')->toArray();
            $this->line("   🔍 IDs a actualizar: " . implode(', ', $earningIds));
            
            try {
                $directUpdateCount = DB::table('session_earnings')
                    ->whereIn('id', $earningIds)
                    ->update(['weekly_payment_id' => $payment->id]);
                
                $this->info("   ✅ SQL directo actualizó {$directUpdateCount} registros");
                
                // Verificar de nuevo
                $finalCount = SessionEarning::where('weekly_payment_id', $payment->id)->count();
                $this->info("   ✅ Verificación final: {$finalCount} registros asociados");
                
            } catch (\Exception $e) {
                $this->error("   ❌ Error con SQL directo: " . $e->getMessage());
            }
        }

        $this->info("   💰 Monto: $" . number_format($payment->amount, 2) . " (TODO el saldo acumulado)");
        $this->info("   📝 Ganancias asociadas al pago ID: {$payment->id}");

        Log::info('💰 Pago semanal creado automáticamente con MÍNIMO', [
            'payment_id' => $payment->id,
            'model_user_id' => $model->id,
            'model_name' => $model->name,
            'accumulated_amount' => $payment->amount,
            'minimum_payout' => $minimumPayout,
            'sessions_included' => $totalSessions,
            'status' => 'pending_admin_approval',
            'earnings_ids' => $accumulatedEarnings->pluck('id')->toArray()
        ]);

        return 'processed';
    }
}