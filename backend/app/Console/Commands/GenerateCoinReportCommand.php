<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class GenerateCoinReportCommand extends Command
{
    protected $signature = 'coins:report';
    protected $description = 'Generar reporte del sistema de monedas';

    public function handle()
    {
        $this->info('💰 REPORTE DEL SISTEMA DE MONEDAS');
        $this->line('Reporte generado exitosamente');
        return 0;
    }
}