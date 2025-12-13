<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Story;
use App\Models\StoryView;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;

class StoryController extends Controller
{
    public function store(Request $request)
    {
        if (!auth()->check()) {
            return response()->json(['error' => 'No autenticado'], 403);
        }

        $user = auth()->user();

        if (!$user || $user->rol !== 'modelo') {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        // 🔥 AGREGAR ESTOS LOGS DE DEBUG AQUÍ
        Log::info('=== 🔍 DEBUG COMPLETO DE SUBIDA ===');
        Log::info('📋 Request Info:', [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'content_type' => $request->header('Content-Type'),
            'content_length' => $request->header('Content-Length'),
            'user_agent' => $request->header('User-Agent')
        ]);

        Log::info('📦 Request Data:', [
            'all_data' => $request->all(),
            'has_file' => $request->hasFile('file'),
            'files_count' => count($request->allFiles())
        ]);

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            
            Log::info('📄 Archivo Recibido:', [
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'extension' => $file->getClientOriginalExtension(),
                'is_valid' => $file->isValid(),
                'error_code' => $file->getError(),
                'temp_path' => $file->getPathname(),
                'real_path' => $file->getRealPath()
            ]);

            // 🔥 LEER PRIMEROS BYTES DEL ARCHIVO
            try {
                $handle = fopen($file->getPathname(), 'rb');
                if ($handle) {
                    $bytes = fread($handle, 16);
                    fclose($handle);
                    $hex = bin2hex($bytes);
                    Log::info('🔬 Primeros bytes del archivo (hex):', ['bytes' => $hex]);
                    
                    // Detectar tipo por magic numbers
                    $magicNumbers = [
                        'ffd8ff' => 'JPEG',
                        '89504e47' => 'PNG',
                        '1a45dfa3' => 'WebM',
                        '00000018667479' => 'MP4',
                        '00000020667479' => 'MP4'
                    ];
                    
                    $hexLower = strtolower(substr($hex, 0, 14));
                    foreach ($magicNumbers as $magic => $type) {
                        if (strpos($hexLower, $magic) === 0) {
                            Log::info("🎯 Tipo detectado por magic number: {$type}");
                            break;
                        }
                    }
                }
            } catch (\Exception $e) {
                Log::error('❌ Error leyendo bytes del archivo: ' . $e->getMessage());
            }

            // 🔥 VERIFICAR VALIDACIÓN MANUAL
            $allowedMimes = ['jpeg', 'png', 'jpg', 'mp4', 'webm'];
            $detectedExtension = strtolower($file->getClientOriginalExtension());
            $detectedMime = $file->getMimeType();
            
            Log::info('🔍 Validación Manual:', [
                'extension' => $detectedExtension,
                'extension_allowed' => in_array($detectedExtension, $allowedMimes),
                'mime_type' => $detectedMime,
                'allowed_mimes' => $allowedMimes
            ]);

        } else {
            Log::error('❌ NO SE RECIBIÓ ARCHIVO');
            Log::info('📋 Todos los datos recibidos:', $request->all());
            Log::info('📋 Archivos recibidos:', $request->allFiles());
        }

        Log::info('=================================');

        // 🔄 RESTO DE TU CÓDIGO ORIGINAL...
        $existingStory = Story::where('user_id', $user->id)
            ->where(function ($query) {
                $query->where('status', 'pending')
                    ->orWhere(function ($q) {
                        $q->where('status', 'approved')
                            ->where('expires_at', '>', now());
                    });
            })
            ->first();

        if ($existingStory) {
            if ($existingStory->status === 'pending') {
                return response()->json([
                    'message' => 'Ya tienes una historia esperando aprobación. Debes esperar a que sea procesada antes de subir otra.',
                    'error_type' => 'pending_story'
                ], 422);
            } else if ($existingStory->status === 'approved') {
                // Calcular tiempo restante
                $hoursRemaining = Carbon::parse($existingStory->expires_at)->diffInHours(now(), false);
                $timeRemaining = $hoursRemaining > 0 ? 
                    Carbon::parse($existingStory->expires_at)->diffForHumans(now()) : 
                    'menos de 1 hora';
                
                return response()->json([
                    'message' => "Ya tienes una historia activa. Podrás subir otra historia en {$timeRemaining}.",
                    'error_type' => 'active_story',
                    'expires_at' => $existingStory->expires_at,
                    'time_remaining' => $timeRemaining
                ], 422);
            }
        }

        // 🔥 AGREGAR LOG ANTES DE LA VALIDACIÓN
        Log::info('🔍 Iniciando validación de Laravel...');
        
        try {
            $request->validate([
                'file' => [
                    'required',
                    'file',
                    'mimes:jpeg,png,jpg,mp4,webm,mov,qt', // ✅ AGREGAR mov,qt para quicktime
                    'max:51200' // 50MB
                ],
                'source_type' => 'in:upload,record'
            ]);
            
            Log::info('✅ Validación de Laravel EXITOSA');
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('❌ Validación de Laravel FALLÓ:', [
                'errors' => $e->errors(),
                'validator_errors' => $e->validator->errors()->toArray()
            ]);
            
            // Re-lanzar la excepción para que siga el flujo normal
            throw $e;
        }

        // Resto de tu código...
        $file = $request->file('file');
    
        if (!$file) {
            return response()->json([
                'message' => 'No se proporcionó ningún archivo',
                'errors' => ['file' => ['El archivo es requerido']]
            ], 422);
        }

        // Validar tamaño
        if ($file->getSize() > 50 * 1024 * 1024) { // 50MB
            return response()->json([
                'message' => 'Archivo muy grande',
                'errors' => ['file' => ['El archivo no puede ser mayor a 50MB']]
            ], 422);
        }

        // Validar por extensión (más confiable que MIME type)
        $extension = strtolower($file->getClientOriginalExtension());
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'mp4', 'webm', 'mov'];
        
        if (!in_array($extension, $allowedExtensions)) {
            return response()->json([
                'message' => 'Tipo de archivo no válido',
                'errors' => ['file' => [
                    'El archivo debe tener una de estas extensiones: ' . implode(', ', $allowedExtensions)
                ]]
            ], 422);
        }

        // Validar MIME type de forma más permisiva
        $mimeType = $file->getMimeType();
        $allowedMimes = [
            'image/jpeg',
            'image/png',
            'video/mp4',
            'video/webm',
            'video/quicktime', // ✅ AGREGAR ESTE
            'video/x-msvideo', // .avi
            'application/octet-stream' // Para archivos sin tipo detectado
        ];

        if (!in_array($mimeType, $allowedMimes)) {
            // Log para debug pero no fallar inmediatamente
            Log::warning('Archivo con MIME type no estándar aceptado por extensión', [
                'original_name' => $file->getClientOriginalName(),
                'detected_mime' => $mimeType,
                'extension' => $extension
            ]);
        }

        // ✅ Si llegamos aquí, el archivo es válido
        Log::info('✅ Archivo validado exitosamente', [
            'name' => $file->getClientOriginalName(),
            'mime' => $mimeType,
            'extension' => $extension,
            'size' => $file->getSize()
        ]);

        // ... resto de tu código para guardar la historia ...
        
        $path = $file->store('stories', 'public');
        Log::info('📁 Archivo guardado:', [
            'path' => $path,
            'full_path' => Storage::disk('public')->path($path),
            'exists' => Storage::disk('public')->exists($path),
            'size' => Storage::disk('public')->size($path),
            'url' => Storage::disk('public')->url($path)
        ]);

        $story = Story::create([
            'user_id' => $user->id,
            'file_path' => $path,
            'mime_type' => $file->getMimeType(),
            'source_type' => $request->input('source_type', 'upload'),
            'status' => 'pending',
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'Historia subida correctamente, esperando aprobación',
            'story' => $story
        ], 201);
    }

    public function myStory()
    {
        try {
            Log::info('🔍 DEBUG: myStory method called');
            
            $user = auth('sanctum')->user();
            
            if (!$user) {
                Log::error('❌ User not authenticated in myStory');
                return response()->json(['error' => 'Usuario no autenticado'], 401);
            }

            $story = Story::where('user_id', $user->id)
                ->where(function ($query) {
                    $query->where('status', 'pending')
                        ->orWhere('status', 'rejected')
                        ->orWhere(function ($q) {
                            $q->where('status', 'approved')
                                ->where('expires_at', '>', now());
                        });
                })
                ->latest()
                ->first();

            if (!$story) {
                return response()->json(['message' => 'No tienes historias activas'], 404);
            }

            // 🔥 DEBUG COMPLETO DE URLS Y ARCHIVOS
            $storyData = $story->toArray();
            
            if ($story->file_path) {
                // Verificar si el archivo existe físicamente
                $fileExists = Storage::disk('public')->exists($story->file_path);
                $fullPath = Storage::disk('public')->path($story->file_path);
                $fileSize = $fileExists ? Storage::disk('public')->size($story->file_path) : 0;
                
                // Generar URL usando diferentes métodos
                $storageUrl = Storage::disk('public')->url($story->file_path);
                $assetUrl = asset('storage/' . $story->file_path);
                $manualUrl = config('app.url') . '/storage/' . $story->file_path;
                
                Log::info('🔗 DEBUG COMPLETO DE ARCHIVO:', [
                    'file_path' => $story->file_path,
                    'file_exists' => $fileExists,
                    'full_path' => $fullPath,
                    'file_size' => $fileSize,
                    'storage_url' => $storageUrl,
                    'asset_url' => $assetUrl,
                    'manual_url' => $manualUrl,
                    'app_url' => config('app.url'),
                    'filesystem_config' => config('filesystems.disks.public')
                ]);
                
                // Usar la URL que funcione mejor
                $storyData['file_url'] = $storageUrl;
                $storyData['file_url_asset'] = $assetUrl;
                $storyData['file_url_manual'] = $manualUrl;
                $storyData['file_exists'] = $fileExists;
            }

            return response()->json($storyData);
            
        } catch (\Exception $e) {
            Log::error('❌ Error in myStory: ' . $e->getMessage());
            return response()->json(['error' => 'Error interno'], 500);
        }
    }

    // 🔄 MÉTODO ACTUALIZADO PARA VERIFICAR SI PUEDE SUBIR NUEVA HISTORIA
    public function canUploadNewStory()
    {
        if (!auth()->check()) {
            return response()->json(['error' => 'No autenticado'], 403);
        }

        $user = auth()->user();

        if ($user->rol !== 'modelo') {
            return response()->json(['can_upload' => false, 'reason' => 'No autorizado'], 403);
        }

        $existingStory = Story::where('user_id', $user->id)
            ->where(function ($query) {
                $query->where('status', 'pending')
                      ->orWhere(function ($q) {
                          $q->where('status', 'approved')
                            ->where('expires_at', '>', now());
                      });
            })
            ->first();

        if (!$existingStory) {
            return response()->json([
                'can_upload' => true,
                'message' => 'Puedes subir una nueva historia'
            ]);
        }

        if ($existingStory->status === 'pending') {
            return response()->json([
                'can_upload' => false,
                'reason' => 'pending_story',
                'message' => 'Tienes una historia esperando aprobación'
            ]);
        }

        if ($existingStory->status === 'approved') {
            $timeRemaining = Carbon::parse($existingStory->expires_at)->diffForHumans(now());
            
            return response()->json([
                'can_upload' => false,
                'reason' => 'active_story',
                'message' => "Tienes una historia activa. Podrás subir otra en {$timeRemaining}",
                'expires_at' => $existingStory->expires_at,
                'time_remaining' => $timeRemaining
            ]);
        }

        return response()->json([
            'can_upload' => true,
            'message' => 'Puedes subir una nueva historia'
        ]);
    }

    public function indexPublicas(Request $request)
    {
        // Solo historias aprobadas y no expiradas
        $historias = Story::with(['user', 'views'])
            ->active() // scope que filtra aprobadas y no expiradas
            ->latest('approved_at')
            ->get();

        return response()->json($historias);
    }

    public function show($id, Request $request)
    {
        $story = Story::with(['user', 'views'])->findOrFail($id);

        // Solo mostrar historias aprobadas y activas
        if (!$story->isActive()) {
            return response()->json(['message' => 'Historia no disponible'], 404);
        }

        // Registrar vista
        $userId = auth()->id();
        $ipAddress = $request->ip();
        
        $story->addView($userId, $ipAddress);

        return response()->json($story);
    }

    public function destroy($id)
    {
        $user = auth()->user();
        $story = Story::findOrFail($id);

        // 🔒 VERIFICAR QUE EL USUARIO PUEDE ELIMINAR LA HISTORIA
        if ($story->user_id !== $user->id && $user->rol !== 'admin') {
            return response()->json(['error' => 'No autorizado para eliminar esta historia'], 403);
        }

        // Eliminar archivo físico del storage
        if ($story->file_path && Storage::disk('public')->exists($story->file_path)) {
            Storage::disk('public')->delete($story->file_path);
        }

        // Eliminar de la base de datos
        $story->delete();

        return response()->json(['message' => 'Historia eliminada correctamente']);
    }

    // MÉTODOS PARA ADMINISTRADORES

    public function indexPending()
    {
        if (!auth()->check() || auth()->user()->rol !== 'admin') {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $stories = Story::with('user')
            ->pending()
            ->latest()
            ->get();

        return response()->json($stories);
    }

    public function approve($id, Request $request)
    {
        if (!auth()->check() || auth()->user()->rol !== 'admin') {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $story = Story::findOrFail($id);
        
        if ($story->status !== 'pending') {
            return response()->json(['message' => 'La historia ya fue procesada'], 422);
        }

        // 🔧 CORREGIR ESTA PARTE - usar update() en lugar de approve()
        $story->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => auth()->id(),
            'expires_at' => now()->addHours(24) // 🚨 ESTO ES CRÍTICO
        ]);

        return response()->json([
            'message' => 'Historia aprobada correctamente',
            'story' => $story->fresh()
        ]);
    }

    public function reject($id, Request $request)
    {
        if (!auth()->check() || auth()->user()->rol !== 'admin') {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $request->validate([
            'reason' => 'required|string|max:500'
        ]);

        $story = Story::findOrFail($id);
        
        if ($story->status !== 'pending') {
            return response()->json(['message' => 'La historia ya fue procesada'], 422);
        }

        $story->update([
            'status' => 'rejected',
            'rejection_reason' => $request->reason,
            'rejected_at' => now(),
            'rejected_by' => auth()->id()
        ]);

        return response()->json([
            'message' => 'Historia rechazada',
            'story' => $story->fresh()
        ]);
    }

    public function getViews($id)
    {
        $story = Story::with(['views.user'])->findOrFail($id);

        if (!auth()->check() || 
            (auth()->user()->rol !== 'admin' && auth()->id() !== $story->user_id)) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        return response()->json([
            'total_views' => $story->views_count,
            'views' => $story->views()->with('user')->latest('viewed_at')->get()
        ]);
    }

    public function getActiveStories()
    {
        try {
            Log::info('🔍 DEBUG: getActiveStories method called');
            
            if (!Schema::hasTable('stories')) {
                Log::error('❌ Stories table does not exist');
                return response()->json([
                    'error' => 'Tabla de historias no existe',
                    'data' => []
                ], 500);
            }

            if (!Schema::hasTable('users')) {
                Log::error('❌ Users table does not exist');
                return response()->json([
                    'error' => 'Tabla de usuarios no existe',
                    'data' => []
                ], 500);
            }

            $stories = Story::with(['user' => function($query) {
                    $query->select('id', 'name', 'email');
                    
                    if (Schema::hasColumn('users', 'is_online')) {
                        $query->addSelect('is_online');
                    }
                    if (Schema::hasColumn('users', 'avatar')) {
                        $query->addSelect('avatar');
                    }
                }])
                ->where('status', 'approved') // 🔄 SOLO HISTORIAS APROBADAS
                ->where('expires_at', '>', Carbon::now()) // 🔄 Y NO EXPIRADAS
                ->orderBy('approved_at', 'desc') // 🔄 ORDENAR POR FECHA DE APROBACIÓN
                ->limit(20)
                ->get();

            Log::info('📊 Active stories found: ' . $stories->count());

            if ($stories->isEmpty()) {
                return response()->json([]);
            }

            $formattedStories = $stories->map(function($story) {
                return [
                    'id' => $story->id,
                    'user_id' => $story->user_id,
                    'file_path' => $story->file_path,
                    'file_url' => Storage::url($story->file_path), // 🔄 URL COMPLETA
                    'mime_type' => $story->mime_type,
                    'source_type' => $story->source_type,
                    'created_at' => $story->created_at,
                    'approved_at' => $story->approved_at,
                    'expires_at' => $story->expires_at,
                    'status' => $story->status,
                    'views_count' => $story->views_count ?? 0,
                    'user' => [
                        'id' => $story->user->id,
                        'name' => $story->user->name ?? 'Usuario',
                        'email' => $story->user->email,
                        'is_online' => $story->user->is_online ?? false,
                        'avatar' => $story->user->avatar ?? null
                    ]
                ];
            });

            return response()->json($formattedStories, 200);

        } catch (\Illuminate\Database\QueryException $e) {
            Log::error('❌ Database Query Error in getActiveStories: ' . $e->getMessage());
            
            return response()->json([
                'error' => 'Error de base de datos',
                'message' => 'Problema con la consulta a la base de datos',
                'details' => app()->environment('local') ? $e->getMessage() : 'Error interno'
            ], 500);
            
        } catch (\Exception $e) {
            Log::error('❌ General Error in getActiveStories: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'error' => 'Error interno del servidor',
                'message' => 'No se pudieron cargar las historias',
                'details' => app()->environment('local') ? $e->getMessage() : 'Error interno'
            ], 500);
        }
    }
}