<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\UserCoins;

class AddCoinsToUserCommand extends Command
{
    protected $signature = 'coins:add {user_id} {amount} {type=purchased}';
    protected $description = 'Agregar monedas a un usuario específico';

    public function handle()
    {
        $userId = $this->argument('user_id');
        $amount = (int) $this->argument('amount');
        $type = $this->argument('type');

        $user = User::find($userId);
        if (!$user) {
            $this->error("Usuario con ID {$userId} no encontrado");
            return 1;
        }

        $userCoins = UserCoins::firstOrCreate(['user_id' => $userId]);
        
        if ($type === 'purchased') {
            $userCoins->purchased_balance += $amount;
        } else {
            $userCoins->gift_balance += $amount;
        }
        
        $userCoins->save();

        $this->info("✅ Se agregaron {$amount} monedas {$type} al usuario {$user->name}");
        $this->info("💰 Nuevo balance: " . ($userCoins->purchased_balance + $userCoins->gift_balance) . " monedas");

        return 0;
    }
}