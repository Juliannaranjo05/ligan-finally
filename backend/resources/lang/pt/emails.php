<?php

return [
    'password_reset' => [
        'subject' => '🔑 REDEFINIR SENHA',
        'greeting' => 'Olá :userName!',
        'intro' => 'Recebemos uma solicitação para redefinir a senha da sua conta.',
        'action_text' => 'Para redefinir sua senha, visite este link:',
        'important_title' => 'IMPORTANTE:',
        'expiry_notice' => 'Este link expira em 1 hora',
        'single_use' => 'Funciona apenas uma vez',
        'ignore_notice' => 'Se você não solicitou isso, ignore este email',
        'footer' => 'Este email foi enviado automaticamente.',
        'app_name' => config('app.name')
    ]
];