<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class AdminAuthMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        try {
            // Obtener el admin_id del header o del request
            $adminId = $request->header('ligand-admin-id') 
                ?? $request->header('X-Ligand-Admin-Id')
                ?? $request->input('admin_id')
                ?? null;

            if (!$adminId) {
                Log::warning('AdminAuthMiddleware: No se encontró admin_id en la petición', [
                    'url' => $request->url(),
                    'method' => $request->method(),
                    'headers' => array_map(function($header) {
                        return is_array($header) ? $header[0] : $header;
                    }, $request->headers->all())
                ]);

                try {
                    return response()->json([
                        'success' => false,
                        'error' => 'Unauthenticated.',
                        'message' => 'Se requiere autenticación de administrador. Asegúrate de que ligand_admin_id esté en localStorage.'
                    ], 401);
                } catch (\Exception $e) {
                    Log::error('AdminAuthMiddleware: Error creando respuesta 401 (sin admin_id)', [
                        'error' => $e->getMessage()
                    ]);
                    abort(401, 'Unauthenticated.');
                }
            }

            // Verificar que el admin_id existe en la base de datos (AdminUser)
            // Convertir adminId a entero si es string numérico
            $adminIdInt = is_numeric($adminId) ? (int)$adminId : $adminId;
            $adminUser = null;
            
            try {
                $adminUser = \App\Models\AdminUser::find($adminIdInt);
                if (!$adminUser) {
                    Log::warning('AdminAuthMiddleware: Admin ID no encontrado en BD', [
                        'admin_id' => $adminId,
                        'admin_id_int' => $adminIdInt,
                        'url' => $request->url()
                    ]);

                    try {
                        return response()->json([
                            'success' => false,
                            'error' => 'Unauthenticated.',
                            'message' => 'ID de administrador inválido.'
                        ], 401);
                    } catch (\Exception $e) {
                        Log::error('AdminAuthMiddleware: Error creando respuesta 401 (admin no encontrado)', [
                            'error' => $e->getMessage()
                        ]);
                        abort(401, 'Unauthenticated.');
                    }
                }
            } catch (\Exception $e) {
                Log::error('AdminAuthMiddleware: Error verificando admin en BD', [
                    'admin_id' => $adminId,
                    'admin_id_int' => $adminIdInt,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'url' => $request->url()
                ]);

                try {
                    return response()->json([
                        'success' => false,
                        'error' => 'Unauthenticated.',
                        'message' => 'Error al verificar autenticación de administrador.'
                    ], 401);
                } catch (\Exception $responseError) {
                    Log::error('AdminAuthMiddleware: Error creando respuesta 401 (error BD)', [
                        'error' => $responseError->getMessage()
                    ]);
                    abort(401, 'Unauthenticated.');
                }
            }

            Log::info('AdminAuthMiddleware: Admin autenticado', [
                'admin_id' => $adminIdInt,
                'email' => $adminUser->email ?? 'N/A',
                'url' => $request->url()
            ]);

            // Agregar el admin_id al request para que los controladores puedan accederlo
            $request->merge(['admin_user_id' => $adminIdInt]);
            $request->headers->set('ligand-admin-id', (string)$adminIdInt);

            return $next($request);
        } catch (\Exception $e) {
            Log::error('AdminAuthMiddleware: Excepción inesperada', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'url' => $request->url()
            ]);

            try {
                return response()->json([
                    'success' => false,
                    'error' => 'Unauthenticated.',
                    'message' => 'Error de autenticación de administrador.'
                ], 401);
            } catch (\Exception $responseError) {
                Log::error('AdminAuthMiddleware: Error creando respuesta 401 (excepción general)', [
                    'error' => $responseError->getMessage()
                ]);
                abort(401, 'Unauthenticated.');
            }
        }
    }
}



