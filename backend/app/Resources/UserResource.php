<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'rol' => $this->rol,
            'email_verified_at' => $this->email_verified_at,
            'verificacion_completa' => $this->verificacion_completa,
            'verificacion' => $this->verificacion, // si quieres exponerla
        ];
    }
}
