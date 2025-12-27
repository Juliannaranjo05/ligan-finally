import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 🌍 IMPORTAR TODOS LOS IDIOMAS
import translationEN from './locales/en.json';
import translationES from './locales/es.json';
import translationPT from './locales/pt.json';
import translationFR from './locales/fr.json';
import translationDE from './locales/de.json';
import translationRU from './locales/ru.json';
import translationTR from './locales/tr.json';
import translationHI from './locales/hi.json';
import translationIT from './locales/it.json';
import translationJA from './locales/ja.json';
import translationKO from './locales/ko.json';
import translationZH from './locales/zh.json';

// 🗂️ RECURSOS CON TODOS LOS IDIOMAS
const resources = {
  en: { translation: translationEN },
  es: { translation: translationES },
  pt: { translation: translationPT },
  fr: { translation: translationFR },
  de: { translation: translationDE },
  ru: { translation: translationRU },
  tr: { translation: translationTR },
  hi: { translation: translationHI },
  it: { translation: translationIT },
  ja: { translation: translationJA },
  ko: { translation: translationKO },
  zh: { translation: translationZH },
};

// ⚙️ OBTENER IDIOMA INICIAL (revisar múltiples fuentes)
const getInitialLanguage = () => {
  // Lista de idiomas válidos (solo los que tienen banderas)
  const validLanguages = ['es', 'en', 'pt', 'fr', 'de', 'ru', 'tr', 'hi', 'it'];
  
  // Función auxiliar para validar idioma
  const isValidLanguage = (lang) => {
    return lang && lang !== 'undefined' && lang !== 'null' && validLanguages.includes(lang);
  };
  
  // 1. Revisar "lang" (clave principal de i18n)
  const lang = localStorage.getItem("lang");
  if (isValidLanguage(lang)) {
    // Sincronizar con otras claves
    localStorage.setItem("selectedLanguage", lang);
    localStorage.setItem("userPreferredLanguage", lang);
    return lang;
  }
  
  // 2. Revisar idioma preferido del usuario
  const userPreferredLanguage = localStorage.getItem("userPreferredLanguage");
  if (isValidLanguage(userPreferredLanguage)) {
    // Sincronizar con otras claves
    localStorage.setItem("lang", userPreferredLanguage);
    localStorage.setItem("selectedLanguage", userPreferredLanguage);
    return userPreferredLanguage;
  }
  
  // 3. Revisar selectedLanguage
  const selectedLanguage = localStorage.getItem("selectedLanguage");
  if (isValidLanguage(selectedLanguage)) {
    // Sincronizar con otras claves
    localStorage.setItem("lang", selectedLanguage);
    localStorage.setItem("userPreferredLanguage", selectedLanguage);
    return selectedLanguage;
  }
  
  // 4. Por defecto español
  const defaultLang = "es";
  // Guardar el idioma por defecto para futuras cargas
  localStorage.setItem("lang", defaultLang);
  localStorage.setItem("selectedLanguage", defaultLang);
  localStorage.setItem("userPreferredLanguage", defaultLang);
  return defaultLang;
};

// ⚙️ CONFIGURACIÓN DE i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: "es",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    // 🔧 CONFIGURACIÓN ADICIONAL PARA MEJOR RENDIMIENTO
    debug: process.env.NODE_ENV === 'development',
    saveMissing: process.env.NODE_ENV === 'development',
    
    // 🌐 CONFIGURACIÓN DE IDIOMAS DISPONIBLES (solo los que tienen banderas)
    supportedLngs: ['es', 'en', 'pt', 'fr', 'de', 'ru', 'tr', 'hi', 'it'],
    nonExplicitSupportedLngs: true,
    
    // 📝 CONFIGURACIÓN DE NAMESPACE
    defaultNS: 'translation',
    
    // ⚡ CONFIGURACIÓN DE SEPARADORES
    keySeparator: '.',
    nsSeparator: ':',
    
    // 🔄 CONFIGURACIÓN DE REACT
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
      bindI18nStore: '',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i'],
    }
  });

// 🔥 LISTENER PARA GUARDAR AUTOMÁTICAMENTE CUANDO CAMBIA EL IDIOMA
i18n.on('languageChanged', (lng) => {
  if (lng && lng !== 'undefined' && lng !== 'null') {
    // Guardar en todas las claves para compatibilidad
    localStorage.setItem("lang", lng);
    localStorage.setItem("selectedLanguage", lng);
    localStorage.setItem("userPreferredLanguage", lng);
    
    // Disparar evento personalizado para notificar el cambio
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { language: lng }
    }));
  }
});

export default i18n;