<?php

return [
    'password_reset' => [
        'subject' => '🔑 RESTABLECER CONTRASEÑA',
        'greeting' => '¡Hola :userName!',
        'intro' => 'Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.',
        'action_text' => 'Para restablecer tu contraseña, visita este enlace:',
        'important_title' => 'IMPORTANTE:',
        'expiry_notice' => 'Este enlace expira en 1 hora',
        'single_use' => 'Solo funciona una vez',
        'ignore_notice' => 'Si no solicitaste esto, ignora este correo',
        'footer' => 'Este correo fue enviado automáticamente.',
        'app_name' => config('app.name')
    ]
];