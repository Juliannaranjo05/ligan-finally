// useHybridChat.js - VERSIÓN SIN DUPLICACIÓN
import { useState, useEffect, useRef, useCallback, useMemo  } from 'react';

export const useHybridChat = (
  roomName,
  userData = { name: '', role: '', id: null },
  otherUser = null,
  options = {}
) => {
  const {
    onMessageReceived = null,
    onGiftReceived = null,
    onUserDetected = null,
    debugMode = false,
    enabled = true
  } = options;
  
  // 🔧 Estados del hook
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [stats, setStats] = useState({
    totalMessages: 0,
    sentMessages: 0,
    receivedMessages: 0,
    failedMessages: 0
  });
  
  // 📡 Referencia a la API del componente híbrido
  const chatAPIRef = useRef(null);
  const isInitialized = useRef(false);
  const lastAPIChecksum = useRef(''); // 🔥 NUEVO: Para detectar cambios reales
  
  // 🎯 Logger condicional
  const log = useCallback((message, data = {}) => {
    if (debugMode) {
      console.log(`🔀 [HYBRID-HOOK] ${message}`, data);
    }
  }, [debugMode]);
  
  // 🔥 FUNCIÓN PARA CREAR CHECKSUM DE LA API
  const createAPIChecksum = useCallback((api) => {
    if (!api) return '';
    
    return JSON.stringify({
      messagesCount: api.messages?.length || 0,
      connected: api.isConnected || false,
      sending: api.isSendingMessage || false,
      lastSync: api.lastSyncTime,
      // Solo incluir IDs de mensajes para detectar cambios reales
      messageIds: (api.messages || []).slice(0, 5).map(m => m.id)
    });
  }, []);
  
  // 🔌 CONEXIÓN CON EL COMPONENTE HÍBRIDO - OPTIMIZADA
  useEffect(() => {
    if (!roomName || !userData.name || !enabled) {
      log('Hook no inicializado', { roomName, userName: userData.name, enabled });
      return;
    }
    
    log('Inicializando hook optimizado', { roomName, userName: userData.name });
    
    // Configurar el listener para la API del componente
    window.hybridChatAPI = (api) => {
      // 🔥 VERIFICAR SI REALMENTE HAY CAMBIOS
      const newChecksum = createAPIChecksum(api);
      
      if (newChecksum === lastAPIChecksum.current) {
        // No hay cambios reales, no actualizar
        return;
      }
      
      log('API del componente actualizada con cambios reales', { 
        messagesCount: api?.messages?.length || 0,
        connected: api?.isConnected,
        checksumChanged: newChecksum !== lastAPIChecksum.current
      });
      
      lastAPIChecksum.current = newChecksum;
      chatAPIRef.current = api;
      isInitialized.current = true;
      
      // Sincronizar estados SOLO cuando hay cambios
      if (api) {
        setMessages(prev => {
          const newMessages = api.messages || [];
          // Solo actualizar si realmente cambió
          const prevChecksum = JSON.stringify(prev.map(m => m.id));
          const newChecksum = JSON.stringify(newMessages.map(m => m.id));
          
          if (prevChecksum !== newChecksum) {
            log('Actualizando mensajes por cambio real', {
              antes: prev.length,
              despues: newMessages.length
            });
            return newMessages;
          }
          
          return prev; // No cambiar si es igual
        });
        
        setIsConnected(prev => {
          const newConnected = api.isConnected || false;
          return prev !== newConnected ? newConnected : prev;
        });
        
        setIsSendingMessage(prev => {
          const newSending = api.isSendingMessage || false;
          return prev !== newSending ? newSending : prev;
        });
        
        setLastSyncTime(prev => {
          const newTime = api.lastSyncTime;
          return prev !== newTime ? newTime : prev;
        });
        
        setStats(prev => {
          const newStats = api.stats || stats;
          const statsChanged = JSON.stringify(prev) !== JSON.stringify(newStats);
          return statsChanged ? newStats : prev;
        });
      }
    };
    
    return () => {
      delete window.hybridChatAPI;
      chatAPIRef.current = null;
      isInitialized.current = false;
      lastAPIChecksum.current = '';
    };
  }, [roomName, userData.name, enabled, createAPIChecksum, log]);
  
  // 📨 FUNCIÓN PARA ENVIAR MENSAJE - SIN CAMBIOS
  const sendMessage = useCallback(async (messageText, messageType = 'text', extraData = null) => {
    if (!chatAPIRef.current || !isInitialized.current) {
      log('⚠️ API no disponible para enviar mensaje');
      return { success: false, error: 'Chat system not initialized' };
    }
    
    log('Enviando mensaje via hook', { text: messageText, type: messageType });
    
    try {
      const result = await chatAPIRef.current.sendMessage(messageText, messageType, extraData);
      
      // Actualizar estadísticas locales
      if (result.success) {
        setStats(prev => ({
          ...prev,
          sentMessages: prev.sentMessages + 1,
          totalMessages: prev.totalMessages + 1
        }));
      } else {
        setStats(prev => ({
          ...prev,
          failedMessages: prev.failedMessages + 1
        }));
      }
      
      return result;
    } catch (error) {
      log('❌ Error enviando mensaje', { error: error.message });
      return { success: false, error: error.message };
    }
  }, [log]);
  
  // 🎁 FUNCIÓN PARA ENVIAR REGALO - SIN CAMBIOS
  const sendGift = useCallback(async (giftData, message = '') => {
    if (!chatAPIRef.current) {
      return { success: false, error: 'Chat system not initialized' };
    }
    
    log('Enviando regalo via hook', { giftName: giftData.name });
    
    try {
      return await chatAPIRef.current.sendGift(giftData, message);
    } catch (error) {
      log('❌ Error enviando regalo', { error: error.message });
      return { success: false, error: error.message };
    }
  }, [log]);
  
  // 😊 FUNCIÓN PARA ENVIAR EMOJI
  const sendEmoji = useCallback(async (emoji) => {
    if (!chatAPIRef.current) {
      return { success: false, error: 'Chat system not initialized' };
    }
    
    return await chatAPIRef.current.sendEmoji(emoji);
  }, []);
  
  // 📚 FUNCIÓN PARA CARGAR MENSAJES HISTÓRICOS
  const loadHistoricalMessages = useCallback(async (limit = 50) => {
    if (!chatAPIRef.current) {
      return { success: false, error: 'Chat system not initialized' };
    }
    
    log('Cargando mensajes históricos via hook', { limit });
    
    try {
      return await chatAPIRef.current.loadHistoricalMessages(limit);
    } catch (error) {
      log('❌ Error cargando históricos', { error: error.message });
      return { success: false, error: error.message };
    }
  }, [log]);
  
  // 🔄 FUNCIÓN PARA SINCRONIZAR CON BASE DE DATOS
  const syncWithDatabase = useCallback(async () => {
    if (!chatAPIRef.current) {
      return { success: false, error: 'Chat system not initialized' };
    }
    
    try {
      return await chatAPIRef.current.syncWithDatabase();
    } catch (error) {
      log('❌ Error sincronizando', { error: error.message });
      return { success: false, error: error.message };
    }
  }, [log]);
  
  // 🔥 ELIMINAR SINCRONIZACIÓN AUTOMÁTICA AGRESIVA
  // ❌ CÓDIGO ELIMINADO:
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     // Esta sincronización constante causaba duplicados
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, []);
  
  // 📊 ESTADÍSTICAS CALCULADAS - OPTIMIZADAS
  const calculatedStats = useMemo(() => {
    return {
      ...stats,
      localMessages: messages.filter(m => m.isLocal).length,
      remoteMessages: messages.filter(m => !m.isLocal).length,
      recentMessages: messages.filter(m => 
        Date.now() - (m.timestamp || 0) < 5 * 60 * 1000
      ).length,
      oldMessages: messages.filter(m => m.isOld).length,
      liveMessages: messages.filter(m => !m.isOld).length
    };
  }, [stats, messages]);
  
  // 🎯 FILTROS DE MENSAJES - MEMOIZADOS
  const getMessagesByType = useCallback((type) => {
    return messages.filter(m => m.type === type);
  }, [messages]);
  
  const getMessagesBySender = useCallback((senderName) => {
    return messages.filter(m => m.sender === senderName);
  }, [messages]);
  
  const getRecentMessages = useCallback((minutes = 5) => {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return messages.filter(m => (m.timestamp || 0) > cutoff);
  }, [messages]);
  
  // 🧹 FUNCIÓN DE LIMPIEZA
  const clearMessages = useCallback(() => {
    setMessages([]);
    setStats({
      totalMessages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      failedMessages: 0
    });
    lastAPIChecksum.current = '';
    log('Mensajes limpiados');
  }, [log]);
  
  // 🔍 FUNCIÓN DE BÚSQUEDA
  const searchMessages = useCallback((query) => {
    if (!query.trim()) return messages;
    
    const normalizedQuery = query.toLowerCase().trim();
    return messages.filter(m => 
      (m.text || '').toLowerCase().includes(normalizedQuery) ||
      (m.sender || '').toLowerCase().includes(normalizedQuery)
    );
  }, [messages]);
  
  // 📱 ESTADO DE CONECTIVIDAD
  const connectionStatus = useMemo(() => ({
    isConnected,
    isInitialized: isInitialized.current,
    hasAPI: !!chatAPIRef.current,
    roomName,
    userName: userData.name,
    messagesCount: messages.length
  }), [isConnected, roomName, userData.name, messages.length]);
  
  // 🎯 API RETORNADA POR EL HOOK
  return {
    // 📨 Funciones principales
    sendMessage,
    sendGift,
    sendEmoji,
    
    // 📚 Gestión de mensajes
    messages,
    loadHistoricalMessages,
    syncWithDatabase,
    clearMessages,
    
    // 🔍 Utilidades
    searchMessages,
    getMessagesByType,
    getMessagesBySender,
    getRecentMessages,
    
    // 📊 Estado y estadísticas
    isConnected,
    isSendingMessage,
    lastSyncTime,
    stats: calculatedStats,
    connectionStatus,
    
    // 🔧 Configuración
    enabled,
    roomName,
    userData,
    otherUser,
    
    // 🐛 Debug
    debugMode,
    chatAPI: chatAPIRef.current
  };
};