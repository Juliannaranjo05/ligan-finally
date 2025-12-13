<?php

// app/Mail/VerificationCodeMail.php
namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class VerificationCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public $verificationCode;
    public $userName;

    public function __construct($verificationCode, $userName)
    {
        $this->verificationCode = $verificationCode;
        $this->userName = $userName;
    }

    public function build()
    {
        return $this->subject('🔐 Código de Verificación - ' . config('app.name'))
                    ->view('emails.verification-code')
                    ->with([
                        'code' => $this->verificationCode,
                        'userName' => $this->userName,
                        'expiresIn' => '15 minutos'
                    ]);
    }
}