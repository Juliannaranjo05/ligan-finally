<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\UserCoins;

class VideoChatCoinControllerTest extends TestCase
{
    use RefreshDatabase;

    private $modelo;
    private $cliente;

    public function setUp(): void
    {
        parent::setUp();

        $this->modelo = User::factory()->create([
            'name' => 'Modelo Test',
            'email' => 'modelo-check@test.com',
            'rol' => 'modelo'
        ]);

        $this->cliente = User::factory()->create([
            'name' => 'Cliente Test',
            'email' => 'cliente-check@test.com',
            'rol' => 'cliente'
        ]);
    }

    /** @test */
    public function client_with_20_purchased_cannot_start_and_minimum_is_30()
    {
        UserCoins::create([
            'user_id' => $this->cliente->id,
            'purchased_balance' => 20,
            'gift_balance' => 0
        ]);

        $response = $this->actingAs($this->modelo)->postJson('/api/videochat/coins/check-client-balance', [
            'client_id' => $this->cliente->id
        ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertFalse($data['can_start_call']);
        $this->assertEquals(30, $data['balance']['minimum_required']);
    }

    /** @test */
    public function client_with_29_purchased_cannot_start()
    {
        UserCoins::create([
            'user_id' => $this->cliente->id,
            'purchased_balance' => 29,
            'gift_balance' => 0
        ]);

        $response = $this->actingAs($this->modelo)->postJson('/api/videochat/coins/check-client-balance', [
            'client_id' => $this->cliente->id
        ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertFalse($data['can_start_call']);
    }

    /** @test */
    public function client_with_30_purchased_can_start()
    {
        UserCoins::create([
            'user_id' => $this->cliente->id,
            'purchased_balance' => 30,
            'gift_balance' => 0
        ]);

        $response = $this->actingAs($this->modelo)->postJson('/api/videochat/coins/check-client-balance', [
            'client_id' => $this->cliente->id
        ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertTrue($data['can_start_call']);
    }
}
