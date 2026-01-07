<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use App\Models\UserCoins;
use App\Models\CoinTransaction;
use App\Http\Controllers\VideoChatCoinController;
use Illuminate\Support\Facades\DB;

$email = 'juliannaranjo58@gmail.com';
$minutesToAdd = 50; // 50 minutos
$giftCoinsToAdd = 200; // 200 monedas de regalo

// 1 minuto = 10 coins
$purchasedCoinsToAdd = $minutesToAdd * 10; // 100 coins

echo "========================================\n";
echo "AGREGAR SALDO A USUARIO\n";
echo "========================================\n\n";

// Buscar usuario por email
$user = User::where('email', $email)->first();

if (!$user) {
    echo "❌ Usuario no encontrado con email: {$email}\n";
    exit(1);
}

echo "👤 Usuario encontrado:\n";
echo "   - ID: {$user->id}\n";
echo "   - Nombre: {$user->name}\n";
echo "   - Email: {$user->email}\n";
echo "   - Rol: {$user->rol}\n\n";

// Obtener o crear UserCoins
$userCoins = UserCoins::firstOrCreate(
    ['user_id' => $user->id],
    [
        'purchased_balance' => 0,
        'gift_balance' => 0,
        'total_purchased' => 0,
        'total_consumed' => 0
    ]
);

echo "💰 SALDO ACTUAL:\n";
echo "   - Purchased Balance: {$userCoins->purchased_balance} coins (" . floor($userCoins->purchased_balance / 10) . " minutos)\n";
echo "   - Gift Balance: {$userCoins->gift_balance} coins\n";
echo "   - Total: " . ($userCoins->purchased_balance + $userCoins->gift_balance) . " coins\n\n";

// Agregar saldo
DB::beginTransaction();

try {
    // Agregar purchased coins (minutos)
    $userCoins->purchased_balance += $purchasedCoinsToAdd;
    $userCoins->total_purchased += $purchasedCoinsToAdd;
    
    // Agregar gift coins
    $userCoins->gift_balance += $giftCoinsToAdd;
    
    $userCoins->last_purchase_at = now();
    $userCoins->save();
    
    // Registrar transacción de purchased coins
    CoinTransaction::create([
        'user_id' => $user->id,
        'type' => 'purchased',
        'amount' => $purchasedCoinsToAdd,
        'source' => 'admin_manual_add',
        'reference_id' => 'script_' . time(),
        'balance_after' => $userCoins->purchased_balance + $userCoins->gift_balance,
        'created_at' => now()
    ]);
    
    // Registrar transacción de gift coins
    CoinTransaction::create([
        'user_id' => $user->id,
        'type' => 'gift',
        'amount' => $giftCoinsToAdd,
        'source' => 'admin_manual_add',
        'reference_id' => 'script_' . time(),
        'balance_after' => $userCoins->purchased_balance + $userCoins->gift_balance,
        'created_at' => now()
    ]);
    
    DB::commit();
    
    echo "✅ SALDO AGREGADO EXITOSAMENTE:\n";
    echo "   - Purchased coins agregados: {$purchasedCoinsToAdd} coins ({$minutesToAdd} minutos)\n";
    echo "   - Gift coins agregados: {$giftCoinsToAdd} coins\n\n";
    
    echo "💰 NUEVO SALDO:\n";
    echo "   - Purchased Balance: {$userCoins->purchased_balance} coins (" . floor($userCoins->purchased_balance / 10) . " minutos)\n";
    echo "   - Gift Balance: {$userCoins->gift_balance} coins\n";
    echo "   - Total: " . ($userCoins->purchased_balance + $userCoins->gift_balance) . " coins\n";
    
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ ERROR al agregar saldo: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n✅ Proceso completado exitosamente\n";

