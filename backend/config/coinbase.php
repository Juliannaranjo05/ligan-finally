<?php

// ===== CONFIGURACIÓN (config/coinbase.php) =====

return [
    /*
    |--------------------------------------------------------------------------
    | Coinbase Commerce Configuration
    |--------------------------------------------------------------------------
    */

    // API Configuration
    'api_key' => env('COINBASE_API_KEY'),
    'webhook_secret' => env('COINBASE_WEBHOOK_SECRET'),
    
    // URLs
    'api_url' => env('COINBASE_API_URL', 'https://api.commerce.coinbase.com'),
    'checkout_url' => env('COINBASE_CHECKOUT_URL', 'https://commerce.coinbase.com'),
    
    // Environment
    'sandbox' => env('COINBASE_SANDBOX', false),
    'environment' => env('APP_ENV', 'production'),
    
    // Currency
    'currency' => env('COINBASE_CURRENCY', 'USD'),
    
    // Security
    'verify_webhooks' => env('COINBASE_VERIFY_WEBHOOKS', true),
    
    // Limits
    'limits' => [
        'min_amount' => env('COINBASE_MIN_AMOUNT', 1.00),
        'max_amount' => env('COINBASE_MAX_AMOUNT', 10000.00),
        'max_attempts_per_hour' => env('COINBASE_MAX_ATTEMPTS_HOUR', 5),
        'max_attempts_per_ip' => env('COINBASE_MAX_ATTEMPTS_IP', 15),
    ],
    
    // Supported Cryptocurrencies
    'supported_currencies' => [
        'BTC' => 'Bitcoin',
        'ETH' => 'Ethereum', 
        'LTC' => 'Litecoin',
        'BCH' => 'Bitcoin Cash',
        'USDC' => 'USD Coin',
        'DAI' => 'Dai',
        'DOGE' => 'Dogecoin',
        'USDT' => 'Tether',
        'WETH' => 'Wrapped Ethereum',
        'SHIB' => 'Shiba Inu',
        'UNI' => 'Uniswap',
        'LINK' => 'Chainlink',
        'APE' => 'ApeCoin',
    ],
    
    // Features
    'features' => [
        'instant_confirmation' => true,
        'auto_convert_to_usdc' => true,
        'multi_currency_support' => true,
        'global_coverage' => true,
        'mobile_optimized' => true,
    ],

    'redirect_urls' => [
        'success' => env('PAYMENT_SUCCESS_URL', env('APP_FRONTEND_URL') . '/payment-success'),
        'cancel' => env('PAYMENT_CANCEL_URL', env('APP_FRONTEND_URL') . '/payment-cancel'),
    ],
    
    // Logging
    'log_level' => env('COINBASE_LOG_LEVEL', 'info'),
    'log_channel' => env('COINBASE_LOG_CHANNEL', 'default'),
];

?>