<?php

return [
    // Credenciales Wompi
    'public_key' => env('WOMPI_PUBLIC_KEY'),
    'private_key' => env('WOMPI_PRIVATE_KEY'),
    'integrity_secret' => env('WOMPI_INTEGRITY_SECRET'),
    
    // URLs
    'api_url' => env('WOMPI_API_URL', 'https://production.wompi.co/v1'),
    'checkout_url' => env('WOMPI_CHECKOUT_URL', 'https://checkout.wompi.co'),
    
    // Configuración
    'sandbox' => env('WOMPI_SANDBOX', false),
    'currency' => env('WOMPI_CURRENCY', 'COP'),
    'verify_webhooks' => env('WOMPI_VERIFY_WEBHOOKS', true),
    
    // Conversión USD a COP
    'usd_to_cop_rate' => env('WOMPI_USD_TO_COP_RATE', 4000),
    
    // Límites
    'limits' => [
        'min_amount' => env('WOMPI_MIN_AMOUNT', 1000),
        'max_amount' => env('WOMPI_MAX_AMOUNT', 2000000),
    ],
];