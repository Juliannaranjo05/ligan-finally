<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
// Boot the application
$request = Illuminate\Http\Request::capture();
$response = $kernel->handle($request);

use Illuminate\Support\Facades\Http;

$ref = 'WMP1767071442521E7B19D';
$key = config('wompi.private_key');
$api = config('wompi.api_url');

try {
    $res = Http::withHeaders(['Authorization' => 'Bearer ' . $key, 'Accept' => 'application/json'])
        ->get($api . '/transactions?reference=' . urlencode($ref));
    echo 'HTTP: ' . $res->status() . PHP_EOL;
    echo json_encode($res->json(), JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . PHP_EOL;
}
