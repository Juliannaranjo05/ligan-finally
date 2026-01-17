import React, { memo } from 'react';
import { RefreshCw, Coins } from 'lucide-react';
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
  onVerifyPayments
}) => {
  const { t } = useTranslation();

  if (!userBalance && !loadingBalance) return null;

  const minutesAvailable = userBalance?.minutes_available || 0;

  return (
    <div className="border-b border-[#ff007a]/10 flex-shrink-0">
      <div
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[#1f2125] transition-colors group"
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
        </div>
      </div>
    </div>
  );
};

export default memo(BalanceCard);
