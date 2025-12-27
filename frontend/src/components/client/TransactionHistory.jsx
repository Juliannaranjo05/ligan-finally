import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Receipt,
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
  TrendingUp,
  TrendingDown,
  Gift,
  Coins,
  ShoppingCart,
  Clock,
  X
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function TransactionHistory() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, purchase, consumption, gift
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
  };

  const fetchTransactions = async (page = 1, type = 'all', showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const response = await fetch(
        `${API_BASE_URL}/api/transactions/history?page=${page}&per_page=20&type=${type}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${t('settings.transactionHistory.errors.loadFailed') || 'Error al obtener historial'}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTransactions(data.transactions || []);
        setPagination(data.pagination);
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
    fetchTransactions(currentPage, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions(currentPage, filter, false);
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

  const formatCurrency = (amount, currency) => {
    if (currency === 'coins') {
      return `${amount.toLocaleString()} monedas`;
    }
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'COP'
    }).format(amount);
  };

  const getTransactionTypeInfo = (type) => {
    const types = {
      'purchase': {
        label: t('settings.transactionHistory.types.purchase') || 'Compra',
        icon: ShoppingCart,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30'
      },
      'coin_purchase': {
        label: t('settings.transactionHistory.types.coinPurchase') || 'Compra de Monedas',
        icon: Coins,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30'
      },
      'coin_gift': {
        label: t('settings.transactionHistory.types.coinGift') || 'Regalo de Monedas',
        icon: Gift,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30'
      },
      'consumption': {
        label: t('settings.transactionHistory.types.consumption') || 'Consumo',
        icon: TrendingDown,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30'
      },
      'gift_sent': {
        label: t('settings.transactionHistory.types.giftSent') || 'Regalo Enviado',
        icon: Gift,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30'
      },
      'gift_received': {
        label: t('settings.transactionHistory.types.giftReceived') || 'Regalo Recibido',
        icon: Gift,
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/10',
        borderColor: 'border-pink-500/30'
      }
    };
    return types[type] || {
      label: type,
      icon: Receipt,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/30'
    };
  };

  const getStatusConfig = (status) => {
    const configs = {
      completed: {
        icon: CheckCircle,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        text: t('settings.transactionHistory.status.completed') || 'Completado'
      },
      pending: {
        icon: Clock,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        text: t('settings.transactionHistory.status.pending') || 'Pendiente'
      },
      failed: {
        icon: XCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        text: t('settings.transactionHistory.status.failed') || 'Fallido'
      },
      cancelled: {
        icon: XCircle,
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500/30',
        text: t('settings.transactionHistory.status.cancelled') || 'Cancelado'
      }
    };
    return configs[status] || configs.completed;
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        transaction.reference_id?.toLowerCase().includes(searchLower) ||
        transaction.description?.toLowerCase().includes(searchLower) ||
        transaction.id?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const openTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetails(true);
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin text-[#ff007a] mr-3" size={24} />
        <span className="text-white/70">{t('settings.transactionHistory.loading') || 'Cargando historial...'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
        <h3 className="text-lg font-bold text-red-400 mb-2">{t('settings.transactionHistory.errors.title') || 'Error al cargar historial'}</h3>
        <p className="text-white/70 mb-4">{error}</p>
        <button
          onClick={() => fetchTransactions(currentPage, filter)}
          disabled={loading}
          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? (t('settings.transactionHistory.loading') || 'Cargando...') : (t('settings.transactionHistory.retry') || 'Reintentar')}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header con filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="text-white/60" size={18} />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#1a1c20] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ff007a] focus:outline-none"
            >
              <option value="all">{t('settings.transactionHistory.filters.all') || 'Todas'}</option>
              <option value="purchase">{t('settings.transactionHistory.filters.purchase') || 'Compras'}</option>
              <option value="consumption">{t('settings.transactionHistory.filters.consumption') || 'Consumo'}</option>
              <option value="gift">{t('settings.transactionHistory.filters.gift') || 'Regalos'}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1">
            <Search className="text-white/60" size={18} />
            <input
              type="text"
              placeholder={t('settings.transactionHistory.searchPlaceholder') || 'Buscar por ID, descripción...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-[#1a1c20] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ff007a] focus:outline-none"
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-[#ff007a]/20 hover:bg-[#ff007a]/30 text-[#ff007a] px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} size={16} />
          </button>
        </div>

        {/* Lista de transacciones */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 bg-[#1a1c20] rounded-lg border border-white/10">
            <Receipt className="text-white/30 mx-auto mb-4" size={48} />
            <h3 className="text-lg font-bold text-white/70 mb-2">
              {searchTerm || filter !== 'all' 
                ? (t('settings.transactionHistory.noResults') || 'No se encontraron resultados')
                : (t('settings.transactionHistory.empty') || 'No hay transacciones registradas')
              }
            </h3>
            <p className="text-white/50">
              {searchTerm || filter !== 'all' 
                ? (t('settings.transactionHistory.noResultsDesc') || 'Intenta ajustar los filtros de búsqueda')
                : (t('settings.transactionHistory.emptyDesc') || 'Tus transacciones aparecerán aquí')
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((transaction) => {
              const typeInfo = getTransactionTypeInfo(transaction.transaction_type);
              const statusConfig = getStatusConfig(transaction.status);
              const TypeIcon = typeInfo.icon;
              const StatusIcon = statusConfig.icon;
              const isNegative = transaction.amount < 0;

              return (
                <div
                  key={transaction.id}
                  className={`bg-[#1a1c20] rounded-lg border ${typeInfo.borderColor} p-4 hover:bg-[#1e2025] transition-colors cursor-pointer`}
                  onClick={() => openTransactionDetails(transaction)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-lg ${typeInfo.bgColor}`}>
                        <TypeIcon className={typeInfo.color} size={20} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white text-sm">
                            {transaction.description}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color} flex items-center gap-1`}>
                            <StatusIcon size={12} />
                            {statusConfig.text}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-white/60">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(transaction.date)}
                          </span>
                          {transaction.reference_id && (
                            <span className="font-mono">
                              ID: {transaction.reference_id.slice(-8)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-lg font-bold ${isNegative ? 'text-red-400' : 'text-green-400'} flex items-center gap-1`}>
                          {isNegative ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                          {isNegative ? '' : '+'}
                          {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                        </div>
                        {transaction.coins && transaction.currency !== 'coins' && (
                          <div className="text-xs text-white/50 mt-1">
                            {transaction.coins} monedas
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        {pagination && pagination.last_page > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="text-sm text-white/60">
              Mostrando {pagination.from} a {pagination.to} de {pagination.total} transacciones
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-[#1a1c20] border border-white/10 rounded-lg text-white hover:bg-[#ff007a]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-white/80 px-4">
                Página {currentPage} de {pagination.last_page}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.last_page, prev + 1))}
                disabled={currentPage === pagination.last_page}
                className="p-2 bg-[#1a1c20] border border-white/10 rounded-lg text-white hover:bg-[#ff007a]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      {showDetails && selectedTransaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#1f2125] rounded-xl p-6 w-full max-w-md border border-[#ff007a]/30 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowDetails(false)}
              className="absolute top-3 right-3 text-white/60 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-[#ff007a] mb-4">{t('settings.transactionHistory.details.title') || 'Detalles de Transacción'}</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60">{t('settings.transactionHistory.details.description') || 'Descripción'}</label>
                <p className="text-white">{selectedTransaction.description}</p>
              </div>

              <div>
                <label className="text-xs text-white/60">{t('settings.transactionHistory.details.type') || 'Tipo'}</label>
                <p className="text-white">{getTransactionTypeInfo(selectedTransaction.transaction_type).label}</p>
              </div>

              <div>
                <label className="text-xs text-white/60">{t('settings.transactionHistory.details.amount') || 'Monto'}</label>
                <p className="text-white font-semibold">
                  {selectedTransaction.amount < 0 ? '' : '+'}
                  {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                </p>
              </div>

              <div>
                <label className="text-xs text-white/60">{t('settings.transactionHistory.details.status') || 'Estado'}</label>
                <p className="text-white">{getStatusConfig(selectedTransaction.status).text}</p>
              </div>

              <div>
                <label className="text-xs text-white/60">{t('settings.transactionHistory.details.date') || 'Fecha'}</label>
                <p className="text-white">{formatDate(selectedTransaction.date)}</p>
              </div>

              {selectedTransaction.reference_id && (
                <div>
                  <label className="text-xs text-white/60">ID de Referencia</label>
                  <p className="text-white font-mono text-sm">{selectedTransaction.reference_id}</p>
                </div>
              )}

              {selectedTransaction.payment_method && (
                <div>
                  <label className="text-xs text-white/60">Método de Pago</label>
                  <p className="text-white">{selectedTransaction.payment_method}</p>
                </div>
              )}

              {selectedTransaction.metadata && Object.keys(selectedTransaction.metadata).length > 0 && (
                <div>
                  <label className="text-xs text-white/60">Información Adicional</label>
                  <div className="bg-[#131418] rounded-lg p-3 mt-1">
                    <pre className="text-xs text-white/80 whitespace-pre-wrap">
                      {JSON.stringify(selectedTransaction.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

