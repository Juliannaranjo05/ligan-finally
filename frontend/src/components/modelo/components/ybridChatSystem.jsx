// HybridChatSystem.jsx - SOLUCIÓN FINAL: Sin Duplicación + Lado Correcto
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDataChannel } from "@livekit/components-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * 🚀 COMPONENTE HÍBRIDO DE CHAT - SOLUCIÓN FINAL
 * 
 * PROBLEMAS RESUELTOS:
 * - ❌ Mensajes duplicados
 * - ❌ Mensajes aparecen del lado incorrecto
 * - ❌ isLocal mal calculado
 * - ❌ Múltiples fuentes de verdad
 */
const HybridChatSystem = ({
  roomName,
  userData = { name: '', role: '', id: null },
  otherUser = null,
  onMessageReceived = null,
  onGiftReceived = null,
  onUserDetected = null,
  enabled = true,
  debugMode = false
}) => {
  // 🔧 Estados principales
  const [messages, setMessages] = useState([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // 🚀 DataChannel para tiempo real
  const {
    send: sendDataChannel,
    message: dataChannelMessage,
    isConnected: dataChannelConnected
  } = useDataChannel("hybrid-chat");
  
  // 📝 Referencias para control MEJORADAS
  const processedMessageIds = useRef(new Set()); // 🔥 IDs únicos procesados
  const sentMessageIds = useRef(new Set()); // 🔥 IDs de mensajes que YO envié
  const lastMessageId = useRef(null);
  const syncInterval = useRef(null);
  
  // 🎯 Logger condicional
  const log = useCallback((message, data = {}) => {
    if (debugMode) {
    }
  }, [debugMode]);

  // 🔥 FUNCIÓN PARA CREAR ID ÚNICO DE MENSAJE
  const createUniqueMessageId = (message) => {
    const text = (message.text || message.message || '').trim();
    const timestamp = message.timestamp || message.created_at || Date.now();
    const senderId = message.senderId || message.user_id || message.sender || '';
    const dbId = message.dbId || message.id || '';
    
    // Crear ID único que no dependa del timestamp exacto
    return `${senderId}_${text}_${Math.floor(timestamp / 10000)}_${dbId}`;
  };

  // 🔥 FUNCIÓN PARA DETERMINAR SI UN MENSAJE ES LOCAL (MÍO)
  const isMessageLocal = (message) => {
  const senderId = message.senderId || message.user_id;
  const senderName = message.sender || message.user_name;

    texto: (message.text || '').substring(0, 20),
    senderId: senderId,
    miId: userData.id,
    senderName: senderName,
    miNombre: userData.name,
    source: message.source,
    messageId: message.id
  });
  
  // 🔥 PRIORIDAD 1: Si está en el cache de mensajes enviados
  if (message.id && sentMessageIds.current.has(message.id)) {
    return true;
  }
  
  // 🔥 PRIORIDAD 2: Si tiene source local_send
  if (message.source === 'local_send') {
    return true;
  }
  
  // 🔥 PRIORIDAD 3: Si el mensaje viene marcado como local desde el envío
  if (message.isLocal === true && message.source !== 'datachannel') {
    return true;
  }
  
  // 🔥 PRIORIDAD 4: Verificar por ID
  if (senderId && userData.id) {
    const esLocal = senderId === userData.id || senderId.toString() === userData.id.toString();
    if (esLocal) {
      return true;
    }
  }
  
  // 🔥 PRIORIDAD 5: Verificar por nombre
  if (senderName && userData.name) {
    const esLocal = senderName === userData.name;
    if (esLocal) {
      return true;
    }
  }
  
  return false;
};
  // 💾 FUNCIÓN PARA GUARDAR EN BASE DE DATOS
  const saveMessageToDatabase = useCallback(async (messageData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }
      
      const payload = {
        room_name: roomName,
        message: messageData.text,
        type: messageData.type,
        extra_data: messageData.extraData ? JSON.stringify(messageData.extraData) : null
      };
      
      log('💾 Guardando en DB', { payload });
      
      const response = await fetch(`${API_BASE_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        log('✅ Guardado exitoso en DB', { dbId: result.message_id });
        return { success: true, dbId: result.message_id };
      } else {
        throw new Error(result.error || 'Database save failed');
      }
      
    } catch (error) {
      log('❌ Error en saveMessageToDatabase', { error: error.message });
      return { success: false, error: error.message };
    }
  }, [roomName, log]);

  // 📡 FUNCIÓN PRINCIPAL: ENVIAR MENSAJE HÍBRIDO
  const sendMessage = useCallback(async (messageText, messageType = 'text', extraData = null) => {
    if (!messageText?.trim() || isSendingMessage || !enabled) {
      return { success: false, error: 'Invalid message or system disabled' };
    }
    
    setIsSendingMessage(true);
    
    const messageId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    const messageData = {
      id: messageId,
      type: messageType,
      text: messageText.trim(),
      sender: userData.name,
      senderRole: userData.role,
      senderId: userData.id,
      timestamp,
      roomName,
      isLocal: true, // 🔥 FORZAR true para mensajes que YO envío
      extraData: extraData || null,
      status: 'sending',
      source: 'local_send'
    };
    
    // 🔥 MARCAR COMO MENSAJE MÍO
    sentMessageIds.current.add(messageId);
    
    log('📤 Enviando mensaje local', { 
      id: messageId, 
      text: messageText, 
      isLocal: true,
      userId: userData.id 
    });
    
    try {
      const uniqueId = createUniqueMessageId(messageData);
      
      // 🔥 VERIFICAR SI YA EXISTE
      if (processedMessageIds.current.has(uniqueId)) {
        log('⚠️ Mensaje duplicado detectado en envío');
        return { success: false, error: 'Duplicate message detected' };
      }
      
      processedMessageIds.current.add(uniqueId);
      
      // 🔥 AGREGAR INMEDIATAMENTE A UI
      setMessages(prev => {
        // Verificación extra por ID directo
        const exists = prev.some(m => m.id === messageId);
        if (exists) {
          log('⚠️ Mensaje ya existe en UI por ID');
          return prev;
        }
        
        return [{ ...messageData, status: 'sending' }, ...prev];
      });
      
      // 🚀 ENVÍO POR DATACHANNEL
      if (dataChannelConnected) {
        const dataChannelPayload = {
          ...messageData,
          action: 'message',
          source: 'datachannel'
        };
        
        sendDataChannel(JSON.stringify(dataChannelPayload));
        log('✅ Enviado por DataChannel', { messageId });
        
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, status: 'sent' }
            : msg
        ));
      }
      
      // 💾 GUARDAR EN BASE DE DATOS
      const dbPromise = saveMessageToDatabase(messageData);
      
      dbPromise.then((result) => {
        if (result.success) {
          log('✅ Guardado en DB', { messageId, dbId: result.dbId });
          
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  dbId: result.dbId,
                  status: 'delivered'
                }
              : msg
          ));
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, status: 'failed' }
              : msg
          ));
        }
      });
      
      return { success: true, messageId, timestamp };
      
    } catch (error) {
      log('❌ Error enviando mensaje', { error: error.message });
      
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, status: 'failed' }
          : msg
      ));
      
      return { success: false, error: error.message };
      
    } finally {
      setIsSendingMessage(false);
    }
  }, [isSendingMessage, enabled, userData, roomName, dataChannelConnected, sendDataChannel, saveMessageToDatabase, log]);

  // 📡 RECIBIR MENSAJES POR DATACHANNEL
  useEffect(() => {
    if (!dataChannelMessage || !enabled) return;
    
    try {
      const parsedMessage = JSON.parse(dataChannelMessage);
      
      if (parsedMessage.action === 'message') {
        log('📥 Mensaje DataChannel recibido RAW', parsedMessage);
        
        // 🔥 IGNORAR MIS PROPIOS MENSAJES EN DATACHANNEL
        if (sentMessageIds.current.has(parsedMessage.id)) {
          log('🚫 Ignorando mi propio mensaje en DataChannel', { id: parsedMessage.id });
          return;
        }
        
        const uniqueId = createUniqueMessageId(parsedMessage);
        
        if (processedMessageIds.current.has(uniqueId)) {
          log('⚠️ Mensaje DataChannel ya procesado', { uniqueId });
          return;
        }
        
        processedMessageIds.current.add(uniqueId);
        
        // 🔥 DETERMINAR SI ES LOCAL CORRECTAMENTE
        const isLocal = isMessageLocal(parsedMessage);
        
        const formattedMessage = {
          id: parsedMessage.id,
          type: parsedMessage.type || 'remote',
          text: parsedMessage.text,
          sender: parsedMessage.sender,
          senderRole: parsedMessage.senderRole,
          senderId: parsedMessage.senderId,
          timestamp: parsedMessage.timestamp,
          roomName: parsedMessage.roomName,
          isLocal: isLocal, // 🔥 USAR VERIFICACIÓN CORRECTA
          extraData: parsedMessage.extraData,
          status: 'delivered',
          source: 'datachannel',
          isOld: false
        };
        
        log('✅ Mensaje DataChannel procesado', {
          from: formattedMessage.sender,
          isLocal: formattedMessage.isLocal,
          senderId: formattedMessage.senderId,
          myId: userData.id
        });
        
        // 🔥 AGREGAR SOLO SI NO ES MÍO
        if (!isLocal) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === formattedMessage.id);
            if (exists) {
              log('⚠️ Mensaje DataChannel ya existe en UI');
              return prev;
            }
            
            return [formattedMessage, ...prev];
          });
          
          if (onMessageReceived) {
            onMessageReceived(formattedMessage);
          }
        } else {
          log('🚫 No agregando mensaje DataChannel porque es local');
        }
      }
    } catch (error) {
      log('❌ Error procesando mensaje DataChannel', { error: error.message });
    }
  }, [dataChannelMessage, enabled, userData.id, onMessageReceived, log]);

  // 📚 CARGAR MENSAJES HISTÓRICOS
  const loadHistoricalMessages = useCallback(async (limit = 50) => {
    if (!roomName || !enabled || !otherUser?.id) return { success: false, error: 'Invalid room or disabled' };
    
    try {
      log('📚 Cargando historial', { roomName, otherUserId: otherUser.id });
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/chat/messages/user/${otherUser.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.messages) {
        const historicalMessages = data.messages
          .map(msg => {
            // 🔥 DETERMINAR isLocal CORRECTAMENTE PARA HISTÓRICOS
            const isLocal = isMessageLocal(msg);
            
            return {
              id: `hist_${msg.id}`,
              dbId: msg.id,
              type: msg.type || 'remote',
              text: msg.message,
              sender: msg.user_name,
              senderRole: msg.user_role,
              senderId: msg.user_id,
              timestamp: new Date(msg.created_at).getTime(),
              isLocal: isLocal, // 🔥 USAR VERIFICACIÓN CORRECTA
              isOld: true,
              extraData: msg.extra_data ? (() => {
                try {
                  return typeof msg.extra_data === 'string' 
                    ? JSON.parse(msg.extra_data) 
                    : msg.extra_data;
                } catch (e) {
                  return null;
                }
              })() : null,
              status: 'delivered',
              source: 'database',
              room_name: msg.room_name
            };
          })
          .filter(msg => {
            const uniqueId = createUniqueMessageId(msg);
            if (processedMessageIds.current.has(uniqueId)) {
              return false;
            }
            processedMessageIds.current.add(uniqueId);
            return true;
          });
        
        log('✅ Historial procesado', {
          total: data.messages.length,
          afterDedup: historicalMessages.length,
          sample: historicalMessages[0] ? {
            text: historicalMessages[0].text.substring(0, 20),
            isLocal: historicalMessages[0].isLocal,
            senderId: historicalMessages[0].senderId,
            myId: userData.id
          } : null
        });
        
        if (historicalMessages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.dbId || m.id));
            const newMessages = historicalMessages.filter(m => 
              !existingIds.has(m.id) && !existingIds.has(m.dbId)
            );
            
            if (newMessages.length === 0) {
              return prev;
            }
            
            const combined = [...prev, ...newMessages];
            return combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          });
          
          lastMessageId.current = Math.max(...historicalMessages.map(m => m.dbId));
        }
        
        setLastSyncTime(Date.now());
        return { success: true, count: historicalMessages.length };
        
      } else {
        throw new Error(data.error || 'Failed to load messages');
      }
      
    } catch (error) {
      log('❌ Error cargando historial', { error: error.message });
      return { success: false, error: error.message };
    }
  }, [roomName, enabled, userData.id, otherUser?.id, log]);

  // 🔄 SINCRONIZACIÓN PERIÓDICA
  const syncWithDatabase = useCallback(async () => {
    if (!roomName || !enabled) return;
    
    try {
      const since = lastMessageId.current ? `&since=${lastMessageId.current}` : '';
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/chat/messages/${roomName}?limit=10${since}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.messages && data.messages.length > 0) {
          const newMessages = data.messages
            .filter(msg => {
              const uniqueId = createUniqueMessageId(msg);
              if (processedMessageIds.current.has(uniqueId)) {
                return false;
              }
              processedMessageIds.current.add(uniqueId);
              return true;
            })
            .map(msg => {
              const isLocal = isMessageLocal(msg);
              
              return {
                id: `sync_${msg.id}`,
                dbId: msg.id,
                type: msg.type || 'remote',
                text: msg.message,
                sender: msg.user_name,
                senderRole: msg.user_role,
                senderId: msg.user_id,
                timestamp: new Date(msg.created_at).getTime(),
                isLocal: isLocal, // 🔥 USAR VERIFICACIÓN CORRECTA
                isOld: true,
                extraData: msg.extra_data ? JSON.parse(msg.extra_data) : null,
                status: 'delivered',
                source: 'sync'
              };
            });
          
          if (newMessages.length > 0) {
            setMessages(prev => [...newMessages, ...prev]);
            lastMessageId.current = Math.max(...data.messages.map(m => m.id));
          }
        }
        
        setLastSyncTime(Date.now());
      }
      
    } catch (error) {
      log('❌ Error en sincronización', { error: error.message });
    }
  }, [roomName, enabled, userData.id, log]);

  // 🎁 ENVIAR REGALO
  const sendGift = useCallback(async (giftData, message = '') => {
    if (!giftData || isSendingMessage || !enabled) {
      return { success: false, error: 'Invalid gift data or system disabled' };
    }
    
    const giftMessage = message || `Solicité ${giftData.name}`;
    
    let giftType = 'gift';
    if (userData.role === 'modelo') {
      giftType = 'gift_request';
    } else if (userData.role === 'cliente') {
      giftType = 'gift_sent';
    }
    
    const completeGiftData = {
      gift_id: giftData.id,
      gift_name: giftData.name,
      gift_image: giftData.image,
      gift_price: giftData.price,
      recipient_id: giftData.recipientId,
      recipient_name: giftData.recipientName,
      sender_id: userData.id,
      sender_name: userData.name,
      sender_role: userData.role,
      original_message: message,
      action_text: userData.role === 'modelo' ? 'Solicité' : 'Enviaste',
      timestamp: Date.now()
    };
    
    return await sendMessage(giftMessage, giftType, completeGiftData);
  }, [sendMessage, isSendingMessage, enabled, userData, log]);

  // 😊 ENVIAR EMOJI
  const sendEmoji = useCallback(async (emoji) => {
    return await sendMessage(emoji, 'emoji');
  }, [sendMessage]);

  // 🔄 EFECTOS DE INICIALIZACIÓN
  useEffect(() => {
    if (roomName && userData.name && enabled) {
      log('🚀 Inicializando HybridChatSystem', { roomName, userName: userData.name, userId: userData.id });
      
      if (otherUser?.id) {
        loadHistoricalMessages();
      }
      
      syncInterval.current = setInterval(syncWithDatabase, 30000);
      
      return () => {
        if (syncInterval.current) {
          clearInterval(syncInterval.current);
        }
      };
    }
  }, [roomName, userData.name, userData.id, enabled, otherUser?.id, loadHistoricalMessages, syncWithDatabase]);

  // 🔗 ESTADO DE CONEXIÓN
  useEffect(() => {
    setIsConnected(dataChannelConnected && !!roomName && enabled);
  }, [dataChannelConnected, roomName, enabled]);

  // 🧹 LIMPIEZA DE CACHE
  useEffect(() => {
    const cleanup = setInterval(() => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      
      // Mantener solo los últimos 200 IDs para evitar memory leak
      if (processedMessageIds.current.size > 200) {
        const idsArray = Array.from(processedMessageIds.current);
        const recentIds = idsArray.slice(-100);
        processedMessageIds.current = new Set(recentIds);
      }
      
      // Limpiar IDs de mensajes enviados antiguos
      if (sentMessageIds.current.size > 100) {
        const sentArray = Array.from(sentMessageIds.current);
        const recentSent = sentArray.slice(-50);
        sentMessageIds.current = new Set(recentSent);
      }
      
    }, 10 * 60 * 1000);
    
    return () => clearInterval(cleanup);
  }, []);

  // 📊 API PÚBLICA
  const chatAPI = {
    sendMessage,
    sendGift,
    sendEmoji,
    messages,
    isConnected,
    isSendingMessage,
    lastSyncTime,
    loadHistoricalMessages,
    syncWithDatabase,
    stats: {
      totalMessages: messages.length,
      localMessages: messages.filter(m => m.isLocal).length,
      remoteMessages: messages.filter(m => !m.isLocal).length,
      dataChannelConnected,
      lastSync: lastSyncTime,
      processedIds: processedMessageIds.current.size,
      sentIds: sentMessageIds.current.size
    }
  };

  useEffect(() => {
    if (window.hybridChatAPI) {
      window.hybridChatAPI(chatAPI);
    }
  }, [chatAPI]);

  return null;
};

export default HybridChatSystem;