<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Gift;
use App\Models\GiftRequest;
use App\Models\UserGiftCoins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class GiftSecurityMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    private $modelo;
    private $cliente;
    private $clientePobre;
    private $gift;
    private $adminUser;

    public function setUp(): void
    {
        parent::setUp();
        $this->setupTestUsers();
        $this->setupTestGifts();
    }

    private function setupTestUsers()
    {
        // Crear modelo de prueba
        $this->modelo = User::factory()->create([
            'name' => 'Modelo Test',
            'email' => 'modelo@test.com',
            'rol' => 'modelo'
        ]);

        // Crear cliente con saldo
        $this->cliente = User::factory()->create([
            'name' => 'Cliente Test',
            'email' => 'cliente@test.com',
            'rol' => 'cliente'
        ]);

        // Crear cliente pobre (sin saldo)
        $this->clientePobre = User::factory()->create([
            'name' => 'Cliente Pobre',
            'email' => 'pobre@test.com',
            'rol' => 'cliente'
        ]);

        // Crear usuario admin (rol no autorizado)
        $this->adminUser = User::factory()->create([
            'name' => 'Admin Test',
            'email' => 'admin@test.com',
            'rol' => 'admin'
        ]);

        // Asignar saldo de gift coins al cliente
        UserGiftCoins::create([
            'user_id' => $this->cliente->id,
            'balance' => 1000,
            'total_received' => 0,
            'total_sent' => 0
        ]);

        // Cliente pobre sin saldo
        UserGiftCoins::create([
            'user_id' => $this->clientePobre->id,
            'balance' => 5, // Muy poco saldo
            'total_received' => 0,
            'total_sent' => 0
        ]);
    }

    private function setupTestGifts()
    {
        $this->gift = Gift::create([
            'id' => 'gift-001',
            'name' => 'Rosa Roja',
            'price' => 100,
            'image_path' => '/images/gifts/rosa.png',
            'category' => 'flowers',
            'is_active' => true
        ]);

        // Regalo inactivo para pruebas
        Gift::create([
            'id' => 'gift-inactive',
            'name' => 'Regalo Inactivo',
            'price' => 50,
            'image_path' => '/images/gifts/inactive.png',
            'category' => 'test',
            'is_active' => false
        ]);
    }

    /**
     * 🧪 TEST PRINCIPAL - EJECUTAR TODAS LAS PRUEBAS
     * @test
     */
    public function test_all_gift_security_validations()
    {
        $this->artisan('config:clear');
        
        echo "\n🔒 INICIANDO PRUEBAS DE SEGURIDAD DEL MIDDLEWARE\n";
        echo "================================================\n\n";

        $results = [];

        // Pruebas de solicitud de regalo
        $results[] = $this->runGiftRequestSecurity();
        
        // Pruebas de aceptación de regalo
        $results[] = $this->runGiftAcceptanceSecurity();
        
        // Pruebas de acceso por rol
        $results[] = $this->runRoleBasedAccess();
        
        // Pruebas de rate limiting
        $results[] = $this->runRateLimiting();
        
        // Pruebas de bloqueos
        $results[] = $this->runUserBlocking();

        $this->printTestResults($results);
        
        // Verificar que al menos el 80% de las pruebas pasaron
        $totalTests = 0;
        $passedTests = 0;
        
        foreach ($results as $category) {
            foreach ($category['tests'] as $passed) {
                $totalTests++;
                if ($passed) $passedTests++;
            }
        }
        
        $successRate = ($passedTests / $totalTests) * 100;
        $this->assertGreaterThanOrEqual(80, $successRate, "Solo {$passedTests}/{$totalTests} pruebas de seguridad pasaron ({$successRate}%)");
    }

    /**
     * 🎁 PRUEBAS DE SOLICITUD DE REGALO
     */
    private function runGiftRequestSecurity()
    {
        echo "🎁 PRUEBAS DE SOLICITUD DE REGALO\n";
        echo "---------------------------------\n";

        $tests = [];

        // TEST 1: Usuario no-modelo intenta solicitar regalo
        echo "1. Usuario admin intenta solicitar regalo... ";
        $response = $this->actingAs($this->adminUser)->postJson('/api/gifts/request', [
            'gift_id' => $this->gift->id,
            'client_id' => $this->cliente->id,
            'message' => 'Hola!',
            'room_name' => 'test-room'
        ]);
        
        $tests['no_modelo_request'] = $response->status() === 403;
        echo $tests['no_modelo_request'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 2: Modelo intenta auto-regalo
        echo "2. Modelo intenta pedirse regalo a sí misma... ";
        $response = $this->actingAs($this->modelo)->postJson('/api/gifts/request', [
            'gift_id' => $this->gift->id,
            'client_id' => $this->modelo->id, // Mismo ID
            'message' => 'Auto regalo',
            'room_name' => 'test-room'
        ]);
        
        $tests['auto_regalo'] = $response->status() === 403;
        echo $tests['auto_regalo'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 3: Solicitud a usuario inexistente
        echo "3. Solicitud a usuario inexistente... ";
        $response = $this->actingAs($this->modelo)->postJson('/api/gifts/request', [
            'gift_id' => $this->gift->id,
            'client_id' => 99999, // ID inexistente
            'message' => 'Usuario fake',
            'room_name' => 'test-room'
        ]);
        
        $tests['user_inexistente'] = $response->status() === 403;
        echo $tests['user_inexistente'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 4: Regalo inactivo
        echo "4. Solicitud de regalo inactivo... ";
        $response = $this->actingAs($this->modelo)->postJson('/api/gifts/request', [
            'gift_id' => 'gift-inactive',
            'client_id' => $this->cliente->id,
            'message' => 'Regalo inactivo',
            'room_name' => 'test-room'
        ]);
        
        $tests['regalo_inactivo'] = $response->status() === 403;
        echo $tests['regalo_inactivo'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 5: Solicitud válida (debe pasar)
        echo "5. Solicitud válida... ";
        $response = $this->actingAs($this->modelo)->postJson('/api/gifts/request', [
            'gift_id' => $this->gift->id,
            'client_id' => $this->cliente->id,
            'message' => 'Por favor!',
            'room_name' => 'test-room'
        ]);
        
        $tests['solicitud_valida'] = $response->status() === 200;
        echo $tests['solicitud_valida'] ? "✅ PASÓ" : "❌ FALLÓ (Status: {$response->status()})";
        if (!$tests['solicitud_valida']) {
            echo "   Response: " . $response->getContent() . "\n";
        }
        echo "\n";

        echo "\n";
        return ['category' => 'Solicitud de Regalo', 'tests' => $tests];
    }

    /**
     * ✅ PRUEBAS DE ACEPTACIÓN DE REGALO
     */
    private function runGiftAcceptanceSecurity()
    {
        echo "✅ PRUEBAS DE ACEPTACIÓN DE REGALO\n";
        echo "----------------------------------\n";

        $tests = [];

        // Crear solicitud válida primero
        $giftRequest = GiftRequest::create([
            'modelo_id' => $this->modelo->id,
            'client_id' => $this->cliente->id,
            'gift_id' => $this->gift->id,
            'message' => 'Test request',
            'room_name' => 'test-room',
            'status' => 'pending',
            'amount' => $this->gift->price,
            'expires_at' => now()->addMinutes(2),
            'gift_data' => json_encode(['gift_name' => $this->gift->name])
        ]);

        // TEST 1: Usuario no-cliente intenta aceptar
        echo "1. Modelo intenta aceptar regalo... ";
        $response = $this->actingAs($this->modelo)->postJson('/api/gifts/accept', [
            'request_id' => $giftRequest->id
        ]);
        
        $tests['no_cliente_accept'] = $response->status() === 403;
        echo $tests['no_cliente_accept'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 2: Cliente con saldo insuficiente
        echo "2. Cliente pobre intenta aceptar regalo caro... ";
        $giftRequestPobre = GiftRequest::create([
            'modelo_id' => $this->modelo->id,
            'client_id' => $this->clientePobre->id,
            'gift_id' => $this->gift->id,
            'message' => 'Test pobre',
            'room_name' => 'test-room',
            'status' => 'pending',
            'amount' => $this->gift->price,
            'expires_at' => now()->addMinutes(2),
            'gift_data' => json_encode(['gift_name' => $this->gift->name])
        ]);

        $response = $this->actingAs($this->clientePobre)->postJson('/api/gifts/accept', [
            'request_id' => $giftRequestPobre->id
        ]);
        
        $tests['saldo_insuficiente'] = $response->status() === 400;
        echo $tests['saldo_insuficiente'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 3: Solicitud expirada
        echo "3. Solicitud expirada... ";
        $expiredRequest = GiftRequest::create([
            'modelo_id' => $this->modelo->id,
            'client_id' => $this->cliente->id,
            'gift_id' => $this->gift->id,
            'message' => 'Expired',
            'room_name' => 'test-room',
            'status' => 'pending',
            'amount' => $this->gift->price,
            'expires_at' => now()->subMinutes(1), // Expirada
            'gift_data' => json_encode(['gift_name' => $this->gift->name])
        ]);

        $response = $this->actingAs($this->cliente)->postJson('/api/gifts/accept', [
            'request_id' => $expiredRequest->id
        ]);
        
        $tests['solicitud_expirada'] = $response->status() === 404;
        echo $tests['solicitud_expirada'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 4: Aceptación válida (debe pasar)
        echo "4. Aceptación válida... ";
        $response = $this->actingAs($this->cliente)->postJson('/api/gifts/accept', [
            'request_id' => $giftRequest->id
        ]);
        
        $tests['aceptacion_valida'] = $response->status() === 200;
        echo $tests['aceptacion_valida'] ? "✅ PASÓ" : "❌ FALLÓ (Status: {$response->status()})";
        if (!$tests['aceptacion_valida']) {
            echo "   Response: " . $response->getContent() . "\n";
        }
        echo "\n";

        echo "\n";
        return ['category' => 'Aceptación de Regalo', 'tests' => $tests];
    }

    /**
     * 👥 PRUEBAS DE ACCESO POR ROL
     */
    private function runRoleBasedAccess()
    {
        echo "👥 PRUEBAS DE ACCESO POR ROL\n";
        echo "----------------------------\n";

        $tests = [];

        // TEST 1: Admin intenta ver solicitudes pendientes
        echo "1. Admin intenta ver solicitudes pendientes... ";
        $response = $this->actingAs($this->adminUser)->getJson('/api/gifts/pending');
        $tests['admin_pending'] = $response->status() === 403;
        echo $tests['admin_pending'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 2: Admin intenta ver historial
        echo "2. Admin intenta ver historial... ";
        $response = $this->actingAs($this->adminUser)->getJson('/api/gifts/history');
        $tests['admin_history'] = $response->status() === 403;
        echo $tests['admin_history'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 3: Cliente válido ve solicitudes
        echo "3. Cliente válido ve solicitudes... ";
        $response = $this->actingAs($this->cliente)->getJson('/api/gifts/pending');
        $tests['client_pending'] = $response->status() === 200;
        echo $tests['client_pending'] ? "✅ PASÓ" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // TEST 4: Modelo válida ve historial
        echo "4. Modelo válida ve historial... ";
        $response = $this->actingAs($this->modelo)->getJson('/api/gifts/history');
        $tests['model_history'] = $response->status() === 200;
        echo $tests['model_history'] ? "✅ PASÓ" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        echo "\n";
        return ['category' => 'Acceso por Rol', 'tests' => $tests];
    }

    /**
     * ⚡ PRUEBAS DE RATE LIMITING
     */
    private function runRateLimiting()
    {
        echo "⚡ PRUEBAS DE RATE LIMITING\n";
        echo "--------------------------\n";

        $tests = [];

        echo "1. Enviando 6 solicitudes rápidas (límite: 5)...\n";
        
        $successCount = 0;
        $blockedCount = 0;

        for ($i = 1; $i <= 6; $i++) {
            $response = $this->actingAs($this->modelo)->postJson('/api/gifts/request', [
                'gift_id' => $this->gift->id,
                'client_id' => $this->cliente->id,
                'message' => "Request #{$i}",
                'room_name' => 'rate-limit-test'
            ]);

            if ($response->status() === 200) {
                $successCount++;
                echo "   Request #{$i}: ✅ PASÓ\n";
            } else {
                $blockedCount++;
                echo "   Request #{$i}: 🚫 BLOQUEADO (Status: {$response->status()})\n";
            }
        }

        $tests['rate_limit_working'] = ($successCount <= 5 && $blockedCount > 0);
        echo "\nResumen: {$successCount} exitosas, {$blockedCount} bloqueadas\n";
        echo "Rate limiting: " . ($tests['rate_limit_working'] ? "✅ FUNCIONANDO" : "❌ FALLÓ") . "\n";

        echo "\n";
        return ['category' => 'Rate Limiting', 'tests' => $tests];
    }

    /**
     * 🚫 PRUEBAS DE BLOQUEOS DE USUARIOS
     */
    private function runUserBlocking()
    {
        echo "🚫 PRUEBAS DE BLOQUEOS DE USUARIOS\n";
        echo "----------------------------------\n";

        $tests = [];

        // Crear bloqueo: modelo bloquea cliente
        DB::table('user_blocks')->insert([
            'user_id' => $this->modelo->id,
            'blocked_user_id' => $this->cliente->id,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // TEST 1: Modelo bloqueó al cliente
        echo "1. Modelo intenta pedir regalo a cliente bloqueado... ";
        $response = $this->actingAs($this->modelo)->postJson('/api/gifts/request', [
            'gift_id' => $this->gift->id,
            'client_id' => $this->cliente->id,
            'message' => 'Request a bloqueado',
            'room_name' => 'blocked-test'
        ]);
        
        $tests['modelo_blocked_client'] = $response->status() === 403;
        echo $tests['modelo_blocked_client'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // Remover bloqueo anterior y crear inverso
        DB::table('user_blocks')->where('user_id', $this->modelo->id)->delete();
        
        DB::table('user_blocks')->insert([
            'user_id' => $this->cliente->id,
            'blocked_user_id' => $this->modelo->id,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // TEST 2: Cliente bloqueó a la modelo
        echo "2. Modelo intenta pedir regalo a cliente que la bloqueó... ";
        $response = $this->actingAs($this->modelo)->postJson('/api/gifts/request', [
            'gift_id' => $this->gift->id,
            'client_id' => $this->cliente->id,
            'message' => 'Request a quien me bloqueó',
            'room_name' => 'blocked-test-2'
        ]);
        
        $tests['client_blocked_model'] = $response->status() === 403;
        echo $tests['client_blocked_model'] ? "✅ BLOQUEADO" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        // Limpiar bloqueos
        DB::table('user_blocks')->truncate();

        // TEST 3: Sin bloqueos (debe pasar)
        echo "3. Solicitud sin bloqueos... ";
        $response = $this->actingAs($this->modelo)->postJson('/api/gifts/request', [
            'gift_id' => $this->gift->id,
            'client_id' => $this->clientePobre->id, // Usar cliente diferente
            'message' => 'Sin bloqueos',
            'room_name' => 'no-blocks-test'
        ]);
        
        $tests['no_blocks'] = $response->status() === 200;
        echo $tests['no_blocks'] ? "✅ PASÓ" : "❌ FALLÓ (Status: {$response->status()})";
        echo "\n";

        echo "\n";
        return ['category' => 'Bloqueos de Usuarios', 'tests' => $tests];
    }

    /**
     * 📊 IMPRIMIR RESULTADOS FINALES
     */
    private function printTestResults($results)
    {
        echo "📊 RESUMEN DE PRUEBAS DE SEGURIDAD\n";
        echo "==================================\n\n";

        $totalTests = 0;
        $passedTests = 0;

        foreach ($results as $category) {
            echo "📂 {$category['category']}:\n";
            
            foreach ($category['tests'] as $testName => $passed) {
                $totalTests++;
                if ($passed) {
                    $passedTests++;
                    echo "   ✅ {$testName}\n";
                } else {
                    echo "   ❌ {$testName}\n";
                }
            }
            echo "\n";
        }

        $percentage = round(($passedTests / $totalTests) * 100, 1);
        
        echo "🎯 RESULTADO FINAL:\n";
        echo "   Total de pruebas: {$totalTests}\n";
        echo "   Pruebas exitosas: {$passedTests}\n";
        echo "   Porcentaje de éxito: {$percentage}%\n\n";

        if ($percentage >= 90) {
            echo "🔒 EXCELENTE: Tu middleware está muy seguro!\n";
        } elseif ($percentage >= 70) {
            echo "⚠️  BUENO: Algunas mejoras de seguridad recomendadas\n";
        } else {
            echo "🚨 CRÍTICO: Vulnerabilidades de seguridad detectadas!\n";
        }
    }
}