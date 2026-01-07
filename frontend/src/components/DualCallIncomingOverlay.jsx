import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import audioManager from '../utils/AudioManager';

const DualCallIncomingOverlay = ({ 
  isVisible = false, 
  callData = null,
  onAnswer = () => {},
  onDecline = () => {}
}) => {
  const { t } = useTranslation();
  const [isResponding, setIsResponding] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // 🔥 FUNCIÓN PARA OBTENER INICIAL DEL NOMBRE
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // 🔥 RESETEAR ESTADO CUANDO LA LLAMADA DESAPARECE O CAMBIA
  useEffect(() => {
    if (!isVisible || !callData) {
      setIsResponding(false);
      setCallDuration(0);
      return;
    }
    
    setIsResponding(false);
  }, [isVisible, callData?.id]);
  
  // Timer para duración de llamada entrante
  useEffect(() => {
    let interval;
    if (isVisible && callData) {
      const startTime = callData.started_at ? new Date(callData.started_at).getTime() : Date.now();
      
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
  const handleAccept = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isResponding) return;
    
    setIsResponding(true);
        
    try {
      await onAnswer();
      setTimeout(() => {
        setIsResponding(false);
      }, 2000);
    } catch (error) {
      
      setIsResponding(false);
    }
  };

  // 🔥 FUNCIÓN: RECHAZAR LLAMADA
  const handleDecline = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isResponding) return;
    
    setIsResponding(true);
        
    try {
      await onDecline();
      setTimeout(() => {
        setIsResponding(false);
      }, 2000);
    } catch (error) {
      
      setIsResponding(false);
    }
  };

  // 🔥 FORMATEAR TIEMPO
  const formatTime = (seconds) => {
    return `${seconds}s`;
  };

  // 🔥 INTENTAR REPRODUCIR AUDIO CUANDO SE MUESTRA EL OVERLAY
  useEffect(() => {
    if (isVisible && callData) {
      window.dispatchEvent(new CustomEvent('userInteraction'));
      
      const tryPlayRingtone = async () => {
        try {
          if (audioManager && !audioManager.isAudioReady()) {
            
            const unlocked = await audioManager.initialize();
            if (!unlocked) {
              
              return;
            }
          }
          
          if (audioManager && typeof audioManager.playRingtone === 'function') {
            
            await audioManager.playRingtone();
          }
        } catch (err) {
          
        }
      };
      
      tryPlayRingtone();
    }
  }, [isVisible, callData]);

  if (!isVisible || !callData) return null;

  const cliente = callData.cliente || callData.caller || {};
  const otroModelo = callData.otro_modelo || callData.modelo1 || {};

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn"></div>
      
      {/* Contenido de llamada entrante 2vs1 */}
      <div className="relative z-10 bg-gradient-to-br from-[#1f2125] to-[#2a2d31] rounded-2xl p-8 shadow-2xl border border-[#ff007a]/30 max-w-md w-full mx-6 animate-slideUp">
        
        {/* Indicador de llamada entrante 2vs1 */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="w-5 h-5 text-[#ff007a]" />
            <div className="text-[#ff007a] text-sm font-semibold animate-pulse">
              Llamada 2vs1 Entrante
            </div>
          </div>
          <div className="text-white/60 text-xs">
            📹 Videollamada con otro modelo
          </div>
        </div>

        {/* Información del cliente */}
        <div className="mb-4">
          <div className="text-center mb-4">
            <p className="text-white/70 text-sm mb-2">Cliente:</p>
            {cliente.avatar_url ? (
              <img
                src={cliente.avatar_url}
                alt={cliente.display_name || cliente.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#ff007a] mx-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-gradient-to-br from-[#ff007a] to-[#cc0062] text-white mx-auto ${cliente.avatar_url ? 'hidden' : ''}`}>
              {getInitial(cliente.display_name || cliente.name)}
            </div>
            <h3 className="text-lg font-bold text-white mt-2">
              {cliente.display_name || cliente.name || 'Cliente'}
            </h3>
          </div>
        </div>

        {/* Información del otro modelo */}
        {otroModelo && (
          <div className="mb-4 p-3 bg-[#2b2d31] rounded-xl border border-[#ff007a]/20">
            <p className="text-white/70 text-sm mb-2 text-center">También participará:</p>
            <div className="flex items-center justify-center gap-3">
              {otroModelo.avatar_url ? (
                <img
                  src={otroModelo.avatar_url}
                  alt={otroModelo.display_name || otroModelo.name}
                  className="w-12 h-12 rounded-full object-cover border border-[#ff007a]/50"
                />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold bg-gradient-to-br from-[#ff007a]/50 to-[#cc0062]/50 text-white">
                  {getInitial(otroModelo.display_name || otroModelo.name)}
                </div>
              )}
              <span className="text-white font-medium">
                {otroModelo.display_name || otroModelo.name || 'Modelo'}
              </span>
            </div>
          </div>
        )}

        {/* Duración de la llamada */}
        <div className="bg-[#2b2d31] border border-[#ff007a]/20 rounded-xl p-3 mb-6">
          <p className="text-[#ff007a] font-semibold text-center">
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

        {/* Botones de acción */}
        <div className="flex justify-center gap-6">
          {/* Botón rechazar */}
          <button
            type="button"
            onClick={handleDecline}
            disabled={isResponding}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white p-4 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100"
          >
            <PhoneOff size={24} />
          </button>
          
          {/* Botón aceptar */}
          <button
            type="button"
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
            💡 Esta es una llamada 2vs1. El cliente hablará contigo y con otro modelo simultáneamente.
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

export default DualCallIncomingOverlay;





