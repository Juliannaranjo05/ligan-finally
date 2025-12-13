<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

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
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'rol' => $this->rol ?? $this->role ?? 'user',
            'email_verified_at' => $this->email_verified_at, // ✅ Campo raw para el frontend
            'email_verified' => !is_null($this->email_verified_at), // ✅ También el procesado por si acaso
            'verificacion' => [
                'estado' => optional($this->verificacion)->estado ?? null,
            ],
            'verificacion_estado' => optional($this->verificacion)->estado ?? null, // ✅ También en el nivel raíz
            'verificacion_completa' => $this->verificacion_completa ?? false,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}