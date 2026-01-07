import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Gift, Timer, ArrowRight, Info, AlertCircle, CheckCircle } from 'lucide-react';

const ConvertMinutesToGiftsModal = ({ 
  isOpen, 
  onClose, 
  remainingMinutes, 
  purchasedBalance,
  giftBalance,
  onConversionSuccess 
}) => {
  const { t } = useTranslation();
  const [minutesToConvert, setMinutesToConvert] = useState(2);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Calcular valores de conversión
  const COINS_PER_MINUTE = 10;
  const PURCHASED_COINS_PER_GIFT_COIN = 20;
  const MINUTES_PER_GIFT_COIN = 2; // 2 minutos = 1 gift coin

  const purchasedCoinsNeeded = minutesToConvert * COINS_PER_MINUTE;
  const giftCoinsToReceive = Math.floor(purchasedCoinsNeeded / PURCHASED_COINS_PER_GIFT_COIN);
  const maxConvertibleMinutes = Math.floor(remainingMinutes);

  useEffect(() => {
    if (isOpen) {
      setMinutesToConvert(2); // Valor mínimo por defecto
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleConvert = async () => {
    if (minutesToConvert < 2) {
      setError(t('convertMinutesToGifts.errorMinMinutes'));
      return;
    }

    if (minutesToConvert > maxConvertibleMinutes) {
      setError(t('convertMinutesToGifts.errorMaxMinutes', { max: maxConvertibleMinutes }));
      return;
    }

    setIsConverting(true);
    setError(null);
    setSuccess(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/client-balance/convert-minutes-to-gifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          minutes: minutesToConvert
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('convertMinutesToGifts.errorProcessing'));
      }

      if (data.success) {
        setSuccess(data.message || t('convertMinutesToGifts.success'));
        
        // Llamar callback para actualizar balances
        if (onConversionSuccess) {
          setTimeout(() => {
            onConversionSuccess();
            onClose();
          }, 1500);
        } else {
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      setError(err.message || t('convertMinutesToGifts.errorConverting'));
    } finally {
      setIsConverting(false);
    }
  };

  const handleMinutesChange = (value) => {
    const numValue = parseInt(value) || 0;
    if (numValue < 2) {
      setMinutesToConvert(2);
    } else if (numValue > maxConvertibleMinutes) {
      setMinutesToConvert(maxConvertibleMinutes);
    } else {
      setMinutesToConvert(numValue);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-700/50 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff007a] to-pink-600 p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-white" />
            <h2 className="text-lg font-bold text-white">
              {t('convertMinutesToGifts.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Tasa simple */}
          <div className="text-center">
            <p className="text-sm text-gray-400">
              <span className="text-yellow-400 font-semibold">{t('convertMinutesToGifts.minutesLabel')}</span> = <span className="text-pink-400 font-semibold">{t('convertMinutesToGifts.giftLabel')}</span>
            </p>
          </div>

          {/* Input de conversión */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              {t('convertMinutesToGifts.minutesToConvert')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="2"
                max={maxConvertibleMinutes}
                value={minutesToConvert}
                onChange={(e) => handleMinutesChange(e.target.value)}
                className="flex-1 bg-gray-800/50 border border-gray-700 text-white rounded-xl px-4 py-3 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff007a]/50 focus:border-[#ff007a]"
                placeholder="2"
              />
              <button
                onClick={() => setMinutesToConvert(Math.max(2, Math.floor(maxConvertibleMinutes / 2)))}
                className="px-3 py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-colors"
                title={t('convertMinutesToGifts.half')}
              >
                ½
              </button>
              <button
                onClick={() => setMinutesToConvert(maxConvertibleMinutes)}
                className="px-3 py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-colors"
                title={t('convertMinutesToGifts.max')}
              >
                {t('convertMinutesToGifts.max')}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center">
              {t('convertMinutesToGifts.available')}: {remainingMinutes} {t('convertMinutesToGifts.min')} | {t('convertMinutesToGifts.youWillReceive')}: <span className="text-pink-400 font-semibold">{giftCoinsToReceive} {giftCoinsToReceive !== 1 ? t('convertMinutesToGifts.gifts') : t('convertMinutesToGifts.gift')}</span>
            </p>
          </div>

          {/* Resumen simple */}
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-300">{minutesToConvert} min</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500" />
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-pink-400" />
                <span className="text-sm font-semibold text-pink-400">{giftCoinsToReceive} {giftCoinsToReceive !== 1 ? t('convertMinutesToGifts.gifts') : t('convertMinutesToGifts.gift')}</span>
              </div>
            </div>
          </div>

          {/* Mensajes de error/success */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400 flex-1">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-400 flex-1">{success}</p>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isConverting}
              className="flex-1 px-4 py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('convertMinutesToGifts.cancel')}
            </button>
            <button
              onClick={handleConvert}
              disabled={isConverting || minutesToConvert < 2 || minutesToConvert > maxConvertibleMinutes || giftCoinsToReceive < 1}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#ff007a] to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isConverting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{t('convertMinutesToGifts.converting')}</span>
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  <span>{t('convertMinutesToGifts.convert')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConvertMinutesToGiftsModal;

