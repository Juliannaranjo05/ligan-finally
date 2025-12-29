import axios from "../api/axios";
import axiosDirect from "axios"; // Axios directo sin interceptores para registro y verificación
import userCache from "./userCache"; // 🔥 IMPORTAR CACHE GLOBAL
import { useRateLimitHandler } from '../components/RateLimitLigand';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ligandome.com';

// ========================
// SISTEMA DE HEARTBEAT
// ========================
let heartbeatInterval = null;

const getCurrentRoom = () => {
  return localStorage.getItem("roomName") ?? null;
};

// 🎯 Obtener el tipo de actividad actual del usuario
const getCurrentActivityType = () => {
  // Puedes ajustar esto si tienes otras actividades como 'browsing', 'waiting', etc
  const path = window.location.pathname;

  if (path.includes('/videochat')) {
    const role = localStorage.getItem('userRole');
    return role === 'modelo' ? 'videochat_model' : 'videochat';
  }

  return 'browsing'; // navegación general
};

const sendHeartbeat = async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const payload = {
      activity_type: getCurrentActivityType(), // videochat_client, browsing, etc
      room: getCurrentRoom(), // sala actual si está en videochat
      status: 'active'
    };

    await axios.post(`${API_BASE_URL}/api/heartbeat`, payload, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 5000 // reducir timeout
    });
      } catch (error) {
    // 🔥 DETECTAR SESIÓN SUSPENDIDA O CERRADA POR OTRO DISPOSITIVO
    if (error.response?.status === 401 || error.response?.status === 403) {
      const codigo = error.response?.data?.code || error.response?.data?.codigo || '';
      
      if (codigo === 'SESSION_SUSPENDED') {
        // 🔥 VERIFICAR SI HAY UNA VIDEOLLAMADA ACTIVA - NO CERRAR SESIÓN DURANTE VIDEOLLAMADAS
        const roomName = localStorage.getItem('roomName') || sessionStorage.getItem('roomName');
        const inCall = localStorage.getItem('inCall') === 'true' || sessionStorage.getItem('inCall') === 'true';
        const videochatActive = localStorage.getItem('videochatActive') === 'true' || sessionStorage.getItem('videochatActive') === 'true';
        
        if (roomName || inCall || videochatActive) {
          console.warn('🎥 [Auth] Videollamada activa - IGNORANDO sesión suspendida para evitar desconexión');
          return; // No hacer nada durante videollamadas
        }
        
        console.warn('⏸️ [Auth] Sesión suspendida detectada - cerrando inmediatamente');
        // 🔥 LIMPIAR TODO Y RECARGAR INMEDIATAMENTE
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (storageError) {
          // Ignorar errores
        }
        // 🔥 RECARGAR INMEDIATAMENTE
        window.location.reload();
      }
      
      if (codigo === 'SESSION_CLOSED_BY_OTHER_DEVICE') {
        // Guardar flag en localStorage para persistencia (axios ya dispara el evento)
        try {
          localStorage.setItem('session_closed_by_other_device', 'true');
        } catch (storageError) {
          // Ignorar errores de localStorage
        }
      }
    }
    // tu manejo de errores está bien
  }
};

const startHeartbeat = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
    sendHeartbeat(); // enviar inmediatamente
  heartbeatInterval = setInterval(sendHeartbeat, 10000); // cada 10 segundos
};

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
      }
};

const markUserOffline = async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    await axios.post(`${API_BASE_URL}/api/user/mark-offline`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
      } catch (error) {
      }
};

// ✅ Registrar usuario
export const register = async (email, password) => {
  try {
    // Usar axios directamente (sin instancia) para evitar el interceptor que podría limpiar el token
    const response = await axiosDirect.post(`${API_BASE_URL}/api/register`, { email, password });

    const token = response.data.access_token;
    if (token) {
      localStorage.setItem("token", token);
    } else {
      throw new Error("No se recibió token de autenticación");
    }

    return response.data;
  } catch (error) {
    // Manejar error 429 (Too Many Requests) específicamente
    if (error.response?.status === 429) {
      const errorMessage = error.response?.data?.message || "Demasiados intentos. Por favor espera un momento antes de intentar nuevamente.";
      const retryAfter = error.response?.headers?.['retry-after'] || 60;
      throw new Error(`${errorMessage} (Intenta de nuevo en ${retryAfter} segundos)`);
    }
    throw error;
  }
};


export const loginWithWait = async (email, password, onStatusUpdate = null) => {
  try {
        
    // Usar la función existente pero interceptar el 202
    const response = await axios.post(`${API_BASE_URL}/api/login`, { 
      email, 
      password 
    }, { skipInterceptor: true });

    // Login exitoso directo (no había sesión activa)
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem("just_logged_in", "true");

      setTimeout(() => {
        localStorage.removeItem("just_logged_in");
      }, 10000);

            
      // Marcar como online y iniciar heartbeat
      try {
        await axios.post(`${API_BASE_URL}/api/user/mark-online`, {}, {
          headers: { 'Authorization': `Bearer ${response.data.access_token}` }
        });
                startHeartbeat();
      } catch (error) {
              }

      userCache.clearCache();
      return { success: true, data: response.data, requiresWait: false };
    }

    return { success: true, data: response.data, requiresWait: false };

  } catch (error) {
    // Usuario A está activo, necesitamos esperar (código 202)
    if (error.response?.status === 202 && error.response?.data?.status === 'waiting_for_user_decision') {
            
      return await waitForUserDecision(email, password, error.response.data, onStatusUpdate);
    }

    // Otros errores (401, 404, etc.)
    throw error;
  }
};

// Función para esperar la decisión del Usuario A
const waitForUserDecision = async (email, password, initialResponse, onStatusUpdate) => {
  const requestId = initialResponse.request_id;
  const maxWaitTime = (initialResponse.wait_time || 10) * 60 * 1000; // convertir a ms
  const startTime = Date.now();
  
    
  // Notificar al UI del estado inicial
  if (onStatusUpdate) {
    onStatusUpdate({
      status: 'waiting',
      message: 'Hay una sesión activa. El usuario está siendo notificado...',
      remainingTime: initialResponse.wait_time,
      canCancel: true
    });
  }

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(async () => {
      try {
        const elapsed = Date.now() - startTime;
        
        // Timeout alcanzado
        if (elapsed >= maxWaitTime) {
          clearInterval(checkInterval);
          reject(new Error('Tiempo de espera agotado'));
          return;
        }

        // Verificar estado actual
        const statusResponse = await axios.post(`${API_BASE_URL}/api/check-login-status`, {
          email,
          request_id: requestId
        }, { skipInterceptor: true });

        const status = statusResponse.data;
        
        // Actualizar UI
        if (onStatusUpdate) {
          onStatusUpdate({
            status: status.status,
            message: status.message,
            remainingTime: status.remaining_time || 0,
            canCancel: true
          });
        }

        // Usuario A aprobó o tiempo expiró
        if (status.can_login) {
          clearInterval(checkInterval);
                    
          try {
            // Completar el login
            const loginResponse = await axios.post(`${API_BASE_URL}/api/complete-pending-login`, {
              email,
              password
            }, { skipInterceptor: true });

            if (loginResponse.data.access_token) {
              localStorage.setItem('token', loginResponse.data.access_token);
              localStorage.setItem("just_logged_in", "true");

              setTimeout(() => {
                localStorage.removeItem("just_logged_in");
              }, 10000);

                            
              // Marcar como online y iniciar heartbeat
              try {
                await axios.post(`${API_BASE_URL}/api/user/mark-online`, {}, {
                  headers: { 'Authorization': `Bearer ${loginResponse.data.access_token}` }
                });
                                startHeartbeat();
              } catch (error) {
                              }

              userCache.clearCache();
              
              resolve({ 
                success: true, 
                data: loginResponse.data,
                requiresWait: true,
                waitResult: 'approved'
              });
            } else {
              throw new Error('No se recibió token de acceso');
            }
          } catch (loginError) {
            clearInterval(checkInterval);
            reject(loginError);
          }
        }

      } catch (error) {
                clearInterval(checkInterval);
        reject(error);
      }
    }, 3000); // Verificar cada 3 segundos

    // Cleanup function para cancelar si es necesario
    resolve.cancel = () => {
      clearInterval(checkInterval);
      reject(new Error('Operación cancelada por el usuario'));
    };
  });
};

// Función para cancelar la espera (Usuario B)
export const cancelWaitingLogin = () => {
    // Esta función puede ser llamada desde el UI para cancelar la espera
  return { cancelled: true };
};


// 🔄 MODIFICAR loginWithoutRedirect - Usuario B entra inmediatamente
export const loginWithoutRedirect = async (email, password) => {
  try {
    
    const response = await axios.post(`${API_BASE_URL}/api/login`, { 
      email, 
      password 
    }, { skipInterceptor: true });

    // Login exitoso - Usuario B entra inmediatamente
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem("just_logged_in", "true");

      setTimeout(() => {
        localStorage.removeItem("just_logged_in");
      }, 10000);


      
      // 🔥 CARGAR IDIOMA INMEDIATAMENTE DESPUÉS DEL LOGIN
      try {

        const userResponse = await axios.get(`${API_BASE_URL}/api/profile/info`, {
          headers: { 'Authorization': `Bearer ${response.data.access_token}` }
        });
        
        if (userResponse.data.success && userResponse.data.user.preferred_language) {
          localStorage.setItem('userPreferredLanguage', userResponse.data.user.preferred_language);
          localStorage.setItem('selectedLanguage', userResponse.data.user.preferred_language);
          localStorage.setItem('i18nextLng', userResponse.data.user.preferred_language);
          localStorage.setItem('lang', userResponse.data.user.preferred_language);

          
          if (window.i18n && typeof window.i18n.changeLanguage === 'function') {
            window.i18n.changeLanguage(userResponse.data.user.preferred_language);
          }
        } else {

          localStorage.setItem('userPreferredLanguage', 'es');
          localStorage.setItem('selectedLanguage', 'es');
        }
      } catch (languageError) {

        localStorage.setItem('userPreferredLanguage', 'es');
        localStorage.setItem('selectedLanguage', 'es');
      }
      
      userCache.clearCache();
      
      // Marcar como online y iniciar heartbeat
      try {
        await axios.post(`${API_BASE_URL}/api/user/mark-online`, {}, {
          headers: { 'Authorization': `Bearer ${response.data.access_token}` }
        });

        startHeartbeat();
      } catch (error) {

      }

      return response.data;
    }

    return response.data;

  } catch (error) {
    // Mantener el mismo manejo de errores que antes
    if (error.response?.status === 404) {
      throw new Error(error.response.data.message || "No existe una cuenta con este correo");
    }

    if (error.response?.status === 401) {
      throw new Error(error.response.data.message || "La contraseña ingresada es incorrecta");
    }

    if (error.response?.status === 403) {
      throw new Error(error.response.data.message || "Correo no verificado");
    }


    throw new Error(error.response?.data?.message || "Error desconocido en el login");
  }
};

// 🔄 MODIFICADO: Reclamar sesión (Usuario A permite acceso a Usuario B)
export const reclamarSesion = async (email, password) => {
  try {

    
    const response = await axios.post(`${API_BASE_URL}/api/reclaim-session`, {
      email,
      password,
      force: true
    }, { skipInterceptor: true });


    
    // Usuario A será desconectado - limpiar su estado local
    stopHeartbeat();
    localStorage.removeItem("token");
    localStorage.removeItem("just_logged_in");
    userCache.clearCache();
    
    return response.data;
  } catch (error) {

    
    if (error.response?.status === 401) {
      throw new Error("Credenciales incorrectas");
    } else if (error.response?.status === 400) {
      throw new Error("Solicitud de sesión expirada o inválida");
    } else if (error.response?.status === 404) {
      throw new Error("Usuario no encontrado");
    }
    
    throw new Error("Error al permitir acceso");
  }
};
export const rechazarNuevaSesion = async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No hay token");
    }

    const response = await axios.post(`${API_BASE_URL}/api/reject-new-session`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    

    
    if (response.data.access_token) {
      localStorage.setItem("token", response.data.access_token);

    }
    
    return response.data;
  } catch (error) {

    throw error;
  }
};

// 🆕 NUEVA: Función para que Usuario A permita el acceso y se desconecte
export const allowAndDisconnect = async (email, password) => {
  try {
        
    // Usar reclamarSesion que ya maneja esto
    await reclamarSesion(email, password);
    
    // Inmediatamente desconectar (el token será invalidado por Usuario B)
    stopHeartbeat();
    localStorage.removeItem("token");
    localStorage.removeItem("just_logged_in");
    userCache.clearCache();
    
    return { success: true, message: 'Acceso permitido' };
  } catch (error) {
        throw error;
  }
};

export const checkAuthStatus = async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No hay token");
    }

    const response = await axios.get(`${API_BASE_URL}/api/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
        throw error;
  }
};
export const logout = async () => {
  try {
    await markUserOffline();
    stopHeartbeat();
    
    await axios.post(`${API_BASE_URL}/api/logout`);
    localStorage.removeItem("token");
    localStorage.removeItem("roomName");
    localStorage.removeItem("userName");
    
    // 🔥 LIMPIAR CACHE AL LOGOUT
    userCache.clearCache();
    
    return true;
  } catch (error) {
        
    stopHeartbeat();
    localStorage.removeItem("token");
    userCache.clearCache(); // 🔥 LIMPIAR CACHE SIEMPRE
    
    throw error;
  }
};

// 🔥 ✅ getUser CON CACHE GLOBAL REAL
export const getUser = async (forceRefresh = false) => {
  try {
        
    // 🔥 USAR EL CACHE MANAGER EN LUGAR DE LLAMADA DIRECTA
    const userData = await userCache.getUser(forceRefresh);
    
        return userData;
    
  } catch (error) {
    const errorCode = error.response?.data?.code;
    const status = error.response?.status;
        
    // 🆕 MANEJO ESPECÍFICO DE SESIÓN DUPLICADA
    if (status === 401 && errorCode === 'SESSION_DUPLICATED') {
            throw error; // Dejar que VerificarSesionActiva maneje esto
    }
    
    // 🆕 NO LIMPIAR TOKEN SI ES SESIÓN CERRADA POR OTRO DISPOSITIVO
    if ((status === 401 || status === 403) && errorCode === 'SESSION_CLOSED_BY_OTHER_DEVICE') {
            throw error; // Dejar que SessionClosedAlert maneje esto
    }
    
    // 🔥 MANEJO DE RATE LIMITING
    if (status === 429) {
            throw error; // Dejar que el cache manager maneje esto
    }
    
    // Solo limpiar token en errores reales de auth (NO SESSION_CLOSED_BY_OTHER_DEVICE)
    if (status === 401 || status === 403) {
            stopHeartbeat();
      localStorage.removeItem("token");
      localStorage.removeItem("reclamando_sesion");
      userCache.clearCache();
    }
    
    throw error;
  }
};

// 🔥 FUNCIÓN PARA REFRESCAR USUARIO (FORZAR NUEVA REQUEST)
export const refreshUser = async () => {
    return await getUser(true);
};

// ✅ Verificar código
export async function verificarCodigo(email, code) {
    // No requiere token según la API, usar axios directamente para evitar el interceptor que podría limpiar el token
    const response = await axiosDirect.post(`${API_BASE_URL}/api/verify-email-code`, {
    email,
    code,
  });
  return response.data;
}

// ✅ Reenviar código
export async function reenviarCodigo(email) {
  return await axios.post(`${API_BASE_URL}/api/resend-code`, { email });
}

export const asignarRol = async ({ rol, nombre }) => {
  return axios.post(`${API_BASE_URL}/api/asignar-rol`, {
    rol,
    name: nombre,
  });
};

// Función para inicializar el sistema
export const initializeAuth = () => {
  const token = localStorage.getItem("token");
  
  if (token) {
        startHeartbeat();
  }
};

// Función para actualizar heartbeat
export const updateHeartbeatRoom = async (roomName) => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    await axios.post(`${API_BASE_URL}/api/heartbeat`, {
      current_room: roomName,
      activity_type: 'videochat'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
      } catch (error) {
        
    if (error.response?.status === 429) {
            return;
    }
  }
};


export const loginWithGoogle = async () => {
  try {
        
    // ✅ CORRECCIÓN: Usar la URL correcta del backend
    const response = await axios.get(`${API_BASE_URL}/api/auth/google/redirect`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
        
    if (!response.data.success) {
      throw new Error(response.data.message || 'Error al obtener URL de Google');
    }

    // ✅ Redirigir a Google OAuth
        window.location.href = response.data.auth_url;
    
  } catch (error) {
            throw new Error(error.response?.data?.message || 'Error al iniciar sesión con Google');
  }
};

/**
 * Maneja el callback de Google
 */
export const handleGoogleCallback = async (code, state) => {
  try {
            
    if (!code) {
      throw new Error('Código de autorización no recibido');
    }

    const response = await axios.get(`${API_BASE_URL}/api/auth/google/callback`, {
      params: { code, state }
    });

    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Error en autenticación con Google');
    }

    const { access_token, user, signup_step } = response.data;

    localStorage.setItem('token', access_token);
    userCache.clearCache();
    
    try {
      await axios.post(`${API_BASE_URL}/api/user/mark-online`, {}, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
            startHeartbeat();
    } catch (error) {
          }

        return { user, signup_step, token: access_token };

  } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al procesar autenticación con Google');
  }
}; // ← Asegúrate de que esta llave esté cerrada

/**
 * Desvincula cuenta de Google
 */
export const unlinkGoogle = async () => {
  try {
    const token = localStorage.getItem('access_token');
    
    const response = await axios.post(`${API_BASE_URL}/auth/google/unlink`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al desvincular cuenta de Google');
  }
};

// 🔥 FUNCIÓN PARA LIMPIAR CACHE MANUALMENTE
export const clearUserCache = () => {
  userCache.clearCache();
};

// 🔥 FUNCIÓN PARA DEBUGGING
export const debugAuth = () => {
  return {
    hasToken: !!localStorage.getItem('token'),
    cache: userCache.getDebugInfo(),
    heartbeatActive: !!heartbeatInterval
  };
};


export const allowNewSession = async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No hay token");
    }

    const response = await axios.post(`${API_BASE_URL}/api/allow-new-session`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
        return response.data;
  } catch (error) {
        throw error;
  }
};

export { startHeartbeat, stopHeartbeat,    };