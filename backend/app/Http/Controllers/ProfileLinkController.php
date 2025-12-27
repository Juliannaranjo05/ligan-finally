<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProfileLinkController extends Controller
{
    /**
     * Obtener o generar el link del perfil del usuario autenticado
     */
    public function getProfileLink(Request $request)
    {
        try {
            $user = Auth::user();

            Log::info('🔍 [ProfileLink] Iniciando getProfileLink', [
                'user_id' => $user ? $user->id : null,
                'authenticated' => Auth::check()
            ]);

            if (!$user) {
                Log::warning('❌ [ProfileLink] Usuario no autenticado');
                return response()->json([
                    'success' => false,
                    'error' => 'No autenticado',
                    'debug' => 'Usuario no encontrado en la sesión'
                ], 401);
            }

            Log::info('✅ [ProfileLink] Usuario autenticado', [
                'user_id' => $user->id,
                'rol' => $user->rol,
                'email' => $user->email
            ]);

            // Solo modelos verificadas pueden tener link de perfil
            if ($user->rol !== 'modelo') {
                Log::warning('❌ [ProfileLink] Usuario no es modelo', [
                    'user_id' => $user->id,
                    'rol_actual' => $user->rol
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Solo los modelos pueden tener link de perfil',
                    'debug' => "Rol actual: {$user->rol}"
                ], 403);
            }

            // Verificar que esté verificada
            $verificacion = $user->verificacion;
            Log::info('🔍 [ProfileLink] Verificando estado de verificación', [
                'user_id' => $user->id,
                'verificacion_exists' => $verificacion !== null,
                'verificacion_estado' => $verificacion ? $verificacion->estado : 'no existe'
            ]);

            if (!$verificacion) {
                Log::warning('❌ [ProfileLink] No existe registro de verificación', [
                    'user_id' => $user->id
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Debes estar verificada para tener un link de perfil',
                    'debug' => 'No existe registro de verificación'
                ], 403);
            }

            if ($verificacion->estado !== 'aprobada') {
                Log::warning('❌ [ProfileLink] Verificación no aprobada', [
                    'user_id' => $user->id,
                    'estado_actual' => $verificacion->estado
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Debes estar verificada para tener un link de perfil',
                    'debug' => "Estado de verificación: {$verificacion->estado}"
                ], 403);
            }

            // Verificar si la columna profile_slug existe
            try {
                $hasColumn = \Schema::hasColumn('users', 'profile_slug');
                Log::info('🔍 [ProfileLink] Verificando columna profile_slug', [
                    'column_exists' => $hasColumn,
                    'current_slug' => $user->profile_slug
                ]);

                if (!$hasColumn) {
                    Log::error('❌ [ProfileLink] Columna profile_slug no existe en la tabla users');
                    return response()->json([
                        'success' => false,
                        'error' => 'Error de configuración: columna profile_slug no existe',
                        'debug' => 'Ejecuta la migración: php artisan migrate'
                    ], 500);
                }
            } catch (\Exception $e) {
                Log::error('❌ [ProfileLink] Error verificando columna', [
                    'error' => $e->getMessage()
                ]);
            }

            // Generar slug si no existe
            if (!$user->profile_slug) {
                Log::info('🔄 [ProfileLink] Generando nuevo slug', [
                    'user_id' => $user->id,
                    'user_name' => $user->name
                ]);
                
                try {
                    $slug = $this->generateUniqueSlug($user);
                    Log::info('🔍 [ProfileLink] Slug generado', [
                        'slug' => $slug,
                        'user_id' => $user->id
                    ]);
                    
                    // Refrescar el modelo antes de guardar
                    $user->refresh();
                    $user->profile_slug = $slug;
                    
                    // Intentar guardar
                    $saved = $user->save();
                    
                    if (!$saved) {
                        throw new \Exception('No se pudo guardar el slug en la base de datos');
                    }
                    
                    // Verificar que se guardó correctamente
                    $user->refresh();
                    if ($user->profile_slug !== $slug) {
                        throw new \Exception("El slug no se guardó correctamente. Esperado: {$slug}, Obtenido: {$user->profile_slug}");
                    }
                    
                    Log::info('✅ [ProfileLink] Slug generado y guardado exitosamente', [
                        'user_id' => $user->id,
                        'slug' => $slug,
                        'saved' => $saved
                    ]);
                } catch (\Exception $e) {
                    Log::error('❌ [ProfileLink] Error generando slug', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    return response()->json([
                        'success' => false,
                        'error' => 'Error al generar el slug del perfil',
                        'debug' => [
                            'message' => $e->getMessage(),
                            'file' => $e->getFile(),
                            'line' => $e->getLine()
                        ]
                    ], 500);
                }
            } else {
                Log::info('✅ [ProfileLink] Usuario ya tiene slug', [
                    'user_id' => $user->id,
                    'slug' => $user->profile_slug
                ]);
            }

            // Construir el link completo
            $baseUrl = $request->getSchemeAndHttpHost();
            $profileLink = "{$baseUrl}/chat/{$user->profile_slug}";

            Log::info('✅ [ProfileLink] Link generado exitosamente', [
                'user_id' => $user->id,
                'profile_link' => $profileLink,
                'profile_slug' => $user->profile_slug
            ]);

            return response()->json([
                'success' => true,
                'profile_link' => $profileLink,
                'profile_slug' => $user->profile_slug
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [ProfileLink] Error general', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error al generar el link del perfil',
                'debug' => [
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ]
            ], 500);
        }
    }

    /**
     * Redirigir al chat con la modelo basado en el slug
     */
    public function redirectToChat($slug)
    {
        try {
            $user = User::where('profile_slug', $slug)->first();

            if (!$user) {
                return response()->view('errors.404', [], 404);
            }

            // Verificar que sea modelo y esté verificada
            if ($user->rol !== 'modelo') {
                return response()->view('errors.404', [], 404);
            }

            $verificacion = $user->verificacion;
            if (!$verificacion || $verificacion->estado !== 'aprobada') {
                return response()->view('errors.404', [], 404);
            }

            // Redirigir siempre al frontend (el frontend manejará la autenticación)
            $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173'));
            
            Log::info('🔗 [ProfileLink] Redirigiendo al chat', [
                'slug' => $slug,
                'model_id' => $user->id,
                'authenticated' => Auth::check(),
                'user_rol' => Auth::check() ? Auth::user()->rol : 'no autenticado'
            ]);
            
            // Si el usuario está autenticado y es cliente, redirigir directamente al chat
            if (Auth::check() && Auth::user()->rol === 'cliente') {
                Log::info('✅ [ProfileLink] Cliente autenticado, redirigiendo al chat', [
                    'model_id' => $user->id
                ]);
                return redirect("{$frontendUrl}/mensajes?modelo={$user->id}");
            }

            // Si no está autenticado o es otro rol, redirigir al frontend que manejará la lógica
            // El frontend verificará si es cliente y redirigirá apropiadamente
            Log::info('🔄 [ProfileLink] Redirigiendo al frontend para manejo de autenticación');
            return redirect("{$frontendUrl}/chat/{$slug}");

        } catch (\Exception $e) {
            Log::error('Error redirigiendo al chat', [
                'slug' => $slug,
                'error' => $e->getMessage()
            ]);

            return response()->view('errors.500', [], 500);
        }
    }

    /**
     * Obtener información del modelo por slug (para clientes)
     */
    public function getModelBySlug($slug)
    {
        try {
            $user = User::where('profile_slug', $slug)->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Modelo no encontrada'
                ], 404);
            }

            // Verificar que sea modelo y esté verificada
            if ($user->rol !== 'modelo') {
                return response()->json([
                    'success' => false,
                    'error' => 'Usuario no es modelo'
                ], 404);
            }

            $verificacion = $user->verificacion;
            if (!$verificacion || $verificacion->estado !== 'aprobada') {
                return response()->json([
                    'success' => false,
                    'error' => 'Modelo no verificada'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'model_id' => $user->id,
                'model_name' => $user->name,
                'model_avatar' => $user->avatar
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo modelo por slug', [
                'slug' => $slug,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error al obtener información del modelo'
            ], 500);
        }
    }

    /**
     * Generar un slug único para el usuario
     */
    private function generateUniqueSlug(User $user)
    {
        try {
            Log::info('🔍 [ProfileLink] Iniciando generación de slug', [
                'user_id' => $user->id,
                'user_name' => $user->name
            ]);

            // Intentar usar el nombre del usuario
            $baseSlug = Str::slug($user->name ?: 'modelo');
            
            Log::info('🔍 [ProfileLink] Slug base generado', [
                'base_slug' => $baseSlug,
                'user_name' => $user->name
            ]);
            
            // Si el nombre está vacío o el slug resultante está vacío, usar el ID
            if (empty($baseSlug)) {
                $baseSlug = 'modelo-' . $user->id;
                Log::info('🔍 [ProfileLink] Usando ID como base', [
                    'base_slug' => $baseSlug
                ]);
            }

            $slug = $baseSlug;
            $counter = 1;
            $maxAttempts = 100; // Prevenir loops infinitos

            // Asegurar que el slug sea único
            while (User::where('profile_slug', $slug)->where('id', '!=', $user->id)->exists()) {
                if ($counter > $maxAttempts) {
                    // Si llegamos al límite, usar timestamp
                    $slug = $baseSlug . '-' . time();
                    Log::warning('⚠️ [ProfileLink] Límite de intentos alcanzado, usando timestamp', [
                        'slug' => $slug
                    ]);
                    break;
                }
                
                $slug = $baseSlug . '-' . $counter;
                $counter++;
            }

            Log::info('✅ [ProfileLink] Slug único generado', [
                'final_slug' => $slug,
                'attempts' => $counter - 1
            ]);

            return $slug;
        } catch (\Exception $e) {
            Log::error('❌ [ProfileLink] Error en generateUniqueSlug', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }
}

