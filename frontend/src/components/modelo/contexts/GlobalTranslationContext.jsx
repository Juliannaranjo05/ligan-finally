// contexts/GlobalTranslationContext.jsx
// 🌍 SISTEMA DE TRADUCCIÓN GLOBAL PERSISTENTE

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// 🔥 CONFIGURACIÓN DE TRADUCCIÓN
const TRANSLATION_CONFIG = {
  LANGUAGES: {
    'es': { name: 'Español', flag: '🇪🇸', code: 'es' },
    'en': { name: 'English', flag: '🇺🇸', code: 'en' },
    'pt': { name: 'Português', flag: '🇧🇷', code: 'pt' },
    'fr': { name: 'Français', flag: '🇫🇷', code: 'fr' },
    'de': { name: 'Deutsch', flag: '🇩🇪', code: 'de' },
    'it': { name: 'Italiano', flag: '🇮🇹', code: 'it' },
    'ru': { name: 'Русский', flag: '🇷🇺', code: 'ru' },
    'ja': { name: '日本語', flag: '🇯🇵', code: 'ja' },
    'ko': { name: '한국어', flag: '🇰🇷', code: 'ko' },
    'zh': { name: '中文', flag: '🇨🇳', code: 'zh' }
  },
  API_URL: 'https://api.mymemory.translated.net/get'
};

// 🔥 CLAVES PARA ALMACENAMIENTO PERSISTENTE
const STORAGE_KEYS = {
  SETTINGS: 'globalTranslationSettings',
  TRANSLATIONS: 'globalTranslationsCache',
  USER_LANGUAGE: 'userPreferredLanguage'
};

const GlobalTranslationContext = createContext();

// 🔥 FUNCIÓN PARA TRADUCIR TEXTO
const translateText = async (text, targetLang = 'es') => {
  if (!text || text.trim().length === 0) return null;
  
  try {
    const cleanText = text.trim();
    const url = `${TRANSLATION_CONFIG.API_URL}?q=${encodeURIComponent(cleanText)}&langpair=auto|${targetLang}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Translation API error');
    
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return {
        original: cleanText,
        translated: data.responseData.translatedText,
        detectedLang: data.matches?.[0]?.segment || 'auto',
        targetLang: targetLang,
        confidence: data.matches?.[0]?.quality || 0
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

// 🎯 PROVIDER GLOBAL PERSISTENTE
export const GlobalTranslationProvider = ({ children }) => {
  // Estado global persistente
  const [globalSettings, setGlobalSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : {
        enabled: true,
        targetLanguage: 'es',
        showOriginal: false,
        showOnlyTranslation: true,
        translateOutgoing: false,
        autoDetect: true
      };
    } catch {
      return {
        enabled: true,
        targetLanguage: 'es',
        showOriginal: false,
        showOnlyTranslation: true,
        translateOutgoing: false,
        autoDetect: true
      };
    }
  });

  // Cache global de traducciones (persistente)
  const [globalTranslations, setGlobalTranslations] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSLATIONS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const inFlightTranslationsRef = useRef(new Map());

  // 💾 GUARDAR CONFIGURACIÓN AUTOMÁTICAMENTE
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(globalSettings));
    localStorage.setItem(STORAGE_KEYS.USER_LANGUAGE, globalSettings.targetLanguage);
  }, [globalSettings]);

  // 💾 GUARDAR TRADUCCIONES AUTOMÁTICAMENTE
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSLATIONS, JSON.stringify(globalTranslations));
  }, [globalTranslations]);

  // 🔄 FUNCIÓN PARA TRADUCIR CUALQUIER TEXTO GLOBALMENTE
  const translateGlobalText = async (text, messageId = null) => {
    if (!globalSettings.enabled || !text || text.trim().length === 0) {
      return text;
    }

    const cleanText = text.trim();
    const cacheKey = `${cleanText}_${globalSettings.targetLanguage}`;
    
    // Buscar en cache primero
    if (globalTranslations[cacheKey]) {
      return globalTranslations[cacheKey].translated;
    }

    let createdPromise = false;
    try {
      if (inFlightTranslationsRef.current.has(cacheKey)) {
        return await inFlightTranslationsRef.current.get(cacheKey);
      }

      const translatePromise = (async () => {
        const result = await translateText(cleanText, globalSettings.targetLanguage);
        
        if (result && result.translated) {
          // Guardar en cache global persistente
          const translationData = {
            original: cleanText,
            translated: result.translated,
            detectedLang: result.detectedLang,
            targetLang: result.targetLang,
            timestamp: Date.now(),
            messageId: messageId
          };

          setGlobalTranslations(prev => ({
            ...prev,
            [cacheKey]: translationData
          }));

          return result.translated;
        }
        
        return text;
      })();

      createdPromise = true;
      inFlightTranslationsRef.current.set(cacheKey, translatePromise);
      return await translatePromise;
    } catch (error) {
      return text;
    } finally {
      if (createdPromise) {
        inFlightTranslationsRef.current.delete(cacheKey);
      }
    }
  };

  // 🎛️ CAMBIAR IDIOMA GLOBALMENTE
  const changeGlobalLanguage = async (newLanguage) => {
    
    const newSettings = {
      ...globalSettings,
      targetLanguage: newLanguage
    };
    
    setGlobalSettings(newSettings);
    
    // Limpiar cache cuando cambie el idioma
    setGlobalTranslations({});
    localStorage.removeItem(STORAGE_KEYS.TRANSLATIONS);
    
    // Disparar evento para que otros componentes se actualicen
    window.dispatchEvent(new CustomEvent('globalLanguageChanged', {
      detail: { newLanguage, settings: newSettings }
    }));
  };

  // 🧹 LIMPIAR CACHE GLOBAL
  const clearGlobalCache = () => {
    setGlobalTranslations({});
    localStorage.removeItem(STORAGE_KEYS.TRANSLATIONS);
  };

  // 📊 OBTENER ESTADÍSTICAS
  const getGlobalStats = () => {
    return {
      totalTranslations: Object.keys(globalTranslations).length,
      currentLanguage: globalSettings.targetLanguage,
      isEnabled: globalSettings.enabled,
      cacheSize: JSON.stringify(globalTranslations).length
    };
  };

  // 🌍 OBTENER TRADUCCIÓN EXISTENTE
  const getExistingTranslation = (text) => {
    const cacheKey = `${text.trim()}_${globalSettings.targetLanguage}`;
    return globalTranslations[cacheKey]?.translated || null;
  };

  const contextValue = {
    // Configuración global
    globalSettings,
    setGlobalSettings,
    
    // Funciones principales
    translateGlobalText,
    changeGlobalLanguage,
    getExistingTranslation,
    
    // Cache y utilidades
    globalTranslations,
    clearGlobalCache,
    getGlobalStats,
    
    // Configuración de idiomas
    languages: TRANSLATION_CONFIG.LANGUAGES,
    
    // Estado
    isEnabled: globalSettings.enabled,
    currentLanguage: globalSettings.targetLanguage
  };

  return (
    <GlobalTranslationContext.Provider value={contextValue}>
      {children}
    </GlobalTranslationContext.Provider>
  );
};

// 🪝 HOOK PARA USAR EL CONTEXTO GLOBAL
export const useGlobalTranslation = () => {
  const context = useContext(GlobalTranslationContext);
  if (!context) {
    throw new Error('useGlobalTranslation debe usarse dentro de GlobalTranslationProvider');
  }
  return context;
};

// 🎨 COMPONENTE DE TEXTO CON TRADUCCIÓN GLOBAL AUTOMÁTICA
export const GlobalTranslatedText = ({
  children,
  messageId = null,
  className = "",
  fallback = null
}) => {
  const { translateGlobalText, isEnabled, getExistingTranslation } = useGlobalTranslation();
  const [translatedText, setTranslatedText] = useState(children);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const handleTranslation = async () => {
      if (!isEnabled || !children || typeof children !== 'string') {
        setTranslatedText(children);
        return;
      }

      // Buscar traducción existente primero
      const existing = getExistingTranslation(children);
      if (existing) {
        setTranslatedText(existing);
        return;
      }

      // Si no existe, traducir
      setIsTranslating(true);
      try {
        const result = await translateGlobalText(children, messageId);
        setTranslatedText(result);
      } catch (error) {
        setTranslatedText(fallback || children);
      } finally {
        setIsTranslating(false);
      }
    };

    handleTranslation();

    // Escuchar cambios de idioma global
    const handleLanguageChange = () => {
      handleTranslation();
    };

    window.addEventListener('globalLanguageChanged', handleLanguageChange);
    return () => window.removeEventListener('globalLanguageChanged', handleLanguageChange);
  }, [children, isEnabled, messageId, translateGlobalText, getExistingTranslation, fallback]);

  if (isTranslating) {
    return (
      <span className={`${className} flex items-center gap-1`}>
        <span className="opacity-70">{children}</span>
        <div className="animate-spin rounded-full h-3 w-3 border-b border-current opacity-50"></div>
      </span>
    );
  }

  return <span className={className}>{translatedText}</span>;
};

// 🎛️ SELECTOR DE IDIOMA GLOBAL PERSISTENTE
export const GlobalLanguageSelector = ({ className = "" }) => {
  const {
    currentLanguage,
    changeGlobalLanguage,
    languages,
    isEnabled,
    getGlobalStats
  } = useGlobalTranslation();

  const [showSelector, setShowSelector] = useState(false);
  const stats = getGlobalStats();

  if (!isEnabled) return null;

  const popularLanguages = ['es', 'en', 'pt', 'fr', 'de', 'it'];
  const currentLang = languages[currentLanguage];

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        <span className="text-lg">{currentLang?.flag}</span>
        <span className="font-medium">{currentLang?.name}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showSelector && (
        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border z-50 min-w-48">
          <div className="p-2 border-b text-xs text-gray-500">
            🌍 {stats.totalTranslations} traducciones guardadas
          </div>
          
          <div className="p-2 space-y-1">
            {popularLanguages.map(code => {
              const lang = languages[code];
              return (
                <button
                  key={code}
                  onClick={() => {
                    changeGlobalLanguage(code);
                    setShowSelector(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition ${
                    currentLanguage === code
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span>{lang.name}</span>
                  {currentLanguage === code && (
                    <span className="ml-auto text-sm">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalTranslationContext;