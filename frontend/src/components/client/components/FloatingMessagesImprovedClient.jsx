import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, ChevronDown, Gift, Settings, Globe } from 'lucide-react';
import { useGlobalTranslation } from '../../../contexts/GlobalTranslationContext';

const FloatingMessagesImprovedClient = ({ 
  messages = [], 
  userData = {},
  userBalance = 0,
  handleAcceptGift = null,
  handleRejectGift = null,
  t 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // 🔥 OBTENER CONTEXTO GLOBAL COMPLETO DE TRADUCCIÓN
  const { 
    translateGlobalText, 
    isEnabled: translationEnabled,
    changeGlobalLanguage,
    currentLanguage: globalCurrentLanguage 
  } = useGlobalTranslation();

  // 🔥 ESTADOS PARA MODAL DE CONFIGURACIÓN Y TRADUCCIÓN
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('selectedLanguage') || globalCurrentLanguage || 'es';
  });

  // 🔥 ESTADO LOCAL PARA TRADUCCIÓN - HABILITAR POR DEFECTO PARA TESTING
  const [localTranslationEnabled, setLocalTranslationEnabled] = useState(() => {
    const saved = localStorage.getItem('translationEnabled');
    // 🔥 HABILITAR POR DEFECTO PARA TESTING
    return saved === 'true' || saved === null;
  });

  // 🔥 ESTADOS PARA EL SISTEMA DE TRADUCCIÓN
  const [translations, setTranslations] = useState(new Map());
  const [translatingIds, setTranslatingIds] = useState(new Set());

  // 🔥 FUNCIÓN PARA DETECTAR IDIOMA DEL TEXTO
  const detectLanguage = useCallback((text) => {
    const cleanText = text.toLowerCase().trim();
    
    // Palabras características de cada idioma
    const spanishWords = ['hola', 'como', 'estás', 'gracias', 'por', 'favor', 'buenas', 'noches', 'días', 'tardes', 'hermosa', 'bonita', 'guapa'];
    const englishWords = ['hello', 'how', 'are', 'you', 'thank', 'thanks', 'please', 'good', 'morning', 'night', 'afternoon', 'beautiful', 'pretty'];
    const frenchWords = ['bonjour', 'comment', 'allez', 'vous', 'merci', 'sil', 'vous', 'plait', 'bonne', 'nuit', 'jour', 'belle'];
    
    // Contar coincidencias
    const spanishMatches = spanishWords.filter(word => cleanText.includes(word)).length;
    const englishMatches = englishWords.filter(word => cleanText.includes(word)).length;
    const frenchMatches = frenchWords.filter(word => cleanText.includes(word)).length;
    
    if (spanishMatches > 0) return 'es';
    if (englishMatches > 0) return 'en';
    if (frenchMatches > 0) return 'fr';
    
    // Si no detecta, asumir español por defecto
    return 'es';
  }, []);

  // 🔥 FUNCIÓN FALLBACK PARA TRADUCCIÓN - EXPANDIDA Y MEJORADA
  const translateWithFallback = useCallback(async (text, targetLang) => {
    try {
      console.log('🔄 [FLOATING-CLIENT] Usando traducción fallback para:', `"${text}"`, 'a idioma:', targetLang);
      
      const cleanText = text.toLowerCase().trim();
      const detectedLang = detectLanguage(text);
      
      console.log('🔍 [FLOATING-CLIENT] Idioma detectado:', detectedLang, 'Target:', targetLang);
      
      // Si el texto ya está en el idioma objetivo, no traducir
      if (detectedLang === targetLang) {
        console.log('⏸️ [FLOATING-CLIENT] Texto ya está en idioma objetivo');
        return null;
      }
      
      // 🔥 DICCIONARIO EXPANDIDO CON MÁS PALABRAS
      const translations = {
        // Español a otros idiomas
        'es-en': {
          // Saludos básicos
          'hola': 'hello',
          'hi': 'hi',
          'buenas': 'hi',
          'buenos dias': 'good morning',
          'buenos días': 'good morning',
          'buenas noches': 'good night',
          'buenas tardes': 'good afternoon',
          
          // Preguntas comunes
          'como estas': 'how are you',
          'como estás': 'how are you',
          'como estas?': 'how are you?',
          'como estás?': 'how are you?',
          'que tal': 'how are you',
          'qué tal': 'how are you',
          'que': 'what',
          'qué': 'what',
          'cuando': 'when',
          'cuándo': 'when',
          'donde': 'where',
          'dónde': 'where',
          'como': 'how',
          'cómo': 'how',
          'por que': 'why',
          'por qué': 'why',
          'porque': 'because',
          
          // Respuestas básicas
          'bien': 'good',
          'mal': 'bad',
          'si': 'yes',
          'sí': 'yes',
          'no': 'no',
          'tal vez': 'maybe',
          'quizas': 'maybe',
          'quizás': 'maybe',
          
          // Cortesía
          'gracias': 'thank you',
          'por favor': 'please',
          'disculpa': 'excuse me',
          'lo siento': 'sorry',
          'perdón': 'sorry',
          
          // Emociones y sentimientos
          'te amo': 'I love you',
          'te quiero': 'I love you',
          'amor': 'love',
          'corazón': 'heart',
          'beso': 'kiss',
          'besos': 'kisses',
          
          // Apariencia
          'hermosa': 'beautiful',
          'guapa': 'beautiful',
          'bonita': 'pretty',
          'linda': 'cute',
          'sexy': 'sexy',
          'bella': 'beautiful',
          
          // Velocidad y tiempo
          'lento': 'slow',
          'muy lento': 'very slow',
          'rapido': 'fast',
          'rápido': 'fast',
          'despacio': 'slowly',
          'pronto': 'soon',
          'ahora': 'now',
          'después': 'later',
          'antes': 'before',
          
          // Palabras comunes
          'real': 'real',
          'verdad': 'truth',
          'mentira': 'lie',
          'grande': 'big',
          'pequeño': 'small',
          'nuevo': 'new',
          'viejo': 'old',
          'joven': 'young',
          'alto': 'tall',
          'bajo': 'short',
          
          // Frases específicas del chat
          'que gnr traducción': 'what a great translation',
          'pero entonces dios mío': 'but then my god',
          'si traduce va': 'if it translates go',
          'traducción': 'translation',
          'traduce': 'translate',
          'idioma': 'language',
          'hablar': 'speak',
          'decir': 'say',
          'escribir': 'write',
          
          // Palabras sueltas comunes
          'pero': 'but',
          'entonces': 'then',
          'dios': 'god',
          'mío': 'mine',
          'va': 'go',
          'vamos': 'let\'s go',
          'ven': 'come',
          'dame': 'give me',
          'toma': 'take',
          'mira': 'look',
          'ver': 'see',
          'oír': 'hear',
          'sentir': 'feel'
        },
        // Inglés a español  
        'en-es': {
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
          'maybe': 'tal vez',
          'good morning': 'buenos días',
          'good night': 'buenas noches',
          'good afternoon': 'buenas tardes',
          'i love you': 'te amo',
          'love': 'amor',
          'beautiful': 'hermosa',
          'pretty': 'bonita',
          'cute': 'linda',
          'slow': 'lento',
          'very slow': 'muy lento',
          'fast': 'rápido',
          'real': 'real',
          'truth': 'verdad',
          'lie': 'mentira',
          'big': 'grande',
          'small': 'pequeño',
          'translation': 'traducción',
          'translate': 'traduce',
          'language': 'idioma',
          'but': 'pero',
          'then': 'entonces',
          'god': 'dios',
          'mine': 'mío',
          'go': 'va'
        },
        // Español a alemán
        'es-de': {
          'hola': 'hallo',
          'como estas': 'wie geht es dir',
          'como estás': 'wie geht es dir',
          'bien': 'gut',
          'gracias': 'danke',
          'por favor': 'bitte',
          'si': 'ja',
          'sí': 'ja',
          'no': 'nein',
          'buenas noches': 'gute nacht',
          'buenos días': 'guten tag',
          'hermosa': 'schön',
          'bonita': 'hübsch',
          'lento': 'langsam',
          'muy lento': 'sehr langsam'
        },
        // Español a francés
        'es-fr': {
          'hola': 'bonjour',
          'como estas': 'comment allez-vous',
          'como estás': 'comment allez-vous',
          'bien': 'bien',
          'gracias': 'merci',
          'por favor': 's\'il vous plaît',
          'si': 'oui',
          'sí': 'oui',
          'no': 'non',
          'buenas noches': 'bonne nuit',
          'buenos días': 'bonjour',
          'hermosa': 'belle',
          'bonita': 'jolie',
          'lento': 'lent',
          'muy lento': 'très lent'
        },
        // Francés a español
        'fr-es': {
          'bonjour': 'hola',
          'comment allez-vous': 'cómo estás',
          'bien': 'bien',
          'merci': 'gracias',
          'oui': 'sí',
          'non': 'no',
          'bonne nuit': 'buenas noches',
          'belle': 'hermosa',
          'jolie': 'bonita'
        },
        // Inglés a francés
        'en-fr': {
          'hello': 'bonjour',
          'hi': 'salut',
          'how are you': 'comment allez-vous',
          'good': 'bien',
          'thank you': 'merci',
          'thanks': 'merci',
          'please': 's\'il vous plaît',
          'yes': 'oui',
          'no': 'non',
          'good morning': 'bonjour',
          'good night': 'bonne nuit',
          'beautiful': 'belle',
          'pretty': 'jolie'
        },
        // Francés a inglés
        'fr-en': {
          'bonjour': 'hello',
          'salut': 'hi',
          'comment allez-vous': 'how are you',
          'bien': 'good',
          'merci': 'thank you',
          'oui': 'yes',
          'non': 'no',
          'bonne nuit': 'good night',
          'belle': 'beautiful',
          'jolie': 'pretty'
        },
        // Español a italiano
        'es-it': {
          'hola': 'ciao',
          'como estas': 'come stai',
          'como estás': 'come stai',
          'bien': 'bene',
          'gracias': 'grazie',
          'por favor': 'per favore',
          'si': 'sì',
          'sí': 'sì',
          'no': 'no',
          'buenas noches': 'buona notte',
          'buenos días': 'buongiorno',
          'hermosa': 'bella',
          'bonita': 'carina'
        },
        // Español a portugués
        'es-pt': {
          'hola': 'olá',
          'como estas': 'como está',
          'como estás': 'como está',
          'bien': 'bem',
          'gracias': 'obrigado',
          'por favor': 'por favor',
          'si': 'sim',
          'sí': 'sim',
          'no': 'não',
          'buenas noches': 'boa noite',
          'buenos días': 'bom dia',
          'hermosa': 'linda',
          'bonita': 'bonita'
        },
        // Español a ruso
        'es-ru': {
          'hola': 'привет',
          'como estas': 'как дела',
          'como estás': 'как дела',
          'bien': 'хорошо',
          'gracias': 'спасибо',
          'por favor': 'пожалуйста',
          'si': 'да',
          'sí': 'да',
          'no': 'нет',
          'hermosa': 'красивая',
          'bonita': 'милая'
        },
        // Español a japonés
        'es-ja': {
          'hola': 'こんにちは',
          'como estas': 'げんきですか',
          'como estás': 'げんきですか',
          'bien': 'いいです',
          'gracias': 'ありがとう',
          'por favor': 'おねがいします',
          'si': 'はい',
          'sí': 'はい',
          'no': 'いいえ',
          'hermosa': 'きれい',
          'bonita': 'かわいい'
        },
        // Español a coreano
        'es-ko': {
          'hola': '안녕하세요',
          'como estas': '어떻게 지내세요',
          'como estás': '어떻게 지내세요',
          'bien': '좋아요',
          'gracias': '감사합니다',
          'por favor': '부탁합니다',
          'si': '네',
          'sí': '네',
          'no': '아니요',
          'hermosa': '아름다워요',
          'bonita': '예뻐요'
        },
        // Español a chino
        'es-zh': {
          'hola': '你好',
          'como estas': '你好吗',
          'como estás': '你好吗',
          'bien': '好',
          'gracias': '谢谢',
          'por favor': '请',
          'si': '是',
          'sí': '是',
          'no': '不',
          'hermosa': '美丽',
          'bonita': '漂亮'
        }
      };
      
      // Crear clave de traducción
      const translationKey = `${detectedLang}-${targetLang}`;
      const translationDict = translations[translationKey];
      
      // 🔥 DEBUGGING: VERIFICAR SI ENCUENTRA LA TRADUCCIÓN
      if (translationDict) {
        console.log('📚 [FLOATING-CLIENT-FALLBACK] Diccionario encontrado para:', translationKey);
        console.log('📚 [FLOATING-CLIENT-FALLBACK] Buscando:', cleanText);
        
        const translated = translationDict[cleanText];
        if (translated) {
          console.log('✅ [FLOATING-CLIENT-FALLBACK] Traducción encontrada:', `"${cleanText}"`, '->', `"${translated}"`);
          return translated;
        } else {
          console.log('❌ [FLOATING-CLIENT-FALLBACK] No se encontró traducción exacta para:', `"${cleanText}"`);
          
          // 🔥 INTENTAR BÚSQUEDA DE PALABRAS INDIVIDUALES
          console.log('🔍 [FLOATING-CLIENT-FALLBACK] Intentando traducción por palabras...');
          const words = cleanText.split(/\s+/);
          const translatedWords = words.map(word => {
            const wordTranslation = translationDict[word.toLowerCase()];
            console.log(`🔍 [FLOATING-CLIENT-FALLBACK] Palabra "${word}" → "${wordTranslation || word}"`);
            return wordTranslation || word;
          });
          
          const wordBasedTranslation = translatedWords.join(' ');
          if (wordBasedTranslation !== cleanText) {
            console.log('🎯 [FLOATING-CLIENT-FALLBACK] Traducción por palabras exitosa:', wordBasedTranslation);
            return wordBasedTranslation;
          }
        }
      } else {
        console.log('❌ [FLOATING-CLIENT-FALLBACK] No existe diccionario para:', translationKey);
        console.log('🔍 [FLOATING-CLIENT-FALLBACK] Diccionarios disponibles:', Object.keys(translations));
      }
      
      // 🔥 SI NO ENCUENTRA TRADUCCIÓN, RETORNAR NULL EN LUGAR DEL TEXTO ORIGINAL
      console.log('🚫 [FLOATING-CLIENT-FALLBACK] No se pudo traducir, retornando null');
      return null;
      
    } catch (error) {
      console.error('❌ [FLOATING-CLIENT] Error en traducción fallback:', error);
      return `[ERROR] ${text}`;
    }
  }, [detectLanguage]);
  // 🌐 FUNCIÓN PARA TRADUCIR MENSAJES - CLEAN VERSION
  const translateMessage = useCallback(async (message) => {
    if (!localTranslationEnabled || !message?.id) return;
    
    const originalText = message.text || message.content || message.message;
    if (!originalText || originalText.trim() === '' || translations.has(message.id) || translatingIds.has(message.id)) return;

    setTranslatingIds(prev => new Set(prev).add(message.id));

    try {
      let result = null;
      
      // PASO 1: Contexto global
      if (typeof translateGlobalText === 'function') {
        try {
          result = await translateGlobalText(originalText, message.id);
          if (result && result !== originalText && result.trim() !== '') {
            // Contexto global funcionó
          } else {
            result = null;
          }
        } catch (error) {
          result = null;
        }
      }
      
      // PASO 2: APIs de traducción
      if (!result) {
        try {
          // Google Translate API
          const googleTranslateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${currentLanguage}&dt=t&q=${encodeURIComponent(originalText)}`;
          
          try {
            const response = await fetch(googleTranslateUrl);
            const data = await response.json();
            
            if (data && data[0] && data[0][0] && data[0][0][0]) {
              result = data[0][0][0];
            }
          } catch (googleError) {
            // LibreTranslate API
            try {
              const libreResponse = await fetch('https://libretranslate.de/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  q: originalText,
                  source: 'es',
                  target: currentLanguage,
                  format: 'text'
                })
              });
              
              if (libreResponse.ok) {
                const libreData = await libreResponse.json();
                if (libreData.translatedText) {
                  result = libreData.translatedText;
                }
              }
            } catch (libreError) {
              // MyMemory API
              try {
                const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalText)}&langpair=es|${currentLanguage}`;
                const myMemoryResponse = await fetch(myMemoryUrl);
                const myMemoryData = await myMemoryResponse.json();
                
                if (myMemoryData.responseStatus === 200 && myMemoryData.responseData.translatedText) {
                  result = myMemoryData.responseData.translatedText;
                }
              } catch (myMemoryError) {
                // Silenciar error
              }
            }
          }
          
        } catch (apiError) {
          // Silenciar error
        }
      }
      
      // PASO 3: Traducción básica
      if (!result) {
        result = await translateWithFallback(originalText, currentLanguage);
      }
      
      // Guardar resultado
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

  // 🌐 EFECTO PARA TRADUCIR MENSAJES AUTOMÁTICAMENTE - CLEAN VERSION
  useEffect(() => {
    if (!localTranslationEnabled || messages.length === 0) return;

    messages.forEach((message) => {
      const shouldTranslate = (
        message.type !== 'system' && 
        !['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(message.type) &&
        !translations.has(message.id) &&
        !translatingIds.has(message.id) &&
        (message.text || message.content || message.message) &&
        (message.text || message.content || message.message).trim() !== ''
      );
      
      if (shouldTranslate) {
        translateMessage(message);
      }
    });

  }, [messages, localTranslationEnabled, translateMessage, currentLanguage]);

  // 🌐 COMPONENTE DE MENSAJE CON TRADUCCIÓN - CLEAN VERSION
  const renderMessageWithTranslation = useCallback((message, isOwn = false) => {
    const originalText = message.text || message.content || message.message;
    const translatedText = translations.get(message.id);
    const isTranslating = translatingIds.has(message.id);
    
    const hasTranslation = translatedText && translatedText !== originalText && translatedText.trim() !== '';

    return (
      <div className="space-y-1">
        {/* TEXTO ORIGINAL */}
        <div className="text-white">
          {originalText || 'Mensaje sin contenido'}
          {isTranslating && (
            <span className="ml-2 inline-flex items-center">
              <div className="animate-spin rounded-full h-2 w-2 border-b border-current opacity-50"></div>
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
            <span className="text-xs opacity-80">🌍 </span> {translatedText}
          </div>
        )}
      </div>
    );
  }, [translations, translatingIds, localTranslationEnabled]);

  // 🔥 IDIOMAS DISPONIBLES - EXPANDIDO A 10 IDIOMAS
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

  // 🔥 FUNCIÓN PARA CAMBIAR IDIOMA - CLEAN VERSION
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
        // Silenciar error
      }
    }
    
    setTranslations(new Map());
    setTranslatingIds(new Set());
    
    // Re-traducir mensajes existentes
    setTimeout(() => {
      messages.forEach((mensaje) => {
        if (mensaje.text || mensaje.content || mensaje.message) {
          translateMessage(mensaje);
        }
      });
    }, 100);
    
    setShowSettingsModal(false);
  };

  // 🎵 FUNCIONES DE SONIDO PARA SOLICITUDES DE REGALO
  const playGiftRequestSound = useCallback(async () => {
    try {
      console.log('🔔 [CLIENT] Reproduciendo sonido de solicitud de regalo...');
      
      // Sonido específico para solicitudes (diferente al de recibido)
      const audio = new Audio('/sounds/gift-request.mp3');
      audio.volume = 0.6; // Más suave que el de regalo recibido
      audio.preload = 'auto';
      
      try {
        await audio.play();
        console.log('🎵 [CLIENT] Sonido de solicitud reproducido');
      } catch (playError) {
        console.error('❌ Error reproduciendo sonido:', playError);
        // Sonido alternativo sintetizado
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
      
      // Melodía específica para solicitudes: más suave y expectante
      const playNote = (frequency, startTime, duration) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine'; // Más suave que triangle
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.01); // Más suave
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Melodía de "solicitud": Sol-La-Si (ascendente y expectante)
      const now = audioContext.currentTime;
      playNote(392.00, now, 0.2);        // Sol
      playNote(440.00, now + 0.15, 0.2); // La  
      playNote(493.88, now + 0.3, 0.3);  // Si
      
      console.log('🎵 [CLIENT] Sonido alternativo de solicitud reproducido');
    } catch (error) {
      console.error('❌ Error con sonido alternativo:', error);
    }
  }, []);

  // Debug: mostrar mensajes en consola
  useEffect(() => {
    console.log('📨 [CLIENT] Mensajes recibidos:', messages);
    console.log('📊 [CLIENT] Total mensajes:', messages?.length || 0);
    
    // Mostrar estadísticas de tipos de mensaje
    if (Array.isArray(messages)) {
      const stats = messages.reduce((acc, msg) => {
        const key = `${msg.type}-${msg.senderRole}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      console.log('📈 [CLIENT] Tipos de mensaje:', stats);
      
      // Mostrar IDs para debuggear el filtro
      console.log('🔢 [CLIENT] IDs de mensajes:', messages.map(m => ({ id: m.id, text: m.text?.substring(0, 20) })));
    }
  }, [messages]);

  // 🔥 MOSTRAR TODOS LOS MENSAJES - NO FILTRAR NADA
  const recentMessages = Array.isArray(messages) ? messages : [];

  // Scroll automático al último mensaje
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Detectar nuevos mensajes y abrir automáticamente
  useEffect(() => {
    const newMessageCount = Array.isArray(messages) ? messages.length : 0;
    if (newMessageCount > lastMessageCount && lastMessageCount > 0) {
      console.log('🔔 [CLIENT] Nuevo mensaje detectado!', newMessageCount - lastMessageCount);
      
      // 🔥 DETECTAR SOLICITUDES DE REGALO NUEVAS
      const newMessages = messages.slice(lastMessageCount);
      const newGiftRequests = newMessages.filter(msg => {
        // Detectar por type O por contenido de texto
        const isGiftRequestByType = msg.type === 'gift_request';
        const isGiftRequestByText = (msg.text || msg.message || '').includes('🎁 Solicitud de regalo:') || 
                                    (msg.text || msg.message || '').includes('Solicitud de regalo:');
        
        const isGiftRequest = isGiftRequestByType || isGiftRequestByText;
        const isNotFromMe = msg.user_id !== userData?.id && msg.senderRole !== 'cliente';
        
        // Debug para verificar detección
        if (isGiftRequest) {
          console.log('🔍 [SOUND] Evaluando solicitud para sonido:', {
            id: msg.id,
            type: msg.type,
            text: (msg.text || '').substring(0, 30),
            isGiftRequestByType: isGiftRequestByType,
            isGiftRequestByText: isGiftRequestByText,
            isNotFromMe: isNotFromMe,
            willPlaySound: isGiftRequest && isNotFromMe
          });
        }
        
        return isGiftRequest && isNotFromMe;
      });

      if (newGiftRequests.length > 0) {
        console.log('🎁 [CLIENT] ¡Nueva solicitud de regalo detectada! Reproduciendo sonido...');
        console.log('🎁 [CLIENT] Solicitudes encontradas:', newGiftRequests);
        
        // Reproducir sonido específico para solicitudes
        playGiftRequestSound();
        
        // Vibrar en dispositivos móviles
        if ('vibrate' in navigator) {
          navigator.vibrate([300, 100, 300]); // Patrón diferente al de regalo recibido
        }
        
        // Notificación visual si está permitido
        if (Notification.permission === 'granted') {
          new Notification('💝 Solicitud de Regalo', {
            body: '¡Una modelo te está pidiendo un regalo!',
            icon: '/favicon.ico',
            tag: 'gift-request',
            requireInteraction: true
          });
        }
      }
      
      // Nuevo mensaje llegó
      setIsOpen(true);
      setUnreadCount(prev => prev + (newMessageCount - lastMessageCount));
      
      // Scroll al nuevo mensaje después de un pequeño delay
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
    setLastMessageCount(newMessageCount);
  }, [messages?.length, lastMessageCount, userData?.id, playGiftRequestSound]);

  // Scroll al abrir el chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isOpen]);

  // Scroll automático cuando lleguen nuevos mensajes y esté abierto
  useEffect(() => {
    if (isOpen && recentMessages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [recentMessages.length, isOpen]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // 🔥 FUNCIÓN HELPER PARA PARSING SEGURO DE JSON (igual que desktop)
  const parseGiftData = (msg) => {
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
  };

  const buildCompleteImageUrl = (imagePath) => {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const cleanPath = imagePath.replace(/\\/g, '/');
    
    let finalUrl;
    if (cleanPath.startsWith('storage/')) {
      finalUrl = `${cleanBaseUrl}/${cleanPath}`;
    } else if (cleanPath.startsWith('/')) {
      finalUrl = `${cleanBaseUrl}${cleanPath}`;
    } else {
      finalUrl = `${cleanBaseUrl}/storage/gifts/${cleanPath}`;
    }
    
    return finalUrl;
  };
  // 🔥 FUNCIÓN renderGiftCard CORREGIDA CON TRADUCCIÓN
  const renderGiftCard = (msg) => {
    const giftData = parseGiftData(msg);
    const imageUrl = buildCompleteImageUrl(giftData.gift_image);
    
    // Determinar quién envió el mensaje
    const isFromCurrentUser = msg.user_id === userData?.id || 
                             msg.user_name === userData?.name ||
                             msg.senderRole === 'cliente' ||
                             msg.type === 'local';

    // 🔥 DETECTAR SOLICITUDES DE REGALO - MEJORADO
    const isGiftRequestByType = msg.type === 'gift_request';
    const isGiftRequestByText = (msg.text || msg.message || '').includes('🎁 Solicitud de regalo:') || 
                                (msg.text || msg.message || '').includes('Solicitud de regalo:');

    // 🔥 DETECTAR REGALO ENVIADO - MEJORADO
    const isGiftSentByType = msg.type === 'gift_sent';
    const isGiftSentByText = (msg.text || msg.message || '').includes('🎁 Enviaste:') ||
                             (msg.text || msg.message || '').includes('Enviaste:');

    const isGiftRequest = isGiftRequestByType || isGiftRequestByText;
    const isGiftSent = isGiftSentByType || isGiftSentByText;

    console.log('🎁 [MOBILE-CLIENT] renderGiftCard debug:', {
      id: msg.id,
      type: msg.type,
      text: (msg.text || '').substring(0, 50),
      isGiftRequest: isGiftRequest,
      isGiftSent: isGiftSent,
      isFromCurrentUser: isFromCurrentUser
    });

    // 🎁 SOLICITUD DE REGALO (de la modelo al cliente)
    if (isGiftRequest && !isFromCurrentUser) {
      console.log('🎁 [MOBILE-CLIENT] Renderizando card interactiva de solicitud');
      
      return (
        <div className="bg-gradient-to-br from-[#ff007a]/20 via-[#cc0062]/20 to-[#990047]/20 rounded-xl p-3 max-w-sm border border-[#ff007a]/30 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="bg-gradient-to-r from-[#ff007a] to-[#cc0062] rounded-full p-1.5">
              <Gift size={12} className="text-white" />
            </div>
            <span className="text-pink-100 text-xs font-semibold">Solicitud de Regalo</span>
          </div>
          
          {imageUrl && (
            <div className="mb-2 flex justify-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center overflow-hidden border-2 border-purple-300/30">
                <img
                  src={imageUrl}
                  alt={giftData.gift_name || 'Regalo'}
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const fallback = e.target.parentNode.querySelector('.gift-fallback');
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="gift-fallback hidden w-10 h-10 items-center justify-center">
                  <Gift size={16} className="text-purple-300" />
                </div>
              </div>
            </div>
          )}
          
          <div className="text-center space-y-1">
            <p className="text-white font-bold text-sm">
              {giftData.gift_name}
            </p>
            
            <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg px-2 py-1 border border-amber-300/30">
              <span className="text-amber-200 font-bold text-xs">
                ✨ {giftData.gift_price} monedas
              </span>
            </div>
            <div className="text-right mt-3">
              <span className="text-xs text-gray-500 font-medium">
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

    // 🎁 REGALO ENVIADO (del cliente) - DETECCIÓN MEJORADA
    if (isGiftSent || (isFromCurrentUser && (msg.type === 'gift_sent' || isGiftSentByText))) {
      console.log('🎁 [MOBILE-CLIENT] Renderizando card de regalo enviado');
      
      return (
        <div className="bg-gradient-to-br from-blue-900/40 via-blue-800/40 to-blue-900/40 rounded-xl p-3 max-w-sm border border-blue-400/30 shadow-lg backdrop-blur-sm ml-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-full p-1.5">
              <Gift size={12} className="text-white" />
            </div>
            <span className="text-blue-100 text-xs font-semibold">💝 Regalo Enviado</span>
          </div>
          
          {imageUrl && (
            <div className="mb-2 flex justify-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg flex items-center justify-center overflow-hidden border-2 border-blue-300/30">
                <img
                  src={imageUrl}
                  alt={giftData.gift_name || 'Regalo'}
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const fallback = e.target.parentNode.querySelector('.gift-fallback');
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="gift-fallback hidden w-10 h-10 items-center justify-center">
                  <Gift size={16} className="text-blue-300" />
                </div>
              </div>
            </div>
          )}
          
          <div className="text-center space-y-1">
            <p className="text-white font-bold text-sm">
              {giftData.gift_name}
            </p>
            
            <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-lg px-2 py-1 border border-blue-300/30">
              <span className="text-blue-200 font-bold text-xs">
                💰 {giftData.gift_price} monedas
              </span>
            </div>
            
            <div className="text-xs text-blue-300">
              ¡Enviado con amor!
            </div>
            <div className="text-right mt-3">
              <span className="text-xs text-gray-500 font-medium">
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

    // 🎁 REGALO RECIBIDO 
    if (msg.type === 'gift_received' && isFromCurrentUser) {
      return (
        <div className="bg-gradient-to-br from-green-900/40 via-emerald-900/40 to-teal-900/40 rounded-xl p-3 max-w-sm border border-green-300/30 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full p-1.5">
              <Gift size={12} className="text-white" />
            </div>
            <span className="text-green-100 text-xs font-semibold">🎉 ¡Regalo Recibido!</span>
          </div>
          
          <div className="text-center space-y-1">
            <p className="text-white font-bold text-sm">
              {giftData.gift_name}
            </p>
            
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg px-2 py-1 border border-green-300/30">
              <span className="text-green-200 font-bold text-xs">
                💰 {giftData.gift_price} monedas
              </span>
            </div>
          </div>
        </div>
      );
    }

    // 🎁 REGALO RECHAZADO
    if (msg.type === 'gift_rejected' && isFromCurrentUser) {
      return (
        <div className="bg-gradient-to-br from-red-900/40 via-red-800/40 to-red-900/40 rounded-xl p-2 max-w-sm border border-red-400/30 shadow-lg backdrop-blur-sm ml-auto">
          <div className="flex items-center justify-center gap-2">
            <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-full p-1">
              <Gift size={10} className="text-white" />
            </div>
            <span className="text-red-100 text-xs font-semibold">❌ Regalo rechazado</span>
          </div>
        </div>
      );
    }

    console.log('🚫 [MOBILE-CLIENT] Mensaje no es regalo o no cumple condiciones');
    return null;
  };

  return (
    <>
      {/* Botón flotante - FIXED para que siempre aparezca */}
      <div className="fixed bottom-4 right-2.5 pointer-events-auto z-50">
        <button
          onClick={toggleChat}
          className={`
            relative p-3 rounded-full transition-all duration-300 hover:scale-110 shadow-lg
            ${isOpen 
              ? 'bg-[#ff007a] text-white' 
              : 'bg-gray-800/80 text-white hover:bg-gray-700/80'
            }
          `}
        >
          {isOpen ? <X size={20} /> : <MessageCircle size={20} />}
          
          {/* Contador de mensajes no leídos */}
          {!isOpen && unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
          
          {/* Indicador de pulso para nuevos mensajes */}
          {!isOpen && unreadCount > 0 && (
            <div className="absolute inset-0 rounded-full bg-[#ff007a] animate-ping opacity-30"></div>
          )}
        </button>
      </div>

      {/* Burbuja de chat - TAMAÑO COMPACTO PARA NO TAPAR CÁMARA */}
      {isOpen && (
        <div className="fixed top-4 right-4 w-80 max-w-[calc(100vw-2rem)] pointer-events-auto z-[9999]" 
             style={{ 
               height: '250px',
               maxHeight: '250px',
               minHeight: '250px' 
             }}>
          <div className="bg-gray-900/95 backdrop-blur-lg rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden h-full flex flex-col">
            
            {/* Header del chat CON BOTÓN DE TRADUCCIÓN */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700/50 bg-gradient-to-r from-[#ff007a]/20 to-transparent flex-shrink-0 h-14">
              <div className="flex items-center gap-2">
                <MessageCircle size={16} className="text-[#ff007a]" />
                <h3 className="text-white font-medium text-sm">Chat</h3>
                <span className="text-xs text-gray-400">({recentMessages.length})</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* 🔥 BOTÓN DE TRADUCCIÓN DESTACADO */}
                <button
                  onClick={() => {
                    console.log('🌍 [TRANSLATION] Abriendo modal de traducción');
                    setShowSettingsModal(true);
                  }}
                  className={`p-2 rounded-lg transition-all duration-200 border ${
                    localTranslationEnabled 
                      ? 'bg-[#ff007a]/30 text-[#ff007a] border-[#ff007a]/50 shadow-lg' 
                      : 'bg-gray-700/50 text-gray-300 border-gray-600/50 hover:text-white hover:bg-gray-600/50'
                  }`}
                  title={localTranslationEnabled ? `Traduciendo a ${languages.find(l => l.code === currentLanguage)?.name}` : "Activar traducción"}
                >
                  <Globe size={14} />
                </button>
                
                <button
                  onClick={toggleChat}
                  className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Área de mensajes scrolleable */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3"
              style={{ 
                minHeight: '0',
                maxHeight: 'none'
              }}
            >
              {recentMessages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  <div>No hay mensajes aún...</div>
                  <div className="text-xs mt-2 opacity-60">
                    Debug: {JSON.stringify(messages?.slice(0, 2) || 'No messages')}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  {/* 🔥 MAP DE MENSAJES COMPLETO CON TRADUCCIÓN */}
                  {[...recentMessages].reverse().map((message, index) => {
                    // Detectar tipo de mensaje
                    const isUserMessage = message.type === 'local' && message.senderRole === 'cliente';
                    const isSystemMessage = message.type === 'system';
                    const isRemoteMessage = message.type === 'remote' && message.senderRole === 'modelo';

                    // Detectar mensajes de regalo
                    const isGiftRequest = message.type === 'gift_request';
                    const isGiftSent = message.type === 'gift_sent';
                    const isGiftReceived = message.type === 'gift_received';
                    const isGiftRejected = message.type === 'gift_rejected';

                    // También detectar por contenido de texto
                    const isGiftByText = (message.text || message.message || '').includes('🎁 Solicitud de regalo:') ||
                                        (message.text || message.message || '').includes('Solicitud de regalo:') ||
                                        (message.text || message.message || '').includes('🎁 Enviaste:') ||
                                        (message.text || message.message || '').includes('🎁 Recibiste:');

                    const isGiftMessage = isGiftRequest || isGiftSent || isGiftReceived || isGiftRejected || 
                                          message.type === 'gift' || isGiftByText;

                    // NO FILTRAR NINGÚN MENSAJE DE REGALO
                    const isGiftTextMessage = false;
                    
                    if (isGiftTextMessage) {
                      console.log('🚫 [CLIENT] Filtrando mensaje duplicado:', message.text || message.message);
                      return null;
                    }
                    
                    return (
                      <div
                        key={message.id || message._id || `msg-${index}`}
                        className="animate-in slide-in-from-bottom-2 duration-300"
                      >
                        {/* 🎁 RENDERIZAR CARDS DE REGALO */}
                        {isGiftMessage ? (
                          <div className={`flex ${isUserMessage || message.senderRole === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                            {renderGiftCard(message)}
                          </div>
                        ) : (
                          /* 💬 MENSAJES NORMALES CON TRADUCCIÓN */
                          <div className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`
                                max-w-[80%] min-w-[60px] rounded-xl px-3 py-2 shadow-md
                                ${isSystemMessage 
                                  ? 'bg-blue-500/80 border border-blue-400/50 text-blue-100' 
                                  : isUserMessage 
                                    ? 'bg-[#ff007a]/90 text-white ml-auto' 
                                    : 'bg-gray-700/90 text-white mr-auto'
                                }
                              `}
                            >
                              <div className="flex flex-col">
                                {/* Nombre del remitente (solo para mensajes remotos) */}
                                {isRemoteMessage && message.sender && (
                                  <div className="text-xs text-gray-300 mb-1 font-medium">
                                    {message.sender}
                                  </div>
                                )}
                                
                                {/* 🔥 USAR FUNCIÓN DE TRADUCCIÓN */}
                                {renderMessageWithTranslation(message, isUserMessage)}
                                
                                {/* Timestamp */}
                                <div className={`text-xs mt-1 opacity-70 ${
                                  isUserMessage ? 'text-right' : 'text-left'
                                }`}>
                                  {formatTime(message.timestamp || message.createdAt || message.time || Date.now())}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Elemento invisible para hacer scroll */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Footer compacto con información de traducción */}
            <div className="px-3 py-2 border-t border-gray-700/50 bg-gray-800/50 flex-shrink-0 h-16">
              <div className="text-xs text-gray-400 text-center">
                💬 Conversación en vivo
                {localTranslationEnabled && (
                  <span className="ml-2 text-[#ff007a] font-semibold">
                    🌍 {languages.find(l => l.code === currentLanguage)?.flag} {languages.find(l => l.code === currentLanguage)?.name}
                  </span>
                )}
                {!localTranslationEnabled && (
                  <span className="ml-2 text-gray-500">
                    • Sin traducción
                  </span>
                )}
              </div>
              {/* DEBUG INFO */}
              <div className="text-xs text-gray-600 text-center mt-1">
                Debug: Lang={currentLanguage} | Enabled={localTranslationEnabled.toString()} | Translations={translations.size}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE CONFIGURACIÓN Y TRADUCCIÓN ULTRA COMPACTO */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-xl border border-[#ff007a]/30 shadow-2xl w-72 max-h-[75vh] overflow-hidden">
            
            {/* Header del modal */}
            <div className="flex items-center justify-between p-2.5 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#ff007a]/20 rounded-lg border border-[#ff007a]/30">
                  <Globe size={14} className="text-[#ff007a]" />
                </div>
                <h2 className="text-sm font-bold text-white">Traductor Cliente</h2>
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

              {/* Estado actual de traducción */}
              <div className="mb-2.5 p-2 bg-gray-800/50 rounded-lg border border-gray-600/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-300">Estado actual:</span>
                  <div className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    localTranslationEnabled 
                      ? 'bg-green-500/20 text-green-300 border border-green-400/30' 
                      : 'bg-gray-500/20 text-gray-400 border border-gray-400/30'
                  }`}>
                    {localTranslationEnabled ? 'Activada' : 'Desactivada'}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">Idioma:</span>
                  <div className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30">
                    {languages.find(l => l.code === currentLanguage)?.name || 'Español'}
                  </div>
                </div>
              </div>

              {/* Sección de idioma */}
              <div className="mb-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe size={12} className="text-[#ff007a]" />
                  <h3 className="text-xs font-semibold text-white">Cambiar Idioma</h3>
                </div>
                
                {/* Grid de idiomas - 10 idiomas en 2 columnas */}
                <div className="grid grid-cols-2 gap-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`
                        flex items-center gap-1 p-1.5 rounded-lg transition-all duration-200
                        border text-left hover:scale-[1.02] text-xs
                        ${currentLanguage === lang.code 
                          ? 'bg-[#ff007a]/20 border-[#ff007a]/50 text-white shadow-md' 
                          : 'bg-gray-800/40 border-gray-600/30 text-gray-300 hover:bg-[#ff007a]/10 hover:border-[#ff007a]/30 hover:text-white'
                        }
                      `}
                    >
                      <span className="text-sm flex-shrink-0">{lang.flag}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">{lang.name}</p>
                      </div>
                      {currentLanguage === lang.code && (
                        <div className="w-1 h-1 bg-[#ff007a] rounded-full flex-shrink-0"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Información sobre configuración global */}
              <div className="p-2 bg-blue-500/10 border border-blue-400/30 rounded-lg">
                <div className="flex items-start gap-1.5">
                  <Settings size={10} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-blue-300 font-semibold text-xs mb-0.5">Configuración Permanente</h4>
                    <p className="text-blue-200/80 text-xs leading-tight">
                      Para cambios permanentes, ve a: Menú → Configuración → Idiomas
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="p-2 border-t border-gray-700/50 bg-gray-900/50">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Configuración temporal
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
    </>
  );
};

export default FloatingMessagesImprovedClient;