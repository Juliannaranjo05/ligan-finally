<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\CoinConsumption;
use App\Models\User;
use App\Models\VideoChatSession;
use App\Models\UserCoins;
use Illuminate\Support\Facades\DB;

echo "========================================\n";
echo "ANÁLISIS DE CONSUMOS DE VIDEOLLAMADAS\n";
echo "========================================\n\n";

// Obtener el último usuario cliente (o puedes especificar un ID)
$userId = $argv[1] ?? null;

if (!$userId) {
    // Buscar el último cliente que hizo una llamada
    $lastConsumption = CoinConsumption::whereHas('user', function($q) {
        $q->where('rol', 'cliente');
    })->latest('consumed_at')->first();
    
    if (!$lastConsumption) {
        echo "❌ No se encontraron consumos recientes\n";
        exit(1);
    }
    
    $userId = $lastConsumption->user_id;
    echo "📋 Analizando consumos del usuario ID: {$userId}\n";
} else {
    echo "📋 Analizando consumos del usuario ID: {$userId}\n";
}

$user = User::find($userId);
if (!$user) {
    echo "❌ Usuario no encontrado\n";
    exit(1);
}

echo "👤 Usuario: {$user->name} ({$user->email})\n";
echo "📅 Rol: {$user->rol}\n\n";

// Obtener saldo actual
$userCoins = UserCoins::firstOrCreate(['user_id' => $userId], [
    'purchased_balance' => 0,
    'gift_balance' => 0
]);

echo "💰 SALDO ACTUAL:\n";
echo "   - Purchased Balance: {$userCoins->purchased_balance} coins\n";
echo "   - Gift Balance: {$userCoins->gift_balance} coins\n";
echo "   - Total: " . ($userCoins->purchased_balance + $userCoins->gift_balance) . " coins\n";
echo "   - Minutos disponibles: " . floor($userCoins->purchased_balance / 10) . " minutos\n\n";

// Obtener consumos de las últimas 24 horas
$consumptions = CoinConsumption::where('user_id', $userId)
    ->where('consumed_at', '>=', now()->subHours(24))
    ->orderBy('consumed_at', 'desc')
    ->get();

if ($consumptions->isEmpty()) {
    echo "❌ No se encontraron consumos en las últimas 24 horas\n";
    exit(1);
}

echo "📊 CONSUMOS EN LAS ÚLTIMAS 24 HORAS:\n";
echo str_repeat("=", 100) . "\n";

$totalCoinsConsumed = 0;
$totalMinutesConsumed = 0;
$groupedByRoom = [];

foreach ($consumptions as $consumption) {
    $totalCoinsConsumed += $consumption->coins_consumed;
    $totalMinutesConsumed += $consumption->minutes_consumed;
    
    if (!isset($groupedByRoom[$consumption->room_name])) {
        $groupedByRoom[$consumption->room_name] = [
            'consumptions' => [],
            'total_coins' => 0,
            'total_minutes' => 0
        ];
    }
    
    $groupedByRoom[$consumption->room_name]['consumptions'][] = $consumption;
    $groupedByRoom[$consumption->room_name]['total_coins'] += $consumption->coins_consumed;
    $groupedByRoom[$consumption->room_name]['total_minutes'] += $consumption->minutes_consumed;
}

echo "\n📈 RESUMEN TOTAL:\n";
echo "   - Total de consumos: " . $consumptions->count() . "\n";
echo "   - Total de coins consumidos: {$totalCoinsConsumed}\n";
echo "   - Total de minutos consumidos: " . round($totalMinutesConsumed, 2) . "\n";
echo "   - Equivalente en minutos: " . floor($totalCoinsConsumed / 10) . " minutos\n\n";

// Mostrar por sala
foreach ($groupedByRoom as $roomName => $data) {
    echo "\n" . str_repeat("-", 100) . "\n";
    echo "🏠 SALA: {$roomName}\n";
    echo str_repeat("-", 100) . "\n";
    echo "   Total coins: {$data['total_coins']}\n";
    echo "   Total minutos: " . round($data['total_minutes'], 2) . "\n";
    echo "   Equivalente: " . floor($data['total_coins'] / 10) . " minutos\n";
    echo "   Número de descuentos: " . count($data['consumptions']) . "\n\n";
    
    // Buscar sesión de videochat
    $session = VideoChatSession::where('user_id', $userId)
        ->where('room_name', $roomName)
        ->latest('started_at')
        ->first();
    
    if ($session) {
        $duration = $session->started_at->diffInSeconds($session->ended_at ?? now());
        $durationMinutes = round($duration / 60, 2);
        echo "   📹 Sesión de videochat:\n";
        echo "      - Inicio: {$session->started_at}\n";
        echo "      - Fin: " . ($session->ended_at ? $session->ended_at : 'En curso') . "\n";
        echo "      - Duración: {$durationMinutes} minutos ({$duration} segundos)\n";
        echo "      - Status: {$session->status}\n";
        echo "      - Total consumido en sesión: {$session->total_consumed} coins\n";
        echo "      - Last consumption at: " . ($session->last_consumption_at ? $session->last_consumption_at : 'N/A') . "\n\n";
    }
    
    echo "   📋 DETALLE DE DESCUENTOS:\n";
    foreach ($data['consumptions'] as $idx => $consumption) {
        echo "      " . ($idx + 1) . ". " . $consumption->consumed_at . "\n";
        echo "         - Session ID: {$consumption->session_id}\n";
        echo "         - Minutos: " . round($consumption->minutes_consumed, 3) . "\n";
        echo "         - Coins: {$consumption->coins_consumed}\n";
        echo "         - Purchased coins: {$consumption->purchased_coins_used}\n";
        echo "         - Gift coins: {$consumption->gift_coins_used}\n";
        echo "         - Balance después: {$consumption->balance_after}\n";
        echo "\n";
    }
}

echo "\n" . str_repeat("=", 100) . "\n";
echo "✅ Análisis completado\n";

