<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class VideoChatLogger
{
    const LOG_FILE = 'videochat_modelo_debug.log';
    
    /**
     * Escribe un log detallado para videollamadas de modelo
     */
    public static function log(string $context, string $message, array $data = [], string $level = 'info')
    {
        $timestamp = now()->format('Y-m-d H:i:s.u');
        $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 3);
        $caller = '';
        
        if (isset($trace[1])) {
            $file = basename($trace[1]['file'] ?? 'unknown');
            $line = $trace[1]['line'] ?? 0;
            $function = $trace[1]['function'] ?? 'unknown';
            $class = $trace[1]['class'] ?? '';
            $caller = $class ? "{$class}::{$function}" : $function;
            $caller = "[{$file}:{$line}] {$caller}";
        }
        
        $logEntry = [
            'timestamp' => $timestamp,
            'level' => strtoupper($level),
            'context' => $context,
            'message' => $message,
            'caller' => $caller,
            'data' => $data,
            'memory' => memory_get_usage(true),
            'memory_peak' => memory_get_peak_usage(true),
        ];
        
        // Log a Laravel log
        $logMessage = "🎥 [VIDEOCHAT-MODELO] [{$context}] {$message}";
        $fullMessage = "{$logMessage}\n" . json_encode($logEntry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        switch (strtolower($level)) {
            case 'error':
                Log::error($fullMessage);
                break;
            case 'warning':
                Log::warning($fullMessage);
                break;
            case 'debug':
                Log::debug($fullMessage);
                break;
            default:
                Log::info($fullMessage);
        }
        
        // También escribir a archivo específico
        try {
            $logLine = "{$timestamp} [{$level}] [{$context}] {$message} | " . json_encode($data, JSON_UNESCAPED_UNICODE) . " | {$caller}\n";
            Storage::append(self::LOG_FILE, $logLine);
        } catch (\Exception $e) {
            // Si no se puede escribir al archivo, continuar con Laravel log
            Log::warning("No se pudo escribir al archivo de log de videollamadas: " . $e->getMessage());
        }
    }
    
    /**
     * Log de inicio de proceso
     */
    public static function start(string $context, string $message, array $data = [])
    {
        self::log($context, "▶️ INICIO: {$message}", $data, 'info');
    }
    
    /**
     * Log de fin de proceso
     */
    public static function end(string $context, string $message, array $data = [])
    {
        self::log($context, "✅ FIN: {$message}", $data, 'info');
    }
    
    /**
     * Log de error
     */
    public static function error(string $context, string $message, array $data = [], \Exception $exception = null)
    {
        $errorData = $data;
        if ($exception) {
            $errorData['exception'] = [
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString(),
            ];
        }
        self::log($context, "❌ ERROR: {$message}", $errorData, 'error');
    }
    
    /**
     * Log de advertencia
     */
    public static function warning(string $context, string $message, array $data = [])
    {
        self::log($context, "⚠️ WARNING: {$message}", $data, 'warning');
    }
    
    /**
     * Log de debug
     */
    public static function debug(string $context, string $message, array $data = [])
    {
        self::log($context, "🔍 DEBUG: {$message}", $data, 'debug');
    }
    
    /**
     * Log de datos de request
     */
    public static function request(string $context, \Illuminate\Http\Request $request, array $additionalData = [])
    {
        $data = [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'path' => $request->path(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'headers' => $request->headers->all(),
            'all_data' => $request->all(),
            'user_id' => auth()->id(),
            'user_role' => auth()->user()?->rol,
        ];
        
        $data = array_merge($data, $additionalData);
        
        self::log($context, "📥 REQUEST recibido", $data, 'info');
    }
    
    /**
     * Log de datos de response
     */
    public static function response(string $context, $response, array $additionalData = [])
    {
        $data = [
            'status_code' => $response->status(),
            'content_type' => $response->headers->get('Content-Type'),
        ];
        
        // Intentar obtener el contenido si es JSON
        try {
            $content = $response->getContent();
            $json = json_decode($content, true);
            if ($json !== null) {
                $data['response_data'] = $json;
            } else {
                $data['response_preview'] = substr($content, 0, 500);
            }
        } catch (\Exception $e) {
            $data['response_error'] = $e->getMessage();
        }
        
        $data = array_merge($data, $additionalData);
        
        self::log($context, "📤 RESPONSE enviado", $data, 'info');
    }
}





