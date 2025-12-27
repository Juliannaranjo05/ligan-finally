import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../utils/logger';

const logger = createLogger('SessionSuspendedModal');
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ligando.duckdns.org';
const SESSION_SUSPENDED_FLAG = 'session_suspended';

const SessionSuspendedModal = () => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const timeoutRef = useRef(null);
  const isProcessingRef = useRef(false); // Prevenir múltiples procesamientos
  const modalVisibleRef = useRef(false); // Track si el modal está visible

  // Verificar localStorage al montar el componente
  useEffect(() => {
    const checkPersistedState = () => {
      try {
        const persisted = localStorage.getItem(SESSION_SUSPENDED_FLAG);
        const token = localStorage.getItem('token');
        
        // Solo mostrar modal si hay token disponible
        if (persisted === 'true' && token) {
          logger.info('Estado de sesión suspendida encontrado en localStorage, mostrando modal');
          modalVisibleRef.current = true;
          setShowModal(true);
          setErrorMessage(null);
        } else if (persisted === 'true' && !token) {
          // Si no hay token, limpiar el flag y redirigir
          logger.warn('Sesión suspendida pero no hay token, limpiando y redirigiendo');
          try {
            localStorage.removeItem(SESSION_SUSPENDED_FLAG);
            localStorage.removeItem('session_suspended');
            localStorage.removeItem('session_closed_by_other_device');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } catch (error) {
            logger.warn('Error al limpiar localStorage:', error);
          }
          // Forzar recarga completa para cerrar la sesión
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      } catch (error) {
        logger.warn('Error al leer localStorage:', error);
      }
    };

    checkPersistedState();
  }, []);

  // 🔥 FUNCIÓN PARA CERRAR MODAL Y LIMPIAR TODO
  const handleClose = React.useCallback(() => {
    // Limpiar timeout si existe
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    logger.info('Cerrando modal de sesión suspendida, limpiando localStorage y redirigiendo a /home');
    
    // Limpiar todos los datos de sesión
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem(SESSION_SUSPENDED_FLAG);
      localStorage.removeItem('session_suspended');
      localStorage.removeItem('session_closed_by_other_device');
      localStorage.removeItem('reclamando_sesion');
    } catch (error) {
      logger.warn('Error al limpiar localStorage:', error);
    }
    
    // Cerrar modal
    modalVisibleRef.current = false;
    setShowModal(false);
    
    // 🔥 FORZAR RECARGA COMPLETA - usar reload para cerrar completamente la sesión
    // Usar setTimeout para asegurar que el localStorage se limpie antes de recargar
    setTimeout(() => {
      // Forzar recarga completa de la página para cerrar la sesión completamente
      window.location.reload();
    }, 100);
  }, []);

  // Escuchar eventos de sesión suspendida
  useEffect(() => {
    const handleSessionSuspended = (event) => {
      // Prevenir procesamiento múltiple
      if (isProcessingRef.current) {
        logger.debug('⚠️ Evento sessionSuspended ignorado - ya se está procesando otro');
        return;
      }
      
      const { status, codigo, reason, action } = event.detail;
      
      logger.info('🔔 Evento sessionSuspended recibido', { status, codigo, reason, action });
      
      // Detectar cuando la sesión fue suspendida
      if ((status === 401 || status === 403) && codigo === 'SESSION_SUSPENDED') {
        isProcessingRef.current = true; // Marcar como procesando
        const token = localStorage.getItem('token');
        const finalAction = action || event.detail.detail?.action || '';
        const finalReason = reason || event.detail.detail?.reason || '';
        
        // 🔥 SI LA ACCIÓN ES "close_immediately" O LA RAZÓN ES "reactivada", CERRAR INMEDIATAMENTE SIN MODAL
        logger.info('🔍 Verificando acción y razón', { 
          finalAction, 
          finalReason, 
          action, 
          reason,
          shouldClose: finalAction === 'close_immediately' || 
                      finalReason === 'Otra sesión fue reactivada en otro dispositivo' || 
                      finalReason?.includes('reactivada') ||
                      finalReason?.includes('reactivó')
        });
        
        if (finalAction === 'close_immediately' || 
            finalReason === 'Otra sesión fue reactivada en otro dispositivo' || 
            finalReason?.includes('reactivada') ||
            finalReason?.includes('reactivó')) {
          logger.warn('⏸️ Sesión suspendida por reactivación de otra sesión - cerrando inmediatamente');
          console.warn('🔄 [SessionSuspendedModal] Cerrando sesión inmediatamente por reactivación');
          isProcessingRef.current = false; // Reset antes de recargar
          // Limpiar todo y recargar sin mostrar modal
          try {
            localStorage.clear(); // 🔥 LIMPIAR TODO
          } catch (error) {
            logger.warn('Error al limpiar localStorage:', error);
          }
          // 🔥 CERRAR INMEDIATAMENTE - Sin delays, sin setTimeout
          console.warn('🔄 [SessionSuspendedModal] Recargando página...');
          window.location.reload();
          return;
        }
        
        // Solo mostrar modal si hay token disponible Y no es por reactivación
        if (token) {
          // Si el modal ya está mostrándose, no hacer nada más
          if (modalVisibleRef.current) {
            logger.debug('⚠️ Modal ya está visible, ignorando evento duplicado');
            isProcessingRef.current = false;
            return;
          }
          
          logger.info('✅ Detectado SESSION_SUSPENDED (no por reactivación), mostrando modal INMEDIATAMENTE');
          // Guardar flag en localStorage para persistencia
          try {
            localStorage.setItem(SESSION_SUSPENDED_FLAG, 'true');
            localStorage.setItem('session_suspended', 'true');
          } catch (error) {
            logger.warn('Error al guardar flag en localStorage:', error);
          }
          
          // 🔥 MOSTRAR MODAL INMEDIATAMENTE - Sin delays
          modalVisibleRef.current = true;
          setShowModal(true);
          setErrorMessage(null);
          isProcessingRef.current = false; // Reset después de mostrar modal
          
          // 🔥 TIMEOUT: Si no se reclama en 5 minutos, limpiar localStorage y redirigir
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            logger.warn('Sesión suspendida no reclamada después de 5 minutos, limpiando y redirigiendo');
            handleClose();
          }, 5 * 60 * 1000); // 5 minutos
        } else {
          logger.warn('SESSION_SUSPENDED detectado pero no hay token, no mostrando modal');
          isProcessingRef.current = false;
          // Si no hay token, limpiar y redirigir inmediatamente
          handleClose();
        }
      }
    };

    // 🔥 ESCUCHAR TANTO sessionSuspended COMO axiosError (por si acaso)
    const handleAxiosError = (event) => {
      const { status, codigo, code } = event.detail;
      const finalCodigo = codigo || code;
      
      if ((status === 401 || status === 403) && finalCodigo === 'SESSION_SUSPENDED') {
        logger.info('🔔 axiosError con SESSION_SUSPENDED detectado, disparando sessionSuspended');
        // Disparar evento sessionSuspended para que se maneje igual
        const suspendedEvent = new CustomEvent("sessionSuspended", {
          detail: event.detail
        });
        window.dispatchEvent(suspendedEvent);
      }
    };

    logger.debug('Escuchando eventos sessionSuspended y axiosError');
    window.addEventListener('sessionSuspended', handleSessionSuspended);
    window.addEventListener('axiosError', handleAxiosError);
    
    return () => {
      logger.debug('Dejando de escuchar eventos');
      window.removeEventListener('sessionSuspended', handleSessionSuspended);
      window.removeEventListener('axiosError', handleAxiosError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [handleClose]);

  // 🔥 LIMPIAR TIMEOUT AL DESMONTAR COMPONENTE
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleReactivateSession = async () => {
    setIsReactivating(true);
    setErrorMessage(null);
    
    try {
      let token = localStorage.getItem('token');
      
      if (!token) {
        // Intentar obtener el token de sessionStorage como fallback
        token = sessionStorage.getItem('token');
        
        if (!token) {
          logger.error('No hay token disponible en localStorage ni sessionStorage');
          setErrorMessage(t('sessionSuspended.noToken') || 'No hay token disponible. Por favor, inicia sesión nuevamente.');
          setIsReactivating(false);
          
          // Limpiar flags y redirigir al login
          try {
            localStorage.removeItem(SESSION_SUSPENDED_FLAG);
            localStorage.removeItem('session_suspended');
            localStorage.removeItem('session_closed_by_other_device');
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } catch (error) {
            logger.warn('Error al limpiar flags:', error);
          }
          return;
        } else {
          // Si encontramos el token en sessionStorage, guardarlo en localStorage
          localStorage.setItem('token', token);
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/reactivar-sesion`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Limpiar timeout si existe
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Limpiar todos los flags relacionados con sesión suspendida
        try {
          localStorage.removeItem(SESSION_SUSPENDED_FLAG);
          localStorage.removeItem('session_suspended');
          localStorage.removeItem('session_closed_by_other_device');
        } catch (error) {
          logger.warn('Error al limpiar flags de localStorage:', error);
        }
        
        // Actualizar token si se retornó uno nuevo
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        
        // Limpiar caché de usuario para forzar recarga
        try {
          localStorage.removeItem('user');
        } catch (error) {
          logger.warn('Error al limpiar caché de usuario:', error);
        }
        
        // Cerrar modal
        modalVisibleRef.current = false;
        setShowModal(false);
        
        // 🔥 VERIFICAR INMEDIATAMENTE que el token sigue siendo válido
        // Hacer una petición rápida para verificar el estado
        try {
          const verifyResponse = await fetch(`${API_BASE_URL}/api/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.token || token}`,
            },
            body: JSON.stringify({
              activity_type: 'browsing',
              room: null
            })
          });
          
          if (verifyResponse.status === 401 || verifyResponse.status === 403) {
            const verifyData = await verifyResponse.json().catch(() => ({}));
            const verifyCodigo = verifyData.code || verifyData.codigo || '';
            
            if (verifyCodigo === 'SESSION_SUSPENDED') {
              // El token fue suspendido de nuevo, limpiar y recargar
              logger.warn('Token suspendido después de reactivar, limpiando y recargando');
              try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem(SESSION_SUSPENDED_FLAG);
                localStorage.removeItem('session_suspended');
              } catch (error) {
                // Ignorar errores
              }
              setTimeout(() => {
                window.location.reload();
              }, 500);
              return;
            }
          }
        } catch (verifyError) {
          logger.warn('Error verificando token después de reactivar:', verifyError);
        }
        
        // Esperar un momento antes de recargar para asegurar que los cambios se apliquen
        setTimeout(() => {
          // Recargar la página para aplicar el nuevo estado
          window.location.reload();
        }, 500);
      } else {
        const errorMsg = data.message || t('sessionSuspended.reactivateError') || 'Error al reactivar sesión';
        setErrorMessage(errorMsg);
        setIsReactivating(false);
      }
    } catch (error) {
      logger.error('Error al reactivar sesión', error);
      setErrorMessage(t('sessionSuspended.networkError') || 'Error de conexión. Por favor, intenta nuevamente.');
      setIsReactivating(false);
    }
  };

  if (!showModal) return null;

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
    >
      <div 
        className="bg-[#1f2125] border border-[#ff007a]/30 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fadeIn relative"
      >
        {/* Botón X para cerrar */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white mb-2">
              {t('sessionSuspended.title') || 'Se abrió una nueva sesión en otro dispositivo'}
            </h3>
            <p className="text-white/80 text-sm mb-4">
              {t('sessionSuspended.message') || 'Tu sesión actual ha sido suspendida porque se abrió una nueva sesión en otro dispositivo. Puedes continuar con esta sesión haciendo clic en el botón de abajo.'}
            </p>
            
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{errorMessage}</p>
              </div>
            )}
            
            <button
              onClick={handleReactivateSession}
              disabled={isReactivating}
              className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isReactivating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('sessionSuspended.reactivating') || 'Reactivando sesión...'}</span>
                </>
              ) : (
                t('sessionSuspended.continueSession') || 'Continuar con esta sesión'
              )}
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
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

export default SessionSuspendedModal;



