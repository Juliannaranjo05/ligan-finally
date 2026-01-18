import React, { useEffect, useRef, useMemo, useCallback, useState  } from 'react';
import { Star, UserX, Gift, Send, Shield, Crown, MessageCircle,Globe, Settings, X  } from 'lucide-react';
import { useGlobalTranslation } from '../../../contexts/GlobalTranslationContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { getTranslatedGiftName, getGiftCardText } from '../../GiftSystem/giftTranslations';
import EmojiPickerButton from '../../common/EmojiPickerButton.jsx';

const DesktopChatPanelClient = ({
  getDisplayName,
  isDetectingUser,
  toggleFavorite,
  blockCurrentUser,
  isFavorite,
  isAddingFavorite,
  isBlocking,
  otherUser,
  apodos,
  setShowGiftsModal,
  messages,
  mensaje,
  setMensaje,
  enviarMensaje,
  handleKeyPress,
  userData,
  userBalance,
  giftBalance,
  handleAcceptGift,
  handleRejectGift,
  playGiftSound,
  roomName,
  t,
  hardcodedTexts = {}
}) => {
  
  // 🔥 FALLBACK A TEXTO EN ESPAÑOL SI NO HAY hardcodedTexts
  const texts = {
    chatWith: hardcodedTexts.chatWith || "Conversa con",
    startConversation: hardcodedTexts.startConversation || "Inicia una conversación interesante y disfruta del chat",
    writeMessage: hardcodedTexts.writeMessage || "Escribe tu mensaje...",
    waitingModel: hardcodedTexts.waitingModel || "Esperando modelo...",
    modelWillConnect: hardcodedTexts.modelWillConnect || "Una modelo se conectará pronto para chatear contigo"
  };

  // Ref para el contenedor de mensajes
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const processedMessageIds = useRef(new Set());
  const [processingGiftRequest, setProcessingGiftRequest] = useState(null);

  const { 
  translateGlobalText, 
  isEnabled: translationEnabled,
  changeGlobalLanguage,
  currentLanguage: globalCurrentLanguage 
} = useGlobalTranslation();

const [showSettingsModal, setShowSettingsModal] = useState(false);
const [currentLanguage, setCurrentLanguage] = useState(() => {
  return localStorage.getItem('selectedLanguage') || globalCurrentLanguage || 'es';
});

const [localTranslationEnabled, setLocalTranslationEnabled] = useState(() => {
  return localStorage.getItem('translationEnabled') === 'true';
});

const [translations, setTranslations] = useState(new Map());
const [translatingIds, setTranslatingIds] = useState(new Set());
const [isOtherTyping, setIsOtherTyping] = useState(false);
const typingTimeoutRef = useRef(null);
const typingIntervalRef = useRef(null);
const lastTypingSentRef = useRef(0);

// 🔥 OBTENER EL HOOK DE i18n PARA ESCUCHAR CAMBIOS
const { i18n: i18nInstance } = useTranslation();

const getAuthHeaders = useCallback(() => {
  const token = localStorage.getItem("token");
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}, []);

const sendTypingStatus = useCallback(async (isTyping) => {
  if (!roomName) return;
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/typing`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        room_name: roomName,
        is_typing: !!isTyping
      })
    });
  } catch (error) {
    // Silenciar errores de typing
  }
}, [roomName, getAuthHeaders]);

const handleMessageChange = useCallback((value) => {
  setMensaje(value);
  if (!roomName) return;
  const now = Date.now();
  if (now - lastTypingSentRef.current > 1500) {
    sendTypingStatus(true);
    lastTypingSentRef.current = now;
  }
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
  }
  typingTimeoutRef.current = setTimeout(() => {
    sendTypingStatus(false);
  }, 2500);
}, [roomName, sendTypingStatus, setMensaje]);

useEffect(() => {
  if (!roomName) {
    setIsOtherTyping(false);
    return;
  }

  const fetchTypingStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/typing/${roomName}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (!response.ok) return;
      const data = await response.json();
      setIsOtherTyping(!!data?.is_typing);
    } catch (error) {
      // Silenciar errores de typing
    }
  };

  fetchTypingStatus();
  if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
  typingIntervalRef.current = setInterval(fetchTypingStatus, 2000);

  return () => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    sendTypingStatus(false);
  };
}, [roomName, getAuthHeaders, sendTypingStatus]);

// 🔥 SINCRONIZAR CON EL IDIOMA GLOBAL CUANDO CAMBIA LA BANDERA
useEffect(() => {
  const handleLanguageChange = (lng) => {
    // Solo actualizar si el idioma realmente cambió
    if (lng && lng !== currentLanguage) {
      
      setCurrentLanguage(lng);
      localStorage.setItem('selectedLanguage', lng);
      
      // Habilitar traducción automáticamente si no es español
      const shouldEnableTranslation = lng !== 'es';
      setLocalTranslationEnabled(shouldEnableTranslation);
      localStorage.setItem('translationEnabled', shouldEnableTranslation.toString());
      
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
  const currentI18nLang = i18nInstance.language || i18n.language;
  if (currentI18nLang && currentI18nLang !== currentLanguage) {
    handleLanguageChange(currentI18nLang);
  }

  return () => {
    i18nInstance.off('languageChanged', handleLanguageChange);
  };
}, [currentLanguage, changeGlobalLanguage, i18nInstance]);

// 🔥 FUNCIÓN DE TRADUCCIÓN FALLBACK
const translateWithFallback = useCallback(async (text, targetLang) => {
  try {
    const cleanText = text.toLowerCase().trim();
    
    if (targetLang === 'en') {
      const translations = {
        'hola': 'hello',
        'como estas': 'how are you',
        'como estás': 'how are you',
        'bien': 'good',
        'gracias': 'thank you',
        'si': 'yes',
        'sí': 'yes',
        'no': 'no',
        'te amo': 'I love you',
        'hermosa': 'beautiful',
        'bonita': 'pretty'
      };
      
      return translations[cleanText] || text;
    }
    
    if (targetLang === 'es') {
      const translations = {
        'hello': 'hola',
        'hi': 'hola',
        'how are you': 'cómo estás',
        'good': 'bien',
        'thank you': 'gracias',
        'yes': 'sí',
        'no': 'no',
        'i love you': 'te amo',
        'beautiful': 'hermosa'
      };
      
        return translations[cleanText] || text;
    }
    
      return text;
  } catch (error) {
      return text;
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
    
    if (result && result !== originalText && result.trim() !== '') {
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

// 🔥 EFECTO PARA TRADUCIR MENSAJES AUTOMÁTICAMENTE
useEffect(() => {
  if (!localTranslationEnabled) return;

  const messagesToTranslate = messages.filter(message => {
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

}, [messages.length, localTranslationEnabled, translateMessage]);

// 🔥 COMPONENTE PARA RENDERIZAR MENSAJES CON TRADUCCIÓN
const renderMessageWithTranslation = useCallback((message, isOwn = false) => {
  const originalText = message.text || message.message;
  const translatedText = translations.get(message.id);
  const isTranslating = translatingIds.has(message.id);
  
  const hasTranslation = translatedText && translatedText !== originalText && translatedText.trim() !== '';

  return (
    <div className="space-y-1">
      <div className="text-white">
        {originalText}
        {isTranslating && (
          <span className="ml-2 inline-flex items-center">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-current opacity-50"></div>
          </span>
        )}
      </div>

      {hasTranslation && (
        <div className={`text-xs italic border-l-2 pl-2 py-1 ${
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

// 🔥 IDIOMAS DISPONIBLES
const languages = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' }
];

// 🔥 FUNCIÓN PARA CAMBIAR IDIOMA
const handleLanguageChange = (languageCode) => {
  setCurrentLanguage(languageCode);
  localStorage.setItem('selectedLanguage', languageCode);
  
  const shouldEnableTranslation = languageCode !== 'es';
  setLocalTranslationEnabled(shouldEnableTranslation);
  localStorage.setItem('translationEnabled', shouldEnableTranslation.toString());
  
  if (typeof changeGlobalLanguage === 'function') {
    try {
      changeGlobalLanguage(languageCode);
    } catch (error) {
    }
  }
  
  setTranslations(new Map());
  setTranslatingIds(new Set());
  setShowSettingsModal(false);
};

  const [stableMessages, setStableMessages] = useState([]);

// 🔥 SOLO ACTUALIZAR CUANDO REALMENTE CAMBIEN LOS MENSAJES
useEffect(() => {
  if (!messages || !Array.isArray(messages)) {
    return;
  }

  // Crear signature de los mensajes
  const currentSignature = messages.map(m => `${m.id}-${m.type}-${m.text?.substring(0, 10)}`).join('|');
  const lastSignature = stableMessages.map(m => `${m.id}-${m.type}-${m.text?.substring(0, 10)}`).join('|');

  // Solo actualizar si realmente cambiaron
  if (currentSignature !== lastSignature) {
    // changed: signatures differ, actualizar estado de mensajes

    // Procesar mensajes
    const seenIds = new Set();
    const uniqueMessages = messages.filter(msg => {
      if (seenIds.has(msg.id)) {
        return false;
      }
      seenIds.add(msg.id);
      return true;
    });

    // 🔥 ORDENAMIENTO CRONOLÓGICO CORRECTO - MEJORADO
    const sortedMessages = uniqueMessages.slice().sort((a, b) => {
      // 🔥 FUNCIÓN PARA OBTENER TIMESTAMP DE MÚLTIPLES FUENTES
      const getTimestamp = (msg) => {
        // Intentar obtener timestamp de múltiples fuentes
        if (msg.timestamp && typeof msg.timestamp === 'number' && msg.timestamp > 0) {
          return msg.timestamp;
        }
        
        if (msg.created_at) {
          const date = new Date(msg.created_at);
          if (!isNaN(date.getTime()) && date.getTime() > 0) {
            return date.getTime();
          }
        }
        
        // Si el ID es un timestamp válido (mayor a 2001-09-09)
        if (msg.id) {
          const idNum = typeof msg.id === 'string' ? parseInt(msg.id) : msg.id;
          if (typeof idNum === 'number' && idNum > 1000000000000) {
            return idNum;
          }
        }
        
        // Si no hay timestamp válido, retornar 0 (se ordenarán al principio)
        return 0;
      };
      
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      
      // 🔥 ORDEN ASCENDENTE: los más antiguos primero
      if (timeA !== timeB && timeA > 0 && timeB > 0) {
        return timeA - timeB;
      }
      
      // Si uno tiene timestamp y el otro no, el que tiene timestamp va después
      if (timeA > 0 && timeB === 0) return 1;
      if (timeA === 0 && timeB > 0) return -1;
      
      // Si ambos tienen timestamp 0 o igual, usar ID como desempate
      const idA = typeof a.id === 'string' ? parseInt(a.id) || 0 : (a.id || 0);
      const idB = typeof b.id === 'string' ? parseInt(b.id) || 0 : (b.id || 0);
      return idA - idB;
    });

    // debug: resumen de sortedMessages eliminado

    // 🔥 DETECTAR NUEVAS SOLICITUDES DE REGALO ANTES DE ACTUALIZAR
    if (stableMessages.length > 0) {
      // Obtener mensajes nuevos comparando con los anteriores
      const currentIds = new Set(sortedMessages.map(m => m.id));
      const previousIds = new Set(stableMessages.map(m => m.id));
      
      const newMessages = sortedMessages.filter(msg => !previousIds.has(msg.id));
      
      // Filtrar solo solicitudes de regalo nuevas
      const newGiftRequests = newMessages.filter(msg => 
        msg.type === 'gift_request' && 
        msg.user_id !== userData?.id && // Solo si no soy yo quien envió
        msg.senderRole !== 'cliente'    // Solo de la modelo
      );
      
      if (newGiftRequests.length > 0) {
        
        // Reproducir sonido para cada solicitud nueva
        newGiftRequests.forEach(async (giftMsg, index) => {
          try {
            // Pequeño delay entre regalos para no saturar
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Reproducir sonido usando la función centralizada
            if (playGiftSound) {
              await playGiftSound('request');
            }
            
            // Vibrar en dispositivos móviles
            if ('vibrate' in navigator) {
              navigator.vibrate([300, 100, 300]);
            }
            
            // Notificación visual
            if (Notification.permission === 'granted') {
              const giftData = parseGiftData(giftMsg);
              new Notification('💝 Solicitud de Regalo', {
                body: `¡${safeGetDisplayName()} te pide: ${giftData.gift_name}!`,
                icon: '/favicon.ico',
                tag: 'gift-request',
                requireInteraction: true
              });
            }
          } catch (error) {
          }
        });
      }
    }

    setStableMessages(sortedMessages);
  }
}, [messages, playGiftSound, userData?.id, otherUser, apodos]);

// 🔥 TAMBIÉN AGREGAR ESTE DEBUG PARA VER EL ORDEN REAL
useEffect(() => {
  if (stableMessages.length > 0) {
    stableMessages.forEach((msg, index) => {
    });
  }
}, [stableMessages]);

// 🔥 FUNCIÓN MEJORADA PARA DETECTAR REGALOS
const isGiftMessage = useCallback((msg) => {
  const result = (
    // Tipos específicos de regalo
    msg.type === 'gift_request' || 
    msg.type === 'gift_sent' || 
    msg.type === 'gift_received' || 
    msg.type === 'gift' ||
    msg.type === 'gift_rejected' ||
    // Texto que indica regalo
    (msg.text && (
      msg.text.includes('🎁 Solicitud de regalo') ||
      msg.text.includes('Solicitud de regalo') ||
      msg.text.includes('🎁 Enviaste:') ||
      msg.text.includes('🎁 Recibiste:') ||
      msg.text.includes('Enviaste:') ||
      msg.text.includes('Recibiste:') ||
      msg.text.includes('Regalo recibido') ||
      msg.text.includes('Regalo enviado') ||
      msg.text.includes('Rechazaste una solicitud')
    )) ||
    // Mensaje heredado con campo message
    (msg.message && (
      msg.message.includes('🎁 Solicitud de regalo') ||
      msg.message.includes('Solicitud de regalo') ||
      msg.message.includes('🎁 Enviaste:') ||
      msg.message.includes('🎁 Recibiste:') ||
      msg.message.includes('Enviaste:') ||
      msg.message.includes('Recibiste:')
    ))
  );
  
  return result;
}, []);

// 🔥 FUNCIÓN HELPER PARA PARSING SEGURO DE JSON
const parseGiftData = useCallback((msg) => {
  let giftData = {};
  
  // Intentar obtener de extra_data primero
  if (msg.extra_data) {
    try {
      if (typeof msg.extra_data === 'string') {
        giftData = JSON.parse(msg.extra_data);
      } else if (typeof msg.extra_data === 'object') {
        giftData = msg.extra_data;
      }
    } catch (e) {
      console.warn('Error parseando extra_data:', e);
    }
  }
  
  // Fallback a gift_data (combinar, no reemplazar)
  if (msg.gift_data) {
    try {
      let parsedGiftData = {};
      if (typeof msg.gift_data === 'string') {
        parsedGiftData = JSON.parse(msg.gift_data);
      } else if (typeof msg.gift_data === 'object') {
        parsedGiftData = msg.gift_data;
      }
      // Combinar datos, dando prioridad a extra_data pero preservando gift_data
      giftData = { ...parsedGiftData, ...giftData };
    } catch (e) {
      console.warn('Error parseando gift_data:', e);
    }
  }
  
  // Extraer datos del texto si no hay JSON
  if (!giftData.gift_name && (msg.text || msg.message)) {
    const text = msg.text || msg.message;
    
    // Para solicitudes: "🎁 Solicitud de regalo: Nombre del Regalo" o "🎁 Pedido de presente: Nombre"
    const requestMatch = text.match(/(?:Solicitud de regalo|Pedido de presente):\s*(.+?)(?:\s*-|$)/);
    if (requestMatch) {
      giftData.gift_name = requestMatch[1].trim();
      giftData.gift_price = giftData.gift_price || 10;
    }
    
    // Para enviados: "🎁 Enviaste: Nombre del Regalo"
    const sentMatch = text.match(/Enviaste:\s*(.+?)(?:\s*-|$)/);
    if (sentMatch) {
      giftData.gift_name = sentMatch[1].trim();
    }
    
    // Para recibidos: "🎁 Recibiste: Nombre del Regalo"
    const receivedMatch = text.match(/Recibiste:\s*(.+?)(?:\s*-|$)/);
    if (receivedMatch) {
      giftData.gift_name = receivedMatch[1].trim();
    }
  }
  
  // 🔥 Asegurar que gift_image se obtenga de todas las fuentes posibles
  const giftImage = giftData.gift_image || 
                    giftData.image || 
                    giftData.image_path || 
                    giftData.gift_image_path || 
                    null;
  
  // Valores por defecto
  return {
    ...giftData,
    // Asegurar que gift_image esté en el objeto final (sobrescribir cualquier valor previo)
    gift_name: giftData.gift_name || 'Regalo Especial',
    gift_price: giftData.gift_price || 10,
    gift_image: giftImage, // Usar la imagen obtenida de todas las fuentes
    request_id: giftData.request_id || giftData.transaction_id || msg.id,
    security_hash: giftData.security_hash || null,
    original_message: giftData.original_message || ''
  };
}, []);

  // Auto-scroll al final cuando hay nuevos mensajes
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };
  

  // Efecto para hacer scroll automático cuando cambian los mensajes
  useEffect(() => {
    scrollToBottom();
  }, [stableMessages]);

  // También scroll cuando se envía un mensaje
  useEffect(() => {
    if (mensaje === '') {
      // Mensaje acabado de enviar, hacer scroll
      setTimeout(scrollToBottom, 100);
    }
  }, [mensaje]);

  // Función de fallback para getDisplayName (con soporte para nickname)
  const safeGetDisplayName = () => {
    if (typeof getDisplayName === 'function') {
      try {
        const name = getDisplayName();
        // Si retorna un mensaje de carga, intentar obtener de otherUser
        if (name === 'Conectando...' || name === 'Detectando...' || name === 'Esperando modelo...' || name === 'Configurando...') {
          if (otherUser) {
            const nickname = apodos?.[otherUser.id];
            const userName = nickname || otherUser.name || otherUser.display_name || otherUser.user_name;
            if (userName && userName.trim()) {
              return userName.trim();
            }
          }
        }
        return name;
      } catch (error) {
      }
    }
    
    // Fallback manual con soporte para nickname
    if (otherUser) {
      const nickname = apodos?.[otherUser.id];
      const userName = nickname || otherUser.name || otherUser.display_name || otherUser.user_name;
      return userName && userName.trim() ? userName.trim() : 'Modelo';
    }
    
    // Solo mostrar mensajes de carga si realmente estamos detectando
    return isDetectingUser ? (hardcodedTexts.connecting || 'Conectando...') : texts.waitingModel;
  };

  const buildCompleteImageUrl = (imagePath) => {
      if (!imagePath) {
          return null;
      }
      
      // Si ya es una URL completa
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
          return imagePath;
      }
      
      const baseUrl = import.meta.env.VITE_API_BASE_URL;
      const cleanBaseUrl = baseUrl.replace(/\/$/, '');
      
      // Limpiar backslashes de Windows
      const cleanPath = imagePath.replace(/\\/g, '/');
      
      let finalUrl;
      let fileName;
      
      if (cleanPath.startsWith('storage/')) {
          // Codificar el nombre del archivo para caracteres especiales
          const pathParts = cleanPath.split('/');
          fileName = pathParts.pop();
          const directory = pathParts.join('/');
          const encodedFileName = encodeURIComponent(fileName);
          finalUrl = `${cleanBaseUrl}/${directory}/${encodedFileName}`;
      } else if (cleanPath.startsWith('/')) {
          // Codificar el nombre del archivo
          const pathParts = cleanPath.split('/');
          fileName = pathParts.pop();
          const directory = pathParts.join('/');
          const encodedFileName = encodeURIComponent(fileName);
          finalUrl = `${cleanBaseUrl}${directory}/${encodedFileName}`;
      } else {
          // image.png -> http://domain.com/storage/gifts/image.png
          fileName = cleanPath;
          const encodedFileName = encodeURIComponent(cleanPath);
          finalUrl = `${cleanBaseUrl}/storage/gifts/${encodedFileName}`;
      }
      
      // Agregar versión basada en el nombre del archivo (sin timestamp para evitar re-renders)
      const version = fileName ? encodeURIComponent(fileName).substring(0, 20) : 'default';
      return `${finalUrl}?v=${version}`;
  };

  // 🔥 COMPONENTE PARA RENDERIZAR IMÁGENES DE REGALOS - SIN LOOPS
  const GiftImage = React.memo(({ imagePath, messageId, alt, className, containerClassName }) => {
    // Usar useMemo para estabilizar la URL y evitar recálculos
    const imageUrl = useMemo(() => {
      if (!imagePath) return null;
      return buildCompleteImageUrl(imagePath);
    }, [imagePath]);

    // Si no hay URL, retornar null para no romper el layout
    if (!imageUrl) {
      return null;
    }

    // Usar una key estable basada solo en messageId para evitar re-renders innecesarios
    const stableKey = useMemo(() => `gift-img-${messageId}`, [messageId]);

    return (
      <div className={containerClassName || "gift-image-container"} style={{ minHeight: '80px', minWidth: '80px' }}>
        <img
          key={stableKey}
          src={imageUrl}
          alt={alt || 'Regalo'}
          className={className || "gift-image object-contain"}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain'
          }}
          loading="eager"
          decoding="sync"
        />
      </div>
    );
  }, (prevProps, nextProps) => {
    // Comparación personalizada: solo re-renderizar si cambia imagePath o messageId
    return prevProps.imagePath === nextProps.imagePath && 
           prevProps.messageId === nextProps.messageId;
  });

  return (
    <>
      {/* 🔥 CONTENEDOR PRINCIPAL CON MEDIA QUERIES RESPONSIVAS */}
      <div className="w-full h-full flex-shrink-0 bg-gradient-to-b from-[#0a0d10] to-[#131418] backdrop-blur-xl rounded-2xl flex flex-col justify-between relative border border-[#ff007a]/20 shadow-2xl overflow-hidden" style={{ height: '100%', maxHeight: '100%', minHeight: 0 }}>
        {/* Línea superior fucsia */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#ff007a]"></div>
        
        {/* 🔥 HEADER DEL CHAT REDISEÑADO PARA CLIENTE */}
        <div className="relative p-3 border-b border-gray-700/50">
          <div className="relative flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* Avatar con colores Ligand */}
              <div className="relative">
                <div className="avatar-size bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg border border-[#ff007a]/30">
                  {otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                
              </div>
              
              {/* Información del usuario - SIMPLIFICADA */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-white header-text leading-tight">
                    {safeGetDisplayName()}
                  </h3>
                  
                  {isDetectingUser && (
                    <div className="animate-spin rounded-full loading-size border-b-2 border-[#ff007a]"></div>
                  )}
                  
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
             
              
              
              
              <button
                onClick={toggleFavorite}
                disabled={isAddingFavorite || !otherUser}
                className={`
                  relative button-container rounded-lg transition-all duration-300 hover:scale-110 group overflow-hidden
                  ${isFavorite 
                    ? 'bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/40 shadow-lg' 
                    : 'bg-gray-800/50 text-gray-400 hover:text-[#ff007a] hover:bg-[#ff007a]/10'
                  }
                  ${isAddingFavorite ? 'animate-pulse' : ''}
                  ${!otherUser ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
              
              <button
                onClick={blockCurrentUser}
                disabled={isBlocking || !otherUser}
                className={`
                  relative button-container rounded-lg transition-all duration-300 hover:scale-110 group
                  bg-gray-800/50 text-gray-400 hover:text-red-400 hover:bg-red-400/10
                  ${isBlocking ? 'animate-pulse' : ''}
                  ${!otherUser ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title="Bloquear modelo"
              >
                <UserX size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {/* 🔥 ÁREA DE MENSAJES REDISEÑADA CON AUTO-SCROLL */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          <div 
            ref={messagesContainerRef}
            className="flex-1 p-3 space-y-3 overflow-y-auto custom-scroll flex flex-col"
            style={{ minHeight: 0, height: '100%' }}
          >
            {stableMessages.length === 0 ? (
              <div className="flex items-center justify-center flex-1 min-h-0">
                <div className="text-center py-8">
                  <div className="empty-icon bg-[#ff007a]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#ff007a]/20">
                    <MessageCircle size={32} className="text-[#ff007a]" />
                  </div>
                  <h4 className="text-white font-semibold mb-2 empty-title">
                    {otherUser ? `${texts.chatWith} ${safeGetDisplayName()}` : texts.waitingModel}
                  </h4>
                  <p className="text-gray-400 empty-text leading-relaxed max-w-xs">
                    {otherUser 
                      ? texts.startConversation
                      : texts.modelWillConnect
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {stableMessages.map((msg, index) => {
                  // 🔥 CONTROL DE LOGGING - Solo log si no se ha procesado antes
                  if (!processedMessageIds.current.has(msg.id)) {
                    // debug: message summary removed
                    processedMessageIds.current.add(msg.id);
                  }

                  // 🔥 VERIFICAR SI ES MENSAJE DE REGALO
                  const isGift = isGiftMessage(msg);

                  return (
                    <div key={`${msg.id}-${index}`} className="space-y-3">
                      
                      {/* 🔥 RENDERIZADO DE REGALOS - FLUJO CRONOLÓGICO CORREGIDO */}
                      {isGift && (() => {
                        const giftData = parseGiftData(msg);
                        // debug: gift render details removed

                        // 🔥 DETERMINAR TIPO DE REGALO Y QUIÉN LO ENVIÓ
                        const isFromCurrentUser = msg.user_id === userData?.id || 
                                                msg.user_name === userData?.name ||
                                                msg.senderRole === 'cliente' ||
                                                msg.type === 'local';

                        const isRequestFromModel = (msg.type === 'gift_request') && !isFromCurrentUser;
                        const isGiftSentByClient = (msg.type === 'gift_sent') && isFromCurrentUser;
                        const isGiftReceivedByModel = (msg.type === 'gift_received') && !isFromCurrentUser;
                        const isRejectedByClient = (msg.type === 'gift_rejected') && isFromCurrentUser;

                        // 🔥 1. SOLICITUD DE REGALO (viene de la modelo) - ANCHO LIMITADO CORRECTAMENTE
                        if (isRequestFromModel || 
                            (!isFromCurrentUser && (
                              (msg.text && msg.text.includes('Solicitud de regalo')) ||
                              (msg.message && msg.message.includes('Solicitud de regalo'))
                            ))) {
                          
                          return (
                            <div className="space-y-2"> {/* ← Contenedor completo */}
                              
                              {/* 🔥 HEADER DEL MENSAJE (como los mensajes normales) */}
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <div className="message-avatar bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-full flex items-center justify-center">
                                    <span className="text-white avatar-text font-bold">
                                      {otherUser?.name?.charAt(0)?.toUpperCase() || 'M'}
                                    </span>
                                  </div>
                                  <span className="username-text text-[#ff007a] font-medium">
                                    {safeGetDisplayName()}
                                  </span>
                                </div>
                              </div>

                              {/* 🔥 CARD DE REGALO CON ANCHO LIMITADO */}
                              <div className="flex justify-start">
                                <div className="bg-gradient-to-br from-[#ff007a]/20 via-[#cc0062]/20 to-[#990047]/20 rounded-xl gift-card-request border border-[#ff007a]/30 shadow-lg backdrop-blur-sm">
                                  <div className="flex items-center justify-center gap-2 mb-3">
                                    <div className="bg-gradient-to-r from-[#ff007a] to-[#cc0062] rounded-full gift-icon-container">
                                      <Gift size={16} className="text-white" />
                                    </div>
                                    <span className="text-pink-100 gift-title font-semibold">
                                      {getGiftCardText('requestGift', currentLanguage)}
                                    </span>
                                  </div>
                                  
                                  <div className="mb-3 flex justify-center">
                                    <GiftImage
                                      imagePath={giftData.gift_image}
                                      messageId={msg.id}
                                      alt={giftData.gift_name || 'Regalo'}
                                      containerClassName="gift-image-container bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-purple-300/30"
                                    />
                                  </div>
                                  
                                  <div className="text-center space-y-2">
                                    <p className="text-white font-bold gift-name-text">
                                      {getTranslatedGiftName(giftData.gift_name, currentLanguage, giftData.gift_name)}
                                    </p>
                                    
                                    <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg gift-price-container border border-amber-300/30">
                                      <span className="text-amber-200 font-bold gift-price-text">
                                        ✨ {giftData.gift_price} {getGiftCardText('minutes', currentLanguage)}
                                      </span>
                                    </div>
                                    
                                    {/* 🔥 BOTÓN ACEPTAR Y PAGAR - DENTRO DE LA CARTA */}
                                    <div className="mt-3 pt-3 border-t border-[#ff007a]/20">
                                      {(() => {
                                        const currentBalance = giftBalance !== undefined ? giftBalance : (userBalance !== undefined ? userBalance : 0);
                                        const giftPrice = giftData.gift_price || 0;
                                        const hasEnoughBalance = currentBalance >= giftPrice;
                                        const requestId = giftData.request_id || giftData.transaction_id || msg.id;
                                        const isProcessing = processingGiftRequest === requestId;
                                        
                                        // 🔥 VERIFICAR SI EL REGALO YA FUE ACEPTADO
                                        // Buscar si hay un mensaje gift_sent con el mismo request_id
                                        const giftAlreadyAccepted = stableMessages.some(m => {
                                          // Verificar por tipo gift_sent
                                          if (m.type === 'gift_sent' && m.user_id === userData?.id) {
                                            try {
                                              const sentGiftData = typeof m.extra_data === 'string' ? JSON.parse(m.extra_data) : (m.extra_data || {});
                                              const sentGiftData2 = typeof m.gift_data === 'string' ? JSON.parse(m.gift_data) : (m.gift_data || {});
                                              const sentRequestId = sentGiftData.request_id || sentGiftData.transaction_id || sentGiftData2.request_id || sentGiftData2.transaction_id;
                                              
                                              // Comparar con requestId (puede ser string o número)
                                              const requestIdStr = String(requestId);
                                              const requestIdNum = Number(requestId);
                                              
                                              return sentRequestId === requestId || 
                                                     sentRequestId === requestIdStr || 
                                                     sentRequestId === requestIdNum ||
                                                     String(sentRequestId) === requestIdStr ||
                                                     sentRequestId === giftData.request_id || 
                                                     sentRequestId === giftData.transaction_id ||
                                                     String(sentRequestId) === String(giftData.request_id) ||
                                                     String(sentRequestId) === String(giftData.transaction_id);
                                            } catch (e) {
                                              return false;
                                            }
                                          }
                                          
                                          // También verificar por texto del mensaje que contenga el nombre del regalo
                                          if (m.type === 'gift_sent' && m.user_id === userData?.id) {
                                            const msgText = m.text || m.message || '';
                                            const giftName = giftData.gift_name;
                                            if (giftName && msgText.includes(giftName)) {
                                              return true;
                                            }
                                          }
                                          
                                          return false;
                                        });
                                        
                                        const isDisabled = !handleAcceptGift || !hasEnoughBalance || isProcessing || giftAlreadyAccepted;
                                        
                                        // Si ya fue aceptado, no mostrar el botón
                                        if (giftAlreadyAccepted) {
                                          return (
                                            <div className="text-center py-2">
                                              <span className="text-green-400 text-sm font-medium">{getGiftCardText('giftSentCheck', currentLanguage)}</span>
                                            </div>
                                          );
                                        }
                                        
                                        return (
                                          <button
                                            onClick={async () => {
                                              if (typeof handleAcceptGift === 'function' && hasEnoughBalance && !isProcessing) {
                                                // Convertir requestId a número si es necesario
                                                const finalRequestId = typeof requestId === 'string' ? parseInt(requestId) : requestId;
                                                const securityHash = giftData.security_hash || null;
                                                
                                                // Validar que requestId sea válido
                                                if (!finalRequestId || isNaN(finalRequestId)) {
                                                  if (window.showNotification) {
                                                    window.showNotification('error', 'Error', 'ID de solicitud inválido. Intenta recargar la página.');
                                                  }
                                                  return;
                                                }
                                                
                                                // Marcar como procesando
                                                setProcessingGiftRequest(finalRequestId);
                                                
                                                // Llamar a handleAcceptGift
                                                try {
                                                  const result = await handleAcceptGift(finalRequestId, securityHash);
                                                  
                                                  // Si hay un error en el resultado
                                                  if (result && !result.success) {
                                                    // Si la solicitud ya fue procesada (404 o request_not_found), no mostrar error
                                                    // Puede ser doble click o procesado en otra pestaña
                                                    if (result.error === 'request_not_found' || 
                                                        result.error?.includes('procesada') || 
                                                        result.error?.includes('already processed')) {
                                                      console.log('ℹ️ [ACCEPT GIFT] Solicitud ya procesada, ignorando error');
                                                      // No mostrar error, solo recargar balance si es necesario
                                                      return; // Salir sin mostrar error
                                                    }
                                                    
                                                    let errorMessage = 'No se pudo aceptar el regalo.';
                                                    
                                                    if (result.error === 'invalid_request' || result.error?.includes('expirado') || result.error?.includes('expired')) {
                                                      errorMessage = 'Esta solicitud ya expiró.';
                                                    } else if (result.error === 'insufficient_balance') {
                                                      errorMessage = 'No tienes suficiente saldo para aceptar este regalo.';
                                                    } else if (result.error) {
                                                      errorMessage = result.error;
                                                    }
                                                    
                                                    if (window.showNotification) {
                                                      window.showNotification('error', 'Error', errorMessage);
                                                    }
                                                  }
                                                } catch (error) {
                                                  console.error('Error al aceptar regalo:', error);
                                                  
                                                  // Si es un 404, puede ser que la solicitud ya fue procesada
                                                  if (error.message?.includes('404') || error.status === 404) {
                                                    console.log('ℹ️ [ACCEPT GIFT] Error 404 - solicitud puede que ya fue procesada');
                                                    // No mostrar error, puede ser doble click o procesado en otra pestaña
                                                    return;
                                                  }
                                                  
                                                  let errorMessage = 'No se pudo aceptar el regalo. Intenta nuevamente.';
                                                  
                                                  // Manejar errores específicos
                                                  if (error.message?.includes('409') || error.status === 409) {
                                                    // 409 también puede indicar que ya fue procesada
                                                    console.log('ℹ️ [ACCEPT GIFT] Error 409 - solicitud ya procesada');
                                                    return; // No mostrar error
                                                  } else if (error.message?.includes('500') || error.status === 500) {
                                                    errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
                                                  } else if (error.message) {
                                                    errorMessage = error.message;
                                                  }
                                                  
                                                  if (window.showNotification) {
                                                    window.showNotification('error', 'Error', errorMessage);
                                                  }
                                                } finally {
                                                  // Limpiar estado de procesamiento después de un delay
                                                  setTimeout(() => {
                                                    setProcessingGiftRequest(null);
                                                  }, 2000);
                                                }
                                              } else if (!hasEnoughBalance) {
                                                // Mostrar notificación de saldo insuficiente
                                                if (window.showNotification) {
                                                  window.showNotification('error', 'Saldo insuficiente', `Necesitas ${giftPrice} ${getGiftCardText('minutes', currentLanguage)} para aceptar este regalo. Tu saldo actual: ${currentBalance}`);
                                                }
                                              }
                                            }}
                                            disabled={isDisabled}
                                            className={`
                                              w-full px-4 py-2.5 rounded-lg font-semibold text-sm
                                              transition-all duration-300 transform hover:scale-105 active:scale-95
                                              ${isDisabled
                                                ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-50'
                                                : 'bg-gradient-to-r from-[#ff007a] to-[#cc0062] text-white hover:from-[#ff007a]/90 hover:to-[#cc0062]/90 shadow-lg hover:shadow-xl active:shadow-lg'
                                              }
                                            `}
                                          >
                                            {isProcessing 
                                              ? 'Procesando...'
                                              : !hasEnoughBalance 
                                                ? `💰 Saldo insuficiente (${currentBalance}/${giftPrice})`
                                                : 'Regalar'
                                            }
                                          </button>
                                        );
                                      })()}
                                    </div>
                                    
                                    <div className="text-left">
                                      <span className="timestamp-text text-gray-500 font-medium">
                                        {new Date(msg.timestamp || msg.created_at).toLocaleTimeString('es-ES', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // 🔥 2. REGALO ENVIADO (viene del cliente - tú)
                        if (isGiftSentByClient || 
                            (isFromCurrentUser && (
                              (msg.text && msg.text.includes('Enviaste:')) ||
                              (msg.message && msg.message.includes('Enviaste:'))
                            ))) {
                          
                          return (
                            <div className="flex justify-end">
                              <div className="bg-gradient-to-br from-[#ff007a]/20 via-[#cc0062]/20 to-[#990047]/20 rounded-xl gift-card-sent border border-[#ff007a]/30 shadow-lg backdrop-blur-sm">                              
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-full gift-icon-container">
                                    <Gift size={16} className="text-white" />
                                  </div>
                                  <span className="text-blue-100 gift-title font-semibold">{getGiftCardText('giftSent', currentLanguage)}</span>
                                </div>
                                
                                <div className="mb-3 flex justify-center">
                                  <GiftImage
                                    imagePath={giftData.gift_image}
                                    messageId={msg.id}
                                    alt={giftData.gift_name}
                                    containerClassName="gift-image-container bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-blue-300/30"
                                  />
                                </div>
                                
                                <div className="text-center space-y-2">
                                  <p className="text-white font-bold gift-name-text">
                                    {getTranslatedGiftName(giftData.gift_name, currentLanguage, giftData.gift_name)}
                                  </p>
                                  
                                  <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-lg gift-price-container border border-blue-300/30">
                                    <span className="text-blue-200 font-bold gift-price-text">
                                      💰 {giftData.gift_price} {getGiftCardText('minutes', currentLanguage)}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* 🔥 TIMESTAMP DEL MENSAJE */}
                                <div className="text-right mt-3">
                                  <span className="timestamp-text text-gray-500 font-medium">
                                    {new Date(msg.timestamp || msg.created_at).toLocaleTimeString('es-ES', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // 🔥 3. REGALO RECIBIDO (raro, pero posible)
                        if (isGiftReceivedByModel || 
                            (!isFromCurrentUser && (
                              (msg.text && msg.text.includes('Recibiste:')) ||
                              (msg.message && msg.message.includes('Recibiste:'))
                            ))) {
                          
                          return (
                            <div className="flex justify-start">
                              <div className="bg-gradient-to-br from-green-900/40 via-emerald-900/40 to-teal-900/40 rounded-xl gift-card-received border border-green-300/30 shadow-lg backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full gift-icon-container">
                                    <Gift size={16} className="text-white" />
                                  </div>
                                  <span className="text-green-100 gift-title font-semibold">{getGiftCardText('giftReceived', currentLanguage)}</span>
                                </div>
                                
                                <div className="mb-3 flex justify-center">
                                  <GiftImage
                                    imagePath={giftData.gift_image}
                                    messageId={msg.id}
                                    alt={giftData.gift_name}
                                    containerClassName="gift-image-container bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-green-300/30"
                                  />
                                </div>
                                
                                <div className="text-center space-y-2">
                                  <p className="text-white font-bold gift-name-text">
                                    {getTranslatedGiftName(giftData.gift_name, currentLanguage, giftData.gift_name)}
                                  </p>
                                  
                                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg gift-price-container border border-green-300/30">
                                    <span className="text-green-200 font-bold gift-price-text">
                                      💰 {giftData.gift_price} {getGiftCardText('minutes', currentLanguage)}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* 🔥 TIMESTAMP DEL MENSAJE */}
                                <div className="text-left mt-3">
                                  <span className="timestamp-text text-gray-500 font-medium">
                                    {new Date(msg.timestamp || msg.created_at).toLocaleTimeString('es-ES', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // 🔥 4. REGALO RECHAZADO
                        if (isRejectedByClient || 
                            (isFromCurrentUser && (
                              (msg.text && msg.text.includes('Rechazaste')) ||
                              (msg.message && msg.message.includes('Rechazaste'))
                            ))) {
                          
                          return (
                            <div className="flex justify-end">
                              <div className="bg-gradient-to-br from-red-900/40 via-red-800/40 to-red-900/40 rounded-xl gift-card-rejected border border-red-400/30 shadow-lg backdrop-blur-sm">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-full gift-icon-container">
                                    <Gift size={14} className="text-white" />
                                  </div>
                                  <span className="text-red-100 gift-title font-semibold">❌ Regalo rechazado</span>
                                </div>
                                
                                {/* 🔥 TIMESTAMP DEL MENSAJE */}
                                <div className="text-right mt-2">
                                  <span className="timestamp-text text-gray-500 font-medium">
                                    {new Date(msg.timestamp || msg.created_at).toLocaleTimeString('es-ES', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // 🔥 5. FALLBACK PARA OTROS TIPOS DE REGALO - ELIMINADO (no mostrar nada)
                        return null;
                      })()}
                    
                    {/* 🔥 MENSAJES NORMALES REDISEÑADOS */}
                    {!isGift && (
                      <div className={`flex ${msg.type === 'local' ? 'justify-end' : 'justify-start'} group`}>
                        {msg.type === 'local' ? (
                          <div className="w-full space-y-2">
                            <div className="text-right">
                              <span className="username-text text-gray-400 font-medium">Tú</span>
                            </div>
                            <div className="flex justify-end">
                              <div className="relative bg-gradient-to-br from-[#ff007a] to-[#ff007a]/80 message-bubble-own text-white shadow-lg border border-[#ff007a]/20 hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
                                <span className="text-white message-text leading-relaxed font-medium break-words">
                                  {msg.type === 'emoji' ? (
                                    <div className="emoji-text">{renderMessageWithTranslation(msg, msg.type === 'local')}</div>
                                  ) : (
                                    <span className="text-white">{renderMessageWithTranslation(msg, msg.type === 'local')}</span>
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="timestamp-text text-gray-500 font-medium">
                                {new Date(msg.timestamp || msg.created_at).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        ) : msg.type === 'system' ? (
                          <div className="w-full flex justify-center">
                            <div className="bg-gradient-to-r from-[#00ff66]/10 to-[#00ff66]/5 border border-[#00ff66]/30 message-bubble-system backdrop-blur-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="system-indicator bg-[#00ff66] rounded-full animate-pulse"></div>
                                <span className="text-[#00ff66] username-text font-semibold">🎰 Sistema</span>
                              </div>
                              <p className="text-[#00ff66] message-text leading-relaxed">
                                <span className="text-[#00ff66]">
                                    {renderMessageWithTranslation(msg, false)}
                                </span>
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="message-bubble-max space-y-2">
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <div className="message-avatar bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-full flex items-center justify-center">
                                  <span className="text-white avatar-text font-bold">
                                    {otherUser?.name?.charAt(0)?.toUpperCase() || 'M'}
                                  </span>
                                </div>
                                <span className="username-text text-[#ff007a] font-medium">
                                  {msg.senderRole === 'modelo' ? safeGetDisplayName() : 'Usuario'}
                                </span>
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-gray-800/90 to-slate-800/90 message-bubble-other text-white shadow-lg border border-gray-600/30 backdrop-blur-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-200" style={{ maxWidth: '250px', width: 'fit-content', wordBreak: 'break-word', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
                              <span className="text-gray-100 message-text leading-relaxed break-words inline-block" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
                                {msg.type === 'emoji' ? (
                                  <div className="emoji-text">{renderMessageWithTranslation(msg, false)}</div>
                                ) : (
                                  <span className="text-white">{renderMessageWithTranslation(msg, false)}</span>
                                )}
                              </span>
                            </div>
                            <div className="text-left">
                              <span className="timestamp-text text-gray-500 font-medium">
                                {new Date(msg.timestamp || msg.created_at).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
                {/* Elemento invisible para hacer scroll automático */}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
        
        {/* 🔥 INPUT DE CHAT REDISEÑADO PARA CLIENTE */}
        <div className="relative border-t border-gray-700/50 input-section">
          <div className="relative space-y-4">
            {/* Input principal - COMPLETAMENTE EXPANDIDO */}
            <div className="flex items-end gap-2">
              
              {/* Input que ocupa TODO el espacio disponible */}
              <div className="flex-1 min-w-0 relative">
                {isOtherTyping && (
                  <div className="absolute -top-5 left-2 text-xs text-[#ff007a] italic">
                    {t('chat.typing') || 'Escribiendo...'}
                  </div>
                )}
                <input
                  value={mensaje}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={texts.writeMessage}
                  maxLength={200}
                  className="
                    w-full bg-gradient-to-r from-gray-800/60 to-slate-800/60 backdrop-blur-sm 
                    message-input rounded-xl outline-none text-white
                    border border-gray-600/30 focus:border-[#ff007a]/50 
                    transition-all duration-300 focus:bg-gray-800/80
                    placeholder-gray-400 focus:placeholder-gray-300
                    shadow-lg focus:shadow-xl focus:shadow-[#ff007a]/10
                  "
                />
                
                {/* Contador de caracteres */}
                {mensaje.length > 150 && (
                  <div className="absolute char-counter">
                    <div className={`counter-badge backdrop-blur-sm font-medium border ${
                      mensaje.length > 190 
                        ? 'bg-red-500/20 text-red-300 border-red-400/30' 
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                    }`}>
                      {mensaje.length}/200
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowGiftsModal(true)}
                disabled={!otherUser || !userBalance || userBalance <= 0}
                className={`
                  relative button-container rounded-lg transition-all duration-300 hover:scale-110 group overflow-hidden
                  ${!otherUser || !userBalance || userBalance <= 0
                    ? 'bg-gray-800/50 text-gray-500 opacity-50 cursor-not-allowed' 
                    : 'bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30 border border-[#ff007a]/30 shadow-lg'
                  }
                `}
                title={!userBalance || userBalance <= 0 ? "Necesitas minutos para enviar regalos" : "Enviar regalo"}
              >
                <Gift size={18} />
              </button>
              
              
              <EmojiPickerButton
                onSelect={(emoji) => setMensaje((prev) => prev + emoji)}
                buttonClassName="px-3 py-2"
                buttonSize={14}
              />
              
              {/* Botón enviar */}
              <button
                onClick={enviarMensaje}
                disabled={!mensaje.trim()}
                className={`
                  flex-shrink-0 relative input-button rounded-lg transition-all duration-300 group overflow-hidden
                  ${mensaje.trim() 
                    ? 'bg-gradient-to-r from-[#ff007a] to-[#ff007a]/80 text-white hover:from-[#ff007a] hover:to-[#ff007a] hover:scale-105 shadow-lg shadow-[#ff007a]/30' 
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <Send size={14} className={mensaje.trim() ? 'group-hover:translate-x-0.5 transition-transform duration-200' : ''} />
              </button>

              {/* Indicador de conexión movido aquí */}
            </div>
          </div>
        </div>
        {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-xl border border-[#ff007a]/30 shadow-2xl w-72 max-h-[75vh] overflow-hidden">
            <div className="flex items-center justify-between p-2.5 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#ff007a]/20 rounded-lg border border-[#ff007a]/30">
                  <Settings size={14} className="text-[#ff007a]" />
                </div>
                <h2 className="text-sm font-bold text-white">Traductor</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-2.5 overflow-y-auto max-h-[calc(75vh-80px)]">
              <div className="mb-2.5 p-2 bg-amber-500/10 border border-amber-400/30 rounded-lg">
                <div className="flex items-start gap-1.5">
                  <div className="w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-white font-bold">!</span>
                  </div>
                  <div>
                    <h4 className="text-amber-300 font-semibold text-xs mb-0.5">Solo para esta conversación</h4>
                    <p className="text-amber-200/80 text-xs leading-tight">
                      Para traducción permanente: 
                      <span className="font-semibold text-amber-100"> Configuración → Idiomas</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe size={12} className="text-[#ff007a]" />
                  <h3 className="text-xs font-semibold text-white">Cambiar Idioma</h3>
                </div>

                <div className="mb-2.5 p-2 bg-gray-800/50 rounded-lg border border-gray-600/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">Actual:</span>
                    <div className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30">
                      {languages.find(l => l.code === currentLanguage)?.name || 'Español'}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto custom-scroll">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`
                        w-full flex items-center gap-1 p-1.5 rounded-lg transition-all duration-200
                        hover:bg-[#ff007a]/10 hover:border-[#ff007a]/30 border text-left
                        ${currentLanguage === lang.code 
                          ? 'bg-[#ff007a]/20 border-[#ff007a]/50 text-white' 
                          : 'bg-gray-800/50 border-gray-600/30 text-gray-300 hover:text-white'
                        }
                      `}
                    >
                      <span className="text-xs">{lang.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{lang.name}</p>
                      </div>
                      {currentLanguage === lang.code && (
                        <div className="w-1 h-1 bg-[#ff007a] rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2 bg-blue-500/10 border border-blue-400/30 rounded-lg">
                <div className="flex items-start gap-1.5">
                  <Settings size={10} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-blue-300 font-semibold text-xs mb-0.5">Configuración Permanente</h4>
                    <p className="text-blue-200/80 text-xs leading-tight">
                      Menú → Configuración → Idiomas
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 border-t border-gray-700/50 bg-gray-900/50">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Temporal
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-2.5 py-1 bg-[#ff007a] text-white text-xs font-medium rounded-lg hover:bg-[#ff007a]/90 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
        )}
                
        {/* 🔥 ESTILOS PARA SCROLL PERSONALIZADO */}
        <style jsx>{`
          .custom-scroll {
            scroll-behavior: smooth;
          }
          
          .custom-scroll::-webkit-scrollbar {
            width: 8px;
          }
          
          .custom-scroll::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            margin: 8px 0;
          }
          
          .custom-scroll::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, #ff007a, #ff007a);
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          .custom-scroll::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, #e6006d, #e6006d);
          }
        `}</style>
      </div>

      {/* 🔥 MEDIA QUERIES RESPONSIVAS PARA TODAS LAS PANTALLAS */}
      <style jsx>{`
        /* 🔥 RESPONSIVE DESIGN - TODAS LAS PANTALLAS */
        
        /* Pantallas Extra Grandes (2560px+) - 4K */
        @media (min-width: 2560px) {
          .chat-panel-responsive {
            width: 380px;
            min-width: 380px;
            max-width: 380px;
          }
          .messages-container {
            max-height: 500px;
          }
          .avatar-size {
            width: 48px;
            height: 48px;
          }
          .header-text {
            font-size: 1.125rem;
          }
          .message-text {
            font-size: 0.95rem;
          }
          .gift-name-text {
            font-size: 1.125rem;
          }
          .empty-icon {
            width: 80px;
            height: 80px;
          }
          .empty-title {
            font-size: 1.25rem;
          }
          .empty-text {
            font-size: 1rem;
          }
        }

        /* Pantallas Grandes (1920px-2559px) - Full HD */
        @media (min-width: 1920px) and (max-width: 2559px) {
          .chat-panel-responsive {
            width: 350px;
            min-width: 350px;
            max-width: 350px;
          }
          .messages-container {
            max-height: 450px;
          }
          .avatar-size {
            width: 44px;
            height: 44px;
          }
          .header-text {
            font-size: 1.0625rem;
          }
          .message-text {
            font-size: 0.9rem;
          }
          .gift-name-text {
            font-size: 1.0625rem;
          }
          .empty-icon {
            width: 72px;
            height: 72px;
          }
          .empty-title {
            font-size: 1.125rem;
          }
          .empty-text {
            font-size: 0.95rem;
          }
        }

        /* Pantallas Desktop Estándar (1440px-1919px) - QHD */
        @media (min-width: 1440px) and (max-width: 1919px) {
          .chat-panel-responsive {
            width: 280px;
            min-width: 240px;
            max-width: 280px;
          }
          .avatar-size {
            width: 40px;
            height: 40px;
          }
          .header-text {
            font-size: 1rem;
          }
          .message-text {
            font-size: 0.875rem;
          }
          .gift-name-text {
            font-size: 1rem;
          }
          .empty-icon {
            width: 64px;
            height: 64px;
          }
          .empty-title {
            font-size: 1.0625rem;
          }
          .empty-text {
            font-size: 0.875rem;
          }
        }

        /* Pantallas Medianas (1200px-1439px) - HD+ */
        @media (min-width: 1200px) and (max-width: 1439px) {
          .chat-panel-responsive {
            width: 300px;
            min-width: 300px;
            max-width: 300px;
          }
          .messages-container {
            max-height: 350px;
          }
          .avatar-size {
            width: 36px;
            height: 36px;
          }
          .header-text {
            font-size: 0.9375rem;
          }
          .message-text {
            font-size: 0.8125rem;
          }
          .gift-name-text {
            font-size: 0.9375rem;
          }
          .empty-icon {
            width: 56px;
            height: 56px;
          }
          .empty-title {
            font-size: 1rem;
          }
          .empty-text {
            font-size: 0.8125rem;
          }
        }

        /* Pantallas Pequeñas Desktop/Laptop (1024px-1199px) - HD */
        @media (min-width: 1024px) and (max-width: 1199px) {
          .chat-panel-responsive {
            width: 280px;
            min-width: 280px;
            max-width: 280px;
          }
          .messages-container {
            max-height: 320px;
          }
          .avatar-size {
            width: 32px;
            height: 32px;
          }
          .header-text {
            font-size: 0.875rem;
          }
          .message-text {
            font-size: 0.75rem;
          }
          .gift-name-text {
            font-size: 0.875rem;
          }
          .empty-icon {
            width: 48px;
            height: 48px;
          }
          .empty-title {
            font-size: 0.9375rem;
          }
          .empty-text {
            font-size: 0.75rem;
          }
        }

        /* Pantallas Muy Pequeñas Desktop (900px-1023px) */
        @media (min-width: 900px) and (max-width: 1023px) {
          .chat-panel-responsive {
            width: 260px;
            min-width: 260px;
            max-width: 260px;
          }
          .messages-container {
            max-height: 300px;
          }
          .avatar-size {
            width: 28px;
            height: 28px;
          }
          .header-text {
            font-size: 0.8125rem;
          }
          .message-text {
            font-size: 0.6875rem;
          }
          .gift-name-text {
            font-size: 0.8125rem;
          }
          .empty-icon {
            width: 40px;
            height: 40px;
          }
          .empty-title {
            font-size: 0.875rem;
          }
          .empty-text {
            font-size: 0.6875rem;
          }
        }

        /* Pantallas Tablet/Desktop Mini (768px-899px) */
        @media (min-width: 768px) and (max-width: 899px) {
          .chat-panel-responsive {
            width: 240px;
            min-width: 240px;
            max-width: 240px;
          }
          .messages-container {
            max-height: 280px;
          }
          .avatar-size {
            width: 24px;
            height: 24px;
          }
          .header-text {
            font-size: 0.75rem;
          }
          .message-text {
            font-size: 0.625rem;
          }
          .gift-name-text {
            font-size: 0.75rem;
          }
          .empty-icon {
            width: 36px;
            height: 36px;
          }
          .empty-title {
            font-size: 0.8125rem;
          }
          .empty-text {
            font-size: 0.625rem;
          }
        }

        /* 🔥 ELEMENTOS ESPECÍFICOS RESPONSIVOS */
        
        /* Avatar en mensajes */
        .message-avatar {
          width: 24px;
          height: 24px;
        }
        @media (min-width: 1200px) {
          .message-avatar {
            width: 28px;
            height: 28px;
          }
        }
        @media (min-width: 1920px) {
          .message-avatar {
            width: 32px;
            height: 32px;
          }
        }

        /* Texto de avatars */
        .avatar-text {
          font-size: 0.625rem;
        }
        @media (min-width: 1200px) {
          .avatar-text {
            font-size: 0.75rem;
          }
        }
        @media (min-width: 1920px) {
          .avatar-text {
            font-size: 0.875rem;
          }
        }

        /* Usernames */
        .username-text {
          font-size: 0.6875rem;
        }
        @media (min-width: 1200px) {
          .username-text {
            font-size: 0.75rem;
          }
        }
        @media (min-width: 1920px) {
          .username-text {
            font-size: 0.8125rem;
          }
        }

        /* Timestamps */
        .timestamp-text {
          font-size: 0.625rem;
        }
        @media (min-width: 1200px) {
          .timestamp-text {
            font-size: 0.6875rem;
          }
        }
        @media (min-width: 1920px) {
          .timestamp-text {
            font-size: 0.75rem;
          }
        }

        /* Loading indicator */
        .loading-size {
          width: 14px;
          height: 14px;
        }
        @media (min-width: 1200px) {
          .loading-size {
            width: 16px;
            height: 16px;
          }
        }
        @media (min-width: 1920px) {
          .loading-size {
            width: 18px;
            height: 18px;
          }
        }

        /* Botones del header */
        .button-container {
          padding: 6px;
        }
        @media (min-width: 1200px) {
          .button-container {
            padding: 8px;
          }
        }
        @media (min-width: 1920px) {
          .button-container {
            padding: 10px;
          }
        }

        /* Input section */
        .input-section {
          padding: 10px;
        }
        @media (min-width: 1200px) {
          .input-section {
            padding: 12px;
          }
        }
        @media (min-width: 1920px) {
          .input-section {
            padding: 16px;
          }
        }

        /* Message input */
        .message-input {
          padding: 8px 12px;
          font-size: 0.75rem;
        }
        @media (min-width: 1200px) {
          .message-input {
            padding: 10px 14px;
            font-size: 0.8125rem;
          }
        }
        @media (min-width: 1920px) {
          .message-input {
            padding: 12px 16px;
            font-size: 0.875rem;
          }
        }

        /* Input buttons */
        .input-button {
          padding: 8px;
        }
        @media (min-width: 1200px) {
          .input-button {
            padding: 10px;
          }
        }
        @media (min-width: 1920px) {
          .input-button {
            padding: 12px;
          }
        }

        /* Character counter */
        .char-counter {
          top: -32px;
          right: 8px;
        }
        @media (min-width: 1200px) {
          .char-counter {
            top: -36px;
            right: 10px;
          }
        }
        @media (min-width: 1920px) {
          .char-counter {
            top: -40px;
            right: 12px;
          }
        }

        .counter-badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.625rem;
        }
        @media (min-width: 1200px) {
          .counter-badge {
            padding: 5px 10px;
            border-radius: 8px;
            font-size: 0.6875rem;
          }
        }
        @media (min-width: 1920px) {
          .counter-badge {
            padding: 6px 12px;
            border-radius: 10px;
            font-size: 0.75rem;
          }
        }

        /* Connection indicator */
        .connection-indicator {
          padding: 4px 8px;
        }
        @media (min-width: 1200px) {
          .connection-indicator {
            padding: 5px 10px;
          }
        }
        @media (min-width: 1920px) {
          .connection-indicator {
            padding: 6px 12px;
          }
        }

        .connection-dot {
          width: 6px;
          height: 6px;
        }
        @media (min-width: 1200px) {
          .connection-dot {
            width: 7px;
            height: 7px;
          }
        }
        @media (min-width: 1920px) {
          .connection-dot {
            width: 8px;
            height: 8px;
          }
        }

        .connection-text {
          font-size: 0.625rem;
          max-width: 50px;
        }
        @media (min-width: 1200px) {
          .connection-text {
            font-size: 0.6875rem;
            max-width: 60px;
          }
        }
        @media (min-width: 1920px) {
          .connection-text {
            font-size: 0.75rem;
            max-width: 70px;
          }
        }

        .system-indicator {
          width: 6px;
          height: 6px;
        }
        @media (min-width: 1200px) {
          .system-indicator {
            width: 8px;
            height: 8px;
          }
        }
        @media (min-width: 1920px) {
          .system-indicator {
            width: 10px;
            height: 10px;
          }
        }

        /* Message bubbles */
        .message-bubble-own {
          padding: 10px 14px;
          border-radius: 16px;
          border-bottom-right-radius: 4px;
          max-width: 70%;
        }
        @media (min-width: 1200px) {
          .message-bubble-own {
            padding: 12px 16px;
            border-radius: 18px;
            border-bottom-right-radius: 5px;
          }
        }
        @media (min-width: 1920px) {
          .message-bubble-own {
            padding: 14px 18px;
            border-radius: 20px;
            border-bottom-right-radius: 6px;
          }
        }

        .message-bubble-other {
          padding: 10px 14px;
          border-radius: 16px;
          border-bottom-left-radius: 4px;
        }
        @media (min-width: 1200px) {
          .message-bubble-other {
            padding: 12px 16px;
            border-radius: 18px;
            border-bottom-left-radius: 5px;
          }
        }
        @media (min-width: 1920px) {
          .message-bubble-other {
            padding: 14px 18px;
            border-radius: 20px;
            border-bottom-left-radius: 6px;
          }
        }

        .message-bubble-max {
          max-width: 70%;
        }
        @media (min-width: 1200px) {
          .message-bubble-max {
            max-width: 75%;
          }
        }
        @media (min-width: 1920px) {
          .message-bubble-max {
            max-width: 80%;
          }
        }

        .message-bubble-system {
          padding: 10px 14px;
          border-radius: 16px;
          max-width: 90%;
        }
        @media (min-width: 1200px) {
          .message-bubble-system {
            padding: 12px 16px;
            border-radius: 18px;
            max-width: 85%;
          }
        }
        @media (min-width: 1920px) {
          .message-bubble-system {
            padding: 14px 18px;
            border-radius: 20px;
            max-width: 80%;
          }
        }

        /* Emoji text */
        .emoji-text {
          font-size: 1.5rem;
        }
        @media (min-width: 1200px) {
          .emoji-text {
            font-size: 1.75rem;
          }
        }
        @media (min-width: 1920px) {
          .emoji-text {
            font-size: 2rem;
          }
        }

        /* Gift cards */
        .gift-card-request {
          padding: 12px;
          width: 70%;
        }
        @media (min-width: 1200px) {
          .gift-card-request {
            padding: 14px;
            width: 75%;
          }
        }
        @media (min-width: 1920px) {
          .gift-card-request {
            padding: 16px;
            width: 80%;
          }
        }

        .gift-card-sent {
          padding: 12px;
          width: 70%;
        }
        @media (min-width: 1200px) {
          .gift-card-sent {
            padding: 14px;
            width: 75%;
          }
        }
        @media (min-width: 1920px) {
          .gift-card-sent {
            padding: 16px;
            width: 80%;
          }
        }

        .gift-card-received {
          padding: 10px;
          max-width: 240px;
        }
        @media (min-width: 1200px) {
          .gift-card-received {
            padding: 12px;
            max-width: 260px;
          }
        }
        @media (min-width: 1920px) {
          .gift-card-received {
            padding: 14px;
            max-width: 280px;
          }
        }

        .gift-card-rejected {
          padding: 8px;
          max-width: 200px;
        }
        @media (min-width: 1200px) {
          .gift-card-rejected {
            padding: 10px;
            max-width: 220px;
          }
        }
        @media (min-width: 1920px) {
          .gift-card-rejected {
            padding: 12px;
            max-width: 240px;
          }
        }

        .gift-card-fallback {
          padding: 12px;
          max-width: 240px;
        }
        @media (min-width: 1200px) {
          .gift-card-fallback {
            padding: 14px;
            max-width: 260px;
          }
        }
        @media (min-width: 1920px) {
          .gift-card-fallback {
            padding: 16px;
            max-width: 280px;
          }
        }

        /* Gift elements */
        .gift-icon-container {
          padding: 6px;
        }
        @media (min-width: 1200px) {
          .gift-icon-container {
            padding: 7px;
          }
        }
        @media (min-width: 1920px) {
          .gift-icon-container {
            padding: 8px;
          }
        }

        .gift-title {
          font-size: 0.75rem;
        }
        @media (min-width: 1200px) {
          .gift-title {
            font-size: 0.8125rem;
          }
        }
        @media (min-width: 1920px) {
          .gift-title {
            font-size: 0.875rem;
          }
        }

        .gift-image-container {
          width: 48px;
          height: 48px;
        }
        @media (min-width: 1200px) {
          .gift-image-container {
            width: 56px;
            height: 56px;
          }
        }
        @media (min-width: 1920px) {
          .gift-image-container {
            width: 64px;
            height: 64px;
          }
        }

        .gift-image {
          width: 36px;
          height: 36px;
        }
        @media (min-width: 1200px) {
          .gift-image {
            width: 42px;
            height: 42px;
          }
        }
        @media (min-width: 1920px) {
          .gift-image {
            width: 48px;
            height: 48px;
          }
        }

        .gift-fallback-icon {
          width: 36px;
          height: 36px;
        }
        @media (min-width: 1200px) {
          .gift-fallback-icon {
            width: 42px;
            height: 42px;
          }
        }
        @media (min-width: 1920px) {
          .gift-fallback-icon {
            width: 48px;
            height: 48px;
          }
        }

        .gift-price-container {
          padding: 4px 10px;
        }
        @media (min-width: 1200px) {
          .gift-price-container {
            padding: 5px 12px;
          }
        }
        @media (min-width: 1920px) {
          .gift-price-container {
            padding: 6px 14px;
          }
        }

        .gift-price-text {
          font-size: 0.75rem;
        }
        @media (min-width: 1200px) {
          .gift-price-text {
            font-size: 0.8125rem;
          }
        }
        @media (min-width: 1920px) {
          .gift-price-text {
            font-size: 0.875rem;
          }
        }

        /* 🔥 BREAKPOINTS ESPECIALES PARA PANTALLAS ULTRAWIDE */
        @media (min-width: 3440px) {
          .chat-panel-responsive {
            width: 420px;
            min-width: 420px;
            max-width: 420px;
          }
          .messages-container {
            max-height: 600px;
          }
          .header-text {
            font-size: 1.25rem;
          }
          .message-text {
            font-size: 1rem;
          }
          .gift-name-text {
            font-size: 1.25rem;
          }
        }

        /* 🔥 AJUSTES PARA PANTALLAS CON POCO ESPACIO VERTICAL */
        @media (max-height: 800px) {
          .messages-container {
            max-height: 250px !important;
          }
        }
        @media (max-height: 600px) {
          .messages-container {
            max-height: 200px !important;
          }
        }

        /* 🔥 OPTIMIZACIÓN PARA PANTALLAS CON ZOOM */
        @media (resolution: 2dppx) {
          .chat-panel-responsive {
            border-width: 0.5px;
          }
          .message-input {
            border-width: 0.5px;
          }
        }
      `}</style>
    </>
  );
};

export default DesktopChatPanelClient;