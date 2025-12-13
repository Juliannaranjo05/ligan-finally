<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PasswordResetLink extends Mailable
{
    use Queueable, SerializesModels;

    public $resetLink;
    public $userName;

    /**
     * Create a new message instance.
     */
    public function __construct($resetLink, $userName)
    {
        $this->resetLink = $resetLink;
        $this->userName = $userName;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('🔑 Restablecer tu contraseña')
                    ->view('emails.password-reset-link')
                    ->text('emails.password-reset-link-text')
                    ->with([
                        'resetLink' => $this->resetLink,
                        'userName' => $this->userName,
                    ]);
    }
}