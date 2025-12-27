<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\VideoChatSession;
use App\Models\ChatSession;
use App\Models\SessionEarning;

class AdminSessionController extends Controller
{
    /**
     * Listar sesiones con filtros (para administradores)
     */
    public function index(Request $request)
    {
        try {
            // No requiere autenticación de usuario normal, solo admin.auth middleware
            $query = VideoChatSession::with(['user:id,name,email,rol']);

            // Filtros
            if ($request->has('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            if ($request->has('user_id')) {
                $query->where('user_id', $request->user_id);
            }

            if ($request->has('user_role') && $request->user_role !== 'all') {
                $query->where('user_role', $request->user_role);
            }

            if ($request->has('date_from')) {
                $query->whereDate('created_at', '>=', $request->date_from);
            }

            if ($request->has('date_to')) {
                $query->whereDate('created_at', '<=', $request->date_to);
            }

            // Ordenar por más recientes
            $query->orderBy('created_at', 'desc');

            // Paginación
            $perPage = $request->get('per_page', 20);
            $sessions = $query->paginate($perPage);

            // Formatear datos
            $formattedSessions = $sessions->map(function ($session) {
                // Obtener la sesión de chat relacionada si existe
                $chatSession = ChatSession::where('room_name', $session->room_name)->first();
                
                // Obtener ganancias de la sesión si existe
                $earning = SessionEarning::where('session_id', $session->id)->first();

                return [
                    'id' => $session->id,
                    'room_name' => $session->room_name,
                    'user_id' => $session->user_id,
                    'user_name' => $session->user->name ?? 'Usuario eliminado',
                    'user_email' => $session->user->email ?? 'N/A',
                    'user_role' => $session->user_role,
                    'status' => $session->status,
                    'duration_seconds' => $session->actual_duration_seconds ?? 0,
                    'duration_formatted' => $this->formatDuration($session->actual_duration_seconds ?? 0),
                    'duration_minutes' => round(($session->actual_duration_seconds ?? 0) / 60, 2),
                    'coins_consumed' => $session->total_consumed ?? 0,
                    'model_earnings' => $earning ? round($earning->model_total_earnings ?? 0, 2) : 0,
                    'started_at' => $session->started_at ? $session->started_at->format('Y-m-d H:i:s') : null,
                    'ended_at' => $session->ended_at ? $session->ended_at->format('Y-m-d H:i:s') : null,
                    'end_reason' => $session->end_reason,
                    'is_consuming' => $session->is_consuming,
                    'chat_session_id' => $chatSession ? $chatSession->id : null,
                    'cliente_id' => $chatSession ? $chatSession->cliente_id : null,
                    'modelo_id' => $chatSession ? $chatSession->modelo_id : null
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $formattedSessions,
                'pagination' => [
                    'current_page' => $sessions->currentPage(),
                    'last_page' => $sessions->lastPage(),
                    'per_page' => $sessions->perPage(),
                    'total' => $sessions->total()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo sesiones (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Obtener detalles de una sesión específica
     */
    public function show($id)
    {
        try {
            $session = VideoChatSession::with(['user:id,name,email,rol'])->findOrFail($id);
            
            // Obtener sesión de chat relacionada
            $chatSession = ChatSession::where('room_name', $session->room_name)->first();
            
            // Obtener ganancias
            $earning = SessionEarning::where('session_id', $session->id)->first();

            // Obtener cliente y modelo si existe chat session
            $cliente = $chatSession && $chatSession->cliente_id ? 
                \App\Models\User::find($chatSession->cliente_id) : null;
            $modelo = $chatSession && $chatSession->modelo_id ? 
                \App\Models\User::find($chatSession->modelo_id) : null;

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $session->id,
                    'room_name' => $session->room_name,
                    'user_id' => $session->user_id,
                    'user_name' => $session->user->name ?? 'Usuario eliminado',
                    'user_email' => $session->user->email ?? 'N/A',
                    'user_role' => $session->user_role,
                    'status' => $session->status,
                    'duration_seconds' => $session->actual_duration_seconds ?? 0,
                    'duration_formatted' => $this->formatDuration($session->actual_duration_seconds ?? 0),
                    'duration_minutes' => round(($session->actual_duration_seconds ?? 0) / 60, 2),
                    'coins_consumed' => $session->total_consumed ?? 0,
                    'consumption_rate' => $session->consumption_rate ?? 0,
                    'is_consuming' => $session->is_consuming,
                    'is_manual_duration' => $session->is_manual_duration ?? false,
                    'started_at' => $session->started_at ? $session->started_at->format('Y-m-d H:i:s') : null,
                    'ended_at' => $session->ended_at ? $session->ended_at->format('Y-m-d H:i:s') : null,
                    'end_reason' => $session->end_reason,
                    'chat_session' => $chatSession ? [
                        'id' => $chatSession->id,
                        'cliente_id' => $chatSession->cliente_id,
                        'modelo_id' => $chatSession->modelo_id,
                        'cliente_name' => $cliente ? $cliente->name : null,
                        'modelo_name' => $modelo ? $modelo->name : null,
                        'status' => $chatSession->status
                    ] : null,
                    'earning' => $earning ? [
                        'id' => $earning->id,
                        'model_earnings' => round($earning->model_total_earnings ?? 0, 2),
                        'time_earnings' => round($earning->model_time_earnings ?? 0, 2),
                        'gift_earnings' => round($earning->model_gift_earnings ?? 0, 2),
                        'qualifying_session' => $earning->qualifying_session ?? false
                    ] : null
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo detalles de sesión (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de sesiones
     */
    public function getStats(Request $request)
    {
        try {
            // Filtro de fecha opcional
            $dateFrom = $request->get('date_from', Carbon::now()->startOfDay());
            $dateTo = $request->get('date_to', Carbon::now()->endOfDay());

            // Sesiones activas
            $activeSessions = VideoChatSession::where('status', 'active')->count();

            // Sesiones hoy
            $sessionsToday = VideoChatSession::whereDate('created_at', Carbon::today())->count();

            // Sesiones esta semana
            $sessionsThisWeek = VideoChatSession::whereBetween('created_at', [
                Carbon::now()->startOfWeek(),
                Carbon::now()->endOfWeek()
            ])->count();

            // Sesiones este mes
            $sessionsThisMonth = VideoChatSession::whereMonth('created_at', Carbon::now()->month)
                ->whereYear('created_at', Carbon::now()->year)
                ->count();

            // Duración promedio
            $avgDuration = VideoChatSession::whereNotNull('actual_duration_seconds')
                ->whereBetween('created_at', [$dateFrom, $dateTo])
                ->avg('actual_duration_seconds');

            // Total de minutos de sesiones
            $totalMinutes = VideoChatSession::whereNotNull('actual_duration_seconds')
                ->whereBetween('created_at', [$dateFrom, $dateTo])
                ->sum(DB::raw('actual_duration_seconds / 60'));

            // Total de monedas consumidas
            $totalCoinsConsumed = VideoChatSession::whereBetween('created_at', [$dateFrom, $dateTo])
                ->sum('total_consumed');

            // Total de ganancias generadas
            $totalEarnings = SessionEarning::whereBetween('session_started_at', [$dateFrom, $dateTo])
                ->sum('model_total_earnings');

            // Sesiones por rol
            $sessionsByRole = VideoChatSession::whereBetween('created_at', [$dateFrom, $dateTo])
                ->select('user_role', DB::raw('count(*) as count'))
                ->groupBy('user_role')
                ->get()
                ->pluck('count', 'user_role');

            return response()->json([
                'success' => true,
                'data' => [
                    'active' => [
                        'count' => $activeSessions
                    ],
                    'today' => [
                        'count' => $sessionsToday
                    ],
                    'this_week' => [
                        'count' => $sessionsThisWeek
                    ],
                    'this_month' => [
                        'count' => $sessionsThisMonth
                    ],
                    'duration' => [
                        'average_seconds' => round($avgDuration ?? 0, 2),
                        'average_minutes' => round(($avgDuration ?? 0) / 60, 2),
                        'average_formatted' => $this->formatDuration($avgDuration ?? 0),
                        'total_minutes' => round($totalMinutes ?? 0, 2)
                    ],
                    'revenue' => [
                        'total_coins_consumed' => round($totalCoinsConsumed ?? 0, 2),
                        'total_earnings' => round($totalEarnings ?? 0, 2)
                    ],
                    'by_role' => [
                        'modelo' => $sessionsByRole['modelo'] ?? 0,
                        'cliente' => $sessionsByRole['cliente'] ?? 0
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo estadísticas de sesiones (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Formatear duración en segundos a formato legible
     */
    private function formatDuration($seconds)
    {
        if (!$seconds || $seconds < 0) {
            return '00:00';
        }

        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = $seconds % 60;

        if ($hours > 0) {
            return sprintf('%02d:%02d:%02d', $hours, $minutes, $secs);
        }

        return sprintf('%02d:%02d', $minutes, $secs);
    }
}
