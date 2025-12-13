<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ObservacionesVerificacionMail extends Mailable
{
    public $userName;
    public $observaciones;

    public function __construct($userName, $observaciones)
    {
        $this->userName = $userName;
        $this->observaciones = $observaciones;
    }

    public function build()
    {
        return $this->subject('Observaciones sobre tu verificación')
                    ->view('emails.observaciones-verificacion')
                    ->with([
                        'userName' => $this->userName,
                        'observaciones' => $this->observaciones
                    ]);
    }
}