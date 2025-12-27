<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PasswordSetupLink extends Mailable
{
    use Queueable, SerializesModels;

    public $setupLink;
    public $userName;

    /**
     * Create a new message instance.
     */
    public function __construct($setupLink, $userName)
    {
        $this->setupLink = $setupLink;
        $this->userName = $userName;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('🔑 Establecer tu contraseña')
                    ->view('emails.password-setup-link')
                    ->text('emails.password-setup-link-text')
                    ->with([
                        'setupLink' => $this->setupLink,
                        'userName' => $this->userName,
                    ]);
    }
}





