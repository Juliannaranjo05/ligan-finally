import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import Header from "./header";
import { getUser } from "../../utils/auth.js";
import { useTranslation } from 'react-i18next'; // 👈 AGREGAR ESTA LÍNEA

import {
  useTranslation as useCustomTranslation,
  TranslationSettings,
  TranslatedMessage
} from '../../utils/translationSystem.jsx';
import { useGlobalTranslation } from '../../contexts/GlobalTranslationContext';
import { useSessionValidation } from '../hooks/useSessionValidation';

import {
  MessageSquare,
  Star,
  Pencil,
  Ban,
  Gift,
  Send,
  Search,
  Video,
  Settings,
  Globe,
  ArrowRight,
  ArrowLeft,
  X,
  Bell
} from "lucide-react";

// 🔥 IMPORTACIONES NECESARIAS
import CallingSystem from '../CallingOverlay.jsx';
import IncomingCallOverlay from '../IncomingCallOverlay.jsx';
import { useGiftSystem, GiftMessageComponent, GiftNotificationOverlay, GiftsModal, giftSystemStyles } from '../GiftSystem/index.jsx';
import { useGlobalCall } from '../../contexts/GlobalCallContext.jsx';

// 🔥 COMPONENTES MODULARES MEJORADOS
import ModelConversationList from './ModelConversationList';
import ModelChatHeader from './ModelChatHeader';
import ModelMessageBubble from './ModelMessageBubble';
import ModelMessageInput from './ModelMessageInput';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ChatPrivado() {
  // 🔥 DEBUG: Log para verificar que el componente se monta
  useEffect(() => {
  }, []);
  
  // 🔥 VALIDACIÓN DE SESIÓN: Solo modelos pueden acceder
  useSessionValidation('modelo');
  
  const { settings: translationSettings, setSettings: setTranslationSettings, languages } = useCustomTranslation();
  const { translateGlobalText, isEnabled: globalTranslationEnabled, changeGlobalLanguage, currentLanguage: globalCurrentLanguage } = useGlobalTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n: i18nInstance } = useTranslation();

  // 🔥 ESTADOS PRINCIPALES OPTIMIZADOS
  const [usuario, setUsuario] = useState({ id: null, name: "Usuario", rol: "cliente" });
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [initialLoading, setInitialLoading] = useState(true); // 🔥 Estado de carga inicial
  
  // Estados UI simplificados
  const [loading, setLoading] = useState(false);
  const [busquedaConversacion, setBusquedaConversacion] = useState("");
  const [showTranslationSettings, setShowTranslationSettings] = useState(false);
  const [showMainSettings, setShowMainSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(true);

  // Estados de llamadas simplificados
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [callPollingInterval, setCallPollingInterval] = useState(null);

  // Estados de funcionalidades SIMPLIFICADOS
  const [favoritos, setFavoritos] = useState(new Set());
  const [bloqueados, setBloqueados] = useState(new Set());
  const [bloqueadoPor, setBloqueadoPor] = useState(new Set()); // Quien me bloqueó
  const [apodos, setApodos] = useState({});
  const [loadingActions, setLoadingActions] = useState(false);

  // Estados de notificaciones SIMPLIFICADOS
  const [lastSeenMessages, setLastSeenMessages] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set()); // Restaurar onlineUsers

  // Estados de regalos
  const [showGiftsModal, setShowGiftsModal] = useState(false);
  const [loadingGift, setLoadingGift] = useState(false);

  // Estados de apodos SIMPLIFICADOS
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameTarget, setNicknameTarget] = useState(null);
  const [nicknameValue, setNicknameValue] = useState('');
  // 🔥 USAR CONTEXTO GLOBAL PARA LLAMADAS ENTRANTES (ELIMINAR POLLING DUPLICADO)
  const { isReceivingCall, incomingCall, answerCall, declineCall } = useGlobalCall();
  const audioRef = useRef(null);

  // 🔥 ESTADOS PARA EL SISTEMA DE TRADUCCIÓN AUTOMÁTICA
  const [translations, setTranslations] = useState(new Map());
  const [translatingIds, setTranslatingIds] = useState(new Set());
  const [localTranslationEnabled, setLocalTranslationEnabled] = useState(
    translationSettings?.enabled || globalTranslationEnabled || false
  );
  const [currentLanguage, setCurrentLanguage] = useState(
    translationSettings?.targetLanguage || globalCurrentLanguage || i18nInstance.language || 'es'
  );

  // Refs
  const mensajesRef = useRef(null);
  const globalPollingInterval = useRef(null);
  const openChatWith = location.state?.openChatWith;
  const hasOpenedSpecificChat = useRef(false);
  const mensajesRefForTranslation = useRef([]);
  const translateMessageRef = useRef(null);




  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }, []);


  const playIncomingCallSound = useCallback(async () => {
    try {
      
      // 🔥 SOLICITAR PERMISOS DE AUDIO PRIMERO (activar AudioContext)
      if (typeof window !== 'undefined' && window.AudioContext) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
        } catch (ctxError) {
        }
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      
      const audio = new Audio('/sounds/incoming-call.mp3');
      audio.loop = true;
      audio.volume = 0.8;
      audio.preload = 'auto';
      
      // Agregar event listeners para debugging
      audio.addEventListener('loadstart', () => {
      });
      audio.addEventListener('canplay', () => {
      });
      audio.addEventListener('play', () => {
      });
      audio.addEventListener('error', (e) => {
      });
      
      audioRef.current = audio;
      
      try {
        await audio.play();
      } catch (playError) {
        console.error('Error al reproducir audio:', {
          name: playError.name,
          message: playError.message,
          stack: playError.stack
        });
        if (playError.name === 'NotAllowedError') {
        }
      }
    } catch (error) {
    }
  }, []);

const stopIncomingCallSound = useCallback(() => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
  }
}, []);

// 🔥 REMOVIDO: verificarLlamadasEntrantes y responderLlamada ahora se manejan en GlobalCallContext
// El polling de llamadas entrantes se maneja globalmente, no es necesario duplicarlo aquí

// 🔥 FUNCIÓN: REDIRIGIR AL VIDEOCHAT (AGREGAR)
const redirigirAVideochat = useCallback((callData) => {
  // Guardar datos de la llamada
  sessionStorage.setItem('roomName', callData.room_name);
  sessionStorage.setItem('userName', usuario.name || 'Usuario');
  sessionStorage.setItem('currentRoom', callData.room_name);
  sessionStorage.setItem('inCall', 'true');
  sessionStorage.setItem('videochatActive', 'true');
  
  // Limpiar estados de llamada
  setIsCallActive(false);
  setCurrentCall(null);
  setIsReceivingCall(false);
  setIncomingCall(null);
  
  // Limpiar intervals
  if (callPollingInterval) {
    clearInterval(callPollingInterval);
    setCallPollingInterval(null);
  }
  
  // Redirigir al videochat
  navigate('/videochat', {
    state: {
      userName: usuario.name || 'Usuario',
      callId: callData.call_id || callData.id,
      from: 'call',
      callData: callData
    }
  });
}, [usuario.name, callPollingInterval, navigate]);

// 🔥 REMOVIDO: Polling de llamadas entrantes ahora se maneja globalmente en GlobalCallContext
// No es necesario duplicar el polling aquí

// Configurar sistema de audio
useEffect(() => {
  const enableAudioContext = async () => {
    try {
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAABAABABkAAgAAACAJAAEAAABkYXRhBAAAAAEA');
      silentAudio.volume = 0.01;
      await silentAudio.play();
    } catch (e) {
      // Esperado en algunos navegadores
    }
    
    document.removeEventListener('click', enableAudioContext);
    document.removeEventListener('touchstart', enableAudioContext);
  };
  
  document.addEventListener('click', enableAudioContext, { once: true });
  document.addEventListener('touchstart', enableAudioContext, { once: true });
  
  return () => {
    document.removeEventListener('click', enableAudioContext);
    document.removeEventListener('touchstart', enableAudioContext);
  };
}, []);

// Cleanup al desmontar componente
useEffect(() => {
  return () => {
    stopIncomingCallSound();
    if (callPollingInterval) {
      clearInterval(callPollingInterval);
    }
    // 🔥 REMOVIDO: incomingCallPollingInterval ya no existe, se maneja en GlobalCallContext
  };
}, [callPollingInterval, stopIncomingCallSound]);


  // 🔥 SISTEMA DE REGALOS (DESPUÉS DE getAuthHeaders)
  const {
  gifts,
  loadingGifts,
  pendingRequests,
  loadingRequests,
  loadGifts,
  loadPendingRequests,
  setPendingRequests,
  requestGift,          // ← NUEVO
  generateSessionToken  // ← NUEVO
  } = useGiftSystem(usuario.id, usuario.rol, getAuthHeaders, API_BASE_URL);

  const getInitial = useCallback((name) => name ? name.charAt(0).toUpperCase() : '?', []);

  const getDisplayName = useCallback((userId, originalName) => {
    return apodos[userId] || originalName;
  }, [apodos]);

  const getBlockStatus = useCallback((userId) => {
    if (!userId) return 'normal';
    
    const yoBloqueado = bloqueados.has(userId);
    const meBloquearon = bloqueadoPor.has(userId);
    
    if (yoBloqueado && meBloquearon) {
      return 'mutuo'; // Bloqueo mutuo
    } else if (yoBloqueado) {
      return 'yo_bloquee'; // Yo bloqueé al usuario
    } else if (meBloquearon) {
      return 'me_bloquearon'; // El usuario me bloqueó
    } else {
      return 'normal'; // Sin bloqueos
    }
  }, [bloqueados, bloqueadoPor]);

  // 🔥 DEFINIR playAlternativeGiftSound PRIMERO para evitar errores de inicialización
  const playAlternativeGiftSound = useCallback(async () => {
    try {
      // Sonido sintetizado como alternativa
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 🔥 ACTIVAR AUDIOCONTEXT SI ESTÁ SUSPENDIDO
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Crear una melodía alegre para regalos
      const playNote = (frequency, startTime, duration, volume = 0.5) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'triangle';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Melodía alegre: Do-Mi-Sol-Do
      const now = audioContext.currentTime;
      playNote(523.25, now, 0.15, 0.6);        // Do
      playNote(659.25, now + 0.1, 0.15, 0.6);  // Mi
      playNote(783.99, now + 0.2, 0.15, 0.6);  // Sol
      playNote(1046.5, now + 0.3, 0.2, 0.7);   // Do (octava alta)
      
    } catch (error) {
    }
  }, []);

  const playGiftReceivedSound = useCallback(async () => {
    try {
      
      // 🔥 SOLICITAR PERMISOS DE AUDIO PRIMERO (activar AudioContext)
      if (typeof window !== 'undefined' && window.AudioContext) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
        } catch (ctxError) {
        }
      }
      
      // Crear audio para regalo recibido (mismo sonido que cuando se envía)
      const audio = new Audio('/sounds/gift-received.mp3');
      audio.volume = 0.8;
      audio.preload = 'auto';
      
      // Agregar event listeners para debugging
      audio.addEventListener('loadstart', () => {
      });
      audio.addEventListener('canplay', () => {
      });
      audio.addEventListener('play', () => {
      });
      audio.addEventListener('error', (e) => {
      });
      
      try {
        await audio.play();
        return true;
      } catch (playError) {
        // Sonido alternativo más corto
        await playAlternativeGiftSound();
        return false;
      }
    } catch (error) {
      await playAlternativeGiftSound();
      return false;
    }
  }, [playAlternativeGiftSound]);

  // 🎁 FUNCIÓN PARA REPRODUCIR NOTIFICACIÓN DE REGALO
  const playGiftNotification = useCallback(async (giftName) => {
    try {
      
      // Reproducir sonido
      const soundPlayed = await playGiftReceivedSound();
      
      // Mostrar notificación visual si está permitido
      if (Notification.permission === 'granted') {
        new Notification('🎁 ¡Regalo Recibido!', {
          body: `Has recibido: ${giftName}`,
          icon: '/favicon.ico',
          tag: 'gift-received',
          requireInteraction: true // La notificación permanece hasta que el usuario la cierre
        });
      }
      
      // Vibrar en dispositivos móviles
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
      
    } catch (error) {
    }
  }, [playGiftReceivedSound]);



  // MARCAR COMO VISTO MEJORADO - DEFINIR ANTES DE abrirConversacion
  const marcarComoVisto = useCallback(async (roomName) => {
    const now = Date.now();
    
    // Actualizar localStorage inmediatamente
    const newLastSeen = { ...lastSeenMessages, [roomName]: now };
    setLastSeenMessages(newLastSeen);
    localStorage.setItem('chatLastSeen', JSON.stringify(newLastSeen));
    
    try {
      // Marcar como leído en el servidor
      await fetch(`${API_BASE_URL}/api/chat/mark-read`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ room_name: roomName })
      });
      
      // Actualizar contador local de la conversación
      setConversaciones(prev => 
        prev.map(conv => 
          conv.room_name === roomName 
            ? { ...conv, unread_count: 0 }
            : conv
        )
      );
      
          } catch (error) {
          }
  }, [lastSeenMessages, getAuthHeaders]);

  // 🔥 CÁLCULOS MEMOIZADOS SIMPLIFICADOS
  const conversacionesFiltradas = useMemo(() => {
    return conversaciones.filter(conv =>
      conv.other_user_name.toLowerCase().includes(busquedaConversacion.toLowerCase())
    );
  }, [conversaciones, busquedaConversacion]);

  const conversacionSeleccionada = useMemo(() => {
    return conversaciones.find(c => c.room_name === conversacionActiva);
  }, [conversaciones, conversacionActiva]);

  // SIMPLIFICADO: Calcular notificaciones correctamente
  const calculateUnreadCount = useCallback((conversacion) => {
    if (conversacion.room_name === conversacionActiva) return 0;
    
    // Usar el contador del servidor si existe
    if (conversacion.unread_count && conversacion.unread_count > 0) {
      return conversacion.unread_count;
    }
    
    // Fallback: usar timestamp
    const lastSeen = lastSeenMessages[conversacion.room_name] || 0;
    const lastMessageTime = new Date(conversacion.last_message_time).getTime();
    return (lastMessageTime > lastSeen && conversacion.last_message_sender_id !== usuario.id) ? 1 : 0;
  }, [conversacionActiva, lastSeenMessages, usuario.id]);

  // 🔥 FUNCIONES PRINCIPALES SIMPLIFICADAS
  const cargarDatosUsuario = useCallback(async () => {
    try {
            const userData = await getUser();
            
      setUsuario({
        id: userData.id,
        name: userData.name || userData.alias || `Usuario_${userData.id}`,
        rol: userData.rol
      });
      setInitialLoading(false); // 🔥 Marcar como cargado
    } catch (error) {
            // 🔥 USAR DATOS DE EJEMPLO COMO FALLBACK
            setUsuario({
        id: 1,
        name: "Usuario Demo",
        rol: "cliente"
      });
      setInitialLoading(false); // 🔥 Marcar como cargado incluso en error
    }
  }, []);

  const cargarConversaciones = useCallback(async () => {
    if (loading) return;
    
    try {
      // NO mostrar loading en actualizaciones automáticas, solo en carga inicial
      if (conversaciones.length === 0) {
        setLoading(true);
      }
      
                  
      const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      
      if (response.ok) {
        const data = await response.json();
                
        const newConversations = data.conversations || [];
        
        // Comparar con conversaciones anteriores para detectar cambios
        const hasChanges = newConversations.some(newConv => {
          const oldConv = conversaciones.find(old => old.room_name === newConv.room_name);
          if (!oldConv) return true; // Nueva conversación
          
          // Verificar si cambió el último mensaje
          const newTime = new Date(newConv.last_message_time).getTime();
          const oldTime = new Date(oldConv.last_message_time).getTime();
          
          return newTime > oldTime || newConv.last_message !== oldConv.last_message;
        });
        
        if (hasChanges || conversaciones.length === 0) {
                    setConversaciones(newConversations);
          
          // Si hay mensajes nuevos en otras conversaciones, actualizar sin parpadeos
          newConversations.forEach(newConv => {
            const oldConv = conversaciones.find(old => old.room_name === newConv.room_name);
            if (oldConv && newConv.last_message !== oldConv.last_message && newConv.room_name !== conversacionActiva) {
                          }
          });
        } else {
                  }
      } else {
                const errorText = await response.text();
                
        // Solo usar datos de ejemplo si no hay conversaciones cargadas
        if (conversaciones.length === 0) {
                    const exampleConversations = [
            {
              id: 1,
              other_user_id: 2,
              other_user_name: "SofiSweet",
              other_user_role: "modelo",
              room_name: "chat_user_1_2",
              last_message: "¡Hola! ¿Cómo estás?",
              last_message_time: "2024-01-15T14:30:00Z",
              last_message_sender_id: 2,
              unread_count: 2
            },
            {
              id: 2,
              other_user_id: 3,
              other_user_name: "Mia88",
              other_user_role: "modelo",
              room_name: "chat_user_1_3",
              last_message: "Gracias por la sesión 😘",
              last_message_time: "2024-01-15T12:15:00Z",
              last_message_sender_id: 3,
              unread_count: 1
            }
          ];
          setConversaciones(exampleConversations);
        }
      }
    } catch (error) {
            
      // Solo usar datos de ejemplo si no hay conversaciones cargadas
      if (conversaciones.length === 0) {
                const exampleConversations = [
          {
            id: 1,
            other_user_id: 2,
            other_user_name: "SofiSweet",
            other_user_role: "modelo",
            room_name: "chat_user_1_2",
            last_message: "¡Hola! ¿Cómo estás?",
            last_message_time: "2024-01-15T14:30:00Z",
            last_message_sender_id: 2,
            unread_count: 2
          },
          {
            id: 2,
            other_user_id: 3,
            other_user_name: "Mia88",
            other_user_role: "modelo",
            room_name: "chat_user_1_3",
            last_message: "Gracias por la sesión 😘",
            last_message_time: "2024-01-15T12:15:00Z",
            last_message_sender_id: 3,
            unread_count: 1
          }
        ];
        setConversaciones(exampleConversations);
      }
    } finally {
      // Solo quitar loading si se había puesto
      if (conversaciones.length === 0) {
        setLoading(false);
      }
    }
  }, [loading, getAuthHeaders, conversaciones, conversacionActiva]);

const cargarMensajes = useCallback(async (roomName) => {
  try {
    
    let allMessages = [];

    // 1. Cargar mensajes principales
    const mainResponse = await fetch(`${API_BASE_URL}/api/chat/messages/${roomName}`, {
      headers: getAuthHeaders()
    });

    if (mainResponse.ok) {
      const mainData = await mainResponse.json();
      if (mainData.success && mainData.messages) {
        allMessages = [...allMessages, ...mainData.messages];
              }
    }

    // 2. Cargar room específico según rol
    const specificRoom = usuario.rol === 'cliente' 
      ? `${roomName}_client` 
      : `${roomName}_modelo`;

    
    const specificResponse = await fetch(`${API_BASE_URL}/api/chat/messages/${specificRoom}`, {
      headers: getAuthHeaders()
    });

    if (specificResponse.ok) {
      const specificData = await specificResponse.json();
      if (specificData.success && specificData.messages) {
        allMessages = [...allMessages, ...specificData.messages];
              }
    }

    // 3. Ordenar por fecha
    allMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // 🔍 DEBUG: Verificar mensajes cargados
    console.log('📥 [mensajes.jsx] Mensajes cargados:', {
      total: allMessages.length,
      room_name: roomName,
      messages_with_avatar: allMessages.filter(m => m.avatar || m.avatar_url).length,
      sample_messages: allMessages.slice(0, 5).map(m => ({
        id: m.id,
        user_id: m.user_id,
        user_name: m.user_name,
        avatar: m.avatar,
        avatar_url: m.avatar_url,
        type: m.type
      }))
    });
    
        setMensajes(allMessages);

  } catch (error) {
      }
}, [getAuthHeaders, usuario.rol]);
  // 🔥 FUNCIÓN DE ENVÍO DE MENSAJES OPTIMIZADA
  const enviarMensaje = useCallback(async (tipo = 'text', contenido = null) => {
  const mensaje = contenido || nuevoMensaje.trim();
  if (!mensaje || !conversacionActiva) return;

  // Verificar si está bloqueado (YO bloqueé al usuario O me bloquearon)
  const isBlockedByMe = conversacionSeleccionada ? bloqueados.has(conversacionSeleccionada.other_user_id) : false;
  const isBlockedByThem = conversacionSeleccionada ? bloqueadoPor.has(conversacionSeleccionada.other_user_id) : false;
  
  if (isBlockedByMe) {
    alert('No puedes enviar mensajes a un usuario bloqueado');
    return;
  }
  
  if (isBlockedByThem) {
    alert('Este usuario te ha bloqueado, no puedes enviarle mensajes');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/send-message`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        room_name: conversacionActiva,
        message: mensaje,
        extra_data: tipo === 'gift' ? { gift_type: mensaje } : null
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        const nuevoMensajeObj = {
          id: Date.now(),
          user_id: usuario.id,
          user_name: usuario.name,
          user_role: usuario.rol,
          message: mensaje,
          created_at: new Date().toISOString()
        };
        
        setMensajes(prev => [...prev, nuevoMensajeObj]);
        const updatedMessages = [...mensajes, nuevoMensajeObj];
        localStorage.setItem(`messages_${conversacionActiva}`, JSON.stringify(updatedMessages));
        setNuevoMensaje("");
        
        // ACTUALIZAR PREVIEW INMEDIATAMENTE en la lista de conversaciones
        setConversaciones(prev => 
          prev.map(conv => 
            conv.room_name === conversacionActiva
              ? {
                  ...conv,
                  last_message: mensaje,
                  last_message_time: new Date().toISOString(),
                  last_message_sender_id: usuario.id
                }
              : conv
          )
        );
        
        // Marcar como visto después de enviar mensaje
        await marcarComoVisto(conversacionActiva);
        
        // Scroll al final
        setTimeout(() => {
          if (mensajesRef.current) {
            mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
          }
        }, 100);
        
        // Refrescar conversaciones después de un momento para sincronizar
        setTimeout(() => {
          cargarConversaciones();
        }, 1000);
      }
    } else {
      // Manejar errores específicos del backend
      const errorData = await response.json();
      if (errorData.error === 'blocked') {
        alert('No puedes enviar mensajes a este usuario');
      } else if (errorData.error === 'blocked_by_user') {
        alert('Este usuario te ha bloqueado');
      } else {
              }
    }
  } catch (error) {
      }
  }, [nuevoMensaje, conversacionActiva, conversacionSeleccionada, bloqueados, bloqueadoPor, getAuthHeaders, usuario, marcarComoVisto, cargarConversaciones]);
  
  const isChatBlocked = useCallback(() => {
    if (!conversacionSeleccionada) return false;
    const isBlockedByMe = bloqueados.has(conversacionSeleccionada.other_user_id);
    const isBlockedByThem = bloqueadoPor.has(conversacionSeleccionada.other_user_id);
    return isBlockedByMe || isBlockedByThem;
  }, [conversacionSeleccionada, bloqueados, bloqueadoPor]);


  const cargarEstadosIniciales = useCallback(async () => {
    if (!usuario.id) return;
    
    try {
      // Cargar favoritos
      const favResponse = await fetch(`${API_BASE_URL}/api/favorites/list`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (favResponse.ok) {
        const favData = await favResponse.json();
        if (favData.success) {
          const favIds = new Set(favData.favorites?.map(fav => fav.id) || []);
          setFavoritos(favIds);
                  }
      }

      // Cargar estados de bloqueo
      const blockResponse = await fetch(`${API_BASE_URL}/api/block-status`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (blockResponse.ok) {
        const blockData = await blockResponse.json();
        if (blockData.success) {
          // Usuarios que YO he bloqueado
          const bloqueadosIds = new Set(blockData.my_blocked_users?.map(user => user.id) || []);
          setBloqueados(bloqueadosIds);
          
          // Usuarios que ME han bloqueado
          const bloqueadoresIds = new Set(blockData.blocked_by_users?.map(user => user.id) || []);
          setBloqueadoPor(bloqueadoresIds);

          
        }
      }

      // Cargar apodos
      const nicknameResponse = await fetch(`${API_BASE_URL}/api/nicknames/my-nicknames`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (nicknameResponse.ok) {
        const nicknameData = await nicknameResponse.json();
        if (nicknameData.success) {
          const apodosMap = {};
          nicknameData.nicknames?.forEach(item => {
            apodosMap[item.target_user_id] = item.nickname;
          });
          setApodos(apodosMap);
                  }
      }
      
    } catch (error) {
          }
  }, [usuario.id, getAuthHeaders]);
  // 🔥 FUNCIONES DE ACCIÓN SIMPLIFICADAS
  const toggleFavorito = useCallback(async (userId, userName) => {
    if (loadingActions) return;
    setLoadingActions(true);
    
    try {
      const isFavorite = favoritos.has(userId);
      const response = await fetch(`${API_BASE_URL}/api/favorites/${isFavorite ? 'remove' : 'add'}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ favorite_user_id: userId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFavoritos(prev => {
            const newSet = new Set(prev);
            isFavorite ? newSet.delete(userId) : newSet.add(userId);
            return newSet;
          });
                  }
      }
    } catch (error) {
          }
    setLoadingActions(false);
  }, [loadingActions, favoritos, getAuthHeaders]);

  const toggleBloquear = useCallback(async (userId, userName) => {
    if (loadingActions) return;
    setLoadingActions(true);
    
    try {
      const isBlocked = bloqueados.has(userId);
      const response = await fetch(`${API_BASE_URL}/api/blocks/${isBlocked ? 'unblock' : 'block'}-user`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          blocked_user_id: userId,
          reason: isBlocked ? undefined : 'Bloqueado desde chat'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBloqueados(prev => {
            const newSet = new Set(prev);
            isBlocked ? newSet.delete(userId) : newSet.add(userId);
            return newSet;
          });
          
          // Si se bloquea, quitar de favoritos
          if (!isBlocked) {
            setFavoritos(prev => {
              const newSet = new Set(prev);
              newSet.delete(userId);
              return newSet;
            });
          }
                  }
      }
    } catch (error) {
          }
    setLoadingActions(false);
  }, [loadingActions, bloqueados, getAuthHeaders]);

  // FUNCIÓN PARA VERIFICAR ESTADO DE BLOQUEO

  const abrirConversacion = useCallback(async (conversacion) => {
            
    setConversacionActiva(conversacion.room_name);
    
    // Marcar como visto INMEDIATAMENTE al abrir
    await marcarComoVisto(conversacion.room_name);
    const savedMessages = JSON.parse(localStorage.getItem(`messages_${conversacion.room_name}`) || '[]');
    if (savedMessages.length > 0) {
      setMensajes(savedMessages);
    }
    
    // Cargar mensajes
    await cargarMensajes(conversacion.room_name);
    
    if (isMobile) {
      setShowSidebar(false);
    }

    // Scroll al final
    setTimeout(() => {
      if (mensajesRef.current) {
        mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
      }
    }, 100);
    
      }, [cargarMensajes, isMobile, marcarComoVisto]);

  // 🔥 FUNCIONES DE LLAMADAS SIMPLIFICADAS
  const iniciarLlamadaReal = useCallback(async (otherUserId, otherUserName) => {
    try {
      setCurrentCall({ id: otherUserId, name: otherUserName, status: 'initiating' });
      setIsCallActive(true);

      const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ receiver_id: otherUserId, call_type: 'video' })
      });

      const data = await response.json();
      if (data.success) {
        setCurrentCall({
          id: otherUserId,
          name: otherUserName,
          callId: data.call_id,
          status: 'calling'
        });
      }
    } catch (error) {
            setIsCallActive(false);
      setCurrentCall(null);
    }
  }, [getAuthHeaders]);

  const cancelarLlamada = useCallback(() => {
    if (callPollingInterval) {
      clearInterval(callPollingInterval);
      setCallPollingInterval(null);
    }
    setIsCallActive(false);
    setCurrentCall(null);
  }, [callPollingInterval]);
  const buildCompleteImageUrl = (imagePath, baseUrl = API_BASE_URL) => {
    if (!imagePath) {
      return null;
    }
    
    // Si ya es una URL completa
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Limpiar baseUrl (remover trailing slash si existe)
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    // Limpiar imagePath de barras escapadas
    const cleanImagePath = imagePath.replace(/\\/g, '/');
    
    // Si comienza con storage/ (ya incluye storage/)
    if (cleanImagePath.startsWith('storage/')) {
      return `${cleanBaseUrl}/${cleanImagePath}`;
    }
    
    // Si comienza con avatars/ (imagen personalizada del cliente)
    if (cleanImagePath.startsWith('avatars/')) {
      return `${cleanBaseUrl}/storage/${cleanImagePath}`;
    }
    
    // Si comienza con / es ruta absoluta
    if (cleanImagePath.startsWith('/')) {
      return `${cleanBaseUrl}${cleanImagePath}`;
    }
    
    // Si es solo el nombre del archivo, asumir que está en storage/gifts/
    return `${cleanBaseUrl}/storage/gifts/${cleanImagePath}`;
  };

  // =================== 2. MODIFICAR SOLO pedirRegalo (reemplaza tu función actual) ===================
 const pedirRegalo = useCallback(async (giftId, clientId, roomName, message = '') => {
  try {
        
    // 🔥 USAR LA FUNCIÓN DEL HOOK
    const result = await requestGift(clientId, giftId, message, roomName);
    
    if (result.success) {
            
      // 🔥 PROCESAR MENSAJE PARA EL CHAT (SOLO SI VIENE)
      if (result.chatMessage) {
                
        // Construir URL completa de imagen
        let processedExtraData = { ...result.chatMessage.extra_data };
        
        if (processedExtraData.gift_image) {
          const completeImageUrl = buildCompleteImageUrl(processedExtraData.gift_image);
          processedExtraData.gift_image = completeImageUrl;
        }
        
        let processedMessage = {
          ...result.chatMessage,
          gift_data: processedExtraData,
          extra_data: processedExtraData
        };
        
        // Agregar mensaje al chat
        setMensajes(prev => [...prev, processedMessage]);
        
        // Actualizar conversación
        setConversaciones(prev => 
          prev.map(conv => 
            conv.room_name === roomName
              ? {
                  ...conv,
                  last_message: `🎁 ${t("chat.gifts.giftRequest") || "Solicitud:"} ${processedExtraData.gift_name || t("chat.gift") || 'Regalo'}`,
                  last_message_time: new Date().toISOString(),
                  last_message_sender_id: usuario.id
                }
              : conv
          )
        );
        
        // Scroll al final
        setTimeout(() => {
          if (mensajesRef.current) {
            mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
          }
        }, 100);
      }
      
      return result;
    } else {
            return result;
    }
  } catch (error) {
        return { success: false, error: 'Error de conexión' };
  }
  }, [requestGift, usuario.id, buildCompleteImageUrl, setMensajes, setConversaciones, mensajesRef]);

  const handleRequestGift = useCallback(async (giftId, recipientId, roomName, message) => {
  try {
    setLoadingGift(true);

    
    const result = await pedirRegalo(giftId, recipientId, roomName, message);
    
        
    if (result.success) {
      setShowGiftsModal(false);
            
      // 🎊 NOTIFICACIÓN DE ÉXITO (OPCIONAL)
      if (Notification.permission === 'granted') {
        new Notification('🎁 Solicitud Enviada', {
          body: 'Tu solicitud de regalo ha sido enviada exitosamente',
          icon: '/favicon.ico'
        });
      }
    } else {
            
      // 🚨 MOSTRAR ERROR AL USUARIO
      alert(`Error al enviar solicitud: ${result.error}`);
    }
    
    return result;
  } catch (error) {
        alert('Error inesperado al enviar solicitud');
    return { success: false, error: 'Error inesperado' };
  } finally {
    setLoadingGift(false);
  }
  }, [pedirRegalo, setLoadingGift, setShowGiftsModal]);
  const debugGiftRequest = useCallback(async () => {
  try {
        
    // Generar token
    const token = await generateSessionToken();
    
    // Datos de prueba con TODOS los campos posibles
    const debugData = {
      // Campos principales
      client_id: parseInt(conversacionSeleccionada?.other_user_id || 2),
      gift_id: 1, // ID de regalo de prueba
      session_token: token,
      
      // Campos adicionales comunes
      message: 'Mensaje de prueba',
      room_name: conversacionActiva || 'chat_test',
      timestamp: Math.floor(Date.now() / 1000),
      user_agent: navigator.userAgent.substring(0, 150),
      
      // Campos que podrían estar faltando
      modelo_id: parseInt(usuario.id),
      request_type: 'gift_request',
      platform: 'web',
      ip_address: 'web_client',
      security_level: 'high',
      
      // Información de sesión adicional
      session_id: sessionStorage.getItem('app_session_id'),
      browser_info: {
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}`
      }
    };
    const response = await fetch(`${API_BASE_URL}/api/gifts/request`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Debug-Mode': 'true'
      },
      body: JSON.stringify(debugData)
    });
    

    const responseText = await response.text();
        
    try {
      const data = JSON.parse(responseText);
            
      if (data.error === 'missing_parameters') {
                        
        // Intentar obtener más información del error
        if (data.required_fields) {
                  }
        if (data.missing_fields) {
                  }
      }
    } catch (e) {
          }

  } catch (error) {
      }
}, [generateSessionToken, conversacionSeleccionada, conversacionActiva, usuario.id, getAuthHeaders]);


  // 🔥 FUNCIONES DE APODOS
  const abrirModalApodo = useCallback((userId, userName) => {
    setNicknameTarget({ userId, userName });
    setNicknameValue(apodos[userId] || '');
    setShowNicknameModal(true);
  }, [apodos]);

  const guardarApodo = useCallback(async () => {
    if (!nicknameTarget || !nicknameValue.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/nicknames/set`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          target_user_id: nicknameTarget.userId,
          nickname: nicknameValue.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        setApodos(prev => ({
          ...prev,
          [nicknameTarget.userId]: nicknameValue.trim()
        }));
        setShowNicknameModal(false);
        setNicknameTarget(null);
        setNicknameValue('');
      }
    } catch (error) {
          }
  }, [nicknameTarget, nicknameValue, getAuthHeaders]);

  // 🔥 FUNCIÓN FALLBACK PARA TRADUCCIÓN
  const translateWithFallback = useCallback(async (text, targetLang) => {
    try {
      const cleanText = text.toLowerCase().trim();
      
      if (targetLang === 'en') {
        const translations = {
          'hola': 'hello',
          'como estas': 'how are you',
          'como estás': 'how are you',
          'como estas?': 'how are you?',
          'como estás?': 'how are you?',
          'bien': 'good',
          'mal': 'bad',
          'gracias': 'thank you',
          'por favor': 'please',
          'si': 'yes',
          'sí': 'yes',
          'no': 'no',
          'que tal': 'how are you',
          'qué tal': 'how are you',
          'buenas': 'hi',
          'buenos dias': 'good morning',
          'buenos días': 'good morning',
          'buenas noches': 'good night',
          'buenas tardes': 'good afternoon',
          'te amo': 'I love you',
          'te quiero': 'I love you',
          'hermosa': 'beautiful',
          'guapa': 'beautiful',
          'bonita': 'pretty'
        };
        
        return translations[cleanText] || `[EN] ${text}`;
      }
      
      if (targetLang === 'es') {
        const translations = {
          'hello': 'hola',
          'hi': 'hola',
          'how are you': 'cómo estás',
          'how are you?': 'cómo estás?',
          'good': 'bien',
          'bad': 'mal',
          'thank you': 'gracias',
          'thanks': 'gracias',
          'please': 'por favor',
          'yes': 'sí',
          'no': 'no',
          'good morning': 'buenos días',
          'good night': 'buenas noches',
          'good afternoon': 'buenas tardes',
          'i love you': 'te amo',
          'beautiful': 'hermosa',
          'pretty': 'bonita'
        };
        
        return translations[cleanText] || `[ES] ${text}`;
      }
      
      return `[${targetLang.toUpperCase()}] ${text}`;
    } catch (error) {
      return `[ERROR-${targetLang.toUpperCase()}] ${text}`;
    }
  }, []);

  // 🔥 FUNCIÓN PRINCIPAL DE TRADUCCIÓN
  const translateMessage = useCallback(async (message) => {
    if (!localTranslationEnabled || !message?.id) return;
    
    const originalText = message.text || message.message;
    if (!originalText || originalText.trim() === '') return;

    if (translations.has(message.id) || translatingIds.has(message.id)) return;

    setTranslatingIds(prev => new Set(prev).add(message.id));

    try {
      let result = null;
      
      if (typeof translateGlobalText === 'function') {
        try {
          result = await translateGlobalText(originalText, message.id);
          
          if (!result || result === originalText) {
            result = await translateWithFallback(originalText, currentLanguage);
          }
        } catch (error) {
          result = await translateWithFallback(originalText, currentLanguage);
        }
      } else {
        result = await translateWithFallback(originalText, currentLanguage);
      }
      
      if (result && result !== originalText && result.trim() !== '' && result.toLowerCase() !== originalText.toLowerCase()) {
        setTranslations(prev => new Map(prev).set(message.id, result));
      } else {
        setTranslations(prev => new Map(prev).set(message.id, null));
      }
    } catch (error) {
      setTranslations(prev => new Map(prev).set(message.id, null));
    } finally {
      setTranslatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(message.id);
        return newSet;
      });
    }
  }, [localTranslationEnabled, translateGlobalText, currentLanguage, translateWithFallback, translations, translatingIds]);

  // 🔥 FUNCIÓN PARA RENDERIZAR MENSAJE CON TRADUCCIÓN
  const renderMessageWithTranslation = useCallback((message, isOwn = false) => {
    const originalText = message.text || message.message;
    const translatedText = translations.get(message.id);
    const isTranslating = translatingIds.has(message.id);
    
    const hasTranslation = translatedText && translatedText !== originalText && translatedText.trim() !== '';

    return (
      <div className="space-y-1 break-words overflow-wrap-anywhere">
        <div className="text-white break-words overflow-wrap-anywhere whitespace-pre-wrap">
          {originalText}
          {isTranslating && (
            <span className="ml-2 inline-flex items-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-current opacity-50"></div>
            </span>
          )}
        </div>

        {hasTranslation && (
          <div className={`text-xs italic border-l-2 pl-2 py-1 break-words overflow-wrap-anywhere whitespace-pre-wrap ${
            isOwn 
              ? 'border-blue-300 text-blue-200 bg-blue-500/10' 
              : 'border-green-300 text-green-200 bg-green-500/10'
          } rounded-r`}>
          {translatedText}
        </div>
        )}
      </div>
    );
  }, [translations, translatingIds, localTranslationEnabled]);

  const renderMensaje = useCallback((mensaje) => {
  const textoMensaje = mensaje.message || mensaje.text || null;
  const esUsuarioActual = mensaje.user_id === usuario.id;

  // 🔥 FIX: Permitir que los regalos se rendericen SIN texto
  if ((!textoMensaje || textoMensaje.trim() === '') && 
      !['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(mensaje.type)) {
    return null; // Solo bloquear si NO es regalo
  }

  switch (mensaje.type) {
    case 'gift':
      return (
        <div className="flex items-center gap-2 text-yellow-400">
          <Gift size={16} />
          <span>{t("chat.gifts.sentBy") || "Envió:"} {textoMensaje}</span>
        </div>
      );

    case 'gift_request':
      // 🔥 TU CÓDIGO ACTUAL ESTÁ BIEN - MANTENERLO
      const giftData = mensaje.gift_data || mensaje.extra_data || {};
      let finalGiftData = giftData;
      
      if (typeof mensaje.extra_data === 'string') {
        try {
          finalGiftData = JSON.parse(mensaje.extra_data);
        } catch (e) {
          finalGiftData = giftData;
        }
      }
      
      // Construir URL de imagen usando la función buildCompleteImageUrl
      let imageUrl = null;
      if (finalGiftData.gift_image) {
        imageUrl = buildCompleteImageUrl(finalGiftData.gift_image);
        // Si la URL no incluye parámetros de versión, agregarlos
        if (imageUrl && !imageUrl.includes('?') && !imageUrl.includes('v=')) {
          const imagePath = finalGiftData.gift_image;
          const cleanPath = imagePath.replace(/\\/g, '');
          let fileName;
          if (cleanPath.startsWith('storage/')) {
            const pathParts = cleanPath.split('/');
            fileName = pathParts.pop();
          } else if (cleanPath.startsWith('/')) {
            const pathParts = cleanPath.split('/');
            fileName = pathParts.pop();
          } else {
            fileName = cleanPath;
          }
          const version = fileName ? encodeURIComponent(fileName).substring(0, 20) : Date.now();
          imageUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${version}`;
        }
      }
      
      return (
        <div className="bg-gradient-to-br from-[#ff007a]/20 via-[#cc0062]/20 to-[#990047]/20 rounded-xl p-4 max-w-xs border border-[#ff007a]/30 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="bg-gradient-to-r from-[#ff007a] to-[#cc0062] rounded-full p-2">
              <Gift size={16} className="text-white" />
            </div>
            <span className="text-pink-100 text-sm font-semibold">{t('chat.gifts.giftRequest')}</span>
          </div>
          
          {imageUrl && (
            <div className="mb-3 flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-purple-300/30">
                <img 
                  src={imageUrl} 
                  alt={finalGiftData.gift_name || 'Regalo'}
                  className="w-12 h-12 object-contain"
                  loading="lazy"
                  decoding="async"
                  key={`gift-request-mensajes-modelo-${finalGiftData.gift_name}-${imageUrl}`}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const fallback = e.target.parentNode.querySelector('.gift-fallback');
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="gift-fallback hidden w-12 h-12 items-center justify-center">
                  <Gift size={20} className="text-purple-300" />
                </div>
              </div>
            </div>
          )}
          
          <div className="text-center space-y-2">
            <p className="text-white font-bold text-base">
              {finalGiftData.gift_name || t("chat.gifts.specialGift") || 'Regalo Especial'}
            </p>
            
            {finalGiftData.gift_price && (
              <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg px-3 py-1 border border-amber-300/30">
                <span className="text-amber-200 font-bold text-sm">
                  ✨ {finalGiftData.gift_price} {t('chat.gifts.coins')}
                </span>
              </div>
            )}
            
            {finalGiftData.original_message && (
              <div className="bg-black/20 rounded-lg p-2 mt-3 border-l-4 border-[#ff007a]">
                <p className="text-purple-100 text-xs italic">
                  💭 "{finalGiftData.original_message}"
                </p>
              </div>
            )}
          </div>
        </div>
      );

    // 🔥 AGREGAR CASO FALTANTE: gift_received
    case 'gift_received':
      const receivedGiftData = mensaje.gift_data || mensaje.extra_data || {};
      
      let finalReceivedGiftData = receivedGiftData;
      if (typeof mensaje.extra_data === 'string') {
        try {
          finalReceivedGiftData = JSON.parse(mensaje.extra_data);
        } catch (e) {
          finalReceivedGiftData = receivedGiftData;
        }
      }
      
      // Construir URL de imagen usando la función buildCompleteImageUrl
      let receivedImageUrl = null;
      if (finalReceivedGiftData.gift_image) {
        receivedImageUrl = buildCompleteImageUrl(finalReceivedGiftData.gift_image);
        // Si la URL no incluye parámetros de versión, agregarlos
        if (receivedImageUrl && !receivedImageUrl.includes('?') && !receivedImageUrl.includes('v=')) {
          const imagePath = finalReceivedGiftData.gift_image;
          const cleanPath = imagePath.replace(/\\/g, '');
          let fileName;
          if (cleanPath.startsWith('storage/')) {
            const pathParts = cleanPath.split('/');
            fileName = pathParts.pop();
          } else if (cleanPath.startsWith('/')) {
            const pathParts = cleanPath.split('/');
            fileName = pathParts.pop();
          } else {
            fileName = cleanPath;
          }
          const version = fileName ? encodeURIComponent(fileName).substring(0, 20) : Date.now();
          receivedImageUrl = `${receivedImageUrl}${receivedImageUrl.includes('?') ? '&' : '?'}v=${version}`;
        }
      }
      
      return (
        <div className="bg-gradient-to-br from-green-900/40 via-emerald-900/40 to-teal-900/40 rounded-xl p-4 max-w-xs border border-green-300/30 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full p-2">
              <Gift size={16} className="text-white" />
            </div>
            <span className="text-green-100 text-sm font-semibold">{t('chat.gifts.giftReceived')}</span>
          </div>
          
          {receivedImageUrl && (
            <div className="mb-3 flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-green-300/30">
                <img 
                  src={receivedImageUrl} 
                  alt={finalReceivedGiftData.gift_name || 'Regalo'}
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const fallback = e.target.parentNode.querySelector('.gift-fallback');
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="gift-fallback hidden w-12 h-12 items-center justify-center">
                  <Gift size={20} className="text-green-300" />
                </div>
              </div>
            </div>
          )}
          
          <div className="text-center space-y-2">
            <p className="text-white font-bold text-base">
              {finalReceivedGiftData.gift_name || t("chat.gifts.specialGift") || 'Regalo Especial'}
            </p>
            
            <div className="bg-black/20 rounded-lg p-2 mt-3 border-l-4 border-green-400">
              <p className="text-green-100 text-xs font-medium">
                💰 ¡{finalReceivedGiftData.client_name || 'El cliente'} {t('chat.gifts.sentBy')}
              </p>
            </div>
          </div>
        </div>
      );

    case 'gift_sent':
      // Para clientes que enviaron el regalo
      const sentGiftData = mensaje.gift_data || mensaje.extra_data || {};
      
      let finalSentGiftData = sentGiftData;
      if (typeof mensaje.extra_data === 'string') {
        try {
          finalSentGiftData = JSON.parse(mensaje.extra_data);
        } catch (e) {
          finalSentGiftData = sentGiftData;
        }
      }
      
      // Construir URL de imagen usando la función buildCompleteImageUrl
      let sentImageUrl = null;
      if (finalSentGiftData.gift_image) {
        sentImageUrl = buildCompleteImageUrl(finalSentGiftData.gift_image);
        // Si la URL no incluye parámetros de versión, agregarlos
        if (sentImageUrl && !sentImageUrl.includes('?') && !sentImageUrl.includes('v=')) {
          const imagePath = finalSentGiftData.gift_image;
          const cleanPath = imagePath.replace(/\\/g, '');
          let fileName;
          if (cleanPath.startsWith('storage/')) {
            const pathParts = cleanPath.split('/');
            fileName = pathParts.pop();
          } else if (cleanPath.startsWith('/')) {
            const pathParts = cleanPath.split('/');
            fileName = pathParts.pop();
          } else {
            fileName = cleanPath;
          }
          const version = fileName ? encodeURIComponent(fileName).substring(0, 20) : Date.now();
          sentImageUrl = `${sentImageUrl}${sentImageUrl.includes('?') ? '&' : '?'}v=${version}`;
        }
      }
      
      return (
        <div className="bg-gradient-to-br from-blue-900/40 via-cyan-900/40 to-teal-900/40 rounded-xl p-4 max-w-xs border border-blue-300/30 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full p-2">
              <Gift size={16} className="text-white" />
            </div>
            <span className="text-blue-100 text-sm font-semibold">{t('chat.gifts.giftSent')}</span>
          </div>
          
          {sentImageUrl && (
            <div className="mb-3 flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-blue-300/30">
                <img 
                  src={sentImageUrl} 
                  alt={finalSentGiftData.gift_name || t('chat.gifts.specialGift')}
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const fallback = e.target.parentNode.querySelector('.gift-fallback');
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="gift-fallback hidden w-12 h-12 items-center justify-center">
                  <Gift size={20} className="text-blue-300" />
                </div>
              </div>
            </div>
          )}
          
          <div className="text-center space-y-2">
            <p className="text-white font-bold text-base">
              {finalSentGiftData.gift_name || t('chat.gifts.specialGift')}
            </p>
            
            {finalSentGiftData.gift_price && (
              <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg px-3 py-1 border border-blue-300/30">
                <span className="text-blue-200 font-bold text-sm">
                  -{finalSentGiftData.gift_price} {t('chat.gifts.coins')}
                </span>
              </div>
            )}
          </div>
        </div>
      );

    case 'emoji':
      return <div className="text-2xl">{textoMensaje}</div>;
    
    default:
      // Mensajes normales con traducción automática
      if (localTranslationEnabled && textoMensaje?.trim()) {
        return renderMessageWithTranslation(mensaje, esUsuarioActual);
      }
      return <span className="text-white break-words overflow-wrap-anywhere whitespace-pre-wrap">{textoMensaje}</span>;
  }
  }, [usuario.id, localTranslationEnabled, renderMessageWithTranslation, buildCompleteImageUrl]);
  
  const formatearTiempo = useCallback((timestamp) => {
    const fecha = new Date(timestamp);
    return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }, []);

  // 🔥 EFECTOS SIMPLIFICADOS
  useEffect(() => {
    cargarDatosUsuario();
    // Cargar última vez visto desde localStorage
    const savedLastSeen = JSON.parse(localStorage.getItem('chatLastSeen') || '{}');
    setLastSeenMessages(savedLastSeen);
    
    // Pedir permisos para notificaciones
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
      });
    }
  }, []);

  // 🔥 SINCRONIZAR CON EL IDIOMA GLOBAL CUANDO CAMBIA LA BANDERA
  useEffect(() => {
    const handleLanguageChange = (lng) => {
      if (lng && lng !== currentLanguage) {
        // Actualizar estados locales
        const shouldEnable = lng !== 'es';
        setCurrentLanguage(lng);
        setLocalTranslationEnabled(shouldEnable);
        
        // Actualizar configuración de traducción con el nuevo idioma
        setTranslationSettings(prev => ({
          ...prev,
          targetLanguage: lng,
          enabled: shouldEnable,
          showOriginal: true, // Mostrar mensaje original
          showOnlyTranslation: false, // Mostrar también la traducción debajo
          autoDetect: true,
          translateOutgoing: false
        }));
        
        // Actualizar el contexto global también
        if (typeof changeGlobalLanguage === 'function') {
          try {
            changeGlobalLanguage(lng);
          } catch (error) {
          }
        }
        
        // Limpiar traducciones existentes para forzar retraducción
        setTranslations(new Map());
        setTranslatingIds(new Set());
      }
    };

    // Escuchar cambios en el idioma de i18n
    i18nInstance.on('languageChanged', handleLanguageChange);
    
    // También verificar el idioma inicial
    const currentI18nLang = i18nInstance.language || 'es';
    if (currentI18nLang && currentI18nLang !== currentLanguage) {
      handleLanguageChange(currentI18nLang);
    }

    return () => {
      i18nInstance.off('languageChanged', handleLanguageChange);
    };
  }, [currentLanguage, changeGlobalLanguage, i18nInstance, setTranslationSettings]);

  // 🔥 EFECTO PARA TRADUCIR MENSAJES AUTOMÁTICAMENTE
  useEffect(() => {
    if (!localTranslationEnabled) return;

    const messagesToTranslate = mensajes.filter(message => {
      return (
        message.type !== 'system' && 
        !['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(message.type) &&
        !translations.has(message.id) &&
        !translatingIds.has(message.id) &&
        (message.text || message.message) &&
        (message.text || message.message).trim() !== ''
      );
    });

    messagesToTranslate.forEach((message, index) => {
      setTimeout(() => {
        translateMessage(message);
      }, index * 100);
    });

  }, [mensajes.length, localTranslationEnabled, translateMessage]);

  // Sincronizar refs con estados
  useEffect(() => {
    mensajesRefForTranslation.current = mensajes;
  }, [mensajes]);

  useEffect(() => {
    translateMessageRef.current = translateMessage;
  }, [translateMessage]);

  // 🔥 EFECTO PARA RE-TRADUCIR CUANDO CAMBIA EL IDIOMA
  useEffect(() => {
    if (!localTranslationEnabled) return;

    // Limpiar traducciones existentes
    setTranslations(new Map());
    setTranslatingIds(new Set());
    
    // Re-traducir todos los mensajes usando refs
    const timeoutId = setTimeout(() => {
      const currentMensajes = mensajesRefForTranslation.current;
      const currentTranslateMessage = translateMessageRef.current;
      
      if (currentMensajes && currentTranslateMessage) {
        currentMensajes.forEach((mensaje) => {
          if (mensaje.text || mensaje.message) {
            currentTranslateMessage(mensaje);
          }
        });
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [currentLanguage, localTranslationEnabled]); // Solo cuando cambia el idioma

  useEffect(() => {
    if (usuario.id && !loading) {
      cargarConversaciones();
      cargarEstadosIniciales(); // Cargar favoritos, bloqueos y apodos
      loadGifts();
      if (usuario.rol === 'cliente') {
        loadPendingRequests();
      }
    }
  }, [usuario.id, usuario.rol, cargarEstadosIniciales]);
  useEffect(() => {
    const checkPendingChat = () => {
      try {
        const pendingChat = localStorage.getItem('pendingChatOpen');
        
        if (pendingChat) {
          const chatInfo = JSON.parse(pendingChat);
                    
          // Verificar que sea reciente (menos de 10 segundos)
          const now = Date.now();
          const timeDiff = now - chatInfo.timestamp;
          
          if (timeDiff < 10000 && chatInfo.shouldOpen) { // 10 segundos
                        
            // Buscar si la conversación ya existe
            const existingConv = conversaciones.find(conv => 
              conv.other_user_id === chatInfo.clientId || 
              conv.room_name === chatInfo.roomName
            );
            
            if (existingConv) {
                            abrirConversacion(existingConv);
            } else {
                            
              // Crear conversación temporal
              const nuevaConversacion = {
                id: chatInfo.conversationId || Date.now(),
                other_user_id: chatInfo.clientId,
                other_user_name: chatInfo.clientName,
                other_user_role: 'cliente',
                room_name: chatInfo.roomName,
                last_message: "Conversación iniciada - Envía tu primer mensaje",
                last_message_time: new Date().toISOString(),
                last_message_sender_id: null,
                unread_count: 0,
                avatar: `https://i.pravatar.cc/40?u=${chatInfo.clientId}`
              };
              
              // Agregar a la lista
              setConversaciones(prev => {
                // Verificar que no existe
                const exists = prev.some(conv => 
                  conv.other_user_id === chatInfo.clientId ||
                  conv.room_name === chatInfo.roomName
                );
                
                if (!exists) {
                                    return [nuevaConversacion, ...prev];
                }
                return prev;
              });
              
              // Abrir la conversación
              setTimeout(() => {
                abrirConversacion(nuevaConversacion);
              }, 100);
            }
            
            // Limpiar localStorage
            localStorage.removeItem('pendingChatOpen');
                        
          } else {
                        localStorage.removeItem('pendingChatOpen');
          }
        }
      } catch (error) {
                localStorage.removeItem('pendingChatOpen');
      }
    };

    // Verificar cada vez que cambien las conversaciones (cuando se carguen)
    if (conversaciones.length > 0) {
      checkPendingChat();
    }
    
    // También verificar al cargar el componente
    if (usuario.id) {
      setTimeout(checkPendingChat, 500); // Pequeño delay para asegurar que todo esté cargado
    }

  }, [conversaciones, usuario.id, abrirConversacion]);

  useEffect(() => {
    cargarDatosUsuario();
    
    // Cargar última vez visto desde localStorage
    const savedLastSeen = JSON.parse(localStorage.getItem('chatLastSeen') || '{}');
    setLastSeenMessages(savedLastSeen);
    
    // Pedir permisos para notificaciones
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
              });
    }
    
    // 🔥 VERIFICAR CHAT PENDIENTE AL CARGAR
    setTimeout(() => {
      const pendingChat = localStorage.getItem('pendingChatOpen');
      if (pendingChat) {
              }
    }, 1000);
    
  }, []); // 👈 Mantén las dependencias como están

  useEffect(() => {
    let interval;
    if (conversacionActiva) {
            
      interval = setInterval(async () => {
                try {
          let allMessages = [];

          // 🔥 PASO 1: Cargar mensajes del room principal (como antes)
          const mainResponse = await fetch(`${API_BASE_URL}/api/chat/messages/${conversacionActiva}`, {
            method: 'GET',
            headers: getAuthHeaders()
          });

          if (mainResponse.ok) {
            const mainData = await mainResponse.json();
            if (mainData.success && mainData.messages) {
              allMessages = [...allMessages, ...mainData.messages];
                          }
          }

          // 🔥 PASO 2: NUEVO - Cargar mensajes del room específico según rol
          const specificRoomName = usuario.rol === 'cliente' 
            ? `${conversacionActiva}_client`   // Cliente ve gift_sent
            : `${conversacionActiva}_modelo`;  // Modelo ve gift_received

          
          const specificResponse = await fetch(`${API_BASE_URL}/api/chat/messages/${specificRoomName}`, {
            method: 'GET',
            headers: getAuthHeaders()
          });

          if (specificResponse.ok) {
            const specificData = await specificResponse.json();
            if (specificData.success && specificData.messages) {
              allMessages = [...allMessages, ...specificData.messages];
                          }
          } else {
                      }

          // 🔥 PASO 3: Ordenar todos los mensajes por fecha
          allMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

          // 🔥 PASO 4: Comparar con mensajes actuales (como antes)
          const currentMessageIds = new Set(mensajes.map(m => m.id));
          const newMessages = allMessages.filter(m => !currentMessageIds.has(m.id));
          
          if (newMessages.length > 0) {
                        
            // 🎁 DETECTAR REGALOS RECIBIDOS EN MENSAJES NUEVOS
            const newGiftMessages = newMessages.filter(msg => {
              const isGiftReceived = msg.type === 'gift_received' && msg.user_id !== usuario.id;
              if (isGiftReceived) {
                // Gift received
              }
              return isGiftReceived;
            });
            
            if (newGiftMessages.length > 0) {
              
              // Reproducir sonido para cada regalo
              for (const giftMsg of newGiftMessages) {
                try {
                  // Extraer nombre del regalo
                  let giftData = giftMsg.gift_data || giftMsg.extra_data || {};
                  
                  // Parsear si es string
                  if (typeof giftData === 'string') {
                    try {
                      giftData = JSON.parse(giftData);
                    } catch (e) {
                      giftData = { gift_name: t("chat.gifts.specialGift") || 'Regalo Especial' };
                    }
                  }
                  
                  const giftName = giftData.gift_name || t("chat.gifts.specialGift") || 'Regalo Especial';
                                    
                  // Reproducir notificación con sonido
                  await playGiftNotification(giftName);
                  
                  // Esperar un poco entre regalos para no saturar
                  if (newGiftMessages.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                } catch (error) {
                }
              }
            }

            // 🔥 DETECTAR REGALOS ENVIADOS (para clientes)
            const newSentGiftMessages = newMessages.filter(msg => 
              msg.type === 'gift_sent' && 
              msg.user_id === usuario.id && // Solo si soy yo quien envió
              usuario.rol === 'cliente' // Solo los clientes envían regalos
            );
            
            if (newSentGiftMessages.length > 0) {
                            
              if (Notification.permission === 'granted') {
                new Notification(t('chat.notifications.giftSent'), {
                  body: t('chat.notifications.giftSentDesc'),
                  icon: '/favicon.ico'
                });
              }
            }
            
            // 🔥 PASO 5: Actualizar con TODOS los mensajes (principales + específicos)
            setMensajes(allMessages);
            
            // Marcar como visto inmediatamente si estás en la conversación
            await marcarComoVisto(conversacionActiva);
            
            // Auto-scroll al final
            setTimeout(() => {
              if (mensajesRef.current) {
                mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
              }
            }, 100);

                      } else {
                      }
        } catch (error) {
                  }
      }, 3000); // Cada 3 segundos
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
              }
    };
  }, [conversacionActiva, mensajes, getAuthHeaders, marcarComoVisto, usuario.id, usuario.rol, playGiftNotification]);

  // Detectar móvil
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Polling OPTIMIZADO - más frecuente y sin loaders
  useEffect(() => {
    if (!usuario.id) return;
    
    const interval = setInterval(async () => {
      // SIEMPRE hacer polling sin mostrar loading
            await cargarConversaciones();
    }, 5000); // Cada 5 segundos para tiempo más real
    
    return () => clearInterval(interval);
  }, [usuario.id, cargarConversaciones]);

  // Mostrar notificación cuando llegue mensaje nuevo (fuera de conversación activa)
  useEffect(() => {
    const checkForNewMessages = () => {
      conversaciones.forEach(conv => {
        const unreadCount = calculateUnreadCount(conv);
        if (unreadCount > 0 && conv.room_name !== conversacionActiva) {
          // Solo mostrar notificación si no estás en esa conversación
                    
          // Opcional: Mostrar notificación del navegador
          if (Notification.permission === 'granted') {
            new Notification(`Mensaje nuevo de ${conv.other_user_name}`, {
              body: conv.last_message.substring(0, 50) + '...',
              icon: '/favicon.ico',
              tag: conv.room_name // Evita notificaciones duplicadas
            });
          }
        }
      });
    };

    // Verificar mensajes nuevos cada vez que cambien las conversaciones
    checkForNewMessages();
  }, [conversaciones, calculateUnreadCount, conversacionActiva]);

  // Calcular y mostrar conteo global de notificaciones
  const totalUnreadCount = useMemo(() => {
    const total = conversaciones.reduce((count, conv) => {
      return count + calculateUnreadCount(conv);
    }, 0);
        return total;
  }, [conversaciones, calculateUnreadCount]);

  // Cargar usuarios online - FUNCIONALIDAD REAL
  useEffect(() => {
    const cargarUsuariosOnline = async () => {
      if (!usuario.id) return;
      
      try {
                const response = await fetch(`${API_BASE_URL}/api/chat/users/my-contacts`, {
          method: 'GET',
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          const usuariosOnlineIds = new Set(
            (data.contacts || []).map(contact => contact.id)
          );
          setOnlineUsers(usuariosOnlineIds);
                  } else {
                    // Fallback con datos simulados
          setOnlineUsers(new Set([2, 3, 4, 5]));
        }
      } catch (error) {
                // Fallback con datos simulados
        setOnlineUsers(new Set([2, 3, 4, 5]));
      }
    };
    
    if (usuario.id) {
      // Cargar inicial
      cargarUsuariosOnline();
      
      // Actualizar cada 30 segundos para estado online en tiempo real
      const interval = setInterval(cargarUsuariosOnline, 30000);
      return () => clearInterval(interval);
    }
  }, [usuario.id, getAuthHeaders]);

  // 🔗 Abrir chat con modelo desde URL (cuando viene del link de perfil)
  useEffect(() => {
    const modeloId = searchParams.get('modelo');
    const slug = searchParams.get('slug');
    
    if (!modeloId && !slug) return;
    if (!usuario.id || usuario.rol !== 'cliente') return;
    if (hasOpenedSpecificChat.current) return;

    const abrirChatConModelo = async () => {
      try {
        let targetModelId = modeloId;

        // Si viene un slug, obtener el ID del modelo
        if (slug && !modeloId) {
          const response = await fetch(`${API_BASE_URL}/api/public/model/by-slug/${slug}`, {
            headers: getAuthHeaders()
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.model_id) {
              targetModelId = data.model_id;
            } else {
              return; // No se encontró el modelo
            }
          } else {
            return; // Error al obtener el modelo
          }
        }

        if (!targetModelId) return;

        // Buscar si ya existe una conversación con este modelo
        const conversacionExistente = conversaciones.find(
          conv => conv.other_user_id === parseInt(targetModelId)
        );

        if (conversacionExistente) {
          // Abrir la conversación existente
          setConversacionActiva(conversacionExistente.room_name);
          await marcarComoVisto(conversacionExistente.room_name);
          await cargarMensajes(conversacionExistente.room_name);
          hasOpenedSpecificChat.current = true;
          
          // Limpiar parámetro de URL
          navigate('/mensajes', { replace: true });
        } else {
          // Crear nueva conversación
          const response = await fetch(`${API_BASE_URL}/api/chat/start-conversation`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ other_user_id: parseInt(targetModelId) })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.room_name) {
              // Recargar conversaciones para incluir la nueva
              await cargarConversaciones();
              
              // Abrir la nueva conversación
              setTimeout(async () => {
                setConversacionActiva(data.room_name);
                await marcarComoVisto(data.room_name);
                await cargarMensajes(data.room_name);
                hasOpenedSpecificChat.current = true;
                
                // Limpiar parámetro de URL
                navigate('/mensajes', { replace: true });
              }, 500);
            }
          }
        }
      } catch (error) {
      }
    };

    // Esperar a que se carguen las conversaciones
    if (conversaciones.length > 0 || !loading) {
      abrirChatConModelo();
    }
  }, [searchParams, usuario.id, usuario.rol, conversaciones, loading, getAuthHeaders, navigate, cargarConversaciones, marcarComoVisto, cargarMensajes]);

  // 🔗 Abrir chat con usuario desde location.state (cuando viene de usuarios activos)
  useEffect(() => {
    if (!openChatWith || hasOpenedSpecificChat.current) return;
    if (!usuario.id) return;
    if (conversaciones.length === 0 && loading) return; // Esperar a que se carguen las conversaciones

    const abrirChatConUsuario = async () => {
      try {
        const targetUserId = openChatWith.userId || openChatWith.other_user_id;
        const targetUserName = openChatWith.userName || openChatWith.other_user_name || openChatWith.name;
        const targetUserRole = openChatWith.userRole || openChatWith.role || 'cliente';

        if (!targetUserId) return;

        // Buscar si ya existe una conversación con este usuario
        const conversacionExistente = conversaciones.find(
          conv => conv.other_user_id === parseInt(targetUserId)
        );

        if (conversacionExistente) {
          // Abrir la conversación existente
          await abrirConversacion(conversacionExistente);
          hasOpenedSpecificChat.current = true;
          
          // Limpiar estado
          navigate('/mensajes', { replace: true });
        } else {
          // Crear nueva conversación
          const response = await fetch(`${API_BASE_URL}/api/chat/start-conversation`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ other_user_id: parseInt(targetUserId) })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.room_name) {
              // Recargar conversaciones para incluir la nueva
              await cargarConversaciones();
              
              // Crear objeto de conversación con los datos disponibles
              const nuevaConversacion = {
                room_name: data.room_name,
                other_user_id: parseInt(targetUserId),
                other_user_name: targetUserName,
                other_user_display_name: targetUserName || targetUserName,
                other_user_role: targetUserRole,
                last_message: "",
                last_message_time: new Date().toISOString(),
                unread_count: 0,
                avatar_url: openChatWith.avatar_url || null
              };
              
              // Esperar un momento para que se actualicen las conversaciones y luego abrir
              setTimeout(async () => {
                await abrirConversacion(nuevaConversacion);
                hasOpenedSpecificChat.current = true;
                
                // Limpiar estado
                navigate('/mensajes', { replace: true });
              }, 500);
            }
          }
        }
      } catch (error) {
        hasOpenedSpecificChat.current = true;
      }
    };

    // Esperar a que se carguen las conversaciones
    if (conversaciones.length > 0 || !loading) {
      abrirChatConUsuario();
    }
  }, [openChatWith, usuario.id, conversaciones, loading, getAuthHeaders, navigate, cargarConversaciones, abrirConversacion]);

  // 🔄 Resetear flag cuando no hay openChatWith
  useEffect(() => {
    if (!openChatWith) {
      hasOpenedSpecificChat.current = false;
    }
  }, [openChatWith]);

  
  
  // 🔥 Mostrar loading mientras se carga el usuario inicialmente
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1c20] to-[#2b2d31] text-white flex items-center justify-center" style={{
        minHeight: '-webkit-fill-available',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
          <p className="text-white/60">{t("chat.loading") || "Cargando mensajes..."}</p>
        </div>
      </div>
    );
  }
  
  
  // 🔥 TEST: Renderizar versión simplificada primero para debug
  if (isMobile && !usuario.id) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1a1c20',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>🟡 Cargando usuario...</h1>
          <p>Usuario ID: {usuario.id || 'null'}</p>
          <p>Rol: {usuario.rol || 'null'}</p>
          <p>Es móvil: {isMobile ? 'Sí' : 'No'}</p>
        </div>
      </div>
    );
  }
  
  return (
  <div 
    className="min-h-screen bg-gradient-to-br from-[#1a1c20] to-[#2b2d31] text-white" 
    style={isMobile ? {
      minHeight: '-webkit-fill-available',
      height: '-webkit-fill-available',
      position: 'relative',
      width: '100%',
      overflow: 'hidden',
      backgroundColor: '#1a1c20' // 🔥 Forzar color de fondo
    } : {
      position: 'relative',
      width: '100%',
      backgroundColor: '#1a1c20'
    }}
  >
    {/* 🔥 DEBUG: Verificar que el contenido se renderiza */}
    
    {/* 🔥 HEADER CON Z-INDEX ALTO PARA QUE NO SE SUPERPONGA */}
    <div className="relative" style={{ zIndex: 100, position: 'relative' }}>
      <Header />
      
      {/* Botón chat móvil - ARREGLADO */}
      {isMobile && conversacionActiva && !showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="fixed top-4 right-4 z-[60] bg-[#ff007a] hover:bg-[#cc0062] p-3 rounded-full shadow-xl transition-colors"
        >
          <MessageSquare size={20} className="text-white" />
          {totalUnreadCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse border-2 border-white">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </div>
          )}
        </button>
      )}
    </div>

    {/* 🔥 CONTENEDOR PRINCIPAL CON ALTURA FIJA MÓVIL - ARREGLADO PARA iOS */}
    <div className="px-2 pb-2" style={{ 
      position: 'relative',
      zIndex: 1,
      width: '100%',
      height: isMobile ? 'calc(100vh - 80px)' : 'auto',
      minHeight: isMobile ? 'calc(100vh - 80px)' : 'auto',
      marginTop: isMobile ? '0' : '0' // Asegurar que no se superponga
    }}>
      <div className={`flex rounded-xl overflow-hidden shadow-lg border border-[#ff007a]/10 relative ${
        isMobile 
          ? 'min-h-[500px]' // Altura mínima en móvil
          : 'h-[83vh]'
      }`} style={isMobile ? {
        height: 'calc(100vh - 80px)',
        minHeight: 'calc(100vh - 80px)',
        maxHeight: 'calc(100vh - 80px)',
        WebkitOverflowScrolling: 'touch',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
        backgroundColor: '#2b2d31'
      } : {}}>
        
        {/* Sidebar de conversaciones - MODULARIZADO */}
        <ModelConversationList
          conversations={conversaciones}
          filteredConversations={conversacionesFiltradas}
          searchQuery={busquedaConversacion}
          onSearchChange={setBusquedaConversacion}
          activeConversation={conversacionActiva}
          onSelectConversation={abrirConversacion}
          loading={loading}
          onlineUsers={onlineUsers}
          favoritos={favoritos}
          bloqueados={bloqueados}
          bloqueadoPor={bloqueadoPor}
          unreadCounts={calculateUnreadCount}
          getDisplayName={getDisplayName}
          getInitial={getInitial}
          getBlockStatus={getBlockStatus}
          formatearTiempo={formatearTiempo}
          currentUser={usuario}
          isMobile={isMobile}
          onCloseSidebar={() => setShowSidebar(false)}
          showSidebar={showSidebar}
        />

        {/* Panel de chat - MEJORADO CON GRADIENTES */}
        <section className={`${
          isMobile
            ? `${showSidebar ? 'hidden' : 'w-full h-full'}`
            : 'w-2/3'
        } bg-gradient-to-br from-[#0a0d10] via-[#1a1c20] to-[#0a0d10] flex flex-col relative overflow-hidden shadow-xl`}>
          
          {!conversacionActiva ? (
            !isMobile && (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <MessageSquare size={48} className="text-white/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t("chat.selectConversation")}</h3>
                  <p className="text-white/60">{t("chat.selectConversationDesc")}</p>
                </div>
              </div>
            )
          ) : (
            <>
              {/* Header de conversación - MODULARIZADO */}
              <ModelChatHeader
                conversation={conversacionSeleccionada}
                isOnline={onlineUsers.has(conversacionSeleccionada?.other_user_id)}
                blockStatus={conversacionSeleccionada ? getBlockStatus(conversacionSeleccionada.other_user_id) : null}
                isFavorite={conversacionSeleccionada ? favoritos.has(conversacionSeleccionada.other_user_id) : false}
                loadingActions={loadingActions}
                isChatBlocked={isChatBlocked()}
                onGiftClick={() => setShowGiftsModal(true)}
                onToggleFavorite={() => {
                  if (conversacionSeleccionada) {
                    toggleFavorito(conversacionSeleccionada.other_user_id, conversacionSeleccionada.other_user_name);
                  }
                }}
                onOpenSettings={() => setShowMainSettings(!showMainSettings)}
                onOpenNickname={() => {
                  if (conversacionSeleccionada) {
                    abrirModalApodo(conversacionSeleccionada.other_user_id, conversacionSeleccionada.other_user_name);
                  }
                }}
                onToggleBlock={() => {
                  if (conversacionSeleccionada) {
                    toggleBloquear(conversacionSeleccionada.other_user_id, conversacionSeleccionada.other_user_name);
                  }
                }}
                getDisplayName={getDisplayName}
                getInitial={getInitial}
                isMobile={isMobile}
                onBackToConversations={() => setShowSidebar(true)}
                bloqueados={bloqueados}
              />

              {/* Menú de settings */}
              {showMainSettings && (
                <div className="relative">
                  <div className={`absolute ${isMobile ? 'right-0' : 'right-0'} mt-2 bg-[#1f2125] border border-[#ff007a]/30 rounded-xl shadow-lg z-50 ${
                    isMobile ? 'w-56' : 'w-64'
                  }`}>
                    <button
                      onClick={() => {
                        setShowTranslationSettings(true);
                        setShowMainSettings(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-[#2b2d31] transition text-left group"
                    >
                      <Globe className="text-[#ff007a]" size={18} />
                      <div className="flex-1">
                        <span className="text-white text-sm font-medium">{t("chat.menu.translation") || "Traducción"}</span>
                        <div className="text-xs text-gray-400">
                          {translationSettings?.enabled ? (t("chat.menu.translationActive") || "Activa") : (t("chat.menu.translationInactive") || "Inactiva")}
                        </div>
                      </div>
                      <ArrowRight className="text-gray-400" size={14} />
                    </button>

                    <button
                      onClick={() => {
                        toggleFavorito(
                          conversacionSeleccionada?.other_user_id,
                          conversacionSeleccionada?.other_user_name
                        );
                        setShowMainSettings(false);
                      }}
                      disabled={loadingActions}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#2b2d31] text-sm text-white"
                    >
                      {loadingActions ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ff007a]"></div>
                      ) : (
                        <Star 
                          size={16} 
                          className={favoritos.has(conversacionSeleccionada?.other_user_id) ? 'fill-yellow-400 text-yellow-400' : 'text-white'} 
                        />
                      )}
                      {favoritos.has(conversacionSeleccionada?.other_user_id)
                        ? (t("chat.menu.removeFavorite") || "Quitar Favorito")
                        : (t("chat.menu.addFavorite") || "Agregar Favorito")
                      }
                    </button>

                    <button
                      onClick={() => {
                        if (conversacionSeleccionada) {
                          abrirModalApodo(
                            conversacionSeleccionada.other_user_id,
                            conversacionSeleccionada.other_user_name
                          );
                        }
                        setShowMainSettings(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#2b2d31] text-sm text-white transition-colors"
                    >
                      <Pencil size={14} />
                      {t("chat.menu.changeNickname") || "Cambiar apodo"}
                    </button>

                    <button
                      onClick={() => {
                        if (conversacionSeleccionada) {
                          toggleBloquear(
                            conversacionSeleccionada.other_user_id,
                            conversacionSeleccionada.other_user_name
                          );
                        }
                        setShowMainSettings(false);
                      }}
                      disabled={loadingActions}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#2b2d31] text-sm text-red-400"
                    >
                      {loadingActions ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                      ) : (
                        <Ban size={14} />
                      )}
                      {bloqueados.has(conversacionSeleccionada?.other_user_id)
                        ? (t("chat.menu.unblock") || "Desbloquear")
                        : (t("chat.menu.block") || "Bloquear")
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* Mensajes - MEJORADO CON SCROLLBAR PERSONALIZADO */}
              <div
                ref={mensajesRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll-transparent"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#ff007a #2b2d31',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {/* Indicador de bloqueo */}
                {conversacionSeleccionada && bloqueados.has(conversacionSeleccionada.other_user_id) && (
                  <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Ban size={20} className="text-red-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-red-300 font-semibold">{t("chat.status.userBlocked") || "🚫 Usuario Bloqueado"}</p>
                        <p className="text-red-200 text-sm mb-3">
                          {t("chat.status.userBlockedDesc", { name: getDisplayName(conversacionSeleccionada.other_user_id, conversacionSeleccionada.other_user_name) }) || `Has bloqueado a ${getDisplayName(conversacionSeleccionada.other_user_id, conversacionSeleccionada.other_user_name)}.`}
                        </p>
                        <button
                          onClick={() => {
                            if (confirm(t("chat.status.confirmUnblock", { name: conversacionSeleccionada.other_user_name }) || `¿Desbloquear a ${conversacionSeleccionada.other_user_name}?`)) {
                              toggleBloquear(conversacionSeleccionada.other_user_id, conversacionSeleccionada.other_user_name);
                            }
                          }}
                          disabled={loadingActions}
                          className="bg-[#ff007a] hover:bg-[#e6006f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                        >
                          {loadingActions ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              {t("chat.status.unblocking") || "Desbloqueando..."}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                              </svg>
                              {t("chat.status.unblockUser") || "Desbloquear Usuario"}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {mensajes.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-white/60">{t("chat.noMessages") || "No hay mensajes aún"}</p>
                  </div>
                ) : (
                  mensajes.map((mensaje, index) => {
                    const esUsuarioActual = mensaje.user_id === usuario.id;

                    // 🔍 DEBUG: Verificar datos del mensaje antes de renderizar
                    if (!esUsuarioActual && mensaje.user_id) {
                      console.log('📨 [mensajes.jsx] Preparando mensaje para renderizar:', {
                        message_id: mensaje.id,
                        user_id: mensaje.user_id,
                        user_name: mensaje.user_name,
                        avatar: mensaje.avatar,
                        avatar_url: mensaje.avatar_url,
                        has_avatar: !!(mensaje.avatar || mensaje.avatar_url),
                        message_type: mensaje.type
                      });
                    }

                    return (
                      <ModelMessageBubble
                        key={mensaje.id}
                        message={mensaje}
                        isOwnMessage={esUsuarioActual}
                        userName={mensaje.user_name}
                        getInitial={getInitial}
                        formatearTiempo={formatearTiempo}
                        renderMessageContent={renderMensaje}
                        index={index}
                      />
                    );
                  })
                )}
              </div>

              {/* Input mensaje - MODULARIZADO */}
              <ModelMessageInput
                message={nuevoMensaje}
                onMessageChange={setNuevoMensaje}
                onSend={enviarMensaje}
                onGiftClick={() => setShowGiftsModal(true)}
                isChatBlocked={isChatBlocked()}
                hasConversation={!!conversacionActiva}
                isMobile={isMobile}
                disabled={false}
                sending={false}
              />
            </>
          )}
        </section>
      </div>
    </div>
      {/* Overlay móvil */}
      {isMobile && showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Modales */}
      <TranslationSettings
        isOpen={showTranslationSettings}
        onClose={() => setShowTranslationSettings(false)}
        settings={translationSettings}
        onSettingsChange={setTranslationSettings}
        languages={languages}
      />

      <CallingSystem
        isVisible={isCallActive}
        callerName={currentCall?.name}
        onCancel={cancelarLlamada}
        callStatus={currentCall?.status || 'initiating'}
      />

      <GiftsModal
        isOpen={showGiftsModal}
        onClose={() => setShowGiftsModal(false)}
        recipientName={conversacionSeleccionada?.other_user_name || 'Usuario'}
        recipientId={conversacionSeleccionada?.other_user_id}
        roomName={conversacionActiva}
        userRole={usuario.rol}
        gifts={gifts}
        onRequestGift={handleRequestGift}
        loading={loadingGift}
      />
      <IncomingCallOverlay
        isVisible={isReceivingCall}
        callData={incomingCall}
        onAnswer={answerCall} // 🔥 USAR FUNCIÓN DEL CONTEXTO GLOBAL
        onDecline={declineCall} // 🔥 USAR FUNCIÓN DEL CONTEXTO GLOBAL
      />
    </div>
  );
}