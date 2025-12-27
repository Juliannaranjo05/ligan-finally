<?php

return [
    'api_key' => env('LIVEKIT_API_KEY'),
    'api_secret' => env('LIVEKIT_API_SECRET'),
    'ws_url' => env('LIVEKIT_WS_URL'),
    'webhook_secret' => env('LIVEKIT_WEBHOOK_SECRET', null), // Opcional: para validar firma de webhooks
];

