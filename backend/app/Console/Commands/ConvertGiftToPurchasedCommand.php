<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use App\Models\User;
use App\Models\UserGiftCoins;
use App\Models\UserCoins;
use App\Models\CoinTransaction;

class ConvertGiftToPurchasedCommand extends Command
{
    protected $signature = 'coins:convert-gift {user_id} {amount}';
    protected $description = 'Convertir monedas de regalo a saldo comprado (gift -> purchased) de forma segura';

    public function handle()
    {
        $userId = (int) $this->argument('user_id');
        $amount = (int) $this->argument('amount');

        if ($amount <= 0) {
            $this->error('El monto debe ser mayor que 0');
            return 1;
        }

        $user = User::find($userId);
        if (!$user) {
            $this->error("Usuario con ID {$userId} no encontrado");
            return 1;
        }

        $attempts = 5;
        for ($i = 0; $i < $attempts; $i++) {
            try {
                // Para SQLite, aumentar el timeout para evitar "database is locked"
                DB::statement('PRAGMA busy_timeout = 5000');

                DB::beginTransaction();

                $userGift = UserGiftCoins::firstOrCreate(['user_id' => $userId]);
                $userCoins = UserCoins::firstOrCreate(['user_id' => $userId]);

                if ($userGift->balance < $amount) {
                    DB::rollBack();
                    $this->error("Saldo de gift insuficiente: {$userGift->balance} < {$amount}");
                    return 1;
                }

                // Actualizar balances
                $userGift->balance -= $amount;
                $userGift->total_sent += $amount;
                $userGift->last_sent_at = now();
                $userGift->save();

                $userCoins->gift_balance -= $amount;
                $userCoins->purchased_balance += $amount;
                $userCoins->total_purchased += $amount;
                $userCoins->last_purchase_at = now();
                $userCoins->save();

                // Registrar transacciones
                CoinTransaction::create([
                    'user_id' => $userId,
                    'type' => 'gift',
                    'amount' => -$amount,
                    'source' => 'gift_conversion',
                    'balance_after' => $userGift->balance,
                    'notes' => "Conversion gift->purchased de {$amount} monedas"
                ]);

                CoinTransaction::create([
                    'user_id' => $userId,
                    'type' => 'purchased',
                    'amount' => $amount,
                    'source' => 'gift_conversion',
                    'balance_after' => $userCoins->purchased_balance,
                    'notes' => "Conversion gift->purchased de {$amount} monedas"
                ]);

                DB::commit();

                $this->info("✅ Conversion completada: -{$amount} gift, +{$amount} purchased para {$user->email}");
                return 0;

            } catch (QueryException $e) {
                DB::rollBack();
                // Manejar lock de sqlite (SQLSTATE 5)
                if (strpos($e->getMessage(), 'database is locked') !== false) {
                    $this->warn("Intento {$i}: database is locked, reintentando...");
                    usleep(500000); // 0.5s
                    continue;
                }

                $this->error('Error de consulta: ' . $e->getMessage());
                return 1;

            } catch (\Exception $e) {
                DB::rollBack();
                $this->error('Error: ' . $e->getMessage());
                return 1;
            }
        }

        $this->error('No se pudo completar la conversión después de varios intentos (DB lock persistente)');
        return 1;
    }
}
