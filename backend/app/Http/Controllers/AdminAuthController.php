<?php

namespace App\Http\Controllers;

use App\Models\AdminUser;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use App\Mail\AdminCodeMail;

class AdminAuthController extends Controller
{
    public function login(Request $request)
    {
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
            'last_code' => $code, // Asumiendo que este es el campo para el código
            // 'attempts' => 0, // Si tienes este campo, descoméntalo
        ]);

        // Enviar correo
        Mail::to($user->email)->send(new AdminCodeMail($code));

        // ✅ Retornar respuesta de éxito
        return response()->json([
            'message' => 'Código enviado al correo',
            'admin_id' => $user->id,
        ]);
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

        // Código correcto: puedes borrar o marcar como verificado
        $admin->delete(); // Opcional: eliminar el registro para evitar reuso

        return response()->json(['success' => true, 'message' => 'Código correcto']);
    }
}