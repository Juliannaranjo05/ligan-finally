import React, { useEffect, useRef, useMemo, useCallback, useState  } from 'react';
import { Star, UserX, Gift, Send, Smile, Shield, Crown, MessageCircle,Globe, Settings, X  } from 'lucide-react';
import { useGlobalTranslation } from '../../../contexts/GlobalTranslationContext';

const DesktopChatPanelClient = ({
  getDisplayName,
  isDetectingUser,
  toggleFavorite,
  blockCurrentUser,
  isFavorite,
  isAddingFavorite,
  isBlocking,
  otherUser,
  setShowGiftsModal,
  messages,
  mensaje,
  setMensaje,
  enviarMensaje,
  handleKeyPress,
  userData,
  userBalance,
  handleAcceptGift,
  handleRejectGift,
  t
}) => {

  // Ref para el contenedor de mensajes
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const processedMessageIds = useRef(new Set());

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
      
      return translations[cleanText] || `[EN] ${text}`;
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
      console.warn('❌ No se pudo cambiar idioma en contexto global:', error);
    }
  }
  
  setTranslations(new Map());
  setTranslatingIds(new Set());
  setShowSettingsModal(false);
};

  const [stableMessages, setStableMessages] = useState([]);
  // 🎵 FUNCIONES DE SONIDO PARA SOLICITUDES DE REGALO (CLIENTE)
  const playGiftRequestSound = useCallback(async () => {
    try {
      console.log('🔔 [CLIENT] Reproduciendo sonido de solicitud de regalo...');
      
      const audio = new Audio('/sounds/gift-request.mp3');
      audio.volume = 0.6;
      audio.preload = 'auto';
      
      try {
        await audio.play();
        console.log('🎵 [CLIENT] Sonido de solicitud reproducido');
      } catch (playError) {
        console.error('❌ Error reproduciendo sonido:', playError);
        playAlternativeRequestSound();
      }
    } catch (error) {
      console.error('❌ Error general con audio:', error);
      playAlternativeRequestSound();
    }
  }, []);

  const playAlternativeRequestSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      const playNote = (frequency, startTime, duration) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Melodía de solicitud: Sol-La-Si (ascendente)
      const now = audioContext.currentTime;
      playNote(392.00, now, 0.2);        // Sol
      playNote(440.00, now + 0.15, 0.2); // La  
      playNote(493.88, now + 0.3, 0.3);  // Si
      
      console.log('🎵 [CLIENT] Sonido alternativo de solicitud reproducido');
    } catch (error) {
      console.error('❌ Error con sonido alternativo:', error);
    }
  }, []);

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
    console.log('🔄 [STABLE] Actualizando mensajes estables', {
      before: stableMessages.length,
      after: messages.length,
      changed: true
    });

    // Procesar mensajes
    const seenIds = new Set();
    const uniqueMessages = messages.filter(msg => {
      if (seenIds.has(msg.id)) {
        return false;
      }
      seenIds.add(msg.id);
      return true;
    });

    // 🔥 ORDENAMIENTO CRONOLÓGICO CORRECTO
    const sortedMessages = uniqueMessages.slice().sort((a, b) => {
      // Usar created_at o timestamp como fuente principal de ordenamiento
      const timeA = new Date(a.created_at || a.timestamp).getTime();
      const timeB = new Date(b.created_at || b.timestamp).getTime();
      
      // 🔥 ORDEN ASCENDENTE: los más antiguos primero
      if (timeA !== timeB) {
        return timeA - timeB; // ← CAMBIO CLAVE: timeA - timeB (no timeB - timeA)
      }
      
      // Si tienen el mismo timestamp, usar ID como desempate
      const idA = typeof a.id === 'string' ? parseInt(a.id) : a.id;
      const idB = typeof b.id === 'string' ? parseInt(b.id) : b.id;
      return idA - idB; // ← ORDEN ASCENDENTE por ID también
    });

    console.log('📅 [SORT] Mensajes ordenados cronológicamente:', {
      total: sortedMessages.length,
      first: sortedMessages[0] ? {
        id: sortedMessages[0].id,
        type: sortedMessages[0].type,
        time: sortedMessages[0].created_at || sortedMessages[0].timestamp
      } : null,
      last: sortedMessages[sortedMessages.length - 1] ? {
        id: sortedMessages[sortedMessages.length - 1].id,
        type: sortedMessages[sortedMessages.length - 1].type,
        time: sortedMessages[sortedMessages.length - 1].created_at || sortedMessages[sortedMessages.length - 1].timestamp
      } : null
    });

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
        console.log('🎁 [DESKTOP] ¡Nueva solicitud de regalo detectada!', newGiftRequests);
        
        // Reproducir sonido para cada solicitud nueva
        newGiftRequests.forEach(async (giftMsg, index) => {
          try {
            // Pequeño delay entre regalos para no saturar
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Reproducir sonido
            await playGiftRequestSound();
            
            // Vibrar en dispositivos móviles
            if ('vibrate' in navigator) {
              navigator.vibrate([300, 100, 300]);
            }
            
            // Notificación visual
            if (Notification.permission === 'granted') {
              const giftData = parseGiftData(giftMsg);
              new Notification('💝 Solicitud de Regalo', {
                body: `¡${otherUser?.name || 'Una modelo'} te pide: ${giftData.gift_name}!`,
                icon: '/favicon.ico',
                tag: 'gift-request',
                requireInteraction: true
              });
            }
          } catch (error) {
            console.error('❌ Error procesando sonido de solicitud:', error);
          }
        });
      }
    }

    setStableMessages(sortedMessages);
  } else {
    console.log('⏸️ [STABLE] Mensajes sin cambios - no re-render');
  }
}, [messages, playGiftRequestSound, userData?.id, otherUser?.name]);

// 🔥 TAMBIÉN AGREGAR ESTE DEBUG PARA VER EL ORDEN REAL
useEffect(() => {
  if (stableMessages.length > 0) {
    console.log('📋 [DEBUG] Orden actual de mensajes:');
    stableMessages.forEach((msg, index) => {
      console.log(`${index + 1}. ID:${msg.id} | Tipo:${msg.type} | Tiempo:${msg.created_at || msg.timestamp}`);
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
      console.error('❌ Error parseando extra_data:', e);
    }
  }
  
  // Fallback a gift_data
  if (!giftData.gift_name && msg.gift_data) {
    try {
      if (typeof msg.gift_data === 'string') {
        const parsed = JSON.parse(msg.gift_data);
        giftData = { ...giftData, ...parsed };
      } else if (typeof msg.gift_data === 'object') {
        giftData = { ...giftData, ...msg.gift_data };
      }
    } catch (e) {
      console.error('❌ Error parseando gift_data:', e);
    }
  }
  
  // Extraer datos del texto si no hay JSON
  if (!giftData.gift_name && (msg.text || msg.message)) {
    const text = msg.text || msg.message;
    
    // Para solicitudes: "🎁 Solicitud de regalo: Nombre del Regalo"
    const requestMatch = text.match(/Solicitud de regalo:\s*(.+?)(?:\s*-|$)/);
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
  
  // Valores por defecto
  return {
    gift_name: giftData.gift_name || 'Regalo Especial',
    gift_price: giftData.gift_price || 10,
    gift_image: giftData.gift_image || null,
    request_id: giftData.request_id || msg.id,
    security_hash: giftData.security_hash || null,
    original_message: giftData.original_message || '',
    ...giftData
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

  // Función de fallback para getDisplayName
  const safeGetDisplayName = () => {
    if (typeof getDisplayName === 'function') {
      try {
        return getDisplayName();
      } catch (error) {
        console.warn('Error calling getDisplayName:', error);
      }
    }
    
    // Fallback manual
    if (otherUser?.name) {
      return otherUser.name;
    }
    
    return isDetectingUser ? 'Detectando...' : 'Esperando modelo...';
  };

  const buildCompleteImageUrl = (imagePath) => {
      if (!imagePath) {
          console.log('⚠️ No hay imagen para el regalo');
          return null;
      }
      
      // Si ya es una URL completa
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
          console.log('✅ URL completa encontrada:', imagePath);
          return imagePath;
      }
      
      const baseUrl = import.meta.env.VITE_API_BASE_URL;
      const cleanBaseUrl = baseUrl.replace(/\/$/, '');
      
      // Limpiar backslashes de Windows
      const cleanPath = imagePath.replace(/\\/g, '/');
      
      let finalUrl;
      
      if (cleanPath.startsWith('storage/')) {
          // storage/gifts/image.png -> http://domain.com/storage/gifts/image.png
          finalUrl = `${cleanBaseUrl}/${cleanPath}`;
      } else if (cleanPath.startsWith('/')) {
          // /storage/gifts/image.png -> http://domain.com/storage/gifts/image.png
          finalUrl = `${cleanBaseUrl}${cleanPath}`;
      } else {
          // image.png -> http://domain.com/storage/gifts/image.png
          finalUrl = `${cleanBaseUrl}/storage/gifts/${cleanPath}`;
      }
      
      console.log('🖼️ URL construida:', {
          original: imagePath,
          cleaned: cleanPath,
          final: finalUrl
      });
      
      return finalUrl;
  };

  return (
    <>
      {/* 🔥 CONTENEDOR PRINCIPAL CON MEDIA QUERIES RESPONSIVAS */}
      <div className="chat-panel-responsive bg-gradient-to-b from-[#0a0d10] to-[#131418] backdrop-blur-xl rounded-2xl flex flex-col justify-between relative border border-[#ff007a]/20 shadow-2xl overflow-hidden">
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
              <button
                onClick={() => setShowSettingsModal(true)}
                className="
                  relative button-container rounded-lg transition-all duration-300 hover:scale-110 group overflow-hidden
                  bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30 border border-[#ff007a]/30 shadow-lg
                "
                title="Configuración"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {/* 🔥 ÁREA DE MENSAJES REDISEÑADA CON AUTO-SCROLL */}
         <div className="flex-1 relative">
          <div 
            ref={messagesContainerRef}
            className="flex-1 max-h-[48vh] p-3 space-y-3 overflow-y-auto custom-scroll"
          >
            {stableMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center py-8">
                  <div className="empty-icon bg-[#ff007a]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#ff007a]/20">
                    <MessageCircle size={32} className="text-[#ff007a]" />
                  </div>
                  <h4 className="text-white font-semibold mb-2 empty-title">
                    {otherUser ? `Conversa con ${otherUser.name}` : 'Esperando modelo...'}
                  </h4>
                  <p className="text-gray-400 empty-text leading-relaxed max-w-xs">
                    {otherUser 
                      ? 'Inicia una conversación interesante y disfruta del chat' 
                      : 'Una modelo se conectará pronto para chatear contigo'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <>
                {stableMessages.map((msg, index) => {
                  // 🔥 CONTROL DE LOGGING - Solo log si no se ha procesado antes
                  if (!processedMessageIds.current.has(msg.id)) {
                    console.log('🔍 [CLIENT] Nuevo mensaje:', {
                      id: msg.id,
                      type: msg.type,
                      text: msg.text?.substring(0, 30),
                      message: msg.message?.substring(0, 30),
                      isGift: isGiftMessage(msg),
                      timestamp: msg.timestamp || msg.created_at
                    });
                    processedMessageIds.current.add(msg.id);
                  }

                  // 🔥 VERIFICAR SI ES MENSAJE DE REGALO
                  const isGift = isGiftMessage(msg);

                  return (
                    <div key={`${msg.id}-${index}`} className="space-y-3">
                      
                      {/* 🔥 RENDERIZADO DE REGALOS - FLUJO CRONOLÓGICO CORREGIDO */}
                      {isGift && (() => {
                        const giftData = parseGiftData(msg);
                        const imageUrl = buildCompleteImageUrl(giftData.gift_image);
                        
                        console.log('🎁 [CLIENT] Renderizando regalo en orden:', {
                          id: msg.id,
                          type: msg.type,
                          giftData,
                          timestamp: msg.timestamp || msg.created_at
                        });

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
                                    {otherUser?.name || 'Modelo'}
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
                                      Te pide un regalo
                                    </span>
                                  </div>
                                  
                                  <div className="mb-3 flex justify-center">
                                    <div className="gift-image-container bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-purple-300/30">
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt={giftData.gift_name || 'Regalo'}
                                          className="gift-image object-contain"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            const fallback = e.target.parentNode.querySelector('.gift-fallback');
                                            if (fallback) fallback.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      <div className={`gift-fallback ${imageUrl ? 'hidden' : 'flex'} gift-fallback-icon items-center justify-center`}>
                                        <Gift size={20} className="text-purple-300" />
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="text-center space-y-2">
                                    <p className="text-white font-bold gift-name-text">
                                      {giftData.gift_name}
                                    </p>
                                    
                                    <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg gift-price-container border border-amber-300/30">
                                      <span className="text-amber-200 font-bold gift-price-text">
                                        ✨ {giftData.gift_price} monedas
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
                                  <span className="text-blue-100 gift-title font-semibold">Regalo Enviado</span>
                                </div>
                                
                                {imageUrl && (
                                  <div className="mb-3 flex justify-center">
                                    <div className="gift-image-container bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-blue-300/30">
                                      <img
                                        src={imageUrl}
                                        alt={giftData.gift_name}
                                        className="gift-image object-contain"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          const fallback = e.target.parentNode.querySelector('.gift-fallback');
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                      <div className="gift-fallback hidden gift-fallback-icon items-center justify-center">
                                        <Gift size={20} className="text-blue-300" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="text-center space-y-2">
                                  <p className="text-white font-bold gift-name-text">
                                    {giftData.gift_name}
                                  </p>
                                  
                                  <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-lg gift-price-container border border-blue-300/30">
                                    <span className="text-blue-200 font-bold gift-price-text">
                                      💰 {giftData.gift_price} monedas
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
                                  <span className="text-green-100 gift-title font-semibold">🎉 ¡Regalo Recibido!</span>
                                </div>
                                
                                {imageUrl && (
                                  <div className="mb-3 flex justify-center">
                                    <div className="gift-image-container bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-green-300/30">
                                      <img
                                        src={imageUrl}
                                        alt={giftData.gift_name}
                                        className="gift-image object-contain"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          const fallback = e.target.parentNode.querySelector('.gift-fallback');
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                      <div className="gift-fallback hidden gift-fallback-icon items-center justify-center">
                                        <Gift size={20} className="text-green-300" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="text-center space-y-2">
                                  <p className="text-white font-bold gift-name-text">
                                    {giftData.gift_name}
                                  </p>
                                  
                                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg gift-price-container border border-green-300/30">
                                    <span className="text-green-200 font-bold gift-price-text">
                                      💰 {giftData.gift_price} monedas
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

                        // 🔥 5. FALLBACK PARA OTROS TIPOS DE REGALO
                        return (
                          <div className="flex justify-center">
                            <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/40 to-purple-900/40 rounded-xl gift-card-fallback border border-purple-400/30 shadow-lg backdrop-blur-sm">
                              <div className="flex items-center justify-center gap-2 mb-3">
                                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-full gift-icon-container">
                                  <Gift size={16} className="text-white" />
                                </div>
                                <span className="text-purple-100 gift-title font-semibold">🎁 Actividad de Regalo</span>
                              </div>
                              
                              <div className="text-center">
                                <p className="text-white message-text">
                                  {msg.text || msg.message || 'Actividad de regalo'}
                                </p>
                              </div>
                              
                              {/* 🔥 TIMESTAMP DEL MENSAJE */}
                              <div className="text-center mt-3">
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
                                  {msg.senderRole === 'modelo' ? otherUser?.name || 'Modelo' : 'Usuario'}
                                </span>
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-gray-800/90 to-slate-800/90 message-bubble-other text-white shadow-lg border border-gray-600/30 backdrop-blur-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
                              <span className="text-gray-100 message-text leading-relaxed break-words inline-block">
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
              </>
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
                <input
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t?.('chat.writeMessage') || 'Escribe tu mensaje...'}
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
                title={!userBalance || userBalance <= 0 ? "Necesitas monedas para enviar regalos" : "Enviar regalo"}
              >
                <Gift size={18} />
              </button>
              
              
              <button 
                onClick={() => {
                  const emojis = ['😊', '❤️', '😍', '🥰', '😘', '💕', '🔥', '✨', '💋', '😋'];
                  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                  setMensaje(prev => prev + randomEmoji);
                }}
                className="flex-shrink-0 input-button rounded-lg transition-all duration-300 hover:scale-110 bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30 border border-[#ff007a]/30"
              >
                <Smile size={14} />
              </button>
              
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
            width: 320px;
            min-width: 320px;
            max-width: 320px;
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