import React, { useState, useEffect } from 'react';
import { X, DollarSign, Clock, User, Calendar, ChevronDown, ChevronRight, ChevronLeft, CreditCard, CheckCircle, Loader2, AlertCircle, Gift, Video, MessageSquare } from 'lucide-react';

const WeeklyEarnings = ({ isOpen, onClose }) => {
  const [weeklyData, setWeeklyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState({});
  const [dayPages, setDayPages] = useState({});
  const [error, setError] = useState(null);
  
  // 🔥 ESTADOS PARA SISTEMA UNIFICADO
  const [activeTab, setActiveTab] = useState('all');
  const [pendingPayments, setPendingPayments] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState(null);
  const [balanceData, setBalanceData] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const ITEMS_PER_PAGE = 3;

  useEffect(() => {
    if (isOpen) {
      if (['all', 'sessions', 'gifts'].includes(activeTab)) {
        fetchWeeklyEarnings();
        fetchUserBalance();
      } else if (activeTab === 'pending') {
        fetchPendingPayments();
      } else if (activeTab === 'history') {
        fetchPaymentHistory();
      }
    }
  }, [isOpen, activeTab]);

  const fetchWeeklyEarnings = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/earnings/weekly`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 [UNIFICADO] Datos recibidos:', data);
        setWeeklyData(data.current_week);
        
        const initializePages = (earningsList) => {
          const groupedByDay = groupEarningsByDay(earningsList);
          const initialPages = {};
          Object.keys(groupedByDay).forEach(day => {
            initialPages[day] = 1;
          });
          return initialPages;
        };

        if (data.current_week?.earnings_list) {
          setDayPages(initializePages(data.current_week.earnings_list));
        }
      } else {
        setError('Error al cargar las ganancias semanales');
      }
    } catch (error) {
            setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBalance = async () => {
    try {
      setBalanceLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('💰 [UNIFICADO] Balance data:', data);
        setBalanceData(data);
      } else {
              }
    } catch (error) {
          } finally {
      setBalanceLoading(false);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      setPaymentsLoading(true);
      setPaymentsError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/earnings/pending-payments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingPayments(data.pending_payments || []);
      } else {
        setPaymentsError('Error al cargar pagos pendientes');
      }
    } catch (error) {
            setPaymentsError('Error de conexión');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      setPaymentsLoading(true);
      setPaymentsError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/earnings/payment-history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data.payment_history || []);
      } else {
        setPaymentsError('Error al cargar historial de pagos');
      }
    } catch (error) {
            setPaymentsError('Error de conexión');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const getFilteredEarnings = (earningsList) => {
    if (!earningsList) return [];
    
    switch (activeTab) {
      case 'sessions':
        return earningsList.filter(e => e.time_earnings > 0);
      case 'gifts':
        return earningsList.filter(e => e.gift_earnings > 0);
      case 'all':
      default:
        return earningsList;
    }
  };

  const groupEarningsByDay = (earnings) => {
    const filteredEarnings = getFilteredEarnings(earnings);
    
    return filteredEarnings.reduce((groups, earning) => {
      const date = new Date(earning.created_at);
      const dayKey = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('es-ES', { 
        weekday: 'long',
        day: '2-digit',
        month: '2-digit'
      });
      
      if (!groups[dayKey]) {
        groups[dayKey] = {
          dayName,
          earnings: [],
          total: 0,
          timeTotal: 0,
          giftTotal: 0
        };
      }
      
      groups[dayKey].earnings.push(earning);
      groups[dayKey].total += earning.earning_amount_gross || 0;
      groups[dayKey].timeTotal += earning.time_earnings || 0;
      groups[dayKey].giftTotal += earning.gift_earnings || 0;
      
      return groups;
    }, {});
  };

  const formatDuration = (durationSeconds) => {
    if (!durationSeconds || durationSeconds < 60) return '< 1 min';
    const minutes = Math.floor(durationSeconds / 60);
    return `${minutes} min`;
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSourceIcon = (sourceType) => {
    switch (sourceType) {
      case 'video_session':
        return <Video size={14} className="text-blue-400" />;
      case 'direct_gift':
        return <Gift size={14} className="text-purple-400" />;
      case 'chat_gift':
        return <MessageSquare size={14} className="text-green-400" />;
      default:
        return <Clock size={14} className="text-gray-400" />;
    }
  };

  const getSourceLabel = (sourceType) => {
    switch (sourceType) {
      case 'video_session':
        return 'Videochat';
      case 'direct_gift':
        return 'Regalo Directo';
      case 'chat_gift':
        return 'Regalo en Chat';
      default:
        return 'Sesión';
    }
  };

  const toggleDayExpansion = (dayKey) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayKey]: !prev[dayKey]
    }));
  };

  const changePage = (dayKey, direction) => {
    setDayPages(prev => ({
      ...prev,
      [dayKey]: Math.max(1, prev[dayKey] + direction)
    }));
  };

  const getPaginatedEarnings = (earnings, page) => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return earnings.slice(startIndex, endIndex);
  };

  const getTotalPages = (earnings) => {
    return Math.ceil(earnings.length / ITEMS_PER_PAGE);
  };

  // COMPONENTE: PAGOS PENDIENTES
  const PendingPaymentsTab = () => (
    <div className="p-6">
      {paymentsLoading ? (
        <div className="text-center py-8">
          <Loader2 className="animate-spin h-8 w-8 text-[#ff007a] mx-auto" />
          <p className="text-gray-400 mt-2">Cargando pagos pendientes...</p>
        </div>
      ) : paymentsError ? (
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{paymentsError}</p>
          <button 
            onClick={fetchPendingPayments}
            className="mt-2 px-4 py-2 bg-[#ff007a] text-white rounded-lg hover:bg-[#ff007a]/80 transition"
          >
            Reintentar
          </button>
        </div>
      ) : pendingPayments.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-white text-lg">¡Todo al día!</p>
          <p className="text-gray-400">No tienes pagos pendientes</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">Total Pendiente</h3>
                <p className="text-gray-400 text-sm">{pendingPayments.length} pago(s) esperando</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-400">
                  ${pendingPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0).toFixed(2)}
                </p>
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Procesando...
                </div>
              </div>
            </div>
          </div>

          {pendingPayments.map((payment) => (
            <div key={payment.id} className="bg-[#2b2d31] rounded-lg border border-yellow-500/20 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-yellow-400" size={16} />
                    <span className="text-white font-medium">Semana {payment.week_range}</span>
                    <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">Pendiente</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                    <div>{payment.total_sessions || 0} sesiones</div>
                    <div>Procesado: {payment.processed_at}</div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      {payment.days_pending || 0} día(s) esperando
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Video size={12} className="text-blue-400" />
                      Tiempo: ${(payment.time_earnings || 0).toFixed(2)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Gift size={12} className="text-purple-400" />
                      Regalos: ${(payment.gift_earnings || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-xl font-bold text-yellow-400">
                    ${(payment.amount || 0).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-yellow-400 mt-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    En proceso
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-[#36393f]/50 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">💡 Los pagos se procesan semanalmente. Tu dinero llegará pronto.</p>
          </div>
        </div>
      )}
    </div>
  );

  // COMPONENTE: HISTORIAL DE PAGOS
  const PaymentHistoryTab = () => (
    <div className="p-6">
      {paymentsLoading ? (
        <div className="text-center py-8">
          <Loader2 className="animate-spin h-8 w-8 text-[#ff007a] mx-auto" />
          <p className="text-gray-400 mt-2">Cargando historial...</p>
        </div>
      ) : paymentsError ? (
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{paymentsError}</p>
          <button 
            onClick={fetchPaymentHistory}
            className="mt-2 px-4 py-2 bg-[#ff007a] text-white rounded-lg hover:bg-[#ff007a]/80 transition"
          >
            Reintentar
          </button>
        </div>
      ) : paymentHistory.length === 0 ? (
        <div className="text-center py-8">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-white text-lg">Sin historial</p>
          <p className="text-gray-400">Aún no tienes pagos realizados</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">Total Pagado</h3>
                <p className="text-gray-400 text-sm">{paymentHistory.length} pago(s) completado(s)</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">
                  ${paymentHistory.reduce((sum, payment) => sum + (payment.amount || 0), 0).toFixed(2)}
                </p>
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  Completado
                </div>
              </div>
            </div>
          </div>

          {paymentHistory.map((payment) => (
            <div key={payment.id} className="bg-[#2b2d31] rounded-lg border border-green-500/20 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-green-400" size={16} />
                    <span className="text-white font-medium">Semana {payment.week_range}</span>
                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs flex items-center gap-1">
                      <CheckCircle size={12} />
                      Pagado
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                    <div>{payment.total_sessions || 0} sesiones</div>
                    <div>Pagado: {payment.paid_at}</div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    <div className="flex items-center gap-1">
                      <Video size={12} className="text-blue-400" />
                      Tiempo: ${(payment.time_earnings || 0).toFixed(2)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Gift size={12} className="text-purple-400" />
                      Regalos: ${(payment.gift_earnings || 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div>Método: {payment.payment_method}</div>
                    {payment.payment_reference && <div>Ref: {payment.payment_reference}</div>}
                    <div>Por: {payment.paid_by}</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-xl font-bold text-green-400">
                    ${(payment.amount || 0).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
                    <CheckCircle className="h-3 w-3" />
                    Recibido
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1f2125] rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#ff007a]/20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <DollarSign className="text-[#ff007a]" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">Sistema de Pagos Unificado</h2>
              <p className="text-sm text-gray-400">Ganancias por tiempo y regalos</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-[#ff007a]/20">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'all' 
                ? 'text-[#ff007a] border-b-2 border-[#ff007a] bg-[#ff007a]/5' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <DollarSign size={16} />
            Todo
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'sessions'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Video size={16} />
            Sesiones
          </button>
          <button
            onClick={() => setActiveTab('gifts')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'gifts'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-400/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Gift size={16} />
            Regalos
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'pending'
                ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-400/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Loader2 size={16} className={activeTab === 'pending' ? 'animate-spin' : ''} />
            Pendientes
            {pendingPayments.length > 0 && (
              <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
                {pendingPayments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'text-green-400 border-b-2 border-green-400 bg-green-400/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CheckCircle size={16} />
            Pagados
          </button>
        </div>

        {/* Content Area */}
        <div className="max-h-96 overflow-y-auto">
          {['all', 'sessions', 'gifts'].includes(activeTab) && (
            <>
              {/* Balance */}
              {balanceData && (
                <div className="p-6 bg-gradient-to-r from-[#ff007a]/10 to-purple-600/10 border-b border-[#ff007a]/20">
                  <div className="flex justify-center mb-6">
                    <div className="bg-[#2b2d31] rounded-lg p-6 border border-[#ff007a]/20 text-center min-w-80">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <DollarSign className="text-[#ff007a]" size={28} />
                        <h3 className="text-white font-medium text-xl">Saldo General</h3>
                      </div>
                      <p className="text-4xl font-bold text-[#ff007a] mb-2">
                        ${balanceData.balance?.current_balance?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-sm text-gray-400">Balance disponible total</p>
                      
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-[#36393f]/50 rounded-lg p-2">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Video className="text-blue-400" size={14} />
                            <span className="text-blue-400 text-xs">Sesiones</span>
                          </div>
                          <p className="text-lg font-bold text-blue-400">
                            ${balanceData.balance?.time_earnings?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <div className="bg-[#36393f]/50 rounded-lg p-2">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Gift className="text-purple-400" size={14} />
                            <span className="text-purple-400 text-xs">Regalos</span>
                          </div>
                          <p className="text-lg font-bold text-purple-400">
                            ${balanceData.balance?.gift_earnings?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desglose Semanal */}
                  <div className="bg-[#36393f]/50 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium text-center mb-3">
                      📊 Esta Semana ({balanceData.weekly_breakdown?.week_range})
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-[#2b2d31] rounded-lg p-3 border border-blue-500/20">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Video className="text-blue-400" size={16} />
                          <span className="text-blue-400 text-sm font-medium">Tiempo</span>
                        </div>
                        <p className="text-xl font-bold text-blue-400">
                          ${balanceData.weekly_breakdown?.time_earnings?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-gray-500">{balanceData.weekly_breakdown?.sessions_count || 0} sesiones</p>
                      </div>

                      <div className="bg-[#2b2d31] rounded-lg p-3 border border-purple-500/20">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Gift className="text-purple-400" size={16} />
                          <span className="text-purple-400 text-sm font-medium">Regalos</span>
                        </div>
                        <p className="text-xl font-bold text-purple-400">
                          ${balanceData.weekly_breakdown?.gift_earnings?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-gray-500">{balanceData.weekly_breakdown?.gifts_count || 0} regalos</p>
                      </div>

                      <div className="bg-[#2b2d31] rounded-lg p-3 border border-[#ff007a]/20">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <CheckCircle className="text-[#ff007a]" size={16} />
                          <span className="text-[#ff007a] text-sm font-medium">Total Semanal</span>
                        </div>
                        <p className="text-xl font-bold text-[#ff007a]">
                          ${balanceData.weekly_breakdown?.total_weekly?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-gray-500">Sin procesar</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <p className="text-gray-400">Total Histórico Ganado</p>
                      <p className="text-lg font-bold text-green-400">
                        ${balanceData.balance?.total_earned?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Última Ganancia</p>
                      <p className="text-lg font-bold text-white">
                        {balanceData.balance?.last_earning_at 
                          ? new Date(balanceData.balance.last_earning_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Ninguna'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Detalle por día */}
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff007a] mx-auto"></div>
                    <p className="text-gray-400 mt-2">Cargando ganancias...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-400">{error}</p>
                    <button 
                      onClick={fetchWeeklyEarnings}
                      className="mt-2 px-4 py-2 bg-[#ff007a] text-white rounded-lg hover:bg-[#ff007a]/80 transition"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : !weeklyData?.earnings_list?.length ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No tienes ganancias registradas esta semana</p>
                  </div>
                ) : getFilteredEarnings(weeklyData.earnings_list).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">
                      {activeTab === 'sessions' && 'No tienes ganancias por sesiones esta semana'}
                      {activeTab === 'gifts' && 'No tienes ganancias por regalos esta semana'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-medium">
                        📅 Detalle por día
                        {activeTab === 'sessions' && ' - Solo Sesiones'}
                        {activeTab === 'gifts' && ' - Solo Regalos'}
                      </h3>
                      <div className="text-sm text-gray-400">
                        {getFilteredEarnings(weeklyData.earnings_list).length} registros
                      </div>
                    </div>
                    
                    {Object.entries(groupEarningsByDay(weeklyData.earnings_list))
                      .sort(([a], [b]) => new Date(b) - new Date(a))
                      .map(([dayKey, dayData]) => {
                        const currentPage = dayPages[dayKey] || 1;
                        const totalPages = getTotalPages(dayData.earnings);
                        const paginatedEarnings = getPaginatedEarnings(dayData.earnings, currentPage);
                        const isExpanded = expandedDays[dayKey];

                        return (
                          <div key={dayKey} className="bg-[#2b2d31] rounded-lg border border-gray-600/30 overflow-hidden">
                            <div 
                              className="p-4 bg-[#36393f] cursor-pointer hover:bg-[#40444b] transition flex justify-between items-center"
                              onClick={() => toggleDayExpansion(dayKey)}
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                                <div>
                                  <h3 className="text-white font-medium capitalize">{dayData.dayName}</h3>
                                  <p className="text-sm text-gray-400">{dayData.earnings.length} registros</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-[#ff007a]">${dayData.total.toFixed(2)}</p>
                                {activeTab === 'all' && (
                                  <div className="flex items-center gap-2 text-xs text-gray-400">
                                    {dayData.timeTotal > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Video size={10} className="text-blue-400" />
                                        ${dayData.timeTotal.toFixed(2)}
                                      </span>
                                    )}
                                    {dayData.giftTotal > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Gift size={10} className="text-purple-400" />
                                        ${dayData.giftTotal.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-4">
                                <div className="space-y-3">
                                  {paginatedEarnings.map((earning, index) => (
                                    <div key={index} className="bg-[#1f2125] rounded-lg p-3 border border-gray-700/30">
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <User className="text-blue-400" size={14} />
                                            <span className="text-white text-sm font-medium">
                                              {earning.client_name}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                              {formatTime(earning.created_at)}
                                            </span>
                                            
                                            <div className="flex items-center gap-1">
                                              {getSourceIcon(earning.source_type)}
                                              <span className="text-xs text-gray-400">
                                                {getSourceLabel(earning.source_type)}
                                              </span>
                                            </div>

                                            {earning.qualifying_session ? (
                                              <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">
                                                ✓ Válida
                                              </span>
                                            ) : (
                                              <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                                                ✗ Muy Corta
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="flex items-center gap-3 text-xs text-gray-400">
                                            {earning.session_duration_seconds > 0 && (
                                              <div className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {formatDuration(earning.session_duration_seconds)}
                                              </div>
                                            )}
                                            
                                            {earning.time_earnings > 0 && (
                                              <div className="flex items-center gap-1">
                                                <Video size={12} className="text-blue-400" />
                                                ${earning.time_earnings.toFixed(2)}
                                              </div>
                                            )}
                                            {earning.gift_earnings > 0 && (
                                              <div className="flex items-center gap-1">
                                                <Gift size={12} className="text-purple-400" />
                                                ${earning.gift_earnings.toFixed(2)}
                                                {earning.gift_count > 0 && ` (${earning.gift_count})`}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        
                                        <div className="text-right">
                                          <p className="text-base font-bold text-[#ff007a]">
                                            ${earning.earning_amount_gross.toFixed(2)}
                                          </p>
                                          <div className="text-xs text-gray-400">
                                            {earning.is_mixed && 'Mixto'}
                                            {earning.is_time_only && 'Solo Tiempo'}
                                            {earning.is_gift_only && 'Solo Regalos'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {totalPages > 1 && (
                                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-700/30">
                                    <button
                                      onClick={() => changePage(dayKey, -1)}
                                      disabled={currentPage === 1}
                                      className="flex items-center gap-1 px-3 py-1 text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <ChevronLeft size={16} />
                                      Anterior
                                    </button>
                                    
                                    <span className="text-sm text-gray-400">
                                      Página {currentPage} de {totalPages}
                                    </span>
                                    
                                    <button
                                      onClick={() => changePage(dayKey, 1)}
                                      disabled={currentPage === totalPages}
                                      className="flex items-center gap-1 px-3 py-1 text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Siguiente
                                      <ChevronRight size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'pending' && <PendingPaymentsTab />}
          {activeTab === 'history' && <PaymentHistoryTab />}
        </div>
      </div>
    </div>
  );
};

export default WeeklyEarnings;