<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use App\Models\UserNickname;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        $rol = $this->rol ?? $this->role ?? 'user';
        $avatar = $this->avatar;
        
        // 🔒 PRIVACIDAD: Clientes solo muestran foto si la subieron manualmente (no de Google)
        // Modelos pueden mostrar cualquier foto (incluyendo Google)
        $avatarUrl = null;
        if ($rol === 'modelo') {
            // Modelo: mostrar cualquier foto
            $avatarUrl = $this->generateAvatarUrl($avatar);
        } else if ($rol === 'cliente') {
            // Cliente: solo mostrar foto si NO es de Google (fue subida manualmente)
            if ($avatar && !$this->isGoogleAvatar($avatar)) {
                $avatarUrl = $this->generateAvatarUrl($avatar);
            }
        } else {
            // Otros roles: mostrar cualquier foto
            $avatarUrl = $this->generateAvatarUrl($avatar);
        }
        
        // 🔥 Obtener nickname propio del usuario (el que se puso a sí mismo)
        $nickname = UserNickname::where('user_id', $this->id)
            ->where('target_user_id', $this->id)
            ->first();
        $displayName = $nickname ? $nickname->nickname : $this->name;
        
        return [
            'id' => $this->id,
            'name' => $this->name,
            'nickname' => $nickname ? $nickname->nickname : null,
            'display_name' => $displayName,
            'email' => $this->email,
            'rol' => $rol,
            'email_verified_at' => $this->email_verified_at, // ✅ Campo raw para el frontend
            'email_verified' => !is_null($this->email_verified_at), // ✅ También el procesado por si acaso
            'avatar' => $avatar,
            'avatar_url' => $avatarUrl,
            'google_id' => $this->google_id, // ✅ Para detectar si se registró con Google
            'is_google_user' => !is_null($this->google_id), // ✅ Boolean para facilitar verificación en frontend
            'verificacion' => [
                'estado' => optional($this->verificacion)->estado ?? null,
            ],
            'verificacion_estado' => optional($this->verificacion)->estado ?? null, // ✅ También en el nivel raíz
            'verificacion_completa' => $this->verificacion_completa ?? false,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
    
    /**
     * Verificar si el avatar es de Google
     */
    private function isGoogleAvatar($filename)
    {
        if (!$filename) return false;
        
        return str_contains($filename, 'googleusercontent.com') || 
               str_contains($filename, 'googleapis.com') ||
               str_contains($filename, 'google.com');
    }

    /**
     * Generar URL del avatar (mismo método que ProfileSettingsController)
     */
    private function generateAvatarUrl($filename)
    {
        if (!$filename) return null;
        
        // Si es URL de Google, mantener tal como está
        if (str_contains($filename, 'googleusercontent.com') || 
            str_contains($filename, 'googleapis.com') ||
            str_contains($filename, 'google.com')) {
            return $filename;
        }
        
        // URL directa a storage (sin token, ya que Apache lo sirve)
        $avatarName = basename($filename);
        return url('/storage/avatars/' . $avatarName);
    }
}