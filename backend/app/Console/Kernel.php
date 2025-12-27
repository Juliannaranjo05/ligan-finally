<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule)
    {
        $schedule->command('notifications:cleanup')->everyThirtyMinutes();
        
        // 🔥 CADA MINUTO (suficiente para videochat)
        $schedule->command('videochat:process-consumption')
             ->everyMinute()
             ->runInBackground();

        // 🔥 CAMBIAR A DOMINGO A MEDIANOCHE
        $schedule->command('payments:process-weekly')
                 ->weeklyOn(0, '00:00') // ← DOMINGO (0) a las 12:00 AM (medianoche)
                 ->withoutOverlapping()
                 ->timezone('America/Bogota'); // Ajustar a tu zona horaria

        $schedule->command('users:clean-unverified')
        ->hourly()
        ->withoutOverlapping()
        ->runInBackground()
        ->appendOutputTo(storage_path('logs/cleanup.log'));

        // 🔄 Backup diario de base de datos (a las 2 AM)
        $schedule->command('db:backup --compress')
            ->dailyAt('02:00')
            ->withoutOverlapping()
            ->appendOutputTo(storage_path('logs/backup.log'));
    
    }
    
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');
        require base_path('routes/console.php');
    }
}