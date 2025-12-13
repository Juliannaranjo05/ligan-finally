<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\UserCoins;

class CoinSystemStatsCommand extends Command
{
    protected $signature = 'coins:stats';
    protected $description = 'Mostrar estadísticas del sistema de monedas';

    public function handle()
    {
        $this->info('💰 ESTADÍSTICAS DEL SISTEMA DE MONEDAS');
        
        $totalUsers = UserCoins::count();
        $usersWithCoins = UserCoins::withBalance()->count();
        $totalCoins = UserCoins::sum(\DB::raw('purchased_balance + gift_balance'));

        $this->table(['Métrica', 'Valor'], [
            ['Usuarios totales', number_format($totalUsers)],
            ['Usuarios con monedas', number_format($usersWithCoins)],
            ['Monedas en circulación', number_format($totalCoins)],
        ]);

        return 0;
    }
}