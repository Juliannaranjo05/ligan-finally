// ==========================================
// ==========================================

import { useState, useCallback, useEffect } from 'react';

// 🔐 GENERADOR DE TOKENS COMPATIBLE CON TU MIDDLEWARE
class SessionTokenManager {
  static async generateSessionToken(userId, userIP = 'web-client') {
    try {
      const currentHour = new Date().toISOString().slice(0, 13).replace('T', '-');
      const sessionId = this.getSessionId();
      
      // 🔥 STRING EXACTO QUE ESPERA TU MIDDLEWARE
      const data = [
        userId.toString(),
        sessionId,
        currentHour,
        'web-app-key',
        userIP
      ].join('|');
      
      return hash;
    } catch (error) {
            return null;
    }
  }
  
  static getSessionId() {
    let sessionId = localStorage.getItem('app_session_id');
    if (!sessionId) {
      sessionId = 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('app_session_id', sessionId);
    }
    return sessionId;
  }
  
  static async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const useGiftSystem = (userId, userRole, getAuthHeaders, apiBaseUrl) => {
  const [gifts, setGifts] = useState([]);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [userBalance, setUserBalance] = useState(0);

  const API_BASE_URL = apiBaseUrl || import.meta.env.VITE_API_BASE_URL;

  // 🔐 GENERAR TOKEN
  const generateSessionToken = useCallback(async () => {
    if (!userId) return null;
    
    try {
      const token = await SessionTokenManager.generateSessionToken(userId);
      setSessionToken(token);
            return token;
    } catch (error) {
            return null;
    }
  }, [userId]);

  // 🎁 CARGAR REGALOS
  const loadGifts = useCallback(async () => {
    try {
      setLoadingGifts(true);
            
      const response = await fetch(`${API_BASE_URL}/api/gifts/available`, {
        headers: getAuthHeaders()
      });
      
            
      if (!response.ok) {
        const errorText = await response.text();
                return { success: false, error: errorText };
      }

      const data = await response.json();
      if (data.success) {
        setGifts(data.gifts || []);
                return { success: true, gifts: data.gifts };
      }
    } catch (error) {
            return { success: false, error: error.message };
    } finally {
      setLoadingGifts(false);
    }
  }, [API_BASE_URL, getAuthHeaders]);

  // 📋 CARGAR SOLICITUDES PENDIENTES
  const loadPendingRequests = useCallback(async () => {
    if (userRole !== 'cliente') return { success: true, requests: [] };
    
    try {
      setLoadingRequests(true);
      
      const response = await fetch(`${API_BASE_URL}/api/gifts/requests/pending`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
                return { success: false, error: errorText };
      }

      const data = await response.json();
      if (data.success) {
        setPendingRequests(data.requests || []);
                return { success: true, requests: data.requests };
      }
    } catch (error) {
            return { success: false, error: error.message };
    } finally {
      setLoadingRequests(false);
    }
  }, [userRole, API_BASE_URL, getAuthHeaders]);

  // 🎁 SOLICITAR REGALO (FUNCIÓN PRINCIPAL)

const requestGift = useCallback(async (clientId, giftId, message = '', roomName = null) => {
  try {
        
    // 🔥 VALIDACIÓN SIN CONVERTIR giftId A NÚMERO
    const validClientId = parseInt(clientId);
    const validGiftId = giftId; // ✅ MANTENER COMO STRING
    
    // Validar clientId (debe ser número)
    if (isNaN(validClientId)) {
            return { success: false, error: 'ID de cliente inválido' };
    }
    
    // Validar giftId (debe existir como string)
    if (!validGiftId || validGiftId === '') {
            return { success: false, error: 'ID de regalo inválido' };
    }
    
        
    // 🔐 GENERAR TOKEN
    const token = sessionToken || await generateSessionToken();
    if (!token) {
            return { success: false, error: 'No se pudo generar token de sesión' };
    }
    
    // 🔥 requestData CON giftId COMO STRING (SIN parseInt)
    const requestData = {
      client_id: validClientId,    // ✅ Número
      gift_id: validGiftId,        // ✅ String - NO CONVERTIR A NÚMERO
      session_token: token,
      message: message || '',
      room_name: roomName || '',
      modelo_id: parseInt(userId),
      timestamp: Math.floor(Date.now() / 1000),
      user_agent: navigator.userAgent.substring(0, 150),
      ip_address: 'web_client',
      platform: 'web',
      request_type: 'gift_request',
      session_id: SessionTokenManager.getSessionId(),
      security_level: 'standard',
      client_version: '1.0.0',
      browser_info: navigator.userAgent.substring(0, 100),
      request_metadata: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        timestamp_client: Date.now(),
        user_role: 'modelo'
      }
    };

    
    // 🔍 VERIFICAR ESPECÍFICAMENTE QUE gift_id NO SEA NaN
    
    // Verificar que client_id y modelo_id sean números válidos
    if (isNaN(requestData.client_id) || isNaN(requestData.modelo_id)) {
      return { success: false, error: 'Error de validación de IDs numéricos' };
    }

    const response = await fetch(`${API_BASE_URL}/api/gifts/request`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client-Platform': 'web-app',
        'X-Session-ID': SessionTokenManager.getSessionId(),
        'X-User-Role': 'modelo',
        'X-Request-Type': 'gift_request',
        'X-Timestamp': Math.floor(Date.now() / 1000).toString()
      },
      body: JSON.stringify(requestData)
    });

    
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
            return { 
        success: false, 
        error: 'Respuesta inválida del servidor', 
        rawResponse: responseText 
      };
    }

    if (response.ok && data.success) {
            return { 
        success: true, 
        requestId: data.data?.request_id,
        securityHash: data.data?.security_hash,
        chatMessage: data.chat_message,
        giftInfo: {
          name: data.data?.gift?.name,
          image: data.data?.gift?.image,
          price: data.data?.gift?.price
        },
        message: data.message,
        data: data.data
      };
    } else {
            
      // Análisis detallado para debugging
      if (data.error === 'missing_parameters') {
        console.group('🔍 DEBUGGING MISSING PARAMETERS');
                                
        // Mostrar cada campo que enviamos con su tipo
        Object.keys(requestData).forEach(key => {
          const value = requestData[key];
          const type = typeof value;
        });
        
        console.groupEnd();
      }
      
      let errorMessage = 'Error enviando solicitud';
      if (data.error === 'missing_parameters') {
        errorMessage = 'Faltan parámetros requeridos por el servidor';
      } else if (data.error === 'user_banned') {
        errorMessage = `Cuenta suspendida: ${data.ban_info?.reason || 'Actividad sospechosa'}`;
      } else if (data.error === 'security_violation') {
        errorMessage = 'Error de seguridad. Recarga la página';
      } else if (data.message) {
        errorMessage = data.message;
      }
      
      return { 
        success: false, 
        error: errorMessage,
        serverResponse: data,
        sentFields: Object.keys(requestData)
      };
    }
  } catch (error) {
        return { success: false, error: 'Error de conexión. Verifica tu internet.' };
  }
}, [sessionToken, generateSessionToken, userId, API_BASE_URL, getAuthHeaders]);

  // ✅ ACEPTAR REGALO
  const acceptGiftRequest = useCallback(async (requestId, securityHash = null) => {
  try {
        
    // 🔐 GENERAR TOKEN DE SESIÓN SI NO EXISTE
    const token = sessionToken || await generateSessionToken();
    if (!token) {
      return { success: false, error: 'Session token required' };
    }

    // Buscar hash de seguridad si no se proporcionó
    let finalSecurityHash = securityHash;
    if (!finalSecurityHash) {
      const pendingRequest = pendingRequests.find(req => req.id === parseInt(requestId));
      if (pendingRequest && pendingRequest.security_hash) {
        finalSecurityHash = pendingRequest.security_hash;
      }
    }

    if (!finalSecurityHash) {
      return { success: false, error: 'Security hash missing' };
    }

    const requestData = {
      request_id: parseInt(requestId),
      security_hash: finalSecurityHash,
      session_token: token
    };

    const response = await fetch(`${API_BASE_URL}/api/gifts/requests/${requestId}/accept`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();
        
    if (response.ok && data.success) {
      // Remover de pendientes
      setPendingRequests(prev => prev.filter(req => req.id !== parseInt(requestId)));
      
      // Actualizar saldo si está disponible
      if (data.new_balance !== undefined) {
        setUserBalance(data.new_balance);
      }
      
      
      // 🎉 NOTIFICACIÓN DE ÉXITO
      const giftName = data.data?.gift?.name || 'regalo';
      const newBalance = data.data?.client_balance?.new_balance;
      
      if (Notification.permission === 'granted') {
        new Notification('🎁 Regalo Enviado', {
          body: `¡${giftName} enviado exitosamente! Saldo restante: ${newBalance || 'N/A'}`,
          icon: '/favicon.ico'
        });
      }

      return { 
        success: true, 
        transaction: data.data,
        newBalance: data.data?.client_balance?.new_balance,
        chatMessages: data.chat_messages,
        giftInfo: {
          name: data.data?.gift?.name,
          image: data.data?.gift?.image,
          price: data.data?.gift?.amount
        }
      };
    } else {
            
      // Manejar errores específicos
      let errorMessage = data.message || data.error || 'Error desconocido';
      
      if (data.error === 'insufficient_balance') {
        errorMessage = `Saldo insuficiente. Necesitas ${data.data?.required_amount || 'más'} monedas`;
      } else if (data.error === 'invalid_request') {
        errorMessage = 'La solicitud ya expiró o fue procesada';
      }
      
      return { success: false, error: errorMessage };
    }
  } catch (error) {
        return { success: false, error: 'Error de conexión' };
  }
  }, [sessionToken, generateSessionToken, pendingRequests, API_BASE_URL, getAuthHeaders, setUserBalance]);

  const rejectGiftRequest = useCallback(async (requestId, reason = null) => {
  try {
        
    const requestOptions = {
      method: 'POST',
      headers: getAuthHeaders()
    };

    if (reason) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify({ reason });
    }
    
    const response = await fetch(`${API_BASE_URL}/api/gifts/requests/${requestId}/reject`, requestOptions);
    const data = await response.json();
    
    if (data.success) {
      setPendingRequests(prev => prev.filter(req => req.id !== parseInt(requestId)));
            
      // Notificación discreta
      if (Notification.permission === 'granted') {
        new Notification('Solicitud Rechazada', {
          body: 'Has rechazado una solicitud de regalo',
          icon: '/favicon.ico'
        });
      }
      
      return { success: true, message: data.message };
    } else {
            return { success: false, error: data.error };
    }
  } catch (error) {
        return { success: false, error: 'Error de conexión' };
  }
  }, [API_BASE_URL, getAuthHeaders]);

  // 🚀 INICIALIZACIÓN
  useEffect(() => {
    if (userId && getAuthHeaders) {
            generateSessionToken();
      loadGifts();
      if (userRole === 'cliente') {
        loadPendingRequests();
      }
    }
  }, [userId, userRole, getAuthHeaders, generateSessionToken, loadGifts, loadPendingRequests]);

  // 🔄 REFRESCAR TOKEN CADA HORA
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
            generateSessionToken();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, generateSessionToken]);

  return {
    gifts,
    loadingGifts,
    pendingRequests,
    loadingRequests,
    sessionToken,
    userBalance,
    loadGifts,
    loadPendingRequests,
    requestGift,
    acceptGiftRequest,
    rejectGiftRequest,
    generateSessionToken,
    setPendingRequests,
    setGifts,
    setUserBalance
  };
};
