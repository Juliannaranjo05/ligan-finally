<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\CoinPackage;

class CoinPackagesSeeder extends Seeder
{
    public function run()
    {
        // PAQUETES DE MINUTOS - Estrategia de precio ancla + descuento visible
        // Precio regular (ancla) tachado + Precio final (el que se cobra) destacado
        $minutePackages = [
            [
                'name' => 'Ideal para probar',
                'description' => '15 Minutos',
                'type' => 'minutes',
                'minutes' => 15,
                'coins' => 150,
                'bonus_coins' => 0,
                'price' => 6.99,
                'regular_price' => 6.99,
                'original_price' => 6.99,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 1
            ],
            [
                'name' => 'Más tiempo, más conexión',
                'description' => '30 Minutos',
                'type' => 'minutes',
                'minutes' => 30,
                'coins' => 300,
                'bonus_coins' => 0,
                'price' => 12.99,
                'regular_price' => 12.99,
                'original_price' => 12.99,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 2
            ],
            [
                'name' => 'La mejor experiencia',
                'description' => '60 Minutos',
                'type' => 'minutes',
                'minutes' => 60,
                'coins' => 600,
                'bonus_coins' => 0,
                'price' => 22.99,
                'regular_price' => 22.99,
                'original_price' => 22.99,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => true,
                'sort_order' => 3
            ],
            [
                'name' => 'Experiencia Premium',
                'description' => '120 Minutos',
                'type' => 'minutes',
                'minutes' => 120,
                'coins' => 1200,
                'bonus_coins' => 0,
                'price' => 42.99,
                'regular_price' => 42.99,
                'original_price' => 42.99,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 4
            ],
            [
                'name' => 'Power Plan',
                'description' => '250 Minutos',
                'type' => 'minutes',
                'minutes' => 250,
                'coins' => 2500,
                'bonus_coins' => 0,
                'price' => 114.99,
                'regular_price' => 114.99,
                'original_price' => 114.99,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 9
            ],
            [
                'name' => 'Pro Plan',
                'description' => '500 Minutos',
                'type' => 'minutes',
                'minutes' => 500,
                'coins' => 5000,
                'bonus_coins' => 0,
                'price' => 209.99,
                'regular_price' => 209.99,
                'original_price' => 209.99,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 10
            ],
            [
                'name' => 'Elite Plan',
                'description' => '1000 Minutos',
                'type' => 'minutes',
                'minutes' => 1000,
                'coins' => 10000,
                'bonus_coins' => 0,
                'price' => 369.99,
                'regular_price' => 369.99,
                'original_price' => 369.99,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 11
            ],
            [
                'name' => 'VIP Experience',
                'description' => '1500 Minutos',
                'type' => 'minutes',
                'minutes' => 1500,
                'coins' => 15000,
                'bonus_coins' => 0,
                'price' => 459.99,
                'regular_price' => 459.99,
                'original_price' => 459.99,
                'discount_percentage' => 0,
                'is_first_time_only' => false,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 12
            ]
            ,
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

        // Eliminar todos los paquetes de minutos existentes
        CoinPackage::where('type', 'minutes')->delete();
        
        // Eliminar todos los paquetes de regalos existentes
        CoinPackage::where('type', 'gifts')->delete();

        // Crear nuevos paquetes de minutos
        foreach ($minutePackages as $package) {
            CoinPackage::create($package);
        }

        // Crear nuevos paquetes de regalos
        foreach ($giftPackages as $package) {
            CoinPackage::create($package);
        }

        $this->command->info('✅ 8 paquetes de minutos actualizados/creados correctamente');
        $this->command->info('✅ 4 paquetes de regalos actualizados/creados correctamente');
        $this->command->info('🎉 Total: 8 paquetes procesados');
    }
}