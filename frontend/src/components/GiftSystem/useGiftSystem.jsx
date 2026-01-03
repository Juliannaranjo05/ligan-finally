// ==========================================
// ==========================================

import React, { useState, useCallback, useEffect, useRef } from 'react';

// 🔐 GENERADOR DE TOKENS COMPATIBLE CON TU MIDDLEWARE
class SessionTokenManager {
  static async generateSessionToken(userId, userIP = 'web-client') {
    try {
      if (!userId) {
        return null;
      }
      
      const currentHour = new Date().toISOString().slice(0, 13).replace('T', '-');
      const sessionId = this.getSessionId();
      
      // 🔥 STRING EXACTO QUE ESPERA TU MIDDLEWARE
      // El backend usa config('app.key'), pero en el frontend usamos una clave pública
      // que debe coincidir con lo que el backend espera para requests desde web
      const data = [
        userId.toString(),
        sessionId,
        currentHour,
        'web-app-key', // Clave pública para requests desde web
        userIP || 'web-client'
      ].join('|');
      
      // Calcular el hash SHA-256
      const hash = await this.sha256(data);
      return hash;
    } catch (error) {
      console.error('Error generando token de sesión:', error);
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

  // 🔥 REFS PARA PREVENIR MÚLTIPLES LLAMADAS SIMULTÁNEAS
  const loadingGiftsRef = useRef(false);
  const loadingRequestsRef = useRef(false);

  // 🔥 FUNCIÓN PARA PRECARGAR IMÁGENES DE REGALOS
  const preloadGiftImages = useCallback((giftsArray) => {
    giftsArray.forEach((gift) => {
      const imagePath = gift.image_path || gift.image || gift.image_url || gift.pic || gift.icon;
      if (imagePath) {
        const img = new Image();
        // Construir URL completa
        let imageUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://')
          ? imagePath 
          : `${API_BASE_URL.replace(/\/$/, '')}/${imagePath.replace(/^\/+/, '')}`;
        
        // 🔥 AGREGAR PARÁMETRO DE VERSIÓN BASADO EN EL NOMBRE DEL ARCHIVO PARA INVALIDAR CACHÉ
        // Extraer nombre del archivo de la URL
        const urlParts = imageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remover query params existentes
        
        // Crear hash simple del nombre del archivo para versión estable
        // Si el nombre del archivo cambia, la versión cambiará
        const fileHash = fileName ? btoa(fileName).substring(0, 8) : Date.now();
        const separator = imageUrl.includes('?') ? '&' : '?';
        imageUrl = `${imageUrl.split('?')[0]}${separator}v=${fileHash}&_preload=${Date.now()}`;
        
        img.src = imageUrl;
        
        // Opcional: manejar errores silenciosamente
        img.onerror = () => {
          // Imagen no disponible, se manejará cuando se renderice
        };
      }
    });
  }, [API_BASE_URL]);

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
    // 🔥 PREVENIR MÚLTIPLES LLAMADAS SIMULTÁNEAS
    if (loadingGiftsRef.current) {
      return { success: false, error: 'Ya se está cargando' };
    }
    
    try {
      loadingGiftsRef.current = true;
      setLoadingGifts(true);
            
      const response = await fetch(`${API_BASE_URL}/api/gifts/available`, {
        headers: {
          ...getAuthHeaders(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
            
      if (!response.ok) {
        const errorText = await response.text();
                return { success: false, error: errorText };
      }

      const data = await response.json();
      console.log('🎁 Respuesta completa de regalos:', data);
      if (data.success) {
        const giftsArray = data.gifts || [];
        console.log('🎁 Regalos cargados:', giftsArray.length, giftsArray);
        if (giftsArray.length === 0) {
          console.warn('⚠️ No se encontraron regalos en la respuesta');
        }
        setGifts(giftsArray);
        
        // 🔥 PRECARGAR IMÁGENES DE REGALOS PARA QUE ESTÉN LISTAS CUANDO SE ABRA EL MODAL
        if (giftsArray.length > 0) {
          preloadGiftImages(giftsArray);
        }
        
        return { success: true, gifts: giftsArray };
      } else {
        console.error('❌ Error cargando regalos:', data.error || 'Unknown error', data);
        setGifts([]);
        return { success: false, error: data.error || 'Unknown error' };
      }
    } catch (error) {
            return { success: false, error: error.message };
    } finally {
      setLoadingGifts(false);
      loadingGiftsRef.current = false;
    }
  }, [API_BASE_URL, getAuthHeaders]);

  // 📋 CARGAR SOLICITUDES PENDIENTES
  const loadPendingRequests = useCallback(async () => {
    if (userRole !== 'cliente') {
      console.log('🎁 [useGiftSystem] loadPendingRequests: No es cliente, retornando requests vacío');
      return { success: true, requests: [] };
    }
    
    // 🔥 PREVENIR MÚLTIPLES LLAMADAS SIMULTÁNEAS
    if (loadingRequestsRef.current) {
      console.log('🎁 [useGiftSystem] loadPendingRequests: Ya se está cargando, esperando...');
      // Esperar un poco y retornar requests vacío para evitar bloqueos
      return { success: true, requests: [] };
    }
    
    try {
      loadingRequestsRef.current = true;
      setLoadingRequests(true);
      
      console.log('🎁 [useGiftSystem] loadPendingRequests: Iniciando carga...');
      
      const response = await fetch(`${API_BASE_URL}/api/gifts/requests/pending`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎁 [useGiftSystem] Error cargando pendingRequests:', response.status, errorText);
        // Asegurar que siempre retornamos un objeto válido
        const errorResult = { success: false, error: errorText, requests: [] };
        return errorResult;
      }

      const data = await response.json();
      console.log('🎁 [useGiftSystem] loadPendingRequests: Respuesta recibida:', { 
        success: data.success, 
        requestsCount: data.requests?.length || 0 
      });
      
      if (data.success) {
        const requestsArray = data.requests || [];
        setPendingRequests(requestsArray);
        const successResult = { success: true, requests: requestsArray };
        console.log('🎁 [useGiftSystem] loadPendingRequests: Retornando éxito con', requestsArray.length, 'requests');
        return successResult;
      } else {
        console.warn('🎁 [useGiftSystem] loadPendingRequests devolvió success: false:', data);
        const errorResult = { success: false, error: data.message || data.error || 'Error desconocido', requests: [] };
        return errorResult;
      }
    } catch (error) {
      console.error('🎁 [useGiftSystem] Excepción en loadPendingRequests:', error);
      console.error('🎁 [useGiftSystem] Stack trace:', error.stack);
      // Asegurar que siempre retornamos un objeto válido incluso en caso de excepción
      const errorResult = { success: false, error: error.message || 'Error de conexión', requests: [] };
      console.log('🎁 [useGiftSystem] loadPendingRequests retornando error:', errorResult);
      return errorResult;
    } finally {
      setLoadingRequests(false);
      loadingRequestsRef.current = false;
      console.log('🎁 [useGiftSystem] loadPendingRequests finally ejecutado');
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
        // Debug disabled
                                
        // Mostrar cada campo que enviamos con su tipo
        Object.keys(requestData).forEach(key => {
          const value = requestData[key];
          const type = typeof value;
        });
        
        // Debug disabled
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
    console.log('🎁 [useGiftSystem] acceptGiftRequest INICIO:', { 
      requestId, 
      hasSecurityHash: !!securityHash,
      sessionToken: !!sessionToken 
    });
        
    // 🔐 GENERAR TOKEN DE SESIÓN SI NO EXISTE
    const token = sessionToken || await generateSessionToken();
    if (!token) {
      console.error('🎁 [useGiftSystem] ❌ No se pudo generar token de sesión');
      return { success: false, error: 'Session token required' };
    }
    
    console.log('🎁 [useGiftSystem] Token de sesión obtenido:', !!token);

    // Buscar hash de seguridad si no se proporcionó
    let finalSecurityHash = securityHash;
    if (!finalSecurityHash && pendingRequests && pendingRequests.length > 0) {
      const pendingRequest = pendingRequests.find(req => req.id === parseInt(requestId));
      if (pendingRequest && pendingRequest.security_hash) {
        finalSecurityHash = pendingRequest.security_hash;
        console.log('🎁 [useGiftSystem] ✅ Security hash encontrado en pendingRequests');
      }
    }

    // 🔥 Si no tenemos security_hash, continuar de todos modos
    // El backend puede generar o validar el hash de otra manera
    if (!finalSecurityHash) {
      console.warn('🎁 [useGiftSystem] ⚠️ Security hash no encontrado para requestId:', requestId);
      console.log('🎁 [useGiftSystem] pendingRequests disponibles:', pendingRequests?.map(r => ({ id: r.id, has_hash: !!r.security_hash })) || []);
      // No retornar error aquí - dejar que el backend maneje la validación
      // El backend puede generar el hash si no se proporciona
    }

    const requestData = {
      request_id: parseInt(requestId),
      session_token: token
    };
    
    // 🔥 Solo incluir security_hash si lo tenemos (el backend puede generarlo si no se proporciona)
    if (finalSecurityHash) {
      requestData.security_hash = finalSecurityHash;
    }

    console.log('🎁 [useGiftSystem] Enviando aceptación de regalo:', { 
      requestId, 
      hasSecurityHash: !!finalSecurityHash,
      requestDataKeys: Object.keys(requestData)
    });

    // 🔥 TIMEOUT MEJORADO PARA IPHONE - Aumentar timeout a 30 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos
    
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/gifts/requests/${requestId}/accept`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // Si es timeout o error de red, lanzar error para que se maneje arriba
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
        throw fetchError;
      }
      throw fetchError;
    }

    // 🔥 Leer respuesta como texto primero para poder inspeccionarla
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('🎁 [useGiftSystem] Error parseando JSON de respuesta:', e);
      console.error('🎁 [useGiftSystem] Respuesta raw:', responseText.substring(0, 1000));
      return { success: false, error: 'Respuesta inválida del servidor', rawResponse: responseText };
    }
    
    // 🔥 Log detallado de la respuesta
    console.log('🎁 [useGiftSystem] Respuesta del servidor:', { 
      status: response.status, 
      ok: response.ok,
      statusText: response.statusText,
      data,
      dataKeys: data ? Object.keys(data) : [],
      hasMessage: !!data?.message,
      hasError: !!data?.error,
      hasErrors: !!data?.errors,
      responseTextPreview: responseText.substring(0, 500),
      fullResponseText: responseText
    });
    
    // 🔥 Si la respuesta no es OK, siempre retornar error con información
    if (!response.ok) {
      console.error('🎁 [useGiftSystem] ❌ Respuesta no OK:', {
        status: response.status,
        statusText: response.statusText,
        data,
        responseText
      });
    }
        
    if (response.ok && data && data.success) {
      // Remover de pendientes
      setPendingRequests(prev => prev.filter(req => req.id !== parseInt(requestId)));
      
      // Actualizar saldo si está disponible
      if (data.new_balance !== undefined) {
        setUserBalance(data.new_balance);
      }
      
      
      // 🎉 NOTIFICACIÓN DE ÉXITO
      const giftName = data.data?.gift?.name || 'regalo';
      const newBalance = data.data?.client_balance?.new_balance;
      
      // 🔥 Verificar que Notification existe antes de usarlo (no disponible en iOS Safari en algunos contextos)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('🎁 Regalo Enviado', {
            body: `¡${giftName} enviado exitosamente! Saldo restante: ${newBalance || 'N/A'}`,
            icon: '/favicon.ico'
          });
        } catch (e) {
          // Ignorar errores de notificación en iOS
          console.warn('No se pudo mostrar notificación:', e);
        }
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
      // 🔥 Asegurar que data existe
      if (!data) {
        console.error('🎁 [useGiftSystem] ❌ data es null o undefined');
        data = {};
      }
      
      // 🔥 Intentar extraer el mensaje de error de varias formas posibles
      let errorMessage = null;
      
      // Prioridad 1: data.message
      if (data && data.message && typeof data.message === 'string') {
        errorMessage = data.message;
      }
      // Prioridad 2: data.error (puede ser string o objeto)
      else if (data && data.error) {
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (typeof data.error === 'object' && data.error.message) {
          errorMessage = data.error.message;
        }
      }
      // Prioridad 3: data.errors (objeto de validación Laravel)
      else if (data && data.errors && typeof data.errors === 'object') {
        const firstError = Object.values(data.errors)[0];
        if (Array.isArray(firstError) && firstError.length > 0) {
          errorMessage = firstError[0];
        } else if (typeof firstError === 'string') {
          errorMessage = firstError;
        }
      }
      // Prioridad 4: Mensajes por código de estado
      if (!errorMessage) {
        if (response.status === 404) {
          errorMessage = 'La solicitud de regalo no fue encontrada o ya fue procesada.';
        } else if (response.status === 403) {
          errorMessage = 'No tienes permiso para aceptar esta solicitud.';
        } else if (response.status === 409) {
          errorMessage = 'Esta transacción ya se está procesando. Por favor espera.';
        } else if (response.status === 400) {
          errorMessage = 'Solicitud inválida. Verifica los datos e intenta nuevamente.';
        } else if (response.status === 500) {
          errorMessage = 'Error del servidor. Por favor intenta nuevamente más tarde.';
        } else {
          errorMessage = `Error desconocido (HTTP ${response.status})`;
        }
      }
      
      // Mensajes específicos por tipo de error
      if (data && (data.error === 'insufficient_balance' || data.data?.error === 'insufficient_balance')) {
        errorMessage = `Saldo insuficiente. Necesitas ${data.data?.required_amount || data.required_amount || 'más'} monedas`;
      } else if (data && (data.error === 'invalid_request' || data.data?.error === 'invalid_request')) {
        errorMessage = 'La solicitud ya expiró o fue procesada';
      } else if (data && (data.error === 'security_violation' || data.data?.error === 'security_violation')) {
        errorMessage = 'Error de validación de seguridad. Por favor recarga la página e intenta nuevamente.';
      } else if (data && (data.error === 'already_processing' || data.data?.error === 'already_processing')) {
        errorMessage = 'Esta transacción ya se está procesando. Por favor espera un momento.';
      }
      
      // 🔥 Si aún no tenemos un mensaje, usar uno genérico pero informativo
      if (!errorMessage) {
        errorMessage = `Error al procesar la solicitud (HTTP ${response.status})`;
        console.warn('🎁 [useGiftSystem] ⚠️ No se pudo extraer mensaje de error del servidor', {
          data,
          responseStatus: response.status,
          responseText: responseText.substring(0, 200)
        });
      }
      
      console.error('🎁 [useGiftSystem] Error aceptando regalo:', {
        errorMessage,
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        dataKeys: data ? Object.keys(data) : [],
        data,
        responseTextPreview: responseText.substring(0, 500),
        fullResponseText: responseText
      });
      
      // 🔥 Asegurar que siempre retornamos un objeto con error
      const errorResult = { 
        success: false, 
        error: errorMessage, 
        message: errorMessage,
        serverResponse: data, 
        status: response.status,
        rawResponse: responseText
      };
      
      console.log('🎁 [useGiftSystem] Retornando error:', errorResult);
      return errorResult;
    }
  } catch (error) {
    console.error('🎁 [useGiftSystem] Excepción al aceptar regalo:', error);
    console.error('🎁 [useGiftSystem] Stack trace:', error.stack);
    const errorResult = { 
      success: false, 
      error: error.message || 'Error de conexión. Verifica tu internet.',
      message: error.message || 'Error de conexión. Verifica tu internet.',
      exception: true
    };
    console.log('🎁 [useGiftSystem] Retornando excepción:', errorResult);
    return errorResult;
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
        // 🔥 Verificar que Notification existe antes de usarlo (no disponible en iOS Safari en algunos contextos)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('Solicitud Rechazada', {
              body: 'Has rechazado una solicitud de regalo',
              icon: '/favicon.ico'
            });
          } catch (e) {
            // Ignorar errores de notificación en iOS
            console.warn('No se pudo mostrar notificación:', e);
          }
        }
      
      return { success: true, message: data.message };
    } else {
            return { success: false, error: data.error };
    }
  } catch (error) {
        return { success: false, error: 'Error de conexión' };
  }
  }, [API_BASE_URL, getAuthHeaders]);

  // 🚀 INICIALIZACIÓN - Solo ejecutar cuando userId o userRole cambian (no en cada render)
  const initializedKeyRef = useRef(null);
  // 💰 CARGAR BALANCE DEL USUARIO
  const loadUserBalance = useCallback(async () => {
    if (!userId || userRole !== 'cliente') {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/gifts/balance`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.balance) {
          // 🔥 Usar total_balance (purchased_balance + gift_balance)
          const totalBalance = data.balance.total_balance || 
                              (data.balance.purchased_balance || 0) + (data.balance.gift_balance || 0);
          setUserBalance(totalBalance);
          console.log('💰 [useGiftSystem] Balance cargado:', {
            totalBalance,
            purchased_balance: data.balance.purchased_balance,
            gift_balance: data.balance.gift_balance
          });
        }
      }
    } catch (error) {
      console.error('❌ [useGiftSystem] Error cargando balance:', error);
    }
  }, [userId, userRole, API_BASE_URL, getAuthHeaders]);

  useEffect(() => {
    const currentKey = `${userId}-${userRole}`;
    
    // Solo ejecutar si el userId o userRole realmente cambió
    if (userId && getAuthHeaders && initializedKeyRef.current !== currentKey) {
      initializedKeyRef.current = currentKey;
      generateSessionToken();
      loadGifts();
      if (userRole === 'cliente') {
        loadPendingRequests();
        loadUserBalance(); // 🔥 Cargar balance cuando es cliente
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole]); // 🔥 Solo dependencias críticas - funciones están en refs o son estables

  // 🔄 REFRESCAR TOKEN CADA HORA
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
            generateSessionToken();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, generateSessionToken]);

  // 🎁 ENVIAR REGALO SIMPLE - Usa el nuevo endpoint directo
  const sendGiftSimple = useCallback(async (requestId) => {
    try {
      console.log('🎁 [useGiftSystem] sendGiftSimple INICIO:', { requestId });
      
      const response = await fetch(`${API_BASE_URL}/api/gifts/send-simple`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request_id: parseInt(requestId)
        })
      });
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('🎁 [useGiftSystem] Error parseando JSON:', e);
        console.error('🎁 [useGiftSystem] Respuesta raw:', responseText.substring(0, 1000));
        return { success: false, error: 'Respuesta inválida del servidor', rawResponse: responseText };
      }
      
      console.log('🎁 [useGiftSystem] sendGiftSimple respuesta:', {
        status: response.status,
        ok: response.ok,
        data
      });
      
      if (response.ok && data.success) {
        // Remover de pendientes
        setPendingRequests(prev => prev.filter(req => req.id !== parseInt(requestId)));
        
        // Actualizar saldo si está disponible
        if (data.data?.client_balance?.new_balance !== undefined) {
          setUserBalance(data.data.client_balance.new_balance);
        }
        
        console.log('🎁 [useGiftSystem] sendGiftSimple éxito');
        
        return {
          success: true,
          transaction: data.data,
          newBalance: data.data?.client_balance?.new_balance,
          giftInfo: {
            name: data.data?.gift?.name,
            image: data.data?.gift?.image,
            price: data.data?.gift?.amount
          },
          message: data.message || '¡Regalo enviado exitosamente!'
        };
      } else {
        // Extraer mensaje de error
        let errorMessage = data.message || data.error || 'Error al enviar el regalo';
        
        if (data.error === 'insufficient_balance') {
          const required = data.data?.required_amount || 'más';
          errorMessage = `Saldo insuficiente. Necesitas ${required} monedas para enviar este regalo.`;
        } else if (data.error === 'invalid_request') {
          errorMessage = 'La solicitud ya expiró o fue procesada. Por favor, recarga la página.';
        }
        
        console.error('🎁 [useGiftSystem] sendGiftSimple error:', {
          errorMessage,
          status: response.status,
          data
        });
        
        return {
          success: false,
          error: errorMessage,
          message: errorMessage,
          serverResponse: data,
          status: response.status
        };
      }
    } catch (error) {
      console.error('🎁 [useGiftSystem] Excepción en sendGiftSimple:', error);
      return {
        success: false,
        error: error.message || 'Error de conexión. Verifica tu internet.',
        message: error.message || 'Error de conexión. Verifica tu internet.',
        exception: true
      };
    }
  }, [API_BASE_URL, getAuthHeaders, setPendingRequests, setUserBalance]);

  return {
    gifts,
    loadingGifts,
    pendingRequests,
    loadingRequests,
    sessionToken,
    userBalance,
    loadGifts,
    loadPendingRequests,
    loadUserBalance, // 🔥 Exportar función para cargar balance
    requestGift,
    acceptGiftRequest,
    sendGiftSimple,
    rejectGiftRequest,
    generateSessionToken,
    setPendingRequests,
    setGifts,
    setUserBalance
  };
};
