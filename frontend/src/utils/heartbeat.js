// 🔥 /src/utils/heartbeat.js - Utilidad centralizada para heartbeats CON RATE LIMITING

import { useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 🔥 SISTEMA DE RATE LIMITING GLOBAL
class HeartbeatRateLimiter {
  constructor() {
    this.lastHeartbeat = 0;
    this.isBlocked = false;
    this.blockUntil = 0;
    this.consecutiveErrors = 0;
    this.minInterval = 20000; // 15 segundos mínimo entre heartbeats
  }

  canSendHeartbeat() {
    const now = Date.now();
    
    // Si estamos bloqueados temporalmente
    if (this.isBlocked && now < this.blockUntil) {
            return false;
    }
    
    // Si ha pasado el bloqueo, desbloqueamos
    if (this.isBlocked && now >= this.blockUntil) {
      this.isBlocked = false;
      this.consecutiveErrors = 0;
          }
    
    // Verificar intervalo mínimo
    if (now - this.lastHeartbeat < this.minInterval) {
            return false;
    }
    
    return true;
  }

  recordSuccess() {
    this.lastHeartbeat = Date.now();
    this.consecutiveErrors = 0;
  }

  recordError(isRateLimit = false) {
    this.consecutiveErrors++;
    
    if (isRateLimit || this.consecutiveErrors >= 3) {
      // Bloquear por tiempo exponencial
      const blockDuration = Math.min(30000 * Math.pow(2, this.consecutiveErrors), 300000); // Max 5 minutos
      this.blockUntil = Date.now() + blockDuration;
      this.isBlocked = true;
      
          }
  }

  getRecommendedInterval() {
    // Intervalo dinámico basado en errores
    const baseInterval = 15000;
    const multiplier = Math.min(1 + (this.consecutiveErrors * 0.5), 4); // Max 4x
    return Math.floor(baseInterval * multiplier);
  }
}

const rateLimiter = new HeartbeatRateLimiter();

// 🔥 FUNCIÓN PRINCIPAL OPTIMIZADA PARA ENVIAR HEARTBEAT
export const sendHeartbeat = async (activityType = 'browsing', room = null) => {
  // Verificar rate limiting
  if (!rateLimiter.canSendHeartbeat()) {
    return false;
  }

  try {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
            return false;
    }

    // Timeout para evitar requests colgados
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`${API_BASE_URL}/api/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        activity_type: activityType,
        room: room
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
            rateLimiter.recordError(true);
      return false;
    }

    // 🔥 MANEJAR RESPUESTAS OK (200) PERO CON success=false
    if (response.ok) {
      const data = await response.json();
      
      // Si el servidor devuelve success=false, no es un error crítico
      if (data.success === false) {
        console.warn('⚠️ [Heartbeat] Servidor reportó success=false, pero no es error de sesión:', data.error || data.message);
        rateLimiter.recordError(false);
        return false; // No disparar eventos de sesión cerrada
      }
      
      rateLimiter.recordSuccess();
      return true;
    } else {
      // 🔥 ERRORES 500 NO DEBEN DISPARAR MODAL DE SESIÓN CERRADA
      // Solo manejar errores de autenticación/autorización
      if (response.status === 500) {
        console.warn('⚠️ [Heartbeat] Error 500 del servidor, ignorando (no es problema de sesión)');
        rateLimiter.recordError(false);
        return false; // No disparar eventos de sesión cerrada
      }
      
      // 🔥 DETECTAR SESIÓN SUSPENDIDA O CERRADA POR OTRO DISPOSITIVO
      // SOLO para errores 401/403 con código específico
      if (response.status === 401 || response.status === 403) {
        try {
          const errorData = await response.json().catch(() => ({}));
          const codigo = errorData.code || errorData.codigo || '';
          
          if (codigo === 'SESSION_SUSPENDED') {
            // 🔥 VERIFICAR SI HAY UNA VIDEOLLAMADA ACTIVA - NO CERRAR SESIÓN DURANTE VIDEOLLAMADAS
            const roomName = localStorage.getItem('roomName') || sessionStorage.getItem('roomName');
            const inCall = localStorage.getItem('inCall') === 'true' || sessionStorage.getItem('inCall') === 'true';
            const videochatActive = localStorage.getItem('videochatActive') === 'true' || sessionStorage.getItem('videochatActive') === 'true';
            
            if (roomName || inCall || videochatActive) {
              console.warn('🎥 [Heartbeat] Videollamada activa - IGNORANDO sesión suspendida para evitar desconexión');
              return false; // No hacer nada durante videollamadas
            }
            
            const reason = errorData.reason || '';
            const action = errorData.action || '';
            
            // Solo cerrar inmediatamente si es por reactivación
            const shouldCloseImmediately = action === 'close_immediately' || 
                                          reason?.includes('reactivada') || 
                                          reason?.includes('reactivó') ||
                                          reason === 'Otra sesión fue reactivada en otro dispositivo';
            
            if (shouldCloseImmediately) {
              console.warn('⏸️ [Heartbeat] Sesión suspendida por reactivación - cerrando inmediatamente');
              // 🔥 LIMPIAR TODO Y RECARGAR INMEDIATAMENTE solo si es por reactivación
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch (error) {
                // Ignorar errores
              }
              // 🔥 RECARGAR INMEDIATAMENTE - Sin delays
              console.warn('🔄 [Heartbeat] Recargando página...');
              window.location.reload();
              return false;
            }
            
            // Si NO es por reactivación, disparar evento para que el modal lo maneje
            console.info('✅ [Heartbeat] Disparando evento sessionSuspended para que el modal lo maneje');
            const suspendedEvent = new CustomEvent("sessionSuspended", {
              detail: {
                status: response.status,
                codigo: codigo,
                code: codigo,
                reason,
                action,
                url: `${API_BASE_URL}/api/heartbeat`,
                method: 'POST',
              }
            });
            window.dispatchEvent(suspendedEvent);
            // No continuar
            return false;
          }
          
          if (codigo === 'SESSION_CLOSED_BY_OTHER_DEVICE') {
            console.warn('🚫 [Heartbeat] Sesión cerrada por otro dispositivo detectada');
            // Disparar evento para que SessionClosedAlert lo maneje
            const customEvent = new CustomEvent("axiosError", {
              detail: {
                status: response.status,
                mensaje: errorData.message || 'Se abrió tu cuenta en otro dispositivo',
                codigo: codigo,
                code: codigo,
                url: `${API_BASE_URL}/api/heartbeat`,
                method: 'POST',
              },
            });
            window.dispatchEvent(customEvent);
            // No registrar como error de rate limiting, es un error de sesión
            return false;
          }
        } catch (parseError) {
          // Si no se puede parsear el error, continuar con el flujo normal
        }
      }
      
            rateLimiter.recordError(false);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
          } else {
          // Si es un error de red pero no de abort, podría ser un problema de conexión
          // No disparar evento de sesión cerrada aquí, solo errores de red
          }
    rateLimiter.recordError(false);
    return false;
  }
};

// 🔥 HOOK PERSONALIZADO OPTIMIZADO PARA HEARTBEAT AUTOMÁTICO
export const useHeartbeat = (activityType = 'browsing', room = null, baseIntervalMs = 15000, enabled = true) => {
  const intervalRef = useRef(null);
  const isEnabledRef = useRef(enabled);
  const currentIntervalRef = useRef(baseIntervalMs);
  const sessionCheckIntervalRef = useRef(null);

  useEffect(() => {
    isEnabledRef.current = enabled;
  }, [enabled]);

  // 🔥 VERIFICACIÓN AGRESIVA DE SESIÓN SUSPENDIDA (cada 5 segundos)
  // ⚠️ DESHABILITADA DURANTE VIDEOLLAMADAS ACTIVAS para evitar desconexiones inesperadas
  useEffect(() => {
    if (!enabled) return;
    
    const checkSessionStatus = async () => {
      // 🔥 VERIFICAR SI HAY UNA VIDEOLLAMADA ACTIVA - NO CERRAR SESIÓN DURANTE VIDEOLLAMADAS
      const roomName = localStorage.getItem('roomName') || sessionStorage.getItem('roomName');
      const inCall = localStorage.getItem('inCall') === 'true' || sessionStorage.getItem('inCall') === 'true';
      const videochatActive = localStorage.getItem('videochatActive') === 'true' || sessionStorage.getItem('videochatActive') === 'true';
      
      // Si hay videollamada activa, NO verificar sesión suspendida (evitar desconexiones)
      if (roomName || inCall || videochatActive) {
        console.log('🎥 [SessionCheck] Videollamada activa detectada - omitiendo verificación de sesión suspendida');
        return;
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
          sessionCheckIntervalRef.current = null;
        }
        return;
      }
      
      try {
        // Usar un endpoint ligero para verificar el estado del token
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_BASE_URL}/api/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            activity_type: 'browsing',
            room: null
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 401 || response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          const codigo = errorData.code || errorData.codigo || '';
          
          if (codigo === 'SESSION_SUSPENDED') {
            // 🔥 VERIFICAR NUEVAMENTE SI HAY VIDEOLLAMADA ACTIVA (doble verificación)
            const currentRoomName = localStorage.getItem('roomName') || sessionStorage.getItem('roomName');
            const currentInCall = localStorage.getItem('inCall') === 'true' || sessionStorage.getItem('inCall') === 'true';
            const currentVideochatActive = localStorage.getItem('videochatActive') === 'true' || sessionStorage.getItem('videochatActive') === 'true';
            
            if (currentRoomName || currentInCall || currentVideochatActive) {
              console.warn('🎥 [SessionCheck] Videollamada activa - IGNORANDO sesión suspendida para evitar desconexión');
              return;
            }
            
            const reason = errorData.reason || '';
            const action = errorData.action || '';
            
            // Solo cerrar inmediatamente si es por reactivación
            const shouldCloseImmediately = action === 'close_immediately' || 
                                          reason?.includes('reactivada') || 
                                          reason?.includes('reactivó') ||
                                          reason === 'Otra sesión fue reactivada en otro dispositivo';
            
            if (shouldCloseImmediately) {
              console.warn('⏸️ [SessionCheck] Sesión suspendida por reactivación - cerrando inmediatamente');
              // Limpiar y recargar inmediatamente solo si es por reactivación
              try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('session_suspended');
                localStorage.removeItem('session_closed_by_other_device');
              } catch (error) {
                // Ignorar errores
              }
              // Detener el polling
              if (sessionCheckIntervalRef.current) {
                clearInterval(sessionCheckIntervalRef.current);
                sessionCheckIntervalRef.current = null;
              }
              // Forzar recarga
              setTimeout(() => {
                window.location.reload();
              }, 100);
              return;
            }
            
            // Si NO es por reactivación, disparar evento para que el modal lo maneje
            console.info('✅ [SessionCheck] Disparando evento sessionSuspended para que el modal lo maneje');
            const suspendedEvent = new CustomEvent("sessionSuspended", {
              detail: {
                status: response.status,
                codigo: codigo,
                code: codigo,
                reason,
                action,
                url: `${API_BASE_URL}/api/heartbeat`,
                method: 'POST',
              }
            });
            window.dispatchEvent(suspendedEvent);
            // NO detener el polling ni recargar - dejar que el modal decida
          }
        }
      } catch (error) {
        // Ignorar errores de red o timeout
        if (error.name !== 'AbortError' && error.name !== 'TimeoutError') {
          // Solo loggear errores no esperados
        }
      }
    };
    
    // Verificar cada 5 segundos si hay riesgo de sesión suspendida
    // Esto es más frecuente que el heartbeat normal para detectar cambios rápidamente
    sessionCheckIntervalRef.current = setInterval(checkSessionStatus, 5000);
    
    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [enabled]);

  const scheduleNextHeartbeat = () => {
    if (!isEnabledRef.current) return;
    
    // Usar intervalo dinámico basado en errores
    const dynamicInterval = Math.max(rateLimiter.getRecommendedInterval(), baseIntervalMs);
    currentIntervalRef.current = dynamicInterval;
    
    intervalRef.current = setTimeout(async () => {
      if (isEnabledRef.current) {
        await sendHeartbeat(activityType, room);
        scheduleNextHeartbeat(); // Programar el siguiente
      }
    }, dynamicInterval);
  };

  if (!navigator.onLine) {
      return false;
  }


  useEffect(() => {
    if (!isEnabledRef.current) return;

    
    // Heartbeat inicial
    sendHeartbeat(activityType, room).then(() => {
      // Programar siguientes heartbeats
      scheduleNextHeartbeat();
    });

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      
      // 🔥 CLEANUP: Volver a browsing al desmontar (con rate limiting)
      if (activityType !== 'browsing' && isEnabledRef.current) {
                setTimeout(() => {
          sendHeartbeat('browsing', null);
        }, 1000); // Delay para evitar rate limiting
      }
    };
  }, [activityType, room, baseIntervalMs, enabled]);

  // Función para cambiar estado manualmente
  const changeActivity = async (newActivityType, newRoom = null) => {
        return await sendHeartbeat(newActivityType, newRoom);
  };

  return { 
    changeActivity,
    getCurrentInterval: () => currentIntervalRef.current,
    isRateLimited: () => rateLimiter.isBlocked
  };
};

// 🔥 HOOK ESPECIALIZADO PARA COMPONENTES DE VIDEOCHAT (MÁS CONSERVADOR)
export const useVideoChatHeartbeat = (roomName, role = 'modelo') => {
  const activityType = role === 'modelo' ? 'videochat' : 'videochat_client';
  
  // Intervalo más largo para videochat para evitar rate limiting
  return useHeartbeat(activityType, roomName, HEARTBEAT_INTERVALS.SLOW, !!roomName);
};

// 🔥 HOOK PARA COMPONENTES DE BÚSQUEDA (CONSERVADOR)
export const useSearchHeartbeat = (roomName, isSearching = true) => {
  const activityType = isSearching ? 'searching' : 'browsing';
  
  // Intervalo más largo para búsqueda
  return useHeartbeat(activityType, roomName, 18000, isSearching);
};

// 🔥 HOOK PARA COMPONENTES DE NAVEGACIÓN (MUY CONSERVADOR)
export const useBrowsingHeartbeat = (intervalMs = 25000) => {
  return useHeartbeat('browsing', null, intervalMs);
};

// 🔥 CONSTANTES ACTUALIZADAS CON INTERVALOS MÁS LARGOS
export const ACTIVITY_TYPES = {
  // ✅ Disponibles para emparejamiento
  BROWSING: 'browsing',
  SEARCHING: 'searching', 
  IDLE: 'idle',
  
  // ❌ No disponibles para emparejamiento
  VIDEOCHAT: 'videochat',
  VIDEOCHAT_CLIENT: 'videochat_client',
  VIDEOCHAT_MODEL: 'videochat_model'
};

export const HEARTBEAT_INTERVALS = {
  FAST: 15000,    // 15 segundos - Mínimo absoluto
  NORMAL: 20000,  // 20 segundos - Para videochat
  SLOW: 25000,    // 25 segundos - Para navegación
  VERY_SLOW: 30000 // 30 segundos - Para estados idle
};

// 🔥 FUNCIÓN PARA VERIFICAR SI UN ESTADO ESTÁ DISPONIBLE PARA EMPAREJAMIENTO
export const isAvailableForMatching = (activityType) => {
  const availableTypes = [
    ACTIVITY_TYPES.BROWSING,
    ACTIVITY_TYPES.SEARCHING,
    ACTIVITY_TYPES.IDLE
  ];
  
  return availableTypes.includes(activityType);
};

// 🔥 FUNCIÓN OPTIMIZADA PARA LIMPIAR HEARTBEAT AL CERRAR VENTANA
export const setupHeartbeatCleanup = () => {
  const cleanup = () => {
    // Usar sendBeacon para envío confiable al cerrar
    const authToken = localStorage.getItem('token');
    if (authToken && navigator.sendBeacon) {
      const formData = new FormData();
      formData.append('activity_type', 'idle');
      formData.append('room', '');
      
      // Agregar token al FormData
      formData.append('Authorization', `Bearer ${authToken}`);
      
      navigator.sendBeacon(`${API_BASE_URL}/api/heartbeat`, formData);
          }
  };

  // Throttle para visibilitychange
  let visibilityTimeout = null;
  const handleVisibilityChange = () => {
    if (visibilityTimeout) clearTimeout(visibilityTimeout);
    
    visibilityTimeout = setTimeout(() => {
      if (document.hidden) {
        sendHeartbeat('idle', null);
      } else {
        sendHeartbeat('browsing', null);
      }
    }, 2000); // Delay para evitar cambios rápidos
  };

  // Limpiar al cerrar ventana/pestaña
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('unload', cleanup);
  
  // Limpiar al perder visibilidad (con throttle)
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('beforeunload', cleanup);
    window.removeEventListener('unload', cleanup);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (visibilityTimeout) clearTimeout(visibilityTimeout);
  };
};

// 🔥 FUNCIÓN PARA OBTENER ESTADÍSTICAS DE RATE LIMITING
export const getHeartbeatStats = () => {
  return {
    isBlocked: rateLimiter.isBlocked,
    blockUntil: rateLimiter.blockUntil,
    consecutiveErrors: rateLimiter.consecutiveErrors,
    lastHeartbeat: rateLimiter.lastHeartbeat,
    recommendedInterval: rateLimiter.getRecommendedInterval(),
    timeUntilNextAllowed: Math.max(0, rateLimiter.minInterval - (Date.now() - rateLimiter.lastHeartbeat))
  };
};

export default {
  sendHeartbeat,
  useHeartbeat,
  useVideoChatHeartbeat,
  useSearchHeartbeat,
  useBrowsingHeartbeat,
  ACTIVITY_TYPES,
  HEARTBEAT_INTERVALS,
  isAvailableForMatching,
  setupHeartbeatCleanup,
  getHeartbeatStats
};