<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AdminUser;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Crea o actualiza un usuario admin por defecto de forma idempotente
        AdminUser::updateOrCreate(
            ['email' => 'ligandome@gmail.com'],
            [
                'password' => Hash::make('CambiaEstaClave123!'),
                'last_code' => null,
            ]
        );
    }
}


