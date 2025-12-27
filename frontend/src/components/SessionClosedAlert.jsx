import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../utils/logger';

const logger = createLogger('SessionClosedAlert');
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ligando.duckdns.org';

const SESSION_CLOSED_FLAG = 'session_closed_by_other_device';

const SessionClosedAlert = () => {
  const { t } = useTranslation();
  const [showAlert, setShowAlert] = useState(false);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const hasShownAlert = useRef(false);

  // Verificar localStorage al montar el componente
  useEffect(() => {
    const checkPersistedState = () => {
      try {
        const persisted = localStorage.getItem(SESSION_CLOSED_FLAG);
        if (persisted === 'true' && !hasShownAlert.current) {
          logger.info('Estado de sesión cerrada encontrado en localStorage, mostrando alerta');
          hasShownAlert.current = true;
          setShowAlert(true);
          setErrorMessage(null);
          setIsSuccess(false);
        }
      } catch (error) {
        logger.warn('Error al leer localStorage:', error);
      }
    };

    checkPersistedState();
  }, []);

  useEffect(() => {
    const handleAxiosError = (event) => {
      const { status, codigo, url } = event.detail;
      
      logger.debug('Evento recibido', { status, codigo, url });
      
      // Detectar cuando la sesión fue cerrada por otro dispositivo
      if ((status === 401 || status === 403) && codigo === 'SESSION_CLOSED_BY_OTHER_DEVICE') {
        logger.info('Detectado SESSION_CLOSED_BY_OTHER_DEVICE, mostrando alerta');
        // Guardar flag en localStorage para persistencia
        try {
          localStorage.setItem(SESSION_CLOSED_FLAG, 'true');
        } catch (error) {
          logger.warn('Error al guardar en localStorage:', error);
        }
        
        // Solo mostrar una vez por sesión para evitar múltiples alertas
        if (!hasShownAlert.current) {
          hasShownAlert.current = true;
          setShowAlert(true);
          setErrorMessage(null);
          setIsSuccess(false);
          logger.debug('Alerta mostrada');
        } else {
          logger.debug('Alerta ya mostrada anteriormente, ignorando');
        }
      } else {
        logger.debug('Evento no es SESSION_CLOSED_BY_OTHER_DEVICE, ignorando');
      }
    };

    logger.debug('Escuchando eventos axiosError');
    window.addEventListener('axiosError', handleAxiosError);
    
    return () => {
      logger.debug('Dejando de escuchar eventos axiosError');
      window.removeEventListener('axiosError', handleAxiosError);
    };
  }, []);

  const handleContinueSession = async () => {
    setIsReclaiming(true);
    setErrorMessage(null);
    setIsSuccess(false);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setErrorMessage(t('sessionClosed.noToken') || 'No hay token disponible');
        setIsReclaiming(false);
        return;
      }

      // Cerrar videollamada activa si existe antes de reclamar sesión
      if (window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
        logger.info('Cerrando videollamada activa antes de reclamar sesión');
        try {
          await window.livekitRoom.disconnect();
          logger.info('Videollamada cerrada correctamente');
        } catch (error) {
          logger.warn('Error al cerrar videollamada:', error);
          // Continuar de todas formas
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/reclamar-sesion`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        // Actualizar el token en localStorage
        if (data.nuevo_token) {
          localStorage.setItem('token', data.nuevo_token);
          setIsSuccess(true);
          
          // Limpiar flag de sesión cerrada
          try {
            localStorage.removeItem(SESSION_CLOSED_FLAG);
          } catch (error) {
            logger.warn('Error al limpiar flag de localStorage:', error);
          }
          
          // Limpiar datos de videollamada si existen
          localStorage.removeItem('roomName');
          localStorage.removeItem('userName');
          sessionStorage.removeItem('roomName');
          sessionStorage.removeItem('userName');
          sessionStorage.removeItem('currentRoom');
          sessionStorage.removeItem('inCall');
          sessionStorage.removeItem('videochatActive');
          
          // Esperar un momento para mostrar el éxito antes de recargar
          setTimeout(() => {
            // Resetear el flag para permitir que se muestre de nuevo si es necesario
            hasShownAlert.current = false;
            setShowAlert(false);
            
            // Recargar la página para aplicar el nuevo token
            window.location.reload();
          }, 1000);
        } else {
          setErrorMessage(t('sessionClosed.invalidResponse') || 'Respuesta inválida del servidor');
          setIsReclaiming(false);
        }
      } else {
        const errorMsg = data.message || t('sessionClosed.reclaimError') || 'Error al reclamar sesión';
        setErrorMessage(errorMsg);
        setIsReclaiming(false);
        
        // Si el error es 401, el token ya no es válido, limpiar y redirigir a /home
        if (response.status === 401) {
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem(SESSION_CLOSED_FLAG);
          } catch (error) {
            logger.warn('Error al limpiar datos de sesión:', error);
          }
          // Redirigir inmediatamente a /home
          window.location.href = '/home';
        }
      }
    } catch (error) {
      logger.error('Error al reclamar sesión', error);
      setErrorMessage(t('sessionClosed.networkError') || 'Error de conexión. Por favor, intenta nuevamente.');
      setIsReclaiming(false);
    }
  };

  const handleClose = () => {
    hasShownAlert.current = false;
    setShowAlert(false);
    setErrorMessage(null);
    setIsSuccess(false);
    
    // Limpiar flag de sesión cerrada
    try {
      localStorage.removeItem(SESSION_CLOSED_FLAG);
    } catch (error) {
      logger.warn('Error al limpiar flag de localStorage:', error);
    }
    
    // Limpiar token y redirigir a /home inmediatamente
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (error) {
      logger.warn('Error al limpiar token de localStorage:', error);
    }
    
    // Redirigir a /home para iniciar sesión nuevamente
    window.location.href = '/home';
  };

  if (!showAlert) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
      style={{
        pointerEvents: 'auto',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh'
      }}
      onClick={(e) => {
        // Prevenir clics fuera del modal
        e.stopPropagation();
      }}
    >
      <div 
        className="bg-[#1f2125] border border-[#ff007a]/30 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fadeIn"
        onClick={(e) => {
          // Prevenir que los clics dentro del modal se propaguen
          e.stopPropagation();
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {isSuccess ? (
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white mb-2">
              {isSuccess 
                ? (t('sessionClosed.successTitle') || 'Sesión reclamada')
                : (t('sessionClosed.title') || 'Sesión abierta en otro dispositivo')
              }
            </h3>
            <p className="text-white/80 text-sm mb-4">
              {isSuccess 
                ? (t('sessionClosed.successMessage') || 'Tu sesión ha sido reclamada exitosamente. Recargando...')
                : (t('sessionClosed.message') || 'No se puede continuar con la sesión ya que fue abierta en otro dispositivo. Puedes continuar con esta sesión haciendo clic en el botón de abajo.')
              }
            </p>
            
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{errorMessage}</p>
              </div>
            )}
            
            {!isSuccess && (
              <div className="flex gap-3">
                <button
                  onClick={handleContinueSession}
                  disabled={isReclaiming}
                  className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isReclaiming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('sessionClosed.reclaiming')}</span>
                    </>
                  ) : (
                    t('sessionClosed.continueSession') || 'Continuar con esta sesión'
                  )}
                </button>
                
                <button
                  onClick={handleClose}
                  disabled={isReclaiming}
                  className="px-4 py-2 text-white/60 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('common.close') || 'Cerrar'}
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default SessionClosedAlert;

