<?php

return [

    'paths' => ['*'], // Aplica CORS a todas las rutas
    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'https://ligandome.com',
        'http://ligandome.com',
        'https://www.ligandome.com',
        'http://www.ligandome.com',
    ], // Permitir acceso desde ligandome.com

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false, // 👈 SIN cookies, esto debe estar en false
];

