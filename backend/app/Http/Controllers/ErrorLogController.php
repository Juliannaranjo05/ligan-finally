<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ErrorLogController extends Controller
{
    /**
     * Recibir y almacenar errores del frontend
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'message' => 'required|string|max:1000',
                'stack' => 'nullable|string|max:5000',
                'name' => 'nullable|string|max:255',
                'context' => 'nullable|string|max:255',
                'url' => 'nullable|string|max:500',
                'userAgent' => 'nullable|string|max:500',
                'userId' => 'nullable|integer',
                'level' => 'nullable|string|in:error,warning,info,debug',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->user();
            $userId = $request->userId ?? $user?->id;

            // Log en Laravel
            $logContext = [
                'user_id' => $userId,
                'context' => $request->context ?? 'Unknown',
                'url' => $request->url,
                'user_agent' => $request->userAgent,
                'level' => $request->level ?? 'error',
            ];

            if ($request->level === 'error') {
                Log::error("Frontend Error: {$request->message}", $logContext);
            } elseif ($request->level === 'warning') {
                Log::warning("Frontend Warning: {$request->message}", $logContext);
            } else {
                Log::info("Frontend Log: {$request->message}", $logContext);
            }

            // Opcional: Almacenar en base de datos si existe la tabla
            // Descomentar si quieres persistir los errores en BD
            /*
            try {
                DB::table('error_logs')->insert([
                    'user_id' => $userId,
                    'message' => $request->message,
                    'stack' => $request->stack,
                    'error_name' => $request->name,
                    'context' => $request->context ?? 'Unknown',
                    'url' => $request->url,
                    'user_agent' => $request->userAgent,
                    'level' => $request->level ?? 'error',
                    'tags' => json_encode($request->tags ?? []),
                    'extra' => json_encode($request->extra ?? []),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } catch (\Exception $e) {
                // Si la tabla no existe, solo loguear
                Log::warning('Error log table does not exist', ['error' => $e->getMessage()]);
            }
            */

            return response()->json([
                'success' => true,
                'message' => 'Error logged successfully'
            ], 200);

        } catch (\Exception $e) {
            // No loguear errores de logging para evitar bucles
            return response()->json([
                'success' => false,
                'message' => 'Error processing log'
            ], 500);
        }
    }
}

