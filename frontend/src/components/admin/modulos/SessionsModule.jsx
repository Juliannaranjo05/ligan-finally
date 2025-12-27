import React, { useState, useEffect } from "react";
import {
  Video,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Eye,
  Coins,
  XCircle
} from "lucide-react";
import { sessionsAdminApi, adminUtils } from "../../../services/adminApiService";

const SessionsModule = () => {
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  
  // Estados para datos
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState({
    active: { count: 0 },
    today: { count: 0 },
    this_week: { count: 0 },
    this_month: { count: 0 },
    duration: {
      average_seconds: 0,
      average_minutes: 0,
      average_formatted: '00:00',
      total_minutes: 0
    },
    revenue: {
      total_coins_consumed: 0,
      total_earnings: 0
    },
    by_role: {
      modelo: 0,
      cliente: 0
    }
  });

  // Modal para ver detalles
  const [modalDetails, setModalDetails] = useState({
    isOpen: false,
    loading: false,
    session: null
  });

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
    cargarEstadisticas();
  }, [statusFilter, roleFilter, dateFilter]);

  const getDateRange = () => {
    const today = new Date();
    switch (dateFilter) {
      case 'today':
        return {
          date_from: today.toISOString().split('T')[0],
          date_to: today.toISOString().split('T')[0]
        };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return {
          date_from: weekStart.toISOString().split('T')[0],
          date_to: today.toISOString().split('T')[0]
        };
      case 'month':
        return {
          date_from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
          date_to: today.toISOString().split('T')[0]
        };
      default:
        return {};
    }
  };

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const dateRange = getDateRange();
      const filters = {
        status: statusFilter,
        user_role: roleFilter,
        ...dateRange,
        page: 1,
        per_page: 20
      };

      const response = await sessionsAdminApi.getSessions(filters);

      if (response.success) {
        setSessions(response.data || []);
        setPagination(response.pagination);
      }

    } catch (error) {
      setError(adminUtils.manejarError(error));
    } finally {
      setLoading(false);
    }
  };

  const cargarEstadisticas = async () => {
    setStatsLoading(true);
    
    try {
      const dateRange = getDateRange();
      const response = await sessionsAdminApi.getStats(dateRange);

      if (response.success) {
        setStats(response.data);
      }

    } catch (error) {
    } finally {
      setStatsLoading(false);
    }
  };

  const handleViewDetails = async (sessionId) => {
    setModalDetails({
      isOpen: true,
      loading: true,
      session: null
    });

    try {
      const response = await sessionsAdminApi.getSessionDetails(sessionId);
      if (response.success) {
        setModalDetails(prev => ({
          ...prev,
          loading: false,
          session: response.data
        }));
      }
    } catch (error) {
      setModalDetails(prev => ({
        ...prev,
        loading: false
      }));
      alert(`❌ Error: ${adminUtils.manejarError(error)}`);
    }
  };

  // Filtrar sesiones según búsqueda
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      session.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.room_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading && statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        <span className="ml-3 text-gray-400">Cargando sesiones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-purple-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Sesiones Activas</p>
              <p className="text-2xl font-bold text-purple-300">{stats.active.count}</p>
              <p className="text-gray-500 text-xs mt-1">En este momento</p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Video className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Sesiones Hoy</p>
              <p className="text-2xl font-bold text-blue-300">{stats.today.count}</p>
              <p className="text-gray-500 text-xs mt-1">Total del día</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-yellow-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Duración Promedio</p>
              <p className="text-2xl font-bold text-yellow-300">{stats.duration.average_formatted}</p>
              <p className="text-gray-500 text-xs mt-1">{stats.duration.average_minutes.toFixed(1)} minutos</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-green-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Ganancias Totales</p>
              <p className="text-2xl font-bold text-green-300">
                ${stats.revenue.total_earnings.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {stats.revenue.total_coins_consumed.toLocaleString()} monedas
              </p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button 
            onClick={cargarDatos}
            className="ml-auto text-red-300 hover:text-red-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-purple-500/20 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por usuario, email o sala..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700/50 text-gray-300 pl-10 pr-4 py-2 rounded-lg border border-gray-600/50 placeholder-gray-500 focus:border-purple-500/50 focus:outline-none text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-700/50 text-gray-300 pl-10 pr-4 py-2 rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none text-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="ended">Finalizadas</option>
            </select>
          </div>
          <div className="relative">
            <Users className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-gray-700/50 text-gray-300 pl-10 pr-4 py-2 rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none text-sm"
            >
              <option value="all">Todos los roles</option>
              <option value="modelo">Modelo</option>
              <option value="cliente">Cliente</option>
            </select>
          </div>
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-gray-700/50 text-gray-300 pl-10 pr-4 py-2 rounded-lg border border-gray-600/50 focus:border-purple-500/50 focus:outline-none text-sm"
            >
              <option value="today">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
              <option value="all">Todas</option>
            </select>
          </div>
          <button 
            onClick={cargarDatos}
            className="text-purple-400 hover:text-purple-300 p-2 rounded-lg hover:bg-purple-500/10"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de Sesiones */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-purple-500/20">
        <div className="p-6 border-b border-gray-700/50">
          <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
            <Video className="w-5 h-5" />
            Sesiones de Videochat
            <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-sm">
              {filteredSessions.length}
            </span>
          </h3>
        </div>
        <div className="p-6">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <Video className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">
                {searchTerm ? 'No se encontraron sesiones con ese criterio' : 'No hay sesiones disponibles'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700/50">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Usuario</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Rol</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Sala</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Estado</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Duración</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Monedas</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Ganancias</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Fecha</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session) => (
                      <tr key={session.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {session.user_name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <div className="text-gray-300 font-medium">{session.user_name || 'Sin nombre'}</div>
                              <div className="text-gray-500 text-xs">{session.user_email || 'Sin email'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs capitalize ${
                            session.user_role === 'modelo' 
                              ? 'bg-pink-500/20 text-pink-300' 
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {session.user_role || 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-400 font-mono text-sm">{session.room_name || 'N/A'}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            session.status === 'active' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {session.status === 'active' ? 'Activa' : 'Finalizada'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-300">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {session.duration_formatted || '00:00'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {session.duration_minutes?.toFixed(1) || '0'} min
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 text-yellow-300">
                            <Coins className="w-3 h-3" />
                            {session.coins_consumed?.toLocaleString() || '0'}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-green-300 font-semibold">
                            ${session.model_earnings?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0.00'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-400 text-sm">
                          {session.started_at ? new Date(session.started_at).toLocaleDateString('es-ES') : 'N/A'}
                        </td>
                        <td className="py-4 px-4">
                          <button 
                            onClick={() => handleViewDetails(session.id)}
                            className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg text-sm hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Ver Detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles */}
      {modalDetails.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-3xl max-h-[90vh] w-full mx-4 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Video className="w-5 h-5" />
                Detalles de Sesión
              </h3>
              <button
                onClick={() => setModalDetails({ isOpen: false, loading: false, session: null })}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {modalDetails.loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
                  <span className="ml-3 text-gray-400">Cargando detalles...</span>
                </div>
              ) : modalDetails.session ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Usuario</p>
                      <p className="text-white font-medium">{modalDetails.session.user_name || 'N/A'}</p>
                      <p className="text-gray-500 text-xs">{modalDetails.session.user_email || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Rol</p>
                      <p className="text-white font-medium capitalize">{modalDetails.session.user_role || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Sala</p>
                      <p className="text-white font-mono text-sm">{modalDetails.session.room_name || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Estado</p>
                      <p className="text-white font-medium capitalize">{modalDetails.session.status || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Duración</p>
                      <p className="text-white font-medium">{modalDetails.session.duration_formatted || '00:00'}</p>
                      <p className="text-gray-500 text-xs">{modalDetails.session.duration_minutes?.toFixed(1) || '0'} minutos</p>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <p className="text-gray-400 text-sm">Monedas Consumidas</p>
                      <p className="text-yellow-300 font-medium">{modalDetails.session.coins_consumed?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                  
                  {modalDetails.session.earning && (
                    <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                      <h4 className="text-green-300 font-medium mb-3">Ganancias</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-gray-400 text-xs">Total</p>
                          <p className="text-green-300 font-semibold">
                            ${modalDetails.session.earning.model_earnings?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0.00'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Por Tiempo</p>
                          <p className="text-blue-300">
                            ${modalDetails.session.earning.time_earnings?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0.00'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Por Regalos</p>
                          <p className="text-pink-300">
                            ${modalDetails.session.earning.gift_earnings?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm mb-2">Fechas</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-300">
                        <span className="text-gray-500">Inicio:</span> {modalDetails.session.started_at ? new Date(modalDetails.session.started_at).toLocaleString('es-ES') : 'N/A'}
                      </p>
                      <p className="text-gray-300">
                        <span className="text-gray-500">Fin:</span> {modalDetails.session.ended_at ? new Date(modalDetails.session.ended_at).toLocaleString('es-ES') : 'N/A'}
                      </p>
                      {modalDetails.session.end_reason && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Razón:</span> {modalDetails.session.end_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-400">Error al cargar los detalles</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsModule;
