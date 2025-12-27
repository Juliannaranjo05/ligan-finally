import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Star, UserX, Gift, Send, Smile, Settings, Crown, MessageCircle, Globe, X } from 'lucide-react';
import { GiftMessageComponent } from '../../GiftSystem/GiftMessageComponent';
import { useGlobalTranslation } from '../../../contexts/GlobalTranslationContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';

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

  // 🔥 OBTENER EL HOOK DE i18n PARA ESCUCHAR CAMBIOS
  const { i18n: i18nInstance } = useTranslation();

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
            reject(error);
          };
          
          // Timeout de 2 segundos
          setTimeout(() => reject(new Error('Timeout')), 2000);
        });
        
        break; // Si llegamos aquí, el sonido se reprodujo
        
      } catch (audioError) {
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

  // 🔥 FUNCIÓN MEJORADA PARA DETECTAR REGALOS
  const isGiftMessage = useCallback((msg) => {
    // 🔥 PRIMERO: Verificar si tiene datos de regalo en extra_data o gift_data
    let hasGiftData = false;
    if (msg.extra_data) {
      try {
        const extraData = typeof msg.extra_data === 'string' ? JSON.parse(msg.extra_data) : msg.extra_data;
        if (extraData && (extraData.gift_name || extraData.gift_image || extraData.gift_price)) {
          hasGiftData = true;
        }
      } catch (e) {
        // Si no se puede parsear, continuar con otras verificaciones
      }
    }
    if (msg.gift_data) {
      try {
        const giftData = typeof msg.gift_data === 'string' ? JSON.parse(msg.gift_data) : msg.gift_data;
        if (giftData && (giftData.gift_name || giftData.gift_image || giftData.gift_price)) {
          hasGiftData = true;
        }
      } catch (e) {
        // Si no se puede parsear, continuar con otras verificaciones
      }
    }
    
    const result = (
      // Tipos específicos de regalo
      msg.type === 'gift_request' || 
      msg.type === 'gift_sent' || 
      msg.type === 'gift_received' || 
      msg.type === 'gift' ||
      msg.type === 'gift_rejected' ||
      // 🔥 Si tiene datos de regalo, es un regalo
      hasGiftData ||
      // Texto que indica regalo
      (msg.text && (
        msg.text.includes('🎁 Solicitud de regalo') ||
        msg.text.includes('Solicitud de regalo') ||
        msg.text.includes('🎁 Enviaste:') ||
        msg.text.includes('🎁 Recibiste:') ||
        msg.text.includes('Enviaste:') ||
        msg.text.includes('Recibiste:') ||
        msg.text.includes('Te envió:') ||
        msg.text.includes('Te envio:') ||
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
        msg.message.includes('Recibiste:') ||
        msg.message.includes('Te envió:') ||
        msg.message.includes('Te envio:')
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
          giftData = { ...msg.extra_data };
        }
      } catch (e) {
        console.warn('Error parsing extra_data:', e);
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
        console.warn('Error parsing gift_data:', e);
      }
    }
    
    // 🔥 DEBUG: Log para ver qué datos se están extrayendo
    if (msg.type === 'gift_received' || msg.extra_data || msg.gift_data) {
      console.log('🔍 [PARSE] Mensaje:', {
        type: msg.type,
        has_extra_data: !!msg.extra_data,
        has_gift_data: !!msg.gift_data,
        parsed_gift_name: giftData.gift_name,
        parsed_gift_image: giftData.gift_image,
        parsed_gift_price: giftData.gift_price
      });
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
      
      // Para recibidos: "🎁 Recibiste: Nombre del Regalo" o "Te envió: Nombre del Regalo"
      const receivedMatch = text.match(/(?:Recibiste:|Te envió:|Te envio:)\s*(.+?)(?:\s*-|$)/);
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

  const buildCompleteImageUrl = (imagePath) => {
    if (!imagePath) {
      return null;
    }
    
    // Si ya es una URL completa
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // Si ya tiene parámetros, no agregar más
      return imagePath.includes('?') ? imagePath : `${imagePath}?t=${Date.now()}`;
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
    
    // Agregar hash del nombre del archivo como versión para invalidar caché
    // Agregar nombre del archivo como versión para invalidar caché cuando cambie
    const version = fileName ? encodeURIComponent(fileName).substring(0, 20) : Date.now();
    return `${finalUrl}?v=${version}`;
  };

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
      }
    }
    
    // 🔥 LIMPIAR TRADUCCIONES Y IDs PROCESADOS
    setTranslations(new Map());
    setTranslatingIds(new Set());
    processedMessageIdsRef.current = new Set(); // ¡IMPORTANTE!
  };

  return (
    <div className="w-full lg:w-[300px] xl:w-[320px] flex-shrink-0 bg-gradient-to-b from-[#0a0d10] to-[#131418] backdrop-blur-xl rounded-2xl flex flex-col justify-between relative border border-[#ff007a]/20 shadow-2xl overflow-hidden" style={{ maxHeight: 'calc(100vh - 180px)', minHeight: 0 }}>
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

          </div>
        </div>
      </div>
      
      {/* 🔥 ÁREA DE MENSAJES REDISEÑADA CON AUTO-SCROLL */}
      <div className="flex-1 relative" style={{ minHeight: 0, maxHeight: 'calc(100vh - 280px)' }}>
        <div 
          ref={messagesContainerRef}
          className="flex-1 p-3 space-y-3 overflow-y-auto custom-scroll flex flex-col"
          style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 0, height: '100%' }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center flex-1 min-h-0">
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
            <div className="flex flex-col">
            {stableMessages.map((msg, index) => {
              // 🔥 CONTROL DE LOGGING - Solo log si no se ha procesado antes
              if (!processedMessageIdsRef.current.has(msg.id)) {
                processedMessageIdsRef.current.add(msg.id);
              }

              // 🔥 VERIFICAR SI ES MENSAJE DE REGALO
              const isGift = isGiftMessage(msg);

              return (
              <div key={`${msg.id}-${index}`} className="space-y-3">
                  
                  {/* 🔥 RENDERIZADO DE REGALOS - FLUJO CRONOLÓGICO CORREGIDO */}
                  {isGift && (() => {
                    const giftData = parseGiftData(msg);
                    const imageUrl = buildCompleteImageUrl(giftData.gift_image);

                    // 🔥 DETERMINAR TIPO DE REGALO Y QUIÉN LO ENVIÓ (DESDE PERSPECTIVA DE MODELO)
                    const isFromCurrentUser = msg.user_id === userData?.id || 
                                            msg.user_name === userData?.name ||
                                            msg.senderRole === 'modelo' ||
                                            msg.user_role === 'modelo' ||
                                            msg.type === 'local';

                    // Para modelo: gift_request viene del cliente (cliente pide regalo)
                    const isRequestFromClient = (msg.type === 'gift_request') && !isFromCurrentUser;
                    // 🔥 NUEVO: gift_request enviado por la modelo (modelo pide regalo al cliente)
                    const isRequestFromModel = (msg.type === 'gift_request') && isFromCurrentUser;
                    // gift_received es cuando la modelo recibe un regalo del cliente
                    const isGiftReceivedByModel = (msg.type === 'gift_received') && 
                                                  (msg.user_role === 'cliente' || msg.senderRole === 'cliente' || !isFromCurrentUser);
                    // gift_sent sería cuando la modelo envía algo (raro)
                    const isGiftSentByModel = (msg.type === 'gift_sent') && isFromCurrentUser;
                    const isRejectedByModel = (msg.type === 'gift_rejected') && isFromCurrentUser;
                    
                    // 🔥 DEBUG: Log para ver qué está pasando
                    if (giftData.gift_name) {
                      console.log('🎁 [MODELO] Regalo detectado:', {
                        type: msg.type,
                        gift_name: giftData.gift_name,
                        gift_image: giftData.gift_image,
                        gift_price: giftData.gift_price,
                        isFromCurrentUser,
                        user_role: msg.user_role,
                        senderRole: msg.senderRole,
                        isGiftReceivedByModel,
                        hasReceivedGiftData: giftData.gift_name && !isFromCurrentUser
                      });
                    }

                    // 🔥 1. SOLICITUD DE REGALO (viene del cliente - cliente pide regalo a modelo)
                    if (isRequestFromClient || 
                        (!isFromCurrentUser && (
                          (msg.text && msg.text.includes('Solicitud de regalo')) ||
                          (msg.message && msg.message.includes('Solicitud de regalo'))
                        ))) {
                      
                      return (
                        <div className="space-y-2">
                          
                          {/* 🔥 HEADER DEL MENSAJE (como los mensajes normales) */}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <div className="message-avatar bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-full flex items-center justify-center">
                                <span className="text-white avatar-text font-bold">
                                  {otherUser?.name?.charAt(0)?.toUpperCase() || 'C'}
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
                                      loading="lazy"
                                      decoding="async"
                                      key={`gift-${giftData.gift_name}-${imageUrl}`}
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

                    // 🔥 2. REGALO RECIBIDO (la modelo recibe regalo del cliente) - PRIORIDAD ALTA
                    // Detectar si es un regalo recibido: tiene tipo gift_received O tiene datos de regalo y no es del usuario actual
                    const hasReceivedGiftData = giftData.gift_name && !isFromCurrentUser;
                    const isFromClient = msg.user_role === 'cliente' || msg.senderRole === 'cliente' || msg.user_role === 'client';
                    
                    // 🔥 PRIORIDAD: Si tiene datos de regalo y viene de un cliente, es regalo recibido
                    // También verificar si el mensaje tiene información de regalo aunque no tenga el tipo
                    const hasGiftInfo = giftData.gift_name || giftData.gift_image || giftData.gift_price;
                    
                    if (msg.type === 'gift_received' ||
                        isGiftReceivedByModel ||
                        (hasGiftInfo && !isFromCurrentUser && (isFromClient || !msg.user_role)) ||
                        (hasReceivedGiftData && !isFromCurrentUser) ||
                        (!isFromCurrentUser && (
                          (msg.text && (msg.text.includes('Recibiste:') || msg.text.includes('Te envió:') || msg.text.includes('Te envio:'))) ||
                          (msg.message && (msg.message.includes('Recibiste:') || msg.message.includes('Te envió:') || msg.message.includes('Te envio:')))
                        ))) {
                      
                      // Obtener nombre del usuario que envió el regalo
                      const senderName = msg.user_name || otherUser?.name || safeGetDisplayName() || 'Usuario';
                      
                      return (
                        <div className="space-y-2">
                          
                          {/* 🔥 HEADER DEL MENSAJE (como los mensajes normales) */}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <div className="message-avatar bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-full flex items-center justify-center">
                                <span className="text-white avatar-text font-bold">
                                  {senderName.charAt(0).toUpperCase() || 'C'}
                                </span>
                              </div>
                              <span className="username-text text-[#ff007a] font-medium">
                                {senderName}
                              </span>
                            </div>
                          </div>

                          {/* 🔥 CARD DE REGALO RECIBIDO */}
                          <div className="flex justify-start">
                            <div className="bg-gradient-to-br from-green-900/40 via-emerald-900/40 to-teal-900/40 rounded-xl gift-card-received border border-green-300/30 shadow-lg backdrop-blur-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full gift-icon-container">
                                  <Gift size={16} className="text-white" />
                                </div>
                                <span className="text-green-100 gift-title font-semibold">🎉 ¡Regalo Recibido!</span>
                              </div>
                              
                              <div className="mb-3 flex justify-center">
                                <div className="gift-image-container bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-green-300/30">
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={giftData.gift_name}
                                      className="gift-image object-contain"
                                      loading="lazy"
                                      decoding="async"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        const fallback = e.target.parentNode.querySelector('.gift-fallback');
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`gift-fallback ${imageUrl ? 'hidden' : 'flex'} gift-fallback-icon items-center justify-center`}>
                                    <Gift size={20} className="text-green-300" />
                                  </div>
                                </div>
                              </div>
                              
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
                        </div>
                      );
                    }

                    // 🔥 3. SOLICITUD DE REGALO ENVIADA POR LA MODELO (modelo pide regalo al cliente)
                    if (isRequestFromModel || 
                        (isFromCurrentUser && (
                          (msg.text && (msg.text.includes('Pediste:') || msg.text.includes('Pediste un regalo'))) ||
                          (msg.message && (msg.message.includes('Pediste:') || msg.message.includes('Pediste un regalo')))
                        ))) {
                      
                      return (
                        <div className="flex justify-end">
                          <div className="bg-gradient-to-br from-purple-900/40 via-purple-800/40 to-purple-900/40 rounded-xl gift-card-request border border-purple-300/30 shadow-lg backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-full gift-icon-container">
                                <Gift size={16} className="text-white" />
                              </div>
                              <span className="text-purple-100 gift-title font-semibold">🎁 Pediste un regalo</span>
                            </div>
                            
                            <div className="mb-3 flex justify-center">
                              <div className="gift-image-container bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-purple-300/30">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={giftData.gift_name || 'Regalo'}
                                    className="gift-image object-contain"
                                    loading="lazy"
                                    decoding="async"
                                    key={`gift-request-${giftData.gift_name}-${imageUrl}`}
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
                              
                              <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-lg gift-price-container border border-purple-300/30">
                                <span className="text-purple-200 font-bold gift-price-text">
                                  ✨ {giftData.gift_price} monedas
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

                    // 🔥 4. REGALO ENVIADO (la modelo envía algo - raro)
                    if (isGiftSentByModel || 
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
                                    loading="lazy"
                                    decoding="async"
                                    key={`gift-sent-${giftData.gift_name}-${imageUrl}`}
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

                    // 🔥 5. REGALO RECHAZADO
                    if (isRejectedByModel || 
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
                                  {otherUser?.name?.charAt(0)?.toUpperCase() || 'C'}
                                </span>
                              </div>
                              <span className="username-text text-[#ff007a] font-medium">
                                {msg.user_name || (msg.senderRole === 'chico' || msg.user_role === 'cliente' ? safeGetDisplayName() : 'Usuario')}
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
      
      {/* 🔥 INPUT DE CHAT REDISEÑADO PARA MODELO */}
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
                placeholder={typeof t === 'function' ? (t('chat.respondToClient') || 'Responde al chico...') : 'Responde al chico...'}
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

            {/* 🔥 BOTÓN DE REGALO MOVIDO AQUÍ */}
            <button
              onClick={() => setShowGiftsModal(true)}
              disabled={!otherUser}
              className={`
                relative button-container rounded-lg transition-all duration-300 hover:scale-110 group overflow-hidden
                ${!otherUser 
                  ? 'bg-gray-800/50 text-gray-500 opacity-50 cursor-not-allowed' 
                  : 'bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30 border border-[#ff007a]/30 shadow-lg'
                }
              `}
              title="Pedir regalo"
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
          </div>
        </div>
      </div>

      
      {/* 🎁 AUDIO INVISIBLE PARA REGALOS - NUEVO */}
      <div className="hidden">
        <audio id="gift-sound" preload="auto">
          <source src="/sounds/gift-received.mp3" type="audio/mpeg" />
          <source src="/sounds/gift-received.wav" type="audio/wav" />
        </audio>
      </div>
      
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
    </div>
  );
};

export default DesktopChatPanel;