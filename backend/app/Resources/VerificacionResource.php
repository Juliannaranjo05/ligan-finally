<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VerificacionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'selfie'      => $this->selfie,
            'documento'   => $this->documento,
            'selfie_doc'  => $this->selfie_doc,
            'video'       => $this->video,
            'estado'      => $this->estado,
        ];
    }
}
