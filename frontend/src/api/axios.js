import axios from "axios";
import { createLogger } from "../utils/logger";

const logger = createLogger("Axios");

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://ligando.duckdns.org',
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// 👉 Interceptor para añadir token
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 👉 Variable para evitar bucles infinitos
let isRefreshing = false;
let hasLoggedOut = false;

// 👉 Interceptor mejorado para capturar errores globales
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config || {};

    // Saltar si está marcado para omitir
    if (config.skipInterceptor) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const mensaje = error.response?.data?.message || "";
    // Asegurar que se capture tanto 'code' como 'codigo' por compatibilidad
    const codigo = error.response?.data?.code || error.response?.data?.codigo || "";
    const url = error.config?.url || "";

    // 🆕 NO INTERCEPTAR errores 409 de sesión duplicada en LOGIN
    if (status === 409 && codigo === 'SESSION_DUPLICATED' && url.includes('/login')) {
            return Promise.reject(error);
    }

    // 🆕 NO LIMPIAR TOKEN SI ES SESIÓN DUPLICADA en otras rutas
    if (status === 401 && codigo === 'SESSION_DUPLICATED') {
            return Promise.reject(error); // Dejar que VerificarSesionActiva maneje esto
    }

    // Disparar evento axiosError ANTES de cualquier return temprano
    // Esto asegura que SessionClosedAlert siempre reciba la notificación
    const reason = error.response?.data?.reason || '';
    const action = error.response?.data?.action || '';
    const customEvent = new CustomEvent("axiosError", {
      detail: {
        status,
        mensaje,
        codigo,
        code: codigo, // Incluir ambos para compatibilidad
        reason, // 🔥 Incluir reason
        action, // 🔥 Incluir action
        url: error.config?.url,
        method: error.config?.method,
      },
    });
    window.dispatchEvent(customEvent);

    logger.debug('Evento axiosError disparado', {
      status,
      codigo,
      url,
      isSessionClosed: codigo === 'SESSION_CLOSED_BY_OTHER_DEVICE',
      isSessionSuspended: codigo === 'SESSION_SUSPENDED'
    });

    // 🆕 DETECTAR SESIÓN SUSPENDIDA - Permitir que el modal la maneje
    if ((status === 401 || status === 403) && codigo === 'SESSION_SUSPENDED') {
      const reason = error.response?.data?.reason || '';
      const action = error.response?.data?.action || '';
      
      logger.warn('⏸️ Sesión suspendida detectada', {
        status,
        codigo,
        url,
        reason,
        action
      });
      
      // 🔥 DISPARAR EVENTO sessionSuspended para que SessionSuspendedModal lo maneje
      // Solo cerrar inmediatamente si la acción es "close_immediately" o la razón indica reactivación
      const shouldCloseImmediately = action === 'close_immediately' || 
                                      reason?.includes('reactivada') || 
                                      reason?.includes('reactivó') ||
                                      reason === 'Otra sesión fue reactivada en otro dispositivo';
      
      if (shouldCloseImmediately) {
        logger.warn('⏸️ Sesión suspendida por reactivación - cerrando inmediatamente', {
          status,
          codigo,
          url,
          reason,
          action
        });
        
        // 🔥 LIMPIAR TODO INMEDIATAMENTE solo si es por reactivación
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (error) {
          logger.warn('Error al limpiar storage:', error);
        }
        
        // 🔥 RECARGAR INMEDIATAMENTE
        console.warn('🔄 [Axios] Recargando página por sesión suspendida (reactivación)...');
        window.location.reload();
        
        return Promise.reject(error);
      }
      
      // Si NO es por reactivación, disparar evento para que el modal lo maneje
      logger.info('✅ Disparando evento sessionSuspended para que el modal lo maneje');
      const suspendedEvent = new CustomEvent("sessionSuspended", {
        detail: {
          status,
          codigo,
          code: codigo,
          reason,
          action,
          url: error.config?.url,
          method: error.config?.method,
        }
      });
      window.dispatchEvent(suspendedEvent);
      
      // NO limpiar localStorage ni recargar - dejar que el modal decida
      return Promise.reject(error);
    }

    // 🆕 NO LIMPIAR TOKEN SI ES SESIÓN CERRADA POR OTRO DISPOSITIVO
    if ((status === 401 || status === 403) && codigo === 'SESSION_CLOSED_BY_OTHER_DEVICE') {
      logger.info('🚫 Sesión cerrada por otro dispositivo detectada', {
        status,
        codigo,
        url,
        mensaje: 'No limpiando token - SessionClosedAlert manejará la notificación'
      });
      
      // Guardar flag en localStorage para persistencia a través de redirecciones
      try {
        localStorage.setItem('session_closed_by_other_device', 'true');
      } catch (error) {
        logger.warn('Error al guardar flag de sesión cerrada en localStorage:', error);
      }
      
      // No limpiar token, dejar que el componente SessionClosedAlert maneje esto
      // El evento ya fue disparado arriba (línea 57-67)
      return Promise.reject(error);
    }

    const mensajesEspeciales = [
      "Correo no verificado.",
      "Ya tienes un rol asignado."
    ];

    // Si es un mensaje especial, no eliminar token
    if (mensajesEspeciales.includes(mensaje)) {
      return Promise.reject(error);
    }

    // Manejar errores 401/403 de forma más inteligente (SOLO si NO es sesión duplicada, cerrada por otro dispositivo o suspendida)
    if ((status === 401 || status === 403) && 
        !isRefreshing && 
        !hasLoggedOut && 
        codigo !== 'SESSION_DUPLICATED' && 
        codigo !== 'SESSION_CLOSED_BY_OTHER_DEVICE' &&
        codigo !== 'SESSION_SUSPENDED') {
      isRefreshing = true;
      hasLoggedOut = true;
      
            
      // Limpiar token
      localStorage.removeItem("token");
      localStorage.removeItem("reclamando_sesion");
      
      // Opcional: Notificar al usuario
      logger.warn("Sesión expirada. Por favor, inicia sesión nuevamente.");
      
      // Opcional: Redirigir al login después de un breve delay
      setTimeout(() => {
                isRefreshing = false;
      }, 1000);
    }

    return Promise.reject(error);
  }
);

export default instance;