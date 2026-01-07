<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\CoinTransaction;
use App\Models\CoinPurchase;
use App\Models\CoinConsumption;
use App\Models\GiftTransaction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DeleteRickyTransactions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'transactions:delete-ricky';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Elimina todas las transacciones del usuario Ricky';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔍 Buscando usuario Ricky...');

        // Buscar usuario por nombre o email
        $user = User::where('name', 'LIKE', '%Ricky%')
            ->orWhere('name', 'LIKE', '%ricky%')
            ->orWhere('email', 'LIKE', '%ricky%')
            ->orWhere('email', 'LIKE', '%Ricky%')
            ->first();

        if (!$user) {
            $this->error('❌ No se encontró ningún usuario con el nombre o email "Ricky"');
            return 1;
        }

        $this->info("✅ Usuario encontrado: {$user->name} (ID: {$user->id}, Email: {$user->email})");

        // Confirmar antes de eliminar
        if (!$this->confirm('¿Estás seguro de que deseas eliminar TODAS las transacciones de este usuario?', true)) {
            $this->info('❌ Operación cancelada');
            return 0;
        }

        $this->info('🗑️  Eliminando transacciones...');

        DB::beginTransaction();

        try {
            // Contar transacciones antes de eliminar
            $coinTransactionsCount = CoinTransaction::where('user_id', $user->id)->count();
            $coinPurchasesCount = CoinPurchase::where('user_id', $user->id)->count();
            $coinConsumptionsCount = CoinConsumption::where('user_id', $user->id)->count();
            $giftTransactionsSentCount = GiftTransaction::where('sender_id', $user->id)->count();
            $giftTransactionsReceivedCount = GiftTransaction::where('receiver_id', $user->id)->count();

            $this->info("📊 Transacciones encontradas:");
            $this->line("   - Coin Transactions: {$coinTransactionsCount}");
            $this->line("   - Coin Purchases: {$coinPurchasesCount}");
            $this->line("   - Coin Consumptions: {$coinConsumptionsCount}");
            $this->line("   - Gift Transactions (enviados): {$giftTransactionsSentCount}");
            $this->line("   - Gift Transactions (recibidos): {$giftTransactionsReceivedCount}");

            // Eliminar transacciones
            $deletedCoinTransactions = CoinTransaction::where('user_id', $user->id)->delete();
            $deletedCoinPurchases = CoinPurchase::where('user_id', $user->id)->delete();
            $deletedCoinConsumptions = CoinConsumption::where('user_id', $user->id)->delete();
            $deletedGiftTransactionsSent = GiftTransaction::where('sender_id', $user->id)->delete();
            $deletedGiftTransactionsReceived = GiftTransaction::where('receiver_id', $user->id)->delete();

            DB::commit();

            $this->info('✅ Transacciones eliminadas exitosamente:');
            $this->line("   - Coin Transactions: {$deletedCoinTransactions}");
            $this->line("   - Coin Purchases: {$deletedCoinPurchases}");
            $this->line("   - Coin Consumptions: {$deletedCoinConsumptions}");
            $this->line("   - Gift Transactions (enviados): {$deletedGiftTransactionsSent}");
            $this->line("   - Gift Transactions (recibidos): {$deletedGiftTransactionsReceived}");

            $totalDeleted = $deletedCoinTransactions + $deletedCoinPurchases + 
                          $deletedCoinConsumptions + $deletedGiftTransactionsSent + 
                          $deletedGiftTransactionsReceived;

            $this->info("🎉 Total de transacciones eliminadas: {$totalDeleted}");

            return 0;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('❌ Error al eliminar transacciones: ' . $e->getMessage());
            return 1;
        }
    }
}




