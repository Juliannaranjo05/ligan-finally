<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;

class VideoCallThrottle
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        // 🎥 Detectar si está en videochat
        $isInVideoCall = $request->hasHeader('X-Video-Call-Active') || 
                        $request->input('in_video_call') || 
                        str_contains($request->getRequestUri(), 'chat/') ||
                        str_contains($request->getRequestUri(), 'heartbeat') ||
                        str_contains($request->getRequestUri(), 'profile');

        if ($isInVideoCall) {
            // 🚀 Límites relajados para videochat
            $throttle = app(ThrottleRequests::class);
            return $throttle->handle($request, $next, 300, 1); // 300 req/min
        }

        // 📍 Límites normales para otras operaciones
        $throttle = app(ThrottleRequests::class);
        return $throttle->handle($request, $next, 60, 1); // 60 req/min
    }
}