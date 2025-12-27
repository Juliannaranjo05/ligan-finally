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
        // Obtener el admin_id del header o del request
        $adminId = $request->header('ligand-admin-id') 
            ?? $request->header('X-Ligand-Admin-Id')
            ?? $request->input('admin_id')
            ?? null;

        if (!$adminId) {
            Log::warning('AdminAuthMiddleware: No se encontró admin_id en la petición', [
                'url' => $request->url(),
                'method' => $request->method(),
                'headers' => $request->headers->all(),
                'all_headers' => array_map(function($header) {
                    return is_array($header) ? $header[0] : $header;
                }, $request->headers->all())
            ]);

            return response()->json([
                'success' => false,
                'error' => 'No autenticado',
                'message' => 'Se requiere autenticación de administrador. Asegúrate de que ligand_admin_id esté en localStorage.'
            ], 401);
        }

        // Verificar que el admin_id existe en la sesión o en localStorage del frontend
        // Por ahora, solo verificamos que existe el header
        // En el futuro, podrías verificar contra una tabla de sesiones de admin
        
        Log::info('AdminAuthMiddleware: Admin autenticado', [
            'admin_id' => $adminId,
            'url' => $request->url()
        ]);

        // Agregar el admin_id al request para que los controladores puedan accederlo
        $request->merge(['admin_user_id' => $adminId]);
        $request->headers->set('ligand-admin-id', $adminId);

        return $next($request);
    }
}



