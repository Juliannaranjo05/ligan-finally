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
          setGifts(data.gifts || []);
          return { success: true, gifts: data.gifts };
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
  }, [getAuthHeaders]);

  // 🙏 Solicitar regalo (solo modelos)
  const requestGift = useCallback(async (giftId, message = '') => {
    if (!otherUser?.id || currentUser?.role !== 'modelo') {
            return { success: false, error: 'No autorizado para solicitar regalos' };
    }

    if (!roomName) {
            return { success: false, error: 'Sala no válida' };
    }

    if (requestingGift) {
      console.warn('⚠️ [VIDEOCHAT] Ya hay una solicitud en proceso');
      return { success: false, error: 'Ya hay una solicitud en proceso' };
    }

    try {
      setRequestingGift(true);
      setLoading(true);
      
            
      const response = await fetch(`${API_BASE_URL}/api/videochat/gifts/request`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          room_name: roomName,
          gift_id: giftId,
          client_id: otherUser.id,
          message: message
        })
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
                
        let errorMessage = 'Error enviando solicitud';
        if (data.error === 'missing_parameters') {
          errorMessage = 'Faltan parámetros requeridos';
        } else if (data.error === 'invalid_session') {
          errorMessage = 'Sesión de videochat no válida';
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
      console.warn('⚠️ [VIDEOCHAT] Solicitud ya siendo procesada');
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
const loadUserBalance = useCallback(async () => {
  try {
        
    const response = await fetch(`${API_BASE_URL}/api/videochat/gifts/balance`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
                setUserBalance(data.balance || 0);
        return { success: true, balance: data.balance };
      }
    }
    
        return { success: false, error: 'Error cargando balance' };
  } catch (error) {
        return { success: false, error: 'Error de conexión' };
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

  // 🚀 Inicializar al montar
  useEffect(() => {
    if (roomName && currentUser) {
      loadGifts();
        loadUserBalance();  // ← AGREGAR ESTA LÍNEA

      
      if (currentUser.role === 'cliente') {
        loadPendingRequests();
      }
    }
  }, [roomName, currentUser, loadGifts, loadUserBalance, loadPendingRequests]);

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