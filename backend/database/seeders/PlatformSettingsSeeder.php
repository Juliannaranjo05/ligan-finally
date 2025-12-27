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
            [
                'key' => 'earnings_per_minute',
                'value' => '0.24',
                'type' => 'decimal',
                'category' => 'earnings',
                'description' => 'Ganancias por minuto para modelos en videollamadas'
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
                'value' => '40',
                'type' => 'integer',
                'category' => 'gifts',
                'description' => 'Porcentaje de comisión de la plataforma en regalos'
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



