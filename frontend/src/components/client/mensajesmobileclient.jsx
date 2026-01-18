import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "./headercliente.jsx";
import { getUser } from "../../utils/auth.js";
import { useGlobalTranslation } from '../../contexts/GlobalTranslationContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useSessionValidation } from '../hooks/useSessionValidation';

import {
  MessageSquare,
  Star,
  Send,
  Search,
  Video,
  Settings,
  X,
  ArrowLeft,
  Ban,
  Gift,
  Globe
} from "lucide-react";
import EmojiPickerButton from '../common/EmojiPickerButton.jsx';

// Importaciones de sistema de regalos
import { useGiftSystem, GiftNotificationOverlay, GiftsModal } from '../GiftSystem/index.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ChatPrivadoMobile() {
  // 🔥 VALIDACIÓN DE SESIÓN: Solo clientes pueden acceder
  useSessionValidation('cliente');

  // 🔥 ESTADOS BÁSICOS PARA MÓVIL
  const [usuario, setUsuario] = useState({ id: null, name: "Usuario", rol: "cliente" });
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [busquedaConversacion, setBusquedaConversacion] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  // 🔥 ESTADOS PARA POLLING EN TIEMPO REAL
  const [pollingInterval, setPollingInterval] = useState(null);
  const [lastMessageTime, setLastMessageTime] = useState(null);

  // 🎁 ESTADOS DE REGALOS
  const [showGiftsModal, setShowGiftsModal] = useState(false);
  const [loadingGift, setLoadingGift] = useState(false);
  const typingTimeoutRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const [sendingGiftId, setSendingGiftId] = useState(null); // ID del request que se está procesando

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

  // 🔥 ESTADO LOCAL PARA TRADUCCIÓN - FIXED DEFAULT
  const [localTranslationEnabled, setLocalTranslationEnabled] = useState(() => {
    const saved = localStorage.getItem('translationEnabled');
    // 🔥 HABILITAR POR DEFECTO PARA TESTING
    return saved === 'true' || saved === null;
  });

  // 🔥 ESTADOS PARA EL SISTEMA DE TRADUCCIÓN
  const [translations, setTranslations] = useState(new Map());
  const [translatingIds, setTranslatingIds] = useState(new Set());
  const [stableMessages, setStableMessages] = useState([]);

  // 🔥 OBTENER EL HOOK DE i18n PARA ESCUCHAR CAMBIOS
  const { t, i18n: i18nInstance } = useTranslation();

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

  const navigate = useNavigate();
  const location = useLocation();
  const mensajesRef = useRef(null);
  const openChatWith = location.state?.openChatWith;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hasOpenedSpecificChatRef = useRef(false);
  
  // 🔍 LOG INICIAL AL MONTAR COMPONENTE
  useEffect(() => {
  }, []);

  // 🔥 FUNCIÓN PARA OBTENER HEADERS (useCallback para evitar problemas de inicialización)
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
    if (!conversacionActiva) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/chat/typing`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          room_name: conversacionActiva,
          is_typing: !!isTyping
        })
      });
    } catch (error) {
      // Silenciar errores de typing
    }
  }, [conversacionActiva, getAuthHeaders]);

  const handleMessageChange = useCallback((value) => {
    setNuevoMensaje(value);
    if (!conversacionActiva) return;
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
  }, [conversacionActiva, sendTypingStatus]);

  useEffect(() => {
    if (!conversacionActiva) {
      setIsOtherTyping(false);
      return;
    }

    const fetchTypingStatus = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/typing/${conversacionActiva}`, {
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
  }, [conversacionActiva, getAuthHeaders, sendTypingStatus]);

  // 🎁 SISTEMA DE REGALOS
  const giftSystem = useGiftSystem(usuario.id, usuario.rol, getAuthHeaders, API_BASE_URL);
  
  // 🔥 Destructuring seguro con valores por defecto para evitar errores de inicialización
  const {
    gifts = [],
    loadingGifts = false,
    pendingRequests = [],
    loadingRequests = false,
    loadGifts,
    loadPendingRequests,
    setPendingRequests,
    acceptGiftRequest,
    sendGiftSimple,
    rejectGiftRequest,
    requestGift,
    generateSessionToken,
    userBalance = 0,
    setUserBalance,
    loadUserBalance
  } = giftSystem || {};
  
  // 🔥 Verificar que sendGiftSimple esté disponible
  useEffect(() => {
    
    if (!sendGiftSimple && giftSystem) {
    }
  }, [sendGiftSimple, giftSystem]);

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

  // 🔥 FUNCIÓN FALLBACK PARA TRADUCCIÓN - MEJORADA
  const translateWithFallback = useCallback(async (text, targetLang) => {
    try {
            
      const cleanText = text.toLowerCase().trim();
      const detectedLang = detectLanguage(text);
      
            
      // Si el texto ya está en el idioma objetivo, no traducir
      if (detectedLang === targetLang) {
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
        }
      };
      
      // Crear clave de traducción
      const translationKey = `${detectedLang}-${targetLang}`;
      const translationDict = translations[translationKey];
      
      // 🔥 DEBUGGING: VERIFICAR SI ENCUENTRA LA TRADUCCIÓN
      if (translationDict) {
                                
        const translated = translationDict[cleanText];
        if (translated) {
                    return translated;
        } else {
                              
          // 🔥 INTENTAR BÚSQUEDA DE PALABRAS INDIVIDUALES
                    const words = cleanText.split(/\s+/);
          const translatedWords = words.map(word => {
            const wordTranslation = translationDict[word.toLowerCase()];
                        return wordTranslation || word;
          });
          
          const wordBasedTranslation = translatedWords.join(' ');
          if (wordBasedTranslation !== cleanText) {
                        return wordBasedTranslation;
          }
        }
      } else {
                      }
      
      // 🔥 SI NO ENCUENTRA TRADUCCIÓN, RETORNAR NULL EN LUGAR DEL TEXTO ORIGINAL
            return null;
      
    } catch (error) {
            return `[ERROR] ${text}`;
    }
  }, [detectLanguage]);
  // 🌐 FUNCIÓN PARA TRADUCIR MENSAJES - CLEAN VERSION
  const translateMessage = useCallback(async (message) => {
    if (!localTranslationEnabled || !message?.id) return;
    
    const originalText = message.text || message.message;
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
    if (!localTranslationEnabled || mensajes.length === 0) return;

    mensajes.forEach((message) => {
      const shouldTranslate = (
        message.type !== 'system' && 
        !['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(message.type) &&
        !translations.has(message.id) &&
        !translatingIds.has(message.id) &&
        (message.text || message.message) &&
        (message.text || message.message).trim() !== ''
      );
      
      if (shouldTranslate) {
        translateMessage(message);
      }
    });

  }, [mensajes, localTranslationEnabled, translateMessage, currentLanguage]);

  // 🌐 COMPONENTE DE MENSAJE CON TRADUCCIÓN - CLEAN VERSION
  const renderMessageWithTranslation = useCallback((message, isOwn = false) => {
    const originalText = message.text || message.message;
    const translatedText = translations.get(message.id);
    const isTranslating = translatingIds.has(message.id);
    
    const hasTranslation = translatedText && translatedText !== originalText && translatedText.trim() !== '';

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
            <span className="text-xs opacity-80">🌍 </span> {translatedText}
          </div>
        )}
      </div>
    );
  }, [translations, translatingIds, localTranslationEnabled]);

  // 🎁 FUNCIÓN PARA CONSTRUIR URL DE IMAGEN
  const buildCompleteImageUrl = (imagePath, baseUrl = API_BASE_URL) => {
    if (!imagePath) return null;
    
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    let finalUrl;
    let fileName;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath.includes('?') ? imagePath : `${imagePath}?t=${Date.now()}`;
    }
    
    const cleanImagePath = imagePath.replace(/\\/g, '/');
    
    if (cleanImagePath.startsWith('storage/')) {
      // Codificar el nombre del archivo para caracteres especiales
      const pathParts = cleanImagePath.split('/');
      fileName = pathParts.pop();
      const directory = pathParts.join('/');
      const encodedFileName = encodeURIComponent(fileName);
      finalUrl = `${cleanBaseUrl}/${directory}/${encodedFileName}`;
    } else if (cleanImagePath.startsWith('/')) {
      // Codificar el nombre del archivo
      const pathParts = cleanImagePath.split('/');
      fileName = pathParts.pop();
      const directory = pathParts.join('/');
      const encodedFileName = encodeURIComponent(fileName);
      finalUrl = `${cleanBaseUrl}${directory}/${encodedFileName}`;
    } else {
      // image.png -> http://domain.com/storage/gifts/image.png
      fileName = cleanImagePath;
      const encodedFileName = encodeURIComponent(cleanImagePath);
      finalUrl = `${cleanBaseUrl}/storage/gifts/${encodedFileName}`;
    }
    
    // Agregar nombre del archivo como versión para invalidar caché cuando cambie
    const version = fileName ? encodeURIComponent(fileName).substring(0, 20) : Date.now();
    return `${finalUrl}?v=${version}`;
  };

  // 🎁 RENDERIZAR MENSAJES CON CARDS DE REGALO Y TRADUCCIÓN
  const renderMensaje = (mensaje) => {
    const textoMensaje = mensaje.message || mensaje.text || null;
    const esUsuarioActual = mensaje.user_id === usuario.id;

    if ((!textoMensaje || textoMensaje.trim() === '') && 
        !['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(mensaje.type)) {
      return null;
    }

    switch (mensaje.type) {
      case 'gift_request':
        const giftData = mensaje.gift_data || mensaje.extra_data || {};
        let finalGiftData = giftData;
        
        if (typeof mensaje.extra_data === 'string') {
          try {
            finalGiftData = JSON.parse(mensaje.extra_data);
          } catch (e) {
            finalGiftData = giftData;
          }
        }
        
        // 🔥 También intentar parsear gift_data si es string
        if (typeof mensaje.gift_data === 'string') {
          try {
            const parsedGiftData = JSON.parse(mensaje.gift_data);
            finalGiftData = { ...finalGiftData, ...parsedGiftData };
          } catch (e) {
            // Ignorar error
          }
        }
        
        // 🔥 Debug: Log de los datos del mensaje
        if (!finalGiftData.request_id && !finalGiftData.transaction_id) {
        }
        
        let imageUrl = null;
        if (finalGiftData.gift_image) {
          imageUrl = buildCompleteImageUrl(finalGiftData.gift_image);
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
                    loading="lazy"
                    decoding="async"
                    key={`gift-request-mobile-${finalGiftData.gift_name}-${imageUrl}`}
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
                {finalGiftData.gift_name || 'Regalo Especial'}
              </p>
              
              {finalGiftData.gift_price && (
                <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg px-3 py-1 border border-amber-300/30">
                  <span className="text-amber-200 font-bold text-sm">
                    ✨ {finalGiftData.gift_price} minutos
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
              
              {/* 🔥 BOTÓN REGALAR PARA CLIENTES (cuando la modelo les pide un regalo) */}
              {usuario.rol === 'cliente' && (finalGiftData.request_id || finalGiftData.transaction_id || mensaje.id) && (
                <button
                  onClick={async () => {
                    const requestId = finalGiftData.request_id || finalGiftData.transaction_id || mensaje.id;
                    
                    setSendingGiftId(requestId);
                    
                    try {
                      let securityHash = null;
                      
                      // 🔥 INTENTO 1: Buscar en el estado pendingRequests actual (más rápido)
                      if (pendingRequests && pendingRequests.length > 0) {
                        const pendingRequest = pendingRequests.find(req => req.id === parseInt(requestId));
                        if (pendingRequest && pendingRequest.security_hash) {
                          securityHash = pendingRequest.security_hash;
                        }
                      }
                      
                      // 🔥 INTENTO 2: Cargar pendingRequests si no se encontró
                      if (!securityHash) {
                        try {
                          // 🔥 Asegurar que loadPendingRequests siempre retorne algo
                          let loadResult = await loadPendingRequests();
                          
                          // 🔥 Si loadResult es undefined o null, crear un objeto por defecto
                          if (!loadResult || typeof loadResult !== 'object') {
                            loadResult = { success: false, requests: [], error: 'Resultado inválido' };
                          }
                          
                          
                          // 🔥 Verificar que loadResult existe y tiene la estructura esperada
                          if (loadResult && typeof loadResult === 'object') {
                            if (loadResult.success && loadResult.requests && Array.isArray(loadResult.requests)) {
                              const pendingRequest = loadResult.requests.find(req => req.id === parseInt(requestId));
                              if (pendingRequest && pendingRequest.security_hash) {
                                securityHash = pendingRequest.security_hash;
                              } else {
                              }
                            } else {
                              console.log('⚠️ [CLIENT MOBILE] loadPendingRequests falló:', {
                                success: loadResult.success,
                                hasRequests: !!loadResult.requests,
                                isArray: Array.isArray(loadResult.requests),
                                // Error handled
                              });
                            }
                          }
                          
                          // 🔥 Fallback: Intentar usar el estado actual de pendingRequests
                          if (!securityHash && pendingRequests && pendingRequests.length > 0) {
                            const pendingRequest = pendingRequests.find(req => req.id === parseInt(requestId));
                            if (pendingRequest && pendingRequest.security_hash) {
                              securityHash = pendingRequest.security_hash;
                            }
                          }
                        } catch (loadError) {
                          // Continuar sin security_hash - el backend puede generarlo
                        }
                      }
                      
                      // 🔥 INTENTO 3: Intentar del mensaje (finalGiftData)
                      if (!securityHash) {
                        securityHash = finalGiftData.security_hash || finalGiftData.securityHash || null;
                        if (securityHash) {
                        }
                      }
                      
                      // 🔥 INTENTO 4: Intentar extraer del extra_data del mensaje directamente
                      if (!securityHash && mensaje.extra_data) {
                        try {
                          const extraData = typeof mensaje.extra_data === 'string' 
                            ? JSON.parse(mensaje.extra_data) 
                            : mensaje.extra_data;
                          securityHash = extraData.security_hash || extraData.securityHash || null;
                          if (securityHash) {
                          }
                        } catch (e) {
                        }
                      }
                      
                      // 🔥 INTENTO 5: Intentar del gift_data del mensaje directamente
                      if (!securityHash && mensaje.gift_data) {
                        try {
                          const giftData = typeof mensaje.gift_data === 'string' 
                            ? JSON.parse(mensaje.gift_data) 
                            : mensaje.gift_data;
                          securityHash = giftData.security_hash || giftData.securityHash || null;
                          if (securityHash) {
                          }
                        } catch (e) {
                        }
                      }
                      
                      // 🔥 INTENTO 6: Si aún no tenemos security_hash, intentar aceptar sin él (el backend puede generarlo)
                      // El backend tiene lógica para generar el hash si no se proporciona
                      if (!securityHash) {
                        // Continuar sin security_hash - el backend puede manejarlo
                      }
                      
                      // 🔥 Asegurar que requestId sea un número válido
                      const validRequestId = parseInt(requestId);
                      if (isNaN(validRequestId)) {
                        alert('Error: ID de solicitud inválido. Por favor, recarga la página.');
                        return;
                      }
                      
                      // 🔥 Usar el nuevo método sendGiftSimple que es más directo
                      await handleSendGiftSimple(validRequestId);
                    } catch (error) {
                      alert('Error inesperado. Por favor, intenta nuevamente.');
                    } finally {
                      setSendingGiftId(null);
                    }
                  }}
                  disabled={loadingGift || sendingGiftId === (finalGiftData.request_id || finalGiftData.transaction_id || mensaje.id)}
                  className="mt-4 w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingGift || sendingGiftId === (finalGiftData.request_id || finalGiftData.transaction_id || mensaje.id) ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Gift size={16} />
                      <span>Regalar</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        );

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
        
        let receivedImageUrl = null;
        if (finalReceivedGiftData.gift_image) {
          receivedImageUrl = buildCompleteImageUrl(finalReceivedGiftData.gift_image);
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
                    loading="lazy"
                    decoding="async"
                    key={`gift-received-mobile-${finalReceivedGiftData.gift_name}-${receivedImageUrl}`}
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
                {finalReceivedGiftData.gift_name || 'Regalo Especial'}
              </p>
              
              <div className="bg-black/20 rounded-lg p-2 mt-3 border-l-4 border-green-400">
                <p className="text-green-100 text-xs font-medium">
                  💰 ¡{finalReceivedGiftData.client_name || 'El cliente'} te envió este regalo!
                </p>
              </div>
            </div>
          </div>
        );

      case 'gift_sent':
        const sentGiftData = mensaje.gift_data || mensaje.extra_data || {};
        
        let finalSentGiftData = sentGiftData;
        if (typeof mensaje.extra_data === 'string') {
          try {
            finalSentGiftData = JSON.parse(mensaje.extra_data);
          } catch (e) {
            finalSentGiftData = sentGiftData;
          }
        }
        
        let sentImageUrl = null;
        if (finalSentGiftData.gift_image) {
          sentImageUrl = buildCompleteImageUrl(finalSentGiftData.gift_image);
        }
        
        return (
          <div className="bg-gradient-to-br from-blue-900/40 via-cyan-900/40 to-teal-900/40 rounded-xl p-4 max-w-xs border border-blue-300/30 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full p-2">
                <Gift size={16} className="text-white" />
              </div>
              <span className="text-blue-100 text-sm font-semibold">Regalo Enviado</span>
            </div>
            
            {sentImageUrl && (
              <div className="mb-3 flex justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center overflow-hidden border-2 border-blue-300/30">
                  <img 
                    src={sentImageUrl} 
                    alt={finalSentGiftData.gift_name || 'Regalo'}
                    className="w-12 h-12 object-contain"
                    loading="lazy"
                    decoding="async"
                    key={`gift-sent-mobile-${finalSentGiftData.gift_name}-${sentImageUrl}`}
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
                {finalSentGiftData.gift_name || 'Regalo Especial'}
              </p>
              
              {finalSentGiftData.gift_price && (
                <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg px-3 py-1 border border-blue-300/30">
                  <span className="text-blue-200 font-bold text-sm">
                    -{finalSentGiftData.gift_price} minutos
                  </span>
                </div>
              )}
            </div>
          </div>
        );

      case 'gift':
        return (
          <div className="flex items-center gap-2 text-yellow-400">
            <Gift size={16} />
            <span>Envió: {textoMensaje}</span>
          </div>
        );

      case 'emoji':
        return <div className="text-2xl">{textoMensaje}</div>;
      
      default:
        // 🌐 USAR COMPONENTE DE TRADUCCIÓN PARA MENSAJES NORMALES
        return renderMessageWithTranslation(mensaje, esUsuarioActual);
    }
  };

  // 🎁 MANEJO DE ENVIAR REGALO SIMPLE (Nuevo método directo)
  const handleSendGiftSimple = async (requestId) => {
    try {
      setLoadingGift(true);
      
      console.log('🎁 [CLIENT MOBILE] Enviando regalo simple:', {
        requestId, 
        pendingRequestsCount: pendingRequests?.length || 0,
        sendGiftSimpleAvailable: !!sendGiftSimple,
        sendGiftSimpleType: typeof sendGiftSimple,
        giftSystemAvailable: !!giftSystem,
        giftSystemKeys: giftSystem ? Object.keys(giftSystem) : [],
        giftSystemSendGiftSimple: giftSystem?.sendGiftSimple,
        giftSystemSendGiftSimpleType: typeof giftSystem?.sendGiftSimple
      });
      
      // 🔥 Intentar obtener sendGiftSimple del objeto completo si no está disponible
      const sendGiftFunction = sendGiftSimple || giftSystem?.sendGiftSimple;
      
      if (!sendGiftFunction || typeof sendGiftFunction !== 'function') {
        console.error('❌ [CLIENT MOBILE] sendGiftSimple no disponible:', {
          sendGiftSimple,
          giftSystem,
          availableFunctions: giftSystem ? Object.keys(giftSystem) : []
        });
        
        // 🔥 FALLBACK: Llamar directamente al endpoint si el hook no funciona
        try {
          const response = await fetch(`${API_BASE_URL}/api/gifts/send-simple`, {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              request_id: parseInt(requestId)
            })
          });
          
          const responseText = await response.text();
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            alert('Error al procesar la respuesta del servidor.');
            return { success: false, error: 'Error al procesar la respuesta' };
          }
          
          if (response.ok && data.success) {
            // Recargar mensajes
            if (conversacionActiva) {
              setTimeout(() => {
                cargarMensajes(conversacionActiva);
              }, 500);
            }
            // Recargar solicitudes pendientes
            if (loadPendingRequests) {
              setTimeout(() => {
                loadPendingRequests();
              }, 1000);
            }
            return { success: true, ...data };
          } else {
            const errorMsg = data.message || data.error || 'Error al enviar el regalo';
            alert(errorMsg);
            return { success: false, error: errorMsg };
          }
        } catch (fallbackError) {
          alert('Error: No se pudo enviar el regalo. Por favor, recarga la página e intenta nuevamente.');
          return { success: false, error: 'Error de conexión' };
        }
      }
      
      const result = await sendGiftFunction(requestId);
      
      console.log('🎁 [CLIENT MOBILE] Resultado de enviar regalo:', {
        hasResult: !!result,
        success: result?.success,
        error: result?.error,
        message: result?.message,
        serverResponse: result?.serverResponse,
        status: result?.status,
        allKeys: result ? Object.keys(result) : []
      });
      
      if (result && result.success) {
        // Recargar mensajes para actualizar la UI
        if (conversacionActiva) {
          setTimeout(() => {
            cargarMensajes(conversacionActiva);
          }, 500);
        }
        // Recargar solicitudes pendientes para actualizar el estado
        setTimeout(() => {
          loadPendingRequests();
        }, 1000);
        // Mostrar mensaje de éxito
      } else {
        // 🔥 Asegurar que siempre haya un mensaje de error
        let errorMsg = 'No se pudo enviar el regalo. Por favor, intenta nuevamente.';
        
        if (result) {
          // Prioridad 1: result.error
          if (result.error) {
            errorMsg = result.error;
          }
          // Prioridad 2: result.message
          else if (result.message) {
            errorMsg = result.message;
          }
          // Prioridad 3: result.serverResponse
          else if (result.serverResponse) {
            const sr = result.serverResponse;
            if (sr.message) errorMsg = sr.message;
            else if (sr.error) errorMsg = typeof sr.error === 'string' ? sr.error : 'Error desconocido';
          }
        }
        
        // Mensajes específicos según el tipo de error
        if (result?.error === 'insufficient_balance' || result?.serverResponse?.error === 'insufficient_balance') {
          const required = result?.serverResponse?.data?.required_amount || result?.data?.required_amount || 'más';
          errorMsg = `Saldo insuficiente. Necesitas ${required} monedas para enviar este regalo.`;
        } else if (result?.error === 'invalid_request' || result?.serverResponse?.error === 'invalid_request') {
          errorMsg = 'La solicitud ya expiró o fue procesada. Por favor, recarga la página.';
        } else if (result?.error === 'security_violation' || result?.serverResponse?.error === 'security_violation') {
          errorMsg = 'Error de validación. Por favor, recarga la página e intenta nuevamente.';
        } else if (result?.error === 'already_processing' || result?.serverResponse?.error === 'already_processing') {
          errorMsg = 'Esta transacción ya se está procesando. Por favor espera un momento.';
        }
        
        console.error('🎁 [CLIENT] Error enviando regalo:', {
          errorMsg,
          result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          hasError: !!result?.error,
          hasMessage: !!result?.message,
          hasServerResponse: !!result?.serverResponse,
          serverResponseKeys: result?.serverResponse ? Object.keys(result.serverResponse) : [],
          status: result?.status,
          fullResult: JSON.stringify(result, null, 2)
        });
        
        alert(errorMsg);
      }
      
      return result || { success: false, error: 'No se pudo enviar el regalo. Por favor, intenta nuevamente.' };
    } catch (error) {
      const errorMsg = error?.message || 'Error inesperado al enviar el regalo';
      alert(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoadingGift(false);
    }
  };

  // 🎁 MANEJO DE ACEPTAR REGALO
  const handleAcceptGift = async (requestId, securityHash = null) => {
    try {
      setLoadingGift(true);
      
      // 🔥 GUARDAR BALANCE ANTES para comparar después
      const balanceBefore = userBalance;
      
      console.log('🎁 [CLIENT] Aceptando regalo:', {
        requestId, 
        hasSecurityHash: !!securityHash,
        pendingRequestsCount: pendingRequests?.length || 0,
        balanceBefore
      });
      
      // 🔥 El backend puede generar el hash si no se proporciona, así que no validamos aquí
      // Solo logueamos para debugging
      if (!securityHash) {
      }
      
      let result;
      try {
        result = await acceptGiftRequest(requestId, securityHash);
      } catch (fetchError) {
        // 🔥 Si es un error de conexión, verificar si el regalo se procesó
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          
          // Esperar un poco para que el backend procese
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Verificar balance
          let balanceAfter = balanceBefore;
          if (loadUserBalance) {
            try {
              await loadUserBalance();
              await new Promise(resolve => setTimeout(resolve, 500));
              balanceAfter = userBalance;
            } catch (e) {
            }
          }
          
          // 🔥 Si el balance cambió, el regalo se aceptó - cargar mensajes y no mostrar error
          if (balanceAfter < balanceBefore) {
            
            // Cargar mensajes para mostrar el regalo enviado
            if (conversacionActiva && cargarMensajes) {
              try {
                await cargarMensajes(conversacionActiva);
              } catch (e) {
              }
            }
            
            // Recargar solicitudes pendientes
            if (loadPendingRequests) {
              setTimeout(() => {
                loadPendingRequests();
              }, 1000);
            }
            
            // Retornar éxito sin mostrar error
            return {
              success: true,
              message: '¡Regalo enviado exitosamente!',
              networkError: true,
              balanceChanged: true
            };
          }
          
          // Si el balance no cambió, puede que no se haya aceptado, pero no mostrar error
          return {
            success: true,
            message: 'El regalo puede haberse enviado. Verifica tu balance y los mensajes.',
            networkError: true
          };
        }
        throw fetchError;
      }
      
      console.log('🎁 [CLIENT] Resultado de sendGiftSimple:', {
        hasResult: !!result,
        success: result?.success,
        error: result?.error,
        message: result?.message,
        serverResponse: result?.serverResponse,
        status: result?.status,
        allKeys: result ? Object.keys(result) : []
      });
      
      if (result && result.success) {
        // Recargar mensajes para actualizar la UI
        if (conversacionActiva) {
          setTimeout(() => {
            cargarMensajes(conversacionActiva);
          }, 500);
        }
        // Recargar solicitudes pendientes para actualizar el estado
        setTimeout(() => {
          loadPendingRequests();
        }, 1000);
        // No mostrar alert, el mensaje de éxito viene del backend
      } else {
        // 🔥 Asegurar que siempre haya un mensaje de error
        let errorMsg = 'No se pudo enviar el regalo. Por favor, intenta nuevamente.';
        
        if (result) {
          // Prioridad 1: result.error
          if (result.error) {
            errorMsg = result.error;
          }
          // Prioridad 2: result.message
          else if (result.message) {
            errorMsg = result.message;
          }
          // Prioridad 3: result.serverResponse
          else if (result.serverResponse) {
            const sr = result.serverResponse;
            if (sr.message) errorMsg = sr.message;
            else if (sr.error) errorMsg = typeof sr.error === 'string' ? sr.error : 'Error desconocido';
          }
        }
        
        // Mensajes específicos según el tipo de error
        if (result?.error === 'insufficient_balance' || result?.serverResponse?.error === 'insufficient_balance') {
          const required = result?.serverResponse?.data?.required_amount || result?.data?.required_amount || 'más';
          errorMsg = `Saldo insuficiente. Necesitas ${required} monedas para enviar este regalo.`;
        } else if (result?.error === 'invalid_request' || result?.serverResponse?.error === 'invalid_request') {
          errorMsg = 'La solicitud ya expiró o fue procesada. Por favor, recarga la página.';
        } else if (result?.error === 'security_violation' || result?.serverResponse?.error === 'security_violation') {
          errorMsg = 'Error de validación. Por favor, recarga la página e intenta nuevamente.';
        } else if (result?.error === 'already_processing' || result?.serverResponse?.error === 'already_processing') {
          errorMsg = 'Esta transacción ya se está procesando. Por favor espera un momento.';
        }
        
        console.error('🎁 [CLIENT] Error enviando regalo:', {
          errorMsg,
          result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          hasError: !!result?.error,
          hasMessage: !!result?.message,
          hasServerResponse: !!result?.serverResponse,
          serverResponseKeys: result?.serverResponse ? Object.keys(result.serverResponse) : [],
          status: result?.status,
          fullResult: JSON.stringify(result, null, 2)
        });
        
        // 🔥 Solo mostrar error si NO es un error de red
        if (!result?.networkError && !result?.timeout) {
          alert(errorMsg);
        }
      }
      
      return result || { success: false, error: 'No se pudo aceptar el regalo. Por favor, intenta nuevamente.' };
    } catch (error) {
      
      // 🔥 Si es un error de red, verificar si el regalo se procesó
      if (error.name === 'AbortError' || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        
        // Esperar un poco para que el backend procese
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verificar balance
        const currentBalance = userBalance;
        let newBalance = currentBalance;
        if (loadUserBalance) {
          try {
            await loadUserBalance();
            await new Promise(resolve => setTimeout(resolve, 500));
            newBalance = userBalance;
          } catch (e) {
          }
        }
        
        // 🔥 Si el balance cambió, el regalo se aceptó - cargar mensajes y no mostrar error
        if (newBalance < currentBalance || conversacionActiva) {
          
          // Cargar mensajes para mostrar el regalo enviado
          if (conversacionActiva && cargarMensajes) {
            try {
              await cargarMensajes(conversacionActiva);
            } catch (e) {
            }
          }
          
          // Recargar solicitudes pendientes
          if (loadPendingRequests) {
            setTimeout(() => {
              loadPendingRequests();
            }, 1000);
          }
          
          return {
            success: true,
            message: '¡Regalo enviado exitosamente!',
            networkError: true,
            balanceChanged: newBalance < currentBalance
          };
        }
        
        // Si el balance no cambió, no mostrar error
        return {
          success: true,
          message: 'El regalo puede haberse enviado. Verifica tu balance y los mensajes.',
          networkError: true
        };
      }
      
      // Solo mostrar error si NO es un error de red
      const errorMsg = error?.message || 'Error inesperado al aceptar el regalo';
      alert(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoadingGift(false);
    }
  };

  // 🎁 MANEJO DE RECHAZAR REGALO
  const handleRejectGift = async (requestId) => {
    try {
      setLoadingGift(true);
      const result = await rejectGiftRequest(requestId);
      
      if (result.success) {
              } else {
        alert(result.error || 'Error rechazando el regalo');
      }
      
      return result;
    } catch (error) {
            alert('Error inesperado');
      return { success: false, error: 'Error inesperado' };
    } finally {
      setLoadingGift(false);
    }
  };

  // 🎁 FUNCIÓN PARA PEDIR REGALO
  const pedirRegalo = useCallback(async (giftId, recipientId, roomName, message = '') => {
    try {
      if (!requestGift) {
        return { success: false, error: 'Función de solicitar regalo no disponible' };
      }
      
      const result = await requestGift(recipientId, giftId, message, roomName);
      
      if (result.success) {
        // 🔥 PROCESAR MENSAJE PARA EL CHAT (SOLO SI VIENE)
        if (result.chatMessage) {
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
                    last_message: `🎁 Solicitud: ${processedExtraData.gift_name || 'Regalo'}`,
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
  }, [pedirRegalo]);

  // 🎁 FUNCIÓN PARA CLIENTES: ENVIAR REGALO DIRECTAMENTE
  const handleSendGift = useCallback(async (giftId, recipientId, roomName, message) => {
    try {
      setLoadingGift(true);
      
      // 🔥 GUARDAR BALANCE ANTES para comparar después
      const balanceBefore = userBalance;
      
      console.log('🎁 [CLIENT] Enviando regalo:', {
        giftId,
        recipientId,
        message,
        userBalance: balanceBefore,
        conversacionActiva,
        finalRoomName: roomName || conversacionActiva
      });

      // 🔥 TIMEOUT MEJORADO PARA IPHONE - Aumentar timeout a 30 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos
      
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/api/gifts/send-direct`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            gift_id: giftId,
            recipient_id: parseInt(recipientId),
            room_name: roomName || conversacionActiva,
            message: message || ''
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // 🔥 Si es un error de abort (timeout) o error de red, verificar si el regalo se procesó
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          
          // Esperar un poco para que el backend procese
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Verificar balance
          let balanceAfter = balanceBefore;
          if (loadUserBalance) {
            try {
              await loadUserBalance();
              // Esperar un poco más para que se actualice el estado
              await new Promise(resolve => setTimeout(resolve, 500));
              balanceAfter = userBalance;
            } catch (e) {
            }
          }
          
          // 🔥 Si el balance cambió, el regalo se envió - cargar mensajes y cerrar modal
          if (balanceAfter < balanceBefore) {
            
            // Cargar mensajes para mostrar el regalo enviado
            if (conversacionActiva && cargarMensajes) {
              try {
                await cargarMensajes(conversacionActiva);
              } catch (e) {
              }
            }
            
            // Cerrar modal
            setShowGiftsModal(false);
            
            // Actualizar balance visualmente
            if (loadUserBalance) {
              setTimeout(() => loadUserBalance(), 1000);
            }
            
            return {
              success: true,
              message: '¡Regalo enviado exitosamente!',
              timeout: true,
              balanceChanged: true
            };
          }
          
          // Si el balance no cambió, puede que no se haya enviado, pero no mostrar error
          // porque puede ser un problema temporal de red
          setShowGiftsModal(false);
          
          return {
            success: true,
            message: 'El regalo puede haberse enviado. Verifica tu balance y los mensajes.',
            timeout: true
          };
        }
        throw fetchError;
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        return { success: false, error: 'Respuesta inválida del servidor' };
      }

      console.log('🎁 [CLIENT] Respuesta de aceptar regalo:', {
        status: response.status,
        ok: response.ok,
        success: data?.success,
        message: data?.message,
        has_chat_message: !!data?.chat_message,
        chat_message_type: data?.chat_message?.type,
        chat_message_room_name: data?.chat_message?.room_name,
        data_keys: Object.keys(data || {}),
        full_data: data
      });

      if (response.ok && data.success) {
        // Actualizar balance - usar total_balance si está disponible
        // Prioridad: total_balance > new_balance > purchased_balance + gift_balance
        if (data.data?.client_balance?.total_balance !== undefined) {
          setUserBalance(data.data.client_balance.total_balance);
        } else if (data.data?.client_balance?.new_balance !== undefined) {
          setUserBalance(data.data.client_balance.new_balance);
        } else if (data.new_balance !== undefined) {
          setUserBalance(data.new_balance);
        } else if (data.client_balance?.new_balance !== undefined) {
          setUserBalance(data.client_balance.new_balance);
        } else if (data.data?.new_balance !== undefined) {
          setUserBalance(data.data.new_balance);
        } else if (data.data?.client_balance?.purchased_balance !== undefined && data.data?.client_balance?.gift_balance !== undefined) {
          // Calcular total si tenemos ambos valores
          const total = (data.data.client_balance.purchased_balance || 0) + (data.data.client_balance.gift_balance || 0);
          setUserBalance(total);
        }
        
        // 🔥 Recargar balance desde el servidor para asegurar que esté actualizado
        if (loadUserBalance) {
          setTimeout(() => {
            loadUserBalance();
          }, 500);
        }

        // Agregar mensaje al chat si viene en la respuesta
        if (data.chat_message) {
          let processedExtraData = data.chat_message.extra_data;
          if (typeof processedExtraData === 'string') {
            try {
              processedExtraData = JSON.parse(processedExtraData);
            } catch (e) {
            }
          }

          if (processedExtraData?.gift_image) {
            processedExtraData.gift_image = buildCompleteImageUrl(processedExtraData.gift_image);
          }

          const processedMessage = {
            ...data.chat_message,
            gift_data: processedExtraData,
            extra_data: processedExtraData
          };

          setMensajes(prev => [...prev, processedMessage]);

          // Actualizar conversación
          setConversaciones(prev => 
            prev.map(conv => 
              conv.room_name === (roomName || conversacionActiva)
                ? {
                    ...conv,
                    last_message: `🎁 Regalo: ${processedExtraData.gift_name || 'Regalo'}`,
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

        setShowGiftsModal(false);

        // Notificación de éxito
        if (Notification.permission === 'granted') {
          new Notification('🎁 Regalo Enviado', {
            body: 'Tu regalo ha sido enviado exitosamente',
            icon: '/favicon.ico'
          });
        }

        return {
          success: true,
          transaction: data.data || data.transaction,
          newBalance: data.data?.client_balance?.new_balance || data.client_balance?.new_balance,
          message: data.message || '¡Regalo enviado exitosamente!'
        };
      } else {
        let errorMessage = data.message || data.error || 'Error al enviar el regalo';
        if (data.error === 'insufficient_balance') {
          const required = data.data?.required_amount || data.required_amount || 'más';
          errorMessage = `Saldo insuficiente. Necesitas ${required} monedas para enviar este regalo.`;
        }
        
        console.error('🎁 [CLIENT] Error enviando regalo:', {
          errorMessage,
          status: response.status,
          data
        });
        
        return {
          success: false,
          error: errorMessage,
          message: errorMessage
        };
      }
    } catch (error) {
      
      // 🔥 Si es un error de red, verificar si el regalo se procesó
      if (error.name === 'AbortError' || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        
        // Esperar un poco para que el backend procese
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verificar balance - usar el balance actual como referencia
        const currentBalance = userBalance;
        let newBalance = currentBalance;
        if (loadUserBalance) {
          try {
            await loadUserBalance();
            await new Promise(resolve => setTimeout(resolve, 500));
            // Obtener el nuevo balance del estado actualizado
            newBalance = userBalance;
          } catch (e) {
          }
        }
        
        // 🔥 Si el balance cambió (disminuyó), el regalo se envió - cargar mensajes y cerrar modal
        // Nota: El balance puede no actualizarse inmediatamente, así que también verificamos si hay conversación activa
        if (newBalance < currentBalance || conversacionActiva) {
          
          // Cargar mensajes para mostrar el regalo enviado (si existe)
          if (conversacionActiva && cargarMensajes) {
            try {
              await cargarMensajes(conversacionActiva);
            } catch (e) {
            }
          }
          
          // Cerrar modal siempre (no mostrar error)
          setShowGiftsModal(false);
          
          // Actualizar balance visualmente
          if (loadUserBalance) {
            setTimeout(() => loadUserBalance(), 1000);
          }
          
          return {
            success: true,
            message: '¡Regalo enviado exitosamente!',
            networkError: true,
            balanceChanged: newBalance < currentBalance
          };
        }
        
        // Si el balance no cambió, cerrar modal sin mostrar error
        setShowGiftsModal(false);
        
        return {
          success: true,
          message: 'El regalo puede haberse enviado. Verifica tu balance y los mensajes.',
          networkError: true
        };
      }
      
      // Solo mostrar error si NO es un error de red
      return {
        success: false,
        error: error.message || 'Error al enviar el regalo',
        message: error.message || 'Error al enviar el regalo'
      };
    } finally {
      setLoadingGift(false);
    }
  }, [API_BASE_URL, getAuthHeaders, conversacionActiva, userBalance, setUserBalance, setMensajes, setConversaciones, mensajesRef, usuario.id, buildCompleteImageUrl, loadUserBalance, cargarMensajes]);

  // 🔥 CARGAR DATOS DE USUARIO
  const cargarDatosUsuario = async () => {
    try {
            const userData = await getUser();
            
      setUsuario({
        id: userData.id,
        name: userData.name || userData.alias || `Usuario_${userData.id}`,
        rol: userData.rol
      });
    } catch (error) {
            setUsuario({
        id: 1,
        name: "Usuario Demo",
        rol: "cliente"
      });
    }
  };

  // 🔥 CARGAR CONVERSACIONES
  const cargarConversaciones = async () => {
    if (loading) return;
    
    try {
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
        setConversaciones(newConversations);
      } else {
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
    } catch (error) {
          } finally {
      if (conversaciones.length === 0) {
        setLoading(false);
      }
    }
  };

  // 🔥 CARGAR MENSAJES CON TIEMPO REAL
  const cargarMensajes = async (roomName, isPolling = false) => {
    try {
      if (!isPolling) {
        // Solo mostrar loading en carga inicial
      }

      // Cargar mensajes del room principal
      const response = await fetch(`${API_BASE_URL}/api/chat/messages/${roomName}`, {
        headers: getAuthHeaders()
      });

      let allMessages = [];

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          allMessages = [...allMessages, ...data.messages];
        }
      }

      // Cargar mensajes del room específico del cliente (para regalos)
      const clientRoomName = `${roomName}_client`;
      const clientResponse = await fetch(`${API_BASE_URL}/api/chat/messages/${clientRoomName}`, {
        headers: getAuthHeaders()
      });

      if (clientResponse.ok) {
        const clientData = await clientResponse.json();
        if (clientData.success && clientData.messages) {
          allMessages = [...allMessages, ...clientData.messages];
        }
      }

      // Ordenar por fecha
      allMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      if (allMessages.length > 0) {
        // Solo actualizar si hay mensajes nuevos
        setMensajes(prevMensajes => {
          const prevIds = new Set(prevMensajes.map(m => m.id));
          const hasNewMessages = allMessages.some(m => !prevIds.has(m.id));
          
          if (hasNewMessages || !isPolling) {
            // Actualizar último tiempo de mensaje
            if (allMessages.length > 0) {
              const latestMessage = allMessages[allMessages.length - 1];
              setLastMessageTime(latestMessage.created_at || latestMessage.timestamp);
            }
            
            // Scroll al final si hay mensajes nuevos
            if (hasNewMessages) {
              setTimeout(() => {
                if (mensajesRef.current) {
                  mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
                }
              }, 100);
            }
            
            return allMessages;
          }
          
          return prevMensajes;
        });
        
              } else if (!isPolling) {
        // Mensajes de ejemplo con regalo solo en primera carga
        const exampleMessages = [
          {
            id: 1,
            user_id: 2,
            user_name: "SofiSweet",
            user_role: "modelo",
            message: "¡Hola! ¿Cómo estás?",
            created_at: "2024-01-15T14:25:00Z"
          },
          {
            id: 2,
            user_id: usuario.id,
            user_name: usuario.name,
            user_role: usuario.rol,
            message: "¡Hola! Todo bien, ¿y tú?",
            created_at: "2024-01-15T14:26:00Z"
          },
          {
            id: 3,
            user_id: 2,
            user_name: "SofiSweet",
            user_role: "modelo",
            message: "Rosa Roja 🌹",
            gift_data: { 
              gift_name: "Rosa Roja 🌹",
              gift_price: "50",
              gift_image: "storage/gifts/rosa.png",
              original_message: "Para ti con cariño"
            },
            created_at: "2024-01-15T14:27:00Z"
          }
        ];
        setMensajes(exampleMessages);
      }
    } catch (error) {
          }
  };

  // 🔥 FUNCIÓN PARA INICIAR POLLING EN TIEMPO REAL
  const iniciarPolling = useCallback((roomName) => {
    // Limpiar polling anterior
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Iniciar nuevo polling cada 2 segundos
    const interval = setInterval(() => {
      cargarMensajes(roomName, true);
    }, 2000);

    setPollingInterval(interval);
  }, [pollingInterval]);

  // 🔥 FUNCIÓN PARA DETENER POLLING
  const detenerPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

  // 🔥 ENVIAR MENSAJE CON ACTUALIZACIÓN INMEDIATA
  const enviarMensaje = async () => {
    const mensaje = nuevoMensaje.trim();
    if (!mensaje || !conversacionActiva) return;

    // Crear mensaje local inmediatamente para UX rápida
    const mensajeLocal = {
      id: Date.now() + Math.random(), // ID temporal único
      user_id: usuario.id,
      user_name: usuario.name,
      user_role: usuario.rol,
      message: mensaje,
      created_at: new Date().toISOString(),
      isLocal: true // Marcar como local
    };

    // Agregar mensaje inmediatamente
    setMensajes(prev => [...prev, mensajeLocal]);
    setNuevoMensaje("");

    // Scroll inmediato
    setTimeout(() => {
      if (mensajesRef.current) {
        mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
      }
    }, 50);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          room_name: conversacionActiva,
          message: mensaje,
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // El polling se encargará de traer el mensaje real del servidor
          // Remover el mensaje local temporal
          setTimeout(() => {
            setMensajes(prev => prev.filter(m => m.id !== mensajeLocal.id));
          }, 1000);
        }
      } else {
        // Si falla, remover el mensaje local
        setMensajes(prev => prev.filter(m => m.id !== mensajeLocal.id));
      }
    } catch (error) {
            // Si falla, remover el mensaje local
      setMensajes(prev => prev.filter(m => m.id !== mensajeLocal.id));
    }
  };

  // 🔥 ABRIR CONVERSACIÓN CON TIEMPO REAL
  const abrirConversacion = async (conversacion) => {
    
    try {
      // Detener polling anterior
      detenerPolling();
      
      setConversacionActiva(conversacion.room_name);
      
      await cargarMensajes(conversacion.room_name);
      
      setShowSidebar(false);
      
      // Iniciar polling para esta conversación
      iniciarPolling(conversacion.room_name);
      
      // Scroll al final
      setTimeout(() => {
        if (mensajesRef.current) {
          mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
        } else {
        }
      }, 100);
      
    } catch (error) {
      throw error;
    }
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
      mensajes.forEach((mensaje) => {
        if (mensaje.text || mensaje.message) {
          translateMessage(mensaje);
        }
      });
    }, 100);
    
    setShowSettingsModal(false);
  };

  // 🔥 DETECTAR CHAT PENDIENTE
  useEffect(() => {
    const checkPendingChat = () => {
      try {
        const pendingChat = localStorage.getItem('pendingChatOpen');
        
        if (pendingChat) {
          const chatInfo = JSON.parse(pendingChat);
                    
          const now = Date.now();
          const timeDiff = now - chatInfo.timestamp;
          
          if (timeDiff < 10000 && chatInfo.shouldOpen) {
                        
            const existingConv = conversaciones.find(conv => 
              conv.other_user_id === chatInfo.clientId || 
              conv.room_name === chatInfo.roomName
            );
            
            if (existingConv) {
                            abrirConversacion(existingConv);
            } else {
                            
              const nuevaConversacion = {
                id: chatInfo.conversationId || Date.now(),
                other_user_id: chatInfo.clientId,
                other_user_name: chatInfo.clientName,
                other_user_role: 'modelo',
                room_name: chatInfo.roomName,
                last_message: "Conversación iniciada - Envía tu primer mensaje",
                last_message_time: new Date().toISOString(),
                last_message_sender_id: null,
                unread_count: 0
              };
              
              setConversaciones(prev => {
                const exists = prev.some(conv => 
                  conv.room_name === nuevaConversacion.room_name ||
                  conv.other_user_id === nuevaConversacion.other_user_id
                );
                
                if (!exists) {
                                    return [nuevaConversacion, ...prev];
                }
                return prev;
              });
              
              setTimeout(() => {
                abrirConversacion(nuevaConversacion);
              }, 100);
            }
            
            localStorage.removeItem('pendingChatOpen');
                      } else {
                        localStorage.removeItem('pendingChatOpen');
          }
        }
      } catch (error) {
                localStorage.removeItem('pendingChatOpen');
      }
    };

    if (conversaciones.length > 0) {
      checkPendingChat();
    }
    
    if (usuario.id) {
      setTimeout(checkPendingChat, 500);
    }
  }, [conversaciones, usuario.id]);

  // 🔗 Abrir chat con modelo desde URL (link de perfil)
  useEffect(() => {
    const modeloId = searchParams.get('modelo');
    if (!modeloId) return;
    if (!usuario.id || usuario.rol !== 'cliente') return;
    if (hasOpenedSpecificChatRef.current) return;
    if (conversaciones.length === 0 && loading) return;

    const abrirChatConModelo = async () => {
      hasOpenedSpecificChatRef.current = true;

      try {
        const targetModelId = parseInt(modeloId, 10);
        if (!targetModelId) return;

        const conversacionExistente = conversaciones.find(
          conv => conv.other_user_id === targetModelId
        );

        if (conversacionExistente) {
          await abrirConversacion(conversacionExistente);
          setTimeout(() => {
            navigate('/mensajesmobileclient', { replace: true });
          }, 500);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/chat/start-conversation`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ other_user_id: targetModelId })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.room_name) {
            await cargarConversaciones();
            setTimeout(async () => {
              await cargarConversaciones();

              const conversacionTemporal = {
                room_name: data.room_name,
                other_user_id: targetModelId,
                other_user_name: 'Modelo',
                other_user_display_name: 'Modelo',
                other_user_role: 'modelo',
                last_message: '',
                last_message_time: new Date().toISOString(),
                unread_count: 0
              };

              setConversaciones(prev => {
                const exists = prev.some(conv =>
                  conv.room_name === conversacionTemporal.room_name ||
                  conv.other_user_id === conversacionTemporal.other_user_id
                );
                if (!exists) {
                  return [conversacionTemporal, ...prev];
                }
                return prev.map(conv =>
                  conv.room_name === conversacionTemporal.room_name ||
                  conv.other_user_id === conversacionTemporal.other_user_id
                    ? conversacionTemporal
                    : conv
                );
              });

              setTimeout(async () => {
                await abrirConversacion(conversacionTemporal);
                setTimeout(() => {
                  navigate('/mensajesmobileclient', { replace: true });
                }, 500);
              }, 100);
            }, 300);
          }
        } else {
          const conversacionLocal = {
            room_name: `chat_user_${Math.min(usuario.id, targetModelId)}_${Math.max(usuario.id, targetModelId)}`,
            other_user_id: targetModelId,
            other_user_name: 'Modelo',
            other_user_display_name: 'Modelo',
            other_user_role: 'modelo',
            createdLocally: true,
            needsSync: true,
            last_message: '',
            last_message_time: new Date().toISOString(),
            unread_count: 0
          };

          setConversaciones(prev => {
            const exists = prev.some(conv =>
              conv.room_name === conversacionLocal.room_name ||
              conv.other_user_id === conversacionLocal.other_user_id
            );
            if (exists) {
              return prev.map(conv => {
                if (conv.room_name === conversacionLocal.room_name || conv.other_user_id === conversacionLocal.other_user_id) {
                  return { ...conversacionLocal, id: conv.id };
                }
                return conv;
              });
            }
            return [conversacionLocal, ...prev];
          });

          setTimeout(async () => {
            await abrirConversacion(conversacionLocal);
            setTimeout(() => {
              navigate('/mensajesmobileclient', { replace: true });
            }, 500);
          }, 100);
        }
      } catch (error) {
        hasOpenedSpecificChatRef.current = false;
      }
    };

    abrirChatConModelo();
  }, [searchParams, usuario.id, usuario.rol, conversaciones, loading, getAuthHeaders, navigate, cargarConversaciones, abrirConversacion]);

  // 🔥 MANEJAR openChatWith DESDE NAVEGACIÓN
  useEffect(() => {
    
    if (!openChatWith) {
      return;
    }
    
    if (!usuario.id) {
      return;
    }

    const handleOpenChat = async () => {
      try {
        console.log('🟡 [MOBILE] Abriendo chat con:', {
          room_name: openChatWith.room_name,
          other_user_id: openChatWith.other_user_id
        });
        
        // Buscar si ya existe la conversación
        const existingConv = conversaciones.find(conv => 
          conv.room_name === openChatWith.room_name ||
          conv.other_user_id === openChatWith.other_user_id
        );

        if (existingConv) {
          // Si existe, abrirla directamente
          await abrirConversacion(existingConv);
        } else {
          // Si no existe, crear una nueva conversación
          const nuevaConversacion = {
            id: Date.now(),
            other_user_id: openChatWith.other_user_id,
            other_user_name: openChatWith.other_user_name,
            other_user_role: openChatWith.other_user_role || 'modelo',
            room_name: openChatWith.room_name,
            last_message: "Conversación iniciada - Envía tu primer mensaje",
            last_message_time: new Date().toISOString(),
            last_message_sender_id: null,
            unread_count: 0
          };


          // Agregar a la lista de conversaciones
          setConversaciones(prev => {
            const exists = prev.some(conv => 
              conv.room_name === nuevaConversacion.room_name ||
              conv.other_user_id === nuevaConversacion.other_user_id
            );
            
            
            if (!exists) {
              return [nuevaConversacion, ...prev];
            }
            return prev;
          });

          // Abrir la conversación después de un pequeño delay para asegurar que se agregó
          setTimeout(() => {
            abrirConversacion(nuevaConversacion);
          }, 200);
        }

        // Limpiar el estado de navegación para evitar re-ejecuciones
        if (location.state?.openChatWith) {
          navigate(location.pathname + location.search, { replace: true, state: {} });
        }
        
      } catch (error) {
        console.error('❌ [MOBILE] Error abriendo chat:', error);
      }
    };

    // Esperar a que las conversaciones se carguen antes de intentar abrir
    // Usar un pequeño delay para asegurar que todo esté listo
    const timeoutId = setTimeout(() => {
      if (conversaciones.length >= 0) { // Permitir incluso si no hay conversaciones aún
        handleOpenChat();
      } else {
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [openChatWith, usuario.id, conversaciones]);

  // 🔥 UTILIDADES
  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';
  const formatearTiempo = (timestamp) => {
    const fecha = new Date(timestamp);
    return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // 🔥 CONVERSACIONES FILTRADAS
  const conversacionesFiltradas = conversaciones.filter(conv =>
    conv.other_user_name.toLowerCase().includes(busquedaConversacion.toLowerCase())
  );

  const conversacionSeleccionada = conversaciones.find(c => c.room_name === conversacionActiva);

  // 🔥 EFECTOS - CON LIMPIEZA DE POLLING
  useEffect(() => {
    cargarDatosUsuario();
  }, []);

  // Detectar móvil
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (usuario.id && !loading) {
      cargarConversaciones();
      loadGifts(); // Cargar regalos
    }
  }, [usuario.id]);

  // 🔥 LIMPIAR POLLING AL DESMONTAR COMPONENTE O CAMBIAR CONVERSACIÓN
  useEffect(() => {
    return () => {
      detenerPolling();
    };
  }, [detenerPolling]);

  // 🔥 DETENER POLLING CUANDO SE CIERRE LA CONVERSACIÓN
  useEffect(() => {
    if (!conversacionActiva) {
      detenerPolling();
    }
  }, [conversacionActiva, detenerPolling]);

  // 🔥 MANEJAR VISIBILIDAD DE LA PÁGINA PARA OPTIMIZAR POLLING
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Página oculta - reducir frecuencia de polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          // Polling cada 10 segundos cuando está oculta
          const interval = setInterval(() => {
            if (conversacionActiva) {
              cargarMensajes(conversacionActiva, true);
            }
          }, 10000);
          setPollingInterval(interval);
        }
      } else {
        // Página visible - restaurar polling normal
        if (conversacionActiva) {
          detenerPolling();
          iniciarPolling(conversacionActiva);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [conversacionActiva, pollingInterval, iniciarPolling, detenerPolling]);

  // 🎁 POLLING PARA SOLICITUDES DE REGALOS
  useEffect(() => {
    if (!usuario.id || usuario.rol !== 'cliente') return;
    
    // 🔥 REDUCIR FRECUENCIA: Cargar cada 30 segundos en lugar de cada 5
    const interval = setInterval(async () => {
      try {
        await loadPendingRequests();
      } catch (error) {
        // Silenciar errores de polling
      }
    }, 30000); // 🔥 30 segundos en lugar de 5
    
    return () => {
      clearInterval(interval);
    };
  }, [usuario.id, usuario.rol, loadPendingRequests]);

  // 🔥 RENDER
  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-[#1a1c20] to-[#2b2d31] text-white"
      style={isMobile ? {
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: '-webkit-fill-available'
      } : {}}
    >
      <div className="relative">
        <Header 
          showMessagesButton={isMobile && conversacionActiva && !showSidebar}
          onMessagesClick={() => setShowSidebar(true)}
        />
      </div>

      {/* 🔥 CONTENEDOR PRINCIPAL CON ALTURA FIJA MÓVIL Y SAFE AREA */}
      <div className="px-2 pb-2">
        <div className={`flex rounded-xl overflow-hidden shadow-lg border border-[#ff007a]/10 relative ${
          isMobile 
            ? '' // Altura se maneja con style
            : 'h-[83vh]'
        }`}
        style={isMobile ? {
          // 🔥 Usar dvh (dynamic viewport height) que se adapta automáticamente
          // dvh se ajusta cuando la barra de navegación aparece/desaparece
          height: 'calc(100dvh - 80px)',
          maxHeight: 'calc(100dvh - 80px)',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row'
        } : {}}
        >
          
          {/* Sidebar de conversaciones - ARREGLADO */}
          <aside className={`${
            isMobile
              ? `fixed inset-0 z-50 bg-[#2b2d31] transform transition-transform duration-300 ease-in-out ${
                  showSidebar ? 'translate-x-0' : '-translate-x-full'
                }`
              : 'w-1/3 bg-[#2b2d31]'
          } flex flex-col overflow-hidden`}>
            
            {/* Header sidebar móvil */}
            {isMobile && (
              <div className="flex justify-between items-center p-4 border-b border-[#ff007a]/20">
                <h2 className="text-lg font-semibold text-white">Conversaciones</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-white/60 hover:text-white p-2 hover:bg-[#3a3d44] rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            )}

            {/* Contenido del sidebar */}
            <div className="flex-1 overflow-hidden flex flex-col p-4">
              {/* Búsqueda */}
              <div className="relative mb-4 flex-shrink-0">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <input
                  type="text"
                  placeholder={t('chat.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1c20] text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-[#ff007a]/50"
                  value={busquedaConversacion}
                  onChange={(e) => setBusquedaConversacion(e.target.value)}
                />
              </div>

              {/* Lista de conversaciones - SCROLL ARREGLADO */}
              <div className="flex-1 overflow-y-auto space-y-2" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#ff007a #2b2d31'
              }}>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#ff007a] mx-auto mb-2"></div>
                  <p className="text-xs text-white/60">{t('chat.loading')}</p>
                </div>
              ) : conversacionesFiltradas.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={32} className="text-white/30 mx-auto mb-2" />
                  <p className="text-sm text-white/60">{t('chat.noConversations')}</p>
                </div>
              ) : (
                conversacionesFiltradas.map((conv) => {
                  const isOnline = onlineUsers.has(conv.other_user_id);
                  const unreadCount = conv.unread_count || 0;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => abrirConversacion(conv)}
                      className={`p-3 hover:bg-[#3a3d44] rounded-lg cursor-pointer transition-colors border ${
                        conversacionActiva === conv.room_name
                          ? 'bg-[#ff007a]/20 border-[#ff007a]'
                          : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {getInitial(conv.other_user_display_name || conv.other_user_name)}
                          </div>
                          
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${
                            isOnline ? 'bg-green-500' : 'bg-gray-500'
                          }`}></div>
                          
                          {unreadCount > 0 && (
                            <div className="absolute -top-1 -left-1 bg-[#ff007a] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {unreadCount}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {conv.other_user_display_name || conv.other_user_name}
                          </p>
                          <div className="text-xs text-white/60 truncate">
                            {conv.last_message_sender_id === usuario.id ? (
                              <span><span className="text-white/40">{t('chat.you')}:</span> {conv.last_message}</span>
                            ) : (
                              conv.last_message
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-xs text-white/40">
                            {formatearTiempo(conv.last_message_time)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

          {/* Panel de chat - ARREGLADO PARA MÓVIL */}
          <section className={`${
            isMobile
              ? `${showSidebar ? 'hidden' : 'w-full'}`
              : 'w-2/3'
          } bg-[#0a0d10] flex flex-col relative overflow-hidden h-full`}
          style={isMobile ? {
            display: showSidebar ? 'none' : 'flex',
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            // 🔥 Asegurar que el flexbox funcione correctamente
            flexDirection: 'column',
            overflow: 'hidden'
          } : {}}
          >
            
            {!conversacionActiva ? (
              !isMobile && (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-center">
                    <MessageSquare size={48} className="text-white/30 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">{t('chat.selectConversation')}</h3>
                    <p className="text-white/60">{t('chat.selectConversationDesc')}</p>
                  </div>
                </div>
              )
            ) : (
              <>
                {/* Header de conversación - ARREGLADO */}
                <div className="bg-[#2b2d31] px-4 py-3 flex justify-between items-center border-b border-[#ff007a]/20 flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Botón volver en móvil */}
                    {isMobile && (
                      <button
                        onClick={() => setShowSidebar(true)}
                        className="text-white hover:text-[#ff007a] transition-colors p-1 mr-2"
                      >
                        <ArrowLeft size={20} />
                      </button>
                    )}
                    
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {getInitial(conversacionSeleccionada?.other_user_display_name || conversacionSeleccionada?.other_user_name)}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${
                        onlineUsers.has(conversacionSeleccionada?.other_user_id) ? 'bg-green-500' : 'bg-gray-500'
                      }`} />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold block truncate">
                        {conversacionSeleccionada?.other_user_display_name || conversacionSeleccionada?.other_user_name}
                      </span>
                    </div>
                  </div>

                  {/* Botones de acción - RESPONSIVE */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* 🎁 BOTÓN DE REGALO - PARA CLIENTES */}
                    {usuario.rol === 'cliente' && (
                      <button
                        onClick={() => setShowGiftsModal(true)}
                        className={`px-2 py-2 rounded-lg text-xs hover:scale-105 transition-transform flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white`}
                      >
                        <Gift size={14} />
                        {!isMobile && 'Regalo'}
                      </button>
                    )}
                    
                    <button className="text-white hover:text-[#ff007a] transition-colors p-2">
                      <Video size={18} />
                    </button>
                    
                    {/* 🔥 BOTÓN DE CONFIGURACIÓN/TRADUCCIÓN */}
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      className="text-white hover:text-[#ff007a] transition-colors p-2"
                      title="Configuración y Traducción"
                    >
                      <Settings size={18} />
                    </button>
                  </div>
                </div>

                {/* Mensajes - SCROLL ARREGLADO PARA MÓVIL CON SAFE AREA */}
                <div
                  ref={mensajesRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
                  style={isMobile ? {
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#ff007a #2b2d31',
                    WebkitOverflowScrolling: 'touch',
                    flex: '1 1 0%', // 🔥 Usar 0% para mejor control del espacio
                    minHeight: 0,
                    maxHeight: 'none', // 🔥 Permitir que use todo el espacio disponible
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    // 🔥 Asegurar que el scroll funcione correctamente
                    overscrollBehavior: 'contain'
                  } : {
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#ff007a #2b2d31',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {mensajes.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-white/60">No hay mensajes aún</p>
                    </div>
                  ) : (
                    mensajes.map((mensaje) => {
                      const esUsuarioActual = mensaje.user_id === usuario.id;
                      const isGiftMessage = ['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(mensaje.type);

                      return (
                        <div key={mensaje.id} className={`flex ${esUsuarioActual ? "justify-end" : "justify-start"}`}>
                          <div className={`flex flex-col ${isMobile ? 'max-w-[280px]' : 'max-w-sm md:max-w-md lg:max-w-lg'}`}>
                            {!esUsuarioActual && !isGiftMessage && (
                              <div className="flex items-center gap-2 mb-1 px-2">
                                <div className="w-5 h-5 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-xs">
                                  {getInitial(mensaje.user_name)}
                                </div>
                                <span className="text-xs text-white/60">{mensaje.user_name}</span>
                              </div>
                            )}
                            {isGiftMessage ? (
                              // Mensajes de regalo sin padding/fondo adicional
                              renderMensaje(mensaje)
                            ) : (
                              <div
                                className={`relative px-4 py-2 rounded-2xl text-sm break-words overflow-wrap-anywhere word-break-break-word ${
                                  esUsuarioActual
                                    ? "bg-[#ff007a] text-white rounded-br-md shadow-lg"
                                    : "bg-[#2b2d31] text-white/80 rounded-bl-md shadow-lg"
                                }`}
                                style={{ maxWidth: '100%', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                              >
                                {renderMensaje(mensaje)}
                                <div className="text-xs opacity-70 mt-1">
                                  {formatearTiempo(mensaje.created_at)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input mensaje - FIXED PARA MÓVIL CON SAFE AREA */}
                <div 
                  className="bg-[#2b2d31] border-t border-[#ff007a]/20 flex gap-3 p-3 flex-shrink-0"
                  style={isMobile ? {
                    // 🔥 Adaptarse automáticamente a la barra de navegación
                    paddingBottom: `calc(0.75rem + max(env(safe-area-inset-bottom), 0px))`,
                    paddingTop: '0.75rem',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 10,
                    marginBottom: 0,
                    // Asegurar que siempre esté visible
                    minHeight: 'fit-content'
                  } : {}}
                >
                  <div className="flex flex-col flex-1">
                    {isOtherTyping && (
                      <div className="text-xs text-[#ff007a] mb-1 italic">Escribiendo...</div>
                    )}
                    <input
                    type="text"
                    placeholder={t('chat.messagePlaceholder')}
                    className="flex-1 px-4 py-3 rounded-full bg-[#1a1c20] text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-[#ff007a]/50"
                    value={nuevoMensaje}
                    onChange={(e) => handleMessageChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
                    />
                  </div>
                  
                  <EmojiPickerButton
                    onSelect={(emoji) => setNuevoMensaje((prev) => prev + emoji)}
                    buttonClassName="px-3 py-3 rounded-full"
                    buttonSize={16}
                  />
                  
                  <button
                    onClick={enviarMensaje}
                    disabled={!nuevoMensaje.trim()}
                    className={`px-4 py-3 rounded-full font-semibold transition-colors flex items-center gap-2 ${
                      !nuevoMensaje.trim()
                        ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                        : 'bg-[#ff007a] hover:bg-[#e6006e] text-white'
                    }`}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* 🎁 NOTIFICACIÓN DE REGALO */}
      {pendingRequests.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1c20] to-[#2b2d31] rounded-2xl p-6 max-w-sm w-full border border-[#ff007a]/30 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">¡Nuevo Regalo!</h3>
              <p className="text-white/60 text-sm">
                {pendingRequests[0]?.sender_name || 'Alguien'} te ha enviado un regalo
              </p>
            </div>

            {/* Contenido del regalo */}
            <div className="bg-[#0a0d10] rounded-lg p-4 mb-4 border border-[#ff007a]/20">
              <div className="text-center">
                <div className="text-4xl mb-2">🎁</div>
                <p className="text-white font-semibold text-lg">
                  {pendingRequests[0]?.gift_type || 'Regalo especial'}
                </p>
                {pendingRequests[0]?.message && (
                  <p className="text-white/70 text-sm mt-2 italic">
                    "{pendingRequests[0].message}"
                  </p>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3">
              <button
                onClick={() => handleAcceptGift(pendingRequests[0]?.id)}
                disabled={loadingGift}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingGift ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Aceptando...</span>
                  </div>
                ) : (
                  '✅ Aceptar'
                )}
              </button>
              
              <button
                onClick={() => handleRejectGift(pendingRequests[0]?.id)}
                disabled={loadingGift}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingGift ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Rechazando...</span>
                  </div>
                ) : (
                  '❌ Rechazar'
                )}
              </button>
            </div>

            {/* Mostrar cantidad de solicitudes pendientes */}
            {pendingRequests.length > 1 && (
              <div className="text-center mt-3">
                <p className="text-white/50 text-xs">
                  {pendingRequests.length - 1} regalo{pendingRequests.length > 2 ? 's' : ''} más pendiente{pendingRequests.length > 2 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE CONFIGURACIÓN Y TRADUCCIÓN */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-xl border border-[#ff007a]/30 shadow-2xl w-80 max-h-[75vh] overflow-hidden">
            {/* Header del modal */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#ff007a]/20 rounded-lg border border-[#ff007a]/30">
                  <Globe size={16} className="text-[#ff007a]" />
                </div>
                <h2 className="text-lg font-bold text-white">Traductor</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-4 overflow-y-auto max-h-[calc(75vh-120px)]">
              {/* Advertencia temporal */}
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-400/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-white font-bold">!</span>
                  </div>
                  <div>
                    <h4 className="text-amber-300 font-semibold text-sm mb-1">Solo para esta conversación</h4>
                    <p className="text-amber-200/80 text-sm leading-relaxed">
                      Para traducción permanente: 
                      <span className="font-semibold text-amber-100"> Configuración → Idiomas</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Estado actual de traducción */}
              <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-600/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Estado actual:</span>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    localTranslationEnabled 
                      ? 'bg-green-500/20 text-green-300 border border-green-400/30' 
                      : 'bg-gray-500/20 text-gray-300 border border-gray-400/30'
                  }`}>
                    {localTranslationEnabled ? t('chat.menu.translationActive') : t('chat.menu.translationInactive')}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Idioma:</span>
                  <div className="px-3 py-1 rounded-full text-xs font-medium bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30">
                    {languages.find(l => l.code === currentLanguage)?.name || 'Español'}
                  </div>
                </div>
              </div>

              {/* Sección de idioma */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-[#ff007a]" />
                  <h3 className="text-sm font-semibold text-white">Cambiar Idioma</h3>
                </div>
                
                {/* Lista de idiomas */}
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`
                        w-full flex items-center gap-2 p-3 rounded-lg transition-all duration-200
                        hover:bg-[#ff007a]/10 hover:border-[#ff007a]/30 border text-left
                        ${currentLanguage === lang.code 
                          ? 'bg-[#ff007a]/20 border-[#ff007a]/50 text-white shadow-lg' 
                          : 'bg-gray-800/50 border-gray-600/30 text-gray-300 hover:text-white'
                        }
                      `}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{lang.name}</p>
                      </div>
                      {currentLanguage === lang.code && (
                        <div className="w-2 h-2 bg-[#ff007a] rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Información adicional */}
              <div className="p-3 bg-blue-500/10 border border-blue-400/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <Settings size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-blue-300 font-semibold text-sm mb-1">Configuración Permanente</h4>
                    <p className="text-blue-200/80 text-sm leading-relaxed">
                      Para cambios permanentes, ve a: Menú → Configuración → Idiomas
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700/50 bg-gray-900/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Configuración temporal
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-[#ff007a] text-white text-sm font-medium rounded-lg hover:bg-[#ff007a]/90 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🎁 OVERLAY DE NOTIFICACIONES DE REGALO */}
      <GiftNotificationOverlay
        pendingRequests={pendingRequests}
        onAccept={handleAcceptGift}
        onReject={handleRejectGift}
        onClose={() => setPendingRequests([])}
        isVisible={pendingRequests.length > 0}
      />

      {/* 🎁 MODAL DE REGALOS */}
      <GiftsModal
        isOpen={showGiftsModal}
        onClose={() => setShowGiftsModal(false)}
        recipientName={conversacionSeleccionada?.other_user_name || 'Usuario'}
        recipientId={conversacionSeleccionada?.other_user_id}
        roomName={conversacionActiva}
        userRole={usuario.rol}
        gifts={gifts}
        onRequestGift={usuario.rol === 'modelo' ? handleRequestGift : undefined}
        onSendGift={usuario.rol === 'cliente' ? handleSendGift : undefined}
        userBalance={userBalance}
        loading={loadingGift}
      />
    </div>
  );
}