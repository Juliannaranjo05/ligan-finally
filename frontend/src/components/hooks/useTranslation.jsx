// 📁 src/hooks/useTranslation.js
import React, { useState, useEffect, useCallback } from 'react';

// Importar contexto global con fallback
let useGlobalTranslation;
try {
  const translationModule = require('../contexts/GlobalTranslationContext');
  useGlobalTranslation = translationModule.useGlobalTranslation;
} catch (e) {
  useGlobalTranslation = () => ({
    translateGlobalText: null,
    isEnabled: false,
    changeGlobalLanguage: () => {},
    currentLanguage: 'es'
  });
}

export const useTranslation = (userId = null) => {
  // 🌐 OBTENER CONTEXTO GLOBAL
  const {
    translateGlobalText,
    isEnabled: translationEnabled,
    changeGlobalLanguage,
    currentLanguage: globalCurrentLanguage
  } = useGlobalTranslation();

  // 🌐 ESTADOS LOCALES
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('selectedLanguage') || 
           localStorage.getItem('userPreferredLanguage') || 
           globalCurrentLanguage || 'es';
  });

  const [localTranslationEnabled, setLocalTranslationEnabled] = useState(() => {
    const selectedLanguage = localStorage.getItem('selectedLanguage');
    const userPreferredLanguage = localStorage.getItem('userPreferredLanguage');
    const translationEnabled = localStorage.getItem('translationEnabled') === 'true';
    
    if (localStorage.getItem('translationEnabled')) {
      return translationEnabled;
    }
    
    const currentLang = selectedLanguage || userPreferredLanguage || 'es';
    return currentLang !== 'es';
  });

  const [translations, setTranslations] = useState(new Map());
  const [translatingIds, setTranslatingIds] = useState(new Set());

  // 🌐 IDIOMAS DISPONIBLES
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

  // 🌐 FUNCIÓN FALLBACK PARA TRADUCCIÓN
  const translateWithFallback = useCallback(async (text, targetLang) => {
    try {
            
      const cleanText = text.toLowerCase().trim();
      
      const translations = {
        'en': {
          'hola': 'hello',
          'como estas': 'how are you',
          'como estás': 'how are you',
          'como estas?': 'how are you?',
          'como estás?': 'how are you?',
          'bien': 'good',
          'muy bien': 'very good',
          'mal': 'bad',
          'regular': 'okay',
          'gracias': 'thank you',
          'muchas gracias': 'thank you very much',
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
          'bonita': 'pretty',
          'linda': 'cute',
          'preciosa': 'gorgeous',
          'mi amor': 'my love',
          'cariño': 'honey',
          'corazón': 'sweetheart',
          'que haces': 'what are you doing',
          'qué haces': 'what are you doing',
          'estoy aquí': 'I\'m here',
          'te extraño': 'I miss you',
          'hasta luego': 'see you later',
          'nos vemos': 'see you',
          'cuídate': 'take care',
          'besos': 'kisses',
          'abrazos': 'hugs',
          'real': 'real',
          'ash': 'ash'
        },
        'es': {
          'hello': 'hola',
          'hi': 'hola',
          'how are you': 'cómo estás',
          'how are you?': 'cómo estás?',
          'good': 'bien',
          'very good': 'muy bien',
          'bad': 'mal',
          'okay': 'regular',
          'thank you': 'gracias',
          'thank you very much': 'muchas gracias',
          'thanks': 'gracias',
          'please': 'por favor',
          'yes': 'sí',
          'no': 'no',
          'good morning': 'buenos días',
          'good night': 'buenas noches',
          'good afternoon': 'buenas tardes',
          'i love you': 'te amo',
          'beautiful': 'hermosa',
          'pretty': 'bonita',
          'cute': 'linda',
          'gorgeous': 'preciosa',
          'my love': 'mi amor',
          'honey': 'cariño',
          'sweetheart': 'corazón',
          'what are you doing': 'qué haces',
          'i\'m here': 'estoy aquí',
          'i miss you': 'te extraño',
          'see you later': 'hasta luego',
          'see you': 'nos vemos',
          'take care': 'cuídate',
          'kisses': 'besos',
          'hugs': 'abrazos',
          'real': 'real',
          'ash': 'ash'
        },
        'zh': {
          'hola': '你好',
          'como estas': '你好吗',
          'bien': '好',
          'gracias': '谢谢',
          'si': '是',
          'no': '不',
          'te amo': '我爱你',
          'hermosa': '美丽',
          'hello': '你好',
          'real': '真实',
          'ash': '灰烬'
        },
        'fr': {
          'hola': 'bonjour',
          'como estas': 'comment allez-vous',
          'bien': 'bien',
          'gracias': 'merci',
          'si': 'oui',
          'no': 'non',
          'te amo': 'je t\'aime',
          'hermosa': 'belle'
        },
        'de': {
          'hola': 'hallo',
          'como estas': 'wie geht es dir',
          'bien': 'gut',
          'gracias': 'danke',
          'si': 'ja',
          'no': 'nein',
          'te amo': 'ich liebe dich',
          'hermosa': 'schön'
        }
      };
      
      const langDict = translations[targetLang];
      if (langDict) {
        const translated = langDict[cleanText];
        if (translated) {
                    return translated;
        }
        
        // Buscar traducciones parciales
        for (const [key, value] of Object.entries(langDict)) {
          if (cleanText.includes(key) || key.includes(cleanText)) {
                        return value;
          }
        }
      }
      
            return null;
      
    } catch (error) {
            return null;
    }
  }, []);

  // 🌐 FUNCIÓN PARA TRADUCIR MENSAJES
  const translateMessage = useCallback(async (message) => {
    if (!localTranslationEnabled || !message?.id) {
      return;
    }
    
    const originalText = message.text || message.message;
    if (!originalText || originalText.trim() === '') {
      return;
    }

    // No traducir mensajes propios
    if (message.user_id === userId) {
      return;
    }

    // Verificar si ya está procesado
    if (translations.has(message.id) || translatingIds.has(message.id)) {
      return;
    }

    
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
  }, [localTranslationEnabled, translateGlobalText, currentLanguage, translateWithFallback, translations, translatingIds, userId]);

  // 🌐 FUNCIÓN PARA CAMBIAR IDIOMA
  const handleLanguageChange = useCallback((languageCode) => {
    setCurrentLanguage(languageCode);
    
    // Sincronizar localStorage
    localStorage.setItem('selectedLanguage', languageCode);
    localStorage.setItem('userPreferredLanguage', languageCode);
    
    const shouldEnableTranslation = languageCode !== 'es';
    setLocalTranslationEnabled(shouldEnableTranslation);
    localStorage.setItem('translationEnabled', shouldEnableTranslation.toString());
    
    // Cambiar idioma en contexto global
    if (typeof changeGlobalLanguage === 'function') {
      try {
        changeGlobalLanguage(languageCode);
              } catch (error) {
      }
    }
    
    // Limpiar traducciones
    setTranslations(new Map());
    setTranslatingIds(new Set());
    
      }, [changeGlobalLanguage]);

  // 🌐 CARGAR CONFIGURACIÓN INICIAL
  useEffect(() => {
    const selectedLanguage = localStorage.getItem('selectedLanguage');
    const userPreferredLanguage = localStorage.getItem('userPreferredLanguage');
    const finalLanguage = selectedLanguage || userPreferredLanguage || 'es';
    
    if (finalLanguage && finalLanguage !== 'es') {
      setCurrentLanguage(finalLanguage);
      setLocalTranslationEnabled(true);
      
      localStorage.setItem('selectedLanguage', finalLanguage);
      localStorage.setItem('userPreferredLanguage', finalLanguage);
      localStorage.setItem('translationEnabled', 'true');
      
      if (typeof changeGlobalLanguage === 'function') {
        try {
          changeGlobalLanguage(finalLanguage);
        } catch (error) {
        }
      }
    }
  }, [changeGlobalLanguage]);

  // 🌐 FUNCIÓN PARA OBTENER TRADUCCIÓN DE UN MENSAJE
  const getTranslation = useCallback((messageId) => {
    return translations.get(messageId);
  }, [translations]);

  // 🌐 FUNCIÓN PARA VERIFICAR SI SE ESTÁ TRADUCIENDO
  const isTranslating = useCallback((messageId) => {
    return translatingIds.has(messageId);
  }, [translatingIds]);

  return {
    // Estados
    currentLanguage,
    localTranslationEnabled,
    languages,
    
    // Funciones
    translateMessage,
    handleLanguageChange,
    getTranslation,
    isTranslating,
    
    // Utilidades
    translations,
    translatingIds
  };
};