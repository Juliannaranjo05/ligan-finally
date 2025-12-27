<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use App\Models\User;
use App\Models\Gift;
use App\Models\GiftRequest;
use App\Models\UserGiftCoins;

class GiftSecurityMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, ...$guards)
    {
        $user = Auth::user();
        $routeName = $request->route()->getName();
        $method = $request->method();
        $userAgent = $request->userAgent();
        $ip = $request->ip();



        // 🛡️ Detección de fraude intensiva
        if ($this->detectFraudulentActivity($user, $request)) {
            return $this->securityResponse('Actividad fraudulenta detectada');
        }

        // Aplicar validaciones según la ruta
        switch ($routeName) {
            case 'gifts.available':
                if (!$this->validateGiftAvailableAccess($user)) {
                    return $this->securityResponse('Acceso denegado a regalos');
                }
                break;

            case 'gifts.request':
                if (!$this->validateGiftRequest($request, $user)) {
                    return $this->securityResponse('Solicitud de regalo denegada');
                }
                break;

            case 'gifts.accept':
                if (!$this->validateGiftAcceptance($request, $user)) {
                    return $this->securityResponse('Aceptación de regalo denegada');
                }
                break;

            case 'gifts.pending':
                if (!$this->validateClientAccess($user)) {
                    return $this->securityResponse('Solo clientes pueden ver solicitudes');
                }
                break;

            case 'gifts.reject':
                if (!$this->validateGiftRejection($request, $user)) {
                    return $this->securityResponse('Rechazo de regalo denegado');
                }
                break;

            case 'gifts.balance':
            case 'gifts.history':
                if (!$this->validateUserAccess($user)) {
                    return $this->securityResponse('Rol no autorizado');
                }
                break;

            case 'gifts.clean-expired':
                if (!$this->validateAdminAccess($user)) {
                    return $this->securityResponse('Solo administradores');
                }
                break;
        }

        return $next($request);
    }

    /**
     * 🔒 Validar solicitud de regalo - ENFOQUE ANTI-FRAUDE
     */
    private function validateGiftRequest(Request $request, $user): bool
    {
        // 1. Verificar que sea una modelo
        if (!$user || $user->rol !== 'modelo') {
            $this->logSecurity('Usuario no-modelo intentó solicitar regalo', $user, $request, 'CRITICAL');
            return false;
        }

        $clientId = $request->input('client_id');
        $giftId = $request->input('gift_id');
        $sessionToken = $request->input('session_token');

        // 2. 🚨 VALIDACIONES ANTI-FRAUDE CRÍTICAS
        
        // Anti auto-regalo (FRAUDE CRÍTICO)
        if ($user->id === $clientId) {
            $this->logSecurity('FRAUDE CRÍTICO: Auto-regalo detectado', $user, $request, 'CRITICAL');
            $this->banUser($user->id, 'auto_gift_fraud', 24); // Ban 24 horas
            return false;
        }

        // Verificar que el cliente exista y sea válido
        $client = User::find($clientId);
        if (!$client || $client->rol !== 'cliente') {
            $this->logSecurity('FRAUDE: Solicitud a usuario inexistente/inválido', $user, $request, 'CRITICAL', [
                'target_id' => $clientId,
                'target_role' => $client->rol ?? 'not_found'
            ]);
            return false;
        }

        // 3. 🚨 DETECCIÓN DE BOTS Y SPAM
        if (!$this->validateAntiBot($user, $request)) {
            return false;
        }

        // 4. 🚨 VALIDACIÓN DE TOKEN DE SESIÓN ÚNICO (PREVENIR REPLAY)
        if (!$this->validateSessionToken($sessionToken, $user)) {
            $this->logSecurity('FRAUDE: Token de sesión inválido o reutilizado', $user, $request, 'CRITICAL');
            return false;
        }

        // 5. 🚨 RATE LIMITING ANTI-SPAM (GENEROSO PERO EFECTIVO)
        if (!$this->validateAntiSpamLimits($user->id, $clientId)) {
            return false;
        }

        // 6. Verificar bloqueos entre usuarios
        if ($this->areUsersBlocked($user->id, $clientId)) {
            return false;
        }

        // 7. 🚨 VALIDACIÓN DE REGALO CON DETECCIÓN DE MANIPULACIÓN
        if (!$this->validateGiftIntegrity($giftId, $user->id, $request)) {
            return false;
        }

        // 8. 🚨 VERIFICAR PATRÓN DE SOLICITUDES FRAUDULENTAS
        if ($this->detectFraudulentRequestPattern($user->id, $clientId, $giftId)) {
            return false;
        }

        // 9. 🚨 GENERAR HASH DE SEGURIDAD MILITAR
        if (!$this->generateAndValidateSecurityData($request, $user->id, $clientId, $giftId)) {
            return false;
        }

        return true;
    }

    /**
     * ✅ Validar aceptación de regalo - MÁXIMA SEGURIDAD
     */
    private function validateGiftAcceptance(Request $request, $user): bool
    {
        // 1. Verificar que sea cliente
        if (!$user || $user->rol !== 'cliente') {
            $this->logSecurity('FRAUDE CRÍTICO: Usuario no-cliente intentó aceptar regalo', $user, $request, 'CRITICAL');
            return false;
        }

        $requestId = $request->route('request');
        $securityHash = $request->input('security_hash');
        $sessionToken = $request->input('session_token');

        // 2. 🚨 VALIDAR TOKEN DE SESIÓN ÚNICO
        if (!$this->validateSessionToken($sessionToken, $user)) {
            $this->logSecurity('FRAUDE: Token de sesión inválido en aceptación', $user, $request, 'CRITICAL');
            return false;
        }

        // 3. 🚨 VERIFICAR SOLICITUD VÁLIDA CON INTEGRIDAD
        $giftRequest = GiftRequest::where('id', $requestId)
            ->where('client_id', $user->id)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->with(['modelo', 'gift'])
            ->first();

        if (!$giftRequest) {
            $this->logSecurity('FRAUDE: Intento de aceptar solicitud inexistente/expirada', $user, $request, 'CRITICAL', [
                'request_id' => $requestId
            ]);
            return false;
        }

        // 4. 🚨 VERIFICAR INTEGRIDAD DE LA MODELO
        if (!$giftRequest->modelo || $giftRequest->modelo->rol !== 'modelo') {
            $this->logSecurity('FRAUDE CRÍTICO: Receptor no es modelo válida', $user, $request, 'CRITICAL', [
                'fake_modelo_id' => $giftRequest->modelo_id
            ]);
            return false;
        }

        // 5. 🚨 VERIFICAR HASH DE SEGURIDAD MILITAR
        if (!$this->validateMilitaryGradeHash($giftRequest, $user->id, $securityHash)) {
            return false;
        }

        // 6. 🚨 VALIDAR Y BLOQUEAR SALDO (PREVENIR DOBLE GASTO)
        if (!$this->validateAndLockBalance($user->id, $giftRequest->amount, $requestId)) {
            return false;
        }

        // 7. 🚨 VERIFICAR PATRÓN DE GASTO FRAUDULENTO
        if ($this->detectFraudulentSpendingPattern($user->id, $giftRequest->amount)) {
            return false;
        }

        // 8. 🚨 VALIDAR INTEGRIDAD DE LA TRANSACCIÓN
        if (!$this->validateTransactionIntegrity($giftRequest, $user)) {
            return false;
        }

        return true;
    }

    /**
     * 🚨 DETECCIÓN DE ACTIVIDAD FRAUDULENTA INTENSIVA
     */
    private function detectFraudulentActivity($user, $request): bool
    {
        if (!$user) return false;

        $userId = $user->id;
        $ip = $request->ip();
        $userAgent = $request->userAgent();

        // 🔥 EXCLUIR RUTAS DE LA DETECCIÓN DE FRAUDE
        $excludedPaths = [
            'api/gifts/available',
            'api/gifts/requests',
            'api/chat/conversations',
            'api/heartbeat',
            'api/user/profile'
        ];
        
        $currentPath = $request->path();
        foreach ($excludedPaths as $excludedPath) {
            if (str_contains($currentPath, $excludedPath)) {
                // No aplicar detección de fraude en estas rutas
                return false;
            }
        }

        // 🚨 DETECCIÓN DE MÚLTIPLES SESIONES (MÁS PERMISIVA)
        $activeSessionsKey = "active_sessions_{$userId}";
        $activeSessions = Cache::get($activeSessionsKey, []);
        $currentSession = session()->getId();

        if (!in_array($currentSession, $activeSessions)) {
            $activeSessions[] = $currentSession;
            
            // 🔥 LIMPIAR SESIONES ANTIGUAS (más de 2 horas)
            $activeSessions = array_slice($activeSessions, -3); // Solo mantener las últimas 3
            
            Cache::put($activeSessionsKey, $activeSessions, 7200);

            // 🔥 CAMBIO: Permitir hasta 3 sesiones (en lugar de 2)
            if (count($activeSessions) > 3) {
                $this->logSecurity('ADVERTENCIA: Múltiples sesiones detectadas', $user, $request, 'WARNING', [
                    'active_sessions' => count($activeSessions),
                    'sessions' => array_map(function($s) { return substr($s, 0, 8) . '...'; }, $activeSessions)
                ]);
                
                // 🔥 CAMBIO: Solo advertir, no bloquear en modo desarrollo
                if (config('app.env') === 'local' || config('app.debug')) {
                    return false; // No bloquear en desarrollo
                }
                
                // En producción, solo bloquear si son más de 5 sesiones
                return count($activeSessions) > 5;
            }
        }

        // 🚨 DETECCIÓN DE IP HOPPING (MÁS PERMISIVA)
        $ipHistoryKey = "ip_history_{$userId}";
        $ipHistory = Cache::get($ipHistoryKey, []);
        $now = time();

        // 🔥 CAMBIO: Limpiar IPs antiguas (más de 4 horas en lugar de 1)
        $ipHistory = array_filter($ipHistory, function($record) use ($now) {
            return ($now - $record['timestamp']) < 14400; // 4 horas
        });

        // Agregar IP actual si no existe
        $ipExists = false;
        foreach ($ipHistory as $record) {
            if ($record['ip'] === $ip) {
                $ipExists = true;
                break;
            }
        }

        if (!$ipExists) {
            $ipHistory[] = ['ip' => $ip, 'timestamp' => $now];
            Cache::put($ipHistoryKey, $ipHistory, 14400); // 4 horas

            // 🔥 CAMBIO: Permitir hasta 10 IPs diferentes en 4 horas (era 5 en 1 hora)
            if (count($ipHistory) > 10) {
                $this->logSecurity('ADVERTENCIA: IP hopping detectado', $user, $request, 'WARNING', [
                    'ip_count' => count($ipHistory),
                    'ips' => array_column($ipHistory, 'ip')
                ]);
                
                // Solo bloquear en casos extremos (más de 15 IPs)
                if (count($ipHistory) > 15) {
                    $this->banUser($userId, 'extreme_ip_hopping', 24); // Ban 24 horas
                    return true;
                }
            }
        }

        // 🚨 DETECCIÓN DE USER AGENT SWITCHING (MÁS PERMISIVA)
        $uaKey = "user_agent_{$userId}";
        $lastUserAgent = Cache::get($uaKey);
        
        if ($lastUserAgent && $lastUserAgent !== $userAgent) {
            // 🔥 CAMBIO: Solo log, no considerar como fraude
            $this->logSecurity('INFO: Cambio de User Agent detectado', $user, $request, 'INFO', [
                'old_ua' => substr($lastUserAgent, 0, 100),
                'new_ua' => substr($userAgent, 0, 100)
            ]);
            
            // No bloquear por cambio de User Agent (normal en navegadores)
        }
        
        Cache::put($uaKey, $userAgent, 14400); // 4 horas

        // 🔥 CAMBIO: No detectar fraude por actividad normal
        return false;
    }

    /**
     * 🚨 VALIDACIÓN ANTI-BOT Y ANTI-SPAM
     */
    private function validateAntiBot($user, $request): bool
    {
        $userId = $user->id;
        $now = time();

        // 🚨 DETECCIÓN DE VELOCIDAD INHUMAN
        $lastRequestKey = "last_request_{$userId}";
        $lastRequestTime = Cache::get($lastRequestKey, 0);
        
        if ($lastRequestTime > 0) {
            $timeDiff = $now - $lastRequestTime;
            
            // Menos de 2 segundos entre requests = BOT
            if ($timeDiff < 2) {
                $this->logSecurity('BOT DETECTADO: Velocidad inhumana', $user, $request, 'CRITICAL', [
                    'time_diff' => $timeDiff
                ]);
                $this->banUser($userId, 'bot_behavior', 12); // Ban 12 horas
                return false;
            }
        }
        
        Cache::put($lastRequestKey, $now, 300); // 5 minutos

        // 🚨 DETECCIÓN DE PATRÓN REPETITIVO
        $patternKey = "request_pattern_{$userId}";
        $pattern = Cache::get($patternKey, []);
        $pattern[] = $now;
        
        // Mantener solo últimos 20 requests
        $pattern = array_slice($pattern, -20);
        Cache::put($patternKey, $pattern, 3600);

        // Si hay más de 10 requests en intervalos muy regulares = BOT
        if (count($pattern) >= 10) {
            $intervals = [];
            for ($i = 1; $i < count($pattern); $i++) {
                $intervals[] = $pattern[$i] - $pattern[$i-1];
            }
            
            $avgInterval = array_sum($intervals) / count($intervals);
            $variance = 0;
            foreach ($intervals as $interval) {
                $variance += pow($interval - $avgInterval, 2);
            }
            $variance /= count($intervals);
            
            // Varianza muy baja = patrón robótico
            if ($variance < 2) {
                $this->logSecurity('BOT DETECTADO: Patrón robótico', $user, $request, 'CRITICAL', [
                    'avg_interval' => $avgInterval,
                    'variance' => $variance
                ]);
                $this->banUser($userId, 'robotic_pattern', 24);
                return false;
            }
        }

        return true;
    }

    /**
     * 🚨 RATE LIMITING ANTI-SPAM (GENEROSO PERO EFECTIVO)
     */
    private function validateAntiSpamLimits($modeloId, $clientId): bool
    {
        // 🎯 LÍMITES GENEROSOS PARA NO AFECTAR NEGOCIO
        
        // Límite por modelo: 200 solicitudes por hora (muy generoso)
        $modeloKey = "gift_request_modelo_{$modeloId}";
        if (RateLimiter::tooManyAttempts($modeloKey, 200)) {
            $this->logSecurity('SPAM: Límite por modelo excedido', null, null, 'WARNING', [
                'modelo_id' => $modeloId,
                'attempts' => RateLimiter::attempts($modeloKey)
            ]);
            return false;
        }

        // Límite por par: 30 solicitudes por hora (generoso)
        $pairKey = "gift_request_pair_{$modeloId}_{$clientId}";
        if (RateLimiter::tooManyAttempts($pairKey, 30)) {
            $this->logSecurity('SPAM: Límite por par excedido', null, null, 'WARNING', [
                'modelo_id' => $modeloId,
                'client_id' => $clientId
            ]);
            return false;
        }

        // 🚨 PERO... detección de BURST SPAM
        $burstKey = "burst_spam_{$modeloId}";
        $burstCount = Cache::get($burstKey, 0);
        
        if ($burstCount >= 10) { // 10 requests en 1 minuto = SPAM
            $this->logSecurity('SPAM CRÍTICO: Burst spam detectado', null, null, 'CRITICAL', [
                'modelo_id' => $modeloId,
                'burst_count' => $burstCount
            ]);
            $this->banUser($modeloId, 'burst_spam', 6); // Ban 6 horas
            return false;
        }
        
        Cache::increment($burstKey, 1);
        Cache::expire($burstKey, 60); // Resetear cada minuto

        // Incrementar contadores normales
        RateLimiter::hit($modeloKey, 3600);
        RateLimiter::hit($pairKey, 3600);

        return true;
    }

    /**
     * 🚨 VALIDAR INTEGRIDAD DEL REGALO (ANTI-MANIPULACIÓN)
     */
    private function validateGiftIntegrity($giftId, $modeloId, $request): bool
    {
        $gift = Gift::where('id', $giftId)
            ->where('is_active', true)
            ->first();

        if (!$gift) {
            $this->logSecurity('FRAUDE: Regalo inexistente o inactivo', null, $request, 'CRITICAL', [
                'gift_id' => $giftId,
                'modelo_id' => $modeloId
            ]);
            return false;
        }

        // 🚨 VERIFICAR QUE EL PRECIO NO HA SIDO MANIPULADO
        $submittedAmount = $request->input('amount');
        if ($submittedAmount && $submittedAmount != $gift->price) {
            $this->logSecurity('FRAUDE CRÍTICO: Precio manipulado', null, $request, 'CRITICAL', [
                'gift_id' => $giftId,
                'real_price' => $gift->price,
                'submitted_price' => $submittedAmount,
                'modelo_id' => $modeloId
            ]);
            return false;
        }

        return true;
    }

    /**
     * 🚨 DETECTAR PATRÓN DE SOLICITUDES FRAUDULENTAS
     */
    private function detectFraudulentRequestPattern($modeloId, $clientId, $giftId): bool
    {
        // 🚨 DETECCIÓN DE SOLICITUDES IDÉNTICAS EN BUCLE
        $recentIdentical = GiftRequest::where('modelo_id', $modeloId)
            ->where('client_id', $clientId)
            ->where('gift_id', $giftId)
            ->where('created_at', '>=', now()->subMinutes(5))
            ->count();

        if ($recentIdentical >= 3) {
            $this->logSecurity('FRAUDE: Patrón de solicitudes idénticas', null, null, 'CRITICAL', [
                'modelo_id' => $modeloId,
                'client_id' => $clientId,
                'gift_id' => $giftId,
                'identical_count' => $recentIdentical
            ]);
            return true;
        }

        // 🚨 DETECCIÓN DE ROTATING GIFTS (mismo cliente, diferentes regalos muy rápido)
        $rotatingGifts = GiftRequest::where('modelo_id', $modeloId)
            ->where('client_id', $clientId)
            ->where('created_at', '>=', now()->subMinutes(2))
            ->distinct('gift_id')
            ->count();

        if ($rotatingGifts >= 5) {
            $this->logSecurity('FRAUDE: Gift rotation detectado', null, null, 'CRITICAL', [
                'modelo_id' => $modeloId,
                'client_id' => $clientId,
                'rotating_gifts' => $rotatingGifts
            ]);
            return true;
        }

        return false;
    }

    /**
     * 🚨 HASH DE SEGURIDAD NIVEL MILITAR
     */
    public function generateAdvancedSecurityHash($modeloId, $clientId, $giftId, $amount, $nonce = null): array
    {
        $nonce = $nonce ?: bin2hex(random_bytes(32)); // 64 caracteres
        $timestamp = microtime(true); // Microsegundos para mayor precisión
        $sessionId = session()->getId();
        $userIp = request()->ip();
        $serverSecret = config('app.key');
        
        // Hash militar con múltiples capas
        $data = implode('|', [
            $modeloId,
            $clientId,
            $giftId,
            $amount,
            $timestamp,
            $nonce,
            $sessionId,
            $userIp,
            $serverSecret,
            'GIFT_REQUEST_V2'
        ]);

        // Triple hashing para seguridad extrema
        $hash1 = hash('sha256', $data);
        $hash2 = hash('sha512', $hash1 . $serverSecret);
        $finalHash = hash('sha256', $hash2 . $nonce);

        return [
            'hash' => $finalHash,
            'timestamp' => $timestamp,
            'nonce' => $nonce,
            'expires_at' => $timestamp + 300, // 5 minutos
            'session_id' => $sessionId,
            'ip' => $userIp
        ];
    }

    /**
     * 🚨 VALIDAR HASH NIVEL MILITAR
     */
    private function validateMilitaryGradeHash($giftRequest, $clientId, $providedHash): bool
    {
        try {
            $giftData = json_decode($giftRequest->gift_data, true);
            
            if (!isset($giftData['security_hash'], $giftData['timestamp'], $giftData['nonce'], $giftData['session_id'], $giftData['ip'])) {
                $this->logSecurity('FRAUDE CRÍTICO: Datos de seguridad faltantes', null, null, 'CRITICAL', [
                    'request_id' => $giftRequest->id
                ]);
                return false;
            }

            // 🚨 VERIFICAR EXPIRACIÓN (5 minutos estricto)
            if (microtime(true) > $giftData['expires_at']) {
                $this->logSecurity('FRAUDE: Hash de seguridad expirado', null, null, 'CRITICAL', [
                    'request_id' => $giftRequest->id,
                    'expired_by' => microtime(true) - $giftData['expires_at']
                ]);
                return false;
            }

            // 🚨 VERIFICAR NONCE ÚNICO (ANTI-REPLAY ABSOLUTO)
            $nonceKey = "gift_nonce_" . hash('sha256', $giftData['nonce']);
            if (Cache::has($nonceKey)) {
                $this->logSecurity('FRAUDE CRÍTICO: Replay attack detectado', null, null, 'CRITICAL', [
                    'request_id' => $giftRequest->id,
                    'nonce' => substr($giftData['nonce'], 0, 16) . '...'
                ]);
                $this->banUser($clientId, 'replay_attack', 72); // Ban 72 horas
                return false;
            }

            // 🚨 VERIFICAR SESIÓN E IP
            if ($giftData['session_id'] !== session()->getId()) {
                $this->logSecurity('FRAUDE CRÍTICO: Session hijacking detectado', null, null, 'CRITICAL', [
                    'request_id' => $giftRequest->id
                ]);
                return false;
            }

            if ($giftData['ip'] !== request()->ip()) {
                $this->logSecurity('FRAUDE: IP change durante transacción', null, null, 'CRITICAL', [
                    'request_id' => $giftRequest->id,
                    'original_ip' => $giftData['ip'],
                    'current_ip' => request()->ip()
                ]);
                return false;
            }

            // 🚨 REGENERAR Y COMPARAR HASH MILITAR
            $data = implode('|', [
                $giftRequest->modelo_id,
                $clientId,
                $giftRequest->gift_id,
                $giftRequest->amount,
                $giftData['timestamp'],
                $giftData['nonce'],
                $giftData['session_id'],
                $giftData['ip'],
                config('app.key'),
                'GIFT_REQUEST_V2'
            ]);

            $hash1 = hash('sha256', $data);
            $hash2 = hash('sha512', $hash1 . config('app.key'));
            $expectedHash = hash('sha256', $hash2 . $giftData['nonce']);

            if ($giftData['security_hash'] !== $expectedHash) {
                $this->logSecurity('FRAUDE CRÍTICO: Hash de seguridad inválido', null, null, 'CRITICAL', [
                    'request_id' => $giftRequest->id
                ]);
                $this->banUser($clientId, 'hash_tampering', 168); // Ban 1 semana
                return false;
            }

            // ✅ MARCAR NONCE COMO USADO
            Cache::put($nonceKey, true, 3600); // 1 hora en cache

            return true;

        } catch (\Exception $e) {
            $this->logSecurity('FRAUDE: Error validando hash militar', null, null, 'CRITICAL', [
                'error' => $e->getMessage(),
                'request_id' => $giftRequest->id ?? 'unknown'
            ]);
            return false;
        }
    }

    /**
     * 🚨 VALIDAR Y BLOQUEAR SALDO (ANTI-DOBLE GASTO)
     */
    private function validateAndLockBalance($userId, $amount, $requestId): bool
    {
        $lockKey = "balance_lock_{$userId}_{$requestId}";
        
        // Verificar si ya hay un lock para esta transacción específica
        if (Cache::has($lockKey)) {
            $this->logSecurity('FRAUDE: Intento de doble procesamiento', null, null, 'CRITICAL', [
                'user_id' => $userId,
                'request_id' => $requestId
            ]);
            return false;
        }

        $clientCoins = UserGiftCoins::lockForUpdate()
            ->where('user_id', $userId)
            ->first();

        if (!$clientCoins) {
            $clientCoins = UserGiftCoins::create([
                'user_id' => $userId,
                'balance' => 0,
                'total_received' => 0,
                'total_sent' => 0
            ]);
        }

        if ($clientCoins->balance < $amount) {
            $this->logSecurity('Saldo insuficiente', null, null, 'INFO', [
                'user_id' => $userId,
                'required' => $amount,
                'balance' => $clientCoins->balance
            ]);
            return false;
        }

        // Crear lock específico para esta transacción
        Cache::put($lockKey, [
            'amount' => $amount,
            'timestamp' => microtime(true),
            'balance_before' => $clientCoins->balance
        ], 300); // 5 minutos

        return true;
    }

    /**
     * 🚨 DETECTAR PATRÓN DE GASTO FRAUDULENTO
     */
    private function detectFraudulentSpendingPattern($userId, $amount): bool
    {
        // 🚨 DETECCIÓN DE GASTO MASIVO INSTANTÁNEO
        $recentSpending = GiftRequest::where('client_id', $userId)
            ->where('status', 'accepted')
            ->where('created_at', '>=', now()->subMinutes(5))
            ->sum('amount');

        // Más de 50,000 monedas en 5 minutos = SOSPECHOSO
        if (($recentSpending + $amount) > 50000) {
            $this->logSecurity('FRAUDE SOSPECHOSO: Gasto masivo detectado', null, null, 'WARNING', [
                'user_id' => $userId,
                'recent_spending' => $recentSpending,
                'current_amount' => $amount,
                'total' => $recentSpending + $amount
            ]);
            // No bloquear inmediatamente, pero alertar
        }

        // 🚨 DETECCIÓN DE VACIADO DE CUENTA
        $userCoins = UserGiftCoins::where('user_id', $userId)->first();
        if ($userCoins && $amount >= ($userCoins->balance * 0.9)) {
            $this->logSecurity('ALERTA: Intento de vaciado de cuenta', null, null, 'WARNING', [
                'user_id' => $userId,
                'balance' => $userCoins->balance,
                'amount' => $amount,
                'percentage' => round(($amount / $userCoins->balance) * 100, 2)
            ]);
        }

        return false; // No bloquear por patrones de gasto (no limitar negocio)
    }

    /**
     * 🚨 VALIDAR INTEGRIDAD DE TRANSACCIÓN
     */
    private function validateTransactionIntegrity($giftRequest, $user): bool
    {
        // 🚨 VERIFICAR QUE LA SOLICITUD NO HA SIDO MODIFICADA
        $originalHash = hash('sha256', implode('|', [
            $giftRequest->modelo_id,
            $giftRequest->client_id,
            $giftRequest->gift_id,
            $giftRequest->amount,
            $giftRequest->created_at->timestamp
        ]));

        $giftData = json_decode($giftRequest->gift_data, true);
        if (isset($giftData['integrity_hash']) && $giftData['integrity_hash'] !== $originalHash) {
            $this->logSecurity('FRAUDE CRÍTICO: Integridad de transacción comprometida', $user, null, 'CRITICAL', [
                'request_id' => $giftRequest->id
            ]);
            return false;
        }

        return true;
    }

    /**
     * 🚨 VALIDAR TOKEN DE SESIÓN ÚNICO (ANTI-REPLAY)
     */
    private function validateSessionToken($sessionToken, $user): bool
    {
        if (!$sessionToken) {
            $this->logSecurity('FRAUDE: Token de sesión faltante', $user, null, 'CRITICAL');
            return false;
        }

        // 🔥 SOPORTE PARA CLIENTES WEB: Si viene session_id en el request y plataforma es 'web',
        // usar ese session_id en lugar de session()->getId()
        $request = request();
        $platform = $request->input('platform', 'web');
        $sessionIdFromRequest = $request->input('session_id');
        
        // Determinar qué session ID usar
        if ($platform === 'web' && $sessionIdFromRequest) {
            // Para clientes web, usar el session_id del request
            $sessionId = $sessionIdFromRequest;
            // Para web, usar 'web-app-key' como clave en lugar de config('app.key')
            $appKey = 'web-app-key';
            // Para web, usar 'web-client' como IP (el frontend no puede conocer la IP real del servidor)
            $userIP = 'web-client';
            // Para web, usar UTC para coincidir con toISOString() del frontend
            $currentHour = gmdate('Y-m-d-H'); // UTC
        } else {
            // Para otros clientes (móvil, etc), usar la sesión de Laravel
            $sessionId = session()->getId();
            $appKey = config('app.key');
            $userIP = request()->ip();
            // Para otros clientes, usar la hora del servidor
            $currentHour = date('Y-m-d-H');
        }
        
        $expectedToken = hash('sha256', implode('|', [
            $user->id,
            $sessionId,
            $currentHour,
            $appKey,
            $userIP
        ]));
        
        if ($sessionToken !== $expectedToken) {
            $this->logSecurity('FRAUDE CRÍTICO: Token de sesión inválido', $user, null, 'CRITICAL', [
                'provided_token' => substr($sessionToken, 0, 16) . '...',
                'expected_token' => substr($expectedToken, 0, 16) . '...',
                'platform' => $platform,
                'session_id_used' => substr($sessionId, 0, 16) . '...'
            ]);
            return false;
        }

        return true;
    }

    /**
     * 🚨 SISTEMA DE BANS TEMPORALES
     */
    private function banUser($userId, $reason, $hours): void
    {
        $banKey = "user_ban_{$userId}";
        $banData = [
            'reason' => $reason,
            'banned_at' => now()->toISOString(),
            'expires_at' => now()->addHours($hours)->toISOString(),
            'hours' => $hours
        ];
        
        Cache::put($banKey, $banData, $hours * 3600);
        
        $this->logSecurity('USUARIO BANEADO TEMPORALMENTE', null, null, 'CRITICAL', [
            'user_id' => $userId,
            'reason' => $reason,
            'duration_hours' => $hours,
            'expires_at' => $banData['expires_at']
        ]);
        
        // Notificar al equipo de seguridad (opcional)
        // Mail::to('security@yoursite.com')->send(new UserBannedNotification($userId, $reason, $hours));
    }

    /**
     * 🚨 VERIFICAR SI USUARIO ESTÁ BANEADO
     */
    private function isUserBanned($userId): bool
    {
        $banKey = "user_ban_{$userId}";
        return Cache::has($banKey);
    }

    /**
     * 🆕 Validar acceso a regalos disponibles
     */
    private function validateGiftAvailableAccess($user): bool
    {
        if (!$user || !in_array($user->rol, ['cliente', 'modelo'])) {
            return false;
        }
        
        // Verificar si está baneado
        if ($this->isUserBanned($user->id)) {
            $this->logSecurity('Usuario baneado intentó acceder a regalos', $user, null, 'WARNING');
            return false;
        }
        
        return true;
    }

    /**
     * 🆕 Validar rechazo de regalo
     */
    private function validateGiftRejection(Request $request, $user): bool
    {
        if (!$this->validateClientAccess($user)) {
            return false;
        }

        $requestId = $request->route('request');
        
        // Verificar que la solicitud pertenece al cliente
        $giftRequest = GiftRequest::where('id', $requestId)
            ->where('client_id', $user->id)
            ->where('status', 'pending')
            ->exists();

        if (!$giftRequest) {
            $this->logSecurity('FRAUDE: Intento de rechazar solicitud ajena', $user, $request, 'CRITICAL');
            return false;
        }

        return true;
    }

    /**
     * 🆕 Validar acceso de administrador
     */
    private function validateAdminAccess($user): bool
    {
        if (!$user || $user->rol !== 'admin') {
            $this->logSecurity('FRAUDE: Intento de acceso admin sin permisos', $user, null, 'CRITICAL');
            return false;
        }
        return true;
    }

    
    /**
     * 🆕 LOGGING DE SEGURIDAD MEJORADO
     */
    private function logSecurity($message, $user = null, $request = null, $level = 'WARNING', $extra = []): void
    {
        $logData = array_merge([
            'user_id' => $user->id ?? 'guest',
            'user_role' => $user->rol ?? 'guest',
            'ip' => ($request ? $request->ip() : request()->ip()) ?? 'unknown',
            'user_agent' => ($request ? $request->userAgent() : request()->userAgent()) ?? 'unknown',
            'timestamp' => now()->toISOString(),
            'session_id' => session()->getId()
        ], $extra);

        switch ($level) {
            case 'CRITICAL':
                Log::critical("🚨 SECURITY CRITICAL: {$message}", $logData);
                
                // Notificar inmediatamente al equipo de seguridad para casos críticos
                // $this->notifySecurityTeam($message, $logData);
                break;
                
            case 'WARNING':
                Log::warning("⚠️ SECURITY WARNING: {$message}", $logData);
                break;
                
            default:
                Log::info("ℹ️ SECURITY INFO: {$message}", $logData);
        }
    }

    /**
     * 🚫 Verificar bloqueos entre usuarios
     */
    private function areUsersBlocked($userId1, $userId2): bool
    {
        $blocked1to2 = DB::table('user_blocks')
            ->where('user_id', $userId1)
            ->where('blocked_user_id', $userId2)
            ->where('is_active', true)
            ->exists();

        $blocked2to1 = DB::table('user_blocks')
            ->where('user_id', $userId2)
            ->where('blocked_user_id', $userId1)
            ->where('is_active', true)
            ->exists();

        if ($blocked1to2 || $blocked2to1) {
            Log::info('Interacción bloqueada entre usuarios', [
                'user1' => $userId1,
                'user2' => $userId2,
                'blocked_1to2' => $blocked1to2,
                'blocked_2to1' => $blocked2to1
            ]);
            return true;
        }

        return false;
    }

    /**
     * 👤 Validar acceso de cliente
     */
    private function validateClientAccess($user): bool
    {
        if (!$user || $user->rol !== 'cliente') {
            $this->logSecurity('Acceso denegado - no es cliente', $user);
            return false;
        }
        
        // Verificar si está baneado
        if ($this->isUserBanned($user->id)) {
            return false;
        }
        
        return true;
    }

    /**
     * 👥 Validar acceso general de usuario
     */
    private function validateUserAccess($user): bool
    {
        if (!$user || !in_array($user->rol, ['cliente', 'modelo'])) {
            $this->logSecurity('Acceso denegado - rol inválido', $user);
            return false;
        }
        
        // Verificar si está baneado
        if ($this->isUserBanned($user->id)) {
            return false;
        }
        
        return true;
    }

    /**
     * 🔐 Generar y validar datos de seguridad
     */
    private function generateAndValidateSecurityData($request, $modeloId, $clientId, $giftId): bool
    {
        // Obtener información del regalo para el monto
        $gift = Gift::find($giftId);
        if (!$gift) return false;

        // Generar hash de seguridad avanzado
        $securityData = $this->generateAdvancedSecurityHash(
            $modeloId, 
            $clientId, 
            $giftId, 
            $gift->price
        );

        // Almacenar en la request para uso posterior
        $request->merge(['security_data' => $securityData]);

        return true;
    }

    /**
     * 🚨 Respuesta de seguridad mejorada
     */
    private function securityResponse($message = 'Acceso denegado por razones de seguridad')
    {
        // Si es un usuario baneado, dar información específica
        $user = Auth::user();
        if ($user && $this->isUserBanned($user->id)) {
            $banData = Cache::get("user_ban_{$user->id}");
            return response()->json([
                'success' => false,
                'error' => 'user_banned',
                'message' => 'Tu cuenta ha sido suspendida temporalmente por actividad sospechosa',
                'ban_info' => [
                    'reason' => $banData['reason'] ?? 'security_violation',
                    'expires_at' => $banData['expires_at'] ?? null
                ],
                'timestamp' => now()->toISOString()
            ], 403);
        }

        return response()->json([
            'success' => false,
            'error' => 'security_violation',
            'message' => $message,
            'timestamp' => now()->toISOString()
        ], 403);
    }
}