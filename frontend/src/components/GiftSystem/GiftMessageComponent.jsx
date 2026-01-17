import React, { useState, useEffect } from 'react';
import { Gift, Clock, Check, X, Sparkles } from 'lucide-react';

export const GiftMessageComponent = ({ 
  giftRequest, 
  isClient, 
  onAccept, 
  onReject, 
  className = "" 
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!giftRequest.expires_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiresAt = new Date(giftRequest.expires_at).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      
      setTimeRemaining(remaining);
      setIsExpired(remaining <= 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [giftRequest.expires_at]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-gradient-to-br from-[#ff007a]/20 to-[#cc0062]/20 border-2 border-[#ff007a]/50 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {/* Imagen del regalo */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center flex-shrink-0">
          <img 
            src={giftRequest.gift.image} 
            alt={giftRequest.gift.name}
            className="w-10 h-10 object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
              const fallback = e.target.parentNode.querySelector('.fallback-icon');
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div className="fallback-icon hidden w-10 h-10 items-center justify-center">
            <Gift size={20} className="text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Header del mensaje */}
          <div className="flex items-center gap-2 mb-2">
            <Gift size={16} className="text-[#ff007a]" />
            <span className="text-[#ff007a] font-bold text-sm">
              {isClient ? '¡Regalo pedido!' : '¡Pediste un regalo!'}
            </span>
            {!isExpired && (
              <div className="flex items-center gap-1 bg-[#ff007a]/20 px-2 py-1 rounded-full">
                <Clock size={12} className="text-[#ff007a]" />
                <span className="text-[#ff007a] text-xs font-mono">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}
          </div>

          {/* Información del regalo */}
          <div className="mb-3">
            <h4 className="text-white font-bold text-base mb-1">
              {giftRequest.gift.name}
            </h4>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-[#ff007a] to-[#cc0062] rounded-full text-white text-sm font-bold">
                <Sparkles size={12} />
                {giftRequest.gift.price}
              </div>
              <span className="text-white/60 text-sm">minutos</span>
            </div>
          </div>

          {/* Mensaje opcional */}
          {giftRequest.message && (
            <div className="bg-black/20 rounded-lg p-3 mb-3">
              <p className="text-white/80 text-sm italic">
                "{giftRequest.message}"
              </p>
            </div>
          )}

          {/* Estado y botones */}
          {isExpired ? (
            <div className="flex items-center gap-2 text-gray-400">
              <X size={16} />
              <span className="text-sm">Solicitud expirada</span>
            </div>
          ) : isClient ? (
            // Vista del cliente - puede aceptar o rechazar
            <div className="flex gap-2">
              <button
                onClick={() => onAccept(giftRequest.id)}
                className="flex-1 bg-gradient-to-r from-[#ff007a] to-[#cc0062] hover:from-[#e6006f] hover:to-[#b3005a] text-white px-4 py-2 rounded-lg font-bold text-sm transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                <Check size={16} />
                Enviar Regalo
              </button>
              <button
                onClick={() => onReject(giftRequest.id)}
                className="px-4 py-2 bg-gray-600/50 hover:bg-gray-600/70 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <X size={16} />
                Rechazar
              </button>
            </div>
          ) : (
            // Vista de la modelo - solo información
            <div className="flex items-center gap-2 text-[#ff007a]">
              <Clock size={16} />
              <span className="text-sm font-medium">Esperando respuesta...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};