<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Firebase\JWT\JWT;
use App\Models\ChatSession;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use App\Models\UserOnlineStatus;
use Illuminate\Support\Facades\DB;
use App\Models\ChatMessage;
use App\Models\RoomParticipant;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema; 
use App\Http\Controllers\NotificationController;
use Illuminate\Support\Facades\Redis; // 🔥 ESTA LÍNEA FALTABA!
use App\Http\Controllers\VideoChatCoinController;
use App\Models\VideoChatSession;
use App\Models\SessionEarning;
use App\Http\Controllers\SessionEarningsController;
use App\Services\PlatformSettingsService;
use App\Services\CallPricingService;
use App\Models\CoinConsumption;
use App\Helpers\VideoChatLogger;

class LiveKitController extends Controller
{
    protected $coinController;

    public function __construct()
    {
        Log::info('🔧 [DEBUG] LiveKitController constructor iniciando');
        
        try {
            $this->coinController = new VideoChatCoinController();
            Log::info('✅ [DEBUG] coinController inicializado correctamente', [
                'controller_class' => get_class($this->coinController)
            ]);
        } catch (\Exception $e) {
            Log::error('❌ [DEBUG] Error inicializando coinController', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }
     public function generateToken(Request $request)
    {
        VideoChatLogger::start('GENERATE_TOKEN', 'Generando token LiveKit para modelo');
        VideoChatLogger::request('GENERATE_TOKEN', $request);
        
        try {
            // Validar los datos de entrada
            $request->validate([
                'room' => 'required|string'
            ]);

            // 🔥 NORMALIZAR roomName: trim y eliminar espacios extra (igual que frontend)
            $roomNameOriginal = $request->input('room');
            $roomName = preg_replace('/\s+/', '', trim($roomNameOriginal));
            
            VideoChatLogger::log('GENERATE_TOKEN', 'RoomName normalizado', [
                'room_original' => $roomNameOriginal,
                'room_normalized' => $roomName,
                'room_length' => strlen($roomName),
                'room_hex' => bin2hex($roomName),
            ]);
            
            $user = auth()->user();
            if (!$user) {
                VideoChatLogger::error('GENERATE_TOKEN', 'Usuario no autenticado');
                return response()->json(['error' => 'Usuario no autenticado'], 401);
            }

            // 🔥 GENERAR IDENTIDAD ÚNICA basada en user_id + role para evitar DuplicateIdentity
            $participantName = "user_{$user->id}_{$user->rol}";

            VideoChatLogger::log('GENERATE_TOKEN', 'Usuario autenticado', [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'user_name' => $user->name,
                'participant_name' => $participantName,
                'participant_name_length' => strlen($participantName),
                'is_modelo' => $user->rol === 'modelo',
            ]);

            // 🔥 LOG CRÍTICO: Verificar roomName con detalles
            Log::info('🎫 [TOKEN] Generando token LiveKit', [
                'room' => $roomName,
                'room_length' => strlen($roomName),
                'room_hex' => bin2hex($roomName), // Para detectar caracteres especiales
                'identity' => $participantName,
                'identity_length' => strlen($participantName),
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'timestamp' => now()->toIso8601String()
            ]);

            // Obtener credenciales
            $apiKey = config('livekit.api_key');
            $apiSecret = config('livekit.api_secret');
            $serverUrl = config('livekit.ws_url');

            VideoChatLogger::log('GENERATE_TOKEN', 'Credenciales LiveKit obtenidas', [
                'has_api_key' => !empty($apiKey),
                'has_api_secret' => !empty($apiSecret),
                'has_server_url' => !empty($serverUrl),
                'server_url' => $serverUrl,
            ]);

            if (!$apiKey || !$apiSecret || !$serverUrl) {
                VideoChatLogger::error('GENERATE_TOKEN', 'Faltan credenciales de LiveKit', [
                    'has_api_key' => !empty($apiKey),
                    'has_api_secret' => !empty($apiSecret),
                    'has_server_url' => !empty($serverUrl),
                ]);
                throw new \Exception('Faltan credenciales de LiveKit en .env');
            }

            // Crear payload del JWT según especificación de LiveKit
            $now = time();
            $payload = [
                'iss' => $apiKey,
                'sub' => $participantName,
                'iat' => $now,
                'exp' => $now + 3600,
                'video' => [
                    'room' => $roomName,
                    'roomJoin' => true,
                    'canPublish' => true,
                    'canSubscribe' => true,
                    'canPublishData' => true
                ]
            ];
            
            VideoChatLogger::log('GENERATE_TOKEN', 'Payload JWT creado', [
                'payload' => $payload,
                'expires_in' => 3600,
            ]);

            // 🔥 VERIFICAR SALDO ANTES DE GENERAR TOKEN (SOLO CLIENTES)
            if ($user && $user->rol === 'cliente') {
                VideoChatLogger::log('GENERATE_TOKEN', 'Verificando saldo de cliente', [
                    'user_id' => $user->id,
                    'user_role' => $user->rol,
                ]);
                
                $balanceCheck = $this->coinController->canStartVideoChat($user->id);
                
                VideoChatLogger::log('GENERATE_TOKEN', 'Resultado de verificación de saldo', [
                    'can_start' => $balanceCheck['can_start'] ?? false,
                    'total_balance' => $balanceCheck['total_balance'] ?? 0,
                    'balance_check' => $balanceCheck,
                ]);
                
                if (!$balanceCheck['can_start']) {
                    VideoChatLogger::warning('GENERATE_TOKEN', 'Cliente sin saldo intentó obtener token', [
                        'user_id' => $user->id,
                        'balance' => $balanceCheck['total_balance'] ?? 0
                    ]);
                    
                    Log::warning('🚫 Cliente sin saldo intentó obtener token', [
                        'user_id' => $user->id,
                        'balance' => $balanceCheck['total_balance'] ?? 0
                    ]);
                    
                    $response = response()->json([
                        'error' => 'Saldo insuficiente para iniciar videochat',
                        'balance_info' => $balanceCheck,
                        'action' => 'redirect_to_coins'
                    ], 402);
                    
                    VideoChatLogger::response('GENERATE_TOKEN', $response);
                    return $response;
                }
            } else {
                VideoChatLogger::log('GENERATE_TOKEN', 'Usuario es modelo, no se verifica saldo', [
                    'user_role' => $user->rol,
                ]);
            }

            // Generar token JWT
            VideoChatLogger::log('GENERATE_TOKEN', 'Generando token JWT');
            
            $token = JWT::encode($payload, $apiSecret, 'HS256');
            
            VideoChatLogger::log('GENERATE_TOKEN', 'Token JWT generado', [
                'token_length' => strlen($token),
                'token_preview' => substr($token, 0, 50) . '...',
            ]);

            $responseData = [
                'token' => $token,
                'serverUrl' => $serverUrl
            ];
            
            VideoChatLogger::end('GENERATE_TOKEN', 'Token generado exitosamente', [
                'room_name' => $roomName,
                'participant_name' => $participantName,
                'server_url' => $serverUrl,
            ]);

            $response = response()->json($responseData);
            VideoChatLogger::response('GENERATE_TOKEN', $response);
            
            return $response;

        } catch (\Exception $e) {
            VideoChatLogger::error('GENERATE_TOKEN', 'Error generando token LiveKit', [
                'room' => $request->input('room') ?? null,
                'user_id' => auth()->id(),
            ], $e);
            
            \Log::error('Error generating LiveKit token: ' . $e->getMessage());

            $errorResponse = response()->json([
                'error' => 'Error generating token: ' . $e->getMessage()
            ], 500);
            
            VideoChatLogger::response('GENERATE_TOKEN', $errorResponse);
            
            return $errorResponse;
        }
    }

    public function autoConnectWaitingUsers()
    {
        try {
            \Log::info('🔄 Ejecutando auto-conexión de usuarios en espera...');

            $waitingSessions = ChatSession::where('status', 'waiting')
                ->whereNull('modelo_id')
                ->where('created_at', '>=', now()->subMinutes(10))
                ->get();

            \Log::info('🔍 Sesiones en espera encontradas', [
                'count' => $waitingSessions->count()
            ]);

            foreach ($waitingSessions as $session) {
                $waitingUser = User::find($session->cliente_id);

                if (!$waitingUser) {
                    $session->update(['status' => 'ended', 'end_reason' => 'user_not_found']);
                    continue;
                }

                $modeloData = $session->modelo_data ?? [];
                $rolBuscado = $modeloData['waiting_for_role'] ?? ($waitingUser->rol === 'cliente' ? 'modelo' : 'cliente');
                $availableUserIds = $modeloData['available_users'] ?? [];

                if (empty($availableUserIds)) {
                    continue;
                }

                foreach ($availableUserIds as $userId) {
                    $availableUser = User::find($userId);

                    if (!$availableUser || $availableUser->rol !== $rolBuscado) {
                        continue;
                    }

                    $hasActiveSession = ChatSession::where(function ($query) use ($availableUser) {
                        $query->where('cliente_id', $availableUser->id)
                            ->orWhere('modelo_id', $availableUser->id);
                    })->whereIn('status', ['waiting', 'active'])->exists();

                    if (!$hasActiveSession) {
                        DB::beginTransaction();
                        try {
                            $session->update([
                                'modelo_id' => $availableUser->id,
                                'status' => 'active',
                                'started_at' => now()
                            ]);

                            DB::commit();

                            \Log::info('🎉 Auto-conexión exitosa', [
                                'waiting_user_id' => $waitingUser->id,
                                'connected_user_id' => $availableUser->id,
                                'session_id' => $session->id,
                                'room_name' => $session->room_name
                            ]);

                            break;

                        } catch (\Exception $e) {
                            DB::rollback();
                            \Log::error('❌ Error en auto-conexión', [
                                'error' => $e->getMessage(),
                                'session_id' => $session->id
                            ]);
                        }
                    }
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Auto-conexión ejecutada',
                'processed_sessions' => $waitingSessions->count()
            ]);

        } catch (\Exception $e) {
            \Log::error('❌ Error en autoConnectWaitingUsers', [
                'error' => $e->getMessage(),
                'stack_trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error en auto-conexión: ' . $e->getMessage()
            ], 500);
        }
    }

    // ✅ RULETA SIMPLIFICADA - LÓGICA BÁSICA
    public function iniciarRuleta(Request $request)
    {
        try {
            $user = auth()->user();
            
            // Logging detallado para debugging
            Log::info('🎰 [RULETA] Iniciando ruleta', [
                'user_id' => $user ? $user->id : null,
                'user_authenticated' => auth()->check(),
                'user_role' => $user ? $user->rol : null,
                'request_data' => $request->all()
            ]);
            
            if (!$user) {
                Log::warning('❌ [RULETA] Usuario no autenticado');
                return response()->json([
                    'success' => false, 
                    'error' => 'Usuario no autenticado',
                    'debug' => ['authenticated' => auth()->check()]
                ], 401);
            }
            
            if (!in_array($user->rol, ['cliente', 'modelo'])) {
                Log::warning('❌ [RULETA] Rol no válido', [
                    'user_id' => $user->id,
                    'rol' => $user->rol
                ]);
                return response()->json([
                    'success' => false, 
                    'error' => 'Usuario no válido',
                    'debug' => ['rol' => $user->rol, 'allowed_roles' => ['cliente', 'modelo']]
                ], 403);
            }

            // Verificar saldo para clientes
            if ($user->rol === 'cliente') {
                $coinController = new VideoChatCoinController();
                $balanceCheck = $coinController->canStartVideoChat($user->id);
                if (!$balanceCheck['can_start']) {
                    return response()->json([
                        'success' => false,
                        'error' => 'insufficient_balance',
                        'message' => 'Saldo insuficiente',
                        'balance_info' => $balanceCheck
                    ], 400);
                }
            }

            // PASO 1: Limpiar sesiones del usuario
            DB::beginTransaction();
            try {
                ChatSession::where(function($q) use ($user) {
                    $q->where('cliente_id', $user->id)->orWhere('modelo_id', $user->id);
                })->whereIn('status', ['waiting', 'active', 'calling'])
                ->update(['status' => 'ended', 'ended_at' => now(), 'end_reason' => 'cleanup']);
                
                ChatSession::where('status', 'waiting')
                    ->where('created_at', '<', now()->subMinutes(2))
                    ->update(['status' => 'ended', 'ended_at' => now(), 'end_reason' => 'timeout']);
                
                DB::commit();
            } catch (\Exception $e) {
                DB::rollback();
                throw $e;
            }

            // PASO 2: Buscar sesión waiting del rol opuesto
            $rolBuscado = $user->rol === 'cliente' ? 'modelo' : 'cliente';
            $excludedUserId = Cache::get("exclude_user_{$user->id}");
            
            $query = ChatSession::where('status', 'waiting')
                ->where('created_at', '>=', now()->subMinutes(2));
            
            if ($user->rol === 'cliente') {
                $query->whereNotNull('modelo_id')->whereNull('cliente_id')->where('modelo_id', '!=', $user->id);
                if ($excludedUserId) $query->where('modelo_id', '!=', $excludedUserId);
            } else {
                $query->whereNotNull('cliente_id')->whereNull('modelo_id')->where('cliente_id', '!=', $user->id);
                if ($excludedUserId) $query->where('cliente_id', '!=', $excludedUserId);
            }
            
            $sessionWaiting = $query->lockForUpdate()->first();
            
            // PASO 3: Si hay match, conectar
            if ($sessionWaiting) {
                $matchedUserId = $user->rol === 'cliente' ? $sessionWaiting->modelo_id : $sessionWaiting->cliente_id;
                $matchedUser = User::find($matchedUserId);
                
                if (!$matchedUser || $matchedUserId == $excludedUserId) {
                    $sessionWaiting->update(['status' => 'ended', 'end_reason' => 'invalid_match']);
                } else {
                    DB::beginTransaction();
                    try {
                        if ($user->rol === 'cliente') {
                            $sessionWaiting->update([
                                'cliente_id' => $user->id,
                                'status' => 'active',
                                'session_type' => 'call',
                                'call_type' => 'video',
                                'started_at' => now()
                            ]);
                        } else {
                            $sessionWaiting->update([
                                'modelo_id' => $user->id,
                                'status' => 'active',
                                'session_type' => 'call',
                                'call_type' => 'video',
                                'started_at' => now()
                            ]);
                        }
                        DB::commit();
                        
                        return response()->json([
                            'success' => true,
                            'type' => 'match_found',
                            'roomName' => $sessionWaiting->room_name,
                            'room_name' => $sessionWaiting->room_name,
                            'userName' => $user->name ?? "{$user->rol}_{$user->id}",
                            'user_name' => $user->name ?? "{$user->rol}_{$user->id}",
                            'matched_with' => [
                                'id' => $matchedUser->id,
                                'name' => $matchedUser->name ?? "Usuario_{$matchedUser->id}",
                                'role' => $matchedUser->rol
                            ],
                            'session_id' => $sessionWaiting->id,
                            'status' => 'active'
                        ]);
                    } catch (\Exception $e) {
                        DB::rollback();
                        throw $e;
                    }
                }
            }
            
            // PASO 4: No hay match, crear sesión waiting
            $roomName = "omegle_{$user->rol}_{$user->id}_" . time() . "_" . rand(1000, 9999);
            
            DB::beginTransaction();
            try {
                $sessionData = [
                    'room_name' => $roomName,
                    'status' => 'waiting',
                    'session_type' => 'call',
                    'call_type' => 'video',
                    'modelo_data' => [
                        'id' => $user->id,
                        'nombre' => $user->name ?? "Usuario_{$user->id}",
                        'tipo' => $user->rol,
                        'pais' => '🌎'
                    ]
                ];
                
                if ($user->rol === 'cliente') {
                    $sessionData['cliente_id'] = $user->id;
                    $sessionData['modelo_id'] = null;
                } else {
                    $sessionData['cliente_id'] = null;
                    $sessionData['modelo_id'] = $user->id;
                }
                
                $session = ChatSession::create($sessionData);
                DB::commit();
                
                return response()->json([
                    'success' => true,
                    'type' => 'waiting',
                    'roomName' => $roomName,
                    'room_name' => $roomName,
                    'userName' => $user->name ?? "{$user->rol}_{$user->id}",
                    'user_name' => $user->name ?? "{$user->rol}_{$user->id}",
                    'session_id' => $session->id,
                    'status' => 'waiting',
                    'waiting_for' => $rolBuscado
                ]);
            } catch (\Exception $e) {
                DB::rollback();
                throw $e;
            }
            
        } catch (\Exception $e) {
            Log::error('❌ Error iniciando ruleta: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error iniciando ruleta: ' . $e->getMessage()
            ], 500);
        }
    }
    public function findAvailableRooms(Request $request)
    {
        try {
            $user = auth()->user();
            
            $request->validate([
                'userRole' => 'required|string|in:modelo,cliente',
                'lookingFor' => 'required|string|in:modelo,cliente'
            ]);
            
            $userRole = $request->userRole;
            $lookingFor = $request->lookingFor;
            
            \Log::info('🔍 [FIND-ROOMS] Iniciando búsqueda mejorada', [
                'user_id' => $user->id,
                'user_role' => $userRole,
                'looking_for' => $lookingFor
            ]);
            
            // 🔥 PASO 1: BUSCAR SESIONES WAITING CON ESTADO CORRECTO
            $availableSession = null;
            
            if ($lookingFor === 'modelo') {
                // Cliente busca salas creadas por modelos
                $availableSession = ChatSession::where('status', 'waiting')
                    ->whereNotNull('modelo_id')     // Creada por modelo
                    ->whereNull('cliente_id')       // Sin cliente asignado
                    ->where('modelo_id', '!=', $user->id) // No el mismo usuario
                    ->where('created_at', '>=', now()->subMinutes(10)) // Sesiones recientes
                    ->orderBy('created_at', 'asc') // La más antigua primero
                    ->first();
            } else {
                // Modelo busca salas creadas por clientes
                $availableSession = ChatSession::where('status', 'waiting')
                    ->whereNotNull('cliente_id')   // Creada por cliente
                    ->whereNull('modelo_id')       // Sin modelo asignado
                    ->where('cliente_id', '!=', $user->id) // No el mismo usuario
                    ->where('created_at', '>=', now()->subMinutes(10)) // Sesiones recientes
                    ->orderBy('created_at', 'asc') // La más antigua primero
                    ->first();
            }
            
            if (!$availableSession) {
                \Log::info('❌ [FIND-ROOMS] No se encontraron sesiones waiting', [
                    'user_id' => $user->id,
                    'looking_for' => $lookingFor
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'No hay salas disponibles',
                    'availableRoom' => null
                ]);
            }
            
            // 🔥 PASO 2: VERIFICAR QUE EL USUARIO CREADOR ESTÉ REALMENTE ACTIVO
            $creatorId = $lookingFor === 'modelo' ? $availableSession->modelo_id : $availableSession->cliente_id;
            
            // 🔥 VERIFICACIÓN MEJORADA - SIN VERIFICAR LIVEKIT ROOM PRIMERO
            $isCreatorActive = $this->verifyUserIsSearching($creatorId, $availableSession->room_name);
            
            if (!$isCreatorActive) {
                \Log::warning('⚠️ [FIND-ROOMS] Usuario creador no está buscando activamente', [
                    'creator_id' => $creatorId,
                    'room_name' => $availableSession->room_name,
                    'session_id' => $availableSession->id
                ]);
                
                // Limpiar sesión inactiva
                $availableSession->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => 'creator_not_searching'
                ]);
                
                // 🔥 RECURSIÓN PARA BUSCAR OTRA SESIÓN
                return $this->findAvailableRooms($request);
            }
            
            $creator = User::find($creatorId);
            
            \Log::info('✅ [FIND-ROOMS] Sala válida encontrada SIN verificar LiveKit', [
                'user_id' => $user->id,
                'session_id' => $availableSession->id,
                'room_name' => $availableSession->room_name,
                'creator_id' => $creatorId,
                'creator_name' => $creator->name
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Sala disponible encontrada',
                'availableRoom' => [
                    'roomName' => $availableSession->room_name,
                    'sessionId' => $availableSession->id,
                    'creatorId' => $creatorId,
                    'creatorName' => $creator->name,
                    'creatorRole' => $creator->rol,
                    'createdAt' => $availableSession->created_at->toISOString()
                ]
            ]);
            
        } catch (\Exception $e) {
            \Log::error('❌ [FIND-ROOMS] Error buscando salas disponibles', [
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
                'stack_trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error buscando salas: ' . $e->getMessage()
            ], 500);
        }
    }

    private function verifyUserIsSearching($userId, $roomName)
    {
        try {
            \Log::info('🔍 [VERIFY-SEARCHING] Verificando usuario buscando', [
                'user_id' => $userId,
                'room_name' => $roomName
            ]);
            
            // 🔥 VERIFICAR HEARTBEAT RECIENTE CON ESTADO SEARCHING (MÁS PERMISIVO)
            $recentActivity = UserOnlineStatus::where('user_id', $userId)
                ->where('last_seen', '>=', now()->subMinutes(3)) // ✅ CAMBIAR: de 2 a 3 minutos
                ->whereIn('activity_type', ['searching', 'browsing', 'idle']) // ✅ MANTENER: Estados válidos para búsqueda
                ->first();

            if (!$recentActivity) {
                \Log::warning('⚠️ [VERIFY-SEARCHING] Usuario sin actividad reciente', [
                    'user_id' => $userId,
                    'room_name' => $roomName
                ]);
                return false;
            }
            
            // 🔥 ELIMINAR VERIFICACIÓN DE VIDEOCHAT (comentar estas líneas)
            // if (in_array($recentActivity->activity_type, ['videochat', 'videochat_client', 'videochat_model'])) {
            //     \Log::warning('⚠️ [VERIFY-SEARCHING] Usuario ya en videochat', [
            //         'user_id' => $userId,
            //         'activity_type' => $recentActivity->activity_type
            //     ]);
            //     return false;
            // }
            
            // 🔥 VERIFICAR QUE NO ESTÉ EN OTRA SESIÓN ACTIVA (más permisivo)
            $otherActiveSessions = ChatSession::where(function($query) use ($userId) {
                $query->where('cliente_id', $userId)
                    ->orWhere('modelo_id', $userId);
            })
            ->where('room_name', '!=', $roomName) // Diferente a la sala actual
            ->where('status', 'active') // Solo sesiones activas
            ->where('updated_at', '>=', now()->subMinutes(10)) // ✅ CAMBIAR: de 5 a 10 minutos
            ->count();

            if ($otherActiveSessions > 0) {
                \Log::warning('⚠️ [VERIFY-SEARCHING] Usuario tiene otras sesiones activas', [
                    'user_id' => $userId,
                    'other_sessions' => $otherActiveSessions
                ]);
                return false;
            }

            \Log::info('✅ [VERIFY-SEARCHING] Usuario verificado como buscando', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'activity_type' => $recentActivity->activity_type,
                'last_seen' => $recentActivity->last_seen
            ]);

            return true;

        } catch (\Exception $e) {
            \Log::error('❌ [VERIFY-SEARCHING] Error verificando usuario', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
    /**
     * 🔥 NUEVA FUNCIÓN: Verificación más permisiva para conexiones
     */
    private function verifyUserIsSearchingOrActive($userId, $roomName)
    {
        try {
            \Log::info('🔍 [VERIFY-PERMISSIVE] Verificación permisiva', [
                'user_id' => $userId,
                'room_name' => $roomName
            ]);
            
            // Verificación MUY permisiva - últimos 5 minutos
            $recentActivity = UserOnlineStatus::where('user_id', $userId)
                ->where('last_seen', '>=', now()->subMinutes(5))
                ->whereIn('activity_type', ['searching', 'browsing', 'idle', 'videochat', 'videochat_client', 'videochat_model'])
                ->first();

            if (!$recentActivity) {
                \Log::warning('⚠️ [VERIFY-PERMISSIVE] Sin actividad en los últimos 5 minutos', [
                    'user_id' => $userId,
                    'room_name' => $roomName
                ]);
                return false;
            }

            \Log::info('✅ [VERIFY-PERMISSIVE] Usuario verificado permisivamente', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'activity_type' => $recentActivity->activity_type,
                'last_seen' => $recentActivity->last_seen
            ]);

            return true;

        } catch (\Exception $e) {
            \Log::error('❌ [VERIFY-PERMISSIVE] Error en verificación permisiva', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }


    private function verifyLivekitRoomStatus($roomName)
    {
        try {
            \Log::info('🔍 Verificando estado de sala LiveKit', [
                'room_name' => $roomName
            ]);
            
            // Usar tu función existente getParticipants
            $response = $this->getParticipants($roomName);
            
            // Verificar si es una respuesta JSON válida
            if ($response instanceof \Illuminate\Http\JsonResponse) {
                $data = $response->getData(true);
                $participantCount = $data['total_count'] ?? 0;
            } else {
                $participantCount = 0;
            }
            
            \Log::info('📊 Estado de sala LiveKit verificado', [
                'room_name' => $roomName,
                'participant_count' => $participantCount
            ]);
            
            // 🔥 VALIDAR QUE TENGA EXACTAMENTE 1 PARTICIPANTE
            if ($participantCount === 1) {
                return [
                    'valid' => true,
                    'participant_count' => $participantCount,
                    'reason' => 'room_ready'
                ];
            } elseif ($participantCount === 0) {
                return [
                    'valid' => false,
                    'participant_count' => $participantCount,
                    'reason' => 'no_participants'
                ];
            } else {
                return [
                    'valid' => false,
                    'participant_count' => $participantCount,
                    'reason' => 'too_many_participants'
                ];
            }

        } catch (\Exception $e) {
            \Log::error('❌ Error verificando sala LiveKit', [
                'room_name' => $roomName,
                'error' => $e->getMessage()
            ]);
            
            return [
                'valid' => false,
                'participant_count' => 0,
                'reason' => 'verification_error'
            ];
        }
    }

    private function verifyUserIsReallyActive($userId, $roomName)
    {
        try {
            // 1. Verificar heartbeat reciente (últimos 2 minutos - MÁS PERMISIVO)
            $recentActivity = UserOnlineStatus::where('user_id', $userId)
                ->where('last_seen', '>=', now()->subMinutes(2)) // ✅ CAMBIAR: de 45 segundos a 2 minutos
                ->whereIn('activity_type', ['searching', 'browsing', 'videochat', 'videochat_client', 'videochat_model']) // ✅ AGREGAR: 'searching', 'browsing'
                ->first();

            if (!$recentActivity) {
                Log::warning('⚠️ Usuario sin heartbeat reciente', [
                    'user_id' => $userId,
                    'room_name' => $roomName
                ]);
                return false;
            }

            // 2. NO verificar si está en videochat (comentar esta parte)
            // if (in_array($recentActivity->activity_type, ['videochat', 'videochat_client', 'videochat_model'])) {
            //     Log::warning('⚠️ Usuario ya en videochat', [
            //         'user_id' => $userId,
            //         'activity_type' => $recentActivity->activity_type
            //     ]);
            //     return false;
            // }

            // 3. Verificar que no esté en otra sesión activa
            $otherActiveSessions = ChatSession::where(function($query) use ($userId) {
                $query->where('cliente_id', $userId)
                    ->orWhere('modelo_id', $userId);
            })
            ->where('room_name', '!=', $roomName) // Diferente a la sala actual
            ->where('status', 'active') // Solo sesiones activas
            ->where('updated_at', '>=', now()->subMinutes(5))
            ->count();

            if ($otherActiveSessions > 0) {
                Log::warning('⚠️ Usuario tiene otras sesiones activas', [
                    'user_id' => $userId,
                    'other_sessions' => $otherActiveSessions
                ]);
                return false;
            }

            Log::info('✅ Usuario verificado como activo', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'activity_type' => $recentActivity->activity_type,
                'last_seen' => $recentActivity->last_seen
            ]);

            return true;

        } catch (\Exception $e) {
            Log::error('❌ Error verificando usuario activo', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    private function findReallyActiveUsers($currentUserId, $excludeUserId, $roleBuscado)
    {
        try {
            \Log::info('🔍 Buscando usuarios realmente activos', [
                'current_user' => $currentUserId,
                'exclude_user' => $excludeUserId,
                'looking_for_role' => $roleBuscado
            ]);
            
            // 🔥 USAR UserOnlineStatus::getAvailableUsersForChat() mejorado
            $excludeUserIds = array_filter([$currentUserId, $excludeUserId]);
            
            $availableUsers = UserOnlineStatus::getAvailableUsersForChat($roleBuscado, $excludeUserIds);
            
            // 🔥 FILTRAR ADICIONALMENTE POR ESTADOS ESPECÍFICOS
            $filteredUsers = $availableUsers->filter(function($userStatus) {
                // Solo usuarios con actividad reciente (últimos 2 minutos)
                $isRecent = $userStatus->last_seen && $userStatus->last_seen->gt(now()->subMinutes(2));
                
                // Solo estados disponibles para emparejamiento
                $availableStates = ['browsing', 'searching', 'idle'];
                $isAvailable = in_array($userStatus->activity_type, $availableStates);
                
                return $isRecent && $isAvailable;
            });

            // 🔥 VERIFICAR QUE NO TENGAN SESIONES ACTIVAS
            $reallyAvailableUsers = collect();
            
            foreach ($filteredUsers as $userStatus) {
                $hasActiveSession = ChatSession::where(function($query) use ($userStatus) {
                    $query->where('cliente_id', $userStatus->user_id)
                        ->orWhere('modelo_id', $userStatus->user_id);
                })
                ->where('status', 'active')
                ->where('updated_at', '>=', now()->subMinutes(5))
                ->exists();
                
                if (!$hasActiveSession) {
                    $reallyAvailableUsers->push((object)[
                        'id' => $userStatus->user_id,
                        'name' => $userStatus->user->name,
                        'rol' => $userStatus->user->rol,
                        'last_activity' => $userStatus->last_seen
                    ]);
                }
            }

            \Log::info('✅ Usuarios realmente activos encontrados', [
                'current_user' => $currentUserId,
                'excluded_user' => $excludeUserId,
                'total_online' => $availableUsers->count(),
                'filtered_recent' => $filteredUsers->count(),
                'really_available' => $reallyAvailableUsers->count(),
                'users' => $reallyAvailableUsers->pluck('id')->toArray()
            ]);

            return $reallyAvailableUsers;

        } catch (\Exception $e) {
            \Log::error('❌ Error buscando usuarios activos', [
                'error' => $e->getMessage()
            ]);
            
            return collect();
        }
    }


    /**
     * 🏃‍♀️ UNIRSE A SALA EXISTENTE
     */
    public function joinRoom(Request $request)
    {
        try {
            $user = auth()->user();
            
            $request->validate([
                'roomName' => 'required|string',
                'userRole' => 'required|string|in:modelo,cliente'
            ]);
            
            $roomName = $request->roomName;
            $userRole = $request->userRole;
            
            \Log::info('🏃‍♀️ [JOIN-ROOM] Intentando unirse a sala', [
                'user_id' => $user->id,
                'user_role' => $userRole,
                'room_name' => $roomName
            ]);
            
            // 🔥 BUSCAR LA SESIÓN
            $session = ChatSession::where('room_name', $roomName)
                ->where('status', 'waiting')
                ->first();
                
            if (!$session) {
                \Log::warning('❌ [JOIN-ROOM] Sala no encontrada o ya no disponible', [
                    'user_id' => $user->id,
                    'room_name' => $roomName
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Sala no encontrada o ya no disponible'
                ], 404);
            }
            
            // 🔥 VALIDACIONES BÁSICAS
            if ($userRole === 'cliente' && !$session->modelo_id) {
                return response()->json([
                    'success' => false,
                    'error' => 'Esta sala no tiene modelo esperando'
                ], 400);
            }
            
            if ($userRole === 'modelo' && !$session->cliente_id) {
                return response()->json([
                    'success' => false,
                    'error' => 'Esta sala no tiene cliente esperando'
                ], 400);
            }
            
            // 🔥 VERIFICAR QUE NO SEA EL MISMO USUARIO
            if (($userRole === 'cliente' && $session->modelo_id === $user->id) ||
                ($userRole === 'modelo' && $session->cliente_id === $user->id)) {
                
                return response()->json([
                    'success' => false,
                    'error' => 'No puedes unirte a tu propia sala'
                ], 400);
            }
            
            // 🔥 VERIFICAR QUE NO ESTÉ YA OCUPADA
            if (($userRole === 'cliente' && $session->cliente_id) ||
                ($userRole === 'modelo' && $session->modelo_id)) {
                
                return response()->json([
                    'success' => false,
                    'error' => 'Esta sala ya está ocupada'
                ], 409);
            }
            
            // 🔥 UNIRSE A LA SALA INMEDIATAMENTE
            DB::beginTransaction();
            try {
                $updateData = [
                    'status' => 'active', // 🔥 CAMBIAR A ACTIVE INMEDIATAMENTE
                    'started_at' => now()
                ];
                
                if ($userRole === 'cliente') {
                    $updateData['cliente_id'] = $user->id;
                } else {
                    $updateData['modelo_id'] = $user->id;
                }
                
                $session->update($updateData);
                
                DB::commit();
                
                // 🔥 OBTENER INFO DEL OTRO USUARIO
                $otherUserId = ($userRole === 'cliente') ? $session->modelo_id : $session->cliente_id;
                $otherUser = User::find($otherUserId);
                
                \Log::info('✅ [JOIN-ROOM] Usuario unido exitosamente - SESIÓN ACTIVE', [
                    'user_id' => $user->id,
                    'session_id' => $session->id,
                    'room_name' => $roomName,
                    'other_user_id' => $otherUserId,
                    'session_status' => 'active'
                ]);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Unido a sala exitosamente',
                    'roomName' => $roomName,
                    'userName' => $user->name ?? "{$userRole}_{$user->id}",
                    'sessionId' => $session->id,
                    'status' => 'active',
                    'matchedWith' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name ?? "Usuario_{$otherUser->id}",
                        'role' => $otherUser->rol
                    ],
                    'type' => 'joined_existing',
                    'joinedAt' => now()->toISOString()
                ]);
                
            } catch (\Exception $e) {
                DB::rollback();
                throw $e;
            }
            
        } catch (\Exception $e) {
            \Log::error('❌ [JOIN-ROOM] Error uniéndose a sala', [
                'user_id' => auth()->id(),
                'room_name' => $request->roomName ?? 'unknown',
                'error' => $e->getMessage(),
                'stack_trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error uniéndose a sala: ' . $e->getMessage()
            ], 500);
        }
    }





public function nextRoom(Request $request)
{
    $startTime = microtime(true);
    
    try {
        $action = $request->get('action', 'siguiente');
        $reason = $request->get('reason', '');
        $from = $request->get('from', '');
        
        Log::info("🔄 NextRoom iniciado", [
            'user_id' => auth()->id(),
            'action' => $action,
            'reason' => $reason,
            'from' => $from,
            'timestamp' => now()
        ]);
        
        $user = auth()->user();
        $userRole = $user->rol;
        if ($userRole === 'cliente') {
            $coinController = new VideoChatCoinController();
            $balanceCheck = $coinController->canStartVideoChat($user->id);
            
            if (!$balanceCheck['can_start']) {
                Log::warning('🚫 Cliente sin saldo suficiente intentó buscar siguiente', [
                    'user_id' => $user->id,
                    'balance' => $balanceCheck['total_balance'] ?? 0,
                    'deficit' => $balanceCheck['deficit'] ?? 0
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'insufficient_balance',
                    'message' => 'Saldo insuficiente para continuar',
                    'balance_info' => $balanceCheck,
                    'action' => 'end_session'
                ], 400);
            }
            
            Log::info('✅ Cliente con saldo suficiente busca siguiente', [
                'user_id' => $user->id,
                'balance' => $balanceCheck['total_balance'],
                'minutes_available' => $balanceCheck['minutes_available']
            ]);
        } else {
            Log::info('✅ Modelo busca siguiente (sin verificación de saldo)', [
                'user_id' => $user->id,
                'user_role' => $userRole
            ]);
        }
        
        // 🔥 PASO 1: IDENTIFICAR USUARIO ANTERIOR PARA EXCLUIR (MEJORADO)
        $previousUserId = null;
        $previousUserName = null;
        
        // 🔥 PRIORIDAD 1: Usar excludeUserId del request (si viene del frontend)
        $requestExcludeUserId = $request->get('excludeUserId');
        if ($requestExcludeUserId) {
            $previousUserId = $requestExcludeUserId;
            $previousUser = User::find($previousUserId);
            $previousUserName = $previousUser ? ($previousUser->alias ?? $previousUser->name) : 'Unknown';
            
            Log::info("🔍 [EXCLUSION] Usuario a excluir desde request", [
                'current_user_id' => $user->id,
                'current_user_name' => $user->alias ?? $user->name,
                'exclude_user_id' => $previousUserId,
                'exclude_user_name' => $previousUserName,
                'source' => 'request_parameter'
            ]);
        }
        
        // 🔥 PRIORIDAD 2: Si no viene en el request, buscar en sesiones anteriores
        if (!$previousUserId) {
            try {
                $previousSession = DB::table('video_sessions')
                    ->where(function($query) use ($user) {
                        $query->where('cliente_id', $user->id)
                              ->orWhere('modelo_id', $user->id);
                    })
                    ->whereIn('status', ['active', 'waiting']) // 🔥 INCLUIR WAITING TAMBIÉN
                    ->orderBy('updated_at', 'desc')
                    ->first();
                    
                if ($previousSession) {
                    $previousUserId = ($previousSession->cliente_id == $user->id) 
                        ? $previousSession->modelo_id 
                        : $previousSession->cliente_id;
                        
                    if ($previousUserId) {
                        $previousUser = User::find($previousUserId);
                        $previousUserName = $previousUser ? ($previousUser->alias ?? $previousUser->name) : 'Unknown';
                        
                        Log::info("🔍 [EXCLUSION] Usuario anterior identificado desde sesión", [
                            'current_user_id' => $user->id,
                            'current_user_name' => $user->alias ?? $user->name,
                            'previous_user_id' => $previousUserId,
                            'previous_user_name' => $previousUserName,
                            'session_anterior_id' => $previousSession->id,
                            'session_room_name' => $previousSession->room_name,
                            'exclusion_reason' => 'user_went_next',
                            'source' => 'previous_session'
                        ]);
                    }
                }
            } catch (\Exception $e) {
                Log::warning("⚠️ Error identificando usuario anterior: " . $e->getMessage());
            }
        }
        
        // 🔥 GUARDAR EXCLUSIÓN EN CACHE Y SESIÓN SI HAY USUARIO A EXCLUIR
        if ($previousUserId) {
            // Guardar en cache (2 minutos)
            Cache::put("exclude_user_{$user->id}", $previousUserId, now()->addMinutes(2));
            
            // Guardar en sesión (2 minutos)
            session(["exclude_user_{$user->id}" => $previousUserId]);
            session(["exclude_expires_{$user->id}" => now()->addMinutes(2)->timestamp]);
            
            Log::info("✅ [EXCLUSION] Exclusión guardada en cache y sesión", [
                'user_id' => $user->id,
                'excluded_user_id' => $previousUserId,
                'excluded_user_name' => $previousUserName,
                'expires_in_minutes' => 2
            ]);
        }

        // 🔥 PASO 2: LIMPIAR SESIONES ANTERIORES
        $cleanedSessions = DB::table('video_sessions')
            ->where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                      ->orWhere('modelo_id', $user->id);
            })
            ->delete();
            
        Log::info("🧹 Sesiones limpiadas", [
            'user_id' => $user->id,
            'sessions_cleaned' => $cleanedSessions,
            'previous_user_excluded' => $previousUserId
        ]);

        // 🔥 PASO 3: LIMPIAR SESIONES ABANDONADAS
        DB::table('video_sessions')
            ->where('updated_at', '<', now()->subMinutes(10))
            ->delete();

        // 🔥 PASO 4: BUSCAR USUARIO COMPATIBLE CON EXCLUSIÓN REFORZADA
        Log::info("🎯 [SEARCH] Iniciando búsqueda con exclusión", [
            'current_user' => $user->id,
            'current_role' => $userRole,
            'looking_for_role' => $userRole === 'modelo' ? 'cliente' : 'modelo',
            'excluded_user_id' => $previousUserId,
            'excluded_user_name' => $previousUserName
        ]);

        $targetRole = $userRole === 'modelo' ? 'cliente' : 'modelo';
        
        // 🚀 BUSCAR SESIÓN WAITING CON EXCLUSIÓN MÚLTIPLE
        $sessionQuery = DB::table('video_sessions')
            ->join('users', function($join) use ($targetRole) {
                $join->on('users.id', '=', $targetRole === 'cliente' ? 'video_sessions.cliente_id' : 'video_sessions.modelo_id')
                     ->where('users.rol', $targetRole);
            })
            ->where('video_sessions.status', 'waiting')
            ->where('video_sessions.updated_at', '>=', now()->subMinutes(5));
            
        // 🔥 EXCLUSIÓN MÚLTIPLE - RECOPILAR TODOS LOS USUARIOS A EXCLUIR
        $allExcludedUserIds = [];
        
        // 1. Usuario anterior (del request o sesión)
        if ($previousUserId) {
            $allExcludedUserIds[] = $previousUserId;
            Log::info("🚫 [EXCLUSION] Usuario anterior identificado para excluir", [
                'excluded_user_id' => $previousUserId,
                'excluded_user_name' => $previousUserName
            ]);
        }
        
        // 2. Verificar exclusión en cache
        $cacheExcludedUser = Cache::get("exclude_user_{$user->id}");
        if ($cacheExcludedUser && $cacheExcludedUser != $previousUserId && !in_array($cacheExcludedUser, $allExcludedUserIds)) {
            $allExcludedUserIds[] = $cacheExcludedUser;
            Log::info("🚫 [EXCLUSION] Usuario excluido desde cache", [
                'excluded_user_id' => $cacheExcludedUser
            ]);
        }
        
        // 3. Verificar exclusión en sesión
        $sessionExcludedUser = session("exclude_user_{$user->id}");
        $sessionExcludeExpires = session("exclude_expires_{$user->id}");
        
        if ($sessionExcludedUser && $sessionExcludeExpires && $sessionExcludeExpires > now()->timestamp) {
            if ($sessionExcludedUser != $previousUserId && !in_array($sessionExcludedUser, $allExcludedUserIds)) {
                $allExcludedUserIds[] = $sessionExcludedUser;
                Log::info("🚫 [EXCLUSION] Usuario excluido desde sesión", [
                    'excluded_user_id' => $sessionExcludedUser,
                    'expires_at' => date('Y-m-d H:i:s', $sessionExcludeExpires)
                ]);
            }
        } else if ($sessionExcludedUser) {
            // Limpiar exclusión expirada
            session()->forget(["exclude_user_{$user->id}", "exclude_expires_{$user->id}"]);
        }
        
        // 🔥 APLICAR TODAS LAS EXCLUSIONES A LA QUERY
        if (!empty($allExcludedUserIds)) {
            $uniqueExcludedIds = array_unique($allExcludedUserIds);
            $sessionQuery->whereNotIn('users.id', $uniqueExcludedIds);
            Log::info("🚫 [EXCLUSION] Exclusión múltiple aplicada a query", [
                'excluded_user_ids' => $uniqueExcludedIds,
                'total_excluded' => count($uniqueExcludedIds),
                'excluded_names' => array_map(function($id) {
                    $u = User::find($id);
                    return $u ? ($u->alias ?? $u->name) : "User_{$id}";
                }, $uniqueExcludedIds)
            ]);
        }
        
        $waitingSession = $sessionQuery->select('video_sessions.*', 'users.alias', 'users.name', 'users.id as matched_user_id')
            ->orderBy('video_sessions.created_at', 'asc')
            ->first();

            Log::info("🔍 [SEARCH] Resultado búsqueda sesión waiting", [
                'session_found' => !!$waitingSession,
                'session_id' => $waitingSession->id ?? null,
                'matched_user_id' => $waitingSession->matched_user_id ?? null,
                'excluded_previous_user' => $previousUserId,
                'session_excluded_user' => $sessionExcludedUser ?? null
            ]);

        if ($waitingSession) {
            // 🎉 MATCH ENCONTRADO - VERIFICAR QUE NO SEA EL MISMO USUARIO
            $matchedUserId = $waitingSession->matched_user_id;
            $matchedUser = User::find($matchedUserId);
            
            // 🔥 VERIFICAR QUE LA SALA NO ESTÉ CERRADA O FINALIZADA
            $sessionStatus = DB::table('video_sessions')
                ->where('id', $waitingSession->id)
                ->value('status');
            
            if ($sessionStatus !== 'waiting') {
                Log::warning("⚠️ [SEARCH] Sesión encontrada pero no está en estado 'waiting'", [
                    'session_id' => $waitingSession->id,
                    'session_status' => $sessionStatus,
                    'expected_status' => 'waiting'
                ]);
                
                // Buscar otra sesión
                $waitingSession = null;
            } else {
                // 🚨 DOBLE VERIFICACIÓN DE SEGURIDAD - Verificar contra TODOS los usuarios excluidos
                $allExcludedIds = array_unique(array_filter([
                    $previousUserId,
                    Cache::get("exclude_user_{$user->id}"),
                    session("exclude_user_{$user->id}")
                ]));
                
                if (in_array($matchedUserId, $allExcludedIds)) {
                    Log::error("❌ [ERROR] Match con usuario excluido detectado", [
                        'matched_user_id' => $matchedUserId,
                        'excluded_user_ids' => $allExcludedIds,
                        'session_id' => $waitingSession->id,
                        'matched_user_name' => $matchedUser ? ($matchedUser->alias ?? $matchedUser->name) : 'Unknown'
                    ]);
                    
                    // Marcar esta sesión como problemática y buscar otra
                    DB::table('video_sessions')
                        ->where('id', $waitingSession->id)
                        ->update(['status' => 'error', 'end_reason' => 'exclusion_failed']);
                    
                    $waitingSession = null; // Continuar buscando otra sesión
                }
            }
        }
        
        // 🔥 VERIFICAR NUEVAMENTE DESPUÉS DE VALIDACIONES
        if ($waitingSession) {
            $matchedUserId = $waitingSession->matched_user_id;
            $matchedUser = User::find($matchedUserId);
            
            Log::info("✅ [MATCH] Match válido encontrado", [
                'matched_user_id' => $matchedUserId,
                'matched_user_name' => $matchedUser ? ($matchedUser->alias ?? $matchedUser->name) : 'Unknown',
                'is_different_from_previous' => $matchedUserId != $previousUserId ? 'YES - CORRECTO' : 'NO - ERROR',
                'session_room' => $waitingSession->room_name,
                'verification_passed' => true
            ]);

            // 🔥 ACTUALIZAR SESIÓN A 'ACTIVE' Y AGREGAR USUARIO ACTUAL
            DB::table('video_sessions')
                ->where('id', $waitingSession->id)
                ->update([
                    'status' => 'active',
                    'updated_at' => now(),
                    $userRole === 'modelo' ? 'modelo_id' : 'cliente_id' => $user->id,
                ]);

            Log::info("🎉 Match encontrado en nextRoom", [
                'user_id' => $user->id,
                'session_id' => $waitingSession->id,
                'room_name' => $waitingSession->room_name,
                'matched_with_user_id' => $matchedUserId,
                'excluded_previous_user' => $previousUserId,
                'exclusion_working' => true
            ]);

            // 🔥 PREPARAR RESPUESTA PARA USUARIO ACTUAL
            $responseTime = (microtime(true) - $startTime) * 1000;
            
            $response = [
                'success' => true,
                'type' => 'match_found',
                'roomName' => $waitingSession->room_name,
                'userName' => $user->alias ?? $user->name,
                'matched_with' => [
                    'id' => $matchedUserId,
                    'name' => $matchedUser ? ($matchedUser->alias ?? $matchedUser->name) : 'Usuario',
                    'role' => $targetRole
                ],
                'session_id' => $waitingSession->id,
                'response_time_ms' => round($responseTime, 2),
                'exclusion_applied' => $previousUserId ? true : false,
                'excluded_user_id' => $previousUserId
            ];

            // 🔥 NOTIFICACIÓN AL USUARIO MATCHED
            $this->sendSSENotification($matchedUserId, [
                'type' => 'new_match_available',
                'data' => [
                    'type' => 'new_match_available',
                    'room_name' => $waitingSession->room_name,
                    'session_id' => $waitingSession->id,
                    'partner_id' => $user->id,
                    'partner_name' => $user->alias ?? $user->name,
                    'partner_role' => $userRole,
                    'redirect_url' => $targetRole === 'cliente' ? '/videochatclient' : '/videochat',
                    'data' => [
                        'roomName' => $waitingSession->room_name,
                        'userName' => $matchedUser ? ($matchedUser->alias ?? $matchedUser->name) : 'Usuario',
                        'matched_with' => [
                            'id' => $user->id,
                            'name' => $user->alias ?? $user->name,
                            'role' => $userRole
                        ]
                    ]
                ]
            ]);

            return response()->json($response);
        }

        // 🔥 NO HAY MATCH INMEDIATO - CREAR SALA DE ESPERA
        Log::info("⏳ [WAITING] No hay matches válidos, creando sala de espera", [
            'excluded_primary_user' => $previousUserId,
            'excluded_session_user' => $sessionExcludedUser ?? null
        ]);
        
        $roomName = "waiting_{$userRole}_" . $user->id . "_" . time() . "_" . rand(1000, 9999);
        
        $sessionData = [
            'room_name' => $roomName,
            'status' => 'waiting',
            'created_at' => now(),
            'updated_at' => now(),
        ];
        
        if ($userRole === 'modelo') {
            $sessionData['modelo_id'] = $user->id;
            $sessionData['cliente_id'] = null;
        } else {
            $sessionData['cliente_id'] = $user->id;
            $sessionData['modelo_id'] = null;
        }
        
        $sessionId = DB::table('video_sessions')->insertGetId($sessionData);

        Log::info("⏳ Nueva sesión de espera creada", [
            'user_id' => $user->id,
            'user_role' => $userRole,
            'session_id' => $sessionId,
            'room_name' => $roomName,
            'will_exclude_on_match' => $previousUserId
        ]);

        $responseTime = (microtime(true) - $startTime) * 1000;

        return response()->json([
            'success' => true,
            'type' => 'waiting',
            'roomName' => $roomName,
            'userName' => $user->alias ?? $user->name,
            'session_id' => $sessionId,
            'message' => 'Esperando usuario compatible...',
            'response_time_ms' => round($responseTime, 2),
            'exclusion_info' => [
                'excluded_user_id' => $previousUserId,
                'session_excluded_user' => $sessionExcludedUser ?? null
            ]
        ]);

    } catch (\Exception $e) {
        Log::error("❌ Error en nextRoom", [
            'user_id' => auth()->id(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'error' => 'Error procesando solicitud: ' . $e->getMessage()
        ], 500);
    }
}

// 🔥 MÉTODO PARA OBTENER USUARIOS EXCLUIDOS
private function getExcludedUsers($userId)
{
    try {
        $excludedUsers = DB::table('user_exclusions')
            ->where('user_id', $userId)
            ->where('expires_at', '>', now())
            ->pluck('excluded_user_id')
            ->toArray();
            
        Log::info("📋 [EXCLUSION] Usuarios excluidos obtenidos", [
            'user_id' => $userId,
            'excluded_count' => count($excludedUsers),
            'excluded_user_ids' => $excludedUsers
        ]);
        
        return $excludedUsers;
        
    } catch (\Exception $e) {
        Log::warning("⚠️ Error obteniendo exclusiones: " . $e->getMessage());
        return [];
    }
}

// 🔥 MÉTODO PARA LIMPIAR EXCLUSIONES EXPIRADAS (OPCIONAL - PARA CRON)
public function cleanupExpiredExclusions()
{
    try {
        $deleted = DB::table('user_exclusions')
            ->where('expires_at', '<', now())
            ->delete();
            
        Log::info("🧹 Exclusiones expiradas limpiadas", [
            'deleted_count' => $deleted
        ]);
        
        return $deleted;
        
    } catch (\Exception $e) {
        Log::error("❌ Error limpiando exclusiones: " . $e->getMessage());
        return 0;
    }
}
public function endVideoSession(Request $request)
{
    try {
        $request->validate([
            'room_name' => 'required|string',
            'session_duration_seconds' => 'required|integer|min:1'
        ]);
        
        $user = auth()->user();
        
        // Finalizar la sesión normal
        $this->endRoom($request);
        
        // 🔥 PROCESAR CONSUMO DE MONEDAS
        $coinController = new VideoChatCoinController();
        $consumptionResult = $coinController->processPeriodicConsumption($request);
        
        Log::info('🏁 Sesión de videochat finalizada con consumo', [
            'user_id' => $user->id,
            'room_name' => $request->room_name,
            'duration_seconds' => $request->session_duration_seconds,
            'consumption_success' => $consumptionResult->getData()->success ?? false
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Sesión finalizada',
            'consumption_result' => $consumptionResult->getData()
        ]);
        
    } catch (\Exception $e) {
        Log::error('Error finalizando sesión con consumo: ' . $e->getMessage());
        return response()->json(['success' => false, 'error' => 'Error finalizando sesión'], 500);
    }
}

// 🔥 FUNCIÓN CORREGIDA PARA ENVIAR NOTIFICACIONES SSE
private function sendSSENotification($userId, $data)
{
    try {
        Log::info('📨 [SSE] Preparando notificación', [
            'userId' => $userId,
            'type' => $data['type'],
            'data_keys' => array_keys($data['data'] ?? [])
        ]);

        $channel = "user_notifications_{$userId}";
        $message = json_encode($data);
        
        $maxAttempts = 3;
        $subscribers = 0;
        
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                // 🔥 USAR REDIS CLOUD
                $subscribers = \Illuminate\Support\Facades\Redis::publish($channel, $message);
                
                Log::info("📨 [SSE] Notificación enviada (intento {$attempt})", [
                    'userId' => $userId,
                    'type' => $data['type'],
                    'channel' => $channel,
                    'subscribers' => $subscribers
                ]);
                
                if ($subscribers > 0) {
                    Log::info('✅ [SSE] Notificación recibida por subscriptores', [
                        'userId' => $userId,
                        'subscribers' => $subscribers
                    ]);
                    return true;
                }
                
                if ($attempt < $maxAttempts) {
                    usleep(500000); // 0.5 segundos
                }
                
            } catch (\Exception $e) {
                Log::error("❌ [SSE] Error en intento {$attempt}", [
                    'userId' => $userId,
                    'error' => $e->getMessage()
                ]);
            }
        }
        
        Log::warning('⚠️ [SSE] Sin subscribers después de 3 intentos', [
            'userId' => $userId,
            'type' => $data['type'],
            'final_subscribers' => $subscribers
        ]);
        
        // 🔥 GUARDAR EN REDIS COMO FALLBACK
        $redisKey = "user_redirect_{$userId}";
        $redirectData = [
            'type' => $data['type'],
            'data' => $data['data'],
            'timestamp' => time()
        ];
        
        \Illuminate\Support\Facades\Redis::setex($redisKey, 300, json_encode($redirectData)); // 5 minutos
        
        Log::info('🏷️ [SSE] Usuario marcado para redirección en Redis', [
            'userId' => $userId,
            'type' => $data['type'],
            'redis_key' => $redisKey,
            'expires_in' => '5 minutos'
        ]);
        
        return false;
        
    } catch (\Exception $e) {
        Log::error('❌ [SSE] Error crítico enviando notificación', [
            'userId' => $userId,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return false;
    }
}

// 🔥 ENDPOINT PARA POLLING DE REDIRECTS
public function checkRedirect(Request $request)
{
    try {
        $userId = auth()->id();
        $redisKey = "user_redirect_{$userId}";
        
        $redirectData = \Illuminate\Support\Facades\Redis::get($redisKey);
        
        if ($redirectData) {
            $data = json_decode($redirectData, true);
            
            // Limpiar el redirect después de leerlo
            \Illuminate\Support\Facades\Redis::del($redisKey);
            
            Log::info('🔄 [POLLING] Redirect encontrado y enviado', [
                'userId' => $userId,
                'type' => $data['type']
            ]);
            
            return response()->json([
                'success' => true,
                'has_redirect' => true,
                'redirect_data' => $data
            ]);
        }
        
        return response()->json([
            'success' => true,
            'has_redirect' => false
        ]);
        
    } catch (\Exception $e) {
        Log::error('❌ [POLLING] Error verificando redirect', [
            'userId' => auth()->id(),
            'error' => $e->getMessage()
        ]);
        
        return response()->json([
            'success' => false,
            'error' => 'Error verificando redirect'
        ], 500);
    }
}


protected function findReallyActiveUsersOptimized($currentUserId, $excludeUserId, $rolBuscado)
{
    $cacheKey = "active_users_{$rolBuscado}_{$currentUserId}_" . ($excludeUserId ?? 'none');
    
    return Cache::remember($cacheKey, 30, function() use ($currentUserId, $excludeUserId, $rolBuscado) {
        return User::select('id', 'name', 'rol')
            ->where('rol', $rolBuscado)
            ->where('id', '!=', $currentUserId)
            ->when($excludeUserId, function($query) use ($excludeUserId) {
                return $query->where('id', '!=', $excludeUserId);
            })
            ->whereHas('onlineStatus', function($query) {
                $query->where('is_online', true)
                    ->where('last_seen', '>', now()->subMinutes(5));
            })
            ->limit(20)
            ->get();
    });
}

// 🔥 MÉTODO AUXILIAR PARA ENVIAR NOTIFICACIONES SSE



    // Resto de métodos sin cambios...
    public function endRoom(Request $request)
    {
        try {
            $request->validate([
                'roomName' => 'required|string',
                'userName' => 'required|string'
            ]);

            $user = auth()->user();
            $roomName = $request->roomName;

            \Log::info('🛑 Verificando finalización de sala', [
                'user_id' => $user->id,
                'room_name' => $roomName
            ]);

            // Buscar sesiones activas de CHAT
            $chatSessions = ChatSession::where('room_name', $roomName)
                ->whereIn('status', ['waiting', 'active'])
                ->get();

            // Buscar sesiones activas de VIDEOCHAT
            $videoSessions = VideoChatSession::where('room_name', $roomName)
                ->where('status', 'active')
                ->get();

            $now = now();
            $callDurationSeconds = 0;
            $primaryVideoSessionId = null;

            if (!$videoSessions->isEmpty()) {
                foreach ($videoSessions as $session) {
                    $duration = (int) ($session->actual_duration_seconds ?? 0);
                    if ($duration <= 0) {
                        $startedAt = $session->started_at ?? $session->created_at;
                        if ($startedAt) {
                            $duration = $startedAt->diffInSeconds($now);
                        }
                    }

                    if ($duration > $callDurationSeconds) {
                        $callDurationSeconds = $duration;
                        $primaryVideoSessionId = $session->id;
                    }
                }
            }

            if ($chatSessions->isEmpty() && $videoSessions->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se encontró sesión activa para finalizar'
                ], 404);
            }

            // 🎯 OBTENER INFORMACIÓN DE LOS PARTICIPANTES
            $clienteId = null;
            $modeloId = null;
            $endReason = 'manual_stop'; // Por defecto manual

            if (!$chatSessions->isEmpty()) {
                $clienteId = $chatSessions->first()->cliente_id;
                $modeloId = $chatSessions->first()->modelo_id;
            } elseif (!$videoSessions->isEmpty()) {
                // Si solo hay videochat, buscar en chat session por room
                $relatedChat = ChatSession::where('room_name', $roomName)->first();
                if ($relatedChat) {
                    $clienteId = $relatedChat->cliente_id;
                    $modeloId = $relatedChat->modelo_id;
                }
            }

            // 🔥 DESACTIVADO: Ya no verificamos balance para desconectar automáticamente
            // La llamada solo se corta cuando el usuario lo decide manualmente
            if ($clienteId) {
                $balanceCheck = $this->checkClientBalance($clienteId);
                
                // Solo loguear, NO desconectar automáticamente
                if (!$balanceCheck['sufficient']) {
                    \Log::info('⚠️ Saldo bajo detectado, pero NO se cortará automáticamente', [
                        'cliente_id' => $clienteId,
                        'modelo_id' => $modeloId,
                        'room_name' => $roomName,
                        'remaining_balance' => $balanceCheck['balance'],
                        'remaining_minutes' => $balanceCheck['minutes_left']
                    ]);
                    // NO cambiar endReason - el usuario decide cuándo finalizar
                }
            }

            // 🛑 FINALIZAR TODAS LAS SESIONES RELACIONADAS (MEJORADO)
            // 🛑 FINALIZAR TODAS LAS SESIONES RELACIONADAS (MEJORADO - LIMPIEZA AGRESIVA)
            // Esta función ya limpia todas las sesiones de ambos usuarios
            $this->terminateAllRoomSessions($roomName, $clienteId, $modeloId, $endReason);

            // 🧾 Guardar resumen de llamada en el chat privado (no videochat)
            if ($callDurationSeconds > 0 && $clienteId && $modeloId) {
                $chatRoomName = $this->getPrivateChatRoomName($clienteId, $modeloId);
                $durationFormatted = $this->formatCallDuration($callDurationSeconds);
                $callMessageText = "📞 Llamada finalizada ({$durationFormatted})";

                $existingCallMessage = ChatMessage::where('room_name', $chatRoomName)
                    ->where('type', 'call_ended')
                    ->where('extra_data', 'like', '%"call_room_name":"' . $roomName . '"%')
                    ->where('created_at', '>=', $now->copy()->subMinutes(5))
                    ->exists();

                if (!$existingCallMessage) {
                    ChatMessage::create([
                        'room_name' => $chatRoomName,
                        'user_id' => $user->id,
                        'user_name' => $user->name,
                        'user_role' => $user->rol,
                        'message' => $callMessageText,
                        'type' => 'call_ended',
                        'extra_data' => [
                            'duration_seconds' => $callDurationSeconds,
                            'duration_formatted' => $durationFormatted,
                            'call_room_name' => $roomName,
                            'video_session_id' => $primaryVideoSessionId,
                            'end_reason' => $endReason
                        ]
                    ]);
                }
            }
            
            // 🔥 LIMPIEZA ADICIONAL DEL USUARIO ACTUAL (por si acaso)
            // Esto asegura que no queden residuos del usuario que está colgando
            $this->terminateAllUserSessions($user->id, 'user_ended_call_cleanup', $roomName);
            
            Log::info('🧹 Limpieza completa de sesiones al colgar', [
                'user_id' => $user->id,
                'room_name' => $roomName,
                'cliente_id' => $clienteId,
                'modelo_id' => $modeloId
            ]);

            // 🔔 ENVIAR NOTIFICACIONES A AMBOS USUARIOS
            $this->notifyRoomClosure($clienteId, $modeloId, $roomName, $endReason);

            // 📊 PROCESAR GANANCIAS SI HAY VIDEOCHAT
            if (!$videoSessions->isEmpty()) {
                foreach ($videoSessions as $videoSession) {
                    if ($clienteId && $modeloId) {
                        try {
                            $earningsController = new \App\Http\Controllers\SessionEarningsController();
                            $earningsController->processSessionEarnings(
                                $videoSession->id,
                                $modeloId,
                                $clienteId,
                                $roomName
                            );
                            
                            \Log::info('💰 Ganancias procesadas al finalizar sala', [
                                'video_session_id' => $videoSession->id,
                                'modelo_id' => $modeloId,
                                'cliente_id' => $clienteId
                            ]);
                        } catch (\Exception $e) {
                            \Log::error('❌ Error procesando ganancias en endRoom', [
                                'error' => $e->getMessage(),
                                'video_session_id' => $videoSession->id
                            ]);
                        }
                    }
                }
            }

            // 📡 BROADCAST PARA SACAR A AMBOS USUARIOS DE LA SALA
            $this->broadcastRoomClosure($roomName, $clienteId, $modeloId, $endReason);

            $message = $this->getEndMessage($endReason);

            return response()->json([
                'success' => true,
                'message' => $message,
                'end_reason' => $endReason,
                'participants_notified' => true,
                'room_closed' => true
            ]);

        } catch (\Exception $e) {
            \Log::error('❌ Error en endRoom: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error finalizando sala: ' . $e->getMessage()
            ], 500);
        }
    }

/**
 * 💰 Verificar saldo del cliente
 */
private function checkClientBalance($clienteId)
{
    try {
        $userCoins = \App\Models\UserCoins::firstOrCreate(
            ['user_id' => $clienteId],
            [
                'purchased_balance' => 0,
                'gift_balance' => 0,
                'total_purchased' => 0,
                'total_consumed' => 0
            ]
        );

        $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance; // Total para mostrar
        $costPerMinute = VideoChatCoinController::COST_PER_MINUTE;
        // 🔥 CORRECCIÓN: Solo purchased_balance se usa para minutos de llamada
        $minutesLeft = floor($userCoins->purchased_balance / $costPerMinute);

        // 🚨 CRÍTICO: Menos de 2 minutos = finalizar automáticamente
        $sufficient = $minutesLeft >= 2;

        return [
            'sufficient' => $sufficient,
            'balance' => $totalBalance,
            'minutes_left' => $minutesLeft,
            'cost_per_minute' => $costPerMinute
        ];

    } catch (\Exception $e) {
        \Log::error('❌ Error verificando saldo del cliente', [
            'cliente_id' => $clienteId,
            'error' => $e->getMessage()
        ]);

        return [
            'sufficient' => false,
            'balance' => 0,
            'minutes_left' => 0
        ];
    }
}

/**
 * 🛑 Terminar todas las sesiones de la sala
 */
private function terminateAllRoomSessions($roomName, $clienteId, $modeloId, $endReason)
{
    $now = now();

    try {
        DB::beginTransaction();
        
        // 1. FINALIZAR TODAS LAS CHAT SESSIONS DE ESTA SALA (FORZADO - SIN EXCEPCIONES)
        $chatSessionsFinalizadas = ChatSession::where('room_name', $roomName)
            ->whereIn('status', ['waiting', 'active', 'calling']) // Incluir todos los estados activos
            ->update([
                'status' => 'ended',
                'ended_at' => $now,
                'end_reason' => $endReason,
                'updated_at' => $now
            ]);

        \Log::info('✅ Chat sessions finalizadas (forzado)', [
            'room_name' => $roomName,
            'sessions_finalizadas' => $chatSessionsFinalizadas,
            'reason' => $endReason
        ]);

        // 2. FINALIZAR TODAS LAS VIDEO CHAT SESSIONS DE ESTA SALA (FORZADO)
        $videoSessionsFinalizadas = VideoChatSession::where('room_name', $roomName)
            ->whereIn('status', ['active', 'waiting']) // Incluir todos los estados activos
            ->update([
                'status' => 'ended',
                'ended_at' => $now,
                'is_consuming' => false,
                'end_reason' => $endReason,
                'updated_at' => $now
            ]);

        \Log::info('✅ Video chat sessions finalizadas (forzado)', [
            'room_name' => $roomName,
            'sessions_finalizadas' => $videoSessionsFinalizadas,
            'reason' => $endReason
        ]);
        
        // 3. 🔥 LIMPIEZA AGRESIVA: Finalizar TODAS las sesiones de ambos usuarios (no solo de esta sala)
        // Esto previene reconexiones a salas antiguas
        if ($clienteId) {
            $clienteSessionsCleaned = ChatSession::where(function($query) use ($clienteId) {
                $query->where('cliente_id', $clienteId)
                      ->orWhere('modelo_id', $clienteId);
            })
            ->whereIn('status', ['waiting', 'active', 'calling'])
            ->where('room_name', '!=', $roomName) // Excluir la sala actual
            ->update([
                'status' => 'ended',
                'ended_at' => $now,
                'end_reason' => $endReason . '_user_cleanup_all',
                'updated_at' => $now
            ]);
            
            VideoChatSession::where('user_id', $clienteId)
                ->whereIn('status', ['active', 'waiting'])
                ->where('room_name', '!=', $roomName)
                ->update([
                    'status' => 'ended',
                    'ended_at' => $now,
                    'is_consuming' => false,
                    'end_reason' => $endReason . '_user_cleanup_all',
                    'updated_at' => $now
                ]);
            
            \Log::info('🧹 Sesiones del cliente limpiadas completamente', [
                'cliente_id' => $clienteId,
                'sessions_cleaned' => $clienteSessionsCleaned
            ]);
        }
        
        if ($modeloId) {
            $modeloSessionsCleaned = ChatSession::where(function($query) use ($modeloId) {
                $query->where('cliente_id', $modeloId)
                      ->orWhere('modelo_id', $modeloId);
            })
            ->whereIn('status', ['waiting', 'active', 'calling'])
            ->where('room_name', '!=', $roomName) // Excluir la sala actual
            ->update([
                'status' => 'ended',
                'ended_at' => $now,
                'end_reason' => $endReason . '_user_cleanup_all',
                'updated_at' => $now
            ]);
            
            VideoChatSession::where('user_id', $modeloId)
                ->whereIn('status', ['active', 'waiting'])
                ->where('room_name', '!=', $roomName)
                ->update([
                    'status' => 'ended',
                    'ended_at' => $now,
                    'is_consuming' => false,
                    'end_reason' => $endReason . '_user_cleanup_all',
                    'updated_at' => $now
                ]);
            
            \Log::info('🧹 Sesiones del modelo limpiadas completamente', [
                'modelo_id' => $modeloId,
                'sessions_cleaned' => $modeloSessionsCleaned
            ]);
        }
        
        DB::commit();

    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('❌ Error terminando sesiones de la sala', [
            'room_name' => $roomName,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        throw $e;
    }
}

/**
 * 🧹 Terminar todas las sesiones activas o en espera de un usuario específico.
 * @param int $userId
 * @param string $endReason
 * @param string|null $excludeRoomName Opcional: una sala a excluir de la limpieza
 */
private function terminateAllUserSessions(int $userId, string $endReason, ?string $excludeRoomName = null)
{
    $now = now();
    try {
        // Finalizar ChatSessions del usuario
        $queryChat = ChatSession::where(function($query) use ($userId) {
            $query->where('cliente_id', $userId)
                ->orWhere('modelo_id', $userId);
        })
        ->whereIn('status', ['waiting', 'active', 'calling']);

        if ($excludeRoomName) {
            $queryChat->where('room_name', '!=', $excludeRoomName);
        }

        $cleanedChatCount = $queryChat->update([
            'status' => 'ended',
            'ended_at' => $now,
            'end_reason' => $endReason,
            'updated_at' => $now
        ]);

        // Finalizar VideoChatSessions del usuario
        $queryVideoChat = VideoChatSession::where('user_id', $userId)
            ->whereIn('status', ['active', 'waiting']);

        if ($excludeRoomName) {
            $queryVideoChat->where('room_name', '!=', $excludeRoomName);
        }

        $cleanedVideoChatCount = $queryVideoChat->update([
            'status' => 'ended',
            'ended_at' => $now,
            'is_consuming' => false,
            'end_reason' => $endReason,
            'updated_at' => $now
        ]);

        Log::info('🧹 Sesiones de usuario limpiadas', [
            'user_id' => $userId,
            'reason' => $endReason,
            'chat_sessions_cleaned' => $cleanedChatCount,
            'video_chat_sessions_cleaned' => $cleanedVideoChatCount,
            'excluded_room' => $excludeRoomName
        ]);

    } catch (\Exception $e) {
        Log::error('❌ Error en terminateAllUserSessions', [
            'user_id' => $userId,
            'reason' => $endReason,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        throw $e;
    }
}

/**
 * 🔔 Enviar notificaciones a ambos usuarios
 */
private function notifyRoomClosure($clienteId, $modeloId, $roomName, $endReason)
{
    try {
        $message = $this->getNotificationMessage($endReason);
        $urgency = ($endReason === 'insufficient_balance') ? 'high' : 'normal';

        // 🔥 NOTIFICACIÓN room_closed (mantener compatibilidad)
        $notificationData = [
            'type' => 'room_closed',
            'room_name' => $roomName,
            'end_reason' => $endReason,
            'message' => $message,
            'urgency' => $urgency,
            'closed_at' => now()->toISOString()
        ];

        // 🔥 NOTIFICACIÓN partner_left_session (para que el frontend la procese inmediatamente)
        $partnerLeftData = [
            'type' => 'partner_left_session',
            'room_name' => $roomName,
            'end_reason' => $endReason,
            'message' => $message,
            'urgency' => $urgency,
            'closed_at' => now()->toISOString()
        ];

        // Notificar al cliente (ambos tipos de notificación)
        if ($clienteId) {
            \DB::table('notifications')->insert([
                'user_id' => $clienteId,
                'type' => 'room_closed',
                'data' => json_encode($notificationData),
                'read' => false,
                'expires_at' => now()->addHours(24),
                'created_at' => now(),
                'updated_at' => now()
            ]);
            
            // 🔥 NUEVO: También enviar partner_left_session para detección inmediata
            \DB::table('notifications')->insert([
                'user_id' => $clienteId,
                'type' => 'partner_left_session',
                'data' => json_encode($partnerLeftData),
                'read' => false,
                'expires_at' => now()->addHours(24),
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // Notificar a la modelo (ambos tipos de notificación)
        if ($modeloId) {
            \DB::table('notifications')->insert([
                'user_id' => $modeloId,
                'type' => 'room_closed',
                'data' => json_encode($notificationData),
                'read' => false,
                'expires_at' => now()->addHours(24),
                'created_at' => now(),
                'updated_at' => now()
            ]);
            
            // 🔥 NUEVO: También enviar partner_left_session para detección inmediata
            \DB::table('notifications')->insert([
                'user_id' => $modeloId,
                'type' => 'partner_left_session',
                'data' => json_encode($partnerLeftData),
                'read' => false,
                'expires_at' => now()->addHours(24),
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        \Log::info('🔔 Notificaciones de cierre enviadas (room_closed y partner_left_session)', [
            'cliente_id' => $clienteId,
            'modelo_id' => $modeloId,
            'room_name' => $roomName,
            'reason' => $endReason
        ]);

    } catch (\Exception $e) {
        \Log::error('❌ Error enviando notificaciones', [
            'error' => $e->getMessage(),
            'room_name' => $roomName
        ]);
    }
}

/**
 * 📡 Broadcast para cerrar la sala en tiempo real
 */
private function broadcastRoomClosure($roomName, $clienteId, $modeloId, $endReason)
{
    try {
        // Datos para el broadcast
        $broadcastData = [
            'event' => 'room_closed',
            'room_name' => $roomName,
            'end_reason' => $endReason,
            'message' => $this->getEndMessage($endReason),
            'force_disconnect' => true,
            'redirect_to' => '/dashboard', // o donde quieras redirigir
            'closed_at' => now()->toISOString()
        ];

        // Si tienes Pusher/WebSockets configurado:
        // broadcast(new RoomClosedEvent($roomName, $broadcastData))->toOthers();

        // O puedes usar Redis/SSE para notificar en tiempo real
        // \Redis::publish("room.{$roomName}.closed", json_encode($broadcastData));

        \Log::info('📡 Broadcast de cierre de sala enviado', [
            'room_name' => $roomName,
            'data' => $broadcastData
        ]);

    } catch (\Exception $e) {
        \Log::error('❌ Error en broadcast de cierre', [
            'error' => $e->getMessage(),
            'room_name' => $roomName
        ]);
    }
}

/**
 * 📝 Obtener mensaje según la razón de finalización
 */
private function getEndMessage($endReason)
{
    switch ($endReason) {
        case 'insufficient_balance':
            return 'La sala se cerró automáticamente porque el saldo es insuficiente (menos de 2 minutos restantes)';
        case 'manual_stop':
            return 'La sala fue cerrada manualmente';
        case 'no_more_coins':
            return 'La sala se cerró porque se agotaron las monedas';
        case 'timeout':
            return 'La sala se cerró por tiempo de inactividad';
        default:
            return 'La sala ha sido cerrada';
    }
}

/**
 * 🔔 Obtener mensaje de notificación
 */
private function getNotificationMessage($endReason)
{
    switch ($endReason) {
        case 'insufficient_balance':
            return 'Tu sesión de videochat terminó automáticamente porque te quedan menos de 2 minutos de saldo. ¡Recarga monedas para continuar!';
        case 'manual_stop':
            return 'La sesión de videochat ha terminado';
        case 'no_more_coins':
            return 'La sesión terminó porque se agotaron las monedas';
        default:
            return 'Tu sesión de videochat ha terminado';
    }
}


    public function salirDeRuleta(Request $request)
    {
        try {
            $user = auth()->user();
            
            $sessions = ChatSession::where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                      ->orWhere('modelo_id', $user->id);
            })
            ->whereIn('status', ['waiting', 'active'])
            ->get();
            
            $finalizadas = 0;
            foreach ($sessions as $session) {
                $session->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => 'user_exit'
                ]);
                $finalizadas++;
            }
            
            return response()->json([
                'success' => true,
                'message' => "Has salido de la ruleta correctamente. Se limpiaron {$finalizadas} sesión(es)."
            ]);
            
        } catch (\Exception $e) {
            \Log::error('❌ Error saliendo de ruleta: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error saliendo de ruleta: ' . $e->getMessage()
            ], 500);
        }
    }

    // 🔥 NUEVA FUNCIÓN: LIMPIAR SALA (PARA CUANDO SE CIERRA LA PESTAÑA)
    public function cleanupRoom(Request $request)
    {
        try {
            $data = json_decode($request->getContent(), true);

            if (!$data) {
                return response()->json(['error' => 'Datos inválidos'], 400);
            }

            $roomName = $data['roomName'] ?? null;
            $userName = $data['userName'] ?? null;
            $reason = $data['reason'] ?? 'unknown';

            if (!$roomName || !$userName) {
                return response()->json(['error' => 'Faltan parámetros'], 400);
            }

            \Log::info('🧹 Limpiando sala por cierre de pestaña', [
                'room_name' => $roomName,
                'user_name' => $userName,
                'reason' => $reason
            ]);

            // Buscar y finalizar la sesión
            $session = ChatSession::where('room_name', $roomName)
                                 ->whereIn('status', ['waiting', 'active'])
                                 ->first();

            if ($session) {
                $session->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => $reason
                ]);

                \Log::info('✅ Sala limpiada exitosamente', [
                    'session_id' => $session->id,
                    'room_name' => $roomName,
                    'reason' => $reason
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Sala limpiada'
            ]);

        } catch (\Exception $e) {
            \Log::error('❌ Error en cleanupRoom: ' . $e->getMessage());
            
            return response()->json([
                'error' => 'Error limpiando sala'
            ], 500);
        }
    }

    // ✅ VERIFICAR ESTADO DE SESIÓN (PARA POLLING)
    public function verificarEstadoSesion(Request $request)
    {
        try {
            $request->validate([
                'session_id' => 'required|integer'
            ]);
            
            $user = auth()->user();
            $sessionId = $request->session_id;
            
            $session = ChatSession::where('id', $sessionId)
                                 ->where(function($query) use ($user) {
                                     $query->where('cliente_id', $user->id)
                                           ->orWhere('modelo_id', $user->id);
                                 })
                                 ->first();
            
            if (!$session) {
                return response()->json(['error' => 'Sesión no encontrada'], 404);
            }
            
            if ($session->status === 'active') {
                // Obtener info del otro usuario
                $otroUsuarioId = ($session->cliente_id === $user->id) ? $session->modelo_id : $session->cliente_id;
                $otroUsuario = User::find($otroUsuarioId);
                
                return response()->json([
                    'status' => 'active',
                    'roomName' => $session->room_name,
                    'matched_with' => [
                        'id' => $otroUsuario->id,
                        'name' => $otroUsuario->name,
                        'role' => $otroUsuario->rol
                    ]
                ]);
            }
            
            return response()->json([
                'status' => $session->status
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error verificando estado de sesión: ' . $e->getMessage());
            
            return response()->json([
                'error' => 'Error verificando estado: ' . $e->getMessage()
            ], 500);
        }
    }
    public function finalizarSesion(Request $request) {
        try {
            // Manejar diferentes tipos de contenido (JSON y FormData)
            $roomName = null;
            $endReason = 'session_end';
            
            if ($request->isMethod('post')) {
                // Para sendBeacon con FormData
                if ($request->hasFile('room_name') || $request->has('room_name')) {
                    $roomName = $request->input('room_name');
                    $endReason = $request->input('end_reason', 'page_close');
                }
                // Para fetch con JSON
                else {
                    $data = json_decode($request->getContent(), true);
                    if ($data) {
                        $roomName = $data['room_name'] ?? null;
                        $endReason = $data['end_reason'] ?? 'user_disconnect';
                    } else {
                        $roomName = $request->room_name;
                        $endReason = $request->end_reason ?? 'session_end';
                    }
                }
            }
            
            if (!$roomName) {
                return response()->json(['error' => 'room_name requerido'], 400);
            }
            
            $user = auth()->user();
            
            // Buscar la sesión - más flexible para casos de desconexión
            if ($user) {
                $session = ChatSession::where('room_name', $roomName)
                                    ->where(function($query) use ($user) {
                                        $query->where('cliente_id', $user->id)
                                            ->orWhere('modelo_id', $user->id);
                                    })
                                    ->where('status', '!=', 'ended')
                                    ->first();
            } else {
                // Si no hay usuario autenticado (caso de sendBeacon fallido)
                $session = ChatSession::where('room_name', $roomName)
                                    ->where('status', '!=', 'ended')
                                    ->first();
            }
            
            if (!$session) {
                // No es error crítico - puede que ya esté finalizada
                \Log::info('Sesión ya finalizada o no encontrada', [
                    'room_name' => $roomName,
                    'user_id' => $user ? $user->id : null
                ]);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Sesión ya finalizada'
                ]);
            }
            
            // Finalizar sesión
            $session->update([
                'status' => 'ended',
                'ended_at' => now(),
                'end_reason' => $endReason
            ]);
            
            // Log detallado para debugging
            \Log::info('Sesión finalizada exitosamente', [
                'user_id' => $user ? $user->id : null,
                'session_id' => $session->id,
                'room_name' => $roomName,
                'end_reason' => $endReason,
                'duration' => $session->created_at->diffInMinutes(now()) . ' minutos'
            ]);
            
            // Opcionalmente, limpiar datos relacionados
            $this->limpiarDatosRelacionados($session);
            
            return response()->json([
                'success' => true,
                'message' => 'Sesión finalizada correctamente'
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error finalizando sesión', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'error' => 'Error finalizando sesión'
            ], 500);
        }
        }

        public function checkRoom(Request $request) {
            try {
                $user = auth()->user();
                $currentRoom = $request->currentRoom;
                $userName = $request->userName;
                
                Log::info('🔍 Verificando estado de sala para usuario', [
                    'user_id' => $user->id,
                    'current_room' => $currentRoom,
                    'user_name' => $userName
                ]);
                
                // PASO 1: Encontrar la sesión actual para usar como referencia
                $currentSession = ChatSession::where('room_name', $currentRoom)
                    ->where(function($query) use ($user) {
                        $query->where('cliente_id', $user->id)->orWhere('modelo_id', $user->id);
                    })
                    ->first();
                
                if (!$currentSession) {
                    Log::warning('⚠️ Sesión actual no encontrada', [
                        'user_id' => $user->id,
                        'current_room' => $currentRoom
                    ]);
                    
                    return response()->json([
                        'shouldRedirect' => false,
                        'message' => 'Sesión actual no encontrada'
                    ]);
                }
                
                Log::info('📋 Sesión actual encontrada', [
                    'current_session_id' => $currentSession->id,
                    'current_session_status' => $currentSession->status,
                    'current_session_created' => $currentSession->created_at->toISOString()
                ]);
                
                // PASO 2: Solo buscar sesiones ACTIVE y MÁS NUEVAS que la actual
                $newerActiveSession = ChatSession::where(function($query) use ($user) {
                    $query->where('cliente_id', $user->id)->orWhere('modelo_id', $user->id);
                })
                ->where('status', 'active') // SOLO sesiones activas
                ->where('room_name', '!=', $currentRoom) // Diferente sala
                ->where('created_at', '>', $currentSession->created_at) // MÁS NUEVA
                ->orderBy('created_at', 'desc')
                ->first();
                
                if ($newerActiveSession) {
                    Log::info('🎯 Sesión ACTIVA más nueva encontrada', [
                        'user_id' => $user->id,
                        'old_room' => $currentRoom,
                        'old_session_created' => $currentSession->created_at->toISOString(),
                        'new_room' => $newerActiveSession->room_name,
                        'new_session_created' => $newerActiveSession->created_at->toISOString(),
                        'new_session_id' => $newerActiveSession->id
                    ]);
                    
                    return response()->json([
                        'shouldRedirect' => true,
                        'newRoomName' => $newerActiveSession->room_name,
                        'message' => 'Nueva sesión activa detectada'
                    ]);
                }
                
                // PASO 3: Verificar si la sesión actual fue terminada
                if ($currentSession->status === 'ended') {
                    Log::info('⚠️ Sesión actual terminada', [
                        'user_id' => $user->id,
                        'current_room' => $currentRoom,
                        'session_id' => $currentSession->id,
                        'end_reason' => $currentSession->end_reason
                    ]);
                    
                    // 🔥 DEVOLVER INFORMACIÓN DE LA SESIÓN TERMINADA (INCLUYENDO end_reason)
                    return response()->json([
                        'shouldRedirect' => true,
                        'session' => [
                            'id' => $currentSession->id,
                            'room_name' => $currentSession->room_name,
                            'status' => $currentSession->status,
                            'end_reason' => $currentSession->end_reason, // 🔥 CRÍTICO: Incluir razón de finalización
                            'ended_at' => $currentSession->ended_at ? $currentSession->ended_at->toISOString() : null
                        ],
                        'message' => 'Sesión terminada'
                    ]);
                    
                    // Buscar la sesión activa más reciente (si existe)
                    $latestActiveSession = ChatSession::where(function($query) use ($user) {
                        $query->where('cliente_id', $user->id)->orWhere('modelo_id', $user->id);
                    })
                    ->where('status', 'active')
                    ->where('room_name', '!=', $currentRoom)
                    ->orderBy('created_at', 'desc')
                    ->first();
                    
                    if ($latestActiveSession) {
                        Log::info('🔄 Redirigiendo a sesión activa disponible', [
                            'user_id' => $user->id,
                            'new_room' => $latestActiveSession->room_name,
                            'new_session_id' => $latestActiveSession->id
                        ]);
                        
                        return response()->json([
                            'shouldRedirect' => true,
                            'newRoomName' => $latestActiveSession->room_name,
                            'message' => 'Sesión actual terminada, redirigiendo'
                        ]);
                    }
                }
                
                // 🔥 PASO 4: VERIFICACIÓN SIMPLE Y DIRECTA - USAR ENDPOINT EXISTENTE getParticipants
                // Este endpoint ya verifica participantes y devuelve total_count
                $participantCount = null;
                $partnerStatus = null;
                
                try {
                    // Usar el método getParticipants que ya existe y es más confiable
                    $participantsResponse = $this->getParticipants($currentRoom);
                    
                    if ($participantsResponse instanceof \Illuminate\Http\JsonResponse) {
                        $participantsData = $participantsResponse->getData(true);
                        $participantCount = $participantsData['total_count'] ?? 0;
                        
                        Log::info('👥 [CHECK-ROOM] Participantes en LiveKit', [
                            'room_name' => $currentRoom,
                            'participant_count' => $participantCount,
                            'user_id' => $user->id,
                            'participants_data' => $participantsData
                        ]);
                        
                        // 🔥 LÓGICA CONSERVADORA: NO terminar sesión automáticamente por menos de 2 participantes
                        // El frontend debe verificar múltiples veces antes de considerar desconexión
                        // Solo reportar el estado, no terminar la sesión automáticamente
                        if ($participantCount < 2 && $currentSession->status === 'active') {
                            Log::info('⚠️ Menos de 2 participantes detectados (solo hay ' . $participantCount . ' participantes) - Reportando estado pero NO terminando sesión', [
                                'user_id' => $user->id,
                                'room_name' => $currentRoom,
                                'session_id' => $currentSession->id,
                                'participant_count' => $participantCount,
                                'note' => 'El frontend debe verificar múltiples veces antes de considerar desconexión'
                            ]);
                            
                            // 🔥 NO TERMINAR LA SESIÓN AUTOMÁTICAMENTE - Solo reportar el estado
                            // El frontend debe hacer múltiples verificaciones antes de considerar desconexión
                            $partnerStatus = [
                                'participant_count' => $participantCount,
                                'is_active' => false,
                                'warning' => 'Menos de 2 participantes detectados - Verificar múltiples veces antes de desconectar'
                            ];
                        } else {
                            $partnerStatus = [
                                'participant_count' => $participantCount,
                                'is_active' => $participantCount >= 2
                            ];
                        }
                        
                        $partnerStatus = [
                            'participant_count' => $participantCount,
                            'is_active' => $participantCount >= 2
                        ];
                    } else {
                        Log::warning('⚠️ Respuesta inesperada de getParticipants', [
                            'room_name' => $currentRoom,
                            'response_type' => gettype($participantsResponse)
                        ]);
                        $partnerStatus = [
                            'participant_count' => null,
                            'is_active' => null,
                            'error' => 'unexpected_response'
                        ];
                    }
                    
                } catch (\Exception $e) {
                    Log::warning('⚠️ Error verificando participantes de LiveKit', [
                        'error' => $e->getMessage(),
                        'room_name' => $currentRoom,
                        'trace' => $e->getTraceAsString()
                    ]);
                    // Si falla, no terminar sesión (continuar normalmente)
                    $partnerStatus = [
                        'participant_count' => null,
                        'is_active' => null,
                        'error' => 'verification_failed'
                    ];
                }
                
                Log::info('✅ Usuario permanece en sala actual', [
                    'user_id' => $user->id,
                    'room' => $currentRoom,
                    'session_status' => $currentSession->status,
                    'session_id' => $currentSession->id,
                    'participant_count' => $participantCount,
                    'partner_status' => $partnerStatus
                ]);
                
                return response()->json([
                    'shouldRedirect' => false,
                    'session' => [
                        'id' => $currentSession->id,
                        'room_name' => $currentSession->room_name,
                        'status' => $currentSession->status,
                        'end_reason' => $currentSession->end_reason,
                        'created_at' => $currentSession->created_at->toISOString()
                    ],
                    'partner_status' => $partnerStatus,
                    'participant_count' => $participantCount, // 🔥 AGREGAR DIRECTAMENTE PARA FACILITAR ACCESO
                    'partner_id' => $partnerId,
                    'message' => 'Sin cambios'
                ]);
                
            } catch (\Exception $e) {
                Log::error('❌ Error verificando estado de sala', [
                    'error' => $e->getMessage(),
                    'user_id' => auth()->id(),
                    'current_room' => $request->currentRoom ?? 'unknown'
                ]);
                
                return response()->json([
                    'shouldRedirect' => false,
                    'message' => 'Error en verificación'
                ], 200); // Devolver 200 para no romper el frontend
            }
        }
        public function sendChatMessage(Request $request)
        {
            try {
                $request->validate([
                    'room_name' => 'required|string|max:255',
                    'message' => 'required|string|max:500',
                    'type' => 'string|in:text,gift,emoji'
                ]);

                $user = auth()->user();
                $roomName = $request->room_name;
                $message = $request->message;
                $type = $request->type ?? 'text';
                $extraData = $request->extra_data ?? null;

                // Crear mensaje en la base de datos
                $chatMessage = ChatMessage::create([
                    'room_name' => $roomName,
                    'user_id' => $user->id,
                    'user_name' => $user->name,
                    'user_role' => $user->rol,
                    'message' => $message,
                    'type' => $type,
                    'extra_data' => $extraData
                ]);

                \Log::info('💬 Mensaje de chat enviado', [
                    'user_id' => $user->id,
                    'room_name' => $roomName,
                    'message_id' => $chatMessage->id,
                    'type' => $type
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Mensaje enviado correctamente',
                    'data' => [
                        'id' => $chatMessage->id,
                        'user_name' => $chatMessage->user_name,
                        'user_role' => $chatMessage->user_role,
                        'message' => $chatMessage->message,
                        'type' => $chatMessage->type,
                        'timestamp' => $chatMessage->created_at->toISOString(),
                        'room_name' => $chatMessage->room_name
                    ]
                ]);

            } catch (\Exception $e) {
                \Log::error('❌ Error enviando mensaje de chat: ' . $e->getMessage());
                
                return response()->json([
                    'success' => false,
                    'error' => 'Error enviando mensaje: ' . $e->getMessage()
                ], 500);
            }
        }

        public function getParticipants($roomName)
        {
            try {
                $currentUserId = auth()->id();
                if (!$currentUserId) {
                    return response()->json(['success' => false, 'error' => 'Usuario no autenticado'], 401);
                }
                
                Log::info('👥 Obteniendo participantes para sala', [
                    'room_name' => $roomName,
                    'user_id' => $currentUserId
                ]);

                // 🔥 VERIFICACIÓN COMPLETA DE LA SESIÓN
                $session = ChatSession::where('room_name', $roomName)
                    ->whereIn('status', ['active', 'waiting'])
                    ->first();

                if (!$session) {
                    Log::warning('⚠️ No se encontró sesión para sala: ' . $roomName);
                    return response()->json([
                        'success' => true,
                        'participants' => [],
                        'room_name' => $roomName,
                        'total_count' => 0,
                        'session_status' => 'not_found'
                    ]);
                }

                // 🔥 VERIFICAR QUE EL USUARIO ACTUAL PERTENECE A ESTA SESIÓN
                $userBelongsToSession = ($session->cliente_id == $currentUserId) || 
                                    ($session->modelo_id == $currentUserId);
                
                if (!$userBelongsToSession) {
                    Log::warning('❌ Usuario no pertenece a esta sesión', [
                        'user_id' => $currentUserId,
                        'session_cliente' => $session->cliente_id,
                        'session_modelo' => $session->modelo_id,
                        'room_name' => $roomName
                    ]);
                    
                    return response()->json([
                        'success' => false,
                        'error' => 'Acceso denegado a esta sala',
                        'should_redirect' => true,
                        'redirect_to' => '/usersearch'
                    ], 403);
                }

                // 🔥 VERIFICAR QUE AMBOS USUARIOS ESTÁN REALMENTE ACTIVOS
                $participants = [];
                $activeCount = 0;

                if ($session->cliente_id) {
                    $cliente = User::find($session->cliente_id);
                    if ($cliente && $this->verifyUserIsSearchingOrActive($session->cliente_id, $roomName)) {
                        $participants[] = [
                            'id' => $cliente->id,
                            'name' => $cliente->name,
                            'role' => 'cliente',
                            'status' => 'active',
                            'is_current_user' => $cliente->id == $currentUserId,
                            'last_seen' => now()->toISOString()
                        ];
                        $activeCount++;
                    } else {
                        Log::warning('⚠️ Cliente inactivo detectado', [
                            'cliente_id' => $session->cliente_id,
                            'room_name' => $roomName
                        ]);
                        
                        // 🔥 LIMPIAR USUARIO INACTIVO
                        $this->cleanupInactiveUserFromSession($session, 'cliente');
                    }
                }

                if ($session->modelo_id) {
                    $modelo = User::find($session->modelo_id);
                    if ($modelo && $this->verifyUserIsSearchingOrActive($session->modelo_id, $roomName)) {
                        $participants[] = [
                            'id' => $modelo->id,
                            'name' => $modelo->name,
                            'role' => 'modelo',
                            'status' => 'active',
                            'is_current_user' => $modelo->id == $currentUserId,
                            'last_seen' => now()->toISOString()
                        ];
                        $activeCount++;
                    } else {
                        Log::warning('⚠️ Modelo inactivo detectado', [
                            'modelo_id' => $session->modelo_id,
                            'room_name' => $roomName
                        ]);
                        
                        // 🔥 LIMPIAR USUARIO INACTIVO
                        $this->cleanupInactiveUserFromSession($session, 'modelo');
                    }
                }

                // 🔥 SI NO HAY PARTICIPANTES ACTIVOS, FINALIZAR SESIÓN
                if ($activeCount === 0) {
                    Log::warning('🧹 Finalizando sesión sin participantes activos', [
                        'session_id' => $session->id,
                        'room_name' => $roomName
                    ]);
                    
                    $session->update([
                        'status' => 'ended',
                        'ended_at' => now(),
                        'end_reason' => 'no_active_participants'
                    ]);
                    
                    return response()->json([
                        'success' => true,
                        'participants' => [],
                        'total_count' => 0,
                        'session_status' => 'ended',
                        'should_redirect' => true,
                        'redirect_to' => '/usersearch'
                    ]);
                }

                Log::info('✅ Participantes activos verificados', [
                    'room_name' => $roomName,
                    'active_count' => $activeCount,
                    'session_status' => $session->status
                ]);

                return response()->json([
                    'success' => true,
                    'participants' => $participants,
                    'room_name' => $roomName,
                    'total_count' => $activeCount,
                    'session_status' => $session->status,
                    'is_complete' => $activeCount === 2
                ]);

            } catch (\Exception $e) {
                Log::error('❌ Error crítico obteniendo participantes', [
                    'message' => $e->getMessage(),
                    'room_name' => $roomName,
                    'user_id' => $currentUserId ?? 'null'
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Error interno del servidor'
                ], 500);
            }
        }

        // 🔥 NUEVA FUNCIÓN: Limpiar usuarios inactivos de sesiones
        private function cleanupInactiveUserFromSession($session, $userType)
        {
            try {
                $updateData = [
                    'updated_at' => now()
                ];
                
                if ($userType === 'cliente') {
                    $updateData['cliente_id'] = null;
                    Log::info('🧹 Removiendo cliente inactivo de sesión', [
                        'session_id' => $session->id,
                        'room_name' => $session->room_name
                    ]);
                } elseif ($userType === 'modelo') {
                    $updateData['modelo_id'] = null;
                    Log::info('🧹 Removiendo modelo inactivo de sesión', [
                        'session_id' => $session->id,
                        'room_name' => $session->room_name
                    ]);
                }
                
                // Si queda solo 1 usuario, cambiar a waiting
                $remainingUsers = 0;
                if ($session->cliente_id && $userType !== 'cliente') $remainingUsers++;
                if ($session->modelo_id && $userType !== 'modelo') $remainingUsers++;
                
                if ($remainingUsers === 1) {
                    $updateData['status'] = 'waiting';
                    Log::info('📝 Cambiando sesión a waiting - solo queda 1 usuario activo');
                } elseif ($remainingUsers === 0) {
                    $updateData['status'] = 'ended';
                    $updateData['ended_at'] = now();
                    $updateData['end_reason'] = 'all_users_inactive';
                    Log::info('🔚 Finalizando sesión - todos los usuarios inactivos');
                }
                
                $session->update($updateData);
                
            } catch (\Exception $e) {
                Log::error('❌ Error limpiando usuario inactivo', [
                    'error' => $e->getMessage(),
                    'session_id' => $session->id
                ]);
            }
        }


        public function getChatMessages($roomName)
        {
            try {
                $userId = auth()->id();
                if (!$userId) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Usuario no autenticado'
                    ], 401);
                }

                // Verificar acceso
                if (!$this->userHasAccessToRoom($userId, $roomName)) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Acceso denegado a esta sala'
                    ], 403);
                }

                $user = auth()->user();
                $userRole = $user->rol ?? null;
                
                // 🔥 LÓGICA ULTRA SIMPLIFICADA: Consultar TODOS los mensajes directamente
                // Usar una sola consulta que busque en ambos rooms
                $allMessages = ChatMessage::where(function($query) use ($roomName, $userRole) {
                    $query->where('room_name', $roomName);
                    if ($userRole === 'modelo') {
                        $query->orWhere('room_name', $roomName . '_modelo');
                    } elseif ($userRole === 'cliente') {
                        $query->orWhere('room_name', $roomName . '_client');
                    }
                })
                ->orderBy('created_at', 'asc')
                ->limit(200) // Aumentar límite para asegurar que se incluyan todos
                ->get();
                
                // 🔥 DEBUG: Verificar que los mensajes gift_received se están incluyendo
                $giftReceivedInCollection = $allMessages->filter(function($msg) {
                    return $msg->type === 'gift_received';
                });
                
                \Log::info('🔍 [getChatMessages] Verificación después de consulta:', [
                    'total_messages' => $allMessages->count(),
                    'gift_received_count' => $giftReceivedInCollection->count(),
                    'gift_received_ids' => $giftReceivedInCollection->pluck('id')->take(5)->toArray(),
                    'user_role' => $userRole,
                    'room_name' => $roomName,
                    'room_name_modelo' => $roomName . '_modelo',
                    'first_5_types' => $allMessages->take(5)->pluck('type')->toArray()
                ]);
                
                // 4. Mapear mensajes de forma simple y robusta
                $mappedMessages = [];
                $giftReceivedInMapping = 0;
                $processedIds = [];
                
                foreach ($allMessages as $msg) {
                    // Evitar duplicados
                    if (in_array($msg->id, $processedIds)) {
                        continue;
                    }
                    $processedIds[] = $msg->id;
                    
                    // 🔥 DEBUG: Verificar mensajes gift_received durante el mapeo
                    if ($msg->type === 'gift_received') {
                        $giftReceivedInMapping++;
                    }
                    
                    // 🔥 FORZAR tipo explícitamente - no usar ?? 'text' que puede ocultar problemas
                    $msgType = $msg->type;
                    if (empty($msgType)) {
                        $msgType = 'text';
                    }
                    
                    $messageArray = [
                        'id' => $msg->id,
                        'user_id' => $msg->user_id,
                        'user_name' => $msg->user_name ?? 'Usuario',
                        'user_role' => $msg->user_role ?? 'cliente',
                        'message' => $msg->message ?? '',
                        'type' => $msgType, // 🔥 USAR tipo explícito
                        'room_name' => $msg->room_name ?? $roomName,
                        'extra_data' => $msg->extra_data,
                        'timestamp' => $msg->created_at->toISOString(),
                        'created_at' => $msg->created_at->toISOString()
                    ];
                    
                    // Parsear gift_data desde extra_data si es necesario
                    if ($msg->extra_data) {
                        try {
                            $extraData = is_string($msg->extra_data) 
                                ? json_decode($msg->extra_data, true) 
                                : $msg->extra_data;
                            
                            if (is_array($extraData)) {
                                // Si tiene datos de regalo, agregar como gift_data
                                if (isset($extraData['gift_name']) || isset($extraData['gift_image']) || isset($extraData['gift_price'])) {
                                    $messageArray['gift_data'] = $extraData;
                                }
                            }
                        } catch (\Exception $e) {
                            // Ignorar errores de parsing
                        }
                    }
                    
                    // Si tiene gift_data en la columna, usarlo
                    if (isset($msg->gift_data) && $msg->gift_data) {
                        try {
                            $giftData = is_string($msg->gift_data) 
                                ? json_decode($msg->gift_data, true) 
                                : $msg->gift_data;
                            if (is_array($giftData)) {
                                $messageArray['gift_data'] = $giftData;
                            }
                        } catch (\Exception $e) {
                            // Ignorar errores de parsing
                        }
                    }
                    
                    $mappedMessages[] = $messageArray;
                }
                
                // 🔥 SIMPLIFICACIÓN TOTAL: Para modelos, SIEMPRE agregar gift_received directamente
                if ($userRole === 'modelo') {
                    $existingIds = array_map(function($m) { return $m['id'] ?? null; }, $mappedMessages);
                    
                    // Consultar DIRECTAMENTE todos los gift_received
                    $giftReceivedDirect = ChatMessage::where('room_name', $roomName . '_modelo')
                        ->where('type', 'gift_received')
                        ->orderBy('created_at', 'asc')
                        ->get();
                    
                    foreach ($giftReceivedDirect as $msg) {
                        if (!in_array($msg->id, $existingIds)) {
                            // Parsear extra_data
                            $giftData = null;
                            if ($msg->extra_data) {
                                try {
                                    $giftData = is_string($msg->extra_data) ? json_decode($msg->extra_data, true) : $msg->extra_data;
                                } catch (\Exception $e) {
                                    $giftData = null;
                                }
                            }
                            
                            $mappedMessages[] = [
                                'id' => $msg->id,
                                'user_id' => $msg->user_id,
                                'user_name' => $msg->user_name ?? 'Usuario',
                                'user_role' => $msg->user_role ?? 'cliente',
                                'message' => $msg->message ?? '',
                                'type' => 'gift_received', // 🔥 TIPO FIJO
                                'room_name' => $msg->room_name,
                                'extra_data' => $msg->extra_data,
                                'gift_data' => $giftData, // 🔥 AGREGAR gift_data directamente
                                'timestamp' => $msg->created_at->toISOString(),
                                'created_at' => $msg->created_at->toISOString()
                            ];
                            $existingIds[] = $msg->id;
                        }
                    }
                    
                    // Reordenar
                    usort($mappedMessages, function($a, $b) {
                        return strtotime($a['created_at'] ?? '1970-01-01') <=> strtotime($b['created_at'] ?? '1970-01-01');
                    });
                }
                
                // Verificar después de forzar inclusión
                $giftReceivedAfterMapping = array_filter($mappedMessages, function($m) {
                    return ($m['type'] ?? '') === 'gift_received';
                });
                
                // 🔥 FALLBACK FINAL: Si aún no hay gift_received, intentar una vez más
                if (count($giftReceivedAfterMapping) === 0 && $userRole === 'modelo') {
                    // Forzar consulta directa de gift_received
                    $forceGiftReceived = ChatMessage::where('room_name', $roomName . '_modelo')
                        ->where('type', 'gift_received')
                        ->orderBy('created_at', 'asc')
                        ->limit(50)
                        ->get();
                    
                    $existingIds = array_map(function($m) { return $m['id'] ?? null; }, $mappedMessages);
                    
                    foreach ($forceGiftReceived as $msg) {
                        if (!in_array($msg->id, $existingIds)) {
                            $messageArray = [
                                'id' => $msg->id,
                                'user_id' => $msg->user_id,
                                'user_name' => $msg->user_name ?? 'Usuario',
                                'user_role' => $msg->user_role ?? 'cliente',
                                'message' => $msg->message ?? '',
                                'type' => $msg->type,
                                'room_name' => $msg->room_name ?? $roomName,
                                'extra_data' => $msg->extra_data,
                                'timestamp' => $msg->created_at->toISOString(),
                                'created_at' => $msg->created_at->toISOString()
                            ];
                            
                            // Parsear gift_data
                            if ($msg->extra_data) {
                                try {
                                    $extraData = is_string($msg->extra_data) 
                                        ? json_decode($msg->extra_data, true) 
                                        : $msg->extra_data;
                                    if (is_array($extraData) && (isset($extraData['gift_name']) || isset($extraData['gift_image']) || isset($extraData['gift_price']))) {
                                        $messageArray['gift_data'] = $extraData;
                                    }
                                } catch (\Exception $e) {
                                    // Ignorar
                                }
                            }
                            
                            $mappedMessages[] = $messageArray;
                            $existingIds[] = $msg->id;
                        }
                    }
                    
                    // Reordenar por fecha
                    usort($mappedMessages, function($a, $b) {
                        $timeA = strtotime($a['created_at'] ?? $a['timestamp'] ?? '1970-01-01');
                        $timeB = strtotime($b['created_at'] ?? $b['timestamp'] ?? '1970-01-01');
                        return $timeA <=> $timeB;
                    });
                }
                
                // 5. Contar tipos de mensajes DESPUÉS de forzar inclusión
                $giftReceivedCount = 0;
                $giftRequestCount = 0;
                $giftReceivedIds = [];
                $giftRequestIds = [];
                
                foreach ($mappedMessages as $msg) {
                    $msgType = $msg['type'] ?? 'unknown';
                    if ($msgType === 'gift_received') {
                        $giftReceivedCount++;
                        $giftReceivedIds[] = $msg['id'] ?? null;
                    } elseif ($msgType === 'gift_request') {
                        $giftRequestCount++;
                        $giftRequestIds[] = $msg['id'] ?? null;
                    }
                }
                
                // 🔥 VERIFICACIÓN FINAL: Si aún no hay gift_received, algo está mal
                if ($giftReceivedCount === 0 && $userRole === 'modelo') {
                    \Log::error('❌ [getChatMessages] CRÍTICO: No hay gift_received después de forzar inclusión', [
                        'total_mapped' => count($mappedMessages),
                        'room_name' => $roomName,
                        'room_name_modelo' => $roomName . '_modelo',
                        'all_types' => array_count_values(array_map(function($m) { return $m['type'] ?? 'unknown'; }, $mappedMessages))
                    ]);
                }
                
                // 🔥 DEBUG: Verificar conteo después del mapeo
                \Log::info('🔍 [getChatMessages] Después del mapeo:', [
                    'total_mapped' => count($mappedMessages),
                    'gift_received_during_mapping' => $giftReceivedInMapping,
                    'gift_received_count' => $giftReceivedCount,
                    'gift_request_count' => $giftRequestCount,
                    'gift_received_ids' => array_slice($giftReceivedIds, 0, 5),
                    'all_types' => array_count_values(array_map(function($m) { return $m['type'] ?? 'unknown'; }, $mappedMessages)),
                    'first_5_mapped_types' => array_map(function($m) { return $m['type'] ?? 'unknown'; }, array_slice($mappedMessages, 0, 5))
                ]);
                
                // 6. Devolver respuesta simple y directa
                // 🔥 FORZAR conteo final basado en el array real
                $finalGiftReceivedArray = array_filter($mappedMessages, function($m) {
                    return ($m['type'] ?? '') === 'gift_received';
                });
                $finalGiftRequestArray = array_filter($mappedMessages, function($m) {
                    return ($m['type'] ?? '') === 'gift_request';
                });
                
                $finalGiftReceivedCount = count($finalGiftReceivedArray);
                $finalGiftRequestCount = count($finalGiftRequestArray);
                
                $responseData = [
                    'success' => true,
                    'messages' => $mappedMessages,
                    'room_name' => $roomName,
                    'total_count' => count($mappedMessages),
                    'gift_received_count' => $finalGiftReceivedCount, // 🔥 USAR conteo del array
                    'gift_request_count' => $finalGiftRequestCount, // 🔥 USAR conteo del array
                    'debug_info' => [
                        'gift_received_count' => $finalGiftReceivedCount,
                        'gift_request_count' => $finalGiftRequestCount,
                        'gift_received_ids' => array_slice(array_map(function($m) { return $m['id'] ?? null; }, $finalGiftReceivedArray), 0, 10),
                        'gift_request_ids' => array_slice(array_map(function($m) { return $m['id'] ?? null; }, $finalGiftRequestArray), 0, 10),
                        'user_role' => $userRole,
                        'room_base' => $roomName,
                        'room_role' => $userRole === 'modelo' ? $roomName . '_modelo' : ($userRole === 'cliente' ? $roomName . '_client' : null),
                        'total_messages_in_array' => count($mappedMessages),
                        'all_types_count' => array_count_values(array_map(function($m) { return $m['type'] ?? 'unknown'; }, $mappedMessages))
                    ]
                ];
                
                // 🔥 VERIFICACIÓN FINAL: Contar gift_received en el array final
                $finalGiftReceivedCheck = array_filter($mappedMessages, function($m) {
                    return ($m['type'] ?? '') === 'gift_received';
                });
                
                // 🔥 DEBUG: Verificar respuesta final antes de devolver
                \Log::info('🚀 [getChatMessages] RESPUESTA FINAL:', [
                    'total_messages' => count($mappedMessages),
                    'gift_received_count_calculated' => $giftReceivedCount,
                    'gift_received_count_in_array' => count($finalGiftReceivedCheck),
                    'gift_request_count' => $giftRequestCount,
                    'has_debug_info' => isset($responseData['debug_info']),
                    'debug_info_keys' => isset($responseData['debug_info']) ? array_keys($responseData['debug_info']) : [],
                    'gift_received_ids_in_response' => array_slice($giftReceivedIds, 0, 5),
                    'first_10_message_types' => array_map(function($m) { return $m['type'] ?? 'unknown'; }, array_slice($mappedMessages, 0, 10)),
                    'all_types_count' => array_count_values(array_map(function($m) { return $m['type'] ?? 'unknown'; }, $mappedMessages))
                ]);
                
                // 🔥 FORZAR que gift_received_count sea correcto
                $responseData['gift_received_count'] = count($finalGiftReceivedCheck);
                
                return response()->json($responseData);

            } catch (\Exception $e) {
                \Log::error('❌ Error obteniendo mensajes de chat', [
                    'message' => $e->getMessage(),
                    'line' => $e->getLine(),
                    'file' => $e->getFile(),
                    'room_name' => $roomName,
                    'user_id' => auth()->id() ?? 'null'
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'Error interno del servidor',
                    'debug' => app()->environment('local') ? [
                        'message' => $e->getMessage(),
                        'file' => basename($e->getFile()),
                        'line' => $e->getLine()
                    ] : null
                ], 500);
            }
        }

        private function getPrivateChatRoomName(int $userId1, int $userId2): string
        {
            $ids = [$userId1, $userId2];
            sort($ids);
            return "chat_user_{$ids[0]}_{$ids[1]}";
        }

        private function formatCallDuration(int $seconds): string
        {
            $safeSeconds = max(0, $seconds);
            $minutes = floor($safeSeconds / 60);
            $remainingSeconds = $safeSeconds % 60;
            return sprintf('%02d:%02d', $minutes, $remainingSeconds);
        }

        private function getTypingCacheKey(string $roomName): string
        {
            return 'chat_typing_' . $roomName;
        }

        public function setTypingStatus(Request $request)
        {
            $request->validate([
                'room_name' => 'required|string|max:255',
                'is_typing' => 'required|boolean',
            ]);

            $user = auth()->user();
            $roomName = $request->room_name;
            $isTyping = (bool) $request->is_typing;

            $key = $this->getTypingCacheKey($roomName);
            $entries = Cache::get($key, []);
            if (!is_array($entries)) {
                $entries = [];
            }

            $now = now()->timestamp;
            foreach ($entries as $entryUserId => $entry) {
                if (($entry['expires_at'] ?? 0) < $now) {
                    unset($entries[$entryUserId]);
                }
            }

            if ($isTyping) {
                $entries[$user->id] = [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->rol,
                    'expires_at' => now()->addSeconds(7)->timestamp,
                ];
            } else {
                unset($entries[$user->id]);
            }

            Cache::put($key, $entries, now()->addSeconds(10));

            return response()->json([
                'success' => true,
            ]);
        }

        public function getTypingStatus(Request $request, $roomName)
        {
            $user = auth()->user();
            $key = $this->getTypingCacheKey($roomName);
            $entries = Cache::get($key, []);
            if (!is_array($entries)) {
                $entries = [];
            }

            $now = now()->timestamp;
            foreach ($entries as $entryUserId => $entry) {
                if (($entry['expires_at'] ?? 0) < $now) {
                    unset($entries[$entryUserId]);
                }
            }

            Cache::put($key, $entries, now()->addSeconds(10));

            $othersTyping = array_values(array_filter($entries, function ($entry) use ($user) {
                return (int) ($entry['user_id'] ?? 0) !== (int) $user->id;
            }));

            return response()->json([
                'success' => true,
                'is_typing' => count($othersTyping) > 0,
                'typing' => $othersTyping,
            ]);
        }
        
        private function limpiarDatosRelacionados($roomName)
        {
            // Aquí defines la lógica para limpiar participantes, mensajes, etc.
            Log::info("🧼 limpiando datos relacionados con la sala", ['room' => $roomName]);

            // ejemplo opcional:
            ChatMessage::where('room_name', $roomName)->delete();
            RoomParticipant::where('room_name', $roomName)->delete();
        }
        public function cleanupInactiveSessions()
        {
            try {
                \Log::info('🧹 Iniciando limpieza de sesiones inactivas');
                
                // 1. Sesiones waiting muy antiguas (más de 5 minutos)
                $oldWaitingSessions = ChatSession::where('status', 'waiting')
                    ->where('created_at', '<', now()->subMinutes(5))
                    ->get();
                    
                foreach ($oldWaitingSessions as $session) {
                    $session->update([
                        'status' => 'ended',
                        'ended_at' => now(),
                        'end_reason' => 'waiting_timeout'
                    ]);
                }
                
                // 2. Sesiones activas con usuarios offline
                $activeSessions = ChatSession::where('status', 'active')
                    ->where('updated_at', '>=', now()->subMinutes(10)) // Solo las relativamente recientes
                    ->get();
                    
                $cleanedSessions = 0;
                foreach ($activeSessions as $session) {
                    $clienteActive = $session->cliente_id ? $this->verifyUserIsSearchingOrActive($session->cliente_id, $session->room_name) : true;
                    $modeloActive = $session->modelo_id ? $this->verifyUserIsSearchingOrActive($session->modelo_id, $session->room_name) : true;
                    
                    if (!$clienteActive || !$modeloActive) {
                        $session->update([
                            'status' => 'ended',
                            'ended_at' => now(),
                            'end_reason' => 'user_inactive'
                        ]);
                        $cleanedSessions++;
                    }
                }
                
                \Log::info('✅ Limpieza completada', [
                    'old_waiting_cleaned' => $oldWaitingSessions->count(),
                    'inactive_sessions_cleaned' => $cleanedSessions
                ]);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Limpieza completada',
                    'cleaned' => [
                        'old_waiting' => $oldWaitingSessions->count(),
                        'inactive_sessions' => $cleanedSessions
                    ]
                ]);
                
            } catch (\Exception $e) {
                \Log::error('❌ Error en limpieza de sesiones', [
                    'error' => $e->getMessage()
                ]);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Error en limpieza: ' . $e->getMessage()
                ], 500);
            }
        }
        /**
         * 🚀 Verificación ligera de estado de sala (optimizada para alta frecuencia)
         * Solo retorna información esencial para reducir carga del servidor
         */
        // app/Http/Controllers/LiveKitController.php

    public function modelLeaving(Request $request) 
    {
        $roomName = $request->currentRoom;
        $modelUserName = $request->userName;
        $action = $request->action;
        $partnerId = $request->partnerId; // ID del CLIENTE
        
        // 🔥 LA MODELO ESTÁ SALIENDO
        $modeloId = auth()->id();
        
        \Log::info('🚪 [SERVER] Modelo saliendo', [
            'room' => $roomName,
            'modelo_user' => $modelUserName,
            'modelo_id' => $modeloId,
            'action' => $action,
            'cliente_id' => $partnerId
        ]);
        
        // 🔥 DESACTIVADO: Ya no notificamos automáticamente cuando un usuario sale
        // Solo se desconecta cuando el usuario presiona el botón manualmente
        Log::info('⏸️ [SERVER] Modelo saliendo - NO se enviará notificación automática', [
            'room' => $roomName,
            'modelo_id' => $modeloId,
            'cliente_id' => $partnerId,
            'note' => 'Desconexiones automáticas desactivadas'
        ]);
        
        return response()->json(['success' => true]);
    }
    public function clientLeaving(Request $request) 
    {
        $roomName = $request->currentRoom;
        $clientUserName = $request->userName;
        $action = $request->action;
        $partnerId = $request->partnerId; // ID de la MODELO
        
        // 🔥 EL CLIENTE ESTÁ SALIENDO
        $clienteId = auth()->id();
        
        \Log::info('🚪 [SERVER] Cliente saliendo', [
            'room' => $roomName,
            'cliente_user' => $clientUserName,
            'cliente_id' => $clienteId,
            'action' => $action,
            'modelo_id' => $partnerId
        ]);
        
        // 🔥 DESACTIVADO: Ya no notificamos automáticamente cuando un usuario sale
        // Solo se desconecta cuando el usuario presiona el botón manualmente
        Log::info('⏸️ [SERVER] Cliente saliendo - NO se enviará notificación automática', [
            'room' => $roomName,
            'cliente_id' => $clienteId,
            'modelo_id' => $partnerId,
            'note' => 'Desconexiones automáticas desactivadas'
        ]);
        
        return response()->json(['success' => true]);
    }

/**
 * Obtener participantes de una sala LiveKit
 */
    private function getRoomParticipants($roomName)
    {
        try {
            // Usar tu configuración de LiveKit existente
            $livekit = new \Agence104\LiveKit\LiveKit(
                config('livekit.api_key'),
                config('livekit.secret_key'),
                config('livekit.url')
            );

            $participants = $livekit->listParticipants($roomName);
            return $participants;

        } catch (Exception $e) {
            Log::error("❌ Error obteniendo participantes de sala: {$e->getMessage()}");
            return [];
        }
    }
    public function nextUser(Request $request) 
    {
    return $this->nextRoom($request); // Reutilizar lógica existente
    }

    public function markRoomActive(Request $request) {
        \Log::info('Sala activa: ' . $request->roomName);
        return response()->json(['success' => true]);
    }
    public function notifyPartnerNext(Request $request)
    {
        try {
            $user = auth()->user();
            $roomName = $request->input('roomName');
            
            Log::info('🔄 [SIGUIENTE] Usuario solicitando siguiente', [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'room_name' => $roomName
            ]);
            
            // 1. Buscar la sesión actual
            $session = ChatSession::where('room_name', $roomName)
                ->whereIn('status', ['active', 'waiting'])
                ->first();
                
            if (!$session) {
                return response()->json(['success' => false, 'error' => 'Sesión no encontrada']);
            }
            
            // 2. Identificar al partner
            $partnerUserId = null;
            if ($session->cliente_id == $user->id) {
                $partnerUserId = $session->modelo_id;
            } elseif ($session->modelo_id == $user->id) {
                $partnerUserId = $session->cliente_id;
            }
            
            if (!$partnerUserId) {
                return response()->json(['success' => false, 'error' => 'Partner no encontrado']);
            }
            
            $partner = User::find($partnerUserId);
            if (!$partner) {
                return response()->json(['success' => false, 'error' => 'Usuario partner no existe']);
            }
            
            // 🔥 2.5. GUARDAR EXCLUSIÓN MUTUA EN CACHE (2 MINUTOS)
            $excludeExpireMinutes = 2;
            
            // Exclusión para el usuario actual (excluir al partner)
            Cache::put("exclude_user_{$user->id}", $partnerUserId, now()->addMinutes($excludeExpireMinutes));
            
            // Exclusión para el partner (excluir al usuario actual)
            Cache::put("exclude_user_{$partnerUserId}", $user->id, now()->addMinutes($excludeExpireMinutes));
            
            Log::info('🚫 [SIGUIENTE] Exclusión mutua guardada', [
                'user_id' => $user->id,
                'user_name' => $user->alias ?? $user->name,
                'partner_id' => $partnerUserId,
                'partner_name' => $partner->alias ?? $partner->name,
                'exclude_expires_at' => now()->addMinutes($excludeExpireMinutes)->toDateTimeString(),
                'exclusion_duration_minutes' => $excludeExpireMinutes
            ]);
            
            // 3. Finalizar sesión
            $session->update([
                'status' => 'ended',
                'ended_at' => now(),
                'end_reason' => 'user_went_next'
            ]);
            
            // 4. Guardar notificación en BD
            DB::table('notifications')->insert([
                'user_id' => $partnerUserId,
                'type' => 'partner_went_next',
                'data' => json_encode([
                    'message' => 'Tu partner fue a buscar otra persona',
                    'partner_name' => $user->name,
                    'redirect_url' => '/usersearch',
                    'redirect_params' => [
                        'role' => $partner->rol,
                        'from' => 'partner_went_next',
                        'excludeUser' => $user->id,
                        'excludeUserName' => $user->name,
                        'action' => 'siguiente'
                    ]
                ]),
                'read' => false,
                'expires_at' => now()->addMinutes(5),
                'created_at' => now(),
                'updated_at' => now()
            ]);
            
            Log::info('✅ [SIGUIENTE] Partner notificado via BD', [
                'partner_id' => $partnerUserId,
                'partner_name' => $partner->name
            ]);
            
            return response()->json(['success' => true]);
            
        } catch (\Exception $e) {
            Log::error('❌ [SIGUIENTE] Error:', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Error interno'], 500);
        }
    }
    public function notifyPartnerStop(Request $request)
    {
        try {
            $user = auth()->user();
            $roomName = $request->input('roomName');
            
            Log::info('🛑 [STOP] Usuario finalizando sesión', [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'room_name' => $roomName
            ]);
            
            // 1. Buscar la sesión actual
            $session = ChatSession::where('room_name', $roomName)
                ->whereIn('status', ['active', 'waiting'])
                ->first();
                
            if (!$session) {
                return response()->json(['success' => false, 'error' => 'Sesión no encontrada']);
            }
            
            // 2. Identificar al partner
            $partnerUserId = null;
            if ($session->cliente_id == $user->id) {
                $partnerUserId = $session->modelo_id;
            } elseif ($session->modelo_id == $user->id) {
                $partnerUserId = $session->cliente_id;
            }
            
            if (!$partnerUserId) {
                return response()->json(['success' => false, 'error' => 'Partner no encontrado']);
            }
            
            $partner = User::find($partnerUserId);
            if (!$partner) {
                return response()->json(['success' => false, 'error' => 'Usuario partner no existe']);
            }
            
            // 3. Finalizar sesión
            $session->update([
                'status' => 'ended',
                'ended_at' => now(),
                'end_reason' => 'user_stopped_session'
            ]);
            
            // 🔥 GUARDAR EXCLUSIÓN MUTUA EN CACHE (2 MINUTOS) - Para que no vuelvan a la misma sala
            $excludeExpireMinutes = 2;
            
            // Exclusión para el usuario actual (excluir al partner que colgó)
            Cache::put("exclude_user_{$user->id}", $partnerUserId, now()->addMinutes($excludeExpireMinutes));
            
            // Exclusión para el partner (excluir al usuario actual que colgó)
            Cache::put("exclude_user_{$partnerUserId}", $user->id, now()->addMinutes($excludeExpireMinutes));
            
            Log::info('🚫 [STOP] Exclusión mutua guardada al colgar', [
                'user_id' => $user->id,
                'user_name' => $user->alias ?? $user->name,
                'partner_id' => $partnerUserId,
                'partner_name' => $partner->alias ?? $partner->name,
                'exclude_expires_at' => now()->addMinutes($excludeExpireMinutes)->toDateTimeString(),
                'exclusion_duration_minutes' => $excludeExpireMinutes
            ]);
            
            // 🔥 4. CAMBIAR ESTA LÓGICA:
            if ($partner->rol === 'modelo') {
                $partnerRedirect = '/usersearch'; // ✅ CAMBIAR A USERSEARCH
                $redirectParams = [
                    'from' => 'client_stopped_session',
                    'reason' => 'previous_client_left',
                    'role' => 'modelo',
                    'action' => 'find_new_client'
                ];
            } elseif ($partner->rol === 'cliente') {
                $partnerRedirect = '/usersearch'; // ✅ YA ESTÁ CORRECTO
                $redirectParams = [
                    'from' => 'model_stopped_session',
                    'reason' => 'previous_model_left',
                    'role' => 'cliente',
                    'action' => 'find_new_model'
                ];
            } else {
                $partnerRedirect = '/home';
                $redirectParams = [];
            }

            // 🔥 REACTIVADO: Enviar notificación inmediata al partner cuando alguien cuelga
            $endReason = $user->rol === 'modelo' ? 'model_ended_session' : 'client_ended_session';
            $message = $user->rol === 'modelo' 
                ? 'La modelo finalizó la videollamada'
                : 'El cliente finalizó la videollamada';
            
            // Enviar notificación partner_left_session para detección inmediata
            DB::table('notifications')->insert([
                'user_id' => $partnerUserId,
                'type' => 'partner_left_session',
                'data' => json_encode([
                    'message' => $message,
                    'partner_name' => $user->name,
                    'room_name' => $roomName,
                    'end_reason' => $endReason,
                    'closed_at' => now()->toISOString(),
                    'urgency' => 'high'
                ]),
                'read' => false,
                'expires_at' => now()->addHours(24),
                'created_at' => now(),
                'updated_at' => now()
            ]);
            
            // También enviar room_closed para compatibilidad
            DB::table('notifications')->insert([
                'user_id' => $partnerUserId,
                'type' => 'room_closed',
                'data' => json_encode([
                    'type' => 'room_closed',
                    'room_name' => $roomName,
                    'end_reason' => $endReason,
                    'message' => $message,
                    'urgency' => 'high',
                    'closed_at' => now()->toISOString()
                ]),
                'read' => false,
                'expires_at' => now()->addHours(24),
                'created_at' => now(),
                'updated_at' => now()
            ]);
            
            Log::info('🔔 [STOP] Notificaciones enviadas al partner', [
                'user_id' => $user->id,
                'partner_id' => $partnerUserId,
                'room_name' => $roomName,
                'notifications_sent' => ['partner_left_session', 'room_closed']
            ]);
            
            return response()->json(['success' => true]);
            
        } catch (\Exception $e) {
            Log::error('❌ [STOP] Error:', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Error interno'], 500);
        }
    }
    public function checkNotifications(Request $request)
    {
        try {
            $user = auth()->user();
            
            // Verificar si la tabla notifications existe
            if (!Schema::hasTable('notifications')) {
                return response()->json([
                    'success' => true,
                    'has_notifications' => false
                ]);
            }
            
            // Buscar notificaciones no leídas y no expiradas
            $notifications = DB::table('notifications')
                ->where('user_id', $user->id)
                ->where('read', false)
                ->where('expires_at', '>', now())
                ->orderBy('created_at', 'desc')
                ->limit(5) // Solo las 5 más recientes
                ->get();
            
            if ($notifications->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'has_notifications' => false
                ]);
            }
            
            // Marcar como leídas
            $notificationIds = $notifications->pluck('id')->toArray();
            DB::table('notifications')
                ->whereIn('id', $notificationIds)
                ->update(['read' => true, 'updated_at' => now()]);
            
            // Retornar la más reciente
            $latestNotification = $notifications->first();
            $data = json_decode($latestNotification->data, true);
            
            Log::info('📨 [POLLING] Notificación encontrada', [
                'user_id' => $user->id,
                'type' => $latestNotification->type,
                'notification_id' => $latestNotification->id
            ]);
            
            return response()->json([
                'success' => true,
                'has_notifications' => true,
                'notification' => [
                    'type' => $latestNotification->type,
                    'data' => $data
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('❌ [POLLING] Error verificando notificaciones', [
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Retornar éxito sin notificaciones en caso de error para no interrumpir el flujo
            return response()->json([
                'success' => true,
                'has_notifications' => false
            ]);
        }
    }
    private function userHasAccessToRoom($userId, $roomName)
    {
        // Para salas de videochat (omegle_*), verificar participación en sesiones activas
        if (strpos($roomName, 'omegle_') === 0) {
            return $this->userParticipatesInVideoSession($userId, $roomName);
        }
        
        // Para chats normales, usar la lógica original
        $hasAccess = strpos($roomName, "_{$userId}_") !== false || 
                    strpos($roomName, "chat_user_{$userId}_") === 0 ||
                    preg_match("/chat_user_\d+_{$userId}$/", $roomName);
                    
        return $hasAccess;
    }
    private function userParticipatesInVideoSession($userId, $roomName)
    {
        try {
            // Buscar sesión activa con este room_name
            $session = ChatSession::where('room_name', $roomName)
                ->whereIn('status', ['active', 'waiting'])
                ->where(function($query) use ($userId) {
                    $query->where('cliente_id', $userId)
                        ->orWhere('modelo_id', $userId);
                })
                ->first();

            $hasAccess = $session !== null;
            return $hasAccess;
            
        } catch (\Exception $e) {
            \Log::error('❌ Error verificando acceso a sesión de videochat', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    public function endCoinSession(Request $request)
    {
        try {
            $user = auth()->user();
            $roomName = $request->input('roomName');
            
            Log::info('🔍 [DEBUG] endCoinSession INICIADO', [
                'user_id' => $user->id,
                'room_name' => $roomName,
                'timestamp' => now()->toDateTimeString()
            ]);
            
            $session = VideoChatSession::where('user_id', $user->id)
                ->where('room_name', $roomName)
                ->where('status', 'active')
                ->first();
            
            Log::info('🔍 [DEBUG] Sesión encontrada', [
                'session_exists' => $session !== null,
                'session_id' => $session->id ?? null,
                'is_consuming' => $session->is_consuming ?? false,
                'status' => $session->status ?? null,
                'started_at' => $session->started_at ?? null,
                'last_consumption_at' => $session->last_consumption_at ?? null
            ]);
            
            // 🔥 Si no existe la sesión, buscar la última sesión activa o crear una nueva basada en consumos
            if (!$session) {
                Log::warning('⚠️ [DEBUG] No se encontró VideoChatSession activa, buscando en consumos recientes', [
                    'user_id' => $user->id,
                    'room_name' => $roomName,
                    'timestamp' => now()->toDateTimeString()
                ]);
                
                // Buscar el último consumo para esta sala para obtener información
                $lastConsumption = \App\Models\CoinConsumption::where('user_id', $user->id)
                    ->where('room_name', $roomName)
                    ->orderBy('consumed_at', 'desc')
                    ->first();
                
                if ($lastConsumption) {
                    $secondsSinceLastConsumption = now()->diffInSeconds($lastConsumption->consumed_at);
                    
                    Log::info('🔍 [DEBUG] Último consumo encontrado', [
                        'consumption_id' => $lastConsumption->id,
                        'consumed_at' => $lastConsumption->consumed_at->toDateTimeString(),
                        'now' => now()->toDateTimeString(),
                        'coins_consumed' => $lastConsumption->coins_consumed,
                        'minutes_consumed' => $lastConsumption->minutes_consumed,
                        'seconds_since_last_consumption' => $secondsSinceLastConsumption,
                        'will_skip' => $secondsSinceLastConsumption < 60
                    ]);
                    
                    // Si hay consumos recientes (menos de 60 segundos), NO procesar consumo final adicional
                    // porque significa que ya se cobró el descuento periódico
                    if ($secondsSinceLastConsumption < 60) {
                        Log::info('⏭️ [DEBUG] ⛔ SALTANDO consumo final - consumo reciente encontrado', [
                            'user_id' => $user->id,
                            'room_name' => $roomName,
                            'seconds_since_last_consumption' => $secondsSinceLastConsumption,
                            'last_consumption_at' => $lastConsumption->consumed_at->toDateTimeString(),
                            'last_consumption_coins' => $lastConsumption->coins_consumed,
                            'reason' => 'Ya se cobró descuento periódico hace menos de 60 segundos, NO se cobra consumo final adicional',
                            'action' => 'RETURNING_SUCCESS_WITHOUT_CHARGE'
                        ]);
                        
                        return response()->json(['success' => true]);
                    } else {
                        Log::warning('⚠️ [DEBUG] Último consumo fue hace más de 60 segundos, pero no hay VideoChatSession', [
                            'user_id' => $user->id,
                            'room_name' => $roomName,
                            'seconds_since_last_consumption' => $secondsSinceLastConsumption,
                            'note' => 'Esto es inusual, no se procesará consumo final sin sesión'
                        ]);
                        
                        return response()->json(['success' => true]);
                    }
                } else {
                    Log::info('⏭️ [DEBUG] No se encontraron consumos para esta sala', [
                        'user_id' => $user->id,
                        'room_name' => $roomName,
                        'reason' => 'No hay consumos registrados, no se procesa consumo final'
                    ]);
                    
                    return response()->json(['success' => true]);
                }
            }
                
            if ($session && $session->is_consuming) {
                // 🔥 Consumo final antes de cerrar
                // Calcular tiempo total de la sesión y tiempo desde último consumo
                $sessionStartTime = $session->started_at;
                $lastConsumptionTime = $session->last_consumption_at ?? $session->started_at;
                $totalSeconds = now()->diffInSeconds($sessionStartTime);
                $secondsSinceLastConsumption = now()->diffInSeconds($lastConsumptionTime);
                
                Log::info('🔍 [DEBUG] Cálculos de tiempo', [
                    'session_start_time' => $sessionStartTime->toDateTimeString(),
                    'last_consumption_time' => $lastConsumptionTime->toDateTimeString(),
                    'now' => now()->toDateTimeString(),
                    'total_seconds' => $totalSeconds,
                    'total_minutes' => round($totalSeconds / 60, 3),
                    'seconds_since_last_consumption' => $secondsSinceLastConsumption,
                    'minutes_since_last_consumption' => round($secondsSinceLastConsumption / 60, 3)
                ]);
                
                // 🔥 LÓGICA DE REDONDEO: Solo cobrar minuto adicional si:
                // 1. Pasaron al menos 60 segundos (1 minuto completo) desde el último consumo
                //    Esto evita cobrar por segundos residuales cuando se cuelga justo después de un descuento periódico
                // 2. Y el tiempo total es 1:30 o más (90 segundos), entonces se redondea hacia arriba
                Log::info('🔍 [DEBUG] ⏱️ VERIFICANDO si se debe cobrar consumo final', [
                    'seconds_since_last_consumption' => $secondsSinceLastConsumption,
                    'threshold' => 60,
                    'will_process' => $secondsSinceLastConsumption >= 60,
                    'total_seconds' => $totalSeconds,
                    'total_minutes' => round($totalSeconds / 60, 3)
                ]);
                
                if ($secondsSinceLastConsumption >= 60) {
                    $totalMinutes = $totalSeconds / 60;
                    
                    // Si el tiempo total es 1.5 minutos o más, redondear hacia arriba
                    // Si es menos de 1.5 minutos, redondear hacia abajo
                    if ($totalMinutes >= 1.5) {
                        $minutesToCharge = ceil($totalMinutes);
                    } else {
                        $minutesToCharge = floor($totalMinutes);
                    }
                    
                    // Calcular cuántos minutos ya se cobraron basándose en last_consumption_at
                    // Si last_consumption_at está a los 60 segundos, ya se cobró 1 minuto
                    // Si está a los 120 segundos, ya se cobraron 2 minutos, etc.
                    $secondsFromStartToLastConsumption = $lastConsumptionTime->diffInSeconds($sessionStartTime);
                    $minutesAlreadyCharged = floor($secondsFromStartToLastConsumption / 60);
                    $additionalMinutes = max(0, $minutesToCharge - $minutesAlreadyCharged);
                    
                    Log::info('🔍 [DEBUG] 💰 Cálculo de minutos ya cobrados', [
                        'session_start_time' => $sessionStartTime->toDateTimeString(),
                        'last_consumption_time' => $lastConsumptionTime->toDateTimeString(),
                        'seconds_from_start_to_last_consumption' => $secondsFromStartToLastConsumption,
                        'minutes_already_charged' => $minutesAlreadyCharged,
                        'total_seconds' => $totalSeconds,
                        'total_minutes' => round($totalMinutes, 3),
                        'total_minutes_to_charge' => $minutesToCharge,
                        'additional_minutes' => $additionalMinutes,
                        'additional_coins' => $additionalMinutes * 10
                    ]);
                    
                    if ($additionalMinutes > 0) {
                        Log::info('💰 [DEBUG] Procesando consumo final al cerrar sesión', [
                            'user_id' => $user->id,
                            'room_name' => $roomName,
                            'total_seconds' => $totalSeconds,
                            'total_minutes' => round($totalMinutes, 3),
                            'minutes_to_charge' => $minutesToCharge,
                            'minutes_already_charged' => $minutesAlreadyCharged,
                            'additional_minutes' => $additionalMinutes,
                            'additional_seconds' => $additionalMinutes * 60,
                            'seconds_since_last' => $secondsSinceLastConsumption,
                            'note' => 'Redondeo después de 1:30 - se cobra minuto adicional si aplica',
                            'will_charge_coins' => $additionalMinutes * 10
                        ]);
                        
                        $this->coinController->processPeriodicConsumption(new Request([
                            'room_name' => $roomName,
                            'session_duration_seconds' => $additionalMinutes * 60
                        ]));
                    } else {
                        Log::info('⏭️ Saltando consumo final - no hay minutos adicionales', [
                            'user_id' => $user->id,
                            'room_name' => $roomName,
                            'total_minutes' => round($totalMinutes, 3),
                            'minutes_already_charged' => $minutesAlreadyCharged,
                            'reason' => 'Ya se cobraron todos los minutos correspondientes'
                        ]);
                    }
                } else {
                    Log::info('⏭️ [DEBUG] Saltando consumo final - tiempo insuficiente', [
                        'user_id' => $user->id,
                        'room_name' => $roomName,
                        'seconds_since_last' => $secondsSinceLastConsumption,
                        'total_seconds' => $totalSeconds,
                        'total_minutes' => round($totalSeconds / 60, 3),
                        'reason' => 'Menos de 60 segundos desde último consumo - no se cobra minuto adicional'
                    ]);
                }
            } else {
                Log::info('⏭️ [DEBUG] No se procesa consumo final', [
                    'user_id' => $user->id,
                    'room_name' => $roomName,
                    'session_exists' => $session !== null,
                    'is_consuming' => $session->is_consuming ?? false,
                    'reason' => 'Sesión no existe o no está consumiendo'
                ]);
            }
            
            // Actualizar sesión si existe
            if ($session) {
                $session->update([
                    'status' => 'ended',
                    'ended_at' => now()
                ]);

                // 🔥 NUEVO: Procesar ganancias para la modelo
                $this->processSessionEarningsForRoom($roomName, $session->id);
            }
            
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Error finalizando sesión de monedas: ' . $e->getMessage());
            return response()->json(['success' => false], 500);
        }
    }

    private function processSessionEarningsForRoom($roomName, $sessionId)
    {
        try {
            // Buscar la sesión de chat para obtener modelo y cliente
            $chatSession = ChatSession::where('room_name', $roomName)
                ->whereIn('status', ['active', 'ended'])
                ->first();

            if ($chatSession && $chatSession->modelo_id && $chatSession->cliente_id) {
                $earningsController = new SessionEarningsController();
                $earningsController->processSessionEarnings(
                    $sessionId,
                    $chatSession->modelo_id,
                    $chatSession->cliente_id,
                    $roomName
                );
            }
        } catch (\Exception $e) {
            Log::error('Error procesando ganancias: ' . $e->getMessage());
        }
    }

    public function processSessionEarnings(Request $request)
    {
        try {
            $request->validate([
                'room_name' => 'required|string',
                'duration_seconds' => 'required|integer|min:1|max:21600',
                'modelo_user_id' => 'required|integer|exists:users,id',
                'cliente_user_id' => 'required|integer|exists:users,id',
                'session_type' => 'string|in:video_chat,direct_call',
                'ended_by' => 'string|in:user,client_ended,model_ended,client_next,model_next,balance_exhausted,timeout'
            ]);

            $roomName = $request->room_name;
            $durationSeconds = (int) $request->duration_seconds;
            $modeloUserId = (int) $request->modelo_user_id;
            $clienteUserId = (int) $request->cliente_user_id;
            $sessionType = $request->session_type ?? 'video_chat';
            $endedBy = $request->ended_by ?? 'user';

            Log::info('💰 [EARNINGS] Procesando ganancias automáticas', [
                'room_name' => $roomName,
                'duration_seconds' => $durationSeconds,
                'duration_minutes' => round($durationSeconds / 60, 2),
                'modelo_user_id' => $modeloUserId,
                'cliente_user_id' => $clienteUserId,
                'ended_by' => $endedBy
            ]);

            // 🔥 VALIDACIONES
            $modelo = User::find($modeloUserId);
            $cliente = User::find($clienteUserId);

            if (!$modelo || $modelo->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario modelo no válido'
                ], 400);
            }

            if (!$cliente || $cliente->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario cliente no válido'
                ], 400);
            }

            // Limitar duración máxima
            if ($durationSeconds > 21600) {
                Log::warning('⚠️ Duración excesiva limitada', [
                    'original' => $durationSeconds,
                    'limited' => 21600
                ]);
                $durationSeconds = 21600;
            }

            // 🔥 VERIFICAR SI YA EXISTE
            $existingEarning = SessionEarning::where('room_name', $roomName)
                ->where('model_user_id', $modeloUserId)
                ->where('client_user_id', $clienteUserId)
                ->where('created_at', '>=', now()->subHours(2))
                ->first();

            if ($existingEarning) {
                Log::info('🔄 Actualizando earning existente', [
                    'existing_id' => $existingEarning->id,
                    'old_duration' => $existingEarning->session_duration_seconds,
                    'new_duration' => $durationSeconds
                ]);

                $this->updateExistingEarning($existingEarning, $durationSeconds, $endedBy);

                return response()->json([
                    'success' => true,
                    'message' => 'Ganancias actualizadas',
                    'earning_id' => $existingEarning->id,
                    'model_earnings' => $existingEarning->fresh()->model_total_earnings,
                    'duration_seconds' => $durationSeconds,
                    'updated' => true
                ]);
            }

            // 🔥 CALCULAR GANANCIAS
            $durationMinutes = $durationSeconds / 60;
            $payableMinutes = floor($durationMinutes);
            $qualifyingSession = $payableMinutes >= 1;
            
            // 🔥 Obtener valores dinámicos desde PlatformSettingsService
            // 30 USD/hora = 0.50 USD/minuto total
            // 20 USD/hora para modelo = 0.333 USD/minuto
            // 10 USD/hora para plataforma = 0.167 USD/minuto
            $MODEL_EARNINGS_PER_MINUTE = PlatformSettingsService::getDecimal('earnings_per_minute', 0.333);
            $PLATFORM_EARNINGS_PER_MINUTE = PlatformSettingsService::getDecimal('platform_earnings_per_minute', 0.167);
            $COINS_PER_MINUTE = PlatformSettingsService::getInteger('coins_per_minute', 10);
            
            $modelEarnings = $qualifyingSession ? round($payableMinutes * $MODEL_EARNINGS_PER_MINUTE, 2) : 0;
            $platformEarnings = $qualifyingSession ? round($payableMinutes * $PLATFORM_EARNINGS_PER_MINUTE, 2) : 0;
            $theoreticalCoinsConsumed = ceil($payableMinutes * $COINS_PER_MINUTE);

            // 🔥 CREAR SESSION EARNING
            $sessionEarning = SessionEarning::create([
                'session_id' => 'auto_' . time() . '_' . $modeloUserId . '_' . $clienteUserId,
                'model_user_id' => $modeloUserId,
                'client_user_id' => $clienteUserId,
                'room_name' => $roomName,
                'source_type' => $sessionType,
                'session_duration_seconds' => $durationSeconds,
                'qualifying_session' => $qualifyingSession,
                'total_time_coins_spent' => $theoreticalCoinsConsumed,
                'total_gifts_coins_spent' => 0,
                'total_coins_spent' => $theoreticalCoinsConsumed,
                'client_usd_spent' => round($theoreticalCoinsConsumed * 0.15, 2),
                'stripe_commission' => 0,
                'after_stripe_amount' => round($theoreticalCoinsConsumed * 0.15, 2),
                'model_time_earnings' => $modelEarnings,
                'model_gift_earnings' => 0,
                'model_total_earnings' => $modelEarnings,
                'platform_time_earnings' => $platformEarnings,
                'platform_gift_earnings' => 0,
                'platform_total_earnings' => $platformEarnings,
                'gift_count' => 0,
                'gift_details' => [],
                'session_started_at' => now()->subSeconds($durationSeconds),
                'session_ended_at' => now(),
                'processed_at' => now(),
                'metadata' => [
                    'ended_by' => $endedBy,
                    'auto_processed' => true,
                    'processing_timestamp' => now()->toISOString(),
                    'payable_minutes' => $payableMinutes,
                    'total_minutes' => round($durationMinutes, 2)
                ]
            ]);

            // 🔥 ACTUALIZAR BILLETERA DE LA MODELO CON LOCK Y VALIDACIONES
            if ($modelEarnings > 0 && is_numeric($modelEarnings)) {
                try {
                    // 🔒 USAR LOCK FOR UPDATE PARA EVITAR RACE CONDITIONS
                    $model = User::lockForUpdate()->find($modeloUserId);
                    if ($model && ($model->rol === 'modelo' || $model->role === 'modelo')) {
                        $oldBalance = $model->balance ?? 0;
                        $oldTotalEarned = $model->total_earned ?? 0;
                        
                        $model->increment('balance', $modelEarnings);
                        $model->increment('total_earned', $modelEarnings);
                        $model->last_earning_at = now();
                        
                        if ($model->save()) {
                            $model->refresh();
                            Log::info('💰 [WALLET] Billetera de modelo actualizada desde LiveKitController', [
                                'model_user_id' => $modeloUserId,
                                'earnings_added' => $modelEarnings,
                                'old_balance' => $oldBalance,
                                'new_balance' => $model->balance,
                                'old_total_earned' => $oldTotalEarned,
                                'new_total_earned' => $model->total_earned
                            ]);
                        } else {
                            Log::error('❌ [WALLET] Error al guardar modelo desde LiveKitController', [
                                'model_user_id' => $modeloUserId
                            ]);
                        }
                    } else {
                        Log::warning('⚠️ [WALLET] Modelo no encontrada o no es modelo desde LiveKitController', [
                            'model_user_id' => $modeloUserId,
                            'found' => !!$model
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error('❌ [WALLET] Excepción actualizando billetera desde LiveKitController: ' . $e->getMessage(), [
                        'model_user_id' => $modeloUserId,
                        'earnings_amount' => $modelEarnings,
                        'trace' => $e->getTraceAsString()
                    ]);
                }
            }
            
            Log::info('✅ [EARNINGS] Ganancias creadas', [
                'earning_id' => $sessionEarning->id,
                'modelo_earnings' => $modelEarnings,
                'qualifying_session' => $qualifyingSession,
                'payable_minutes' => $payableMinutes
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Ganancias procesadas automáticamente',
                'earning_id' => $sessionEarning->id,
                'model_earnings' => $modelEarnings,
                'duration_seconds' => $durationSeconds,
                'duration_minutes' => round($durationMinutes, 2),
                'payable_minutes' => $payableMinutes,
                'qualifying_session' => $qualifyingSession,
                'created' => true
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [EARNINGS] Error procesando ganancias: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error procesando ganancias: ' . $e->getMessage()
            ], 500);
        }
    }

    // 🔥 FUNCIÓN AUXILIAR PARA ACTUALIZAR
    private function updateExistingEarning($existingEarning, $newDurationSeconds, $endedBy)
    {
        try {
            $newDurationMinutes = $newDurationSeconds / 60;
            $newPayableMinutes = floor($newDurationMinutes);
            $newQualifying = $newPayableMinutes >= 1;
            
            // 🔥 Obtener configuraciones dinámicas desde la base de datos
            // 30 USD/hora = 0.50 USD/minuto total
            // 20 USD/hora para modelo = 0.333 USD/minuto
            // 10 USD/hora para plataforma = 0.167 USD/minuto
            $MODEL_EARNINGS_PER_MINUTE = \App\Services\PlatformSettingsService::getDecimal('earnings_per_minute', 0.333);
            $PLATFORM_EARNINGS_PER_MINUTE = \App\Services\PlatformSettingsService::getDecimal('platform_earnings_per_minute', 0.167);
            $COINS_PER_MINUTE = \App\Services\PlatformSettingsService::getInteger('coins_per_minute', 10);
            
            $newModelEarnings = $newQualifying ? round($newPayableMinutes * $MODEL_EARNINGS_PER_MINUTE, 2) : 0;
            $newPlatformEarnings = $newQualifying ? round($newPayableMinutes * $PLATFORM_EARNINGS_PER_MINUTE, 2) : 0;
            $newTheoreticalCoins = ceil($newPayableMinutes * $COINS_PER_MINUTE);

            // Mantener gift earnings
            $newTotalEarnings = $newModelEarnings + $existingEarning->model_gift_earnings;
            $newPlatformTotalEarnings = $newPlatformEarnings + ($existingEarning->platform_gift_earnings ?? 0);
            
            // 🔥 Calcular diferencia de ganancias para actualizar billetera
            $earningsDifference = $newModelEarnings - $existingEarning->model_time_earnings;

            $existingEarning->update([
                'session_duration_seconds' => $newDurationSeconds,
                'qualifying_session' => $newQualifying,
                'total_time_coins_spent' => $newTheoreticalCoins,
                'total_coins_spent' => $newTheoreticalCoins + $existingEarning->total_gifts_coins_spent,
                'model_time_earnings' => $newModelEarnings,
                'model_total_earnings' => $newTotalEarnings,
                'platform_time_earnings' => $newPlatformEarnings,
                'platform_total_earnings' => $newPlatformTotalEarnings,
                'processed_at' => now(),
                'metadata' => array_merge($existingEarning->metadata ?? [], [
                    'updated_at' => now()->toISOString(),
                    'duration_updated' => true,
                    'new_payable_minutes' => $newPayableMinutes,
                    'updated_ended_by' => $endedBy
                ])
            ]);
            
            // 🔥 ACTUALIZAR BILLETERA DE LA MODELO CON LA DIFERENCIA (CON LOCK Y VALIDACIONES)
            if ($earningsDifference > 0 && is_numeric($earningsDifference)) {
                try {
                    // 🔒 USAR LOCK FOR UPDATE PARA EVITAR RACE CONDITIONS
                    $model = User::lockForUpdate()->find($existingEarning->model_user_id);
                    if ($model && ($model->rol === 'modelo' || $model->role === 'modelo')) {
                        $oldBalance = $model->balance ?? 0;
                        $oldTotalEarned = $model->total_earned ?? 0;
                        
                        $model->increment('balance', $earningsDifference);
                        $model->increment('total_earned', $earningsDifference);
                        $model->last_earning_at = now();
                        
                        if ($model->save()) {
                            $model->refresh();
                            Log::info('💰 [WALLET] Billetera de modelo actualizada (diferencia)', [
                                'model_user_id' => $existingEarning->model_user_id,
                                'earnings_difference' => $earningsDifference,
                                'old_balance' => $oldBalance,
                                'new_balance' => $model->balance,
                                'old_total_earned' => $oldTotalEarned,
                                'new_total_earned' => $model->total_earned
                            ]);
                        } else {
                            Log::error('❌ [WALLET] Error al guardar modelo (diferencia)', [
                                'model_user_id' => $existingEarning->model_user_id
                            ]);
                        }
                    } else {
                        Log::warning('⚠️ [WALLET] Modelo no encontrada o no es modelo (diferencia)', [
                            'model_user_id' => $existingEarning->model_user_id,
                            'found' => !!$model
                        ]);
                    }
                } catch (\Exception $e) {
                    Log::error('❌ [WALLET] Excepción actualizando billetera (diferencia): ' . $e->getMessage(), [
                        'model_user_id' => $existingEarning->model_user_id,
                        'earnings_difference' => $earningsDifference,
                        'trace' => $e->getTraceAsString()
                    ]);
                }
            }

            Log::info('🔄 Earning actualizado', [
                'earning_id' => $existingEarning->id,
                'new_duration' => $newDurationSeconds,
                'new_earnings' => $newModelEarnings
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error actualizando earning: ' . $e->getMessage());
            throw $e;
        }
    }
    
    public function validateUserSession(Request $request)
    {
        try {
            $request->validate([
                'room_name' => 'required|string',
                'expected_role' => 'required|string|in:cliente,modelo'
            ]);

            $user = auth()->user();
            $roomName = $request->room_name;
            $expectedRole = $request->expected_role;

            Log::info('🔍 Validando sesión de usuario', [
                'user_id' => $user->id,
                'room_name' => $roomName,
                'expected_role' => $expectedRole
            ]);

            // Buscar sesión
            $session = ChatSession::where('room_name', $roomName)
                ->whereIn('status', ['active', 'waiting'])
                ->first();

            if (!$session) {
                return response()->json([
                    'valid' => false,
                    'reason' => 'session_not_found',
                    'action' => 'redirect_to_search'
                ]);
            }

            // Verificar que el usuario pertenece a la sesión
            $userBelongsToSession = false;
            $actualRole = null;

            if ($session->cliente_id == $user->id) {
                $userBelongsToSession = true;
                $actualRole = 'cliente';
            } elseif ($session->modelo_id == $user->id) {
                $userBelongsToSession = true;
                $actualRole = 'modelo';
            }

            if (!$userBelongsToSession) {
                Log::warning('❌ Usuario no pertenece a la sesión', [
                    'user_id' => $user->id,
                    'session_cliente' => $session->cliente_id,
                    'session_modelo' => $session->modelo_id
                ]);

                return response()->json([
                    'valid' => false,
                    'reason' => 'user_not_in_session',
                    'action' => 'redirect_to_search'
                ]);
            }

            // Verificar que el rol coincide
            if ($actualRole !== $expectedRole) {
                Log::warning('⚠️ Rol de usuario no coincide', [
                    'user_id' => $user->id,
                    'expected_role' => $expectedRole,
                    'actual_role' => $actualRole
                ]);

                return response()->json([
                    'valid' => false,
                    'reason' => 'role_mismatch',
                    'expected_role' => $expectedRole,
                    'actual_role' => $actualRole,
                    'action' => 'redirect_to_correct_view'
                ]);
            }

            // Verificar que ambos usuarios están activos (si la sesión está activa)
            if ($session->status === 'active') {
                $bothUsersActive = true;
                $inactiveUsers = [];

                if ($session->cliente_id && !$this->verifyUserIsSearchingOrActive($session->cliente_id, $roomName)) {
                    $bothUsersActive = false;
                    $inactiveUsers[] = 'cliente';
                }

                if ($session->modelo_id && !$this->verifyUserIsSearchingOrActive($session->modelo_id, $roomName)) {
                    $bothUsersActive = false;
                    $inactiveUsers[] = 'modelo';
                }

                if (!$bothUsersActive) {
                    Log::warning('⚠️ Usuarios inactivos en sesión activa', [
                        'session_id' => $session->id,
                        'inactive_users' => $inactiveUsers
                    ]);

                    return response()->json([
                        'valid' => false,
                        'reason' => 'inactive_users_detected',
                        'inactive_users' => $inactiveUsers,
                        'action' => 'cleanup_and_redirect'
                    ]);
                }
            }

            Log::info('✅ Sesión validada exitosamente', [
                'user_id' => $user->id,
                'session_id' => $session->id,
                'role' => $actualRole
            ]);

            return response()->json([
                'valid' => true,
                'session' => [
                    'id' => $session->id,
                    'room_name' => $session->room_name,
                    'status' => $session->status,
                    'user_role' => $actualRole,
                    'created_at' => $session->created_at->toISOString()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error validando sesión', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'valid' => false,
                'reason' => 'validation_error',
                'action' => 'redirect_to_search'
            ], 500);
        }
    }

    /**
     * 🔥 DEBUG: Obtener información completa de sesiones del usuario
     */
    public function debugUserSessions(Request $request)
    {
        try {
            $user = auth()->user();
            
            Log::info('🔍 Debug: Información completa del usuario', [
                'user_id' => $user->id
            ]);

            // Obtener todas las sesiones del usuario
            $allSessions = ChatSession::where(function($query) use ($user) {
                $query->where('cliente_id', $user->id)
                    ->orWhere('modelo_id', $user->id);
            })
            ->orderBy('created_at', 'desc')
            ->get();

            // Obtener estado online
            $onlineStatus = UserOnlineStatus::where('user_id', $user->id)->first();

            // Obtener sesiones de videochat
            $videoChatSessions = VideoChatSession::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->get();

            $debugInfo = [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->rol,
                    'email' => $user->email
                ],
                'online_status' => $onlineStatus ? [
                    'is_online' => $onlineStatus->is_online,
                    'last_seen' => $onlineStatus->last_seen ? $onlineStatus->last_seen->format('c') : null,
                    'activity_type' => $onlineStatus->activity_type,
                    'current_room' => $onlineStatus->current_room
                ] : null,
                'chat_sessions' => $allSessions->map(function($session) use ($user) {
                    return [
                        'id' => $session->id,
                        'room_name' => $session->room_name,
                        'status' => $session->status,
                        'user_role_in_session' => $session->cliente_id == $user->id ? 'cliente' : 'modelo',
                        'cliente_id' => $session->cliente_id,
                        'modelo_id' => $session->modelo_id,
                        'created_at' => $session->created_at->format('c'),
                        'updated_at' => $session->updated_at->format('c'),
                        'ended_at' => $session->ended_at ? $session->ended_at->format('c') : null,
                        'end_reason' => $session->end_reason
                    ];
                }),
                'videochat_sessions' => $videoChatSessions->map(function($session) {
                    return [
                        'id' => $session->id,
                        'room_name' => $session->room_name,
                        'status' => $session->status,
                        'user_role' => $session->user_role,
                        'is_consuming' => $session->is_consuming,
                        'total_consumed' => $session->total_consumed,
                        'started_at' => $session->started_at ? $session->started_at->format('c') : null,
                        'ended_at' => $session->ended_at ? $session->ended_at->format('c') : null
                    ];
                }),
                'summary' => [
                    'total_chat_sessions' => $allSessions->count(),
                    'active_chat_sessions' => $allSessions->whereIn('status', ['active', 'waiting'])->count(),
                    'total_videochat_sessions' => $videoChatSessions->count(),
                    'active_videochat_sessions' => $videoChatSessions->where('status', 'active')->count()
                ]
            ];

            return response()->json([
                'success' => true,
                'debug_info' => $debugInfo
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error en debug de sesiones', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo información de debug'
            ], 500);
        }
    }

    /**
     * 🔥 CLEANUP DE EMERGENCIA - Para casos críticos
     */
    public function emergencyCleanup(Request $request)
    {
        try {
            $user = auth()->user();
            $cleanupType = $request->input('type', 'user_only'); // user_only, all_inactive, force_all

            Log::warning('🚨 Cleanup de emergencia iniciado', [
                'user_id' => $user->id,
                'cleanup_type' => $cleanupType,
                'requested_by' => $user->email
            ]);

            DB::beginTransaction();

            $cleaned = [
                'chat_sessions' => 0,
                'videochat_sessions' => 0,
                'notifications' => 0
            ];

            if ($cleanupType === 'user_only' || $cleanupType === 'force_all') {
                // Limpiar sesiones del usuario específico
                $userChatSessions = ChatSession::where(function($query) use ($user) {
                    $query->where('cliente_id', $user->id)
                        ->orWhere('modelo_id', $user->id);
                })
                ->whereIn('status', ['active', 'waiting'])
                ->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => 'emergency_cleanup'
                ]);

                $userVideoChatSessions = VideoChatSession::where('user_id', $user->id)
                    ->where('status', 'active')
                    ->update([
                        'status' => 'ended',
                        'ended_at' => now(),
                        'is_consuming' => false,
                        'end_reason' => 'emergency_cleanup'
                    ]);

                $cleaned['chat_sessions'] += $userChatSessions;
                $cleaned['videochat_sessions'] += $userVideoChatSessions;
            }

            if ($cleanupType === 'all_inactive' || $cleanupType === 'force_all') {
                // Limpiar todas las sesiones con usuarios inactivos
                $inactiveChatSessions = ChatSession::where('status', 'active')
                    ->where('updated_at', '<', now()->subMinutes(3))
                    ->update([
                        'status' => 'ended',
                        'ended_at' => now(),
                        'end_reason' => 'emergency_cleanup_inactive'
                    ]);

                $inactiveVideoChatSessions = VideoChatSession::where('status', 'active')
                    ->where('updated_at', '<', now()->subMinutes(3))
                    ->update([
                        'status' => 'ended',
                        'ended_at' => now(),
                        'is_consuming' => false,
                        'end_reason' => 'emergency_cleanup_inactive'
                    ]);

                $cleaned['chat_sessions'] += $inactiveChatSessions;
                $cleaned['videochat_sessions'] += $inactiveVideoChatSessions;
            }

            // Limpiar notificaciones expiradas
            $expiredNotifications = DB::table('notifications')
                ->where('expires_at', '<', now())
                ->delete();

            $cleaned['notifications'] = $expiredNotifications;

            // Actualizar estado del usuario
            UserOnlineStatus::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'is_online' => true,
                    'last_seen' => now(),
                    'activity_type' => 'browsing',
                    'current_room' => null,
                    'updated_at' => now()
                ]
            );

            DB::commit();

            Log::warning('✅ Cleanup de emergencia completado', [
                'user_id' => $user->id,
                'cleanup_type' => $cleanupType,
                'cleaned' => $cleaned
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cleanup de emergencia completado',
                'cleaned' => $cleaned,
                'cleanup_type' => $cleanupType
            ]);

        } catch (\Exception $e) {
            DB::rollback();

            Log::error('❌ Error en cleanup de emergencia', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id(),
                'cleanup_type' => $cleanupType ?? 'unknown'
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error en cleanup de emergencia'
            ], 500);
        }
    }

    
    public function generateTokenWithImmediateDeduction(Request $request)
    {
        try {
            $request->validate([
                'room' => 'required|string'
            ]);

            VideoChatLogger::start('GENERATE_TOKEN_SECURE', 'Generando token seguro LiveKit para modelo');
            VideoChatLogger::request('GENERATE_TOKEN_SECURE', $request);
            
            // 🔥 NORMALIZAR roomName: trim y eliminar espacios extra (igual que frontend)
            $roomNameOriginal = $request->input('room');
            $roomName = preg_replace('/\s+/', '', trim($roomNameOriginal));
            
            VideoChatLogger::log('GENERATE_TOKEN_SECURE', 'RoomName normalizado', [
                'room_original' => $roomNameOriginal,
                'room_normalized' => $roomName,
                'room_length' => strlen($roomName),
                'room_hex' => bin2hex($roomName),
            ]);
            
            $user = auth()->user();

            if (!$user) {
                VideoChatLogger::error('GENERATE_TOKEN_SECURE', 'Usuario no autenticado');
                return response()->json(['error' => 'Usuario no autenticado'], 401);
            }

            // 🔥 GENERAR IDENTIDAD ÚNICA basada en user_id + role para evitar DuplicateIdentity
            $participantName = "user_{$user->id}_{$user->rol}";
            
            VideoChatLogger::log('GENERATE_TOKEN_SECURE', 'Usuario autenticado', [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'user_name' => $user->name,
                'participant_name' => $participantName,
                'is_modelo' => $user->rol === 'modelo',
            ]);

            // 🔥 LOG CRÍTICO: Verificar roomName con detalles
            Log::info('🎫 [TOKEN-SECURE] Generando token LiveKit', [
                'room' => $roomName,
                'room_length' => strlen($roomName),
                'room_hex' => bin2hex($roomName), // Para detectar caracteres especiales
                'identity' => $participantName,
                'identity_length' => strlen($participantName),
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'timestamp' => now()->toIso8601String()
            ]);

            // 🔥 SOLO VERIFICAR SALDO PARA CLIENTES (NO DESCONTAR)
            if ($user->rol === 'cliente') {
                VideoChatLogger::log('GENERATE_TOKEN_SECURE', 'Usuario es cliente, verificando saldo', [
                    'user_id' => $user->id,
                ]);
                
                if (!$this->coinController) {
                    VideoChatLogger::error('GENERATE_TOKEN_SECURE', 'coinController no inicializado');
                    return response()->json(['error' => 'Error interno del sistema'], 500);
                }

                $balanceCheck = $this->coinController->canStartVideoChat($user->id);
                
                VideoChatLogger::log('GENERATE_TOKEN_SECURE', 'Resultado verificación saldo cliente', [
                    'can_start' => $balanceCheck['can_start'] ?? false,
                    'total_balance' => $balanceCheck['total_balance'] ?? 0,
                    'balance_check' => $balanceCheck,
                ]);
                
                if (!$balanceCheck['can_start']) {
                    VideoChatLogger::warning('GENERATE_TOKEN_SECURE', 'Cliente sin saldo suficiente', [
                        'user_id' => $user->id,
                        'balance' => $balanceCheck['total_balance'] ?? 0
                    ]);
                    
                    Log::warning('🚫 Cliente sin saldo suficiente', [
                        'user_id' => $user->id,
                        'balance' => $balanceCheck['total_balance'] ?? 0
                    ]);
                    
                    $errorResponse = response()->json([
                        'error' => 'Saldo insuficiente para iniciar videochat',
                        'balance_info' => $balanceCheck,
                        'action' => 'redirect_to_coins',
                        'required_coins' => 30,
                        'current_coins' => $balanceCheck['total_balance'] ?? 0
                    ], 402);
                    
                    VideoChatLogger::response('GENERATE_TOKEN_SECURE', $errorResponse);
                    return $errorResponse;
                }

                VideoChatLogger::log('GENERATE_TOKEN_SECURE', 'Cliente con saldo suficiente', [
                    'user_id' => $user->id,
                    'balance' => $balanceCheck['total_balance']
                ]);
                
                Log::info('✅ Cliente con saldo suficiente - NO descontando', [
                    'user_id' => $user->id,
                    'balance' => $balanceCheck['total_balance']
                ]);
            } else {
                VideoChatLogger::log('GENERATE_TOKEN_SECURE', 'Usuario es modelo, no se verifica saldo', [
                    'user_role' => $user->rol,
                ]);
            }

            // 🔥 GENERAR TOKEN SIN DESCUENTOS
            VideoChatLogger::log('GENERATE_TOKEN_SECURE', 'Llamando a generateToken', [
                'room_name' => $roomName,
            ]);
            
            $response = $this->generateToken($request);
            
            VideoChatLogger::end('GENERATE_TOKEN_SECURE', 'Token seguro generado exitosamente', [
                'room_name' => $roomName,
                'user_role' => $user->rol,
            ]);
            
            return $response;

        } catch (\Exception $e) {
            VideoChatLogger::error('GENERATE_TOKEN_SECURE', 'Error generando token seguro', [
                'room' => $request->input('room') ?? null,
                'user_id' => auth()->id(),
            ], $e);
            
            Log::error('❌ Error generando token seguro: ' . $e->getMessage());
            
            $errorResponse = response()->json([
                'error' => 'Error generando token seguro: ' . $e->getMessage()
            ], 500);
            
            VideoChatLogger::response('GENERATE_TOKEN_SECURE', $errorResponse);
            
            return $errorResponse;
        }
    }

    // 🔥 FUNCIÓN 2: processPeriodicDeduction COMPLETA
    public function processPeriodicDeduction(Request $request)
    {
        try {
            $request->validate([
                'room_name' => 'required|string',
                'session_duration_seconds' => 'required|integer|min:1',
                'manual_coins_amount' => 'integer|min:1|max:50'  // 🔥 NUEVA VALIDACIÓN
            ]);

            $user = auth()->user();
            $roomName = $request->room_name;
            $durationSeconds = $request->session_duration_seconds;
            $manualCoinsAmount = $request->manual_coins_amount; // 🔥 NUEVA VARIABLE

            Log::info('🔍 [DEBUG] processPeriodicDeduction INICIADO', [
                'user_id' => $user->id ?? null,
                'user_rol' => $user->rol ?? null,
                'room_name' => $roomName,
                'duration_seconds' => $durationSeconds,
                'manual_coins_amount' => $manualCoinsAmount,
                'reason' => $request->input('reason'),
                'timestamp' => now()->toDateTimeString()
            ]);

            if (!$user || $user->rol !== 'cliente') {
                Log::warning('⚠️ [DEBUG] Usuario no autorizado para processPeriodicDeduction', [
                    'user_id' => $user->id ?? null,
                    'user_rol' => $user->rol ?? null
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Solo clientes pueden usar este endpoint'
                ], 403);
            }

            $minutesConsumed = max(1, (int) floor($durationSeconds / 60));

            $completedMinutes = (int) floor(
                CoinConsumption::where('user_id', $user->id)
                    ->where('room_name', $roomName)
                    ->sum('minutes_consumed')
            );

            $baseMinuteValueUsd = CallPricingService::getBaseMinuteValueUsd();
            $coinsPerMinute = CallPricingService::getCoinsPerMinute();
            $coinsToDeduct = CallPricingService::calculateProgressiveCoins(
                $completedMinutes + 1,
                $minutesConsumed,
                $baseMinuteValueUsd,
                $coinsPerMinute
            );

            Log::info('💰 [DEBUG] Cálculo progresivo de coins', [
                'user_id' => $user->id,
                'duration_seconds' => $durationSeconds,
                'minutes_consumed' => $minutesConsumed,
                'completed_minutes' => $completedMinutes,
                'coins_to_deduct' => $coinsToDeduct,
                'manual_coins_amount' => $manualCoinsAmount
            ]);

            if (!$this->coinController) {
                return response()->json([
                    'success' => false,
                    'error' => 'Error interno del sistema'
                ], 500);
            }

            // 🔥 PROCESAR DESCUENTO
            Log::info('🔍 [DEBUG] Llamando a processConsumption', [
                'user_id' => $user->id,
                'room_name' => $roomName,
                'minutes_consumed' => round($minutesConsumed, 3),
                'coins_to_deduct' => $coinsToDeduct,
                'session_id' => 'periodic_' . time()
            ]);
            
            $result = $this->coinController->processConsumption(
                $user->id,
                $roomName,
                $minutesConsumed,
                $coinsToDeduct,
                'periodic_' . time()
            );

            if (!$result['success']) {
                Log::warning('⚠️ [DEBUG] Saldo insuficiente en processPeriodicDeduction', [
                    'user_id' => $user->id,
                    'required' => $coinsToDeduct,
                    'remaining_balance' => $result['remaining_balance'] ?? 0,
                    'error' => $result['error'] ?? 'unknown'
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'insufficient_balance',
                    'action' => 'end_session',
                    'remaining_balance' => $result['remaining_balance'] ?? 0,
                    'required_coins' => $coinsToDeduct
                ], 402);
            }

            Log::info('✅ [DEBUG] Descuento exitoso en processPeriodicDeduction', [
                'user_id' => $user->id,
                'room_name' => $roomName,
                'coins_deducted' => $coinsToDeduct,
                'minutes_consumed' => round($minutesConsumed, 3),
                'remaining_balance' => $result['remaining_balance'],
                'reason' => $request->input('reason')
            ]);

            // 🔥 CORRECCIÓN: minutes_remaining debe basarse solo en purchased_balance, NO en remaining_balance (que incluye gift)
            $purchasedBalance = $result['purchased_balance'] ?? ($result['remaining_balance'] ?? 0);
            $minutesRemaining = floor($purchasedBalance / VideoChatCoinController::COST_PER_MINUTE);
            
            return response()->json([
                'success' => true,
                'coins_deducted' => $coinsToDeduct,
                'remaining_balance' => $result['remaining_balance'],
                'minutes_remaining' => $minutesRemaining, // 🔥 Solo purchased_balance / 10
                'can_continue' => $purchasedBalance >= VideoChatCoinController::COST_PER_MINUTE // 🔥 Solo purchased_balance para continuar
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error en descuento periódico: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'error' => 'Error procesando descuento periódico'
            ], 500);
        }
    }





    public function generateTokenOriginal(Request $request)
    {
        try {
            $request->validate([
                'room' => 'required|string'
                // identity ya no se requiere - se genera automáticamente en generateToken
            ]);

            $user = auth()->user();
            
            Log::info('🎥 [ORIGINAL] Generando token para modelo', [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'room' => $request->room
            ]);

            // Para modelos, usar el método original sin descuentos
            // generateToken ahora genera automáticamente una identidad única
            return $this->generateToken($request);
            
        } catch (\Exception $e) {
            Log::error('❌ [ORIGINAL] Error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Error generando token: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * 🔔 WEBHOOK HANDLER - Procesar eventos de LiveKit
     * 
     * Este método procesa webhooks de LiveKit para detectar desconexiones
     * en tiempo real. LiveKit envía eventos cuando:
     * - Un participante se desconecta (participant_left)
     * - Una sala se cierra (room_finished)
     * - Un participante se conecta (participant_joined)
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function handleWebhook(Request $request)
    {
        try {
            // Validar firma del webhook (si está configurado)
            $this->validateWebhookSignature($request);

            $payload = json_decode($request->getContent(), true);
            
            if (!$payload || !isset($payload['event'])) {
                Log::warning('❌ [LiveKit Webhook] Payload inválido', [
                    'payload_keys' => $payload ? array_keys($payload) : null
                ]);
                return response('Invalid payload', 400);
            }

            $event = $payload['event'];
            $eventType = $event['type'] ?? 'unknown';
            $roomName = $event['room']['name'] ?? null;

            Log::info('📨 [LiveKit Webhook] Evento recibido', [
                'event_type' => $eventType,
                'room_name' => $roomName,
                'timestamp' => $event['timestamp'] ?? null
            ]);

            // 🔥 DESACTIVADO: Ya no procesamos desconexiones automáticas desde webhooks
            // La llamada solo se corta cuando el usuario lo decide manualmente
            switch ($eventType) {
                case 'participant_left':
                    // 🔥 DESACTIVADO: Solo loguear, NO procesar desconexión automática
                    Log::info('⏸️ [LiveKit Webhook] participant_left detectado pero NO se procesará automáticamente', [
                        'room_name' => $roomName
                    ]);
                    return response('OK - Auto-disconnect disabled', 200);
                    
                case 'room_finished':
                    return $this->handleRoomFinished($event, $roomName);
                    
                case 'participant_joined':
                    // 🔥 VERIFICAR SI HAY UNA DESCONEXIÓN PENDIENTE Y CANCELARLA
                    $participant = $event['participant'] ?? null;
                    $participantIdentity = $participant['identity'] ?? null;
                    
                    if ($participantIdentity && preg_match('/^user_(\d+)_(cliente|modelo)$/', $participantIdentity, $matches)) {
                        $userId = (int)$matches[1];
                        $disconnectionKey = "disconnect_grace_{$roomName}_{$userId}";
                        
                        // Si hay una desconexión pendiente, cancelarla
                        if (Cache::has($disconnectionKey)) {
                            Cache::forget($disconnectionKey);
                            Log::info('✅ [LiveKit Webhook] Usuario se reconectó - cancelando notificación pendiente', [
                                'room_name' => $roomName,
                                'user_id' => $userId,
                                'participant_identity' => $participantIdentity
                            ]);
                        }
                    }
                    
                    Log::info('✅ [LiveKit Webhook] Participante se unió', [
                        'room_name' => $roomName,
                        'participant_identity' => $participantIdentity
                    ]);
                    return response('OK', 200);
                    
                default:
                    Log::info('ℹ️ [LiveKit Webhook] Evento no procesado', [
                        'event_type' => $eventType,
                        'room_name' => $roomName
                    ]);
                    return response('Event not processed', 200);
            }

        } catch (\Exception $e) {
            Log::error('❌ [LiveKit Webhook] Error procesando webhook', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response('Error processing webhook', 500);
        }
    }

    /**
     * 🚪 Manejar evento cuando un participante abandona la sala
     */
    private function handleParticipantLeft($event, $roomName)
    {
        try {
            $participant = $event['participant'] ?? null;
            $participantIdentity = $participant['identity'] ?? null;

            if (!$participantIdentity || !$roomName) {
                Log::warning('⚠️ [LiveKit Webhook] participant_left sin datos suficientes', [
                    'room_name' => $roomName,
                    'has_participant' => !is_null($participant),
                    'has_identity' => !is_null($participantIdentity)
                ]);
                return response('OK', 200);
            }

            // Extraer user_id y role de la identity (formato: user_{id}_{role})
            if (preg_match('/^user_(\d+)_(cliente|modelo)$/', $participantIdentity, $matches)) {
                $userId = (int)$matches[1];
                $userRole = $matches[2];
            } else {
                Log::warning('⚠️ [LiveKit Webhook] Identity con formato no reconocido', [
                    'identity' => $participantIdentity
                ]);
                return response('OK', 200);
            }

            Log::info('🚪 [LiveKit Webhook] Participante abandonó sala', [
                'room_name' => $roomName,
                'user_id' => $userId,
                'user_role' => $userRole,
                'participant_identity' => $participantIdentity
            ]);

            // Buscar la sesión activa
            $chatSession = ChatSession::where('room_name', $roomName)
                ->where('status', 'active')
                ->first();

            if (!$chatSession) {
                Log::info('ℹ️ [LiveKit Webhook] No se encontró sesión activa para la sala', [
                    'room_name' => $roomName
                ]);
                
                // Aun así, limpiar VideoChatSession si existe
                $this->cleanupVideoChatSession($userId, $roomName, 'participant_left');
                return response('OK', 200);
            }

            // Determinar quién es el partner
            $partnerId = null;
            $partnerRole = null;
            
            if ($userRole === 'cliente' && $chatSession->cliente_id === $userId) {
                $partnerId = $chatSession->modelo_id;
                $partnerRole = 'modelo';
            } elseif ($userRole === 'modelo' && $chatSession->modelo_id === $userId) {
                $partnerId = $chatSession->cliente_id;
                $partnerRole = 'cliente';
            }

            if (!$partnerId) {
                Log::warning('⚠️ [LiveKit Webhook] No se pudo identificar el partner', [
                    'room_name' => $roomName,
                    'user_id' => $userId,
                    'user_role' => $userRole,
                    'chat_session_id' => $chatSession->id
                ]);
                
                // Limpiar sesión de todos modos
                $this->cleanupVideoChatSession($userId, $roomName, 'participant_left');
                return response('OK', 200);
            }

            // 🔥 DESACTIVADO: Ya no enviamos notificaciones automáticas de desconexión desde webhooks
            // Solo se desconecta cuando el usuario presiona el botón manualmente
            // Solo limpiar la sesión del usuario que se desconectó, pero NO notificar al partner
            Log::info('⏸️ [LiveKit Webhook] Participante abandonó sala - NO se enviará notificación automática', [
                'room_name' => $roomName,
                'user_id' => $userId,
                'user_role' => $userRole,
                'partner_id' => $partnerId,
                'note' => 'Desconexiones automáticas desactivadas - solo desconexión manual'
            ]);
            
            // Solo limpiar la sesión del usuario que se desconectó
            $this->cleanupVideoChatSession($userId, $roomName, 'participant_left');

            return response('OK', 200);

        } catch (\Exception $e) {
            Log::error('❌ [LiveKit Webhook] Error en handleParticipantLeft', [
                'error' => $e->getMessage(),
                'room_name' => $roomName,
                'trace' => $e->getTraceAsString()
            ]);
            return response('Error processing participant_left', 500);
        }
    }

    /**
     * 🏁 Manejar evento cuando una sala se cierra completamente
     */
    private function handleRoomFinished($event, $roomName)
    {
        try {
            Log::info('🏁 [LiveKit Webhook] Sala finalizada', [
                'room_name' => $roomName
            ]);

            // Buscar todas las sesiones activas de esta sala
            $chatSession = ChatSession::where('room_name', $roomName)
                ->where('status', 'active')
                ->first();

            if ($chatSession) {
                // Finalizar ChatSession
                $chatSession->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => 'room_closed'
                ]);

                // Notificar a ambos participantes si existen
                if ($chatSession->cliente_id) {
                    NotificationController::sendNotification($chatSession->cliente_id, 'room_closed', [
                        'room_name' => $roomName,
                        'reason' => 'room_closed'
                    ]);
                }

                if ($chatSession->modelo_id) {
                    NotificationController::sendNotification($chatSession->modelo_id, 'room_closed', [
                        'room_name' => $roomName,
                        'reason' => 'room_closed'
                    ]);
                }

                // Limpiar todas las VideoChatSessions de esta sala
                VideoChatSession::where('room_name', $roomName)
                    ->where('status', 'active')
                    ->update([
                        'status' => 'ended',
                        'ended_at' => now(),
                        'end_reason' => 'room_closed',
                        'is_consuming' => false
                    ]);
            }

            // Limpiar datos relacionados
            $this->limpiarDatosRelacionados($roomName);

            Log::info('✅ [LiveKit Webhook] Sala finalizada procesada', [
                'room_name' => $roomName
            ]);

            return response('OK', 200);

        } catch (\Exception $e) {
            Log::error('❌ [LiveKit Webhook] Error en handleRoomFinished', [
                'error' => $e->getMessage(),
                'room_name' => $roomName,
                'trace' => $e->getTraceAsString()
            ]);
            return response('Error processing room_finished', 500);
        }
    }

    /**
     * 🧹 Limpiar VideoChatSession de un usuario
     */
    private function cleanupVideoChatSession($userId, $roomName, $endReason)
    {
        try {
            VideoChatSession::where('user_id', $userId)
                ->where('room_name', $roomName)
                ->where('status', 'active')
                ->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => $endReason,
                    'is_consuming' => false
                ]);

            Log::info('🧹 [LiveKit Webhook] VideoChatSession limpiada', [
                'user_id' => $userId,
                'room_name' => $roomName,
                'end_reason' => $endReason
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [LiveKit Webhook] Error limpiando VideoChatSession', [
                'error' => $e->getMessage(),
                'user_id' => $userId,
                'room_name' => $roomName
            ]);
        }
    }

    /**
     * 🔐 Validar firma del webhook de LiveKit (opcional pero recomendado)
     */
    private function validateWebhookSignature(Request $request)
{
    $authHeader = $request->header('Authorization');

    if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
        throw new \Exception('Missing webhook authorization header');
    }

    $token = str_replace('Bearer ', '', $authHeader);
    $secret = config('services.livekit.webhook_secret');

    try {
        JWT::decode($token, new Key($secret, 'HS256'));
    } catch (\Exception $e) {
        Log::error('❌ [LiveKit Webhook] Invalid signature', [
            'error' => $e->getMessage()
        ]);
        throw new \Exception('Invalid webhook signature');
    }
}
    
}
    
  
