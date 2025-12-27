<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use App\Models\User;
use App\Models\Verificacion;
use App\Models\Story;
use App\Models\WeeklyPayment;
use App\Models\VideoChatSession;
use App\Models\ChatSession;

class AdminDashboardController extends Controller
{
    /**
     * Obtener estadísticas consolidadas para el dashboard de administrador
     */
    public function getStats(Request $request)
    {
        try {
            // No requiere autenticación de usuario normal, solo admin.auth middleware
            // Usuarios activos
            $totalUsers = User::count();
            $activeModels = User::where('rol', 'modelo')
                ->where('verificacion_completa', true)
                ->where('verificacion_estado', 'aprobada')
                ->count();
            $activeClients = User::where('rol', 'cliente')
                ->where('email_verified_at', '!=', null)
                ->count();

            // Usuarios activos en las últimas 24 horas
            $activeUsers24h = User::where('last_seen', '>=', Carbon::now()->subHours(24))->count();

            // Sesiones
            $activeSessions = VideoChatSession::where('status', 'active')->count();
            $sessionsToday = VideoChatSession::whereDate('created_at', Carbon::today())->count();
            $sessionsThisWeek = VideoChatSession::whereBetween('created_at', [
                Carbon::now()->startOfWeek(),
                Carbon::now()->endOfWeek()
            ])->count();

            // Ingresos
            $revenueToday = WeeklyPayment::where('status', 'paid')
                ->whereDate('paid_at', Carbon::today())
                ->sum('amount');
            
            $revenueThisWeek = WeeklyPayment::where('status', 'paid')
                ->whereBetween('paid_at', [
                    Carbon::now()->startOfWeek(),
                    Carbon::now()->endOfWeek()
                ])
                ->sum('amount');
            
            $revenueThisMonth = WeeklyPayment::where('status', 'paid')
                ->whereMonth('paid_at', Carbon::now()->month)
                ->whereYear('paid_at', Carbon::now()->year)
                ->sum('amount');

            // Verificaciones pendientes
            $pendingVerifications = Verificacion::where('estado', 'pendiente')->count();

            // Historias pendientes
            $pendingStories = Story::where('status', 'pending')->count();

            // Pagos pendientes
            $pendingPayments = WeeklyPayment::where('status', 'pending')->count();
            $pendingPaymentsAmount = WeeklyPayment::where('status', 'pending')->sum('amount');

            // Chats activos
            $activeChats = ChatSession::where('status', 'active')->count();

            // Actividad reciente (últimas 24 horas)
            $recentActivity = [
                'new_users' => User::whereDate('created_at', Carbon::today())->count(),
                'new_sessions' => $sessionsToday,
                'new_payments' => WeeklyPayment::where('status', 'paid')
                    ->whereDate('paid_at', Carbon::today())
                    ->count(),
                'new_verifications' => Verificacion::whereDate('created_at', Carbon::today())->count()
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'users' => [
                        'total' => $totalUsers,
                        'active_models' => $activeModels,
                        'active_clients' => $activeClients,
                        'active_24h' => $activeUsers24h
                    ],
                    'sessions' => [
                        'active' => $activeSessions,
                        'today' => $sessionsToday,
                        'this_week' => $sessionsThisWeek
                    ],
                    'revenue' => [
                        'today' => round($revenueToday, 2),
                        'this_week' => round($revenueThisWeek, 2),
                        'this_month' => round($revenueThisMonth, 2)
                    ],
                    'pending' => [
                        'verifications' => $pendingVerifications,
                        'stories' => $pendingStories,
                        'payments' => [
                            'count' => $pendingPayments,
                            'amount' => round($pendingPaymentsAmount, 2)
                        ]
                    ],
                    'chats' => [
                        'active' => $activeChats
                    ],
                    'recent_activity' => $recentActivity
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo estadísticas del dashboard (admin): ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }
}
