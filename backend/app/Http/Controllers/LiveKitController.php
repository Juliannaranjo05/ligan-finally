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
use App\Http\Controllers\NotificationController;
use Illuminate\Support\Facades\Redis; // 🔥 ESTA LÍNEA FALTABA!
use App\Http\Controllers\VideoChatCoinController;
use App\Models\VideoChatSession;
use App\Models\SessionEarning;
use App\Http\Controllers\SessionEarningsController;

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
        try {
            // Validar los datos de entrada
            $request->validate([
                'room' => 'required|string',
                'identity' => 'required|string'
            ]);

            $roomName = $request->input('room');
            $participantName = $request->input('identity');

            // Obtener credenciales
            $apiKey = config('livekit.api_key');
            $apiSecret = config('livekit.api_secret');
            $serverUrl = config('livekit.ws_url');


            if (!$apiKey || !$apiSecret || !$serverUrl) {
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
            $user = auth()->user();

            // 🔥 VERIFICAR SALDO ANTES DE GENERAR TOKEN (SOLO CLIENTES)
            if ($user && $user->rol === 'cliente') {
                $balanceCheck = $this->coinController->canStartVideoChat($user->id);
                
                if (!$balanceCheck['can_start']) {
                    Log::warning('🚫 Cliente sin saldo intentó obtener token', [
                        'user_id' => $user->id,
                        'balance' => $balanceCheck['total_balance'] ?? 0
                    ]);
                    
                    return response()->json([
                        'error' => 'Saldo insuficiente para iniciar videochat',
                        'balance_info' => $balanceCheck,
                        'action' => 'redirect_to_coins'
                    ], 402);
                }
            }

            // Generar token JWT
            $token = JWT::encode($payload, $apiSecret, 'HS256');

            return response()->json([
                'token' => $token,
                'serverUrl' => $serverUrl
            ]);

        } catch (\Exception $e) {
            \Log::error('Error generating LiveKit token: ' . $e->getMessage());

            return response()->json([
                'error' => 'Error generating token: ' . $e->getMessage()
            ], 500);
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

    // ✅ RULETA OMEGLE - VERSIÓN MEJORADA CON MEJOR MANEJO DE RESPUESTAS
    public function iniciarRuleta(Request $request)
    {
        try {
            $user = auth()->user();
            
            // 🔥 VERIFICAR SALDO ANTES DE INICIAR - SOLO PARA CLIENTES
            if ($user->rol === 'cliente') {
                $coinController = new VideoChatCoinController();
                $balanceCheck = $coinController->canStartVideoChat($user->id);
                
                if (!$balanceCheck['can_start']) {
                    Log::warning('🚫 Cliente sin saldo suficiente intentó iniciar videochat', [
                        'user_id' => $user->id,
                        'balance' => $balanceCheck['total_balance'] ?? 0,
                        'deficit' => $balanceCheck['deficit'] ?? 0
                    ]);
                    
                    return response()->json([
                        'success' => false,
                        'error' => 'insufficient_balance',
                        'message' => 'Saldo insuficiente para iniciar videochat',
                        'balance_info' => $balanceCheck,
                        'redirect_to' => '/buy-coins'
                    ], 400);
                }
                
                Log::info('✅ Cliente con saldo suficiente inicia videochat', [
                    'user_id' => $user->id,
                    'balance' => $balanceCheck['total_balance'],
                    'minutes_available' => $balanceCheck['minutes_available']
                ]);
            } else {
                Log::info('✅ Modelo inicia videochat (sin verificación de saldo)', [
                    'user_id' => $user->id,
                    'user_role' => $user->rol
                ]);
            }
            
            // Verificar que el usuario es cliente o modelo
            if (!in_array($user->rol, ['cliente', 'modelo'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo clientes y modelos pueden usar la ruleta'
                ], 403);
            }

            // 🔥 PASO 1: VERIFICAR EXCLUSIONES PREVIAS
            $excludedUserId = null;
            $excludedUserName = null;
            
            // Verificar exclusión en Cache
            $cacheExcludedUser = Cache::get("exclude_user_{$user->id}");
            
            if ($cacheExcludedUser) {
                $excludedUserId = $cacheExcludedUser;
                $excludedUser = User::find($excludedUserId);
                $excludedUserName = $excludedUser ? ($excludedUser->alias ?? $excludedUser->name) : 'Usuario';
                
                Log::info("🚫 [INICIAR] Exclusión activa encontrada", [
                    'user_id' => $user->id,
                    'user_name' => $user->alias ?? $user->name,
                    'excluded_user_id' => $excludedUserId,
                    'excluded_user_name' => $excludedUserName,
                    'source' => 'cache_storage'
                ]);
            }
            
            // 🧹 LIMPIEZA PREVIA CON TRANSACCIÓN
            DB::beginTransaction();
            try {
                // Finalizar TODAS las sesiones del usuario
                $sessionsLimpiadas = ChatSession::where(function($query) use ($user) {
                    $query->where('cliente_id', $user->id)
                        ->orWhere('modelo_id', $user->id);
                })
                ->whereIn('status', ['waiting', 'active'])
                ->update([
                    'status' => 'ended',
                    'ended_at' => now(),
                    'end_reason' => 'new_session_cleanup'
                ]);
                
                // Limpiar sesiones viejas del sistema
                ChatSession::where('status', 'waiting')
                    ->where('created_at', '<', now()->subMinutes(3))
                    ->update([
                        'status' => 'ended',
                        'ended_at' => now(),
                        'end_reason' => 'timeout'
                    ]);
                
                DB::commit();
                
                Log::info('🧹 Limpieza previa completada', [
                    'user_id' => $user->id,
                    'user_role' => $user->rol,
                    'sessions_cleaned' => $sessionsLimpiadas,
                    'excluded_user_id' => $excludedUserId
                ]);
                
            } catch (\Exception $e) {
                DB::rollback();
                throw $e;
            }
            
            // 🎯 BUSCAR SESIÓN COMPATIBLE CON EXCLUSIÓN
            $rolBuscado = $user->rol === 'cliente' ? 'modelo' : 'cliente';
            
            Log::info("🔍 [INICIAR] Buscando sesión compatible", [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'looking_for_role' => $rolBuscado,
                'excluded_user_id' => $excludedUserId,
                'excluded_user_name' => $excludedUserName
            ]);
            // 🔥 DEBUG ADICIONAL
            $debugWaitingSessions = ChatSession::where('status', 'waiting')->get();
            Log::info("🔍 [DEBUG] Estado completo de sesiones waiting", [
                'total_waiting_sessions' => $debugWaitingSessions->count(),
                'sessions_detail' => $debugWaitingSessions->map(function($s) {
                    return [
                        'id' => $s->id,
                        'room' => $s->room_name,
                        'cliente_id' => $s->cliente_id,
                        'modelo_id' => $s->modelo_id,
                        'created_minutes_ago' => $s->created_at->diffInMinutes(now())
                    ];
                })->toArray(),
                'current_user_id' => $user->id,
                'current_user_role' => $user->rol,
                'looking_for_role' => $rolBuscado,
                'excluded_user_id' => $excludedUserId
            ]);
            
            $sessionEsperando = null;
            
            if ($user->rol === 'cliente') {
                // Cliente busca sesiones creadas por modelos (modelo_id != null, cliente_id = null)
                $query = ChatSession::where('status', 'waiting')
                    ->whereNotNull('modelo_id')  // Creada por modelo
                    ->whereNull('cliente_id')    // Sin cliente asignado
                    ->where('modelo_id', '!=', $user->id); // No el mismo usuario
                    
                // 🔥 APLICAR EXCLUSIÓN SI EXISTE
                if ($excludedUserId) {
                    $query->where('modelo_id', '!=', $excludedUserId);
                    Log::info("🚫 [INICIAR] Aplicando exclusión en búsqueda", [
                        'excluded_user_id' => $excludedUserId,
                        'excluded_user_name' => $excludedUserName
                    ]);
                }
                    
                $sessionEsperando = $query->orderBy('created_at', 'asc')
                    ->lockForUpdate()
                    ->first();
                    
            } else {
                // Modelo busca sesiones creadas por clientes (cliente_id != null, modelo_id = null)
                $query = ChatSession::where('status', 'waiting')
                    ->whereNotNull('cliente_id') // Creada por cliente
                    ->whereNull('modelo_id')     // Sin modelo asignado
                    ->where('cliente_id', '!=', $user->id); // No el mismo usuario
                    
                // 🔥 APLICAR EXCLUSIÓN SI EXISTE
                if ($excludedUserId) {
                    $query->where('cliente_id', '!=', $excludedUserId);
                    Log::info("🚫 [INICIAR] Aplicando exclusión en búsqueda", [
                        'excluded_user_id' => $excludedUserId,
                        'excluded_user_name' => $excludedUserName
                    ]);
                }
                    
                $sessionEsperando = $query->orderBy('created_at', 'asc')
                    ->lockForUpdate()
                    ->first();
            }
            
            if ($sessionEsperando) {
                // 🎉 MATCH ENCONTRADO - VERIFICAR QUE NO SEA EL EXCLUIDO
                $usuarioEsperando = null;
                $matchedUserId = null;
                
                if ($user->rol === 'cliente') {
                    $matchedUserId = $sessionEsperando->modelo_id;
                    $usuarioEsperando = User::find($matchedUserId);
                } else {
                    $matchedUserId = $sessionEsperando->cliente_id;
                    $usuarioEsperando = User::find($matchedUserId);
                }
                
                // 🚨 DOBLE VERIFICACIÓN DE SEGURIDAD
                if ($matchedUserId == $excludedUserId) {
                    Log::error("❌ [INICIAR] Match con usuario excluido detectado", [
                        'matched_user_id' => $matchedUserId,
                        'excluded_user_id' => $excludedUserId,
                        'session_id' => $sessionEsperando->id
                    ]);
                    
                    // Marcar esta sesión como problemática y reintentar
                    $sessionEsperando->update(['status' => 'ended', 'end_reason' => 'exclusion_failed']);
                    
                    // Reintentar la búsqueda
                    return $this->iniciarRuleta($request);
                }
                
                if (!$usuarioEsperando) {
                    $sessionEsperando->update(['status' => 'ended', 'end_reason' => 'user_not_found']);
                    return $this->iniciarRuleta($request);
                }
                
                Log::info("✅ [INICIAR] Match válido encontrado", [
                    'matched_user_id' => $matchedUserId,
                    'matched_user_name' => $usuarioEsperando ? ($usuarioEsperando->alias ?? $usuarioEsperando->name) : 'Unknown',
                    'is_different_from_excluded' => $matchedUserId != $excludedUserId ? 'YES - CORRECTO' : 'NO - ERROR',
                    'session_room' => $sessionEsperando->room_name,
                    'exclusion_working' => $excludedUserId ? true : false
                ]);
                
                DB::beginTransaction();
                try {
                    if ($user->rol === 'cliente') {
                        // Cliente se conecta a sala de modelo
                        $sessionEsperando->update([
                            'cliente_id' => $user->id,  // Asignar cliente
                            'status' => 'active',
                            'started_at' => now()
                        ]);
                    } else {
                        // Modelo se conecta a sala de cliente
                        $sessionEsperando->update([
                            'modelo_id' => $user->id,   // Asignar modelo
                            'status' => 'active',
                            'started_at' => now()
                        ]);
                    }
                    
                    DB::commit();
                } catch (\Exception $e) {
                    DB::rollback();
                    throw $e;
                }
                
                Log::info('🎉 Match encontrado en ruleta', [
                    'user_id' => $user->id,
                    'user_role' => $user->rol,
                    'session_id' => $sessionEsperando->id,
                    'room_name' => $sessionEsperando->room_name,
                    'matched_with' => $usuarioEsperando->id,
                    'matched_with_role' => $usuarioEsperando->rol,
                    'excluded_user_id' => $excludedUserId,
                    'exclusion_applied' => $excludedUserId ? true : false
                ]);
                
                // 🔥 RESPUESTA CONSISTENTE
                return response()->json([
                    'success' => true,
                    'type' => 'match_found',
                    'roomName' => $sessionEsperando->room_name,
                    'room_name' => $sessionEsperando->room_name,
                    'userName' => $user->name ?? "{$user->rol}_{$user->id}",
                    'user_name' => $user->name ?? "{$user->rol}_{$user->id}",
                    'matched_with' => [
                        'id' => $usuarioEsperando->id,
                        'name' => $usuarioEsperando->name ?? "Usuario_{$usuarioEsperando->id}",
                        'role' => $usuarioEsperando->rol
                    ],
                    'session_id' => $sessionEsperando->id,
                    'status' => 'active',
                    'exclusion_applied' => $excludedUserId ? true : false,
                    'excluded_user_id' => $excludedUserId
                ]);
            }
            
            // 🕐 CREAR SALA DE ESPERA
            Log::info("⏳ [INICIAR] No hay matches válidos, creando sala de espera", [
                'excluded_user_id' => $excludedUserId,
                'excluded_user_name' => $excludedUserName
            ]);
            
            $roomName = "omegle_" . $user->rol . "_" . $user->id . "_" . time() . "_" . rand(1000, 9999);
            
            DB::beginTransaction();
            try {
                // 🔥 FIX: ASIGNAR cliente_id Y modelo_id SEGÚN EL ROL REAL
                $sessionData = [
                    'room_name' => $roomName,
                    'status' => 'waiting',
                    'modelo_data' => [
                        'id' => $user->id,
                        'nombre' => $user->name ?? "Usuario_{$user->id}",
                        'tipo' => $user->rol,
                        'pais' => '🌎'
                    ]
                ];
                
                // 🔥 ASIGNAR IDs SEGÚN ROL REAL DEL USUARIO
                if ($user->rol === 'cliente') {
                    $sessionData['cliente_id'] = $user->id;
                    $sessionData['modelo_id'] = null;
                } else { // modelo
                    $sessionData['cliente_id'] = null;  // 🔥 FIX: NULL porque es modelo quien crea
                    $sessionData['modelo_id'] = $user->id;  // 🔥 FIX: Modelo va en modelo_id
                }
                
                $session = ChatSession::create($sessionData);
                
                DB::commit();
                
                Log::info('⏳ Nueva sesión de espera creada', [
                    'user_id' => $user->id,
                    'user_role' => $user->rol,
                    'session_id' => $session->id,
                    'room_name' => $roomName,
                    'cliente_id' => $session->cliente_id,
                    'modelo_id' => $session->modelo_id,
                    'will_exclude_on_match' => $excludedUserId
                ]);
                
                // 🔥 RESPUESTA CONSISTENTE
                return response()->json([
                    'success' => true,
                    'type' => 'waiting',
                    'roomName' => $roomName,
                    'room_name' => $roomName,
                    'userName' => $user->name ?? "{$user->rol}_{$user->id}",
                    'user_name' => $user->name ?? "{$user->rol}_{$user->id}",
                    'session_id' => $session->id,
                    'status' => 'waiting',
                    'waiting_for' => $rolBuscado,
                    'exclusion_info' => [
                        'excluded_user_id' => $excludedUserId,
                        'excluded_user_name' => $excludedUserName
                    ]
                ]);
                
            } catch (\Exception $e) {
                DB::rollback();
                throw $e;
            }
            
        } catch (\Exception $e) {
            Log::error('❌ Error iniciando ruleta: ' . $e->getMessage(), [
                'user_id' => auth()->id(),
                'stack_trace' => $e->getTraceAsString()
            ]);
            
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
                // Solo usuarios con actividad reciente (últimos 30 segundos)
                $isRecent = $userStatus->last_seen && $userStatus->last_seen->gt(now()->subSeconds(30));
                
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
                    
                    Log::info("🔍 [EXCLUSION] Usuario anterior identificado para excluir", [
                        'current_user_id' => $user->id,
                        'current_user_name' => $user->alias ?? $user->name,
                        'previous_user_id' => $previousUserId,
                        'previous_user_name' => $previousUserName,
                        'session_anterior_id' => $previousSession->id,
                        'session_room_name' => $previousSession->room_name,
                        'exclusion_reason' => 'user_went_next'
                    ]);
                    
                    // 🔥 MARCAR PARA EXCLUSIÓN EN SESIÓN (2 MINUTOS)
                    session(["exclude_user_{$user->id}" => $previousUserId]);
                    session(["exclude_expires_{$user->id}" => now()->addMinutes(2)->timestamp]);
                }
            }
        } catch (\Exception $e) {
            Log::warning("⚠️ Error identificando usuario anterior: " . $e->getMessage());
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
            
        // 🔥 EXCLUSIÓN PRINCIPAL - USUARIO ANTERIOR
        if ($previousUserId) {
            $sessionQuery->where('users.id', '!=', $previousUserId);
            Log::info("🚫 [EXCLUSION] Aplicando exclusión principal", [
                'excluded_user_id' => $previousUserId,
                'excluded_user_name' => $previousUserName
            ]);
        }
        
        // 🔥 EXCLUSIÓN ADICIONAL - VERIFICAR EXCLUSIONES EN SESIÓN
        $sessionExcludedUser = session("exclude_user_{$user->id}");
        $sessionExcludeExpires = session("exclude_expires_{$user->id}");
        
        if ($sessionExcludedUser && $sessionExcludeExpires && $sessionExcludeExpires > now()->timestamp) {
            if ($sessionExcludedUser != $previousUserId) { // Si no es el mismo, agregar a exclusión
                $sessionQuery->where('users.id', '!=', $sessionExcludedUser);
                Log::info("🚫 [EXCLUSION] Aplicando exclusión de sesión", [
                    'excluded_user_id' => $sessionExcludedUser,
                    'expires_at' => date('Y-m-d H:i:s', $sessionExcludeExpires)
                ]);
            }
        } else if ($sessionExcludedUser) {
            // Limpiar exclusión expirada
            session()->forget(["exclude_user_{$user->id}", "exclude_expires_{$user->id}"]);
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
            
            // 🚨 DOBLE VERIFICACIÓN DE SEGURIDAD
            if ($matchedUserId == $previousUserId) {
                Log::error("❌ [ERROR] Match con usuario anterior detectado", [
                    'matched_user_id' => $matchedUserId,
                    'previous_user_id' => $previousUserId,
                    'session_id' => $waitingSession->id
                ]);
                
                // Marcar esta sesión como problemática y buscar otra
                DB::table('video_sessions')
                    ->where('id', $waitingSession->id)
                    ->update(['status' => 'error', 'end_reason' => 'exclusion_failed']);
                
                throw new \Exception('Error de exclusión: match con usuario anterior');
            }
            
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

            // 💰 VERIFICAR SALDO DEL CLIENTE AUTOMÁTICAMENTE
            if ($clienteId) {
                $balanceCheck = $this->checkClientBalance($clienteId);
                
                if (!$balanceCheck['sufficient']) {
                    $endReason = 'insufficient_balance';
                    
                    \Log::warning('🚫 Finalizando sala automáticamente por saldo insuficiente', [
                        'cliente_id' => $clienteId,
                        'modelo_id' => $modeloId,
                        'room_name' => $roomName,
                        'remaining_balance' => $balanceCheck['balance'],
                        'remaining_minutes' => $balanceCheck['minutes_left']
                    ]);
                }
            }

            // 🛑 FINALIZAR TODAS LAS SESIONES RELACIONADAS
            $this->terminateAllRoomSessions($roomName, $clienteId, $modeloId, $endReason);

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

        $totalBalance = $userCoins->purchased_balance + $userCoins->gift_balance;
        $costPerMinute = VideoChatCoinController::COST_PER_MINUTE;
        $minutesLeft = floor($totalBalance / $costPerMinute);

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
        // 1. FINALIZAR CHAT SESSIONS
        $chatSessions = ChatSession::where('room_name', $roomName)
            ->whereIn('status', ['waiting', 'active'])
            ->get();

        foreach ($chatSessions as $session) {
            $session->update([
                'status' => 'ended',
                'ended_at' => $now,
                'end_reason' => $endReason
            ]);

            \Log::info('✅ Chat session finalizada', [
                'chat_session_id' => $session->id,
                'room_name' => $roomName,
                'reason' => $endReason
            ]);
        }

        // 2. FINALIZAR VIDEO CHAT SESSIONS
        $videoSessions = VideoChatSession::where('room_name', $roomName)
            ->where('status', 'active')
            ->get();

        foreach ($videoSessions as $session) {
            $session->update([
                'status' => 'ended',
                'ended_at' => $now,
                'is_consuming' => false,
                'end_reason' => $endReason
            ]);

            \Log::info('✅ Video chat session finalizada', [
                'video_session_id' => $session->id,
                'room_name' => $roomName,
                'total_consumed' => $session->total_consumed,
                'reason' => $endReason
            ]);
        }

    } catch (\Exception $e) {
        \Log::error('❌ Error terminando sesiones de la sala', [
            'room_name' => $roomName,
            'error' => $e->getMessage()
        ]);
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

        $notificationData = [
            'type' => 'room_closed',
            'room_name' => $roomName,
            'end_reason' => $endReason,
            'message' => $message,
            'urgency' => $urgency,
            'closed_at' => now()->toISOString()
        ];

        // Notificar al cliente
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
        }

        // Notificar a la modelo
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
        }

        \Log::info('🔔 Notificaciones de cierre enviadas', [
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
                        'session_id' => $currentSession->id
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
                
                Log::info('✅ Usuario permanece en sala actual', [
                    'user_id' => $user->id,
                    'room' => $currentRoom,
                    'session_status' => $currentSession->status,
                    'session_id' => $currentSession->id
                ]);
                
                return response()->json([
                    'shouldRedirect' => false,
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
                    if ($modelo && $this->verifyUserIsSearchingOrActive($session->modelo_id, $roomName)) { // ✅ CAMBIAR: usar función más permisiva
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
                    \Log::error('❌ Usuario no autenticado en getChatMessages');
                    return response()->json([
                        'success' => false,
                        'error' => 'Usuario no autenticado'
                    ], 401);
                }

                \Log::info('📥 Obteniendo mensajes de chat', [
                    'user_id' => $userId,
                    'room_name' => $roomName
                ]);

                // 🔥 AGREGAR VERIFICACIÓN DE ACCESO
                if (!$this->userHasAccessToRoom($userId, $roomName)) {
                    \Log::warning('❌ Acceso denegado a room en LiveKit', [
                        'user_id' => $userId,
                        'room_name' => $roomName
                    ]);
                    return response()->json([
                        'success' => false,
                        'error' => 'Acceso denegado a esta sala'
                    ], 403);
                }

                // Obtener mensajes usando tu modelo ChatMessage
                $messages = ChatMessage::where('room_name', $roomName)
                    ->orderBy('created_at', 'asc') // Del más antiguo al más nuevo
                    ->limit(50) // Últimos 50 mensajes
                    ->get()
                    ->map(function ($message) {
                        return [
                            'id' => $message->id,
                            'user_id' => $message->user_id,
                            'user_name' => $message->user_name,
                            'user_role' => $message->user_role,
                            'message' => $message->message,
                            'type' => $message->type,
                            'extra_data' => $message->extra_data,
                            'timestamp' => $message->created_at->toISOString(),
                            'created_at' => $message->created_at->toISOString()
                        ];
                    })
                    ->toArray();

                \Log::info('✅ Mensajes obtenidos exitosamente', [
                    'room_name' => $roomName,
                    'count' => count($messages)
                ]);

                return response()->json([
                    'success' => true,
                    'messages' => $messages,
                    'room_name' => $roomName,
                    'total_count' => count($messages)
                ]);

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
                    $clienteActive = $session->cliente_id ? $this->verifyUserIsReallyActive($session->cliente_id, $session->room_name) : true;
                    $modeloActive = $session->modelo_id ? $this->verifyUserIsReallyActive($session->modelo_id, $session->room_name) : true;
                    
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
        
        // 🔥 NOTIFICAR AL CLIENTE que la MODELO se fue
        if ($partnerId) {
            NotificationController::sendNotification($partnerId, 'model_left', [
                'action' => $action,
                'partner_name' => $modelUserName,
                'partner_id' => $modeloId,
                'room' => $roomName,
                'redirect_params' => [
                    'role' => 'cliente',
                    'from' => 'model_disconnect',
                    'reason' => 'model_stopped',
                    'currentRoom' => $roomName
                ]
            ]);
        }
        
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
        
        // 🔥 NOTIFICAR A LA MODELO que el CLIENTE se fue
        if ($partnerId) {
            NotificationController::sendNotification($partnerId, 'client_left', [
                'action' => $action,
                'partner_name' => $clientUserName,
                'partner_id' => $clienteId,
                'room' => $roomName,
                'redirect_params' => [
                    'role' => 'modelo',
                    'from' => 'client_disconnect',
                    'reason' => 'client_stopped',
                    'currentRoom' => $roomName
                ]
            ]);
        }
        
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

            // 5. Guardar notificación en BD
            DB::table('notifications')->insert([
                'user_id' => $partnerUserId,
                'type' => 'partner_left_session',
                'data' => json_encode([
                    'message' => 'Tu partner terminó la sesión',
                    'partner_name' => $user->name,
                    'redirect_url' => $partnerRedirect,
                    'redirect_params' => $redirectParams // ✅ USAR PARÁMETROS DINÁMICOS
                ]),
                'read' => false,
                'expires_at' => now()->addMinutes(5),
                'created_at' => now(),
                'updated_at' => now()
            ]);
            
            Log::info('✅ [STOP] Partner notificado via BD', [
                'partner_id' => $partnerUserId,
                'partner_redirect' => $partnerRedirect // ✅ CORREGIR VARIABLE
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
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'error' => 'Error verificando notificaciones'
            ], 500);
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
            
            $session = VideoChatSession::where('user_id', $user->id)
                ->where('room_name', $roomName)
                ->where('status', 'active')
                ->first();
                
            if ($session && $session->is_consuming) {
                // Consumo final antes de cerrar
                $duration = now()->diffInSeconds($session->last_consumption_at ?? $session->started_at);
                
                $this->coinController->processPeriodicConsumption(new Request([
                    'room_name' => $roomName,
                    'session_duration_seconds' => $duration
                ]));
                
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
            
            // Constantes
            $MODEL_EARNINGS_PER_MINUTE = 0.24;
            $COINS_PER_MINUTE = 10;
            
            $modelEarnings = $qualifyingSession ? round($payableMinutes * $MODEL_EARNINGS_PER_MINUTE, 2) : 0;
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
                'platform_time_earnings' => 0,
                'platform_gift_earnings' => 0,
                'platform_total_earnings' => 0,
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
            
            $MODEL_EARNINGS_PER_MINUTE = 0.24;
            $COINS_PER_MINUTE = 10;
            
            $newModelEarnings = $newQualifying ? round($newPayableMinutes * $MODEL_EARNINGS_PER_MINUTE, 2) : 0;
            $newTheoreticalCoins = ceil($newPayableMinutes * $COINS_PER_MINUTE);

            // Mantener gift earnings
            $newTotalEarnings = $newModelEarnings + $existingEarning->model_gift_earnings;

            $existingEarning->update([
                'session_duration_seconds' => $newDurationSeconds,
                'qualifying_session' => $newQualifying,
                'total_time_coins_spent' => $newTheoreticalCoins,
                'total_coins_spent' => $newTheoreticalCoins + $existingEarning->total_gifts_coins_spent,
                'model_time_earnings' => $newModelEarnings,
                'model_total_earnings' => $newTotalEarnings,
                'processed_at' => now(),
                'metadata' => array_merge($existingEarning->metadata ?? [], [
                    'updated_at' => now()->toISOString(),
                    'duration_updated' => true,
                    'new_payable_minutes' => $newPayableMinutes,
                    'updated_ended_by' => $endedBy
                ])
            ]);

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

                if ($session->cliente_id && !$this->verifyUserIsReallyActive($session->cliente_id, $roomName)) {
                    $bothUsersActive = false;
                    $inactiveUsers[] = 'cliente';
                }

                if ($session->modelo_id && !$this->verifyUserIsReallyActive($session->modelo_id, $roomName)) {
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
                'room' => 'required|string',
                'identity' => 'required|string'
            ]);

            $roomName = $request->input('room');
            $participantName = $request->input('identity');
            $user = auth()->user();

            if (!$user) {
                return response()->json(['error' => 'Usuario no autenticado'], 401);
            }

            // 🔥 SOLO VERIFICAR SALDO PARA CLIENTES (NO DESCONTAR)
            if ($user->rol === 'cliente') {
                if (!$this->coinController) {
                    return response()->json(['error' => 'Error interno del sistema'], 500);
                }

                $balanceCheck = $this->coinController->canStartVideoChat($user->id);
                
                if (!$balanceCheck['can_start']) {
                    Log::warning('🚫 Cliente sin saldo suficiente', [
                        'user_id' => $user->id,
                        'balance' => $balanceCheck['total_balance'] ?? 0
                    ]);
                    
                    return response()->json([
                        'error' => 'Saldo insuficiente para iniciar videochat',
                        'balance_info' => $balanceCheck,
                        'action' => 'redirect_to_coins',
                        'required_coins' => 30,
                        'current_coins' => $balanceCheck['total_balance'] ?? 0
                    ], 402);
                }

                Log::info('✅ Cliente con saldo suficiente - NO descontando', [
                    'user_id' => $user->id,
                    'balance' => $balanceCheck['total_balance']
                ]);
            }

            // 🔥 GENERAR TOKEN SIN DESCUENTOS
            return $this->generateToken($request);

        } catch (\Exception $e) {
            Log::error('❌ Error generando token seguro: ' . $e->getMessage());
            
            return response()->json([
                'error' => 'Error generando token seguro: ' . $e->getMessage()
            ], 500);
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

            if (!$user || $user->rol !== 'cliente') {
                return response()->json([
                    'success' => false,
                    'error' => 'Solo clientes pueden usar este endpoint'
                ], 403);
            }

            // 🔥 USAR CANTIDAD MANUAL SI SE PROPORCIONA
            if ($manualCoinsAmount) {
                $coinsToDeduct = $manualCoinsAmount;
                $minutesConsumed = $coinsToDeduct / VideoChatCoinController::COST_PER_MINUTE;
                
                Log::info('💰 Usando cantidad manual de coins', [
                    'user_id' => $user->id,
                    'manual_coins' => $manualCoinsAmount,
                    'calculated_minutes' => $minutesConsumed
                ]);
            } else {
                // Lógica automática original
                $minutesConsumed = $durationSeconds / 60;
                $coinsToDeduct = ceil($minutesConsumed * VideoChatCoinController::COST_PER_MINUTE);
            }

            if (!$this->coinController) {
                return response()->json([
                    'success' => false,
                    'error' => 'Error interno del sistema'
                ], 500);
            }

            // 🔥 PROCESAR DESCUENTO
            $result = $this->coinController->processConsumption(
                $user->id,
                $roomName,
                $minutesConsumed,
                $coinsToDeduct,
                'periodic_' . time()
            );

            if (!$result['success']) {
                Log::warning('⚠️ Saldo insuficiente', [
                    'user_id' => $user->id,
                    'required' => $coinsToDeduct,
                    'remaining_balance' => $result['remaining_balance'] ?? 0
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'insufficient_balance',
                    'action' => 'end_session',
                    'remaining_balance' => $result['remaining_balance'] ?? 0,
                    'required_coins' => $coinsToDeduct
                ], 402);
            }

            Log::info('✅ Descuento exitoso', [
                'user_id' => $user->id,
                'coins_deducted' => $coinsToDeduct,
                'remaining_balance' => $result['remaining_balance']
            ]);

            return response()->json([
                'success' => true,
                'coins_deducted' => $coinsToDeduct,
                'remaining_balance' => $result['remaining_balance'],
                'minutes_remaining' => floor($result['remaining_balance'] / VideoChatCoinController::COST_PER_MINUTE),
                'can_continue' => $result['remaining_balance'] >= VideoChatCoinController::COST_PER_MINUTE
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
                'room' => 'required|string',
                'identity' => 'required|string'
            ]);

            $user = auth()->user();
            
            Log::info('🎥 [ORIGINAL] Generando token para modelo', [
                'user_id' => $user->id,
                'user_role' => $user->rol,
                'room' => $request->room
            ]);

            // Para modelos, usar el método original sin descuentos
            return $this->generateToken($request);
            
        } catch (\Exception $e) {
            Log::error('❌ [ORIGINAL] Error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Error generando token: ' . $e->getMessage()
            ], 500);
        }
    }


    
}
    
  
