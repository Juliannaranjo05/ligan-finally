import React, { useState, useEffect } from 'react';
import { 
  Coins, // 🔥 CAMBIO: Clock -> Coins
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Calendar,
  CreditCard,
  DollarSign,
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  ExternalLink,
  Gift,
  Star,
  X,
  Clock, // 🔥 MANTENER: Para equivalencia de tiempo
  Zap
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function CoinsPurchaseHistory({ 
  showHeader = true, 
  maxItems = null,
  compact = false,
  showFilters = true,
  showPagination = true,
  onPurchaseClick = null
}) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchPurchases = async (page = 1, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      // 🔥 CAMBIO: Nueva URL para historial de monedas
      const response = await fetch(
        `${API_BASE_URL}/api/stripe-coins/history?page=${page}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Error al obtener historial`);
      }

      const data = await response.json();
      
      if (data.success) {
        const purchaseData = data.purchases?.data || data.purchases || [];
        setPurchases(maxItems ? purchaseData.slice(0, maxItems) : purchaseData);
        
        if (data.purchases?.current_page) {
          setPagination({
            current_page: data.purchases.current_page,
            last_page: data.purchases.last_page,
            per_page: data.purchases.per_page,
            total: data.purchases.total,
            from: data.purchases.from,
            to: data.purchases.to
          });
        }
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPurchases(currentPage);
  }, [currentPage, maxItems]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPurchases(currentPage, false);
  };

  // 🔥 NUEVA FUNCIÓN: Formatear monedas
  const formatCoins = (coins) => {
    return coins ? `${coins.toLocaleString()}` : '0';
  };

  // 🔥 NUEVA FUNCIÓN: Calcular minutos equivalentes
  const formatMinutesFromCoins = (coins, costPerMinute = 10) => {
    const minutes = Math.floor(coins / costPerMinute);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusConfig = (status) => {
    const configs = {
      completed: {
        icon: CheckCircle,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        text: 'Completado',
        description: 'Pago procesado exitosamente'
      },
      pending: {
        icon: Clock,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        text: 'Pendiente',
        description: 'Procesando pago...'
      },
      failed: {
        icon: XCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        text: 'Fallida',
        description: 'Error en el procesamiento'
      },
      cancelled: {
        icon: XCircle,
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500/30',
        text: 'Cancelada',
        description: 'Cancelada por el usuario'
      },
      refunded: {
        icon: RefreshCw,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        text: 'Reembolsada',
        description: 'Dinero devuelto'
      }
    };
    return configs[status] || configs.pending;
  };

  const getPaymentMethodInfo = (method) => {
    const methods = {
      sandbox: { text: 'Sandbox (Prueba)', color: 'text-orange-400', icon: '🧪' },
      stripe: { text: 'Tarjeta de Crédito', color: 'text-blue-400', icon: '💳' },
      paypal: { text: 'PayPal', color: 'text-blue-600', icon: '🅿️' },
      credit_card: { text: 'Tarjeta', color: 'text-purple-400', icon: '💳' }
    };
    return methods[method] || { text: method, color: 'text-gray-400', icon: '❓' };
  };

  const filteredPurchases = purchases.filter(purchase => {
    const matchesFilter = filter === 'all' || purchase.status === filter;
    const matchesSearch = searchTerm === '' || 
      purchase.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.package?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const exportToCSV = () => {
    // 🔥 CAMBIO: Actualizar headers para monedas
    const headers = [
      'Fecha', 
      'Paquete', 
      'Monedas', 
      'Monedas Bonus', 
      'Total Monedas', 
      'Minutos Equivalentes',
      'Monto', 
      'Estado', 
      'Método de Pago', 
      'ID Transacción'
    ];
    
    const csvData = filteredPurchases.map(purchase => [
      new Date(purchase.created_at).toLocaleDateString(),
      purchase.package?.name || 'N/A',
      purchase.coins || 0,
      purchase.bonus_coins || 0,
      purchase.total_coins || 0,
      formatMinutesFromCoins(purchase.total_coins || 0),
      `$${purchase.amount}`,
      purchase.status,
      purchase.payment_method,
      purchase.transaction_id || 'N/A'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_compras_monedas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const openPurchaseDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setShowDetails(true);
    if (onPurchaseClick) {
      onPurchaseClick(purchase);
    }
  };

  const getFilterStats = () => {
    const stats = {
      all: purchases.length,
      completed: purchases.filter(p => p.status === 'completed').length,
      pending: purchases.filter(p => p.status === 'pending').length,
      failed: purchases.filter(p => p.status === 'failed').length,
      cancelled: purchases.filter(p => p.status === 'cancelled').length
    };
    return stats;
  };

  const filterStats = getFilterStats();

  if (loading && purchases.length === 0) {
    return (
      <div className={`bg-[#2b2d31] rounded-xl border border-gray-600 ${compact ? 'p-4' : 'p-8'}`}>
        <div className="flex items-center justify-center">
          <RefreshCw className="animate-spin text-[#ff007a] mr-3" size={24} />
          <span className="text-white/70">Cargando historial...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-[#2b2d31] rounded-xl border border-red-500/30 ${compact ? 'p-4' : 'p-8'}`}>
        <div className="text-center">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
          <h3 className="text-lg font-bold text-red-400 mb-2">Error al cargar historial</h3>
          <p className="text-white/70 mb-4">{error}</p>
          <button
            onClick={() => fetchPurchases(currentPage)}
            disabled={loading}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Reintentar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#2b2d31] rounded-xl border border-gray-600">
        {showHeader && (
          <div className="p-6 border-b border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {/* 🔥 CAMBIO: Clock -> Coins */}
                <Coins className="text-[#ff007a]" size={24} />
                Historial de Compras de Monedas
                {pagination && (
                  <span className="text-sm text-white/50 ml-2">
                    ({pagination.total} total)
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportToCSV}
                  className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                  disabled={filteredPurchases.length === 0}
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Exportar CSV</span>
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="bg-[#ff007a]/20 hover:bg-[#ff007a]/30 text-[#ff007a] px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={refreshing ? 'animate-spin' : ''} size={16} />
                </button>
              </div>
            </div>

            {/* Filtros */}
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="text-white/60" size={18} />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="bg-[#1a1c20] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ff007a] focus:outline-none"
                  >
                    <option value="all">Todos ({filterStats.all})</option>
                    <option value="completed">Completados ({filterStats.completed})</option>
                    <option value="pending">Pendientes ({filterStats.pending})</option>
                    <option value="failed">Fallidas ({filterStats.failed})</option>
                    <option value="cancelled">Canceladas ({filterStats.cancelled})</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <Search className="text-white/60" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar por ID de transacción o paquete..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-[#1a1c20] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ff007a] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lista de Compras */}
        <div className={compact ? 'p-4' : 'p-6'}>
          {filteredPurchases.length === 0 ? (
            <div className="text-center py-12">
              <Coins className="text-white/30 mx-auto mb-4" size={48} />
              <h3 className="text-lg font-bold text-white/70 mb-2">
                {searchTerm || filter !== 'all' ? 'No se encontraron resultados' : 'No hay compras registradas'}
              </h3>
              <p className="text-white/50">
                {searchTerm || filter !== 'all' 
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Tus compras de monedas aparecerán aquí una vez que realices alguna'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPurchases.map((purchase) => {
                const statusConfig = getStatusConfig(purchase.status);
                const paymentMethod = getPaymentMethodInfo(purchase.payment_method);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={purchase.id}
                    className={`bg-[#1a1c20] rounded-lg border ${statusConfig.borderColor} p-4 hover:bg-[#1e2025] transition-colors cursor-pointer`}
                    onClick={() => openPurchaseDetails(purchase)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${statusConfig.bgColor}`}>
                          <StatusIcon className={statusConfig.color} size={20} />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white">
                              {purchase.package?.name || 'Paquete personalizado'}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                              {statusConfig.text}
                            </span>
                          </div>
                          
                          {/* 🔥 CAMBIO: Información actualizada para monedas */}
                          <div className="flex items-center gap-4 text-sm text-white/60">
                            <span className="flex items-center gap-1">
                              <Coins size={14} />
                              {formatCoins(purchase.total_coins || purchase.coins)} monedas
                            </span>
                            {purchase.bonus_coins > 0 && (
                              <span className="flex items-center gap-1 text-green-400">
                                <Gift size={14} />
                                +{formatCoins(purchase.bonus_coins)} bonus
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-blue-400">
                              <Clock size={14} />
                              ≈ {formatMinutesFromCoins(purchase.total_coins || purchase.coins)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={14} />
                              {formatDate(purchase.created_at)}
                            </span>
                            <span className={`flex items-center gap-1 ${paymentMethod.color}`}>
                              <span>{paymentMethod.icon}</span>
                              {paymentMethod.text}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-white mb-1">
                          ${purchase.amount}
                        </div>
                        <div className="flex items-center gap-2">
                          {purchase.transaction_id && (
                            <span className="text-xs text-white/40 font-mono">
                              {purchase.transaction_id.slice(-8)}
                            </span>
                          )}
                          <Eye className="text-white/40" size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paginación - Sin cambios */}
        {showPagination && pagination && pagination.last_page > 1 && (
          <div className="p-6 border-t border-gray-600">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/60">
                Mostrando {pagination.from} - {pagination.to} de {pagination.total} resultados
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-[#1a1c20] border border-gray-600 text-white/70 hover:bg-[#1e2025] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, pagination.last_page))].map((_, i) => {
                    let pageNum;
                    if (pagination.last_page <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= pagination.last_page - 2) {
                      pageNum = pagination.last_page - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-[#ff007a] text-white'
                            : 'bg-[#1a1c20] border border-gray-600 text-white/70 hover:bg-[#1e2025]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === pagination.last_page}
                  className="p-2 rounded-lg bg-[#1a1c20] border border-gray-600 text-white/70 hover:bg-[#1e2025] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🔥 MODAL DE DETALLES ACTUALIZADO */}
      {showDetails && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2d31] rounded-xl border border-gray-600 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Detalles de Compra</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 rounded-lg hover:bg-gray-600/50 text-white/70 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Estado */}
                <div>
                  <label className="text-sm text-white/60 mb-1 block">Estado</label>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const statusConfig = getStatusConfig(selectedPurchase.status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <>
                          <div className={`p-2 rounded-lg ${statusConfig.bgColor}`}>
                            <StatusIcon className={statusConfig.color} size={16} />
                          </div>
                          <div>
                            <div className={`font-semibold ${statusConfig.color}`}>
                              {statusConfig.text}
                            </div>
                            <div className="text-xs text-white/50">
                              {statusConfig.description}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Paquete */}
                <div>
                  <label className="text-sm text-white/60 mb-1 block">Paquete</label>
                  <div className="bg-[#1a1c20] rounded-lg p-3 border border-gray-600">
                    <div className="font-semibold text-white mb-1">
                      {selectedPurchase.package?.name || 'Paquete personalizado'}
                    </div>
                    {/* 🔥 CAMBIO: Mostrar monedas en lugar de minutos */}
                    <div className="text-sm text-white/60 space-y-1">
                      <div className="flex items-center gap-1">
                        <Coins size={14} />
                        {formatCoins(selectedPurchase.coins || 0)} monedas base
                      </div>
                      {selectedPurchase.bonus_coins > 0 && (
                        <div className="flex items-center gap-1 text-green-400">
                          <Gift size={14} />
                          +{formatCoins(selectedPurchase.bonus_coins)} monedas bonus
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-blue-400">
                        <Clock size={14} />
                        Total: {formatCoins(selectedPurchase.total_coins || selectedPurchase.coins)} monedas 
                        (≈ {formatMinutesFromCoins(selectedPurchase.total_coins || selectedPurchase.coins)})
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información de Pago */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-white/60 mb-1 block">Monto</label>
                    <div className="text-lg font-bold text-[#ff007a]">
                      ${selectedPurchase.amount}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-white/60 mb-1 block">Método de Pago</label>
                    <div className={`text-sm ${getPaymentMethodInfo(selectedPurchase.payment_method).color}`}>
                      {getPaymentMethodInfo(selectedPurchase.payment_method).icon} {getPaymentMethodInfo(selectedPurchase.payment_method).text}
                    </div>
                  </div>
                </div>

                {/* 🔥 NUEVA: Información detallada de monedas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1a1c20] rounded-lg p-3 border border-[#ff007a]/20">
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#ff007a]">
                        {formatCoins(selectedPurchase.coins || 0)}
                      </div>
                      <div className="text-xs text-white/60">Monedas Compradas</div>
                    </div>
                  </div>
                  
                  {selectedPurchase.bonus_coins > 0 && (
                    <div className="bg-[#1a1c20] rounded-lg p-3 border border-green-500/20">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-400">
                          {formatCoins(selectedPurchase.bonus_coins)}
                        </div>
                        <div className="text-xs text-white/60">Monedas Bonus</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Equivalencia en tiempo */}
                <div>
                  <label className="text-sm text-white/60 mb-1 block">Tiempo de Videochat Equivalente</label>
                  <div className="bg-[#1a1c20] rounded-lg p-3 border border-blue-500/20">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-400">
                        {formatMinutesFromCoins(selectedPurchase.total_coins || selectedPurchase.coins)}
                      </div>
                      <div className="text-xs text-white/60">
                        A 10 monedas por minuto
                      </div>
                    </div>
                  </div>
                </div>

                {/* ID de Transacción */}
                {selectedPurchase.transaction_id && (
                  <div>
                    <label className="text-sm text-white/60 mb-1 block">ID de Transacción</label>
                    <div className="bg-[#1a1c20] rounded-lg p-3 border border-gray-600 font-mono text-sm text-white break-all">
                      {selectedPurchase.transaction_id}
                    </div>
                  </div>
                )}

                {/* Fecha */}
                <div>
                  <label className="text-sm text-white/60 mb-1 block">Fecha de Compra</label>
                  <div className="text-white">
                    {formatDate(selectedPurchase.created_at)}
                  </div>
                </div>

                {/* Información adicional si está disponible */}
                {selectedPurchase.description && (
                  <div>
                    <label className="text-sm text-white/60 mb-1 block">Descripción</label>
                    <div className="bg-[#1a1c20] rounded-lg p-3 border border-gray-600 text-sm text-white">
                      {selectedPurchase.description}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              <button
                onClick={() => setShowDetails(false)}
                className="w-full bg-[#ff007a] hover:bg-[#ff007a]/80 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}