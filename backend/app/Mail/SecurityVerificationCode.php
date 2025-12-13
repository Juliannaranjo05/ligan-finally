<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SecurityVerificationCode extends Mailable
{
    use Queueable, SerializesModels;

    public $code;
    public $actionType;
    public $userName;

    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct($code, $actionType, $userName = null)
    {
        $this->code = $code;
        $this->actionType = $actionType;
        $this->userName = $userName;
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        $subjects = [
            'change_password' => 'Código de verificación - Cambio de contraseña',
            'logout_all' => 'Código de verificación - Cerrar todas las sesiones',
            'delete_account' => 'Código de verificación - Eliminar cuenta'
        ];

        $actionTitles = [
            'change_password' => 'Cambiar tu contraseña',
            'logout_all' => 'Cerrar todas las sesiones',
            'delete_account' => 'Eliminar tu cuenta'
        ];

        $subject = $subjects[$this->actionType] ?? 'Código de verificación de seguridad';
        $actionTitle = $actionTitles[$this->actionType] ?? 'realizar una acción de seguridad';

        return $this->subject($subject)
                    ->view('emails.security-verification')
                    ->with([
                        'code' => $this->code,
                        'actionType' => $this->actionType,
                        'actionTitle' => $actionTitle,
                        'userName' => $this->userName
                    ]);
    }
}