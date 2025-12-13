<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\CoinPackage;

class CoinPackagesSeeder extends Seeder
{
    public function run()
    {
        // PAQUETES DE MINUTOS (precio regular + $1 USD cada uno, sin descuentos)
        $minutePackages = [
            [
                'name' => '15 Minutos',
                'description' => 'Perfecto para comenzar',
                'type' => 'minutes',
                'minutes' => 15,
                'coins' => 150,
                'bonus_coins' => 0,
                'price' => 0.50, // Precio regular + $1
                'regular_price' => 0.50, // Mismo precio siempre
                'original_price' => 0.50,
                'discount_percentage' => 0, // Sin descuento
                'is_first_time_only' => false, // No solo primera vez
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 1
            ],
            [
                'name' => '30 Minutos',
                'description' => 'El más popular',
                'type' => 'minutes',
                'minutes' => 30,
                'coins' => 300,
                'bonus_coins' => 30,
                'price' => 13.00, // Precio regular + $1
                'regular_price' => 13.00, // Mismo precio siempre
                'original_price' => 13.00,
                'discount_percentage' => 0, // Sin descuento
                'is_first_time_only' => false, // No solo primera vez
                'is_active' => true,
                'is_popular' => true,
                'sort_order' => 2
            ],
            [
                'name' => '60 Minutos',
                'description' => 'Una hora completa',
                'type' => 'minutes',
                'minutes' => 60,
                'coins' => 600,
                'bonus_coins' => 90,
                'price' => 24.00, // Precio regular + $1
                'regular_price' => 24.00, // Mismo precio siempre
                'original_price' => 24.00,
                'discount_percentage' => 0, // Sin descuento
                'is_first_time_only' => false, // No solo primera vez
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 3
            ],
            [
                'name' => '120 Minutos',
                'description' => 'Dos horas VIP',
                'type' => 'minutes',
                'minutes' => 120,
                'coins' => 1200,
                'bonus_coins' => 240,
                'price' => 42.00, // Precio regular + $1
                'regular_price' => 42.00, // Mismo precio siempre
                'original_price' => 42.00,
                'discount_percentage' => 0, // Sin descuento
                'is_first_time_only' => false, // No solo primera vez
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

        // Crear paquetes de minutos
        foreach ($minutePackages as $package) {
            CoinPackage::create($package);
        }

        // Crear paquetes de regalos
        foreach ($giftPackages as $package) {
            CoinPackage::create($package);
        }

        $this->command->info('✅ 4 paquetes de minutos creados correctamente');
        $this->command->info('✅ 4 paquetes de regalos creados correctamente');
        $this->command->info('🎉 Total: 8 paquetes creados');
    }
}