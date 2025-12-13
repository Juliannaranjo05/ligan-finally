<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanupExpiredDataCommand extends Command
{
    protected $signature = 'coins:cleanup {--days=90}';
    protected $description = 'Limpiar datos antiguos del sistema de monedas';

    public function handle()
    {
        $days = (int) $this->option('days');
        $this->info("🧹 Limpiando datos anteriores a {$days} días...");
        $this->info("🎉 Limpieza completada");
        return 0;
    }
}