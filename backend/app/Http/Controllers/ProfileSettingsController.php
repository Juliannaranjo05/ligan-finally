<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\UserNickname;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class ProfileSettingsController extends Controller
{
    // 🔥 FUNCIÓN PARA GENERAR URL CON TOKEN
    public function generateAvatarUrl($filename)
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

    // 📸 GESTIÓN DE FOTOS DE PERFIL
    
    /**
     * Subir foto de perfil
     */
    public function uploadPhoto(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'photo' => 'required|image|mimes:jpeg,jpg,png,webp|max:5120', // Max 5MB
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Archivo inválido. Debe ser una imagen (JPEG, PNG, WebP) menor a 5MB.',
                    'details' => $validator->errors()
                ], 400);
            }

            $user = Auth::user();
            $file = $request->file('photo');
            
            // Eliminar foto anterior si existe
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            
            // Generar nombre único
            $path = $file->storeAs('avatars', $user->id . '_' . time() . '.' . $file->getClientOriginalExtension(), 'public');
            
            Log::info('Archivo guardado correctamente', [
                'path' => $path,
                'user_id' => $user->id,
                'user_current_avatar' => $user->avatar
            ]);
            
            // Actualizar usuario
            try {
                $updateResult = $user->update([
                    'avatar' => $path,
                    'updated_at' => now()
                ]);
                
                if (!$updateResult) {
                    // Fallback: usar DB directo
                    Log::warning('Update con Eloquent falló, usando DB directo');
                    
                    $dbResult = \DB::table('users')
                        ->where('id', $user->id)
                        ->update([
                            'avatar' => $path,
                            'updated_at' => now()
                        ]);
                    
                    if ($dbResult === 0) {
                        throw new \Exception('No se pudo actualizar el usuario en la base de datos');
                    }
                }
                
            } catch (\Exception $updateError) {
                Log::error('Error en update del usuario', [
                    'error' => $updateError->getMessage(),
                    'user_id' => $user->id,
                    'path' => $path
                ]);
                
                // Eliminar archivo si no se pudo actualizar la BD
                Storage::disk('public')->delete($path);
                
                return response()->json([
                    'success' => false,
                    'error' => 'Error actualizando el perfil: ' . $updateError->getMessage()
                ], 500);
            }
            
            Log::info('Foto de perfil subida', [
                'user_id' => $user->id,
                'file_name' => $path,
                'file_size' => $file->getSize()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Foto de perfil actualizada exitosamente',
                'avatar_url' => $this->generateAvatarUrl($path), // 🔥 URL CON TOKEN
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar' => $path
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error subiendo foto de perfil: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor al subir la foto'
            ], 500);
        }
    }

    /**
     * Tomar foto desde cámara
     */
    public function takePhoto(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'photo_data' => 'required|string', // Base64 de la foto
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Datos de foto inválidos',
                    'details' => $validator->errors()
                ], 400);
            }

            $user = Auth::user();
            $photoData = $request->photo_data;
            
            // Decodificar base64
            if (preg_match('/^data:image\/(\w+);base64,/', $photoData, $type)) {
                $photoData = substr($photoData, strpos($photoData, ',') + 1);
                $type = strtolower($type[1]); // jpg, png, gif
                
                if (!in_array($type, ['jpg', 'jpeg', 'png', 'webp'])) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Formato de imagen no soportado'
                    ], 400);
                }
                
                $photoData = base64_decode($photoData);
                
                if ($photoData === false) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Error decodificando la imagen'
                    ], 400);
                }
            } else {
                return response()->json([
                    'success' => false,
                    'error' => 'Formato de datos inválido'
                ], 400);
            }
            
            // Eliminar foto anterior si existe
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            
            // Generar nombre único
            $fileName = 'avatars/' . $user->id . '_camera_' . time() . '.jpg';
            
            // Guardar imagen directamente
            Storage::disk('public')->put($fileName, $photoData);
            
            // Actualizar usuario
            $user->update([
                'avatar' => $fileName,
                'updated_at' => now()
            ]);
            
            Log::info('Foto tomada desde cámara', [
                'user_id' => $user->id,
                'file_name' => $fileName
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Foto tomada y guardada exitosamente',
                'avatar_url' => $this->generateAvatarUrl($fileName), // 🔥 URL CON TOKEN
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar' => $fileName
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error tomando foto desde cámara: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor al tomar la foto'
            ], 500);
        }
    }

    /**
     * Eliminar foto de perfil
     */
    public function deletePhoto()
    {
        try {
            $user = Auth::user();
            
            if (!$user->avatar) {
                return response()->json([
                    'success' => false,
                    'error' => 'No tienes foto de perfil para eliminar'
                ], 400);
            }
            
            // Eliminar archivo del storage
            if (Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            
            // Actualizar usuario
            $user->update([
                'avatar' => null,
                'updated_at' => now()
            ]);
            
            Log::info('Foto de perfil eliminada', [
                'user_id' => $user->id,
                'deleted_file' => $user->avatar
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Foto de perfil eliminada exitosamente',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar' => null
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error eliminando foto de perfil: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor al eliminar la foto'
            ], 500);
        }
    }

    // 👤 GESTIÓN DE APODOS
    
    /**
     * Obtener mi apodo actual
     */
    public function getMyNickname()
    {
        try {
            $user = Auth::user();
            
            $nickname = UserNickname::where('user_id', $user->id)
                ->where('target_user_id', $user->id)
                ->first();
            
            return response()->json([
                'success' => true,
                'nickname' => $nickname ? $nickname->nickname : null,
                'display_name' => $nickname ? $nickname->nickname : $user->name,
                'real_name' => $user->name
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo apodo: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Actualizar mi apodo
     */
    public function updateMyNickname(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'nickname' => 'required|string|min:1|max:8|regex:/^[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]+$/'
            ], [
                'nickname.required' => 'El apodo es obligatorio',
                'nickname.max' => 'El apodo no puede tener más de 8 caracteres',
                'nickname.regex' => 'El apodo solo puede contener letras, números y espacios'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => $validator->errors()->first(),
                    'details' => $validator->errors()
                ], 400);
            }

            $user = Auth::user();
            $nickname = trim($request->nickname);
            
            // Verificar que no esté usando su nombre real
            if (strtolower($nickname) === strtolower($user->name)) {
                return response()->json([
                    'success' => false,
                    'error' => 'El apodo no puede ser igual a tu nombre real'
                ], 400);
            }
            
            // Verificar que el apodo no esté en uso por otro usuario como nombre real
            $existingUser = User::whereRaw('LOWER(name) = LOWER(?)', [$nickname])
                ->where('id', '!=', $user->id)
                ->first();
                
            if ($existingUser) {
                return response()->json([
                    'success' => false,
                    'error' => 'Este apodo no está disponible'
                ], 400);
            }
            
            // Crear o actualizar apodo en tabla user_nicknames
            $userNickname = UserNickname::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'target_user_id' => $user->id
                ],
                [
                    'nickname' => $nickname,
                    'updated_at' => now()
                ]
            );
            
            // 🔥 ACTUALIZAR TAMBIÉN EL CAMPO name EN LA TABLA users
            // Esto hace que el apodo sea el nombre oficial visible en todos lados
            $user->update([
                'name' => $nickname,
                'updated_at' => now()
            ]);
            
            Log::info('Apodo actualizado', [
                'user_id' => $user->id,
                'old_name' => $user->getOriginal('name'),
                'new_name' => $nickname,
                'nickname_record' => $userNickname->nickname
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Apodo actualizado exitosamente',
                'nickname' => $nickname,
                'display_name' => $nickname,
                'name' => $nickname,
                'real_name' => $user->getOriginal('name') // Mantener el nombre original si lo necesitas
            ]);

        } catch (\Exception $e) {
            Log::error('Error actualizando apodo: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor al actualizar el apodo'
            ], 500);
        }
    }

    /**
     * Eliminar mi apodo
     */
    public function deleteMyNickname()
    {
        try {
            $user = Auth::user();
            
            $deleted = UserNickname::where('user_id', $user->id)
                ->where('target_user_id', $user->id)
                ->delete();
            
            if ($deleted) {
                Log::info('Apodo eliminado', [
                    'user_id' => $user->id,
                    'back_to_real_name' => $user->name
                ]);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Apodo eliminado. Ahora usas tu nombre real',
                    'display_name' => $user->name,
                    'real_name' => $user->name
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => 'No tienes un apodo configurado'
                ], 400);
            }

        } catch (\Exception $e) {
            Log::error('Error eliminando apodo: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    // 🌍 GESTIÓN DE IDIOMA PREFERIDO
    
    /**
     * Obtener idioma preferido del usuario
     */
    public function getPreferredLanguage()
    {
        try {
            $user = Auth::user();
            
            return response()->json([
                'success' => true,
                'preferred_language' => $user->preferred_language ?? 'es',
                'available_languages' => [
                    'es' => 'Español',
                    'en' => 'English',
                    'fr' => 'Français',
                    'de' => 'Deutsch',
                    'it' => 'Italiano',
                    'pt' => 'Português',
                    'ru' => 'Русский',
                    'ja' => '日本語',
                    'ko' => '한국어',
                    'zh' => '中文'
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo idioma: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Actualizar idioma preferido
     */
    public function updatePreferredLanguage(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'language' => 'required|string|in:es,en,fr,de,it,pt,ru,tr,hi'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Idioma no válido',
                    'details' => $validator->errors()
                ], 400);
            }

            $user = Auth::user();
            $language = $request->language;
            
            // Actualizar idioma preferido
            $user->update([
                'preferred_language' => $language,
                'updated_at' => now()
            ]);
            
            $languageNames = [
                'es' => 'Español',
                'en' => 'English',
                'fr' => 'Français',
                'de' => 'Deutsch',
                'it' => 'Italiano',
                'pt' => 'Português',
                'ru' => 'Русский',
                'tr' => 'Türkçe',
                'hi' => 'हिन्दी'
            ];
            
            Log::info('Idioma preferido actualizado', [
                'user_id' => $user->id,
                'new_language' => $language,
                'language_name' => $languageNames[$language] ?? $language
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Idioma actualizado exitosamente',
                'preferred_language' => $language,
                'language_name' => $languageNames[$language] ?? $language
            ]);

        } catch (\Exception $e) {
            Log::error('Error actualizando idioma: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor al actualizar el idioma'
            ], 500);
        }
    }

    // 📊 INFORMACIÓN COMPLETA DEL PERFIL
    
    /**
     * Obtener información completa del perfil
     */
    public function getProfileInfo()
    {
        try {
            $user = Auth::user();
            
            // Obtener apodo si existe
            $nickname = UserNickname::where('user_id', $user->id)
                ->where('target_user_id', $user->id)
                ->first();
            
            // 🔒 PRIVACIDAD: Clientes solo muestran foto si la subieron manualmente (no de Google)
            // Modelos pueden mostrar cualquier foto (incluyendo Google)
            $avatar = $user->avatar;
            $avatarUrl = null;
            
            if ($user->rol === 'modelo') {
                // Modelo: mostrar cualquier foto
                $avatarUrl = $this->generateAvatarUrl($avatar);
            } else if ($user->rol === 'cliente') {
                // Cliente: solo mostrar foto si NO es de Google
                if ($avatar && !$this->isGoogleAvatar($avatar)) {
                    $avatarUrl = $this->generateAvatarUrl($avatar);
                }
            } else {
                // Otros roles: mostrar cualquier foto
                $avatarUrl = $this->generateAvatarUrl($avatar);
            }
            
            return response()->json([
                'success' => true,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'nickname' => $nickname ? $nickname->nickname : null,
                    'display_name' => $nickname ? $nickname->nickname : $user->name,
                    'email' => $user->email,
                    'avatar' => $avatar,
                    'avatar_url' => $avatarUrl,
                    'preferred_language' => $user->preferred_language ?? 'es',
                    'rol' => $user->rol,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo info del perfil: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
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
}