<?php
// config/epayco.php

return [
    // Credenciales de ePayco (obtener desde https://dashboard.epayco.com)
    'public_key' => env('EPAYCO_PUBLIC_KEY'),
    'private_key' => env('EPAYCO_PRIVATE_KEY'),
    'customer_id' => env('EPAYCO_CUSTOMER_ID'),
    'p_cust_id_cliente' => env('EPAYCO_P_CUST_ID_CLIENTE'),
    
    // URLs de ePayco API
    'api_url' => env('EPAYCO_API_URL', 'https://api.secure.payco.co'),
    'checkout_url' => env('EPAYCO_CHECKOUT_URL', 'https://checkout.epayco.co'),
    
    // Configuración básica
    'sandbox' => env('EPAYCO_SANDBOX', env('APP_ENV') === 'local'),
    'currency' => env('EPAYCO_CURRENCY', 'COP'),
    'country' => env('EPAYCO_COUNTRY', 'CO'),
    'lang' => env('EPAYCO_LANG', 'es'),
    'usd_to_cop_rate' => env('EPAYCO_USD_TO_COP_RATE', 4000),
    
    // Configuración de timeouts
    'timeout' => env('EPAYCO_TIMEOUT', 30),
    'max_retries' => env('EPAYCO_MAX_RETRIES', 3),
    
    // Logging
    'log_requests' => env('EPAYCO_LOG_REQUESTS', true),
    'log_responses' => env('EPAYCO_LOG_RESPONSES', true),
    
    // Métodos de pago soportados en Colombia
    'colombia' => [
        'supported_methods' => [
            'credit_card' => 'Tarjetas de Crédito',
            'debit_card' => 'Tarjetas de Débito',
            'pse' => 'PSE (Transferencia Bancaria)',
            'efecty' => 'Efecty (Efectivo)',
            'bank_transfer' => 'Transferencia Bancaria',
            'cash' => 'Pagos en Efectivo (Baloto, Gana)',
        ],
    ],
    
    // Tarjetas de prueba para sandbox
    'sandbox_config' => [
        'test_cards' => [
            'visa_approved' => [
                'number' => '4575623182290326',
                'cvv' => '123',
                'expiry' => '12/25'
            ],
            'visa_declined' => [
                'number' => '4151611527583283',
                'cvv' => '123',
                'expiry' => '12/25'
            ],
            'mastercard_approved' => [
                'number' => '5424180279791732',
                'cvv' => '123',
                'expiry' => '12/25'
            ],
        ]
    ],
    
    // Configuración de seguridad
    'security' => [
        'verify_signature' => env('EPAYCO_VERIFY_SIGNATURE', true),
        'allowed_ips' => [
            // IPs de ePayco para webhooks (solo para producción)
            '181.78.6.90',
            '181.78.6.91', 
            '181.78.6.92',
            '181.78.12.27',
            '181.78.12.28',
            '200.118.252.150',
        ],
    ],
    
    // Límites de transacciones
    'limits' => [
        'min_amount' => env('EPAYCO_MIN_AMOUNT', 1000), // COP
        'max_amount' => env('EPAYCO_MAX_AMOUNT', 20000000), // COP
    ],
];