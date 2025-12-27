// 🌍 SISTEMA DE TRADUCCIÓN GLOBAL PERSISTENTE
// Archivo: contexts/GlobalTranslationContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation, translateText, TRANSLATION_CONFIG } from '../utils/translationSystem';
import i18n from '../i18n';

const GlobalTranslationContext = createContext();

// 🔥 CLAVE PARA ALMACENAMIENTO PERSISTENTE
const STORAGE_KEYS = {
  SETTINGS: 'globalTranslationSettings',
  TRANSLATIONS: 'globalTranslationsCache',
  USER_LANGUAGE: 'userPreferredLanguage'
};

// 🎯 PROVIDER GLOBAL PERSISTENTE
export const GlobalTranslationProvider = ({ children }) => {
  // Estado global persistente
  const [globalSettings, setGlobalSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Verificar también si hay un idioma guardado en otras claves
        const userLang = localStorage.getItem('userPreferredLanguage') || 
                        localStorage.getItem('selectedLanguage') || 
                        localStorage.getItem('lang');
        if (userLang && parsed.targetLanguage !== userLang) {
          parsed.targetLanguage = userLang;
        }
        return parsed;
      }
      // Si no hay configuración guardada, verificar otras claves
      const userLang = localStorage.getItem('userPreferredLanguage') || 
                      localStorage.getItem('selectedLanguage') || 
                      localStorage.getItem('lang') || 'es';
      return {
        enabled: true,
        targetLanguage: userLang,
        showOriginal: false,
        showOnlyTranslation: true,
        translateOutgoing: false,
        autoDetect: true
      };
    } catch {
      const userLang = localStorage.getItem('userPreferredLanguage') || 
                      localStorage.getItem('selectedLanguage') || 
                      localStorage.getItem('lang') || 'es';
      return {
        enabled: true,
        targetLanguage: userLang,
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

  // 🔄 SINCRONIZAR CON i18n Y LOCALSTORAGE AL CARGAR Y CUANDO CAMBIA EL IDIOMA
  useEffect(() => {
    // Obtener el idioma actual de i18n (tiene prioridad)
    const i18nLang = i18n.language?.split('-')[0] || i18n.language;
    
    // También verificar localStorage como respaldo
    const userLang = localStorage.getItem('userPreferredLanguage') || 
                    localStorage.getItem('selectedLanguage') || 
                    localStorage.getItem('lang');
    
    // Usar el idioma de i18n si está disponible, sino usar localStorage
    const finalLang = i18nLang || userLang || 'es';
    
    // Actualizar si es diferente al actual
    setGlobalSettings(prev => {
      if (finalLang && finalLang !== prev.targetLanguage) {
        return {
          ...prev,
          targetLanguage: finalLang
        };
      }
      return prev;
    });
    
    // Listener para cambios en i18n
    const handleI18nLanguageChange = (lng) => {
      const langCode = lng?.split('-')[0] || lng;
      if (langCode) {
        setGlobalSettings(prev => {
          // Solo actualizar si realmente cambió
          if (prev.targetLanguage !== langCode) {
            // Limpiar cache cuando cambia el idioma de la plataforma
            setGlobalTranslations({});
            localStorage.removeItem(STORAGE_KEYS.TRANSLATIONS);
            
            return {
              ...prev,
              targetLanguage: langCode
            };
          }
          return prev;
        });
      }
    };
    
    // Registrar el listener
    i18n.on('languageChanged', handleI18nLanguageChange);
    
    // Cleanup
    return () => {
      i18n.off('languageChanged', handleI18nLanguageChange);
    };
  }, []); // Solo al montar el componente

  // 💾 GUARDAR CONFIGURACIÓN AUTOMÁTICAMENTE
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(globalSettings));
    localStorage.setItem(STORAGE_KEYS.USER_LANGUAGE, globalSettings.targetLanguage);
    // También guardar en otras claves para compatibilidad
    localStorage.setItem('userPreferredLanguage', globalSettings.targetLanguage);
    localStorage.setItem('selectedLanguage', globalSettings.targetLanguage);
    localStorage.setItem('lang', globalSettings.targetLanguage);
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
      console.log('🔄 Usando traducción del cache global:', globalTranslations[cacheKey].translated);
      return globalTranslations[cacheKey].translated;
    }

    try {
      console.log('🌍 Traduciendo globalmente:', text, 'a', globalSettings.targetLanguage);
      
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

        console.log('✅ Traducción guardada globalmente:', result.translated);
        return result.translated;
      }
      
      return text;
    } catch (error) {
      console.warn('❌ Error en traducción global:', error);
      return text;
    }
  };

  // 🎛️ CAMBIAR IDIOMA GLOBALMENTE
  const changeGlobalLanguage = async (newLanguage) => {
    console.log('🔄 Cambiando idioma global a:', newLanguage);
    
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
    console.log('🧹 Cache global limpiado');
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
    // En lugar de lanzar error, retornar valores por defecto para compatibilidad
    console.warn('useGlobalTranslation se está usando fuera de GlobalTranslationProvider');
    return {
      globalSettings: { targetLanguage: 'es', enabled: true },
      setGlobalSettings: () => {},
      translateGlobalText: async (text) => text,
      changeGlobalLanguage: () => {},
      getExistingTranslation: () => null,
      globalTranslations: {},
      clearGlobalCache: () => {},
      getGlobalStats: () => ({ totalTranslations: 0, currentLanguage: 'es', isEnabled: false, cacheSize: 0 }),
      languages: {},
      isEnabled: false,
      currentLanguage: 'es'
    };
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
        console.warn('Error traduciendo texto:', error);
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

// 📱 EJEMPLO DE USO COMPLETO
export const GlobalTranslationExample = () => {
  const { 
    globalSettings, 
    setGlobalSettings, 
    getGlobalStats,
    clearGlobalCache 
  } = useGlobalTranslation();

  const stats = getGlobalStats();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">
          <GlobalTranslatedText>Sistema de Traducción Global</GlobalTranslatedText>
        </h1>
        <p className="text-gray-600">
          <GlobalTranslatedText>
            Las traducciones se guardan automáticamente y persisten entre sesiones
          </GlobalTranslatedText>
        </p>
      </div>

      {/* Selector de idioma */}
      <div className="flex justify-center">
        <GlobalLanguageSelector />
      </div>

      {/* Ejemplos de texto traducido */}
      <div className="space-y-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h3 className="font-semibold">
          <GlobalTranslatedText>Ejemplos de traducción automática:</GlobalTranslatedText>
        </h3>
        
        <div className="space-y-2">
          <p><GlobalTranslatedText>¡Hola! ¿Cómo estás hoy?</GlobalTranslatedText></p>
          <p><GlobalTranslatedText>Este es un mensaje de prueba</GlobalTranslatedText></p>
          <p><GlobalTranslatedText>La traducción se guarda automáticamente</GlobalTranslatedText></p>
          <p><GlobalTranslatedText>Hello, this is an English message</GlobalTranslatedText></p>
          <p><GlobalTranslatedText>Bonjour, comment allez-vous?</GlobalTranslatedText></p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="font-medium mb-2">📊 Estadísticas del sistema:</h4>
        <ul className="text-sm space-y-1">
          <li>🔤 Traducciones guardadas: {stats.totalTranslations}</li>
          <li>🌍 Idioma actual: {stats.currentLanguage.toUpperCase()}</li>
          <li>⚡ Estado: {stats.isEnabled ? 'Activo' : 'Inactivo'}</li>
          <li>💾 Tamaño del cache: {(stats.cacheSize / 1024).toFixed(1)} KB</li>
        </ul>
        
        <button
          onClick={clearGlobalCache}
          className="mt-3 px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition"
        >
          🧹 Limpiar cache
        </button>
      </div>

      {/* Toggle principal */}
      <div className="flex justify-center">
        <button
          onClick={() => setGlobalSettings({
            ...globalSettings,
            enabled: !globalSettings.enabled
          })}
          className={`px-6 py-3 rounded-lg font-medium transition ${
            globalSettings.enabled
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          }`}
        >
          {globalSettings.enabled ? '✅ Traducción Activa' : '❌ Traducción Inactiva'}
        </button>
      </div>
    </div>
  );
};

export default GlobalTranslationContext;