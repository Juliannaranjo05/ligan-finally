<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\SessionEarning;
use App\Models\GiftTransaction;
use App\Models\UserGiftCoins;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MigrateToUnifiedEarnings extends Command
{
    protected $signature = 'earnings:migrate-unified {--dry-run : Solo mostrar lo que se haría sin ejecutar}';
    protected $description = 'Migra datos existentes al sistema unificado de ganancias';

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        
        if ($dryRun) {
            $this->info('🔍 MODO DRY-RUN - Solo mostrando cambios sin ejecutar');
        }
        
        $this->info('🚀 Iniciando migración al sistema unificado...');
        
        // 1. Migrar regalos existentes que no están en session_earnings
        $this->migrateExistingGifts($dryRun);
        
        // 2. Limpiar User.balance y recalcular desde session_earnings
        $this->recalculateUserBalances($dryRun);
        
        // 3. Verificar integridad
        $this->verifyDataIntegrity();
        
        $this->info('✅ Migración completada');
    }
    
    private function migrateExistingGifts($dryRun)
    {
        $this->info('🎁 Migrando regalos existentes...');
        
        // Obtener transacciones de regalos que no tienen session_earning asociado
        $giftTransactions = GiftTransaction::whereNotExists(function ($query) {
            $query->select(DB::raw(1))
                ->from('session_earnings')
                ->whereRaw('session_earnings.session_id = CONCAT("gift_", gift_transactions.id)')
                ->orWhereRaw('session_earnings.session_id = gift_transactions.reference_id');
        })->get();

        $this->info("📊 Encontradas {$giftTransactions->count()} transacciones de regalos sin session_earning");
        
        if (!$dryRun && $giftTransactions->count() > 0) {
            $bar = $this->output->createProgressBar($giftTransactions->count());
            $bar->start();
        }
        
        foreach ($giftTransactions as $transaction) {
            if ($dryRun) {
                $senderName = $transaction->sender->name ?? 'Usuario eliminado';
                $receiverName = $transaction->receiver->name ?? 'Usuario eliminado';
                $amount = number_format($transaction->amount, 2);
                $this->line("  - Regalo ID {$transaction->id}: {$senderName} → {$receiverName} (\${$amount})");
                continue;
            }
            
            try {
                // Crear session_earning para este regalo
                SessionEarning::create([
                    'session_id' => 'migrated_gift_' . $transaction->id,
                    'model_user_id' => $transaction->receiver_id,
                    'client_user_id' => $transaction->sender_id,
                    'room_name' => $transaction->room_name ?: 'migrated_gift',
                    'source_type' => $this->determineGiftSourceType($transaction),
                    'session_duration_seconds' => 0,
                    'qualifying_session' => true,
                    'total_time_coins_spent' => 0,
                    'total_gifts_coins_spent' => $transaction->amount,
                    'total_coins_spent' => $transaction->amount,
                    'client_usd_spent' => $this->calculateUSDFromGiftCoins($transaction->amount),
                    'stripe_commission' => 0,
                    'after_stripe_amount' => $this->calculateUSDFromGiftCoins($transaction->amount),
                    'model_time_earnings' => 0,
                    'model_gift_earnings' => $transaction->amount_modelo ?? ($transaction->amount * 0.60),
                    'model_total_earnings' => $transaction->amount_modelo ?? ($transaction->amount * 0.60),
                    'platform_time_earnings' => 0,
                    'platform_gift_earnings' => $transaction->amount_commission ?? ($transaction->amount * 0.40),
                    'platform_total_earnings' => $transaction->amount_commission ?? ($transaction->amount * 0.40),
                    'gift_count' => 1,
                    'gift_details' => json_encode([[
                        'gift_name' => $transaction->gift->name ?? 'Regalo migrado',
                        'gift_price' => $transaction->amount,
                        'transaction_id' => $transaction->id,
                        'migrated_from' => 'gift_transactions'
                    ]]),
                    'session_started_at' => $transaction->created_at,
                    'session_ended_at' => $transaction->created_at,
                    'processed_at' => $transaction->created_at,
                    'created_at' => $transaction->created_at,
                    'updated_at' => $transaction->updated_at
                ]);
                
                if (!$dryRun) {
                    $bar->advance();
                }
                
            } catch (\Exception $e) {
                $this->error("❌ Error migrando regalo ID {$transaction->id}: {$e->getMessage()}");
            }
        }
        
        if (!$dryRun && $giftTransactions->count() > 0) {
            $bar->finish();
            $this->newLine();
        }
        
        $this->info("✅ Regalos migrados: {$giftTransactions->count()}");
    }
    
    private function recalculateUserBalances($dryRun)
    {
        $this->info('💰 Recalculando balances de usuarios...');
        
        $models = User::where('rol', 'modelo')->get();
        
        $this->info("📊 Procesando {$models->count()} modelos");
        
        if (!$dryRun && $models->count() > 0) {
            $bar = $this->output->createProgressBar($models->count());
            $bar->start();
        }
        
        foreach ($models as $model) {
            $oldBalance = $model->balance ?? 0;
            
            // Calcular nuevo balance desde session_earnings
            $newBalance = SessionEarning::where('model_user_id', $model->id)
                ->whereNull('weekly_payment_id')
                ->sum('model_total_earnings');
            
            if ($dryRun) {
                // 🔥 LÍNEA CORREGIDA - Evitar conflicto con $
                $this->line(sprintf("  - %s: Balance actual $%.2f → Nuevo $%.2f", 
                    $model->name, 
                    $oldBalance, 
                    $newBalance
                ));
                continue;
            }
            
            try {
                // ❌ NO TOCAR User.balance - Se calculará dinámicamente
                // Pero actualizar total_earned si es necesario
                $totalEarned = SessionEarning::where('model_user_id', $model->id)
                    ->sum('model_total_earnings');
                
                if ($totalEarned > ($model->total_earned ?? 0)) {
                    $model->update(['total_earned' => $totalEarned]);
                }
                
                $bar->advance();
                
            } catch (\Exception $e) {
                $this->error("❌ Error actualizando modelo ID {$model->id}: {$e->getMessage()}");
            }
        }
        
        if (!$dryRun && $models->count() > 0) {
            $bar->finish();
            $this->newLine();
        }
        
        $this->info("✅ Balances recalculados para {$models->count()} modelos");
    }
    
    private function verifyDataIntegrity()
    {
        $this->info('🔍 Verificando integridad de datos...');
        
        // Verificar que no hay session_earnings duplicados
        $duplicates = DB::select("
            SELECT model_user_id, session_id, COUNT(*) as count 
            FROM session_earnings 
            GROUP BY model_user_id, session_id 
            HAVING COUNT(*) > 1
        ");
        
        if (count($duplicates) > 0) {
            $this->warn("⚠️  Encontrados " . count($duplicates) . " session_earnings duplicados");
            foreach ($duplicates as $dup) {
                $this->line("  - Modelo {$dup->model_user_id}, Sesión {$dup->session_id}: {$dup->count} registros");
            }
        } else {
            $this->info("✅ Sin duplicados en session_earnings");
        }
        
        // Verificar modelos sin ganancias
        $modelsWithoutEarnings = User::where('rol', 'modelo')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('session_earnings')
                    ->whereRaw('session_earnings.model_user_id = users.id');
            })
            ->count();
        
        $this->info("📊 Modelos sin ganancias registradas: {$modelsWithoutEarnings}");
        
        // Verificar total de ganancias
        $totalEarnings = SessionEarning::sum('model_total_earnings');
        $this->info("💰 Total de ganancias en sistema unificado: $" . number_format($totalEarnings, 2));
        
        $unpaidEarnings = SessionEarning::whereNull('weekly_payment_id')->sum('model_total_earnings');
        $this->info("🏦 Total de ganancias sin pagar: $" . number_format($unpaidEarnings, 2));
    }
    
    private function determineGiftSourceType($transaction)
    {
        if (str_contains($transaction->source ?? '', 'videochat')) {
            return 'video_session';
        } elseif (str_contains($transaction->transaction_type ?? '', 'videochat')) {
            return 'video_session';
        } elseif ($transaction->room_name && str_contains($transaction->room_name, 'chat_user_')) {
            return 'chat_gift';
        } else {
            return 'direct_gift';
        }
    }
    
    private function calculateUSDFromGiftCoins($giftCoins)
    {
        // Usar lógica similar al controlador principal
        try {
            $packages = \App\Models\CoinPackage::where('is_active', true)
                ->where('type', 'gifts')
                ->get();

            if ($packages->isEmpty()) {
                return round($giftCoins * 0.15, 2);
            }

            $totalCost = 0;
            $totalCoins = 0;

            foreach ($packages as $package) {
                $packageCoins = $package->coins + ($package->bonus_coins ?? 0);
                $totalCost += $package->regular_price;
                $totalCoins += $packageCoins;
            }

            $averageCost = $totalCoins > 0 ? ($totalCost / $totalCoins) : 0.15;
            return round($giftCoins * $averageCost, 2);
        } catch (\Exception $e) {
            return round($giftCoins * 0.15, 2);
        }
    }
}