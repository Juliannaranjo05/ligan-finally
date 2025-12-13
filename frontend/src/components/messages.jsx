import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 🔥 CACHE SIMPLIFICADO SIN RATE LIMITING - OPTIMIZADO PARA CHAT EN TIEMPO REAL
class ChatCacheManager {
  constructor() {
    this.participantsCache = new Map();
    this.messagesCache = new Map();
    this.pendingRequests = new Map();
    
    // Cache más corto para chat en tiempo real
    this.PARTICIPANTS_CACHE_DURATION = 5000; // 5 segundos
    this.MESSAGES_CACHE_DURATION = 1500; // 1.5 segundos - muy corto para tiempo real
    this.RATE_LIMIT_BACKOFF = 3000; // Solo para errores 429 del servidor
  }

  async fetchWithCache(endpoint, cacheMap, cacheDuration, fetchFunction) {
    // 1. Verificar cache (solo si no es muy viejo)
    const cached = cacheMap.get(endpoint);
    if (cached && (Date.now() - cached.timestamp) < cacheDuration) {
            return cached.data;
    }

    // 2. Verificar request pendiente para evitar duplicados
    if (this.pendingRequests.has(endpoint)) {
            return await this.pendingRequests.get(endpoint);
    }

    // 3. Hacer request sin rate limiting interno
    const requestPromise = this.makeRequestWithRetry(endpoint, fetchFunction);
    this.pendingRequests.set(endpoint, requestPromise);

    try {
      const result = await requestPromise;
      
      // Guardar en cache
      cacheMap.set(endpoint, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } finally {
      this.pendingRequests.delete(endpoint);
    }
  }

  async makeRequestWithRetry(endpoint, fetchFunction, retryCount = 0) {
    try {
      return await fetchFunction();
    } catch (error) {
      // Solo manejar errores 429 del servidor, no rate limiting propio
      if (error.response?.status === 429) {
        console.warn(`⚠️ Rate limited por servidor en ${endpoint}, intento ${retryCount + 1}`);
        
        // Usar cache como fallback si existe
        const cacheKey = endpoint;
        const participantsCache = this.participantsCache.get(cacheKey);
        const messagesCache = this.messagesCache.get(cacheKey);
        
        if (participantsCache || messagesCache) {
                    return (participantsCache || messagesCache).data;
        }

        // Solo reintentar si es error del servidor
        if (retryCount < 2) {
          const delay = this.RATE_LIMIT_BACKOFF * (retryCount + 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequestWithRetry(endpoint, fetchFunction, retryCount + 1);
        }
      }
      
      throw error;
    }
  }

  // 🔥 NUEVA FUNCIÓN: Invalidar cache específico
  invalidateCache(endpoint) {
    this.participantsCache.delete(endpoint);
    this.messagesCache.delete(endpoint);
      }

  clearCache() {
    this.participantsCache.clear();
    this.messagesCache.clear();
    this.pendingRequests.clear();
      }
}

// 🔥 INSTANCIA GLOBAL
const chatCache = new ChatCacheManager();

const SimpleChat = ({ 
  userName, 
  userRole = 'modelo',
  roomName,
  onMessageReceived = null,
  onGiftReceived = null, 
  onUserLoaded = null,
  onParticipantsUpdated = null,
  disabled = false,           // 🔥 AGREGAR ESTA LÍNEA
  suppressMessages = false    // 🔥 AGREGAR ESTA LÍNEA
}) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [otherParticipant, setOtherParticipant] = useState(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const persistedUser = useRef(null);
  
  const lastMessageId = useRef(null);
  const pollingInterval = useRef(null);
  const participantsInterval = useRef(null);
  const processedMessages = useRef(new Set());
  const [localUserName, setLocalUserName] = useState(userName || '');
  const [localUserRole, setLocalUserRole] = useState(userRole || '');
  const partnerLoaded = useRef(false);
  const detectionMethod = useRef(null);
  
  // 🔥 FUNCIÓN SIN RATE LIMITING: fetchParticipants
  const fetchParticipants = async () => {
    if (!roomName) {
            return;
    }

    const endpoint = `participants_${roomName}`;
    
    try {
      const result = await chatCache.fetchWithCache(
        endpoint,
        chatCache.participantsCache,
        chatCache.PARTICIPANTS_CACHE_DURATION,
        async () => {
          const token = localStorage.getItem('token');
          if (!token) {
                        throw new Error('No hay token');
          }

          const response = await fetch(`${API_BASE_URL}/api/chat/participants/${roomName}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Sin contenido de error');

            if (response.status === 403) {
                          }

            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
                    
          return data;
        }
      );

      // Procesar resultado
      if (result.success && result.participants) {
        setParticipants(result.participants);
        
        const otherUser = result.participants.find(p => !p.is_current_user);
        if (otherUser) {
                    detectOtherUser({
            name: otherUser.name,
            role: otherUser.role,
            id: otherUser.id
          }, 'participants');
        }
        
        if (onParticipantsUpdated && typeof onParticipantsUpdated === 'function') {
          onParticipantsUpdated(result.participants);
        }
      }

    } catch (error) {
            
      if (error.message.includes('500')) {
        console.warn('⚠️ Error 500 en participantes - endpoint no implementado');
        
        // Detener polling de participantes si es error 500
        if (participantsInterval.current) {
          clearInterval(participantsInterval.current);
          participantsInterval.current = null;
        }
      }
    }
  };

  // 🔥 FUNCIÓN SIN RATE LIMITING: fetchMessages - URL CORREGIDA
  const fetchMessages = async () => {

  if (disabled || suppressMessages) {
        return;
  }

  if (!roomName) {
        return;
  }

  const endpoint = `messages_${roomName}`;

  try {
    const result = await chatCache.fetchWithCache(
      endpoint,
      chatCache.messagesCache,
      chatCache.MESSAGES_CACHE_DURATION,
      async () => {
        const token = localStorage.getItem('token');
        if (!token) {
                    throw new Error('No hay token de autenticación');
        }

        const response = await fetch(`${API_BASE_URL}/api/chat/messages/${roomName}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Sin contenido de error');
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        return data;
      }
    );

    // Procesar mensajes
    if (result.success && result.messages) {
      // 🔥 DEBUG: ANALIZAR TODOS LOS MENSAJES RECIBIDOS
            
      result.messages.forEach((msg, index) => {
        
        // 🔥 SI ES GIFT_REQUEST, MOSTRAR DATOS COMPLETOS
        if (msg.type === 'gift_request') {
          
        }
      });

      // Detectar usuario desde mensajes si no tenemos detección por participantes
      if (!partnerLoaded.current || detectionMethod.current === null) {
        const otherUserMessage = result.messages.find(msg => 
          msg.user_name !== userName && 
          msg.user_name !== localUserName
        );
        if (otherUserMessage) {
          detectUserFromMessage(otherUserMessage);
        }
      }

      // Procesar mensajes nuevos
      const newMessages = result.messages.filter(msg => {
        const isNotMine = msg.user_name !== userName;
        const isNotProcessed = !processedMessages.current.has(msg.id);
        const isNewer = !lastMessageId.current || msg.id > lastMessageId.current;
        
        return isNotMine && isNotProcessed && isNewer;
      });

      // 🔥 DEBUG: MOSTRAR MENSAJES NUEVOS QUE SE VAN A PROCESAR
            newMessages.forEach((msg, index) => {
      });

      // 🔥 REEMPLAZAR EN SimpleChat.jsx - fetchMessages()
// Líneas 100-170 aproximadamente

newMessages.forEach(msg => {
  processedMessages.current.add(msg.id);
  lastMessageId.current = Math.max(lastMessageId.current || 0, msg.id);

  detectUserFromMessage(msg);

  if (onMessageReceived) {


    // 🔥 DETECTAR SI ES GIFT_REQUEST POR CONTENIDO Y TIPO
    const isGiftRequest = msg.type === 'gift_request' || 
                         (msg.message && msg.message.includes('Solicitud de regalo'));
    
    const isGiftMessage = isGiftRequest ||
                         msg.type === 'gift_sent' ||
                         msg.type === 'gift_received' ||
                         msg.type === 'gift' ||
                         msg.type === 'gift_rejected' ||
                         (msg.message && (
                           msg.message.includes('Solicitud de regalo') ||
                           msg.message.includes('Rechazaste una solicitud') ||
                           msg.message.includes('Enviaste un regalo') ||
                           msg.message.includes('Recibiste un regalo') ||
                           msg.message.includes('Enviaste:') ||
                           msg.message.includes('Recibiste:')
                         ));

    // 🔥 FUNCIÓN HELPER PARA PARSING SEGURO
    const parseJsonSafely = (data, fieldName = 'data') => {
      if (!data) return {};
      
      if (typeof data === 'object' && data !== null) {
        return data;
      }
      
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          return parsed;
        } catch (e) {
                    return {};
        }
      }
      
      return {};
    };

    const messageForParent = {
      id: msg.id,
      text: msg.message,
      sender: msg.user_name,
      senderRole: msg.user_role,
      
      // 🔥 MEJORAR DETECCIÓN DE TIPO
      type: (() => {
        if (isGiftRequest) return 'gift_request';
        if (msg.type === 'gift_sent') return 'gift_sent';
        if (msg.type === 'gift_received') return 'gift_received';
        if (msg.type === 'gift_rejected') return 'gift_rejected';
        if (msg.type === 'gift') return 'gift';
        
        // 🔥 DETECTAR POR CONTENIDO DE MENSAJE
        if (msg.message && msg.message.includes('Enviaste:')) return 'gift_sent';
        if (msg.message && msg.message.includes('Recibiste:')) return 'gift_received';
        if (msg.message && msg.message.includes('Solicitud de regalo')) return 'gift_request';
        
        return msg.type || 'remote';
      })(),
      
      timestamp: msg.created_at,
      
      // 🔥 DATOS DE REGALO MEJORADOS
      extra_data: (() => {
        const parsed = parseJsonSafely(msg.extra_data, 'extra_data');
        
        // 🔥 SI NO HAY DATOS PERO ES MENSAJE DE REGALO, CREAR DATOS BÁSICOS
        if (Object.keys(parsed).length === 0 && msg.message) {
          if (msg.message.includes('Enviaste:') || msg.message.includes('Recibiste:')) {
            const giftName = msg.message.split(':')[1]?.trim() || 'Regalo';
            return {
              gift_name: giftName,
              gift_image: '', // Imagen por defecto o buscar en base de datos
              gift_price: 0,
              action_text: msg.message.includes('Enviaste:') ? 'Enviaste' : 'Recibiste'
            };
          }
        }
        
        return parsed;
      })(),
      
      gift_data: parseJsonSafely(msg.gift_data, 'gift_data'),
      
      // Legacy compatibility
      messageType: msg.type
    };

// 🔥 DEBUG ESPECÍFICO PARA MENSAJES DE REGALO
if (messageForParent.type.includes('gift')) {

}

    // 🔥 DEBUG ESPECÍFICO PARA GIFT REQUESTS
    if (isGiftRequest) {
    }

    onMessageReceived(messageForParent);

    // 🔥 MANTENER LÓGICA DE REGALOS EXISTENTE
    if (msg.type === 'gift' && messageForParent.extra_data && onGiftReceived) {
      onGiftReceived(messageForParent.extra_data);
    }
  }
});

      setIsConnected(true);
    }

  } catch (error) {
        setIsConnected(false);
  }
};
  // Funciones de detección (sin cambios)
  const detectOtherUser = (user, method) => {
    
    if (persistedUser.current && persistedUser.current.name === user.name) {
            setOtherParticipant(persistedUser.current);
      setIsDetecting(false);
      return true;
    }

    if (partnerLoaded.current && detectionMethod.current === 'participants' && method === 'messages') {
            return false;
    }

    if (!partnerLoaded.current || method === 'participants') {
            
      persistedUser.current = user;
      setOtherParticipant(user);
      setIsDetecting(false);
      detectionMethod.current = method;
      
      if (onUserLoaded && typeof onUserLoaded === 'function') {
        onUserLoaded(user);
        partnerLoaded.current = true;
              }
      
      return true;
    }
    
    return false;
  };

  const detectUserFromMessage = (msg) => {
    if (detectionMethod.current === 'participants') {
      return false;
    }

    const currentUserName = userName || localUserName;
    if (msg.user_name !== currentUserName && 
        msg.user_name !== localUserName && 
        msg.user_name !== userName) {
      
      return detectOtherUser({
        name: msg.user_name,
        role: msg.user_role,
        id: msg.user_id
      }, 'messages');
    }
    
    return false;
  };

  // 🔥 FUNCIONES DE ENVÍO MEJORADAS - URL CORREGIDA
  const sendMessage = async (messageText) => {
    
    if (!messageText?.trim() || !roomName) {
      return false;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      // 🔥 URL CORREGIDA: usar send-message en lugar de send
      const response = await fetch(`${API_BASE_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          room_name: roomName,
          message: messageText.trim(),
          type: 'text'
        })
      });

      if (response.ok) {
                
        // 🔥 INVALIDAR SOLO EL CACHE DE MENSAJES INMEDIATAMENTE
        const endpoint = `messages_${roomName}`;
        chatCache.invalidateCache(endpoint);
        
        // Fetch inmediato sin esperar
        fetchMessages();
        return true;
      } else {
                return false;
      }
    } catch (error) {
            return false;
    }
  };  

  const sendGift = async (gift) => {
    
    if (!gift || !roomName) return false;

    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      // 🔥 URL CORREGIDA
      const response = await fetch(`${API_BASE_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          room_name: roomName,
          message: `Envió ${gift.nombre}`,
          type: 'gift',
          extra_data: gift
        })
      });

      if (response.ok) {
                
        // Invalidar cache e inmediatamente fetch
        const endpoint = `messages_${roomName}`;
        chatCache.invalidateCache(endpoint);
        fetchMessages();
        return true;
      } else {
                return false;
      }
    } catch (error) {
            return false;
    }
  };

  const sendEmoji = async (emoji) => {
    
    if (!emoji || !roomName) return false;

    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      // 🔥 URL CORREGIDA
      const response = await fetch(`${API_BASE_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          room_name: roomName,
          message: emoji,
          type: 'emoji'
        })
      });

      if (response.ok) {
                
        // Invalidar cache e inmediatamente fetch
        const endpoint = `messages_${roomName}`;
        chatCache.invalidateCache(endpoint);
        fetchMessages();
        return true;
      } else {
                return false;
      }
    } catch (error) {
            return false;
    }
  };

  // Funciones auxiliares
  const getOtherParticipant = () => otherParticipant;
  const getAllParticipants = () => participants;
  const getParticipantsByRole = (role) => participants.filter(p => p.role === role);

  // 🔥 POLLING OPTIMIZADO PARA TIEMPO REAL - SIN RATE LIMITING
  useEffect(() => {
    if (!roomName) {
            return;
    }

    
    // Fetch inicial
    fetchParticipants();
    fetchMessages();

    // 🔥 POLLING MÁS FRECUENTE PARA CHAT EN TIEMPO REAL
    pollingInterval.current = setInterval(() => {
      fetchMessages(); // Cada 2 segundos para mensajes
    }, 2000);

    participantsInterval.current = setInterval(() => {
      fetchParticipants(); // Cada 6 segundos para participantes
    }, 6000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
              }
      if (participantsInterval.current) {
        clearInterval(participantsInterval.current);
              }
      
      // Limpiar cache al cambiar de sala
      const currentRoom = localStorage.getItem('roomName');
      if (currentRoom !== roomName) {
                chatCache.clearCache();
        persistedUser.current = null;
      }
    };
  }, [roomName, userName]);

  // Exponer funciones al componente padre
  useEffect(() => {
    const chatFunctionsData = {
      sendMessage,
      sendGift,
      sendEmoji,
      isConnected: isConnected && !!roomName,
      participants,
      otherParticipant,
      isDetecting,
      getOtherParticipant,
      getAllParticipants,
      getParticipantsByRole,
      refreshParticipants: fetchParticipants,
      // 🔥 NUEVA FUNCIÓN: Force refresh sin cache
      forceRefreshMessages: () => {
        const endpoint = `messages_${roomName}`;
        chatCache.invalidateCache(endpoint);
        fetchMessages();
      }
    };

    if (window.livekitChatFunctions) {
      window.livekitChatFunctions(chatFunctionsData);
    } else {
      window.livekitChatFunctions = (callback) => {
        if (typeof callback === 'function') {
          callback(chatFunctionsData);
        }
      };

      setTimeout(() => {
        if (window.livekitChatFunctions && typeof window.livekitChatFunctions === 'function') {
          window.livekitChatFunctions(chatFunctionsData);
        }
      }, 1000);
    }
  }, [roomName, isConnected, participants, otherParticipant]);

  // Limpiar cache de mensajes procesados cada 3 minutos (más frecuente)
  useEffect(() => {
    const cleanup = setInterval(() => {
      processedMessages.current.clear();
          }, 3 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Cargar perfil sin rate limiting
  useEffect(() => {
    const fetchProfile = async () => {
      try {
                const user = await getUser(false);
        const name = user.alias || user.name || user.username || '';
        const role = user.rol || user.role || 'modelo';

        
        setLocalUserName(name);
        setLocalUserRole(role);

        if (onUserLoaded && typeof onUserLoaded === 'function') {
          onUserLoaded({ name, role, id: user.id });
        }
      } catch (err) {
                setLocalUserName(userName || 'Usuario');
        setLocalUserRole(userRole || 'modelo');
      }
    };

    fetchProfile();
  }, []);

  return null;
};

export default SimpleChat;