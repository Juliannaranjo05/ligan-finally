<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Predis\Client as PredisClient;
use Symfony\Component\HttpFoundation\StreamedResponse;

class NotificationController extends Controller
{
    /**
     * 🔥 MÉTODO MEJORADO PARA ENVIAR NOTIFICACIONES CON REINTENTOS
     */
    public static function sendNotification($userId, $type, $data = [])
    {
        $maxAttempts = 3;
        
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $redis = new PredisClient([
                    'host' => config('database.redis.default.host'),
                    'port' => config('database.redis.default.port'),
                    'password' => config('database.redis.default.password'),
                    'database' => config('database.redis.default.database', 0),
                ]);
                
                $channel = "user_notifications_{$userId}";
                
                $notification = [
                    'id' => uniqid(),
                    'type' => $type,
                    'data' => $data,
                    'timestamp' => now()->toISOString(),
                    'attempt' => $attempt
                ];
                
                // 🔥 PUBLICAR Y VERIFICAR SUBSCRIBERS
                $result = $redis->publish($channel, json_encode($notification));
                
                \Log::info("📨 [SSE] Notificación enviada (intento {$attempt})", [
                    'userId' => $userId,
                    'type' => $type,
                    'channel' => $channel,
                    'subscribers' => $result,
                    'redis_host' => config('database.redis.default.host')
                ]);
                
                // 🔥 SI HAY SUBSCRIBERS, TODO BIEN
                if ($result > 0) {
                    return true;
                }
                
                // 🔥 SI NO HAY SUBSCRIBERS EN EL ÚLTIMO INTENTO
                if ($attempt === $maxAttempts) {
                    \Log::warning("⚠️ [SSE] Sin subscribers después de {$maxAttempts} intentos", [
                        'userId' => $userId,
                        'type' => $type,
                        'final_subscribers' => $result
                    ]);
                    
                    // 🔥 ESTRATEGIA ALTERNATIVA: MARCAR AL USUARIO COMO "NEEDS_REDIRECT"
                    static::markUserForRedirect($userId, $type, $data);
                }
                
                // Esperar un poco antes del siguiente intento
                if ($attempt < $maxAttempts) {
                    usleep(300000); // 0.3 segundos
                }
                
            } catch (\Exception $e) {
                \Log::error("❌ [SSE] Error enviando notificación (intento {$attempt})", [
                    'userId' => $userId,
                    'type' => $type,
                    'error' => $e->getMessage(),
                    'attempt' => $attempt
                ]);
                
                if ($attempt === $maxAttempts) {
                    return false;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 🔥 MARCAR USUARIO PARA REDIRECCIÓN EN REDIS (SIN NUEVA TABLA)
     */
    private static function markUserForRedirect($userId, $type, $data)
    {
        try {
            $redis = new PredisClient([
                'host' => config('database.redis.default.host'),
                'port' => config('database.redis.default.port'),
                'password' => config('database.redis.default.password'),
                'database' => config('database.redis.default.database', 0),
            ]);
            
            $redirectKey = "user_redirect_{$userId}";
            $redirectData = [
                'type' => $type,
                'data' => $data,
                'timestamp' => now()->toISOString(),
                'expires_at' => now()->addMinutes(5)->toISOString()
            ];
            
            // 🔥 GUARDAR EN REDIS CON EXPIRACIÓN DE 5 MINUTOS
            $redis->setex($redirectKey, 300, json_encode($redirectData)); // 300 segundos = 5 minutos
            
            \Log::info("🏷️ [SSE] Usuario marcado para redirección en Redis", [
                'userId' => $userId,
                'type' => $type,
                'redis_key' => $redirectKey,
                'expires_in' => '5 minutos'
            ]);
            
        } catch (\Exception $e) {
            \Log::error("❌ [SSE] Error marcando usuario para redirección", [
                'userId' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * 🔥 VERIFICAR SI USUARIO NECESITA REDIRECCIÓN AL CONECTAR SSE
     */
    public function stream($userId)
    {
        // ... tu validación de token existente ...
        
        $token = request()->query('token');
        
        if (!$token) {
            \Log::error('❌ [SSE] Token faltante');
            abort(403, 'Token requerido');
        }
        
        try {
            $personalAccessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($token);
            
            if (!$personalAccessToken || $personalAccessToken->tokenable_id != $userId) {
                abort(403, 'Token inválido');
            }
            
        } catch (\Exception $e) {
            \Log::error('❌ [SSE] Error validando token', [
                'userId' => $userId,
                'error' => $e->getMessage()
            ]);
            abort(403, 'Error de autenticación');
        }

        return new StreamedResponse(function () use ($userId) {
            // Headers para SSE
            echo "retry: 3000\n";
            echo "data: " . json_encode([
                'type' => 'connected',
                'userId' => $userId,
                'timestamp' => now()->toISOString()
            ]) . "\n\n";
            
            ob_flush();
            flush();

            // 🔥 VERIFICAR SI HAY REDIRECCIÓN PENDIENTE
            $this->checkPendingRedirect($userId);

            try {
                $redis = $this->getRedisConnection();
                $redis->ping();
                
                $channel = "user_notifications_{$userId}";
                
                \Log::info("📡 [SSE] Usuario {$userId} conectado - verificando redirecciones pendientes");
                
                $pubsub = $redis->pubSubLoop();
                $pubsub->subscribe($channel);
                
                foreach ($pubsub as $message) {
                    if ($message->kind === 'message') {
                        try {
                            $data = json_decode($message->payload, true);
                            
                            if (!isset($data['type'])) {
                                continue;
                            }
                            
                            \Log::info("📨 [SSE] Enviando notificación en tiempo real", [
                                'type' => $data['type'],
                                'userId' => $userId
                            ]);
                            
                            echo "id: " . ($data['id'] ?? uniqid()) . "\n";
                            echo "event: notification\n";
                            echo "data: " . json_encode($data) . "\n\n";
                            
                            ob_flush();
                            flush();
                            
                            if ($data['type'] === 'client_left' || $data['type'] === 'redirect') {
                                \Log::info("🔚 [SSE] Cerrando conexión - tipo: {$data['type']}");
                                break;
                            }
                            
                        } catch (\Exception $e) {
                            \Log::error("❌ [SSE] Error procesando mensaje", [
                                'error' => $e->getMessage(),
                                'userId' => $userId
                            ]);
                        }
                    }
                    
                    if (connection_aborted()) {
                        \Log::info("🔌 [SSE] Conexión abortada para usuario {$userId}");
                        break;
                    }
                }
                
                $pubsub->unsubscribe();
                
            } catch (\Exception $e) {
                \Log::error("❌ [SSE] Error en stream", [
                    'userId' => $userId,
                    'error' => $e->getMessage()
                ]);
                
                echo "event: error\n";
                echo "data: " . json_encode([
                    'error' => 'Connection error',
                    'message' => 'Error de conexión'
                ]) . "\n\n";
                ob_flush();
                flush();
            }
            
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Headers' => 'Cache-Control',
        ]);
    }
    
    /**
     * 🔥 VERIFICAR REDIRECCIÓN PENDIENTE EN REDIS
     */
    private function checkPendingRedirect($userId)
    {
        try {
            $redis = $this->getRedisConnection();
            $redirectKey = "user_redirect_{$userId}";
            
            $redirectData = $redis->get($redirectKey);
            
            if ($redirectData) {
                $data = json_decode($redirectData, true);
                
                \Log::info("📬 [SSE] Redirección pendiente encontrada", [
                    'userId' => $userId,
                    'type' => $data['type'],
                    'timestamp' => $data['timestamp']
                ]);
                
                // Enviar la notificación pendiente
                echo "id: " . uniqid() . "\n";
                echo "event: notification\n";
                echo "data: " . json_encode([
                    'id' => uniqid(),
                    'type' => $data['type'],
                    'data' => $data['data'],
                    'timestamp' => $data['timestamp'],
                    'from_pending' => true
                ]) . "\n\n";
                
                ob_flush();
                flush();
                
                // 🔥 LIMPIAR LA REDIRECCIÓN PENDIENTE
                $redis->del($redirectKey);
                
                \Log::info("🧹 [SSE] Redirección pendiente enviada y limpiada", [
                    'userId' => $userId,
                    'type' => $data['type']
                ]);
            }
            
        } catch (\Exception $e) {
            \Log::error("❌ [SSE] Error verificando redirección pendiente", [
                'userId' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * 🔥 NUEVO ENDPOINT: VERIFICAR ESTADO DE USUARIO
     */
    public function checkUserStatus($userId)
    {
        try {
            $redis = $this->getRedisConnection();
            $redirectKey = "user_redirect_{$userId}";
            
            $redirectData = $redis->get($redirectKey);
            
            if ($redirectData) {
                $data = json_decode($redirectData, true);
                
                return response()->json([
                    'has_pending_redirect' => true,
                    'type' => $data['type'],
                    'data' => $data['data'],
                    'timestamp' => $data['timestamp']
                ]);
            }
            
            return response()->json([
                'has_pending_redirect' => false
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error verificando estado',
                'has_pending_redirect' => false
            ], 500);
        }
    }
}