<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;
use App\Models\Verificacion;
use App\Models\User;
use Illuminate\Validation\ValidationException;


class VerificacionController extends Controller
{
    /**
     * Almacenar una nueva verificación
     */
    public function store(Request $request)
    {
        try {
            Log::info('📥 Recibiendo verificación', [
                'has_selfie' => $request->hasFile('selfie'),
                'has_documento' => $request->hasFile('documento'),
                'has_selfie_doc' => $request->hasFile('selfie_doc'),
                'has_video' => $request->hasFile('video'),
                'has_video_directo' => $request->hasFile('video_directo'),
                'video_upload_id' => $request->input('video_upload_id'),
                'all_files' => array_keys($request->allFiles())
            ]);
            
            // Validar archivos con reglas simplificadas
            $validatedData = $request->validate([
                'selfie' => [
                    'required',
                    'image',
                    'mimes:jpeg,png,jpg,webp',
                    'max:5120', // 5MB
                ],
                'documento' => [
                    'required', 
                    'image',
                    'mimes:jpeg,png,jpg,webp',
                    'max:5120', // 5MB
                ],
                'selfie_doc' => [
                    'required',
                    'image', 
                    'mimes:jpeg,png,jpg,webp',
                    'max:5120', // 5MB
                ],
                'video' => 'nullable|file|mimes:webm,mp4,mov|max:102400',
                'video_directo' => 'nullable|file|mimes:webm,mp4,mov|max:102400',
                'video_upload_id' => 'nullable|string'
            ], [
                // Mensajes personalizados
                'selfie.required' => 'La foto selfie es obligatoria.',
                'selfie.image' => 'El archivo selfie debe ser una imagen.',
                'selfie.mimes' => 'La selfie debe ser formato: jpeg, png, jpg o webp.',
                'selfie.max' => 'La selfie no puede superar 5MB.',
                'selfie.dimensions' => 'La selfie debe tener entre 200x200 y 4000x4000 píxeles.',
                
                'documento.required' => 'La foto del documento es obligatoria.',
                'documento.image' => 'El archivo del documento debe ser una imagen.',
                'documento.mimes' => 'El documento debe ser formato: jpeg, png, jpg o webp.',
                'documento.max' => 'El documento no puede superar 5MB.',
                'documento.dimensions' => 'El documento debe tener entre 200x200 y 4000x4000 píxeles.',
                
                'selfie_doc.required' => 'La foto selfie con documento es obligatoria.',
                'selfie_doc.image' => 'El archivo selfie con documento debe ser una imagen.',
                'selfie_doc.mimes' => 'La selfie con documento debe ser formato: jpeg, png, jpg o webp.',
                'selfie_doc.max' => 'La selfie con documento no puede superar 5MB.',
                'selfie_doc.dimensions' => 'La selfie con documento debe tener entre 200x200 y 4000x4000 píxeles.',
                
                'video.required' => 'El video de verificación es obligatorio.',
                'video.file' => 'Debe adjuntar un archivo de video válido.',
                'video.mimetypes' => 'El video debe ser formato: webm, mp4 o mov.',
                'video.max' => 'El video no puede superar 100MB.',
                'video_directo.required' => 'El video de verificación es obligatorio.',
                'video_directo.file' => 'Debe adjuntar un archivo de video válido.',
                'video_directo.mimetypes' => 'El video debe ser formato: webm, mp4 o mov.',
                'video_directo.max' => 'El video no puede superar 100MB.',
            ]);

            $user = $request->user();

            // Verificar si ya existe una verificación pendiente o aprobada
            $verificacionExistente = $user->verificacion()
                ->whereIn('estado', ['pendiente', 'aprobada'])
                ->first();

            if ($verificacionExistente) {
                return response()->json([
                    'message' => 'Ya tienes una verificación pendiente o aprobada.',
                    'estado_actual' => $verificacionExistente->estado,
                    'fecha_envio' => $verificacionExistente->created_at
                ], 409);
            }

            // Limitar envíos por día (máximo 3 intentos por día)
            $verificacionesHoy = $user->verificacion()
                ->whereDate('created_at', Carbon::today())
                ->count();

            if ($verificacionesHoy >= 3) {
                return response()->json([
                    'message' => 'Has alcanzado el límite de 3 intentos de verificación por día.',
                    'siguiente_intento' => Carbon::tomorrow()->format('Y-m-d H:i:s')
                ], 429);
            }

            // Iniciar transacción para asegurar consistencia
            DB::beginTransaction();

            try {
                // Crear directorio único para el usuario
                $userFolder = 'verificaciones/' . $user->id . '/' . Carbon::now()->format('Y-m-d_H-i-s');

                // SIMPLIFICADO: Guardar archivos directamente
                $selfieFile = $request->file('selfie');
                $documentoFile = $request->file('documento');
                $selfieDocFile = $request->file('selfie_doc');
                
                $selfieName = 'selfie_' . time() . '_' . uniqid() . '.' . $selfieFile->getClientOriginalExtension();
                $documentoName = 'documento_' . time() . '_' . uniqid() . '.' . $documentoFile->getClientOriginalExtension();
                $selfieDocName = 'selfie_doc_' . time() . '_' . uniqid() . '.' . $selfieDocFile->getClientOriginalExtension();
                
                $selfieFile->storeAs($userFolder, $selfieName, 'local');
                $documentoFile->storeAs($userFolder, $documentoName, 'local');
                $selfieDocFile->storeAs($userFolder, $selfieDocName, 'local');
                
                $selfie = $userFolder . '/' . $selfieName;
                $documento = $userFolder . '/' . $documentoName;
                $selfieDoc = $userFolder . '/' . $selfieDocName;
                
                // SIMPLIFICADO: Manejar video directamente
                $videoFile = $request->file('video_directo') ?? $request->file('video');
                
                if (!$videoFile) {
                    Log::error('❌ No se recibió ningún archivo de video', [
                        'has_video_directo' => $request->hasFile('video_directo'),
                        'has_video' => $request->hasFile('video'),
                        'all_files' => array_keys($request->allFiles())
                    ]);
                    throw new \Exception('El video de verificación es obligatorio.');
                }
                
                Log::info('📹 Guardando video', [
                    'name' => $videoFile->getClientOriginalName(),
                    'size' => $videoFile->getSize(),
                    'mime' => $videoFile->getMimeType()
                ]);
                
                // Guardar video directamente
                $videoFileName = 'video_' . time() . '_' . uniqid() . '.' . $videoFile->getClientOriginalExtension();
                $videoPath = $userFolder . '/' . $videoFileName;
                $videoFile->storeAs($userFolder, $videoFileName, 'local');
                $video = $videoPath;
                
                Log::info('✅ Video guardado', ['path' => $video]);

                // Crear registro de verificación
                $verificacion = Verificacion::create([
                    'user_id' => $user->id,
                    'selfie' => $selfie,
                    'documento' => $documento,
                    'selfie_doc' => $selfieDoc,
                    'video' => $video,
                    'estado' => 'pendiente',
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'submitted_at' => Carbon::now()
                ]);

                // Log para auditoría
                Log::info('Nueva verificación enviada', [
                    'user_id' => $user->id,
                    'verificacion_id' => $verificacion->id,
                    'ip' => $request->ip()
                ]);

                DB::commit();

                return response()->json([
                    'message' => 'Verificación enviada correctamente.',
                    'data' => [
                        'id' => $verificacion->id,
                        'estado' => $verificacion->estado,
                        'fecha_envio' => $verificacion->created_at,
                        'tiempo_respuesta_estimado' => '24-48 horas'
                    ]
                ], 201);

            } catch (Exception $e) {
                DB::rollBack();
                
                // Limpiar archivos si algo salió mal
                $this->cleanupFiles([
                    $selfie ?? null,
                    $documento ?? null, 
                    $selfieDoc ?? null,
                    $video ?? null
                ]);

                throw $e;
            }

        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Errores de validación encontrados.',
                'errors' => $e->errors()
            ], 422);

        } catch (Exception $e) {
            Log::error('Error al procesar verificación', [
                'user_id' => $request->user()->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Error interno del servidor. Por favor intenta nuevamente.',
                'error_code' => 'VERIFICATION_STORE_ERROR'
            ], 500);
        }
    }

    /**
     * Ver archivo de verificación (con seguridad mejorada)
     */
    public function verArchivo(Request $request, $filename)
    {
        try {
            // Validar que el filename no contenga caracteres peligrosos
            if (!preg_match('/^[a-zA-Z0-9._-]+$/', $filename)) {
                return response()->json(['message' => 'Nombre de archivo inválido.'], 400);
            }

            // Buscar el archivo en las verificaciones del usuario autenticado
            $user = $request->user();
            $verificacion = $user->verificacion()
                ->where(function ($query) use ($filename) {
                    $query->where('selfie', 'LIKE', "%{$filename}")
                          ->orWhere('documento', 'LIKE', "%{$filename}")
                          ->orWhere('selfie_doc', 'LIKE', "%{$filename}")
                          ->orWhere('video', 'LIKE', "%{$filename}");
                })
                ->first();

            if (!$verificacion) {
                return response()->json(['message' => 'No tienes permisos para ver este archivo.'], 403);
            }

            // Buscar la ruta completa del archivo
            $possiblePaths = [
                $verificacion->selfie,
                $verificacion->documento, 
                $verificacion->selfie_doc,
                $verificacion->video
            ];

            $filePath = null;
            foreach ($possiblePaths as $path) {
                if ($path && basename($path) === $filename) {
                    $filePath = $path;
                    break;
                }
            }

            if (!$filePath || !Storage::disk('local')->exists($filePath)) {
                return response()->json(['message' => 'Archivo no encontrado.'], 404);
            }

            $fullPath = Storage::disk('local')->path($filePath);
            $mimeType = Storage::disk('local')->mimeType($filePath);

            return Response::file($fullPath, [
                'Content-Type' => $mimeType,
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);

        } catch (Exception $e) {
            Log::error('Error al mostrar archivo de verificación', [
                'filename' => $filename,
                'error' => $e->getMessage()
            ]);

            return response()->json(['message' => 'Error al cargar el archivo.'], 500);
        }
    }

    /**
     * Obtener estado de verificación del usuario autenticado
     */
    public function estado(Request $request)
    {
        try {
            $user = $request->user();
            $verificacion = $user->verificacion()->latest()->first();

            if (!$verificacion) {
                return response()->json([
                    'estado' => 'no_enviada',
                    'puede_enviar' => true,
                    'intentos_hoy' => 0
                ]);
            }

            // Contar intentos del día
            $intentosHoy = $user->verificacion()
                ->whereDate('created_at', Carbon::today())
                ->count();

            return response()->json([
                'estado' => $verificacion->estado,
                'fecha_envio' => $verificacion->created_at,
                'fecha_actualizacion' => $verificacion->updated_at,
                'puede_reenviar' => $verificacion->estado === 'rechazado' && $intentosHoy < 3,
                'intentos_hoy' => $intentosHoy,
                'intentos_restantes' => max(0, 3 - $intentosHoy),
                'razon_rechazo' => $verificacion->razon_rechazo ?? null
            ]);

        } catch (Exception $e) {
            Log::error('Error al obtener estado de verificación', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'message' => 'Error al obtener el estado.',
                'error_code' => 'VERIFICATION_STATUS_ERROR'
            ], 500);
        }
    }

    /**
     * Listar verificaciones pendientes (solo para administradores)
     */
    public function listar(Request $request)
    {
        try {
            // Verificar permisos de administrador
            if (!$request->user()->hasRole('admin')) {
                return response()->json(['message' => 'No tienes permisos para esta acción.'], 403);
            }

            $verificaciones = Verificacion::where('estado', 'pendiente')
                ->with(['user:id,name,email,created_at'])
                ->latest()
                ->paginate(20);

            return response()->json([
                'data' => $verificaciones->items(),
                'meta' => [
                    'current_page' => $verificaciones->currentPage(),
                    'last_page' => $verificaciones->lastPage(),
                    'per_page' => $verificaciones->perPage(),
                    'total' => $verificaciones->total()
                ]
            ]);

        } catch (Exception $e) {
            Log::error('Error al listar verificaciones', [
                'admin_id' => $request->user()->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'message' => 'Error al cargar las verificaciones.',
                'error_code' => 'VERIFICATION_LIST_ERROR'
            ], 500);
        }
    }

    /**
     * Aprobar o rechazar verificación (solo para administradores)
     */
    public function accion(Request $request, $id, $accion)
    {
        try {
            // Verificar permisos de administrador
            if (!$request->user()->hasRole('admin')) {
                return response()->json(['message' => 'No tienes permisos para esta acción.'], 403);
            }

            // Validar entrada
            $request->validate([
                'razon_rechazo' => $accion === 'rechazar' ? 'required|string|max:500' : 'nullable|string|max:500'
            ]);

            if (!in_array($accion, ['aceptar', 'rechazar'])) {
                return response()->json(['message' => 'Acción no válida.'], 400);
            }

            $verificacion = Verificacion::findOrFail($id);

            if ($verificacion->estado !== 'pendiente') {
                return response()->json([
                    'message' => 'Esta verificación ya ha sido procesada.',
                    'estado_actual' => $verificacion->estado
                ], 409);
            }

            DB::beginTransaction();

            try {
                // Actualizar verificación
                $verificacion->update([
                    'estado' => $accion === 'aceptar' ? 'aprobada' : 'rechazado',
                    'procesada_por' => $request->user()->id,
                    'procesada_at' => Carbon::now(),
                    'razon_rechazo' => $accion === 'rechazar' ? $request->razon_rechazo : null
                ]);

                // Si se acepta, marcar usuario como verificado
                if ($accion === 'aceptar') {
                    $verificacion->user->update([
                        'verificacion_completa' => true,
                        'verificado_at' => Carbon::now()
                    ]);
                }

                // Log para auditoría
                Log::info('Verificación procesada', [
                    'verificacion_id' => $verificacion->id,
                    'user_id' => $verificacion->user_id,
                    'admin_id' => $request->user()->id,
                    'accion' => $accion,
                    'razon_rechazo' => $request->razon_rechazo ?? null
                ]);

                DB::commit();

                return response()->json([
                    'message' => "Verificación {$accion}ada correctamente.",
                    'data' => [
                        'verificacion_id' => $verificacion->id,
                        'nuevo_estado' => $verificacion->estado,
                        'fecha_procesado' => $verificacion->procesada_at
                    ]
                ]);

            } catch (Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (Exception $e) {
            Log::error('Error al procesar acción de verificación', [
                'verificacion_id' => $id,
                'accion' => $accion,
                'admin_id' => $request->user()->id ?? null,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'message' => 'Error al procesar la verificación.',
                'error_code' => 'VERIFICATION_ACTION_ERROR'
            ], 500);
        }
    }

    /**
     * Índice sin autenticación (para testing - REMOVER EN PRODUCCIÓN)
     */
    public function indexSinAuth()
    {
        // ⚠️ PELIGRO: Solo para desarrollo/testing
        if (app()->environment('production')) {
            return response()->json(['message' => 'Endpoint no disponible en producción.'], 403);
        }

        return Verificacion::with('user:id,name,email')->latest()->take(10)->get();
    }

    /**
     * ADMIN: Obtener verificaciones pendientes
     */
    public function getPendientes(Request $request)
    {
        try {
            $verificaciones = Verificacion::where('estado', 'pendiente')
                ->with(['user:id,name,email,country,created_at'])
                ->latest()
                ->get()
                ->map(function ($verificacion) {
                    return [
                        'id' => $verificacion->id,
                        'user_id' => $verificacion->user_id,
                        'user' => [
                            'id' => $verificacion->user->id ?? null,
                            'name' => $verificacion->user->name ?? 'Usuario eliminado',
                            'email' => $verificacion->user->email ?? 'N/A',
                            'country' => $verificacion->user->country ?? '🌐 No especificado'
                        ],
                        'documentos' => [
                            'selfie' => $verificacion->selfie,
                            'documento' => $verificacion->documento,
                            'selfie_doc' => $verificacion->selfie_doc,
                            'video' => $verificacion->video
                        ],
                        'estado' => $verificacion->estado,
                        'fecha' => $verificacion->created_at->diffForHumans(),
                        'created_at' => $verificacion->created_at->toISOString()
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $verificaciones,
                'count' => $verificaciones->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo verificaciones pendientes (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Aprobar verificación
     */
    public function aprobar(Request $request, $id)
    {
        try {
            $verificacion = Verificacion::findOrFail($id);

            if ($verificacion->estado !== 'pendiente') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta verificación ya ha sido procesada'
                ], 400);
            }

            DB::beginTransaction();

            // Obtener admin_id del request si no hay usuario autenticado
            $adminId = auth()->id() ?? $request->input('admin_user_id') ?? $request->header('ligand-admin-id');

            $verificacion->update([
                'estado' => 'aprobada',
                'procesada_por' => $adminId,
                'procesada_at' => Carbon::now()
            ]);

            $verificacion->user->update([
                'verificacion_completa' => true,
                'verificado_at' => Carbon::now(),
                'verificacion_estado' => 'aprobada'
            ]);

            DB::commit();

            Log::info('Verificación aprobada (admin)', [
                'verificacion_id' => $verificacion->id,
                'user_id' => $verificacion->user_id,
                'admin_id' => $adminId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Verificación aprobada correctamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error aprobando verificación (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Rechazar verificación
     */
    public function rechazar(Request $request, $id)
    {
        try {
            $verificacion = Verificacion::findOrFail($id);
            
            // Obtener admin_id del request si no hay usuario autenticado
            $adminId = auth()->id() ?? $request->input('admin_user_id') ?? $request->header('ligand-admin-id');

            if ($verificacion->estado !== 'pendiente') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta verificación ya ha sido procesada'
                ], 400);
            }

            DB::beginTransaction();

            // Eliminar archivos
            $files = [$verificacion->selfie, $verificacion->documento, $verificacion->selfie_doc, $verificacion->video];
            foreach ($files as $file) {
                if ($file && Storage::disk('local')->exists($file)) {
                    Storage::disk('local')->delete($file);
                }
            }

            // Eliminar verificación
            $verificacion->delete();

            DB::commit();

            Log::info('Verificación rechazada y eliminada (admin)', [
                'verificacion_id' => $id,
                'user_id' => $verificacion->user_id,
                'admin_id' => $adminId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Verificación rechazada y eliminada correctamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error rechazando verificación (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Ver documento específico
     */
    public function verDocumento($id, $tipo)
    {
        try {
            $verificacion = Verificacion::findOrFail($id);

            $filePath = null;
            switch ($tipo) {
                case 'selfie':
                    $filePath = $verificacion->selfie;
                    break;
                case 'documento':
                    $filePath = $verificacion->documento;
                    break;
                case 'selfie_doc':
                    $filePath = $verificacion->selfie_doc;
                    break;
                case 'video':
                    $filePath = $verificacion->video;
                    break;
                default:
                    return response()->json([
                        'success' => false,
                        'error' => 'Tipo de documento inválido'
                    ], 400);
            }

            if (!$filePath || !Storage::disk('local')->exists($filePath)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Archivo no encontrado'
                ], 404);
            }

            $fullPath = Storage::disk('local')->path($filePath);
            $mimeType = Storage::disk('local')->mimeType($filePath);

            // Para imágenes y videos, devolver URL
            if (strpos($mimeType, 'image/') === 0 || strpos($mimeType, 'video/') === 0) {
                $url = Storage::disk('local')->url($filePath);
                // Si no funciona, construir URL manualmente
                if (!$url || strpos($url, 'http') !== 0) {
                    $url = url('/storage/' . str_replace('storage/', '', $filePath));
                }
                
                return response()->json([
                    'success' => true,
                    'data' => [
                        'url' => $url,
                        'tipo' => $tipo,
                        'nombre' => basename($filePath),
                        'es_video' => strpos($mimeType, 'video/') === 0
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'error' => 'Tipo de archivo no soportado'
            ], 400);

        } catch (\Exception $e) {
            Log::error('Error obteniendo documento (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Obtener estadísticas de verificaciones
     */
    public function getStats()
    {
        try {
            $totalUsuarios = User::count();
            $modelosActivas = User::where('rol', 'modelo')
                ->where('verificacion_completa', true)
                ->where('verificacion_estado', 'aprobada')
                ->count();
            $verificacionesPendientes = Verificacion::where('estado', 'pendiente')->count();
            $clientesActivos = User::where('rol', 'cliente')
                ->where('email_verified_at', '!=', null)
                ->count();
            $verificacionesEstaSemana = Verificacion::whereBetween('created_at', [
                Carbon::now()->startOfWeek(),
                Carbon::now()->endOfWeek()
            ])->count();
            $modelosNuevas = User::where('rol', 'modelo')
                ->where('verificacion_estado', 'aprobada')
                ->whereBetween('verificado_at', [
                    Carbon::now()->subDays(7),
                    Carbon::now()
                ])
                ->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_usuarios' => $totalUsuarios,
                    'modelos_activas' => $modelosActivas,
                    'verificaciones_pendientes' => $verificacionesPendientes,
                    'clientes_activos' => $clientesActivos,
                    'verificaciones_esta_semana' => $verificacionesEstaSemana,
                    'modelos_nuevas' => $modelosNuevas
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo estadísticas de verificaciones (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Guardar observaciones
     */
    public function guardarObservaciones(Request $request, $id)
    {
        try {
            $request->validate([
                'observaciones' => 'required|string|max:1000'
            ]);

            $verificacion = Verificacion::findOrFail($id);
            
            // Obtener admin_id del request si no hay usuario autenticado
            $adminId = auth()->id() ?? $request->input('admin_user_id') ?? $request->header('ligand-admin-id');

            // Si la tabla tiene columna observaciones, actualizarla
            if (Schema::hasColumn('verificaciones', 'observaciones')) {
                $verificacion->update([
                    'observaciones' => $request->observaciones
                ]);
            } else {
                // Si no existe, guardar en logs o en otra tabla
                Log::info('Observaciones de verificación (admin)', [
                    'verificacion_id' => $verificacion->id,
                    'user_id' => $verificacion->user_id,
                    'admin_id' => $adminId,
                    'observaciones' => $request->observaciones
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Observaciones guardadas correctamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error guardando observaciones (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Obtener usuarios
     */
    public function getUsuarios(Request $request)
    {
        try {
            $query = User::query();

            // Filtros
            if ($request->has('rol') && $request->rol !== 'all') {
                $query->where('rol', $request->rol);
            }

            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('email', 'LIKE', "%{$search}%");
                });
            }

            $perPage = $request->get('per_page', 20);
            $users = $query->latest()->paginate($perPage);

            $formattedUsers = $users->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->rol,
                    'status' => $user->last_seen && $user->last_seen->isAfter(now()->subMinutes(5)) ? 'online' : 'offline',
                    'verified' => $user->verificacion_completa ?? false,
                    'email_verified' => $user->email_verified_at !== null,
                    'country' => $user->country ?? '🌐 No especificado',
                    'registered' => $user->created_at->format('d M'),
                    'lastAccess' => $user->last_seen ? $user->last_seen->diffForHumans() : 'Nunca'
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $formattedUsers,
                'pagination' => [
                    'current_page' => $users->currentPage(),
                    'last_page' => $users->lastPage(),
                    'per_page' => $users->perPage(),
                    'total' => $users->total()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo usuarios (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Obtener usuario específico
     */
    public function getUsuario($id)
    {
        try {
            $user = User::findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->rol,
                    'country' => $user->country,
                    'country_name' => $user->country_name,
                    'city' => $user->city,
                    'verified' => $user->verificacion_completa ?? false,
                    'email_verified' => $user->email_verified_at !== null,
                    'created_at' => $user->created_at->format('Y-m-d')
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo usuario (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Actualizar usuario
     */
    public function actualizarUsuario($id, Request $request)
    {
        try {
            $user = User::findOrFail($id);

            $validated = $request->validate([
                'name' => 'sometimes|string|max:255',
                'email' => 'sometimes|email|unique:users,email,' . $user->id,
                'country' => 'sometimes|string|max:2',
                'country_name' => 'sometimes|string|max:255',
                'city' => 'sometimes|string|max:255'
            ]);

            $user->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Usuario actualizado correctamente',
                'data' => $user->fresh()
            ]);

        } catch (\Exception $e) {
            Log::error('Error actualizando usuario (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * ADMIN: Eliminar usuario
     */
    public function eliminarUsuario(Request $request, $id)
    {
        try {
            $user = User::findOrFail($id);
            
            // Obtener admin_id del request si no hay usuario autenticado
            $adminId = auth()->id() ?? $request->input('admin_user_id') ?? $request->header('ligand-admin-id');

            DB::beginTransaction();

            // Eliminar verificaciones relacionadas
            $user->verificacion()->delete();

            // Eliminar usuario
            $user->delete();

            DB::commit();

            Log::info('Usuario eliminado (admin)', [
                'user_id' => $id,
                'admin_id' => $adminId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Usuario eliminado correctamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error eliminando usuario (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

}
