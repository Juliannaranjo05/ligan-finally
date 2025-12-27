<?php

namespace App\Http\Controllers;

use App\Models\AdminUser;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use App\Mail\AdminCodeMail;
use Illuminate\Support\Facades\Log;

class AdminAuthController extends Controller
{
    public function login(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required',
            ]);

            // Intentamos autenticar
            $user = AdminUser::where('email', $request->email)->first();

            if (!$user) {
                return response()->json(['message' => 'Usuario no encontrado'], 404);
            }

            if (!Hash::check($request->password, $user->password)) {
                return response()->json(['message' => 'Contraseña incorrecta'], 401);
            }

            // Generar nuevo código
            $code = random_int(100000, 999999);

            // Actualizar el usuario existente con el nuevo código
            $user->update([
                'last_code' => $code,
                'attempts' => 0,
            ]);

            // Enviar correo, pero sin romper si falla el SMTP
            try {
                Mail::to($user->email)->send(new AdminCodeMail($code));
            } catch (\Throwable $mailException) {
                Log::error('Error enviando correo de código admin', [
                    'admin_id' => $user->id,
                    'email' => $user->email,
                    'error' => $mailException->getMessage(),
                ]);
            }

            $response = [
                'message' => 'Código generado. Si el correo está configurado, se ha enviado al email.',
                'admin_id' => $user->id,
                'success' => true,
            ];

            // En entornos no productivos, exponer el código para facilitar pruebas
            if (!app()->environment('production')) {
                $response['debug_code'] = $code;
            }

            // ✅ Retornar respuesta de éxito
            return response()->json($response);
        } catch (\Throwable $e) {
            Log::error('Error en login de administrador', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor. Por favor, revisa los logs para más detalles.',
            ], 500);
        }
    }
    public function verifyCode(Request $request)
    {
        $request->validate([
            'code' => 'required|string|max:6',
        ]);

        $adminId = $request->header('ligand-admin-id') ?? $request->admin_id ?? null;

        if (!$adminId) {
            return response()->json(['message' => 'ID de administrador no proporcionado'], 400);
        }

        $admin = AdminUser::find($adminId);

        if (!$admin) {
            return response()->json(['message' => 'Administrador no encontrado'], 404);
        }

        // Si excedió intentos
        if ($admin->attempts >= 3) {
            return response()->json(['message' => 'Demasiados intentos fallidos'], 403);
        }

        // Verificar código
        if ($admin->last_code !== $request->code) {
            $admin->increment('attempts');
            return response()->json(['success' => false, 'message' => 'Código incorrecto'], 401);
        }

        // Código correcto: limpiar el código usado y resetear intentos
        $admin->update([
            'last_code' => null,
            'attempts' => 0,
        ]);

        return response()->json([
            'success' => true, 
            'message' => 'Código correcto',
            'admin_id' => $admin->id,
        ]);
    }
}