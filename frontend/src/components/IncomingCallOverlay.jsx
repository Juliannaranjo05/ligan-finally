import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';

const IncomingCallOverlay = ({ 
  isVisible = false, 
  callData = null,
  onAnswer = () => {},
  onDecline = () => {}
}) => {
  const [isResponding, setIsResponding] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // 🔥 FUNCIÓN PARA OBTENER INICIAL DEL NOMBRE
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Timer para duración de llamada entrante
  useEffect(() => {
    let interval;
    if (isVisible && callData) {
      const startTime = new Date(callData.started_at).getTime();
      
      interval = setInterval(() => {
        const now = Date.now();
        const duration = Math.floor((now - startTime) / 1000);
        setCallDuration(duration);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVisible, callData]);

  // 🔥 FUNCIÓN: ACEPTAR LLAMADA
  const handleAccept = async () => {
    if (isResponding) return;
    
    setIsResponding(true);
        
    try {
      await onAnswer();
    } catch (error) {
            setIsResponding(false);
    }
  };

  // 🔥 FUNCIÓN: RECHAZAR LLAMADA
  const handleDecline = async () => {
    if (isResponding) return;
    
    setIsResponding(true);
        
    try {
      await onDecline();
    } catch (error) {
          } finally {
      setIsResponding(false);
    }
  };

  // 🔥 FORMATEAR TIEMPO
  const formatTime = (seconds) => {
    return `${seconds}s`;
  };

  if (!isVisible || !callData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn"></div>
      
      {/* Contenido de llamada entrante */}
      <div className="relative z-10 bg-gradient-to-br from-[#1f2125] to-[#2a2d31] rounded-2xl p-8 shadow-2xl border border-[#ff007a]/30 max-w-sm w-full mx-6 animate-slideUp">
        
        {/* Indicador de llamada entrante */}
        <div className="text-center mb-6">
          <div className="text-[#ff007a] text-sm font-semibold mb-2 animate-pulse">
            📞 LLAMADA ENTRANTE
          </div>
          <div className="text-white/60 text-xs">
            {callData.call_type === 'video' ? '📹 Videollamada' : '📞 Llamada de voz'}
          </div>
        </div>

        {/* Avatar del caller */}
        <div className="relative mb-6">
          <div className="w-32 h-32 mx-auto rounded-full flex items-center justify-center text-4xl font-bold bg-gradient-to-br from-[#ff007a] to-[#cc0062] text-white shadow-2xl">
            {callData.caller?.avatar ? (
              <img 
                src={callData.caller.avatar} 
                alt={callData.caller.name} 
                className="w-full h-full rounded-full object-cover" 
              />
            ) : (
              getInitial(callData.caller?.name)
            )}
          </div>
          
          {/* Anillo de animación */}
          <div className="absolute inset-0 rounded-full border-4 border-[#ff007a]/50 animate-ping"></div>
          <div className="absolute inset-2 rounded-full border-2 border-[#ff007a]/30 animate-pulse"></div>
        </div>
        
        {/* Nombre del caller */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">
            {callData.caller?.name || 'Usuario desconocido'}
          </h2>
          
          {/* Duración de la llamada */}
          <div className="bg-[#2b2d31] border border-[#ff007a]/20 rounded-xl p-3">
            <p className="text-[#ff007a] font-semibold">
              Llamando... ({formatTime(callDuration)})
            </p>
            <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
              <div 
                className="bg-[#ff007a] h-1 rounded-full transition-all duration-1000"
                style={{ 
                  width: `${Math.min((callDuration / 30) * 100, 100)}%`,
                  backgroundColor: callDuration > 25 ? '#ef4444' : '#ff007a' 
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-center gap-6">
          {/* Botón rechazar */}
          <button
            onClick={handleDecline}
            disabled={isResponding}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white p-4 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100"
          >
            <PhoneOff size={24} />
          </button>
          
          {/* Botón aceptar */}
          <button
            onClick={handleAccept}
            disabled={isResponding}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white p-4 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 animate-bounce"
          >
            <Phone size={24} />
          </button>
        </div>

        {/* Estado de respuesta */}
        {isResponding && (
          <div className="mt-4 text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#ff007a] border-t-transparent mx-auto mb-2"></div>
            <p className="text-white/60 text-sm">Procesando respuesta...</p>
          </div>
        )}

        {/* Información adicional */}
        <div className="mt-6 bg-[#2b2d31] border border-[#ff007a]/10 rounded-xl p-3 text-center">
          <p className="text-white/50 text-xs">
            💡 {callDuration > 25 ? 
              'La llamada expirará pronto' : 
              'Toca los botones para responder'
            }
          </p>
        </div>
      </div>

      {/* Estilos adicionales */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default IncomingCallOverlay;