<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\VideoChatSession;
use App\Models\ChatSession;
use App\Http\Controllers\VideoChatCoinController;

class TestConsumption extends Command
{
    protected $signature = 'test:consumption {session_id?}';
    protected $description = 'Test consumo de una sesión específica';

    public function handle()
    {
        $sessionId = $this->argument('session_id');
        
        if ($sessionId) {
            $session = VideoChatSession::find($sessionId);
            if (!$session) {
                $this->error("Sesión {$sessionId} no encontrada");
                return;
            }
            $sessions = collect([$session]);
        } else {
            $sessions = VideoChatSession::where('status', 'active')
                ->where('is_consuming', true)
                ->where('user_role', 'cliente')
                ->get();
        }

        $this->info("🔍 Sesiones a analizar: " . $sessions->count());

        foreach ($sessions as $session) {
            $this->info("\n--- SESIÓN ID: {$session->id} ---");
            $this->info("Usuario: {$session->user_id}");
            $this->info("Rol: {$session->user_role}");
            $this->info("Sala: {$session->room_name}");
            $this->info("Status: {$session->status}");
            $this->info("Is consuming: " . ($session->is_consuming ? 'SÍ' : 'NO'));
            $this->info("Iniciada: " . ($session->started_at ? $session->started_at->format('Y-m-d H:i:s') : 'NULL'));
            $this->info("Último consumo: " . ($session->last_consumption_at ? $session->last_consumption_at->format('Y-m-d H:i:s') : 'NULL'));

            // Verificar chat session
            $chatSession = ChatSession::where('room_name', $session->room_name)
                ->where('status', 'active')
                ->where(function($query) use ($session) {
                    $query->where('cliente_id', $session->user_id)
                          ->orWhere('modelo_id', $session->user_id);
                })
                ->first();

            if ($chatSession) {
                $this->info("✅ Chat session activa: ID {$chatSession->id}");
            } else {
                $this->error("❌ No hay chat session activa");
            }

            // Verificar saldo
            $coinController = new VideoChatCoinController();
            $balanceCheck = $coinController->canStartVideoChat($session->user_id);
            $this->info("💰 Saldo: " . ($balanceCheck['total_balance'] ?? 0) . " monedas");

            // Calcular tiempo
            $lastConsumption = $session->last_consumption_at ?? $session->started_at;
            $timeSince = now()->diffInSeconds($lastConsumption);
            $this->info("⏰ Tiempo desde último consumo: {$timeSince} segundos");

            $this->info("--- FIN SESIÓN ---\n");
        }
    }
}
