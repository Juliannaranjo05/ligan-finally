import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import audioManager from '../utils/AudioManager';

const IncomingCallOverlay = ({ 
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
    
    // Si la llamada cambia (nueva llamada), resetear el estado de respuesta
    setIsResponding(false);
  }, [isVisible, callData?.id]);
  
  // 🔥 TIMEOUT DE SEGURIDAD: Resetear estado si se queda atascado después de 10 segundos
  useEffect(() => {
    if (!isVisible || !isResponding) return;
    
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ [IncomingCall] Estado isResponding atascado, reseteando...');
      setIsResponding(false);
    }, 10000);
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [isVisible, isResponding]);

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
  const handleAccept = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isResponding) return;
    
    setIsResponding(true);
        
    try {
      await onAnswer();
      // Si la respuesta es exitosa, el componente se ocultará automáticamente
      // pero por si acaso, resetear después de un tiempo
      setTimeout(() => {
        setIsResponding(false);
      }, 2000);
    } catch (error) {
      console.error('Error aceptando llamada:', error);
      // Resetear estado en caso de error
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
      // Si el rechazo es exitoso, el componente se ocultará automáticamente
      // pero por si acaso, resetear después de un tiempo
      setTimeout(() => {
        setIsResponding(false);
      }, 2000);
    } catch (error) {
      console.error('Error rechazando llamada:', error);
      // Resetear estado en caso de error
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
      // 🔥 DISPARAR INTERACCIÓN AUTOMÁTICA INMEDIATAMENTE cuando se muestra el overlay
      // Esto desbloquea el audio y permite que suene el ringtone
      window.dispatchEvent(new CustomEvent('userInteraction'));
      
      // 🔥 INTENTAR REPRODUCIR EL RINGTONE DIRECTAMENTE
      // Primero intentar desbloquear el audio si no está desbloqueado
      const tryPlayRingtone = async () => {
        try {
          // Si el audio no está desbloqueado, intentar desbloquearlo primero
          if (audioManager && !audioManager.isAudioReady()) {
            console.log('🔓 [IncomingCallOverlay] Audio no desbloqueado, intentando desbloquear...');
            const unlocked = await audioManager.initialize();
            if (!unlocked) {
              console.warn('⚠️ [IncomingCallOverlay] No se pudo desbloquear el audio');
              return;
            }
          }
          
          // Intentar reproducir el ringtone
          if (audioManager && typeof audioManager.playRingtone === 'function') {
            console.log('📞 [IncomingCallOverlay] Intentando reproducir ringtone cuando se muestra el overlay');
            const success = await audioManager.playRingtone();
            if (success) {
              console.log('✅ [IncomingCallOverlay] Ringtone reproducido exitosamente');
            } else {
              console.warn('⚠️ [IncomingCallOverlay] No se pudo reproducir ringtone');
            }
          }
        } catch (err) {
          console.warn('⚠️ [IncomingCallOverlay] Error al reproducir ringtone:', err);
        }
      };
      
      // Ejecutar inmediatamente (sin delay) para que suene lo antes posible
      tryPlayRingtone();
    }
  }, [isVisible, callData]);

  // 🔥 INTENTAR REPRODUCIR AUDIO PENDIENTE CUANDO EL USUARIO INTERACTÚE CON EL OVERLAY
  const handleOverlayInteraction = (e) => {
    // Solo disparar si se hace click en el backdrop, no en el contenido
    if (e.target === e.currentTarget) {
      window.dispatchEvent(new CustomEvent('userInteraction'));
    }
  };

  if (!isVisible || !callData) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn"
        onClick={handleOverlayInteraction}
        onTouchStart={handleOverlayInteraction}
      ></div>
      
      {/* Contenido de llamada entrante */}
      <div 
        className="relative z-10 bg-gradient-to-br from-[#1f2125] to-[#2a2d31] rounded-2xl p-8 shadow-2xl border border-[#ff007a]/30 max-w-sm w-full mx-6 animate-slideUp"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        
        {/* Indicador de llamada entrante */}
        <div className="text-center mb-6">
          <div className="text-[#ff007a] text-sm font-semibold mb-2 animate-pulse">
            📞 {t('callModals.incoming.incomingCall')}
          </div>
          <div className="text-white/60 text-xs">
            {callData.call_type === 'video' ? `📹 ${t('callModals.incoming.videoCall')}` : `📞 ${t('callModals.incoming.voiceCall')}`}
          </div>
        </div>

        {/* Avatar del caller */}
        <div className="relative mb-6 flex items-center justify-center">
          {callData.caller?.avatar_url ? (
            <img
              src={callData.caller.avatar_url}
              alt={callData.caller?.display_name || callData.caller?.name}
              className="w-32 h-32 rounded-full object-cover border-4 border-[#ff007a] shadow-2xl relative z-10"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold bg-gradient-to-br from-[#ff007a] to-[#cc0062] text-white shadow-2xl relative z-10 ${callData.caller?.avatar_url ? 'hidden' : ''}`}>
            {getInitial(callData.caller?.display_name || callData.caller?.name)}
          </div>
          
          {/* Anillo de animación */}
          <div className="absolute w-32 h-32 rounded-full border-4 border-[#ff007a]/50 animate-ping"></div>
          <div className="absolute w-28 h-28 rounded-full border-2 border-[#ff007a]/30 animate-pulse"></div>
        </div>
        
        {/* Nombre del caller */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">
            {callData.caller?.display_name || callData.caller?.name || 'Usuario desconocido'}
          </h2>
          
          {/* Duración de la llamada */}
          <div className="bg-[#2b2d31] border border-[#ff007a]/20 rounded-xl p-3">
            <p className="text-[#ff007a] font-semibold">
              {t('callModals.incoming.calling')} ({formatTime(callDuration)})
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
            <p className="text-white/60 text-sm">{t('callModals.incoming.processingResponse')}</p>
          </div>
        )}

        {/* Información adicional */}
        <div className="mt-6 bg-[#2b2d31] border border-[#ff007a]/10 rounded-xl p-3 text-center">
          <p className="text-white/50 text-xs">
            💡 {callDuration > 25 ? 
              t('callModals.incoming.callExpiringSoon') : 
              t('callModals.incoming.tapToRespond')
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