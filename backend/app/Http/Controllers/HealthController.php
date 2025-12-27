<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Log;

class HealthController extends Controller
{
    /**
     * Health check endpoint
     */
    public function check()
    {
        $status = 'healthy';
        $checks = [];
        $timestamp = now()->toISOString();

        // Check database
        try {
            DB::connection()->getPdo();
            $checks['database'] = 'ok';
        } catch (\Exception $e) {
            $checks['database'] = 'error';
            $status = 'unhealthy';
            Log::error('Health check: Database connection failed', ['error' => $e->getMessage()]);
        }

        // Check Redis
        try {
            Redis::connection()->ping();
            $checks['redis'] = 'ok';
        } catch (\Exception $e) {
            $checks['redis'] = 'error';
            $status = 'degraded'; // Redis no es crítico, solo degrada
            Log::warning('Health check: Redis connection failed', ['error' => $e->getMessage()]);
        }

        // Check disk space (opcional)
        $diskFree = disk_free_space(storage_path());
        $diskTotal = disk_total_space(storage_path());
        $diskPercent = ($diskTotal - $diskFree) / $diskTotal * 100;
        
        $checks['disk'] = [
            'status' => $diskPercent < 90 ? 'ok' : 'warning',
            'usage_percent' => round($diskPercent, 2)
        ];

        if ($diskPercent >= 90) {
            $status = 'degraded';
        }

        $response = [
            'status' => $status,
            'timestamp' => $timestamp,
            'checks' => $checks,
            'version' => config('app.version', '1.0.0'),
            'environment' => config('app.env')
        ];

        $httpStatus = $status === 'healthy' ? 200 : ($status === 'degraded' ? 200 : 503);

        return response()->json($response, $httpStatus);
    }
}

