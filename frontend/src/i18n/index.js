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
};

// ⚙️ CONFIGURACIÓN DE i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem("lang") || "es", // <- esto es clave
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
    
    // 🌐 CONFIGURACIÓN DE IDIOMAS DISPONIBLES
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

export default i18n;