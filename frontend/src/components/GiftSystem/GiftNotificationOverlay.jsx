import React, { useState, useRef, useEffect } from "react";
import { Gift, Clock, X, Sparkles } from "lucide-react";

export const GiftNotificationOverlay = ({ 
  pendingRequests, 
  onAccept, 
  onReject, 
  onClose,
  isVisible 
}) => {
  if (!isVisible || pendingRequests.length === 0) return null;

  const request = pendingRequests[0]; // Mostrar la primera solicitud

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] border-2 border-[#ff007a]/50 rounded-2xl shadow-2xl w-full max-w-md transform animate-scaleIn">
        {/* Header */}
        <div className="p-6 border-b border-[#ff007a]/20 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center mx-auto mb-4">
            <img 
              src={request.gift.image} 
              alt={request.gift.name}
              className="w-12 h-12 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                const fallback = e.target.parentNode.querySelector('.fallback-icon');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="fallback-icon hidden w-12 h-12 items-center justify-center">
              <Gift size={24} className="text-white" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">¡Regalo Pedido!</h3>
          <p className="text-[#ff007a] text-sm">
            {request.modelo.name} quiere que le envíes:
          </p>
        </div>

        {/* Contenido */}
        <div className="p-6">
          <div className="text-center mb-6">
            <h4 className="text-white font-bold text-lg mb-2">
              {request.gift.name}
            </h4>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#ff007a] to-[#cc0062] rounded-full text-white font-bold">
              <Sparkles size={16} />
              {request.gift.price} minutos
            </div>
          </div>

          {request.message && (
            <div className="bg-[#ff007a]/10 border border-[#ff007a]/30 rounded-lg p-3 mb-6">
              <p className="text-white text-sm text-center italic">
                "{request.message}"
              </p>
            </div>
          )}

          {/* Cuenta regresiva */}
          <div className="bg-black/30 rounded-lg p-3 mb-6 text-center">
            <div className="flex items-center justify-center gap-2 text-[#ff007a]">
              <Clock size={16} />
              <span className="text-sm font-medium">
                Expira en: <GiftTimer expiresAt={request.expires_at} />
              </span>
            </div>
          </div>
        </div>

        {/* 🔥 BOTONES CORREGIDOS - INTERCAMBIADOS */}
        <div className="p-6 border-t border-[#ff007a]/20 flex gap-3">
          {/* ❌ BOTÓN RECHAZAR (IZQUIERDA - GRIS) */}
          <button
            onClick={() => onReject(request.id)}
            className="flex-1 bg-gray-600/50 hover:bg-gray-600/70 text-white px-4 py-3 rounded-xl font-bold transition-all"
          >
            Rechazar
          </button>
          
          {/* ✅ BOTÓN ACEPTAR (DERECHA - ROSA) */}
          <button
            onClick={() => onAccept(request.id, request.security_hash)}
            className="flex-1 bg-gradient-to-r from-[#ff007a] to-[#cc0062] hover:from-[#e6006f] hover:to-[#b3005a] text-white px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
          >
            ¡Enviar Regalo!
          </button>
        </div>

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

// ==================== COMPONENTE TIMER ====================
const GiftTimer = ({ expiresAt }) => {
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiresTime = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresTime - now) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <span className="font-mono text-base font-bold">
      {formatTime(timeRemaining)}
    </span>
  );
};