import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useVideoChatGifts = (roomName, currentUser, otherUser) => {
  const [gifts, setGifts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [userBalance, setUserBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [requestingGift, setRequestingGift] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(null);
  
  // Refs para evitar requests múltiples
  const loadingGiftsRef = useRef(false);
  const loadingRequestsRef = useRef(false);

  // Headers de autenticación
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Client-Platform': 'videochat-web',
      'X-Session-Room': roomName || 'unknown'
    };
  }, [roomName]);

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

  // 🎁 Cargar regalos disponibles
  const loadGifts = useCallback(async () => {
    if (loadingGiftsRef.current) return;
    
    try {
      loadingGiftsRef.current = true;
      
      const response = await fetch(`${API_BASE_URL}/api/videochat/gifts/available`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const giftsArray = data.gifts || [];
          setGifts(giftsArray);
          
          // 🔥 PRECARGAR IMÁGENES DE REGALOS PARA QUE ESTÉN LISTAS CUANDO SE ABRA EL MODAL
          if (giftsArray.length > 0) {
            preloadGiftImages(giftsArray);
          }
          
          return { success: true, gifts: giftsArray };
        } else {
                    return { success: false, error: data.error };
        }
      } else {
        const errorText = await response.text();
                return { success: false, error: `Error ${response.status}` };
      }
    } catch (error) {
            return { success: false, error: 'Error de conexión' };
    } finally {
      loadingGiftsRef.current = false;
    }
  }, [getAuthHeaders, preloadGiftImages]);

  // 🙏 Solicitar regalo (solo modelos)
  const requestGift = useCallback(async (giftId, message = '') => {
    console.log('🎁 [useVideoChatGifts] requestGift llamado:', {
      giftId,
      message,
      roomName,
      currentUserRole: currentUser?.role,
      currentUserId: currentUser?.id,
      otherUserId: otherUser?.id,
      otherUserName: otherUser?.name
    });

    if (!otherUser?.id || currentUser?.role !== 'modelo') {
      console.error('❌ [useVideoChatGifts] No autorizado:', {
        hasOtherUser: !!otherUser?.id,
        userRole: currentUser?.role
      });
      return { success: false, error: 'No autorizado para solicitar regalos' };
    }

    if (!roomName) {
      console.error('❌ [useVideoChatGifts] roomName no válido:', roomName);
      return { success: false, error: 'Sala no válida' };
    }

    if (requestingGift) {
      return { success: false, error: 'Ya hay una solicitud en proceso' };
    }

    try {
      setRequestingGift(true);
      setLoading(true);
      
      const requestBody = {
        room_name: roomName,
        gift_id: giftId,
        client_id: otherUser.id,
        message: message
      };

      console.log('🎁 [useVideoChatGifts] Enviando solicitud al backend:', {
        url: `${API_BASE_URL}/api/videochat/gifts/request`,
        body: requestBody,
        headers: getAuthHeaders()
      });
      
      // 🔥 VERIFICAR QUE LOS PARÁMETROS ESTÉN CORRECTOS
      console.log('🔍 [useVideoChatGifts] Verificación de parámetros:', {
        roomName: roomName,
        roomNameType: typeof roomName,
        roomNameLength: roomName?.length,
        currentUser: {
          id: currentUser?.id,
          role: currentUser?.role,
          name: currentUser?.name
        },
        otherUser: {
          id: otherUser?.id,
          name: otherUser?.name
        },
        giftId: giftId,
        message: message
      });
            
      const response = await fetch(`${API_BASE_URL}/api/videochat/gifts/request`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      
      console.log('🎁 [useVideoChatGifts] Respuesta del backend:', {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText
      });
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🎁 [useVideoChatGifts] Datos parseados:', data);
      } catch (parseError) {
        console.error('❌ [useVideoChatGifts] Error parseando respuesta:', parseError, responseText);
        return { 
          success: false, 
          error: 'Respuesta inválida del servidor',
          rawResponse: responseText 
        };
      }

      if (response.ok && data.success) {
        console.log('✅ [useVideoChatGifts] Solicitud exitosa:', data);
                return { 
          success: true, 
          data: data.data,
          chatMessage: data.chat_message,
          requestId: data.data?.request_id,
          securityHash: data.data?.security_hash,
          giftInfo: {
            name: data.data?.gift?.name,
            image: data.data?.gift?.image,
            price: data.data?.gift?.price
          },
          message: data.message
        };
      } else {
        console.error('❌ [useVideoChatGifts] Error en la respuesta:', {
          status: response.status,
          error: data.error,
          message: data.message,
          fullResponse: data
        });
                
        let errorMessage = 'Error enviando solicitud';
        if (data.error === 'missing_parameters') {
          errorMessage = 'Faltan parámetros requeridos';
        } else if (data.error === 'invalid_session') {
          errorMessage = 'Sesión de videochat no válida';
          console.error('❌ [useVideoChatGifts] Sesión inválida. Verificar:', {
            roomName,
            currentUserId: currentUser?.id,
            otherUserId: otherUser?.id
          });
        } else if (data.error === 'duplicate_request') {
          errorMessage = 'Ya existe una solicitud similar reciente';
        } else if (data.message) {
          errorMessage = data.message;
        }
        
        return { 
          success: false, 
          error: errorMessage,
          serverResponse: data
        };
      }
    } catch (error) {
            return { success: false, error: 'Error de conexión. Verifica tu internet.' };
    } finally {
      setRequestingGift(false);
      setLoading(false);
    }
  }, [roomName, currentUser, otherUser, getAuthHeaders, requestingGift]);

  // 📋 Cargar solicitudes pendientes (solo clientes)
  const loadPendingRequests = useCallback(async () => {
    if (currentUser?.role !== 'cliente' || loadingRequestsRef.current) return;

    try {
      loadingRequestsRef.current = true;
            
      const url = roomName 
        ? `${API_BASE_URL}/api/videochat/gifts/pending?room_name=${encodeURIComponent(roomName)}`
        : `${API_BASE_URL}/api/videochat/gifts/pending`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPendingRequests(data.requests || []);
                    return { success: true, requests: data.requests };
        } else {
                    return { success: false, error: data.error };
        }
      } else {
        const errorText = await response.text();
                return { success: false, error: `Error ${response.status}` };
      }
    } catch (error) {
            return { success: false, error: 'Error de conexión' };
    } finally {
      loadingRequestsRef.current = false;
    }
  }, [roomName, currentUser, getAuthHeaders]);

  // ✅ Aceptar regalo (solo clientes)
  const acceptGift = useCallback(async (requestId, securityHash) => {
    if (currentUser?.role !== 'cliente') {
      return { success: false, error: 'No autorizado para aceptar regalos' };
    }

    if (processingRequest === requestId) {
      return { success: false, error: 'Solicitud ya siendo procesada' };
    }

    try {
      setProcessingRequest(requestId);
      setLoading(true);
      
            
      const response = await fetch(`${API_BASE_URL}/api/videochat/gifts/accept/${requestId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          security_hash: securityHash
        })
      });

      const data = await response.json();
            
      if (response.ok && data.success) {
                
        // Actualizar balance si está disponible
        if (data.data?.client_balance?.new_balance !== undefined) {
          setUserBalance(data.data.client_balance.new_balance);
        }
        
        // Remover de pendientes
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        
        // Notificación de éxito
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
                
        let errorMessage = data.message || data.error || 'Error desconocido';
        
        if (data.error === 'insufficient_balance') {
          errorMessage = `Saldo insuficiente. Necesitas ${data.data?.required_amount || 'más'} monedas`;
        } else if (data.error === 'invalid_request') {
          errorMessage = 'La solicitud ya expiró o fue procesada';
        } else if (data.error === 'security_violation') {
          errorMessage = 'Error de seguridad. Recarga la página';
        }
        
        return { success: false, error: errorMessage };
      }
    } catch (error) {
            return { success: false, error: 'Error de conexión' };
    } finally {
      setProcessingRequest(null);
      setLoading(false);
    }
  }, [currentUser, getAuthHeaders, processingRequest]);

  // 💰 Cargar balance del usuario - AGREGAR ESTA FUNCIÓN
// 🔥 REF PARA EVITAR MÚLTIPLAS LLAMADAS
const loadUserBalanceCallRef = useRef(false);
const lastLoadUserBalanceTimeRef = useRef(0);

const loadUserBalance = useCallback(async () => {
  // 🔥 PROTECCIÓN CONTRA MÚLTIPLAS EJECUCIONES SIMULTÁNEAS (pero permitir llamadas frecuentes)
  if (loadUserBalanceCallRef.current) {
    return { success: false, error: 'Ya hay una petición en curso' };
  }
  
  // 🔥 REDUCIR TIEMPO MÍNIMO A 5 SEGUNDOS (más permisivo)
  const now = Date.now();
  if (now - lastLoadUserBalanceTimeRef.current < 5000) {
    return { success: false, error: 'Demasiado pronto para cargar balance' };
  }
  
  loadUserBalanceCallRef.current = true;
  lastLoadUserBalanceTimeRef.current = now;
  
  try {
    console.log('🔄 [useVideoChatGifts] Iniciando carga de balance de regalos...');
    const response = await Promise.race([
      fetch(`${API_BASE_URL}/api/videochat/gifts/balance`, {
        method: 'GET',
        headers: getAuthHeaders()
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    
    console.log('📡 [useVideoChatGifts] Respuesta recibida, status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('💰 [useVideoChatGifts] Respuesta completa del endpoint:', JSON.stringify(data, null, 2));
      if (data.success) {
        // 🔥 USAR gift_balance_coins (saldo real de regalos) SI ESTÁ DISPONIBLE
        // gift_balance_coins es el saldo de regalos real del UserCoins
        // gift_balance es el totalBalance (purchased + gift) para compatibilidad
        const balance = data.gift_balance_coins !== undefined 
          ? data.gift_balance_coins 
          : (data.gift_balance !== undefined ? data.gift_balance : (data.balance || 0));
        setUserBalance(balance);
        console.log('✅ [useVideoChatGifts] Balance de regalos procesado y actualizado:', {
          gift_balance_coins: data.gift_balance_coins,
          gift_balance: data.gift_balance,
          balance: data.balance,
          final_balance: balance,
          user_role: data.user_role,
          purchased_balance: data.purchased_balance
        });
        return { success: true, balance: balance };
      } else {
        console.warn('⚠️ [useVideoChatGifts] Respuesta no exitosa:', data);
      }
    } else {
      const errorText = await response.text();
      console.error('❌ [useVideoChatGifts] Error en respuesta:', response.status, errorText);
    }
    
    return { success: false, error: 'Error cargando balance' };
  } catch (error) {
    return { success: false, error: 'Error de conexión' };
  } finally {
    // 🔥 RESETEAR FLAG DESPUÉS DE UN DELAY MÁS CORTO
    setTimeout(() => {
      loadUserBalanceCallRef.current = false;
    }, 5000); // 🔥 Reducido a 5 segundos
  }
}, [getAuthHeaders]);

  // ❌ Rechazar regalo (solo clientes)
  const rejectGift = useCallback(async (requestId, reason = '') => {
    if (currentUser?.role !== 'cliente') {
      return { success: false, error: 'No autorizado para rechazar regalos' };
    }

    try {
            
      const response = await fetch(`${API_BASE_URL}/api/videochat/gifts/reject/${requestId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason })
      });

      const data = await response.json();
      
      if (data.success) {
                
        // Remover de pendientes
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        
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
  }, [currentUser, getAuthHeaders]);

  // 📊 Obtener historial de regalos
  const loadGiftHistory = useCallback(async (limit = 20) => {
    try {
      const url = roomName 
        ? `${API_BASE_URL}/api/videochat/gifts/history?limit=${limit}&room_name=${encodeURIComponent(roomName)}`
        : `${API_BASE_URL}/api/videochat/gifts/history?limit=${limit}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return { 
            success: true, 
            history: data.history,
            totalSent: data.total_sent,
            totalReceived: data.total_received
          };
        }
      }
      
      return { success: false, error: 'Error cargando historial' };
    } catch (error) {
            return { success: false, error: 'Error de conexión' };
    }
  }, [roomName, getAuthHeaders]);


  // 🔥 REF PARA EVITAR MÚLTIPLAS LLAMADAS A loadGifts
  const loadGiftsCallRef = useRef(false);
  const lastLoadGiftsTimeRef = useRef(0);

  // 🚀 Inicializar al montar
  useEffect(() => {
    if (!roomName || !currentUser) return;
    
    // 🔥 PROTECCIÓN CONTRA MÚLTIPLAS EJECUCIONES
    if (loadGiftsCallRef.current) {
      return;
    }
    
    // 🔥 MÍNIMO 60 SEGUNDOS ENTRE LLAMADAS
    const now = Date.now();
    if (now - lastLoadGiftsTimeRef.current < 60000) {
      return;
    }

    loadGiftsCallRef.current = true;
    lastLoadGiftsTimeRef.current = now;

    loadGifts();
    
    if (currentUser.role === 'cliente') {
      loadPendingRequests();
    }

    // 🔥 RESETEAR FLAG DESPUÉS DE UN DELAY
    setTimeout(() => {
      loadGiftsCallRef.current = false;
    }, 60000);
  }, [roomName, currentUser?.id]); // 🔥 Solo dependencias críticas, sin funciones

  // 🔥 CARGAR BALANCE AUTOMÁTICAMENTE AL MONTAR Y PERIÓDICAMENTE (PARA AMBOS ROLES)
  useEffect(() => {
    if (!currentUser) return;
    
    // Cargar balance inicial después de un pequeño delay
    const timer = setTimeout(() => {
      loadUserBalance();
    }, 1000);
    
    // 🔥 ACTUALIZAR BALANCE CADA 30 SEGUNDOS (para ambos roles)
    const interval = setInterval(() => {
      if (!loadUserBalanceCallRef.current) {
        loadUserBalance();
      }
    }, 30000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentUser?.id, loadUserBalance]);

  // 🔄 Polling para solicitudes pendientes (solo clientes)
  useEffect(() => {
    if (currentUser?.role !== 'cliente' || !roomName) return;

        
    const interval = setInterval(() => {
      if (!loadingRequestsRef.current) {
        loadPendingRequests();
      }
    }, 8000); // Cada 8 segundos

    return () => {
            clearInterval(interval);
    };
  }, [currentUser, roomName, loadPendingRequests]);

  // 🧹 Cleanup al cambiar de sala
  useEffect(() => {
    return () => {
      if (roomName) {
                setPendingRequests([]);
        setProcessingRequest(null);
        setRequestingGift(false);
        setLoading(false);
      }
    };
  }, [roomName]);

  return {
    // Estados
    gifts,
    pendingRequests,
    userBalance,
    loading,
    requestingGift,
    processingRequest,
    
    // Acciones
    requestGift,
    acceptGift,
    rejectGift,
    
    // Loaders
    loadGifts,
    loadPendingRequests,
    loadGiftHistory,
    loadUserBalance,
    
    // Utilidades
    setPendingRequests,
    setUserBalance
  };
};

export default useVideoChatGifts;