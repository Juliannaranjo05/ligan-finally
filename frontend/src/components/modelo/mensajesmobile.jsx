import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "./header";
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

// 🔥 IMPORTACIONES NECESARIAS
import { useGiftSystem, GiftNotificationOverlay, GiftsModal } from '../GiftSystem/index.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ChatPrivadoMobile() {
  // 🔥 VALIDACIÓN DE SESIÓN: Solo modelos pueden acceder
  useSessionValidation('modelo');

  const { t } = useTranslation();
  // 🔥 ESTADOS BÁSICOS PARA MÓVIL
  const [usuario, setUsuario] = useState({ id: null, name: "Usuario", rol: "modelo" });
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [busquedaConversacion, setBusquedaConversacion] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  // 🔥 ESTADOS PARA POLLING EN TIEMPO REAL
  const [pollingInterval, setPollingInterval] = useState(null);
  const [lastMessageTime, setLastMessageTime] = useState(null);

  // 🎁 ESTADOS DE REGALOS
  const [showGiftsModal, setShowGiftsModal] = useState(false);
  const [loadingGift, setLoadingGift] = useState(false);
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

  const navigate = useNavigate();
  const location = useLocation();
  const mensajesRef = useRef(null);
  const openChatWith = location.state?.openChatWith;
  const typingTimeoutRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  // 🔥 FUNCIÓN PARA OBTENER HEADERS
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  const sendTypingStatus = async (isTyping) => {
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
  };

  const handleMessageChange = (value) => {
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
  };

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
  }, [conversacionActiva]);

  // 🎁 SISTEMA DE REGALOS
  const {
    gifts,
    loadingGifts,
    pendingRequests,
    loadingRequests,
    loadGifts,
    loadPendingRequests,
    setPendingRequests,
    acceptGiftRequest,
    rejectGiftRequest,
    requestGift,
    generateSessionToken
  } = useGiftSystem(usuario.id, usuario.rol, getAuthHeaders, API_BASE_URL);

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
        rol: "modelo"
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
            other_user_name: "Cliente1",
            other_user_role: "cliente",
            room_name: "chat_user_1_2",
            last_message: "¡Hola! ¿Cómo estás?",
            last_message_time: "2024-01-15T14:30:00Z",
            last_message_sender_id: 2,
            unread_count: 2
          },
          {
            id: 2,
            other_user_id: 3,
            other_user_name: "Cliente2",
            other_user_role: "cliente",
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
      if (!roomName) {
        console.warn('⚠️ [MODELO] cargarMensajes llamado sin roomName');
        return;
      }
      
      if (!isPolling) {
        // Solo mostrar loading en carga inicial
      }

      console.log('📥 [MODELO] cargarMensajes llamado:', {
        roomName,
        isPolling,
        conversacionActiva,
        usuarioRol: usuario.rol,
        roomNameMatch: roomName === conversacionActiva
      });

      const response = await fetch(`${API_BASE_URL}/api/chat/messages/${roomName}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📥 [MODELO] Respuesta de mensajes:', {
          success: data.success,
          messagesCount: data.messages?.length || 0,
          room_name: data.room_name,
          debug_info: data.debug_info
        });
        
        // 🔥 Log RAW de todos los tipos de mensajes recibidos ANTES de cualquier procesamiento
        if (data.messages && Array.isArray(data.messages)) {
          const allTypes = data.messages.map(m => m.type || 'unknown');
          const giftReceivedRaw = data.messages.filter(m => m.type === 'gift_received');
          const giftRequestRaw = data.messages.filter(m => m.type === 'gift_request');
          console.log('📥 [MODELO] 🔥 RAW - Mensajes recibidos del servidor:', {
            total: data.messages.length,
            gift_received_count: giftReceivedRaw.length,
            gift_request_count: giftRequestRaw.length,
            gift_received_ids: giftReceivedRaw.map(m => m.id),
            gift_request_ids: giftRequestRaw.map(m => m.id),
            all_types: allTypes,
            gift_received_details: giftReceivedRaw.map(m => ({
              id: m.id,
              type: m.type,
              room_name: m.room_name,
              has_gift_data: !!m.gift_data,
              has_extra_data: !!m.extra_data
            }))
          });
        }
        
        if (data.success && data.messages) {
          const newMessages = data.messages;
          
          // 🔥 Log para debugging
          const giftMessages = newMessages.filter(m => 
            ['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(m.type)
          );
          
          if (giftMessages.length > 0) {
            const giftReceivedMessages = giftMessages.filter(m => m.type === 'gift_received');
            console.log('🎁 [MODELO] Mensajes de regalo encontrados:', {
              total: giftMessages.length,
              types: giftMessages.map(m => m.type),
              ids: giftMessages.map(m => m.id),
              room_names: giftMessages.map(m => m.room_name || 'N/A'),
              gift_received_count: giftReceivedMessages.length,
              gift_received_ids: giftReceivedMessages.map(m => m.id),
              gift_received_details: giftReceivedMessages.map(m => ({
                id: m.id,
                type: m.type,
                room_name: m.room_name,
                has_gift_data: !!m.gift_data,
                has_extra_data: !!m.extra_data,
                extra_data_type: typeof m.extra_data,
                gift_data_type: typeof m.gift_data,
                message: m.message
              })),
              // 🔥 Mostrar TODOS los tipos de mensajes de regalo para debugging
              all_gift_types: giftMessages.map(m => ({
                id: m.id,
                type: m.type,
                room_name: m.room_name,
                message: m.message?.substring(0, 50)
              })),
              all_gift_data: giftMessages.map(m => {
                try {
                  const extraData = typeof m.extra_data === 'string' ? JSON.parse(m.extra_data) : m.extra_data;
                  const giftData = typeof m.gift_data === 'string' ? JSON.parse(m.gift_data) : m.gift_data;
                  return {
                    id: m.id,
                    type: m.type,
                    room_name: m.room_name,
                    extra_data: extraData,
                    gift_data: giftData
                  };
                } catch {
                  return {
                    id: m.id,
                    type: m.type,
                    room_name: m.room_name,
                    extra_data: m.extra_data,
                    gift_data: m.gift_data
                  };
                }
              })
            });
          } else {
            console.log('🎁 [MODELO] ⚠️ No se encontraron mensajes de regalo en la respuesta', {
              roomName,
              totalMessages: newMessages.length,
              messageTypes: newMessages.map(m => m.type),
              messageRoomNames: newMessages.map(m => m.room_name || 'N/A')
            });
          }
          
          // Solo actualizar si hay mensajes nuevos
          setMensajes(prevMensajes => {
            const prevIds = new Set(prevMensajes.map(m => m.id));
            const hasNewMessages = newMessages.some(m => !prevIds.has(m.id));
            
            if (hasNewMessages) {
              const newGiftMessages = newMessages.filter(m => 
                !prevIds.has(m.id) && ['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(m.type)
              );
              
              if (newGiftMessages.length > 0) {
                const newGiftReceived = newGiftMessages.filter(m => m.type === 'gift_received');
                console.log('🎁 [MODELO] ⭐ NUEVOS mensajes de regalo detectados:', {
                  count: newGiftMessages.length,
                  types: newGiftMessages.map(m => m.type),
                  ids: newGiftMessages.map(m => m.id),
                  gift_received_count: newGiftReceived.length,
                  gift_received_ids: newGiftReceived.map(m => m.id),
                  gift_received_details: newGiftReceived.map(m => ({
                    id: m.id,
                    type: m.type,
                    room_name: m.room_name,
                    has_gift_data: !!m.gift_data,
                    has_extra_data: !!m.extra_data,
                    extra_data: m.extra_data,
                    gift_data: m.gift_data,
                    message: m.message
                  })),
                  fullMessages: newGiftMessages
                });
              }
              
              console.log('📥 [MODELO] Actualizando mensajes - hay nuevos:', {
                prevCount: prevMensajes.length,
                newCount: newMessages.length,
                newIds: newMessages.filter(m => !prevIds.has(m.id)).map(m => m.id)
              });
            }
            
            if (hasNewMessages || !isPolling) {
              // Actualizar último tiempo de mensaje
              if (newMessages.length > 0) {
                const latestMessage = newMessages[newMessages.length - 1];
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
              
              return newMessages;
            }
            
            return prevMensajes;
          });
        }
      } else {
        console.error('❌ [MODELO] Error cargando mensajes:', {
          status: response.status,
          statusText: response.statusText,
          roomName
        });
        
        // Mensajes de ejemplo solo en primera carga
        if (!isPolling) {
          const exampleMessages = [
            {
              id: 1,
              user_id: 2,
              user_name: "Cliente1",
              user_role: "cliente",
              message: "¡Hola! ¿Cómo estás?",
              type: "text",
              created_at: "2024-01-15T14:25:00Z"
            },
            {
              id: 2,
              user_id: usuario.id,
              user_name: usuario.name,
              user_role: usuario.rol,
              message: "¡Hola! Todo bien, ¿y tú?",
              type: "text",
              created_at: "2024-01-15T14:26:00Z"
            }
          ];
          setMensajes(exampleMessages);
        }
      }
    } catch (error) {
      console.error('❌ [MODELO] Excepción cargando mensajes:', error);
    }
  };

  // 🔥 FUNCIÓN PARA INICIAR POLLING EN TIEMPO REAL
  const iniciarPolling = useCallback((roomName) => {
    // Limpiar polling anterior
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    console.log('🔄 [MODELO] Iniciando polling para room:', roomName);

    // Iniciar nuevo polling cada 2 segundos
    const interval = setInterval(() => {
      if (conversacionActiva === roomName) {
        cargarMensajes(roomName, true);
      }
    }, 2000);
    
    // 🔥 Forzar primera carga inmediata para detectar regalos nuevos
    if (conversacionActiva === roomName) {
      setTimeout(() => {
        cargarMensajes(roomName, true);
      }, 500);
    }

    setPollingInterval(interval);
  }, [pollingInterval, conversacionActiva, cargarMensajes]);

  // 🔥 FUNCIÓN PARA DETENER POLLING
  const detenerPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

  // 🔥 DETECTAR NUEVOS MENSAJES DE REGALO Y RECARGAR
  useEffect(() => {
    if (!conversacionActiva || mensajes.length === 0) return;
    
    const giftReceivedMessages = mensajes.filter(m => 
      m.type === 'gift_received' && 
      m.room_name && 
      (m.room_name === conversacionActiva || m.room_name === conversacionActiva + '_modelo')
    );
    
    if (giftReceivedMessages.length > 0) {
      console.log('🎁 [MODELO] ⭐ Detectados mensajes de regalo recibido:', {
        count: giftReceivedMessages.length,
        room_name_activa: conversacionActiva,
        total_mensajes: mensajes.length,
        gift_messages: giftReceivedMessages.map(m => ({
          id: m.id,
          type: m.type,
          room_name: m.room_name,
          has_gift_data: !!m.gift_data,
          has_extra_data: !!m.extra_data,
          gift_data: m.gift_data,
          extra_data: m.extra_data,
          message: m.message
        })),
        all_message_types: mensajes.map(m => m.type),
        all_message_ids: mensajes.map(m => m.id)
      });
      
      // Forzar scroll al final si hay nuevos mensajes de regalo
      setTimeout(() => {
        if (mensajesRef.current) {
          mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
        }
      }, 200);
    } else {
      // 🔥 Log cuando NO se encuentran mensajes gift_received
      const allGiftMessages = mensajes.filter(m => 
        ['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(m.type)
      );
      if (allGiftMessages.length > 0) {
        console.log('🎁 [MODELO] ⚠️ Hay mensajes de regalo pero NO gift_received:', {
          room_name_activa: conversacionActiva,
          gift_types: allGiftMessages.map(m => m.type),
          gift_ids: allGiftMessages.map(m => m.id),
          gift_room_names: allGiftMessages.map(m => m.room_name)
        });
      }
    }
  }, [mensajes, conversacionActiva]);

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
      type: 'text',
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
          type: 'text'
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
    // Detener polling anterior
    detenerPolling();
    
    console.log('🟣 [MODELO] ========== INICIO abrirConversacion ==========');
    console.log('🟣 [MODELO] Conversación recibida:', conversacion);
    console.log('🟣 [MODELO] room_name que se usará:', conversacion.room_name);
    console.log('🟣 [MODELO] room_name con sufijo _modelo:', conversacion.room_name + '_modelo');
    
    setConversacionActiva(conversacion.room_name);
    await cargarMensajes(conversacion.room_name);
    setShowSidebar(false);
    
    // Iniciar polling para esta conversación
    iniciarPolling(conversacion.room_name);
    
    // Scroll al final
    setTimeout(() => {
      if (mensajesRef.current) {
        mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
      }
    }, 100);
    
    console.log('🟣 [MODELO] ========== FIN abrirConversacion (éxito) ==========');
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
                other_user_role: 'cliente',
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

  // 🔥 UTILIDADES
  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?';
  const formatearTiempo = (timestamp) => {
    const fecha = new Date(timestamp);
    return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

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
              
              {(finalGiftData.gift_price_coins ?? finalGiftData.gift_price) && (
                <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg px-3 py-1 border border-amber-300/30">
                  <span className="text-amber-200 font-bold text-sm">
                    ✨ {finalGiftData.gift_price_coins ?? finalGiftData.gift_price} monedas
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
                    const securityHash = finalGiftData.security_hash || finalGiftData.securityHash || null;
                    setSendingGiftId(requestId);
                    try {
                      await handleAcceptGift(requestId, securityHash);
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
        // 🔥 Log para debugging
        console.log('🎁 [MODELO] Renderizando gift_received:', {
          mensajeId: mensaje.id,
          type: mensaje.type,
          hasGiftData: !!mensaje.gift_data,
          hasExtraData: !!mensaje.extra_data,
          extraDataType: typeof mensaje.extra_data,
          giftDataType: typeof mensaje.gift_data
        });
        
        let receivedGiftData = null;
        
        // 🔥 Intentar obtener datos del regalo de múltiples fuentes
        if (mensaje.gift_data) {
          if (typeof mensaje.gift_data === 'string') {
            try {
              receivedGiftData = JSON.parse(mensaje.gift_data);
            } catch (e) {
              console.warn('🎁 [MODELO] Error parseando gift_data:', e);
            }
          } else {
            receivedGiftData = mensaje.gift_data;
          }
        }
        
        if (!receivedGiftData && mensaje.extra_data) {
          if (typeof mensaje.extra_data === 'string') {
            try {
              receivedGiftData = JSON.parse(mensaje.extra_data);
            } catch (e) {
              console.warn('🎁 [MODELO] Error parseando extra_data:', e);
            }
          } else {
            receivedGiftData = mensaje.extra_data;
          }
        }
        
        if (!receivedGiftData) {
          console.warn('🎁 [MODELO] ⚠️ No se encontraron datos del regalo en gift_data ni extra_data');
          receivedGiftData = {};
        }
        
        console.log('🎁 [MODELO] Datos del regalo procesados:', receivedGiftData);
        
        let finalReceivedGiftData = receivedGiftData;
        let receivedImageUrl = null;
        if (finalReceivedGiftData.gift_image) {
          receivedImageUrl = buildCompleteImageUrl(finalReceivedGiftData.gift_image);
        }
        
        // 🔥 Si no hay datos del regalo, mostrar un mensaje genérico pero visible
        if (!finalReceivedGiftData || Object.keys(finalReceivedGiftData).length === 0) {
          console.warn('🎁 [MODELO] ⚠️ No hay datos del regalo, mostrando mensaje genérico');
          return (
            <div className="bg-gradient-to-br from-green-900/40 via-emerald-900/40 to-teal-900/40 rounded-xl p-4 max-w-xs border border-green-300/30 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full p-2">
                  <Gift size={16} className="text-white" />
                </div>
                <span className="text-green-100 text-sm font-semibold">¡Regalo Recibido!</span>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-base">Regalo Especial</p>
                <p className="text-green-100 text-xs mt-2">El cliente te envió un regalo</p>
              </div>
            </div>
          );
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
              
              {(finalReceivedGiftData.gift_price_coins ?? finalReceivedGiftData.gift_price) && (
                <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg px-3 py-1 border border-green-300/30">
                  <span className="text-green-200 font-bold text-sm">
                    +{finalReceivedGiftData.gift_price_coins ?? finalReceivedGiftData.gift_price} monedas
                  </span>
                </div>
              )}
              
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
              
              {(finalSentGiftData.gift_price_coins ?? finalSentGiftData.gift_price) && (
                <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg px-3 py-1 border border-blue-300/30">
                  <span className="text-blue-200 font-bold text-sm">
                    -{finalSentGiftData.gift_price_coins ?? finalSentGiftData.gift_price} monedas
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

  // 🎁 MANEJO DE ACEPTAR REGALO
  const handleAcceptGift = async (requestId, securityHash = null) => {
    try {
      setLoadingGift(true);
      
      // 🔥 Si no hay securityHash, intentar obtenerlo de pendingRequests
      let finalSecurityHash = securityHash;
      if (!finalSecurityHash && pendingRequests && pendingRequests.length > 0) {
        const pendingRequest = pendingRequests.find(req => req.id === parseInt(requestId));
        if (pendingRequest && pendingRequest.security_hash) {
          finalSecurityHash = pendingRequest.security_hash;
        }
      }
            
      const result = await acceptGiftRequest(requestId, finalSecurityHash);
      
      if (result.success) {
        // Recargar mensajes para actualizar la UI
        if (conversacionActiva) {
          setTimeout(() => {
            cargarMensajes(conversacionActiva);
          }, 500);
        }
        // No mostrar alert, el mensaje de éxito viene del backend
      } else {
        alert(result.error || 'Error aceptando el regalo');
      }
      
      return result;
    } catch (error) {
      console.error('Error aceptando regalo:', error);
      alert('Error inesperado al aceptar el regalo');
      return { success: false, error: 'Error inesperado' };
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
        // Sin acción adicional necesaria
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

  // 🔥 CONVERSACIONES FILTRADAS
  const conversacionesFiltradas = conversaciones.filter(conv =>
    conv.other_user_name.toLowerCase().includes(busquedaConversacion.toLowerCase())
  );

  const conversacionSeleccionada = conversaciones.find(c => c.room_name === conversacionActiva);

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

  // 🔥 EFECTOS - CON LIMPIEZA DE POLLING
  useEffect(() => {
    cargarDatosUsuario();
  }, []);

  useEffect(() => {
    if (usuario.id && !loading) {
      cargarConversaciones();
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

  // 🔥 RENDER
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1c20] to-[#2b2d31] text-white">
      <div className="relative">
        <Header />
        
        {/* Botón para mostrar sidebar cuando hay conversación activa */}
        {conversacionActiva && !showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            className="fixed top-4 right-4 z-50 bg-[#ff007a] hover:bg-[#cc0062] p-3 rounded-full shadow-xl transition-colors"
          >
            <MessageSquare size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* Contenedor principal */}
      <div className="p-2">
        <div className="h-[calc(100vh-80px)] flex rounded-xl overflow-hidden shadow-lg border border-[#ff007a]/10 relative">
          
          {/* Sidebar de conversaciones */}
          <aside className={`${
            showSidebar ? 'w-full' : 'hidden'
          } bg-[#2b2d31] flex flex-col overflow-hidden`}>
            
            {/* Header del sidebar */}
            <div className="flex justify-between items-center p-4 border-b border-[#ff007a]/20">
              <h2 className="text-lg font-semibold text-white">Conversaciones</h2>
              {conversacionActiva && (
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-white/60 hover:text-white p-2 hover:bg-[#3a3d44] rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Búsqueda */}
            <div className="p-4 border-b border-[#ff007a]/20">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                <input
                  type="text"
                  placeholder={t('chat.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#1a1c20] text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-[#ff007a]/50"
                  value={busquedaConversacion}
                  onChange={(e) => setBusquedaConversacion(e.target.value)}
                />
              </div>
            </div>

            {/* Lista de conversaciones */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#ff007a] mx-auto mb-2"></div>
                  <p className="text-xs text-white/60">Cargando...</p>
                </div>
              ) : conversacionesFiltradas.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={32} className="text-white/30 mx-auto mb-2" />
                  <p className="text-sm text-white/60">No hay conversaciones</p>
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
                        <div className="relative">
                          {conv.avatar_url ? (
                            <img
                              src={conv.avatar_url}
                              alt={conv.other_user_display_name || conv.other_user_name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-[#ff007a]"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-12 h-12 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold ${conv.avatar_url ? 'hidden' : ''}`}>
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
                              <span><span className="text-white/40">Tú:</span> {conv.last_message}</span>
                            ) : (
                              conv.last_message
                            )}
                          </div>
                        </div>

                        <div className="text-right">
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
          </aside>

          {/* Panel de chat */}
          <section className={`${
            showSidebar ? 'hidden' : 'w-full'
          } bg-[#0a0d10] flex flex-col relative overflow-hidden`}>
            
            {!conversacionActiva ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <MessageSquare size={48} className="text-white/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t('chat.selectConversation')}</h3>
                  <p className="text-white/60">{t('chat.selectConversationDesc')}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header de conversación */}
                <div className="bg-[#2b2d31] px-4 py-3 flex justify-between items-center border-b border-[#ff007a]/20">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowSidebar(true)}
                      className="text-white hover:text-[#ff007a] transition-colors p-1"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    
                    {conversacionSeleccionada?.avatar_url ? (
                      <img
                        src={conversacionSeleccionada.avatar_url}
                        alt={conversacionSeleccionada?.other_user_display_name || conversacionSeleccionada?.other_user_name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-[#ff007a]"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-10 h-10 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-sm ${conversacionSeleccionada?.avatar_url ? 'hidden' : ''}`}>
                      {getInitial(conversacionSeleccionada?.other_user_display_name || conversacionSeleccionada?.other_user_name)}
                    </div>
                    
                    <div>
                      <span className="font-semibold block">
                        {conversacionSeleccionada?.other_user_display_name || conversacionSeleccionada?.other_user_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 🎁 BOTÓN DE REGALO - PARA MODELOS */}
                    {usuario.rol === 'modelo' && (
                      <button
                        onClick={() => setShowGiftsModal(true)}
                        className="px-2 py-2 rounded-lg text-xs hover:scale-105 transition-transform flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      >
                        <Gift size={14} />
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

                {/* Mensajes */}
                <div
                  ref={mensajesRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                  style={{
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
                          <div className="flex flex-col max-w-[280px]">
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
                                {/* 🌐 USAR renderMensaje que maneja traducción internamente */}
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

                {/* Input mensaje */}
                <div className="bg-[#2b2d31] border-t border-[#ff007a]/20 flex gap-3 p-3">
                  <div className="flex flex-col flex-1">
                    {isOtherTyping && (
                      <div className="text-xs text-[#ff007a] mb-1 italic">Escribiendo...</div>
                    )}
                    <input
                      type="text"
                      placeholder="Escribe un mensaje..."
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
                    {localTranslationEnabled ? 'Activada' : 'Desactivada'}
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
        onRequestGift={handleRequestGift}
        loading={loadingGift}
      />
    </div>
  );
}