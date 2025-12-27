<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Artisan;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileLinkController;

// ✅ Ruta para obtener token CSRF
Route::get('/sanctum/csrf-cookie', function () {
    return response()->json(['csrf' => true]);
});

// 🔗 Ruta pública para redirigir al chat con la modelo
Route::get('/chat/{slug}', [ProfileLinkController::class, 'redirectToChat'])
    ->name('profile.chat');

// ✅ Todas las rutas de autenticación en el grupo web (con CSRF)
Route::middleware(['web'])->group(function () {
    

    // Usuario autenticado
    Route::middleware('auth')->get('/user', function (Request $request) {
        return response()->json($request->user());
    });
    Route::get('/admin/run-clear', function () {
    Artisan::call('config:clear');
    Artisan::call('config:cache');
    Artisan::call('route:clear');
    Artisan::call('view:clear');

    return '✅ Artisan commands ejecutados correctamente.';
    });
});
Route::get('/sse/notifications/{userId}', [NotificationController::class, 'stream'])
    ->where('userId', '[0-9]+')
    ->withoutMiddleware(['web']); // Sin middleware CSRF

// 🔥 CREAR RUTA DE PRUEBA en routes/web.php
Route::get('/test-redis', function () {
    try {
        \Illuminate\Support\Facades\Redis::set('test_key', 'Hello Redis Cloud!');
        $value = \Illuminate\Support\Facades\Redis::get('test_key');
        
        return response()->json([
            'success' => true,
            'message' => 'Redis Cloud conectado!',
            'test_value' => $value,
            'redis_info' => [
                'host' => config('database.redis.default.host'),
                'port' => config('database.redis.default.port'),
                'client' => config('database.redis.client')
            ]
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
});
