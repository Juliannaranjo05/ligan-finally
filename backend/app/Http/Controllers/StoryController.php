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
        try {
            // Los límites de upload_max_filesize y post_max_size se configuran en php.ini
            // Solo podemos aumentar otros límites aquí
            ini_set('max_execution_time', '300'); // 5 minutos
            ini_set('memory_limit', '512M');
            
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
            $allowedMimes = ['jpeg', 'png', 'jpg', 'mp4', 'webm', 'mov'];
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
        
        // Verificar si el archivo llegó ANTES de validar
        if (!$request->hasFile('file')) {
            Log::error('❌ El archivo no se recibió en la petición');
            Log::info('📋 Información de la petición:', [
                'content_type' => $request->header('Content-Type'),
                'content_length' => $request->header('Content-Length'),
                'has_file' => $request->hasFile('file'),
                'all_files' => $request->allFiles(),
                'post_data' => $request->all()
            ]);
            
            // Verificar si el problema es tamaño de archivo
            $contentLength = $request->header('Content-Length');
            if ($contentLength) {
                $sizeInMB = round($contentLength / 1024 / 1024, 2);
                $uploadMaxFilesize = ini_get('upload_max_filesize');
                $postMaxSize = ini_get('post_max_size');
                
                Log::warning('⚠️ Límites de PHP detectados:', [
                    'content_length' => $contentLength,
                    'size_mb' => $sizeInMB,
                    'upload_max_filesize' => $uploadMaxFilesize,
                    'post_max_size' => $postMaxSize
                ]);
            }
            
            return response()->json([
                'message' => 'No se recibió ningún archivo en la petición',
                'errors' => ['file' => [
                    'El archivo no se recibió correctamente. Verifica que el archivo no exceda los límites del servidor (actualmente: upload_max_filesize=' . ini_get('upload_max_filesize') . ', post_max_size=' . ini_get('post_max_size') . ')'
                ]]
            ], 422);
        }
        
        try {
            $request->validate([
                'file' => [
                    'required',
                    'file',
                    'mimes:jpeg,png,jpg,mp4,webm,mov,qt', // Solo fotos o videos
                    // Sin límite de peso - permitir archivos de alta calidad
                ],
                'source_type' => 'in:upload,record'
            ]);
            
            Log::info('✅ Validación de Laravel EXITOSA');
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('❌ Validación de Laravel FALLÓ:', [
                'errors' => $e->errors(),
                'validator_errors' => $e->validator->errors()->toArray(),
                'request_has_file' => $request->hasFile('file'),
                'content_type' => $request->header('Content-Type')
            ]);
            
            // Si el error es "validation.uploaded", el archivo no se subió correctamente
            $errors = $e->errors();
            if (isset($errors['file']) && (in_array('validation.uploaded', $errors['file']) || in_array('The file failed to upload.', $errors['file']))) {
                $uploadMaxFilesize = ini_get('upload_max_filesize');
                $postMaxSize = ini_get('post_max_size');
                
                return response()->json([
                    'message' => 'El archivo no se pudo subir correctamente',
                    'errors' => ['file' => [
                        'El archivo no se subió correctamente. Posibles causas: el archivo es demasiado grande (límites actuales: upload_max_filesize=' . $uploadMaxFilesize . ', post_max_size=' . $postMaxSize . ') o hay un problema con la conexión.'
                    ]]
                ], 422);
            }
            
            // Re-lanzar la excepción para que siga el flujo normal
            throw $e;
        }

        // Resto de tu código...
        $file = $request->file('file');
    
        if (!$file) {
            Log::error('❌ Archivo no encontrado en request');
            return response()->json([
                'message' => 'No se proporcionó ningún archivo',
                'errors' => ['file' => ['El archivo es requerido']]
            ], 422);
        }

        // Verificar si el archivo tiene errores de carga
        if (!$file->isValid()) {
            $errorCode = $file->getError();
            $errorMessages = [
                UPLOAD_ERR_INI_SIZE => 'El archivo excede el tamaño máximo permitido por el servidor',
                UPLOAD_ERR_FORM_SIZE => 'El archivo excede el tamaño máximo permitido por el formulario',
                UPLOAD_ERR_PARTIAL => 'El archivo se subió parcialmente',
                UPLOAD_ERR_NO_FILE => 'No se subió ningún archivo',
                UPLOAD_ERR_NO_TMP_DIR => 'Falta la carpeta temporal',
                UPLOAD_ERR_CANT_WRITE => 'Error al escribir el archivo en el disco',
                UPLOAD_ERR_EXTENSION => 'Una extensión de PHP detuvo la subida del archivo',
            ];
            
            $errorMessage = $errorMessages[$errorCode] ?? "Error desconocido al subir el archivo (código: {$errorCode})";
            
            Log::error('❌ Archivo inválido:', [
                'error_code' => $errorCode,
                'error_message' => $errorMessage,
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize()
            ]);
            
            return response()->json([
                'message' => $errorMessage,
                'errors' => ['file' => [$errorMessage]]
            ], 422);
        }

        // No hay límite de peso - permitir archivos de alta calidad
        // El peso no importa, solo la duración para videos

        // Validar por extensión - solo fotos o videos
        $extension = strtolower($file->getClientOriginalExtension());
        $allowedImageExtensions = ['jpg', 'jpeg', 'png'];
        $allowedVideoExtensions = ['mp4', 'webm', 'mov'];
        $allowedExtensions = array_merge($allowedImageExtensions, $allowedVideoExtensions);
        
        if (!in_array($extension, $allowedExtensions)) {
            return response()->json([
                'message' => 'Tipo de archivo no válido',
                'errors' => ['file' => [
                    'Solo se permiten archivos de imagen (JPG, PNG) o video (MP4, WEBM, MOV).'
                ]]
            ], 422);
        }
        
        // Determinar si es imagen o video
        $isImage = in_array($extension, $allowedImageExtensions);
        $isVideo = in_array($extension, $allowedVideoExtensions);

        // Validar MIME type - solo fotos o videos
        $mimeType = $file->getMimeType();
        $allowedImageMimes = [
            'image/jpeg',
            'image/png'
        ];
        $allowedVideoMimes = [
            'video/mp4',
            'video/webm',
            'video/quicktime', // .mov files
            'video/x-msvideo' // .avi files
        ];
        $allowedMimes = array_merge($allowedImageMimes, $allowedVideoMimes);

        // Si el MIME type no está en la lista, verificar por extensión
        if (!in_array($mimeType, $allowedMimes)) {
            Log::warning('Archivo con MIME type no estándar - validando por extensión', [
                'original_name' => $file->getClientOriginalName(),
                'detected_mime' => $mimeType,
                'extension' => $extension
            ]);
            
            // Si la extensión es válida pero el MIME no, permitirlo (puede ser un falso negativo)
            if (!in_array($extension, $allowedExtensions)) {
                return response()->json([
                    'message' => 'Tipo de archivo no válido',
                    'errors' => ['file' => [
                        'Solo se permiten archivos de imagen (JPG, PNG) o video (MP4, WEBM, MOV).'
                    ]]
                ], 422);
            }
        }

        // Validar duración del video si es un video (máximo 15 segundos)
        if ($isVideo) {
            try {
                $videoDuration = $this->getVideoDuration($file);
                
                if ($videoDuration === null) {
                    Log::warning('No se pudo determinar la duración del video - confiando en validación del frontend', [
                        'file' => $file->getClientOriginalName(),
                        'file_size' => $file->getSize()
                    ]);
                    // Continuar - la validación del frontend ya lo validó
                    // No rechazar el archivo si no podemos leer la duración
                } elseif ($videoDuration <= 0) {
                    Log::warning('Duración del video inválida (0 o negativa) - confiando en validación del frontend', [
                        'file' => $file->getClientOriginalName(),
                        'duration' => $videoDuration
                    ]);
                    // Continuar - puede ser un error de lectura, confiamos en el frontend
                } elseif ($videoDuration > 15) {
                    return response()->json([
                        'message' => 'El video excede la duración máxima',
                        'errors' => ['file' => [
                            'Los videos no pueden durar más de 15 segundos. Duración actual: ' . round($videoDuration, 1) . 's'
                        ]]
                    ], 422);
                } else {
                    Log::info('✅ Duración del video validada', [
                        'duration' => $videoDuration,
                        'file' => $file->getClientOriginalName()
                    ]);
                }
            } catch (\Exception $e) {
                Log::warning('Error al validar duración del video - continuando con subida', [
                    'file' => $file->getClientOriginalName(),
                    'error' => $e->getMessage()
                ]);
                // No rechazar el archivo si hay un error al leer la duración
                // Confiamos en la validación del frontend
            }
        }

        // ✅ Si llegamos aquí, el archivo es válido
        Log::info('✅ Archivo validado exitosamente', [
            'name' => $file->getClientOriginalName(),
            'mime' => $mimeType,
            'extension' => $extension,
            'size' => $file->getSize(),
            'is_video' => $isVideo,
            'is_image' => $isImage
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
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Errores de validación ya están manejados arriba, pero por si acaso
            Log::error('❌ Error de validación no capturado:', [
                'errors' => $e->errors(),
                'message' => $e->getMessage()
            ]);
            throw $e; // Re-lanzar para que Laravel lo maneje correctamente
            
        } catch (\Exception $e) {
            // Capturar cualquier otro error y devolver respuesta JSON clara
            Log::error('❌ ERROR INTERNO al subir historia:', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'request_data' => [
                    'has_file' => $request->hasFile('file'),
                    'content_type' => $request->header('Content-Type'),
                    'content_length' => $request->header('Content-Length')
                ]
            ]);
            
            return response()->json([
                'message' => 'Error interno del servidor al subir la historia',
                'error' => app()->environment('local') ? $e->getMessage() : 'Error interno del servidor',
                'errors' => ['file' => ['Hubo un problema al procesar el archivo. Por favor, intenta nuevamente.']]
            ], 500);
        }
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
                
                // Asegurar que las URLs no tengan doble slash
                $storageUrl = str_replace('//storage', '/storage', $storageUrl);
                $assetUrl = str_replace('//storage', '/storage', $assetUrl);
                $manualUrl = str_replace('//storage', '/storage', $manualUrl);
                
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
                
                // Usar la URL manual como principal (más confiable)
                $storyData['file_url'] = $manualUrl;
                $storyData['file_url_asset'] = $assetUrl;
                $storyData['file_url_manual'] = $manualUrl;
                $storyData['file_url_storage'] = $storageUrl; // Agregar también la storage URL
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

    public function indexPending(Request $request)
    {
        // Validar que el admin_user_id esté presente (agregado por AdminAuthMiddleware)
        $adminId = $request->input('admin_user_id') ?? $request->header('ligand-admin-id');
        
        \Log::info('📖 [ADMIN STORIES] indexPending llamado', [
            'admin_id' => $adminId,
            'has_admin_id' => !empty($adminId),
            'headers' => $request->headers->all()
        ]);
        
        if (!$adminId) {
            \Log::warning('⚠️ [ADMIN STORIES] No autorizado - falta admin_user_id');
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $stories = Story::with('user')
            ->pending()
            ->latest()
            ->get();

        \Log::info('📖 [ADMIN STORIES] Historias pendientes encontradas', [
            'count' => $stories->count(),
            'stories' => $stories->map(function($story) {
                return [
                    'id' => $story->id,
                    'user_id' => $story->user_id,
                    'user_name' => $story->user->name ?? 'N/A',
                    'status' => $story->status,
                    'created_at' => $story->created_at
                ];
            })->toArray()
        ]);

        return response()->json($stories);
    }

    public function approve($id, Request $request)
    {
        // Validar que el admin_user_id esté presente (agregado por AdminAuthMiddleware)
        $adminId = $request->input('admin_user_id') ?? $request->header('ligand-admin-id');
        if (!$adminId) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $story = Story::findOrFail($id);
        
        if ($story->status !== 'pending') {
            return response()->json(['message' => 'La historia ya fue procesada'], 422);
        }

        // 🔧 CORREGIR ESTA PARTE - usar update() en lugar de approve()
        $adminId = $request->input('admin_user_id') ?? $request->header('ligand-admin-id');
        $story->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => $adminId,
            'expires_at' => now()->addHours(24) // 🚨 ESTO ES CRÍTICO
        ]);

        return response()->json([
            'message' => 'Historia aprobada correctamente',
            'story' => $story->fresh()
        ]);
    }

    public function reject($id, Request $request)
    {
        // Validar que el admin_user_id esté presente (agregado por AdminAuthMiddleware)
        $adminId = $request->input('admin_user_id') ?? $request->header('ligand-admin-id');
        if (!$adminId) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $request->validate([
            'reason' => 'required|string|max:500'
        ]);

        $story = Story::findOrFail($id);
        
        if ($story->status !== 'pending') {
            return response()->json(['message' => 'La historia ya fue procesada'], 422);
        }

        $adminId = $request->input('admin_user_id') ?? $request->header('ligand-admin-id');
        $story->update([
            'status' => 'rejected',
            'rejection_reason' => $request->reason,
            'rejected_at' => now(),
            'rejected_by' => $adminId
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

    /**
     * Dar like a una historia
     */
    public function like($id)
    {
        try {
            if (!auth()->check()) {
                return response()->json([
                    'success' => false,
                    'error' => 'No autenticado'
                ], 401);
            }

            $story = Story::findOrFail($id);
            $userId = auth()->id();

            // Verificar si ya tiene like
            $hasLiked = \App\Models\StoryLike::where('story_id', $story->id)
                ->where('user_id', $userId)
                ->exists();

            if ($hasLiked) {
                return response()->json([
                    'success' => true,
                    'has_liked' => true,
                    'likes_count' => $story->fresh()->likes_count,
                    'message' => 'Ya has dado like a esta historia'
                ]);
            }

            // Agregar like usando el método del modelo
            $result = $story->addLike($userId);

            if ($result) {
                return response()->json([
                    'success' => true,
                    'has_liked' => true,
                    'likes_count' => $story->fresh()->likes_count,
                    'message' => 'Like agregado exitosamente'
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo agregar el like'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Error al dar like a historia: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Quitar like de una historia
     */
    public function unlike($id)
    {
        try {
            if (!auth()->check()) {
                return response()->json([
                    'success' => false,
                    'error' => 'No autenticado'
                ], 401);
            }

            $story = Story::findOrFail($id);
            $userId = auth()->id();

            // Quitar like usando el método del modelo
            $result = $story->removeLike($userId);

            return response()->json([
                'success' => true,
                'has_liked' => false,
                'likes_count' => $story->fresh()->likes_count,
                'message' => 'Like removido exitosamente'
            ]);
        } catch (\Exception $e) {
            Log::error('Error al quitar like de historia: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Verificar si el usuario ha dado like a una historia
     */
    public function likeStatus($id)
    {
        try {
            if (!auth()->check()) {
                return response()->json([
                    'success' => false,
                    'has_liked' => false
                ]);
            }

            $story = Story::findOrFail($id);
            $userId = auth()->id();

            $hasLiked = \App\Models\StoryLike::where('story_id', $story->id)
                ->where('user_id', $userId)
                ->exists();

            return response()->json([
                'success' => true,
                'has_liked' => $hasLiked,
                'likes_count' => $story->likes_count
            ]);
        } catch (\Exception $e) {
            Log::error('Error al verificar like status: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'has_liked' => false
            ], 500);
        }
    }

    public function getActiveStories()
    {
        try {
            $now = Carbon::now();
            Log::info('🔍 [STORIES] getActiveStories method called', [
                'timestamp' => $now->toDateTimeString(),
                'timezone' => $now->timezone ? $now->timezone->getName() : config('app.timezone', 'UTC')
            ]);
            
            if (!Schema::hasTable('stories')) {
                Log::error('❌ [STORIES] Stories table does not exist');
                return response()->json([
                    'error' => 'Tabla de historias no existe',
                    'data' => []
                ], 500);
            }

            if (!Schema::hasTable('users')) {
                Log::error('❌ [STORIES] Users table does not exist');
                return response()->json([
                    'error' => 'Tabla de usuarios no existe',
                    'data' => []
                ], 500);
            }

            // 🔍 DEBUG: Contar historias antes de filtrar
            $totalApproved = Story::where('status', 'approved')->count();
            $totalExpired = Story::where('status', 'approved')
                ->where('expires_at', '<=', $now)
                ->count();
            $totalActive = Story::where('status', 'approved')
                ->where('expires_at', '>', $now)
                ->count();
            
            Log::info('📊 [STORIES] Estadísticas de historias', [
                'total_approved' => $totalApproved,
                'total_expired' => $totalExpired,
                'total_active' => $totalActive,
                'current_time' => $now->toDateTimeString()
            ]);

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
                ->where('expires_at', '>', $now) // 🔄 SOLO HISTORIAS NO EXPIRADAS (dentro de las 24 horas)
                ->orderBy('approved_at', 'desc') // 🔄 ORDENAR POR FECHA DE APROBACIÓN
                ->limit(50) // 🔄 Aumentar límite para mostrar más historias
                ->get();

            Log::info('📊 [STORIES] Historias encontradas después de filtros', [
                'count' => $stories->count(),
                'stories_details' => $stories->map(function($story) use ($now) {
                    try {
                        return [
                            'id' => $story->id,
                            'user_id' => $story->user_id,
                            'user_name' => $story->user ? ($story->user->name ?? 'N/A') : 'Usuario no encontrado',
                            'is_online' => $story->user ? ($story->user->is_online ?? false) : false,
                            'status' => $story->status,
                            'approved_at' => $story->approved_at ? $story->approved_at->toDateTimeString() : null,
                            'expires_at' => $story->expires_at ? $story->expires_at->toDateTimeString() : null,
                            'is_expired' => $story->expires_at && $story->expires_at->isPast(),
                            'minutes_until_expiry' => $story->expires_at ? $story->expires_at->diffInMinutes($now) : null
                        ];
                    } catch (\Exception $e) {
                        Log::warning('⚠️ [STORIES] Error al procesar historia en log', [
                            'story_id' => $story->id ?? 'N/A',
                            'error' => $e->getMessage()
                        ]);
                        return [
                            'id' => $story->id ?? 'N/A',
                            'error' => 'Error al procesar'
                        ];
                    }
                })->toArray()
            ]);

            if ($stories->isEmpty()) {
                return response()->json([]);
            }

            $formattedStories = $stories->map(function($story) {
                try {
                    // Verificar que el usuario existe
                    if (!$story->user) {
                        Log::warning('⚠️ [STORIES] Historia sin usuario asociado', [
                            'story_id' => $story->id,
                            'user_id' => $story->user_id
                        ]);
                        return null; // Filtrar historias sin usuario
                    }

                    return [
                        'id' => $story->id,
                        'user_id' => $story->user_id,
                        'file_path' => $story->file_path,
                        'file_url' => $story->file_path ? Storage::url($story->file_path) : null, // 🔄 URL COMPLETA
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
                            'email' => $story->user->email ?? '',
                            'is_online' => $story->user->is_online ?? false,
                            'avatar' => $story->user->avatar ?? null
                        ]
                    ];
                } catch (\Exception $e) {
                    Log::error('❌ [STORIES] Error al formatear historia', [
                        'story_id' => $story->id ?? 'N/A',
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    return null; // Filtrar historias con error
                }
            })->filter(function($story) {
                return $story !== null; // Remover historias nulas
            });

            Log::info('✅ [STORIES] Historias formateadas y enviadas', [
                'total_sent' => $formattedStories->count(),
                'users_online' => $formattedStories->filter(function($s) {
                    return isset($s['user']['is_online']) && $s['user']['is_online'];
                })->count(),
                'users_offline' => $formattedStories->filter(function($s) {
                    return isset($s['user']['is_online']) && !$s['user']['is_online'];
                })->count()
            ]);

            return response()->json($formattedStories->values(), 200);

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

    /**
     * Obtener la duración de un video en segundos
     * Intenta usar ffprobe si está disponible, si no retorna null
     */
    private function getVideoDuration($file)
    {
        try {
            $filePath = $file->getRealPath();
            
            if (!$filePath || !file_exists($filePath)) {
                Log::warning('Archivo temporal no encontrado para obtener duración', [
                    'file' => $file->getClientOriginalName()
                ]);
                return null;
            }
            
            // Intentar usar ffprobe si está disponible
            $ffprobePath = shell_exec('which ffprobe');
            if ($ffprobePath) {
                $command = sprintf(
                    'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "%s" 2>&1',
                    escapeshellarg($filePath)
                );
                
                $output = shell_exec($command);
                
                if ($output === null || trim($output) === '') {
                    Log::warning('ffprobe no devolvió resultado', [
                        'file' => $file->getClientOriginalName()
                    ]);
                    return null;
                }
                
                $duration = floatval(trim($output));
                
                // Validar que la duración sea válida
                if ($duration > 0 && is_finite($duration) && $duration <= 3600) { // Máximo 1 hora como sanity check
                    return $duration;
                } else {
                    Log::warning('Duración inválida obtenida de ffprobe', [
                        'file' => $file->getClientOriginalName(),
                        'duration' => $duration,
                        'output' => $output
                    ]);
                    return null;
                }
            }
            
            // Si ffprobe no está disponible, retornamos null y confiamos en la validación del frontend
            Log::info('ffprobe no disponible - confiando en validación del frontend', [
                'file' => $file->getClientOriginalName()
            ]);
            return null;
            
        } catch (\Exception $e) {
            Log::warning('Error al obtener duración del video: ' . $e->getMessage(), [
                'file' => $file->getClientOriginalName() ?? 'unknown',
                'trace' => $e->getTraceAsString()
            ]);
            return null;
        }
    }
}