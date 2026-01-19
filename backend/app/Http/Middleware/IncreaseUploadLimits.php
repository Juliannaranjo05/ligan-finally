<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class IncreaseUploadLimits
{
    /**
     * Handle an incoming request.
     * Aumenta los límites de PHP ANTES de que Laravel procese la petición
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        // Aumentar límites de PHP para permitir videos de alta calidad
        // Nota: upload_max_filesize y post_max_size solo se pueden cambiar en php.ini
        // pero podemos aumentar otros límites útiles
        ini_set('max_execution_time', '300'); // 5 minutos
        ini_set('memory_limit', '512M');
        ini_set('max_input_time', '300');
        
        return $next($request);
    }
}


