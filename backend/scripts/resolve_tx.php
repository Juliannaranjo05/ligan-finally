<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Illuminate\Http\Request::capture();
$response = $kernel->handle($request);

use Illuminate\Support\Facades\Auth;

// Autenticar como user id 52
Auth::loginUsingId(52);

$tx = '11662061-1767071258-37685';
$ctrl = app()->make(App\Http\Controllers\WompiController::class);
$res = $ctrl->resolveByTransactionId(new \Illuminate\Http\Request(), $tx);

echo 'HTTP: ' . $res->getStatusCode() . PHP_EOL;
echo $res->getContent() . PHP_EOL;