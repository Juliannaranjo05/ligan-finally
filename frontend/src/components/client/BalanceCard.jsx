import React, { useState, memo } from 'react';
import { RefreshCw, Coins, Gift, DollarSign, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SkeletonLoader from './SkeletonLoader';

/**
 * BalanceCard - Componente mejorado para mostrar el saldo del usuario
 */
const BalanceCard = ({ 
  userBalance, 
  loadingBalance = false,
  checkingPayments = false,
  onRefresh,
  onVerifyPayments,
  isExpanded = false,
  onToggleExpand
}) => {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(null);

  if (!userBalance && !loadingBalance) return null;

  const totalCoins = userBalance?.total_coins || userBalance?.total_available || 0;
  const purchasedCoins = userBalance?.purchased_coins || userBalance?.purchased_balance || 0;
  const giftCoins = userBalance?.gift_coins || userBalance?.gift_balance || 0;
  const minutesAvailable = userBalance?.minutes_available || 0;

  // Calcular porcentaje para barra de progreso visual
  const maxMinutes = 100; // Puede ser configurable
  const progressPercentage = Math.min((minutesAvailable / maxMinutes) * 100, 100);

  return (
    <div className="border-b border-[#ff007a]/10 flex-shrink-0">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors group"
        aria-expanded={isExpanded}
        aria-label={t('clientInterface.yourBalance')}
      >
        {/* Contenido principal a la izquierda */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#ff007a] flex-shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-white whitespace-nowrap">
              {t('clientInterface.yourBalance')}
            </span>
          </div>
          
          {loadingBalance ? (
            <SkeletonLoader variant="text" width="60px" height="20px" />
          ) : (
            <span className="text-[#ff007a] font-bold text-base sm:text-lg">
              {minutesAvailable}
            </span>
          )}

          {/* Botón Verificar pagos en lugar del texto "Minutos:" */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVerifyPayments();
            }}
            disabled={checkingPayments}
            className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded border border-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 whitespace-nowrap flex items-center gap-1 ml-2"
            title={t('clientInterface.verifyPaymentsTitle')}
            aria-label={t('clientInterface.verifyPayments')}
          >
            {checkingPayments ? t('clientInterface.verifyingPayments') : t('clientInterface.verifyPayments')}
          </button>
        </div>

        {/* Botones a la derecha */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className="text-[#ff007a] hover:text-[#e6006e] transition-all duration-200 p-1.5 rounded-lg hover:bg-[#ff007a]/10 group-hover:rotate-180 flex-shrink-0"
            disabled={loadingBalance}
            title="Actualizar saldo"
            aria-label="Actualizar saldo"
          >
            {loadingBalance ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 transition-transform duration-500" />
            )}
          </button>
          <svg
            className={`w-5 h-5 text-white/60 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 animate-fadeIn">
          <div className="pt-2 sm:pt-3 space-y-2 sm:space-y-3">
            {/* Total */}
            <div className="flex justify-between items-center text-xs sm:text-sm group">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-white/70" />
                <span className="text-white/70">{t('clientInterface.total')}</span>
                <div 
                  className="relative"
                  onMouseEnter={() => setShowTooltip('total')}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <Info className="w-3 h-3 text-white/40 cursor-help" />
                  {showTooltip === 'total' && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-[#1f2125] text-white text-xs rounded border border-[#ff007a]/30 whitespace-nowrap z-10">
                      Saldo total disponible
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[#ff007a] font-semibold">
                {loadingBalance ? <SkeletonLoader variant="text" width="40px" height="16px" /> : totalCoins}
              </span>
            </div>

            {/* Saldo de minutos */}
            <div className="flex justify-between items-center text-xs sm:text-sm group">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-white/70" />
                <span className="text-white/70">Saldo de minutos</span>
                <div 
                  className="relative"
                  onMouseEnter={() => setShowTooltip('purchased')}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <Info className="w-3 h-3 text-white/40 cursor-help" />
                  {showTooltip === 'purchased' && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-[#1f2125] text-white text-xs rounded border border-[#ff007a]/30 whitespace-nowrap z-10">
                      Minutos comprados
                    </div>
                  )}
                </div>
              </div>
              <span className="text-white font-semibold">
                {loadingBalance ? <SkeletonLoader variant="text" width="40px" height="16px" /> : purchasedCoins}
              </span>
            </div>

            {/* Saldo de regalo */}
            <div className="flex justify-between items-center text-xs sm:text-sm group">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-white/70" />
                <span className="text-white/70">Saldo de regalo</span>
                <div 
                  className="relative"
                  onMouseEnter={() => setShowTooltip('gift')}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <Info className="w-3 h-3 text-white/40 cursor-help" />
                  {showTooltip === 'gift' && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-[#1f2125] text-white text-xs rounded border border-[#ff007a]/30 whitespace-nowrap z-10">
                      Minutos recibidos como regalo
                    </div>
                  )}
                </div>
              </div>
              <span className="text-white font-semibold">
                {loadingBalance ? <SkeletonLoader variant="text" width="40px" height="16px" /> : giftCoins}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(BalanceCard);
