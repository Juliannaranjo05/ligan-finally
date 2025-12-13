<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Response;


class VerificacionController extends Controller
{
    /**
     * Almacenar una nueva verificación
     */
    public function store(Request $request)
    {
        try {
            // Validar archivos con reglas mejoradas
            $validatedData = $request->validate([
                'selfie' => [
                    'required',
                    'image',
                    'mimes:jpeg,png,jpg,webp',
                    'max:5120', // 5MB
                    'dimensions:min_width=200,min_height=200,max_width=4000,max_height=4000'
                ],
                'documento' => [
                    'required', 
                    'image',
                    'mimes:jpeg,png,jpg,webp',
                    'max:5120', // 5MB
                    'dimensions:min_width=200,min_height=200,max_width=4000,max_height=4000'
                ],
                'selfie_doc' => [
                    'required',
                    'image', 
                    'mimes:jpeg,png,jpg,webp',
                    'max:5120', // 5MB
                    'dimensions:min_width=200,min_height=200,max_width=4000,max_height=4000'
                ],
                'video' => [
                    'required',
                    'file',
                    'mimetypes:video/webm,video/mp4,video/quicktime',
                    'max:102400', // 100MB para mayor flexibilidad
                    function ($attribute, $value, $fail) {
                        // Validación de tamaño mínimo
                        $sizeInMB = $value->getSize() / 1024 / 1024;
                        if ($sizeInMB < 0.5) {
                            $fail('El video debe tener al menos 0.5MB.');
                        }
                        
                        // Validación de duración aproximada (opcional)
                        $extension = $value->getClientOriginalExtension();
                        if (!in_array($extension, ['webm', 'mp4', 'mov'])) {
                            $fail('El formato de video no es válido.');
                        }
                    }
                ]
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

                // Guardar archivos con nombres únicos y seguros
                $selfie = $this->storeFileSecurely($request->file('selfie'), $userFolder, 'selfie');
                $documento = $this->storeFileSecurely($request->file('documento'), $userFolder, 'documento');
                $selfieDoc = $this->storeFileSecurely($request->file('selfie_doc'), $userFolder, 'selfie_doc');
                $video = $this->storeFileSecurely($request->file('video'), $userFolder, 'video');

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



}
