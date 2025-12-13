<?php

return [
    'password_reset' => [
        'subject' => '🔑 PASSWORD RESET',
        'greeting' => 'Hello :userName!',
        'intro' => 'We have received a request to reset your account password.',
        'action_text' => 'To reset your password, visit this link:',
        'important_title' => 'IMPORTANT:',
        'expiry_notice' => 'This link expires in 1 hour',
        'single_use' => 'Only works once',
        'ignore_notice' => 'If you did not request this, ignore this email',
        'footer' => 'This email was sent automatically.',
        'app_name' => config('app.name')
    ]
];