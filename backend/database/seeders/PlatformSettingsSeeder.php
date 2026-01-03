<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PlatformSetting;

class PlatformSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            // Configuraciones de ganancias
            // 🔥 ACTUALIZADO: 30 USD/hora = 0.50 USD/minuto
            // 20 USD para modelo = 0.333 USD/minuto (20/60)
            // 10 USD para plataforma = 0.167 USD/minuto (10/60)
            [
                'key' => 'earnings_per_minute',
                'value' => '0.333',
                'type' => 'decimal',
                'category' => 'earnings',
                'description' => 'Ganancias por minuto para modelos en videollamadas (20 USD/hora = 0.333 USD/minuto)'
            ],
            [
                'key' => 'platform_earnings_per_minute',
                'value' => '0.167',
                'type' => 'decimal',
                'category' => 'earnings',
                'description' => 'Ganancias por minuto para la plataforma (10 USD/hora = 0.167 USD/minuto)'
            ],
            [
                'key' => 'coins_per_minute',
                'value' => '10',
                'type' => 'integer',
                'category' => 'earnings',
                'description' => 'Monedas consumidas por minuto en videollamadas'
            ],
            [
                'key' => 'default_minimum_payout',
                'value' => '40.00',
                'type' => 'decimal',
                'category' => 'earnings',
                'description' => 'Pago mínimo por defecto para modelos'
            ],
            // Configuraciones de regalos
            [
                'key' => 'gift_commission_percentage',
                'value' => '30',
                'type' => 'integer',
                'category' => 'gifts',
                'description' => 'Porcentaje de comisión de la plataforma en regalos (30% plataforma, 70% modelo)'
            ],
            // Configuraciones de historias
            [
                'key' => 'story_duration_hours',
                'value' => '24',
                'type' => 'integer',
                'category' => 'stories',
                'description' => 'Duración de las historias en horas'
            ],
            // Configuraciones del sistema
            [
                'key' => 'maintenance_mode',
                'value' => 'false',
                'type' => 'boolean',
                'category' => 'system',
                'description' => 'Modo de mantenimiento de la plataforma'
            ],
        ];

        foreach ($settings as $settingData) {
            PlatformSetting::updateOrCreate(
                ['key' => $settingData['key']],
                $settingData
            );
        }
    }
}



