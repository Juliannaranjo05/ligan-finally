<?php

return [

    'paths' => ['*'], // Aplica CORS a todas las rutas
    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'], // Permitir acceso desde cualquier origen para VPS

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false, // 👈 SIN cookies, esto debe estar en false
];

