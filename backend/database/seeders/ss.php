<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\MinutePackage;

class MinutePackageSeeder extends Seeder
{
    public function run()
    {
        $packages = [
            [
                'name' => 'Paquete Básico',
                'minutes' => 30,
                'price' => 9.99,
                'currency' => 'USD',
                'description' => 'Perfecto para empezar',
                'bonus_minutes' => 0,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 1
            ],
            [
                'name' => 'Paquete Popular',
                'minutes' => 60,
                'price' => 17.99,
                'currency' => 'USD',
                'description' => 'El más elegido',
                'bonus_minutes' => 10,
                'is_active' => true,
                'is_popular' => true,
                'sort_order' => 2
            ],
            [
                'name' => 'Paquete Premium',
                'minutes' => 120,
                'price' => 32.99,
                'currency' => 'USD',
                'description' => 'Máximo valor',
                'bonus_minutes' => 30,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 3
            ],
            [
                'name' => 'Paquete VIP',
                'minutes' => 300,
                'price' => 74.99,
                'currency' => 'USD',
                'description' => 'Para usuarios frecuentes',
                'bonus_minutes' => 60,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 4
            ]
        ];

        foreach ($packages as $package) {
            MinutePackage::create($package);
        }
    }
}