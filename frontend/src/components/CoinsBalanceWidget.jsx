import React, { useState, useEffect } from 'react';
import { Coins, Plus, TrendingDown, AlertTriangle, RefreshCw, Zap, DollarSign, Eye, EyeOff, Gift, Clock } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function CoinsBalanceWidget({ 
  onBuyClick, 
  showFullStats = false, 
  autoRefresh = true,
  refreshInterval = 30000, // 30 segundos
  compact = false,
  showHistory = false
}) {
  // 🔥 CAMBIO: Balance ahora es un objeto completo
  const [balance, setBalance] = useState({
    purchased_coins: 0,
    gift_coins: 0,
    total_coins: 0,
    minutes_available: 0,
    cost_per_minute: 10,
    minimum_required: 30
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState([]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchBalance = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      setError(null);
      
      // 🔥 CAMBIO: Nueva URL para monedas
      const response = await fetch(`${API_BASE_URL}/api/coins/balance`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener balance');
      }

      const data = await response.json();
      
      if (data.success) {
        setBalance(data.balance);
        setLastUpdate(new Date());
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setRefreshing(false);
      }
    }
  };

  const fetchRecentPurchases = async () => {
    if (!showHistory) return;
    
    try {
      // 🔥 CAMBIO: Nueva URL para historial de monedas
      const response = await fetch(`${API_BASE_URL}/api/stripe-coins/history`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRecentPurchases((data.purchases.data || []).slice(0, 3));
        }
      }
    } catch (error) {
    }
  };

  useEffect(() => {
    fetchBalance();
    if (showHistory) {
      fetchRecentPurchases();
    }
  }, [showHistory]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => fetchBalance(), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // 🔥 NUEVA FUNCIÓN: Formatear monedas
  const formatCoins = (coins) => {
    return coins ? `${coins.toLocaleString()}` : '0';
  };

  // 🔥 FUNCIÓN ACTUALIZADA: Formatear minutos equivalentes
  const formatMinutesFromCoins = (coins, costPerMinute = 10) => {
    const minutes = Math.floor(coins / costPerMinute);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const getBalanceStatus = () => {
    const totalCoins = balance.total_coins || 0;
    
    if (totalCoins === 0) {
      return { 
        color: 'text-red-400', 
        bgColor: 'bg-red-500/10', 
        borderColor: 'border-red-500/30', 
        icon: AlertTriangle,
        pulse: 'animate-pulse'
      };
    } else if (totalCoins < balance.minimum_required) {
      return { 
        color: 'text-yellow-400', 
        bgColor: 'bg-yellow-500/10', 
        borderColor: 'border-yellow-500/30', 
        icon: AlertTriangle,
        pulse: ''
      };
    } else {
      return { 
        color: 'text-green-400', 
        bgColor: 'bg-green-500/10', 
        borderColor: 'border-green-500/30', 
        icon: Coins,
        pulse: ''
      };
    }
  };

  const getStatusMessage = () => {
    const totalCoins = balance.total_coins || 0;
    const minimumRequired = balance.minimum_required || 30;
    
    if (totalCoins === 0) {
      return 'Sin monedas disponibles';
    } else if (totalCoins < minimumRequired) {
      return 'Monedas bajas - Considera recargar';
    } else if (totalCoins < minimumRequired * 2) {
      return 'Balance adecuado';
    } else {
      return 'Balance excelente';
    }
  };

  // 🔥 FUNCIONES ACTUALIZADAS: Usar purchased + gift en lugar de totalPurchased
  const getTotalPurchasedCoins = () => {
    return (balance.purchased_coins || 0) + (balance.gift_coins || 0);
  };

  const getUsageInfo = () => {
    // Para el porcentaje de uso, necesitaríamos datos de consumo histórico
    // Por ahora, usamos una estimación basada en el balance actual vs total
    const totalReceived = getTotalPurchasedCoins();
    const currentBalance = balance.total_coins || 0;
    const consumed = Math.max(0, totalReceived - currentBalance);
    
    return {
      consumed,
      totalReceived,
      usagePercentage: totalReceived > 0 ? Math.round((consumed / totalReceived) * 100) : 0,
      remainingPercentage: totalReceived > 0 ? Math.round((currentBalance / totalReceived) * 100) : 0
    };
  };

  const status = getBalanceStatus();
  const StatusIcon = status.icon;
  const usageInfo = getUsageInfo();

  if (loading) {
    return (
      <div className={`bg-[#2b2d31] rounded-xl border border-gray-600 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="animate-spin text-[#ff007a] mr-2" size={20} />
          <span className="text-white/70 text-sm">Cargando balance...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-[#2b2d31] rounded-xl border border-red-500/30 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="text-center">
          <AlertTriangle className="text-red-400 mx-auto mb-2" size={24} />
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={() => fetchBalance(true)}
            disabled={refreshing}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Cargando...' : 'Reintentar'}
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    // Vista compacta
    return (
      <div className={`bg-[#2b2d31] rounded-xl border ${status.borderColor} ${status.bgColor} p-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${status.bgColor} flex items-center justify-center ${status.pulse}`}>
              <StatusIcon className={status.color} size={20} />
            </div>
            <div>
              {/* 🔥 CAMBIO: Mostrar monedas como principal */}
              <div className="text-lg font-bold text-[#ff007a]">
                {formatCoins(balance.total_coins)} 
                <span className="text-xs text-white/60 ml-1">monedas</span>
              </div>
              <div className="text-xs text-blue-400">
                ≈ {formatMinutesFromCoins(balance.total_coins, balance.cost_per_minute)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {showDetails && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Toggle details"
              >
                {showDetails ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
            <button
              onClick={onBuyClick}
              className="bg-[#ff007a] hover:bg-[#e6006e] text-white p-2 rounded-lg transition-colors flex items-center gap-1"
              title="Comprar monedas"
            >
              <Plus size={16} />
              <span className="text-xs hidden sm:inline">Comprar</span>
            </button>
          </div>
        </div>

        {/* 🔥 NUEVA: Distribución de monedas */}
        {(balance.purchased_coins > 0 || balance.gift_coins > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#1a1c20] rounded p-2 text-center">
              <div className="text-[#ff007a] font-bold">{formatCoins(balance.purchased_coins)}</div>
              <div className="text-white/50">Compradas</div>
            </div>
            <div className="bg-[#1a1c20] rounded p-2 text-center">
              <div className="text-green-400 font-bold">{formatCoins(balance.gift_coins)}</div>
              <div className="text-white/50">Regalo</div>
            </div>
          </div>
        )}

        {/* Barra de progreso visual */}
        {usageInfo.totalReceived > 0 && (
          <div className="mt-3">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-[#ff007a] to-[#ff4499] h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(5, usageInfo.remainingPercentage)}%`
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-white/50 mt-1">
              <span>Usado: {formatCoins(usageInfo.consumed)}</span>
              <span>Total: {formatCoins(usageInfo.totalReceived)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-[#2b2d31] rounded-xl border ${status.borderColor} ${status.bgColor}`}>
      {showFullStats ? (
        // Vista completa con estadísticas
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {/* 🔥 CAMBIO: Clock -> Coins */}
              <Coins className="text-[#ff007a]" size={20} />
              Balance de Monedas
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchBalance(true)}
                disabled={refreshing}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                title="Actualizar balance"
              >
                <RefreshCw className={`text-white/60 ${refreshing ? 'animate-spin' : ''}`} size={16} />
              </button>
              {usageInfo.totalReceived > 0 && (
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Ver detalles"
                >
                  {showDetails ? <EyeOff className="text-white/60" size={16} /> : <Eye className="text-white/60" size={16} />}
                </button>
              )}
            </div>
          </div>

          {/* 🔥 BALANCE PRINCIPAL ACTUALIZADO */}
          <div className="text-center mb-6">
            <div className={`text-4xl font-bold text-[#ff007a] mb-2 ${status.pulse}`}>
              {formatCoins(balance.total_coins)} 
              <span className="text-lg text-white/60 ml-2">monedas</span>
            </div>
            <div className="text-xl text-blue-400 mb-2">
              ≈ {formatMinutesFromCoins(balance.total_coins, balance.cost_per_minute)} de videochat
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <StatusIcon className={status.color} size={16} />
              <span className={`text-sm ${status.color}`}>
                {getStatusMessage()}
              </span>
            </div>
            {balance.total_coins > 0 && (
              <div className="text-xs text-white/50">
                Costo: {balance.cost_per_minute} monedas por minuto
              </div>
            )}
          </div>

          {/* 🔥 ESTADÍSTICAS ACTUALIZADAS */}
          {showDetails && (balance.purchased_coins > 0 || balance.gift_coins > 0) && (
            <div className="grid grid-cols-2 gap-4 mb-6 animate-fadeIn">
              <div className="text-center bg-[#1a1c20] rounded-lg p-3 border border-[#ff007a]/20">
                <div className="text-xl font-bold text-[#ff007a] flex items-center justify-center gap-1">
                  <DollarSign size={16} />
                  {formatCoins(balance.purchased_coins)}
                </div>
                <div className="text-xs text-white/60">Monedas Compradas</div>
              </div>
              <div className="text-center bg-[#1a1c20] rounded-lg p-3 border border-green-500/20">
                <div className="text-xl font-bold text-green-400 flex items-center justify-center gap-1">
                  <Gift size={16} />
                  {formatCoins(balance.gift_coins)}
                </div>
                <div className="text-xs text-white/60">Monedas de Regalo</div>
              </div>
            </div>
          )}

          {/* 🔥 INFORMACIÓN ADICIONAL */}
          {showDetails && balance.total_coins > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#1a1c20] rounded-lg p-4 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-blue-400" size={16} />
                  <span className="text-sm font-semibold text-white">Tiempo Disponible</span>
                </div>
                <div className="text-lg font-bold text-blue-400">
                  {formatMinutesFromCoins(balance.total_coins, balance.cost_per_minute)}
                </div>
                <div className="text-xs text-white/50">
                  {Math.floor(balance.total_coins / balance.cost_per_minute)} minutos exactos
                </div>
              </div>
              
              <div className="bg-[#1a1c20] rounded-lg p-4 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="text-yellow-400" size={16} />
                  <span className="text-sm font-semibold text-white">Estado</span>
                </div>
                <div className={`text-lg font-bold ${status.color}`}>
                  {balance.total_coins >= balance.minimum_required ? 'Listo' : 'Insuficiente'}
                </div>
                <div className="text-xs text-white/50">
                  Mínimo: {balance.minimum_required} monedas
                </div>
              </div>
            </div>
          )}

          {/* Barra de progreso detallada */}
          {usageInfo.totalReceived > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-white/70 mb-2">
                <span>Progreso de uso</span>
                <span>{usageInfo.usagePercentage}% usado</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div className="relative h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-yellow-500 h-full transition-all duration-500"
                    style={{ width: `${usageInfo.remainingPercentage}%` }}
                  ></div>
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-red-500 h-full transition-all duration-500"
                    style={{ 
                      width: `${usageInfo.usagePercentage}%`,
                      marginLeft: `${usageInfo.remainingPercentage}%`
                    }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>Disponible: {formatCoins(balance.total_coins)}</span>
                <span>Consumido: {formatCoins(usageInfo.consumed)}</span>
              </div>
            </div>
          )}

          {/* 🔥 HISTORIAL ACTUALIZADO */}
          {showHistory && recentPurchases.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white/80 mb-3">Compras Recientes</h4>
              <div className="space-y-2">
                {recentPurchases.map((purchase) => (
                  <div key={purchase.id} className="flex items-center justify-between bg-[#1a1c20] p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#ff007a] rounded-full"></div>
                      <span className="text-sm text-white/70">
                        {formatCoins(purchase.total_coins)} monedas
                        {purchase.bonus_coins > 0 && (
                          <span className="text-green-400 text-xs ml-1">
                            (+{formatCoins(purchase.bonus_coins)})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-white/50">
                      ${purchase.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🔥 BOTÓN ACTUALIZADO */}
          <button
            onClick={onBuyClick}
            className="w-full bg-gradient-to-r from-[#ff007a] to-[#ff4499] hover:from-[#e6006e] hover:to-[#e6007a] text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 transform hover:scale-105"
          >
            <Plus size={18} />
            Comprar Monedas
          </button>

          {/* Última actualización */}
          {lastUpdate && (
            <div className="text-center mt-3">
              <span className="text-xs text-white/40">
                Actualizado: {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      ) : (
        // Vista estándar
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full ${status.bgColor} flex items-center justify-center ${status.pulse}`}>
                <StatusIcon className={status.color} size={24} />
              </div>
              <div>
                {/* 🔥 CAMBIO: Mostrar monedas como principal */}
                <div className="text-2xl font-bold text-[#ff007a]">
                  {formatCoins(balance.total_coins)}
                  <span className="text-sm text-white/60 ml-1">monedas</span>
                </div>
                <div className="text-sm text-blue-400">
                  ≈ {formatMinutesFromCoins(balance.total_coins, balance.cost_per_minute)}
                </div>
                <div className={`text-sm ${status.color}`}>
                  {getStatusMessage()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchBalance(true)}
                disabled={refreshing}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                title="Actualizar"
              >
                <RefreshCw className={`text-white/60 ${refreshing ? 'animate-spin' : ''}`} size={16} />
              </button>
              <button
                onClick={onBuyClick}
                className="bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                title="Comprar monedas"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Comprar</span>
              </button>
            </div>
          </div>

          {/* 🔥 DISTRIBUCIÓN DE MONEDAS */}
          {(balance.purchased_coins > 0 || balance.gift_coins > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-[#1a1c20] rounded-lg p-2 text-center border border-[#ff007a]/20">
                <div className="text-sm font-bold text-[#ff007a]">{formatCoins(balance.purchased_coins)}</div>
                <div className="text-xs text-white/60">Compradas</div>
              </div>
              <div className="bg-[#1a1c20] rounded-lg p-2 text-center border border-green-500/20">
                <div className="text-sm font-bold text-green-400">{formatCoins(balance.gift_coins)}</div>
                <div className="text-xs text-white/60">Regalo</div>
              </div>
            </div>
          )}

          {/* Barra de progreso */}
          {usageInfo.totalReceived > 0 && (
            <div className="mt-3">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#ff007a] to-[#ff4499] h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(5, usageInfo.remainingPercentage)}%`
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>Usado: {formatCoins(usageInfo.consumed)}</span>
                <span>Total: {formatCoins(usageInfo.totalReceived)}</span>
              </div>
            </div>
          )}

          {/* 🔥 ALERT ACTUALIZADO */}
          {balance.total_coins === 0 && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <Zap size={14} />
                <span>¡Compra monedas para hacer videollamadas!</span>
              </div>
            </div>
          )}

          {/* 🔥 NUEVA: Alert para balance bajo */}
          {balance.total_coins > 0 && balance.total_coins < balance.minimum_required && (
            <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle size={14} />
                <span>Balance bajo - Necesitas al menos {balance.minimum_required} monedas</span>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}