<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\VerificacionController;
use App\Http\Controllers\LlamadasController;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use App\Http\Resources\UserResource;
use App\Http\Resources\VerificacionResource;
use App\Http\Controllers\LiveKitController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\UserFavoriteController;
use App\Http\Controllers\UserBlockController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\CallController;
use App\Http\Controllers\UserNicknameController;
use App\Http\Controllers\VideoChatCoinController;
use App\Http\Controllers\SessionEarningsController;
use App\Http\Controllers\ClientBalanceController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProfileLinkController;
use App\Http\Controllers\GiftCoinsController;
use App\Http\Controllers\GiftSystemController;
use App\Http\Controllers\VideoChatGiftController;
use App\Http\Controllers\HeartbeatController;
use App\Http\Controllers\SecurityController;
use App\Http\Controllers\ProfileSettingsController;
use App\Http\Controllers\CoinbaseCommerceController;


Route::get('/stories', [StoryController::class, 'getActiveStories']);
Route::get('/stories/active', [StoryController::class, 'getActiveStories']); // Nueva ruta
Route::post('/request-password-reset', [SecurityController::class, 'requestPasswordReset']);
Route::post('/validate-reset-token', [SecurityController::class, 'validateResetToken']);
Route::post('/reset-password-with-token', [SecurityController::class, 'resetPasswordWithToken']);

Route::get('/verificacion/archivo/{filename}', [VerificacionController::class, 'verArchivo'])
    ->name('verificacion.archivo');

Route::middleware(['auth:sanctum'])->group(function () {
    Route::middleware(['auth:sanctum'])->prefix('admin')->group(function () {
        // Obtener verificaciones pendientes
        Route::get('/verificaciones/pendientes', [VerificacionController::class, 'getPendientes']);
        
        // Aprobar verificación
        Route::post('/verificaciones/{id}/aprobar', [VerificacionController::class, 'aprobar']);
        
        // Rechazar verificación
        Route::delete('/verificaciones/{id}/rechazar', [VerificacionController::class, 'rechazar']);
        
        // Ver documento específico
        Route::get('/verificaciones/{id}/documento/{tipo}', [VerificacionController::class, 'verDocumento']);
        
        // Estadísticas de verificaciones
        Route::get('/verificaciones/stats', [VerificacionController::class, 'getStats']);

        Route::get('/usuarios', [VerificacionController::class, 'getUsuarios']);

        Route::delete('/usuarios/{id}', [VerificacionController::class, 'eliminarUsuario']);

        Route::get('/usuarios/{id}', [VerificacionController::class, 'getUsuario']);
    
        // Actualizar usuario
        Route::put('/usuarios/{id}', [VerificacionController::class, 'actualizarUsuario']);

        Route::post('/verificaciones/{id}/observaciones', [VerificacionController::class, 'guardarObservaciones']);
    });
    
    // 💓 HEARTBEAT - CRÍTICO para mantener sesión (se ejecuta cada 10s)
    Route::post('/heartbeat', [AuthController::class, 'heartbeat']);


    Route::get('/model/{id}', [AuthController::class, 'getModelInfo']);
    
    // 👤 PROFILE - CRÍTICO para cache de usuario y verificaciones
    Route::get('/profile', function (Request $request) {
    $user = $request->user();
    
    // 🔍 DEBUG: Ver si la relación funciona
    \Log::info('Profile DEBUG', [
        'user_id' => $user->id,
        'verificacion_query' => $user->verificacion,
        'verificacion_exists' => $user->verificacion !== null,
        'manual_query' => \DB::table('verificaciones')->where('user_id', $user->id)->first(),
    ]);
    
    $user->load('verificacion');
    
    return response()->json([
        'user' => new UserResource($user),
        'debug' => [
            'verificacion_loaded' => $user->verificacion,
            'manual_verificacion' => \App\Models\Verificacion::where('user_id', $user->id)->first(),
        ],
        'autorizado' => $user->rol === 'modelo'
            ? $user->email_verified_at && $user->name && $user->verificacion_completa
            : true,
    ]);
});
    

Route::post('/blocks/block-user', [App\Http\Controllers\UserBlockController::class, 'blockUser']);
    Route::post('/blocks/unblock-user', [App\Http\Controllers\UserBlockController::class, 'unblockUser']);
    Route::get('/blocks/list', [App\Http\Controllers\UserBlockController::class, 'getBlockedUsers']);
    Route::get('/blocks/block-status', [App\Http\Controllers\UserBlockController::class, 'getBlockStatus']);
    Route::post('check-if-blocked-by', [UserBlockController::class, 'checkIfBlockedBy']);
    Route::get('who-blocked-me', [UserBlockController::class, 'getWhoBlockedMe']);
    Route::get('block-status', [UserBlockController::class, 'getBlockStatus']);
    
    // Favoritos
    Route::post('/favorites/add', [App\Http\Controllers\UserFavoriteController::class, 'addToFavorites']);
    Route::post('/favorites/remove', [App\Http\Controllers\UserFavoriteController::class, 'removeFromFavorites']);
    Route::get('/favorites/list', [App\Http\Controllers\UserFavoriteController::class, 'getFavorites']);
    Route::post('/favorites/start-chat', [App\Http\Controllers\UserFavoriteController::class, 'startChatWithFavorite']);
    
    // 🎰 LIVEKIT TOKENS - CRÍTICO para conexión de videochat
    Route::post('/livekit/token', [LiveKitController::class, 'generateToken']);
    Route::post('/livekit/end-coin-session', [LiveKitController::class, 'endCoinSession']);
    
    // 🔄 NAVEGACIÓN ENTRE SALAS - CRÍTICO para funcionalidad "siguiente"
    Route::post('/livekit/next-room', [LiveKitController::class, 'nextRoom']);
    Route::post('/livekit/next-user', [LiveKitController::class, 'nextUser']);
    Route::post('/livekit/next-user-strict', [LiveKitController::class, 'nextUserStrict']);
    
    // 🔔 NOTIFICACIONES PARTNER - CRÍTICO para coordinar usuarios
    Route::post('/livekit/notify-partner-next', [LiveKitController::class, 'notifyPartnerNext']);
    Route::post('/livekit/notify-partner-stop', [LiveKitController::class, 'notifyPartnerStop']);
    Route::get('/earnings/model', [SessionEarningsController::class, 'getModelEarnings']);
    Route::get('/earnings/detailed-stats', [SessionEarningsController::class, 'getDetailedStats']);
    Route::get('/earnings/weekly', [SessionEarningsController::class, 'getWeeklyEarnings']);
    Route::post('/earnings/process-weekly-payment', [SessionEarningsController::class, 'processWeeklyPayment']);
    Route::get('/balance', [SessionEarningsController::class, 'getUserBalance']);
    Route::get('/earnings/videochat-balance', [SessionEarningsController::class, 'getModelVideoChatBalance']);
    // En routes/api.php
    Route::post('/earnings/process-session', [LiveKitController::class, 'processSessionEarnings']);

    // 🏃‍♀️ UNIRSE A SALA - CRÍTICO para matchmaking
    Route::post('/livekit/join-room', [LiveKitController::class, 'joinRoom']);
    
    // 💬 PARTICIPANTES - CRÍTICO para detectar conexiones
    Route::get('/chat/participants/{roomName}', [LiveKitController::class, 'getParticipants']);
    Route::get('/chat/participants/active-room', [LiveKitController::class, 'getActiveRoomParticipants']);
    
    // 🔄 VERIFICACIÓN DE SESIÓN - CRÍTICO para polling frecuente
    Route::post('/session/check-room', [LiveKitController::class, 'checkRoom']);
    Route::post('/ruleta/verificar-estado', [LiveKitController::class, 'verificarEstadoSesion']);
    
    // 📊 POLLING DE NOTIFICACIONES - CRÍTICO para tiempo real
    Route::get('/status/updates', [LiveKitController::class, 'checkNotifications']);
    Route::get('/livekit/check-redirect', [LiveKitController::class, 'checkRedirect']);
    
    // 🔔 NOTIFICACIONES SSE - CRÍTICO para tiempo real
    Route::get('/notifications/{userId}', [NotificationController::class, 'stream']);
    Route::get('/notifications/status/{userId}', [NotificationController::class, 'checkUserStatus']);
    
    // 🎰 INICIAR RULETA - CRÍTICO para matchmaking
    Route::post('/ruleta/iniciar', [LiveKitController::class, 'iniciarRuleta']);
    Route::post('/ruleta/salir', [LiveKitController::class, 'salirDeRuleta']);
    
    // 🔍 BUSCAR SALAS - CRÍTICO para encontrar matches
    Route::post('/livekit/find-available-rooms', [LiveKitController::class, 'findAvailableRooms']);
    Route::post('/livekit/extended-search-room', [LiveKitController::class, 'extendedSearchRoom']);
    
    // 💬 SISTEMA DE CHAT - CRÍTICO para mensajería en tiempo real
    Route::get('/chat/messages/{roomName}', [LiveKitController::class, 'getChatMessages']);
    Route::post('/chat/send', [LiveKitController::class, 'sendChatMessage']);
    
    // 🔧 GESTIÓN DE SALAS - CRÍTICO para operaciones de sala
    Route::post('/livekit/end-room', [LiveKitController::class, 'endRoom']);
    Route::post('/livekit/cleanup-room', [LiveKitController::class, 'cleanupRoom']);
    Route::post('/livekit/mark-room-active', [LiveKitController::class, 'markRoomActive']);
    Route::post('/sesion/finalizar', [LiveKitController::class, 'finalizarSesion']);
    
    // 🔥 NUEVA RUTA: Finalizar sesión con consumo de monedas
    Route::post('/livekit/end-with-consumption', [LiveKitController::class, 'endVideoSession']);
    
    // 📊 SALAS DISPONIBLES - CRÍTICO para modelos
    Route::get('/modelo/salas-disponibles', [LiveKitController::class, 'salasDisponibles']);
    Route::post('/modelo/unirse-sala', [LiveKitController::class, 'unirseASala']);
    
    // 🔐 GESTIÓN DE ESTADO ONLINE/OFFLINE - CRÍTICO para presencia
    Route::post('/user/mark-online', [AuthController::class, 'markOnline']);
    Route::post('/user/mark-offline', [AuthController::class, 'markOffline']);
    
    // 🚪 NOTIFICACIONES DE ABANDONO - CRÍTICO para cleanup
    Route::post('/livekit/client-leaving', [LiveKitController::class, 'clientLeaving']);
    Route::post('/livekit/model-leaving', [LiveKitController::class, 'modelLeaving']);
    
    // 🔔 TESTING NOTIFICATIONS - CRÍTICO para debugging
    Route::post('/test-notification', [NotificationController::class, 'testNotification']);
    
    // 📊 ESTADÍSTICAS EN TIEMPO REAL - Para monitoreo de videochat
    Route::get('/stats/users-online', function () {
        $onlineUsers = \App\Models\User::where('last_seen', '>=', now()->subMinutes(5))->count();
        return response()->json(['users_online' => $onlineUsers]);
    });
    Route::middleware('auth')->group(function () {
        // Rutas para modelos (las que ya tienes)
        Route::get('/earnings/pending-payments', [SessionEarningsController::class, 'getPendingPayments']);
        Route::get('/earnings/payment-history', [SessionEarningsController::class, 'getPaymentHistory']);
        Route::post('/earnings/update-duration', [SessionEarningsController::class, 'updateSessionDuration']);
        
        // 🔥 NUEVAS rutas para modelos
        Route::get('/earnings/weekly', [SessionEarningsController::class, 'getWeeklyEarnings']);
        Route::get('/earnings/stats', [SessionEarningsController::class, 'getDetailedStats']);
        
        // Rutas para admin (las que ya tienes)
        Route::get('/admin/pending-payments', [SessionEarningsController::class, 'getAllPendingPayments']);
        Route::post('/admin/payments/{id}/mark-paid', [SessionEarningsController::class, 'markPaymentAsPaid']);
        
        // 🔥 NUEVAS rutas para admin
        Route::get('/admin/earnings/stats', [SessionEarningsController::class, 'getAdminStats']);
        Route::post('/admin/earnings/fix', [SessionEarningsController::class, 'fixExistingEarnings']);
        Route::post('/admin/earnings/recalculate', [SessionEarningsController::class, 'recalculateAllEarnings']);
        Route::post('/admin/weekly-payment', [SessionEarningsController::class, 'processWeeklyPayment']);
    });
    Route::prefix('client-balance')->name('client-balance.')->group(function () {
        Route::get('/my-balance', [ClientBalanceController::class, 'getMyBalance']);
        Route::get('/my-balance/quick', [ClientBalanceController::class, 'getMyBalanceQuick']);
        
        // Obtener saldo del cliente
        Route::post('/get', [ClientBalanceController::class, 'getClientBalance'])
            ->name('get');
    });

    // Historial de transacciones del cliente
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/transactions/history', [ClientBalanceController::class, 'getTransactionHistory']);
    });
        Route::middleware('auth:sanctum')->group(function () {
        Route::post('/payment-method', [PaymentController::class, 'updatePaymentMethod']);
        Route::post('/send-verification', [PaymentController::class, 'sendVerificationCode']);
        Route::post('/verify-code', [PaymentController::class, 'verifyCode']);
        Route::get('/payment-methods', [PaymentController::class, 'getPaymentMethods']);
        
        // Rutas para gestión de métodos de pago guardados
        Route::get('/payment-methods/saved', [PaymentController::class, 'getSavedPaymentMethods']);
        Route::post('/payment-methods', [PaymentController::class, 'addPaymentMethod']);
        Route::put('/payment-methods/{id}', [PaymentController::class, 'updateSavedPaymentMethod']);
        Route::delete('/payment-methods/{id}', [PaymentController::class, 'deletePaymentMethod']);
        Route::get('/payment-methods/from-history', [PaymentController::class, 'getPaymentMethodsFromHistory']);
        
        Route::post('/minimum-payout', [PaymentController::class, 'updateMinimumPayout']);
        Route::get('/minimum-payout', [PaymentController::class, 'getMinimumPayout']);
    });
    
    Route::get('/stats/active-rooms', function () {
        // Aquí podrías contar salas activas desde tu base de datos
        return response()->json(['active_rooms' => 0]);
    });
    Route::prefix('nicknames')->group(function () {
        Route::post('set', [UserNicknameController::class, 'setNickname']);
        Route::post('get', [UserNicknameController::class, 'getNickname']);
        Route::post('remove', [UserNicknameController::class, 'removeNickname']);
        Route::get('my-nicknames', [UserNicknameController::class, 'getMyNicknames']);
    });

    Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/profile/photo/upload', [ProfileSettingsController::class, 'uploadPhoto']);
    Route::post('/profile/photo/take', [ProfileSettingsController::class, 'takePhoto']);
    Route::delete('/profile/photo/delete', [ProfileSettingsController::class, 'deletePhoto']);
    
    // Apodos/Alias
    Route::get('/profile/nickname', [ProfileSettingsController::class, 'getMyNickname']);
    Route::post('/profile/nickname/update', [ProfileSettingsController::class, 'updateMyNickname']);
    Route::delete('/profile/nickname/delete', [ProfileSettingsController::class, 'deleteMyNickname']);
    
    // Idioma preferido
    Route::get('/profile/language', [ProfileSettingsController::class, 'getPreferredLanguage']);
    Route::post('/profile/language/update', [ProfileSettingsController::class, 'updatePreferredLanguage']);
    
    // Información completa del perfil
    Route::get('/profile/info', [ProfileSettingsController::class, 'getProfileInfo']);
    
    // 🔗 Link de perfil para modelos verificadas
    Route::get('/profile/link', [ProfileLinkController::class, 'getProfileLink']);
    
    // Obtener modelo por slug (para clientes)
    Route::get('/model/by-slug/{slug}', [ProfileLinkController::class, 'getModelBySlug']);
    });
    Route::middleware('auth:sanctum')->group(function () {
    
        // 🔐 CAMBIO DE CONTRASEÑA
        Route::post('/security/request-password-setup-token', [SecurityController::class, 'requestPasswordSetupToken']);
        Route::post('/security/request-password-change-code', [SecurityController::class, 'requestPasswordChangeCode']);
        Route::post('/security/change-password-with-code', [SecurityController::class, 'changePasswordWithCode']);
        
        // 🚪 CERRAR TODAS LAS SESIONES
        Route::post('/security/request-logout-all-code', [SecurityController::class, 'requestLogoutAllCode']);
        Route::post('/security/logout-all-with-code', [SecurityController::class, 'logoutAllWithCode']);
        
        // 🗑️ ELIMINAR CUENTA
        Route::post('/security/request-delete-account-code', [SecurityController::class, 'requestDeleteAccountCode']);
        Route::post('/security/delete-account-with-code', [SecurityController::class, 'deleteAccountWithCode']);
        
        // 🔄 REENVIAR CÓDIGO
        Route::post('/security/resend-code', [SecurityController::class, 'resendSecurityCode']);
    });

    // 🏓 PING para verificar conectividad
    Route::get('/ping', function () {
        return response()->json([
            'status' => 'ok',
            'timestamp' => now()->toISOString(),
            'server' => 'Laravel'
        ]);
    });
    Route::middleware('auth:sanctum')->prefix('gifts')->group(function () {
        Route::get('/balance', [GiftCoinsController::class, 'getGiftBalance']);
        Route::post('/send', [GiftCoinsController::class, 'sendGift']);
        Route::get('/history', [GiftCoinsController::class, 'getGiftHistory']);
        
    });
    Route::middleware(['auth:sanctum', 'gift.security'] )->group(function () {
    
        // 🎁 REGALOS DISPONIBLES
        Route::get('/gifts/available', [GiftSystemController::class, 'getAvailableGifts']);

        Route::post('/gifts/send-direct', [GiftSystemController::class, 'sendDirectGift']);
        
        // 🙏 MODELO PIDE REGALO (Step 1)
        Route::post('/gifts/request', [GiftSystemController::class, 'requestGift']);
        
        // 📋 CLIENTE VE SUS SOLICITUDES PENDIENTES
        Route::get('/gifts/requests/pending', [GiftSystemController::class, 'getPendingRequests']);
        
        // ✅ CLIENTE ACEPTA REGALO (Step 2)
        Route::post('/gifts/requests/{request}/accept', [GiftSystemController::class, 'acceptGiftRequest']);
        
        // ❌ CLIENTE RECHAZA REGALO
        Route::post('/gifts/requests/{request}/reject', [GiftSystemController::class, 'rejectGiftRequest']);
        Route::post('/send-direct', [GiftSystemController::class, 'sendDirectGift']); // Nueva ruta

        
        // 📊 HISTORIAL DE REGALOS
        Route::get('/gifts/history', [GiftSystemController::class, 'getGiftHistory']);
        
        // 🧹 LIMPIAR SOLICITUDES EXPIRADAS (CRON)
        Route::post('/gifts/clean-expired', [GiftSystemController::class, 'cleanExpiredRequests']);
    });
    // 🎁 =================== RUTAS PARA REGALOS EN VIDEOCHAT ===================
    Route::middleware(['auth:sanctum', 'gift.security'])->prefix('videochat/gifts')->group(function () {
        // Obtener regalos disponibles
        Route::get('/available', [App\Http\Controllers\VideoChatGiftController::class, 'getAvailableGifts']);
        
        // Solicitar regalo (solo modelos)
        Route::post('/request', [App\Http\Controllers\VideoChatGiftController::class, 'requestGift']);
        
        // Ver solicitudes pendientes (solo clientes)
        Route::get('/pending', [App\Http\Controllers\VideoChatGiftController::class, 'getPendingRequests']);
        
        // Aceptar regalo (solo clientes)
        Route::post('/accept/{requestId}', [App\Http\Controllers\VideoChatGiftController::class, 'acceptGiftRequest']);
        
        // Rechazar regalo (solo clientes)
        Route::post('/reject/{requestId}', [App\Http\Controllers\VideoChatGiftController::class, 'rejectGiftRequest']);
        
        // Obtener balance del usuario
        Route::get('/balance', [App\Http\Controllers\VideoChatGiftController::class, 'getUserBalance']);
        
        // Historial de regalos
        Route::get('/history', [App\Http\Controllers\VideoChatGiftController::class, 'getGiftHistory']);
        
        // Limpiar solicitudes expiradas (para cron)
        Route::post('/clean-expired', [App\Http\Controllers\VideoChatGiftController::class, 'cleanExpiredRequests']);
    });

    
    // 📊 ROOM STATUS para verificar estado de sala
    Route::get('/chat/room-status/{roomName}', function ($roomName) {
        // Aquí implementarías la lógica para verificar el estado de la sala
        return response()->json([
            'room_name' => $roomName,
            'status' => 'active', // o 'inactive'
            'participants' => 0,
            'timestamp' => now()->toISOString()
        ]);
    });
    // 🆕 RUTA PARA OBTENER TOKEN DE SESIÓN
    Route::middleware(['auth:sanctum'])->group(function() {
        Route::get('/auth/session-token', function() {
            $user = Auth::user();
            return response()->json([
                'success' => true,
                'session_token' => \App\Helpers\SecurityHelper::generateSessionToken($user->id),
                'expires_in' => 3600, // 1 hora
                'generated_at' => now()->toISOString()
            ]);
        });
    });

    /*
    |--------------------------------------------------------------------------
    | 💰 SISTEMA DE MONEDAS - SIN RATE LIMITING
    |--------------------------------------------------------------------------
    | Sistema completo de compra y gestión de monedas para videochat
    | Sin throttling para operaciones críticas de videochat
    |--------------------------------------------------------------------------
    */
    
    // 🔥 SISTEMA DE MONEDAS - BALANCE Y VERIFICACIONES
    Route::prefix('coins')->group(function () {
        // 💰 Balance y verificaciones - CRÍTICO para validación antes de llamadas
        Route::get('/balance', [VideoChatCoinController::class, 'getBalance']);
        Route::get('/can-start', [VideoChatCoinController::class, 'canStartVideoChat']);
        
        // ⏱️ CONSUMO DE MONEDAS - CRÍTICO durante llamadas
        Route::post('/consume', [VideoChatCoinController::class, 'consumeCoins']);
        Route::post('/process-periodic', [VideoChatCoinController::class, 'processPeriodicConsumption']);
        
        // 📊 HISTORIAL DE CONSUMO
        Route::get('/history', [VideoChatCoinController::class, 'getConsumptionHistory']);
    });

    Route::middleware(['auth:sanctum'])->prefix('coinbase-commerce')->group(function () {
        
        // Rutas principales
        Route::get('/config', [CoinbaseCommerceController::class, 'getCoinbaseConfig']);
        Route::get('/packages', [CoinbaseCommerceController::class, 'getPackages']);
        Route::get('/balance', [CoinbaseCommerceController::class, 'getBalance']);
        
        // Crear pago
        Route::post('/create-payment', [CoinbaseCommerceController::class, 'createPayment']);
        
        // Verificar estado
        Route::get('/status/{purchaseId}', [CoinbaseCommerceController::class, 'checkPurchaseStatus']);
        
        // Historial
        Route::get('/history', [CoinbaseCommerceController::class, 'getPurchaseHistory']);
        
        // Utilidades para testing
        Route::post('/sandbox-purchase', [CoinbaseCommerceController::class, 'createSandboxPurchase']);
        
        // Admin routes (solo para administradores)
        Route::middleware(['admin'])->group(function () {
            Route::get('/stats', [CoinbaseCommerceController::class, 'getPaymentStats']);
            Route::get('/diagnostic', [CoinbaseCommerceController::class, 'systemDiagnostic']);
            Route::post('/cleanup', [CoinbaseCommerceController::class, 'cleanupExpiredPurchases']);
            Route::post('/sync', [CoinbaseCommerceController::class, 'syncPendingPurchases']);
        });
    });

    Route::middleware('auth:sanctum')->group(function () {
        // Wompi routes
        Route::get('/wompi/config', [App\Http\Controllers\WompiController::class, 'getWompiConfig']);
        Route::get('/wompi/packages', [App\Http\Controllers\WompiController::class, 'getPackages']);
        Route::post('/wompi/create-payment', [App\Http\Controllers\WompiController::class, 'createPayment']);
        Route::post('/wompi/sandbox-purchase', [App\Http\Controllers\WompiController::class, 'createSandboxPurchase']);
        Route::get('/wompi/status/{purchaseId}', [App\Http\Controllers\WompiController::class, 'checkPurchaseStatus']);
        Route::get('/wompi/history', [App\Http\Controllers\WompiController::class, 'getPurchaseHistory']);
    });

    

    });
Route::middleware('auth:sanctum')->group(function () {
    
    // ❌ RUTA DUPLICADA ELIMINADA - Ya existe en línea 70 (AuthController::heartbeat)
    // Route::post('/heartbeat', [HeartbeatController::class, 'updateHeartbeat']);
    
    // 🔥 NUEVAS RUTAS PARA CONSISTENCIA
    Route::get('/heartbeat/check-user-status', [HeartbeatController::class, 'checkUserGlobalStatus']);
    Route::post('/heartbeat/force-cleanup', [HeartbeatController::class, 'forceUserCleanup']);
    
    // Rutas LiveKit mejoradas
    Route::get('/livekit/participants/{roomName}', [LiveKitController::class, 'getParticipants']);
    Route::post('/livekit/cleanup-room', [LiveKitController::class, 'cleanupRoom']);
    Route::post('/livekit/validate-session', [LiveKitController::class, 'validateUserSession']);
    
    // Rutas de diagnóstico y debug
    Route::get('/system/user-sessions-debug', [LiveKitController::class, 'debugUserSessions']);
    // ✅ SOLUCIÓN: sin 'verified'
Route::post('/livekit/token-secure', [LiveKitController::class, 'generateTokenWithImmediateDeduction'])
    ->middleware(['auth:sanctum']);

Route::post('/livekit/periodic-deduction', [LiveKitController::class, 'processPeriodicDeduction'])
    ->middleware(['auth:sanctum']);

Route::get('/livekit/balance-check', [LiveKitController::class, 'checkBalanceRealTime'])
    ->middleware(['auth:sanctum']);

Route::post('/livekit/token', [LiveKitController::class, 'generateTokenOriginal'])
    ->middleware(['auth:sanctum']);
    
    Route::post('/system/emergency-cleanup', [LiveKitController::class, 'emergencyCleanup']);
});


/*
|--------------------------------------------------------------------------
| 🕷️ WEBHOOK DE STRIPE - SIN AUTENTICACIÓN
|--------------------------------------------------------------------------
| Webhook para procesar eventos de Stripe automáticamente
| Sin auth:sanctum porque Stripe lo llama directamente
|--------------------------------------------------------------------------
*/

// 🔥 NUEVO WEBHOOK PARA MONEDAS

/*
||--------------------------------------------------------------------------
|| 🔔 WEBHOOK DE LIVEKIT - SIN AUTENTICACIÓN
||--------------------------------------------------------------------------
|| Webhook para procesar eventos de LiveKit (desconexiones, fin de sala, etc.)
|| Sin auth:sanctum porque LiveKit lo llama directamente
||--------------------------------------------------------------------------
*/
Route::post('/livekit/webhook', [LiveKitController::class, 'handleWebhook']);

Route::get('/stories/public', [StoryController::class, 'indexPublicas']);
Route::get('/stories/my-story', [StoryController::class, 'myStory']); // ✅ ESPECÍFICA PRIMERO

// Rutas autenticadas - ajusta el middleware según tu configuración
Route::middleware('auth:sanctum')->group(function () {
    // Historias del usuario
    Route::post('/stories', [StoryController::class, 'store']); // Subir historia
    Route::get('/stories/{id}', [StoryController::class, 'show'])->where('id', '[0-9]+'); // ✅ GENÉRICA DESPUÉS + RESTRICCIÓN
    Route::delete('/stories/{id}', [StoryController::class, 'destroy']);
    Route::get('/stories/can-upload', [StoryController::class, 'canUploadNewStory']);


    Route::get('/stories/{id}/views', [StoryController::class, 'getViews']); // Ver estadísticas
});

// Rutas de administrador
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/admin/stories/pending', [StoryController::class, 'indexPending']); // Historias pendientes
    Route::post('/admin/stories/{id}/approve', [StoryController::class, 'approve']); // Aprobar
    Route::post('/admin/stories/{id}/reject', [StoryController::class, 'reject']); // Rechazar
});

Route::middleware(['auth:sanctum'])->prefix('chat')->group(function () {
    Route::get('/conversations', [ChatController::class, 'getConversations']);
    Route::get('/messages/{roomName}', [ChatController::class, 'getMessages']);
    Route::post('/send-message', [ChatController::class, 'sendMessage']);
    Route::post('/mark-read', [ChatController::class, 'markAsRead']);
    Route::delete('/delete-message/{id}', [ChatController::class, 'deleteMessage']);
    Route::get('/messages/user/{otherUserId}', [ChatController::class, 'getMessagesByUser']);

    Route::post('/start-conversation', [ChatController::class, 'startConversation']);
    Route::get('/users/my-contacts', [UserController::class, 'getMyContacts']);
});

Route::middleware('auth:sanctum')->group(function () {
    // 📞 RUTAS DE LLAMADAS
    Route::post('/calls/start', [CallController::class, 'startCall']);
    Route::post('/calls/answer', [CallController::class, 'answerCall']);
    Route::post('/calls/cancel', [CallController::class, 'cancelCall']);
    Route::post('/calls/status', [CallController::class, 'getCallStatus']);
    Route::get('/calls/check-incoming', [CallController::class, 'checkIncomingCalls']);
    Route::post('/calls/cleanup', [CallController::class, 'cleanupExpiredCalls']);
    Route::get('/calls/history', [CallController::class, 'getCallHistory']);
    Route::prefix('videochat/coins')->group(function () {
        Route::get('/balance', [App\Http\Controllers\VideoChatCoinController::class, 'getBalance']);
        Route::get('/detailed-balance', [App\Http\Controllers\VideoChatCoinController::class, 'getDetailedBalance']);
        Route::get('/validate-call', [App\Http\Controllers\VideoChatCoinController::class, 'validateForVideoCall']);
        Route::post('/consume', [App\Http\Controllers\VideoChatCoinController::class, 'consumeCoins']);
        Route::post('/add', [App\Http\Controllers\VideoChatCoinController::class, 'addCoins']);
        Route::get('/history', [App\Http\Controllers\VideoChatCoinController::class, 'getConsumptionHistory']);
        Route::post('/process-consumption', [App\Http\Controllers\VideoChatCoinController::class, 'processPeriodicConsumption']);
    });
});

// RUTA ADICIONAL PARA PERFIL DE USUARIO
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user/profile', [ChatController::class, 'getUserProfile']);
});

/*
|--------------------------------------------------------------------------
| 📌 RUTAS PÚBLICAS (sin autenticación) - CON RATE LIMITING
|--------------------------------------------------------------------------
| Rutas accesibles sin token de autenticación
| Límites bajos para prevenir spam y ataques
|--------------------------------------------------------------------------
*/

Route::middleware(['throttle:30,1'])->post('/login', [AuthController::class, 'loginModel']);
Route::middleware(['throttle:10,1'])->post('/register', [AuthController::class, 'registerModel']);
Route::middleware(['throttle:20,1'])->post('/verify-email-code', [AuthController::class, 'verifyCode']);
Route::middleware(['throttle:20,1'])->get('/public-info', fn () => response()->json(['info' => 'Esto es público']));
Route::middleware(['throttle:60,1'])->get('/admin/verificaciones', [VerificacionController::class, 'indexSinAuth']);
Route::get('/auth/google/redirect', [AuthController::class, 'redirectToGoogle']);
Route::get('/auth/google/callback', [AuthController::class, 'handleGoogleCallback']);
Route::post('/auth/google/unlink', [AuthController::class, 'unlinkGoogle'])->middleware('auth:sanctum');


/*
|--------------------------------------------------------------------------
| 🔄 RUTAS DE GESTIÓN DE SESIÓN - RATE LIMITING MODERADO
|--------------------------------------------------------------------------
| Rutas especiales para manejo de tokens y sesiones
| Límites moderados por ser operaciones críticas pero no de videochat
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'throttle:20,1'])->post('/resend-code', [AuthController::class, 'resendCode']);

// 🔥 RECLAMAR SESIÓN - MEJORADA CON INVALIDACIÓN COMPLETA
Route::middleware(['throttle:30,1'])->post('/reclamar-sesion', function (Request $request) {
    $token = $request->bearerToken();

    if (!$token || !str_contains($token, '|')) {
        return response()->json(['message' => 'Token inválido o malformado'], 401);
    }

    $tokenId = explode('|', $token)[0];
    $tokenModel = PersonalAccessToken::find($tokenId);

    if (!$tokenModel) {
        return response()->json(['message' => 'Token no encontrado'], 401);
    }

    $user = $tokenModel->tokenable;

    if (!$user) {
        return response()->json(['message' => 'Usuario no encontrado'], 404);
    }

    // 🔥 NUEVO: Eliminar TODOS los tokens existentes del usuario
    Log::info("🔄 Reclamando sesión para {$user->email}. Eliminando todos los tokens.");
    $user->tokens()->delete();

    // Crear nuevo token
    $nuevoToken = $user->createToken('ligand-token')->plainTextToken;
    $nuevoId = explode('|', $nuevoToken)[0];

    $user->current_access_token_id = $nuevoId;
    $user->save();

    Log::info("✅ Sesión reclamada exitosamente para {$user->email} con nuevo token ID: {$nuevoId}");

    return response()->json([
        'message' => 'Sesión reclamada correctamente.',
        'nuevo_token' => $nuevoToken,
    ]);
});

/*
|--------------------------------------------------------------------------
| 📊 RUTAS DE FRECUENCIA MEDIA - OPERACIONES NORMALES
|--------------------------------------------------------------------------
| Operaciones regulares de la aplicación
| Límites MEDIOS (100 req/min) para uso normal
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'throttle:100,1'])->group(function () {
    
    // 🔄 GESTIÓN DE ROLES Y PASOS DE REGISTRO
    Route::post('/asignar-rol', [AuthController::class, 'asignarRol']);
    
    Route::post('/update-signup-step', function (Request $request) {
        $request->validate([
            'step' => 'required|string',
        ]);

        $user = $request->user();
        $user->signup_step = $request->step;
        $user->save();

        return response()->json(['message' => 'Paso actualizado']);
    });
});

/*
|--------------------------------------------------------------------------
| 👥 RUTAS ESPECÍFICAS POR ROL - RATE LIMITING MODERADO
|--------------------------------------------------------------------------
| Rutas que requieren roles específicos de usuario
| Límites MODERADOS (60 req/min) por ser menos frecuentes
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| 🔒 RUTAS ULTRA RESTRICTIVAS - OPERACIONES CRÍTICAS
|--------------------------------------------------------------------------
| Operaciones de máxima seguridad que requieren token actual
| Límites BAJOS (30 req/min) para máxima protección
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'only.current.token', 'throttle:30,1'])->group(function () {
    
    // 🚪 OPERACIONES DE AUTENTICACIÓN CRÍTICAS
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::delete('/eliminar-no-verificado', [AuthController::class, 'eliminarNoVerificado']);

    // 📋 SISTEMA DE VERIFICACIÓN DE IDENTIDAD
    Route::get('/verificacion/estado', [VerificacionController::class, 'estado']);
    Route::post('/verificacion', [VerificacionController::class, 'store'])
        ->middleware('verificacion.estado:sin_verificar');

    // 📞 HISTORIAL DE LLAMADAS (requiere verificación completa)
    Route::get('/llamadas', [LlamadasController::class, 'index'])
        ->middleware('verificacion.estado:aprobado');

    // 🗂️ GESTIÓN DE ARCHIVOS DE VERIFICACIÓN
    Route::get('/archivo-verificacion/{filename}', [VerificacionController::class, 'verArchivo'])
        ->middleware('admin');
});

/*
|--------------------------------------------------------------------------
| 🔧 RUTAS DE ADMINISTRACIÓN - RESTRICTIVAS
|--------------------------------------------------------------------------
| Rutas administrativas para gestión de pagos y monedas
| Solo para administradores con rate limiting
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'admin', 'throttle:30,1'])->prefix('admin')->group(function () {
    
    // 📊 Estadísticas de monedas y pagos
    
    // 💰 Agregar monedas manualmente
    Route::post('/coins/add-manual', [VideoChatCoinController::class, 'addCoins']);
    
    // 🔄 Gestión de paquetes (si implementas)
    // Route::post('/coins/packages/create', [CoinPackageController::class, 'store']);
    // Route::put('/coins/packages/{id}', [CoinPackageController::class, 'update']);
});

Route::get('/avatars/{filename}', function (Request $request, $filename) {
    // Verificar token en query parameter
    $token = $request->query('token');
    if (!$token) {
        abort(401, 'Token required');
    }
    
    // Verificar token manualmente
    $personalAccessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($token);
    if (!$personalAccessToken || !$personalAccessToken->tokenable) {
        abort(401, 'Invalid token');
    }
    
    $path = storage_path('app/public/avatars/' . $filename);
    
    if (!file_exists($path)) {
        abort(404);
    }
    
    $mimeType = mime_content_type($path);
    
    return response()->file($path, [
        'Content-Type' => $mimeType,
        'Cache-Control' => 'public, max-age=3600'
    ]);
})->where('filename', '.*');

/*
|--------------------------------------------------------------------------
| 🚨 RUTAS DE EMERGENCIA - RATE LIMITING BAJO
|--------------------------------------------------------------------------
| Endpoints de emergencia para casos críticos
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'single.session', 'throttle:10,1'])->group(function () {
    
    // 🆘 REPORTE DE EMERGENCIA
    Route::post('/emergency/report', function (Request $request) {
        $request->validate([
            'type' => 'required|string',
            'description' => 'required|string|max:1000',
            'room_name' => 'nullable|string'
        ]);
        
        Log::emergency('Emergency report', [
            'user_id' => $request->user()->id,
            'type' => $request->type,
            'description' => $request->description,
            'room_name' => $request->room_name,
            'timestamp' => now()
        ]);
        
        return response()->json(['message' => 'Reporte enviado correctamente']);
    });
    
    // 🔧 RESET DE SESIÓN DE EMERGENCIA
    Route::post('/emergency/reset-session', function (Request $request) {
        $user = $request->user();
        
        // Limpiar todas las sesiones activas del usuario
        $user->tokens()->delete();
        
        // Crear nuevo token
        $newToken = $user->createToken('emergency-token')->plainTextToken;
        $tokenId = explode('|', $newToken)[0];
        
        $user->current_access_token_id = $tokenId;
        $user->save();
        
        return response()->json([
            'message' => 'Sesión reiniciada por emergencia',
            'new_token' => $newToken
        ]);
    });
});

/*
|--------------------------------------------------------------------------
| 🛠️ RUTAS DE ADMINISTRACIÓN (TEMPORAL) - RATE LIMITING BAJO
|--------------------------------------------------------------------------
| Rutas para testing y administración
| ⚠️ REMOVER EN PRODUCCIÓN
|--------------------------------------------------------------------------
*/

Route::prefix('admin-test')->middleware(['throttle:30,1'])->group(function () {
    Route::get('/verificaciones', [VerificacionController::class, 'listar']);
    Route::post('/verificaciones/{id}/{accion}', [VerificacionController::class, 'accion']);
});

/*
|--------------------------------------------------------------------------
| 🧹 RUTA DE LIMPIEZA AUTOMÁTICA - SIN RATE LIMITING
|--------------------------------------------------------------------------
| Endpoint para cron job de limpieza
|--------------------------------------------------------------------------
*/

Route::get('/cleanup-notifications/{secret}', function($secret) {
    if ($secret !== env('CLEANUP_SECRET')) {
        abort(404, 'Not found');
    }
    
    try {
        \Illuminate\Support\Facades\Artisan::call('notifications:cleanup');
        
        return response()->json([
            'success' => true,
            'message' => 'Cleanup ejecutado correctamente',
            'timestamp' => now()->toISOString()
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
            'timestamp' => now()->toISOString()
        ], 500);
    }
});

/*
|--------------------------------------------------------------------------
| 📚 DOCUMENTACIÓN DE RUTAS DE MONEDAS ACTUALIZADAS
|--------------------------------------------------------------------------

🔥 RUTAS DEL SISTEMA DE MONEDAS:

✅ CRÍTICAS (Sin rate limiting):
   
   📊 GESTIÓN DE MONEDAS:
   - GET  /api/coins/balance                - Balance actual de monedas
   - GET  /api/coins/can-start             - Verificar si puede iniciar videochat
   - POST /api/coins/consume               - Consumir monedas en llamadas
   - POST /api/coins/process-periodic      - Consumo periódico automático
   - GET  /api/coins/history               - Historial de consumo

   💳 COMPRAS CON STRIPE:
   - GET  /api/stripe-coins/config         - Configuración Stripe frontend
   - GET  /api/stripe-coins/packages       - Paquetes de monedas disponibles
   - GET  /api/stripe-coins/balance        - Balance (alias)
   - POST /api/stripe-coins/create-payment-intent - Crear pago Stripe
   - POST /api/stripe-coins/confirm-payment        - Confirmar pago exitoso
   - POST /api/stripe-coins/cancel-payment         - Cancelar pago
   - GET  /api/stripe-coins/history                - Historial de compras
   - GET  /api/stripe-coins/purchase-status/{id}   - Estado de compra
   - POST /api/stripe-coins/sandbox-purchase       - Compra de prueba

   🎬 VIDEOCHAT INTEGRADO:
   - POST /api/livekit/end-with-consumption - Finalizar con consumo de monedas

✅ WEBHOOK (Sin autenticación):
   - POST /api/stripe-coins/webhook        - Webhook de Stripe para monedas

✅ ADMIN (Con rate limiting):
   - GET  /api/admin/coins/stats           - Estadísticas del sistema
   - POST /api/admin/coins/add-manual      - Agregar monedas manualmente

🎯 CAMBIOS PRINCIPALES:
   ❌ ELIMINADO: Todas las rutas de /api/minutes/* y /api/stripe/*
   ✅ AGREGADO: Rutas de /api/coins/* y /api/stripe-coins/*
   ✅ MEJORADO: Integración con LiveKitController para consumo automático
   ✅ MANTENIDO: Toda tu estructura existente de videochat

🔄 MIGRACIÓN FRONTEND:
   - Cambiar todas las llamadas de "/api/minutes/" a "/api/coins/"
   - Cambiar "/api/stripe/" a "/api/stripe-coins/"
   - Actualizar manejo de "minutes" a "coins" en respuestas

|--------------------------------------------------------------------------
*/