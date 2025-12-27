<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\CoinPackage;

class CoinPackagesSeeder extends Seeder
{
    public function run()
    {
        // PAQUETES DE MINUTOS - Nueva estructura: 1 minuto = 10 monedas
        // Precios base (LATAM): 60 min = $30 USD
        // Para USD/EUR: 60 min = $33 USD (se calcula dinámicamente con pricePerHour=33)
        // Los precios aquí son solo referencia, el cálculo real se hace dinámicamente
        $minutePackages = [
            [
                'name' => '15 Minutos',
                'description' => 'Perfecto para comenzar',
                'type' => 'minutes',
                'minutes' => 15,
                'coins' => 150,
                'bonus_coins' => 0, // Sin bono
                'price' => 7.50, // Precio base LATAM (15/60 * 30)
                'regular_price' => 7.50,
                'original_price' => 7.50,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 1
            ],
            [
                'name' => '30 Minutos',
                'description' => 'Recomendado',
                'type' => 'minutes',
                'minutes' => 30,
                'coins' => 300,
                'bonus_coins' => 30, // 10% de bono (30 monedas gratis)
                'price' => 15.00, // Precio base LATAM (30/60 * 30)
                'regular_price' => 15.00,
                'original_price' => 15.00,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 2
            ],
            [
                'name' => '60 Minutos',
                'description' => 'El más popular',
                'type' => 'minutes',
                'minutes' => 60,
                'coins' => 600,
                'bonus_coins' => 90, // 15% de bono (90 monedas gratis)
                'price' => 30.00, // Precio base LATAM (60/60 * 30)
                'regular_price' => 30.00,
                'original_price' => 30.00,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => true, // MÁS POPULAR
                'sort_order' => 3
            ],
            [
                'name' => '120 Minutos',
                'description' => 'Premium - Alto valor',
                'type' => 'minutes',
                'minutes' => 120,
                'coins' => 1200,
                'bonus_coins' => 240, // 20% de bono (240 monedas gratis)
                'price' => 60.00, // Precio base LATAM (120/60 * 30)
                'regular_price' => 60.00,
                'original_price' => 60.00,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 4
            ]
        ];

        // PAQUETES DE REGALOS (1 moneda = 1 dólar: 20, 40, 80, 120 monedas)
        $giftPackages = [
            [
                'name' => 'Regalo Básico',
                'description' => 'Un pequeño detalle especial',
                'type' => 'gifts',
                'minutes' => 0, // Los regalos no tienen minutos
                'coins' => 20, // 20 monedas
                'bonus_coins' => 0,
                'price' => 20.00, // 1 moneda = 1 dólar
                'regular_price' => 20.00,
                'original_price' => 20.00,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 5
            ],
            [
                'name' => 'Regalo Popular',
                'description' => 'El más elegido para regalar',
                'type' => 'gifts',
                'minutes' => 0,
                'coins' => 40, // 40 monedas
                'bonus_coins' => 0, // Sin bonus
                'price' => 40.00, // 1 moneda = 1 dólar
                'regular_price' => 40.00,
                'original_price' => 40.00,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => true,
                'sort_order' => 6
            ],
            [
                'name' => 'Regalo Premium',
                'description' => 'Un regalo especial y generoso',
                'type' => 'gifts',
                'minutes' => 0,
                'coins' => 80, // 80 monedas
                'bonus_coins' => 0, // Sin bonus
                'price' => 80.00, // 1 moneda = 1 dólar
                'regular_price' => 80.00,
                'original_price' => 80.00,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 7
            ],
            [
                'name' => 'Regalo VIP',
                'description' => 'El regalo más generoso',
                'type' => 'gifts',
                'minutes' => 0,
                'coins' => 120, // 120 monedas
                'bonus_coins' => 0, // Sin bonus
                'price' => 120.00, // 1 moneda = 1 dólar
                'regular_price' => 120.00,
                'original_price' => 120.00,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 8
            ]
        ];

        // Actualizar o crear paquetes de minutos
        foreach ($minutePackages as $package) {
            CoinPackage::updateOrCreate(
                [
                    'name' => $package['name'],
                    'type' => $package['type']
                ],
                $package
            );
        }

        // Actualizar o crear paquetes de regalos
        foreach ($giftPackages as $package) {
            CoinPackage::updateOrCreate(
                [
                    'name' => $package['name'],
                    'type' => $package['type']
                ],
                $package
            );
        }

        $this->command->info('✅ 4 paquetes de minutos actualizados/creados correctamente');
        $this->command->info('✅ 4 paquetes de regalos actualizados/creados correctamente');
        $this->command->info('🎉 Total: 8 paquetes procesados');
    }
}