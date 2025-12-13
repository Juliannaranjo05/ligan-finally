<?php

return [
    'stateful' => env('SANCTUM_STATEFUL_DOMAINS') 
        ? explode(',', env('SANCTUM_STATEFUL_DOMAINS')) 
        : ['localhost'],

    'guard' => ['web'],
    
    'expiration' => null,
    
    'middleware' => [
        'verify_csrf_token' => App\Http\Middleware\VerifyCsrfToken::class,
        'encrypt_cookies' => App\Http\Middleware\EncryptCookies::class,
    ],
];