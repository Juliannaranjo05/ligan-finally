<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GiftsSeeder extends Seeder
{
    public function run()
    {
        // Método alternativo más seguro - eliminar registros en lugar de truncate
        DB::table('gifts')->delete();
        
        // Reiniciar el auto-increment (opcional)
        DB::statement('ALTER TABLE gifts AUTO_INCREMENT = 1;');

        $gifts = [
            // PRIMERA SECCIÓN: Regalos básicos (accesibles)
            // Precios: 2, 3, 5, 7, 10 gift coins
            [
                'id' => 'moño',
                'name' => 'Moño Elegante',
                'image_path' => 'storage/gifts/moño.png',
                'price' => 2, // Usuario paga 2 gift coins → Modelo gana $1.20 (60%)
                'category' => 'basic',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'gafas',
                'name' => 'Gafas de Sol',
                'image_path' => 'storage/gifts/gafas.png',
                'price' => 3, // Usuario paga 3 gift coins → Modelo gana $1.80 (60%)
                'category' => 'basic',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'zapatillas',
                'name' => 'Zapatillas',
                'image_path' => 'storage/gifts/zapatillas.png',
                'price' => 5, // Usuario paga 5 gift coins → Modelo gana $3.00 (60%)
                'category' => 'basic',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'bailarina',
                'name' => 'Bailarina',
                'image_path' => 'storage/gifts/bailarina.png',
                'price' => 7, // Usuario paga 7 gift coins → Modelo gana $4.20 (60%)
                'category' => 'basic',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'camara',
                'name' => 'Cámara',
                'image_path' => 'storage/gifts/camara.png',
                'price' => 10, // Usuario paga 10 gift coins → Modelo gana $6.00 (60%)
                'category' => 'basic',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            
            // SEGUNDA SECCIÓN: Regalos premium (precios moderados)
            // Precios: 15, 20, 25, 30, 35 gift coins
            [
                'id' => 'bañera',
                'name' => 'Bañera de Lujo',
                'image_path' => 'storage/gifts/bañera.png',
                'price' => 15, // Usuario paga 15 gift coins → Modelo gana $9.00 (60%)
                'category' => 'premium',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'unicorniolampara',
                'name' => 'Lámpara Unicornio',
                'image_path' => 'storage/gifts/unicorniolampara.png',
                'price' => 20, // Usuario paga 20 gift coins → Modelo gana $12.00 (60%)
                'category' => 'premium',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'unicornio',
                'name' => 'Unicornio',
                'image_path' => 'storage/gifts/unicornio.png',
                'price' => 25, // Usuario paga 25 gift coins → Modelo gana $15.00 (60%)
                'category' => 'premium',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'universo',
                'name' => 'Universo',
                'image_path' => 'storage/gifts/universo.png',
                'price' => 30, // Usuario paga 30 gift coins → Modelo gana $18.00 (60%)
                'category' => 'luxury',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'yate',
                'name' => 'Yate de Lujo',
                'image_path' => 'storage/gifts/yate.png',
                'price' => 35, // Usuario paga 35 gift coins → Modelo gana $21.00 (60%)
                'category' => 'luxury',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        DB::table('gifts')->insert($gifts);
        
        $this->command->info('✅ ' . count($gifts) . ' regalos insertados correctamente!');
        $this->command->info('💰 Primera sección (básicos): 2, 3, 5, 7, 10 gift coins');
        $this->command->info('🎁 Segunda sección (premium): 15, 20, 25, 30, 35 gift coins');
        $this->command->info('📊 Las modelos ganan 60% del valor en USD equivalente');
        $this->command->info('🎯 Regalo más barato: $2 | Regalo más caro: $35');
    }
}