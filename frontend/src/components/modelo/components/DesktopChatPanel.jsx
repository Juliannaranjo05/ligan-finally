import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Star, UserX, Gift, Send, Smile, Settings, Crown, MessageCircle, Globe, X } from 'lucide-react';
import { GiftMessageComponent } from '../../GiftSystem/GiftMessageComponent';
import { useGlobalTranslation } from '../../../contexts/GlobalTranslationContext';

const DesktopChatPanel = ({
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
  t
}) => {

  // Ref para el contenedor de mensajes
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  // 🔥 OBTENER CONTEXTO GLOBAL COMPLETO
  const { 
    translateGlobalText, 
    isEnabled: translationEnabled,
    changeGlobalLanguage,
    currentLanguage: globalCurrentLanguage 
  } = useGlobalTranslation();

  // 🔥 ESTADO PARA MODAL DE CONFIGURACIÓN Y TRADUCCIÓN
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('selectedLanguage') || globalCurrentLanguage || 'es';
  });
  const [stableMessages, setStableMessages] = useState([]);


  // 🔥 ESTADO LOCAL PARA TRADUCCIÓN - CORREGIDO
  const [localTranslationEnabled, setLocalTranslationEnabled] = useState(() => {
    return localStorage.getItem('translationEnabled') === 'true';
  });

  // 🔥 SOLUCIÓN DE TRADUCCIÓN SIMPLIFICADA - SIN COMPONENTE ANIDADO
  const [translations, setTranslations] = useState(new Map());
  const [translatingIds, setTranslatingIds] = useState(new Set());

  // 🎵 SISTEMA DE SONIDOS DE REGALO - COPIADO DE CHATPRIVADO
const playGiftReceivedSound = useCallback(async () => {
    
  try {
    // 🔥 SOLICITAR PERMISOS DE AUDIO PRIMERO
    if (typeof window !== 'undefined' && window.AudioContext) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
                await audioContext.resume();
      }
    }
    
    // 🔥 INTENTAR MÚLTIPLES ARCHIVOS DE SONIDO
    const soundUrls = [       
      '/sounds/gift-received.mp3',    // ← Para cuando RECIBES un regalo
      '/sounds/gift-notification.mp3',
      '/sounds/gift-sound.wav'
    ];
    
    let soundPlayed = false;
    
    for (const soundUrl of soundUrls) {
      if (soundPlayed) break;
      
      try {
                
        const audio = new Audio(soundUrl);
        audio.volume = 1.0; // 🔥 VOLUMEN MÁXIMO
        audio.preload = 'auto';
        
        // 🔥 PROMESA PARA MANEJAR LA REPRODUCCIÓN
        await new Promise((resolve, reject) => {
          audio.oncanplaythrough = () => {
                        audio.play()
              .then(() => {
                                soundPlayed = true;
                resolve();
              })
              .catch(reject);
          };
          
          audio.onerror = (error) => {
            console.warn(`⚠️ [SOUND] Error cargando ${soundUrl}:`, error);
            reject(error);
          };
          
          // Timeout de 2 segundos
          setTimeout(() => reject(new Error('Timeout')), 2000);
        });
        
        break; // Si llegamos aquí, el sonido se reprodujo
        
      } catch (audioError) {
        console.warn(`❌ [SOUND] Falló ${soundUrl}:`, audioError);
        continue; // Probar el siguiente
      }
    }
    
    // 🔥 SI NINGÚN ARCHIVO FUNCIONA, USAR SONIDO SINTETIZADO
    if (!soundPlayed) {
            await playAlternativeGiftSound();
    }
    
  } catch (error) {
        // 🔥 ÚLTIMO RECURSO - SONIDO SINTETIZADO
    try {
      await playAlternativeGiftSound();
    } catch (finalError) {
          }
  }
}, []);

// 🔥 MEJORAR EL SONIDO ALTERNATIVO PARA SER MÁS FUERTE Y CLARO:
const playAlternativeGiftSound = useCallback(async () => {
  try {
        
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // 🔥 ASEGURAR QUE EL CONTEXTO ESTÉ ACTIVO
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // 🔥 CREAR UNA MELODÍA MÁS FUERTE Y LLAMATIVA
    const playNote = (frequency, startTime, duration, volume = 0.5) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.type = 'sine'; // 🔥 CAMBIAR A SINE PARA SONIDO MÁS CLARO
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    // 🔥 MELODÍA MÁS LLAMATIVA Y FUERTE
    const now = audioContext.currentTime;
    playNote(659.25, now, 0.15, 0.6);        // Mi
    playNote(783.99, now + 0.1, 0.15, 0.6);  // Sol
    playNote(1046.5, now + 0.2, 0.15, 0.6);  // Do
    playNote(1318.5, now + 0.3, 0.2, 0.7);   // Mi alto
    playNote(1046.5, now + 0.45, 0.3, 0.8);  // Do final más largo y fuerte
    
        
    return true;
    
  } catch (error) {
        
    // 🔥 ÚLTIMO ÚLTIMO RECURSO - VIBRACIÓN EN MÓVILES
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400, 100, 200]);
          }
    
    return false;
  }
}, []);

// 🔥 ASEGURAR QUE LOS PERMISOS DE AUDIO ESTÉN HABILITADOS AL INICIO:
  useEffect(() => {
    // Solicitar permisos de audio cuando se monte el componente
    const enableAudio = async () => {
      try {
        if (typeof window !== 'undefined' && window.AudioContext) {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (audioContext.state === 'suspended') {
                        // No hacer resume aquí, se hará cuando sea necesario
          }
        }
        
        // Solicitar permisos de notificación
        if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      } catch (error) {
              }
    };
    
    enableAudio();
  }, []);
  // 🎁 FUNCIÓN PARA REPRODUCIR NOTIFICACIÓN DE REGALO
  const playGiftNotification = useCallback(async (giftName) => {
    try {
      // Reproducir sonido
      await playGiftReceivedSound();
      
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

  // Auto-scroll al final cuando hay nuevos mensajes
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      if (container) {
        // Forzar recálculo de altura
        container.scrollTop = 0;
        setTimeout(() => {
          container.scrollTop = container.scrollHeight + 1000; // +1000 para asegurar
        }, 50);
      }
    }
  };

  // Efecto para hacer scroll automático cuando cambian los mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // También scroll cuando se envía un mensaje
  useEffect(() => {
    if (mensaje === '') {
      // Mensaje acabado de enviar, hacer scroll
      setTimeout(scrollToBottom, 100);
    }
  }, [mensaje]);

  

  // 🔥 SOLUCIÓN AL BUCLE INFINITO - Usar una referencia estable para detectar cambios
  const previousMessagesLengthRef = useRef(0);
  const processedMessageIdsRef = useRef(new Set());

  useEffect(() => {
    if (!messages || !Array.isArray(messages)) {
      return;
    }

    // 🔥 CREAR SIGNATURE PARA DETECTAR CAMBIOS REALES
    const currentSignature = messages.map(m => `${m.id}-${m.type}-${m.text?.substring(0, 10)}`).join('|');
    const lastSignature = stableMessages.map(m => `${m.id}-${m.type}-${m.text?.substring(0, 10)}`).join('|');

    // Solo actualizar si realmente cambiaron
    if (currentSignature !== lastSignature) {
      
      // Filtrar mensajes únicos
      const seenIds = new Set();
      const uniqueMessages = messages.filter(msg => {
        if (seenIds.has(msg.id)) return false;
        seenIds.add(msg.id);
        return true;
      });

      // Ordenar cronológicamente
      const sortedMessages = uniqueMessages;


      // 🔥 DETECTAR NUEVOS REGALOS ANTES DE ACTUALIZAR
      if (stableMessages.length > 0) {
        const previousIds = new Set(stableMessages.map(m => m.id));
        const newMessages = sortedMessages.filter(msg => !previousIds.has(msg.id));
        
        // 🎁 DETECTAR REGALOS RECIBIDOS (para modelos)
        const newGiftMessages = newMessages.filter(msg => {
                    
          return (
            msg.type === 'gift_received' && 
            msg.user_id !== userData?.id // Solo si no soy yo quien envió
          );
        });
        
        if (newGiftMessages.length > 0) {
                    
          // 🔊 REPRODUCIR SONIDO INMEDIATAMENTE
          newGiftMessages.forEach(async (giftMsg, index) => {
            try {
              // Extraer datos del regalo
              let giftData = giftMsg.gift_data || giftMsg.extra_data || {};
              
              if (typeof giftData === 'string') {
                try {
                  giftData = JSON.parse(giftData);
                } catch (e) {
                  giftData = { gift_name: 'Regalo Especial' };
                }
              }
              
              const giftName = giftData.gift_name || 'Regalo Especial';
                            
              // 🔥 REPRODUCIR SONIDO DE REGALO
              await playGiftNotification(giftName);
              
              // Vibrar en móviles
              if ('vibrate' in navigator) {
                navigator.vibrate([300, 100, 300, 100, 500]);
              }
              
              // Notificación visual
              if (Notification.permission === 'granted') {
                new Notification('💝 ¡Regalo Recibido!', {
                  body: `Has recibido: ${giftName}`,
                  icon: '/favicon.ico',
                  tag: 'gift-received',
                  requireInteraction: true
                });
              }
              
              // Esperar entre regalos para no saturar
              if (index < newGiftMessages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (error) {
                          }
          });
        }
      }

      setStableMessages(uniqueMessages);
    } else {
          }
  }, [messages, playGiftNotification, userData?.id]);

  useEffect(() => {
  if (stableMessages.length > 0) {
        stableMessages.forEach((msg, index) => {
          });
  }
}, [stableMessages]);

  // 🔥 FUNCIÓN FALLBACK PARA TRADUCCIÓN - MEJORADA Y CORREGIDA
  const translateWithFallback = useCallback(async (text, targetLang) => {
    try {
            
      const cleanText = text.toLowerCase().trim();
      
      // 🔥 QUITAR DETECCIÓN AUTOMÁTICA - SIEMPRE INTENTAR TRADUCIR
      // Esto estaba causando que devolviera null muy temprano
      
      // 🔥 SIMULACIÓN MEJORADA PARA TESTING
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
        
        const translated = translations[cleanText];
        
        if (translated) {
                    return translated;
        } else {
                            }
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
        
        const translated = translations[cleanText];
        
        if (translated) {
                    return translated;
        } else {
                            }
      }
      
      // 🔥 PARA TESTING - DEVOLVER UNA TRADUCCIÓN SIMULADA SI NO SE ENCUENTRA
            return `[${targetLang.toUpperCase()}] ${text}`;
      
    } catch (error) {
            return `[ERROR-${targetLang.toUpperCase()}] ${text}`;
    }
  }, []);

  // 🌐 FUNCIÓN PARA TRADUCIR MENSAJES - USANDO CONTEXTO GLOBAL CORRECTAMENTE
  const translateMessage = useCallback(async (message) => {
    // 🔥 USAR ESTADO LOCAL EN LUGAR DEL CONTEXTO
    if (!localTranslationEnabled || !message?.id) {
            return;
    }
    
    const originalText = message.text || message.message;
    if (!originalText || originalText.trim() === '') {
            return;
    }

    // 🔥 VERIFICAR SI YA ESTÁ PROCESADO O EN PROCESO
    if (translations.has(message.id) || translatingIds.has(message.id)) {
            return;
    }

    
    // 🔥 MARCAR COMO PROCESANDO INMEDIATAMENTE
    setTranslatingIds(prev => new Set(prev).add(message.id));

    try {
      let result = null;
      
      // 🔥 USAR EL CONTEXTO GLOBAL CORRECTAMENTE
      if (typeof translateGlobalText === 'function') {
        try {
                    
          // 🚨 EL CONTEXTO USA EL TARGET LANGUAGE INTERNO, NO EL QUE LE PASAMOS
          result = await translateGlobalText(originalText, message.id);
                    
          // 🔥 SI EL CONTEXTO DEVUELVE EL MISMO TEXTO, INTENTAR FALLBACK
          if (!result || result === originalText) {
                        result = await translateWithFallback(originalText, currentLanguage);
          }
        } catch (error) {
          console.warn('❌ Error con translateGlobalText, usando fallback:', error);
          result = await translateWithFallback(originalText, currentLanguage);
        }
      } else {
                // 🔥 USAR FALLBACK DIRECTO
        result = await translateWithFallback(originalText, currentLanguage);
      }
      
            
      // 🔥 GUARDAR RESULTADO (incluso si es null para evitar re-intentos)
      if (result && result !== originalText && result.trim() !== '' && result.toLowerCase() !== originalText.toLowerCase()) {
        setTranslations(prev => new Map(prev).set(message.id, result));
              } else {
        // Marcar como "sin traducción necesaria"
        setTranslations(prev => new Map(prev).set(message.id, null));
              }
    } catch (error) {
            // Marcar como procesado incluso en caso de error
      setTranslations(prev => new Map(prev).set(message.id, null));
    } finally {
      setTranslatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(message.id);
        return newSet;
      });
    }
  }, [localTranslationEnabled, translateGlobalText, currentLanguage, translateWithFallback, translations, translatingIds]);

  // 🌐 EFECTO PARA TRADUCIR MENSAJES AUTOMÁTICAMENTE - CORREGIDO
  useEffect(() => {
    if (!localTranslationEnabled) {
            return;
    }

    
    // 🔥 FILTRAR SOLO MENSAJES QUE NO HAYAN SIDO PROCESADOS
    const messagesToTranslate = messages.filter(message => {
      const shouldTranslate = (
        message.type !== 'system' && 
        !['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(message.type) &&
        !translations.has(message.id) && // No ha sido procesado
        !translatingIds.has(message.id) && // No se está procesando
        (message.text || message.message) && // Tiene texto
        (message.text || message.message).trim() !== '' // No está vacío
      );
      
      if (shouldTranslate) {
              }
      
      return shouldTranslate;
    });

    
    // 🔥 TRADUCIR SOLO MENSAJES NUEVOS
    messagesToTranslate.forEach((message, index) => {
      // Añadir un pequeño delay para evitar llamadas simultáneas
      setTimeout(() => {
        translateMessage(message);
      }, index * 100);
    });

  }, [messages.length, localTranslationEnabled, translateMessage]); // 🔥 USAR localTranslationEnabled

  // 🌐 COMPONENTE DE MENSAJE CON TRADUCCIÓN OPTIMIZADO
  const renderMessageWithTranslation = useCallback((message, isOwn = false) => {
    const originalText = message.text || message.message;
    const translatedText = translations.get(message.id);
    const isTranslating = translatingIds.has(message.id);
    
    // 🔥 SOLO MOSTRAR TRADUCCIÓN SI EXISTE Y ES DIFERENTE (no null)
    const hasTranslation = translatedText && translatedText !== originalText && translatedText.trim() !== '';

    // 🔥 DEBUG: Log para verificar el estado de traducción
    if (localTranslationEnabled && message.id) {
          }

    return (
      <div className="space-y-1">
        {/* TEXTO ORIGINAL */}
        <div className="text-white">
          {originalText}
          {isTranslating && (
            <span className="ml-2 inline-flex items-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-current opacity-50"></div>
            </span>
          )}
        </div>

        {/* TRADUCCIÓN */}
        {hasTranslation && (
          <div className={`text-xs italic border-l-2 pl-2 py-1 ${
            isOwn 
              ? 'border-blue-300 text-blue-200 bg-blue-500/10' 
              : 'border-green-300 text-green-200 bg-green-500/10'
          } rounded-r`}>
            <span className="text-xs opacity-80"></span> {translatedText}
          </div>
        )}
      </div>
    );
  }, [translations, translatingIds, localTranslationEnabled]);

  // 🔥 FUNCIÓN PARA LIMITAR NOMBRE A 8 CARACTERES
  const truncateName = (name, maxLength = 8) => {
    if (!name) return '';
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  // Función de fallback para getDisplayName con límite de caracteres
  const safeGetDisplayName = () => {
    if (typeof getDisplayName === 'function') {
      try {
        const name = getDisplayName();
        return truncateName(name, 8);
      } catch (error) {
        console.warn('Error calling getDisplayName:', error);
      }
    }
    
    // Fallback manual con límite
    if (otherUser?.name) {
      return truncateName(otherUser.name, 8);
    }
    
    return isDetectingUser ? 'Detectan...' : 'Esperando...';
  };

  // 🔥 IDIOMAS DISPONIBLES
  const languages = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' }
  ];

  // 🔥 FUNCIÓN PARA CAMBIAR IDIOMA Y HABILITAR TRADUCCIÓN - CORREGIDA PARA CONTEXTO
  const handleLanguageChange = (languageCode) => {
    setCurrentLanguage(languageCode);
    localStorage.setItem('selectedLanguage', languageCode);
    
    // Habilitar traducción automáticamente si no es español
    const shouldEnableTranslation = languageCode !== 'es';
    setLocalTranslationEnabled(shouldEnableTranslation);
    localStorage.setItem('translationEnabled', shouldEnableTranslation.toString());
    
    // 🔥 CAMBIAR EL IDIOMA EN EL CONTEXTO GLOBAL
    if (typeof changeGlobalLanguage === 'function') {
      try {
        changeGlobalLanguage(languageCode);
              } catch (error) {
        console.warn('❌ No se pudo cambiar idioma en contexto global:', error);
      }
    }
    
    // 🔥 LIMPIAR TRADUCCIONES Y IDs PROCESADOS
    setTranslations(new Map());
    setTranslatingIds(new Set());
    processedMessageIdsRef.current = new Set(); // ¡IMPORTANTE!
    
        
    // Cerrar modal
    setShowSettingsModal(false);
  };

  return (
    <div className="w-full lg:w-[300px] xl:w-[320px] bg-gradient-to-b from-[#0a0d10] to-[#131418] backdrop-blur-xl rounded-2xl flex flex-col justify-between relative border border-[#ff007a]/20 shadow-2xl overflow-hidden">
      {/* Línea superior fucsia */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#ff007a]"></div>
      
      {/* 🔥 HEADER DEL CHAT REDISEÑADO PARA MODELO */}
      <div className="relative p-3 border-b border-gray-700/50">
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Avatar con colores Ligand */}
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg border border-[#ff007a]/30">
                {otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>
            
            {/* Información del usuario - SIMPLIFICADA CON LÍMITE DE CARACTERES */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-white text-base leading-tight" title={getDisplayName?.() || otherUser?.name || 'Usuario'}>
                  {safeGetDisplayName()}
                </h3>
                
                {isDetectingUser && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ff007a]"></div>
                )}
              </div>
            </div>
          </div>
          
          {/* 🔥 BOTONES DE ACCIÓN SUPERIORES REDISEÑADOS */}
          <div className="flex items-center gap-2">
            {/* Estrella fucsia (favorito) */}
            <button
              onClick={toggleFavorite}
              disabled={isAddingFavorite || !otherUser}
              className={`
                relative p-2 rounded-lg transition-all duration-300 hover:scale-110 group overflow-hidden
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
            
            {/* Bloquear */}
            <button
              onClick={blockCurrentUser}
              disabled={isBlocking || !otherUser}
              className={`
                relative p-2 rounded-lg transition-all duration-300 hover:scale-110 group
                bg-gray-800/50 text-gray-400 hover:text-red-400 hover:bg-red-400/10
                ${isBlocking ? 'animate-pulse' : ''}
                ${!otherUser ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title="Bloquear usuario"
            >
              <UserX size={18} />
            </button>

            {/* 🔥 BOTÓN DE CONFIGURACIÓN */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="
                relative p-2 rounded-lg transition-all duration-300 hover:scale-110 group overflow-hidden
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
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-[#ff007a]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#ff007a]/20">
                  <MessageCircle size={32} className="text-[#ff007a]" />
                </div>
                <h4 className="text-white font-semibold mb-2">
                  {otherUser ? `Conversa con ${truncateName(otherUser.name, 10)}` : 'Esperando chico...'}
                </h4>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                  {otherUser 
                    ? 'Inicia una conversación interesante y disfruta del chat' 
                    : 'Un chico se conectará pronto para chatear contigo'
                  }
                </p>
              </div>
            </div>
          ) : (
            <>
            {stableMessages.slice().reverse().map((msg, index) => (
              <div key={msg.id} className="space-y-3">
                  {/* 🎁 RENDERIZAR MENSAJES DE REGALO SEGÚN TU CÓDIGO */}
                  {(msg.type === 'gift_request' || msg.type === 'gift_sent' || msg.type === 'gift_received' || msg.type === 'gift') && (
                    <div className="relative">
                      {/* Renderizar según el tipo específico */}
                      {msg.type === 'gift' && (
                        <div className="flex items-center gap-2 text-yellow-400">
                          <Gift size={16} />
                          <span>Envió: {msg.text || msg.message}</span>
                        </div>
                      )}

                      {/* 🔥 AGREGAR GIFT_REQUEST QUE FALTABA */}
                      {msg.type === 'gift_request' && (() => {
                        const giftData = msg.gift_data || msg.extra_data || {};
                        let finalGiftData = giftData;
                        
                        if (typeof msg.extra_data === 'string') {
                          try {
                            finalGiftData = JSON.parse(msg.extra_data);
                          } catch (e) {
                            finalGiftData = giftData;
                          }
                        }
                        
                        // Construir URL de imagen
                        let imageUrl = null;
                        if (finalGiftData.gift_image) {
                          const imagePath = finalGiftData.gift_image;
                          const baseUrl = import.meta.env.VITE_API_BASE_URL;
                          const cleanBaseUrl = baseUrl.replace(/\/$/, '');
                          
                          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                            imageUrl = imagePath;
                          } else {
                            const cleanPath = imagePath.replace(/\\/g, '');
                            if (cleanPath.startsWith('storage/')) {
                              imageUrl = `${cleanBaseUrl}/${cleanPath}`;
                            } else if (cleanPath.startsWith('/')) {
                              imageUrl = `${cleanBaseUrl}${cleanPath}`;
                            } else {
                              imageUrl = `${cleanBaseUrl}/storage/gifts/${cleanPath}`;
                            }
                          }
                        }
                        
                        return (
                          <div className="bg-gradient-to-br from-[#ff007a]/20 via-[#cc0062]/20 to-[#990047]/20 rounded-xl p-4 max-w-xs border border-[#ff007a]/30 shadow-lg backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-2 mb-3">
                              <div className="bg-gradient-to-r from-[#ff007a] to-[#cc0062] rounded-full p-2">
                                <Gift size={16} className="text-white" />
                              </div>
                              <span className="text-pink-100 text-sm font-semibold">Solicitud de Regalo</span>
                            </div>
                            
                            {imageUrl && (
                              <div className="mb-3 flex justify-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-purple-300/30">
                                  <img
                                    src={imageUrl}
                                    alt={finalGiftData.gift_name || 'Regalo'}
                                    className="w-12 h-12 object-contain"
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
                              {/* 🔥 NOMBRE DEL REGALO */}
                              <p className="text-white font-bold text-base">
                                {finalGiftData.gift_name || 'Regalo Especial'}
                              </p>
                              
                              {/* 🔥 PRECIO DEL REGALO */}
                              {finalGiftData.gift_price && (
                                <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg px-3 py-1 border border-amber-300/30">
                                  <span className="text-amber-200 font-bold text-sm">
                                    ✨ {finalGiftData.gift_price} monedas
                                  </span>
                                </div>
                              )}
                              
                              {/* 🔥 MENSAJE ORIGINAL */}
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
                      })()}

                      {msg.type === 'gift_received' && (() => {
                        
                        const receivedGiftData = msg.gift_data || msg.extra_data || {};
                        let finalReceivedGiftData = receivedGiftData;
                        
                        if (typeof msg.extra_data === 'string') {
                          try {
                            finalReceivedGiftData = JSON.parse(msg.extra_data);
                          } catch (e) {
                            finalReceivedGiftData = receivedGiftData;
                          }
                        }
                        
                        // Construir URL de imagen
                        let receivedImageUrl = null;
                        if (finalReceivedGiftData.gift_image) {
                          const imagePath = finalReceivedGiftData.gift_image;
                          const baseUrl = import.meta.env.VITE_API_BASE_URL;
                          const cleanBaseUrl = baseUrl.replace(/\/$/, '');
                          
                          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                            receivedImageUrl = imagePath;
                          } else {
                            const cleanPath = imagePath.replace(/\\/g, '');
                            if (cleanPath.startsWith('storage/')) {
                              receivedImageUrl = `${cleanBaseUrl}/${cleanPath}`;
                            } else if (cleanPath.startsWith('/')) {
                              receivedImageUrl = `${cleanBaseUrl}${cleanPath}`;
                            } else {
                              receivedImageUrl = `${cleanBaseUrl}/storage/gifts/${cleanPath}`;
                            }
                          }
                        }
                        
                        return (
                          <div className="bg-gradient-to-br from-green-900/40 via-emerald-900/40 to-teal-900/40 rounded-xl p-4 max-w-xs border border-green-300/30 shadow-lg backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-2 mb-3">
                              <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full p-2">
                                <Gift size={16} className="text-white" />
                              </div>
                              <span className="text-green-100 text-sm font-semibold">¡Regalo Recibido!</span>
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
                              {/* 🔥 NOMBRE DEL REGALO */}
                              <p className="text-white font-bold text-base">
                                {finalReceivedGiftData.gift_name || 'Regalo Especial'}
                              </p>
                              
                              {/* 🔥 PRECIO DEL REGALO */}
                              {finalReceivedGiftData.gift_price && (
                                <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg px-3 py-1 border border-green-300/30">
                                  <span className="text-green-200 font-bold text-sm">
                                    💰 {finalReceivedGiftData.gift_price} monedas
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                    </div>
                  )}
                  
                  {/* 🔥 MENSAJES NORMALES REDISEÑADOS */}
                  {!['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(msg.type) && (
                    <div className={`flex ${msg.type === 'local' ? 'justify-end' : 'justify-start'} group`}>
                      {msg.type === 'local' ? (
                        <div className="w-full space-y-2">
                          <div className="text-right">
                            <span className="text-xs text-gray-400 font-medium">Tú</span>
                          </div>
                          <div className="flex justify-end">
                            <div className="relative bg-gradient-to-br from-[#ff007a] to-[#ff007a]/80 px-4 py-3 rounded-2xl rounded-br-md text-white shadow-lg border border-[#ff007a]/20 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 max-w-[70%]">
                              {renderMessageWithTranslation(msg, msg.type === 'local')}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500 font-medium">
                              {new Date(msg.timestamp || msg.created_at).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      ) : msg.type === 'system' ? (
                        <div className="w-full flex justify-center">
                          <div className="bg-gradient-to-r from-[#00ff66]/10 to-[#00ff66]/5 border border-[#00ff66]/30 px-4 py-3 rounded-2xl max-w-[90%] backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 bg-[#00ff66] rounded-full animate-pulse"></div>
                              <span className="text-[#00ff66] text-xs font-semibold">🎰 Sistema</span>
                            </div>
                            <p className="text-[#00ff66] text-sm leading-relaxed">
                              <span className="text-[#00ff66]">
                                {msg.text || msg.message}
                              </span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-[70%] space-y-2">
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  {otherUser?.name?.charAt(0)?.toUpperCase() || 'C'}
                                </span>
                              </div>
                              <span className="text-xs text-[#ff007a] font-medium">
                                {msg.senderRole === 'chico' ? truncateName(otherUser?.name || 'Chico', 8) : 'Usuario'}
                              </span>
                            </div>
                          </div>
                          <div className="bg-gradient-to-br from-gray-800/90 to-slate-800/90 px-4 py-3 rounded-2xl rounded-bl-md text-white shadow-lg border border-gray-600/30 backdrop-blur-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
                            {msg.type === 'emoji' ? (
                              <div className="text-2xl">{msg.text || msg.message}</div>
                            ) : (
                              renderMessageWithTranslation(msg, false)
                            )}
                          </div>
                          <div className="text-left">
                            <span className="text-xs text-gray-500 font-medium">
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
              ))}
              {/* Elemento invisible para hacer scroll automático */}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>
      
      {/* 🔥 INPUT DE CHAT REDISEÑADO PARA MODELO */}
      <div className="relative border-t border-gray-700/50 p-3">
        <div className="relative space-y-4">
          {/* Input principal - COMPLETAMENTE EXPANDIDO */}
          <div className="flex items-end gap-2">
            
            {/* Input que ocupa TODO el espacio disponible */}
            <div className="flex-1 min-w-0 relative">
              <input
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t?.('chat.respondToClient') || 'Responde al chico...'}
                maxLength={200}
                className="
                  w-full bg-gradient-to-r from-gray-800/60 to-slate-800/60 backdrop-blur-sm 
                  px-4 py-3 rounded-xl outline-none text-white text-sm
                  border border-gray-600/30 focus:border-[#ff007a]/50 
                  transition-all duration-300 focus:bg-gray-800/80
                  placeholder-gray-400 focus:placeholder-gray-300
                  shadow-lg focus:shadow-xl focus:shadow-[#ff007a]/10
                "
              />
              
              {/* Contador de caracteres */}
              {mensaje.length > 150 && (
                <div className="absolute -top-8 right-2">
                  <div className={`px-2 py-1 rounded-md backdrop-blur-sm text-xs font-medium border ${
                    mensaje.length > 190 
                      ? 'bg-red-500/20 text-red-300 border-red-400/30' 
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                  }`}>
                    {mensaje.length}/200
                  </div>
                </div>
              )}
            </div>

            {/* 🔥 BOTÓN DE REGALO MOVIDO AQUÍ */}
            <button
              onClick={() => setShowGiftsModal(true)}
              disabled={!otherUser}
              className={`
                flex-shrink-0 p-2 rounded-lg transition-all duration-300 hover:scale-110 group overflow-hidden
                ${!otherUser 
                  ? 'bg-gray-800/50 text-gray-500 opacity-50 cursor-not-allowed' 
                  : 'bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30 border border-[#ff007a]/30 shadow-lg'
                }
              `}
              title="Pedir regalo"
            >
              <Gift size={14} />
            </button>
            
            <button 
              onClick={() => {
                const emojis = ['😊', '❤️', '😍', '🥰', '😘', '💕', '🔥', '✨', '💋', '😋'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                setMensaje(prev => prev + randomEmoji);
              }}
              className="flex-shrink-0 p-2 rounded-lg transition-all duration-300 hover:scale-110 bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30 border border-[#ff007a]/30"
            >
              <Smile size={14} />
            </button>
            
            {/* Botón enviar */}
            <button
              onClick={enviarMensaje}
              disabled={!mensaje.trim()}
              className={`
                flex-shrink-0 relative p-2 rounded-lg transition-all duration-300 group overflow-hidden
                ${mensaje.trim() 
                  ? 'bg-gradient-to-r from-[#ff007a] to-[#ff007a]/80 text-white hover:from-[#ff007a] hover:to-[#ff007a] hover:scale-105 shadow-lg shadow-[#ff007a]/30' 
                  : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              <Send size={14} className={mensaje.trim() ? 'group-hover:translate-x-0.5 transition-transform duration-200' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 🔥 MODAL DE CONFIGURACIÓN */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-xl border border-[#ff007a]/30 shadow-2xl w-72 max-h-[75vh] overflow-hidden">
            {/* Header del modal */}
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

            {/* Contenido del modal */}
            <div className="p-2.5 overflow-y-auto max-h-[calc(75vh-80px)]">
              {/* Advertencia temporal */}
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

              {/* Sección de idioma */}
              <div className="mb-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe size={12} className="text-[#ff007a]" />
                  <h3 className="text-xs font-semibold text-white">Cambiar Idioma</h3>
                </div>

                {/* Estado actual */}
                <div className="mb-2.5 p-2 bg-gray-800/50 rounded-lg border border-gray-600/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">Actual:</span>
                    <div className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30">
                      {languages.find(l => l.code === currentLanguage)?.name || 'Español'}
                    </div>
                  </div>
                </div>
                
                {/* Lista de idiomas */}
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

              {/* Información adicional */}
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

            {/* Footer */}
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
      
      {/* 🎁 AUDIO INVISIBLE PARA REGALOS - NUEVO */}
      <div className="hidden">
        <audio id="gift-sound" preload="auto">
          <source src="/sounds/gift-received.mp3" type="audio/mpeg" />
          <source src="/sounds/gift-received.wav" type="audio/wav" />
        </audio>
      </div>
      
      {/* 🔥 ESTILOS PARA SCROLL PERSONALIZADO */}
    <style jsx>{`
      /* 🔥 SCROLL PERSONALIZADO */
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
        .messages-container {
          max-height: 400px;
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
    `}</style>
    </div>
  );
};

export default DesktopChatPanel;