// 📁 utils/translationSystem.jsx
// 🌍 SISTEMA DE TRADUCCIÓN CORREGIDO CON EXPORTACIONES FIJAS

import { useState, useEffect, useCallback } from 'react';
import { Globe, ToggleLeft, ToggleRight, X, Eye, EyeOff, Languages, Volume2 } from "lucide-react";

// 🔥 CONFIGURACIÓN DE TRADUCCIÓN
export const TRANSLATION_CONFIG = {
  APIS: {
    LIBRE_TRANSLATE: 'https://libretranslate.com/translate',
    GOOGLE_TRANSLATE: 'https://translate.googleapis.com/translate_a/single',
    DEEPL_FREE: 'https://api-free.deepl.com/v2/translate'
  },

  LANGUAGES: {
    'es': { name: 'Español', flag: '🇪🇸', code: 'es' },
    'en': { name: 'English', flag: '🇺🇸', code: 'en' },
    'pt': { name: 'Português', flag: '🇧🇷', code: 'pt' },
    'fr': { name: 'Français', flag: '🇫🇷', code: 'fr' },
    'it': { name: 'Italiano', flag: '🇮🇹', code: 'it' },
    'de': { name: 'Deutsch', flag: '🇩🇪', code: 'de' },
    'ru': { name: 'Русский', flag: '🇷🇺', code: 'ru' },
    'ja': { name: '日本語', flag: '🇯🇵', code: 'ja' },
    'ko': { name: '한국어', flag: '🇰🇷', code: 'ko' },
    'zh': { name: '中文', flag: '🇨🇳', code: 'zh' },
    'ar': { name: 'العربية', flag: '🇸🇦', code: 'ar' },
    'hi': { name: 'हिन्दी', flag: '🇮🇳', code: 'hi' },
    'nl': { name: 'Nederlands', flag: '🇳🇱', code: 'nl' },
    'tr': { name: 'Türkçe', flag: '🇹🇷', code: 'tr' }
  }
};

// Cache para traducciones
const translationCache = new Map();
const processedMessages = new Set();

// 🔍 DETECCIÓN DE IDIOMA MEJORADA
export const detectLanguage = (text) => {
  if (!text || typeof text !== 'string' || text.trim().length < 2) {
    return 'unknown';
  }

  const cleanText = text.toLowerCase().trim();
  
  // Diccionario de palabras comunes
  const commonWords = {
    es: ['hermano', 'hermana', 'hola', 'gracias', 'casa', 'agua', 'tiempo', 'vida', 'madre', 'padre', 'hijo', 'hija', 'paz', 'amor', 'como', 'cuando', 'donde', 'que', 'para', 'con', 'sin', 'muy', 'pero', 'bien', 'mal', 'bueno', 'malo', 'grande', 'pequeño', 'nuevo', 'viejo', 'pasado', 'presente', 'futuro', 'sí', 'no', 'todo', 'nada', 'algo', 'siempre', 'nunca', 'ahora', 'después', 'antes', 'aquí', 'allí'],
    en: ['brother', 'sister', 'hello', 'thanks', 'house', 'water', 'time', 'life', 'mother', 'father', 'son', 'daughter', 'peace', 'love', 'how', 'when', 'where', 'that', 'for', 'with', 'without', 'very', 'but', 'good', 'bad', 'big', 'small', 'new', 'old', 'past', 'present', 'future', 'yes', 'no', 'all', 'nothing', 'something', 'always', 'never', 'now', 'after', 'before', 'here', 'there'],
    pt: ['irmão', 'irmã', 'olá', 'obrigado', 'casa', 'água', 'tempo', 'vida', 'mãe', 'pai', 'filho', 'filha', 'paz', 'amor', 'como', 'quando', 'onde', 'que', 'para', 'com', 'sem', 'muito', 'mas', 'bom', 'ruim', 'grande', 'pequeno', 'novo', 'velho', 'passado', 'sim', 'não', 'tudo', 'nada', 'algo', 'sempre', 'nunca', 'agora', 'depois', 'antes', 'aqui', 'ali'],
    fr: ['frère', 'sœur', 'bonjour', 'merci', 'maison', 'eau', 'temps', 'vie', 'mère', 'père', 'fils', 'fille', 'paix', 'amour', 'comment', 'quand', 'où', 'que', 'pour', 'avec', 'sans', 'très', 'mais', 'bon', 'mauvais', 'grand', 'petit', 'nouveau', 'vieux', 'passé', 'oui', 'non', 'tout', 'rien', 'quelque', 'toujours', 'jamais', 'maintenant', 'après', 'avant', 'ici', 'là'],
    de: ['bruder', 'schwester', 'hallo', 'danke', 'haus', 'wasser', 'zeit', 'leben', 'mutter', 'vater', 'sohn', 'tochter', 'frieden', 'liebe', 'wie', 'wann', 'wo', 'dass', 'für', 'mit', 'ohne', 'sehr', 'aber', 'gut', 'schlecht', 'groß', 'klein', 'neu', 'alt', 'vergangenheit', 'ja', 'nein', 'alles', 'nichts', 'etwas', 'immer', 'nie', 'jetzt', 'nach', 'vor', 'hier', 'da'],
    it: ['fratello', 'sorella', 'ciao', 'grazie', 'casa', 'acqua', 'tempo', 'vita', 'madre', 'padre', 'figlio', 'figlia', 'pace', 'amore', 'come', 'quando', 'dove', 'che', 'per', 'con', 'senza', 'molto', 'ma', 'buono', 'cattivo', 'grande', 'piccolo', 'nuovo', 'vecchio', 'passato', 'sì', 'no', 'tutto', 'niente', 'qualcosa', 'sempre', 'mai', 'ora', 'dopo', 'prima', 'qui', 'là']
  };

  // Para palabras sueltas, buscar en diccionario
  if (cleanText.split(' ').length === 1) {
    for (const [lang, words] of Object.entries(commonWords)) {
      if (words.includes(cleanText)) {
                return lang;
      }
    }
  }

  // Para frases, usar patrones
  const patterns = {
    es: /\b(que|como|cuando|donde|por|para|con|sin|muy|pero|hola|gracias|hermano|hermana|madre|padre|hijo|hija|casa|agua|tiempo|vida|amor|paz|es|está|son|están|hacer|querer|poder|tener|ser|estar|ir|venir|ver|decir|dar|saber|bien|mal|bueno|malo|grande|pequeño|nuevo|viejo|alto|bajo|rápido|lento|feliz|triste|sí|no|todo|nada|algo|alguien|nadie|también|siempre|nunca|ahora|después|antes|aquí|allí|donde)\b/gi,
    en: /\b(the|be|to|of|and|that|have|for|not|with|he|as|you|do|at|this|but|his|by|from|they|she|or|an|will|my|one|all|would|there|their|what|so|up|out|if|about|who|get|which|go|me|when|make|can|like|time|no|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most|us|hello|hi|thanks|brother|sister|mother|father|house|water|life|peace|love|happy|sad)\b/gi,
    pt: /\b(que|não|você|para|com|uma|ter|seu|sua|ser|ele|ela|mais|como|mas|também|onde|quando|fazer|quero|querer|poder|saber|ver|ir|vir|estar|sendo|irmão|irmã|mãe|pai|filho|filha|casa|água|tempo|vida|amor|paz|é|está|são|estão|foi|será|tem|têm|teve|terá|bem|mal|bom|ruim|grande|pequeno|novo|velho|alto|baixo|rápido|lento|feliz|triste|sim|não|tudo|nada|algo|alguém|ninguém|sempre|nunca|agora|depois|antes|aqui|ali)\b/gi,
    fr: /\b(que|pour|dans|avec|une|sur|pas|tout|plus|par|grand|être|avoir|faire|dire|aller|voir|savoir|pouvoir|vouloir|où|quand|comment|pourquoi|frère|sœur|mère|père|fils|fille|maison|eau|temps|vie|amour|paix|est|sont|était|étaient|été|ayant|ai|as|a|avons|avez|ont|suis|es|sommes|êtes|bien|mal|bon|mauvais|grand|petit|nouveau|vieux|haut|bas|rapide|lent|heureux|triste|oui|non|tout|rien|quelque|toujours|jamais|maintenant|après|avant|ici|là)\b/gi,
    de: /\b(der|die|das|und|den|von|mit|sich|des|auf|für|ist|nicht|ein|eine|sein|haben|werden|können|müssen|sollen|wollen|wo|wann|wie|warum|bruder|schwester|mutter|vater|sohn|tochter|haus|wasser|zeit|leben|liebe|frieden|ist|sind|war|waren|gewesen|haben|hat|hatte|hatten|wird|wurde|wurden|gut|schlecht|groß|klein|neu|alt|hoch|niedrig|schnell|langsam|glücklich|traurig|ja|nein|alles|nichts|etwas|jemand|niemand|immer|nie|jetzt|dann|vorher|hier|da)\b/gi,
    it: /\b(che|per|con|una|non|più|come|ma|anche|dove|quando|come|perché|essere|avere|fare|dire|andare|vedere|sapere|potere|volere|fratello|sorella|madre|padre|figlio|figlia|casa|acqua|tempo|vita|amore|pace|è|sono|era|erano|stato|stata|ho|hai|ha|abbiamo|avete|hanno|sarà|saranno|bene|male|buono|cattivo|grande|piccolo|nuovo|vecchio|alto|basso|veloce|lento|felice|triste|sì|no|tutto|niente|qualcosa|qualcuno|nessuno|sempre|mai|ora|dopo|prima|qui|là)\b/gi
  };

  const scores = {};
  Object.keys(patterns).forEach(lang => { scores[lang] = 0; });

  Object.entries(patterns).forEach(([lang, pattern]) => {
    const matches = cleanText.match(pattern);
    scores[lang] = matches ? matches.length : 0;
  });

  const maxScore = Math.max(...Object.values(scores));
  const detectedLang = Object.keys(scores).find(lang => scores[lang] === maxScore);

    
  return maxScore > 0 ? detectedLang : 'unknown';
};

// 🔄 FUNCIÓN DE TRADUCCIÓN CON LIBRE TRANSLATE
const tryLibreTranslate = async (text, targetLang) => {
  try {
        
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: targetLang,
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.translatedText && data.translatedText !== text) {
            return data.translatedText;
    }

    return null;
  } catch (error) {
        return null;
  }
};

// 🔄 FUNCIÓN DE TRADUCCIÓN CON GOOGLE
const tryGoogleTranslate = async (text, targetLang) => {
  try {
        
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      let translation = '';
      
      if (Array.isArray(data[0])) {
        translation = data[0]
          .filter(segment => segment && segment[0])
          .map(segment => segment[0])
          .join('')
          .trim();
      } else {
        translation = data[0][0][0].trim();
      }

      if (translation && translation.toLowerCase() !== text.toLowerCase()) {
                return translation;
      }
    }

    return null;
  } catch (error) {
        return null;
  }
};

// 🌍 FUNCIÓN PRINCIPAL DE TRADUCCIÓN
export const translateText = async (text, targetLang = 'es') => {
  if (!text || text.trim().length === 0) return null;

  const cleanText = text.trim();
  const cacheKey = `${cleanText}_auto_${targetLang}`;

  // Verificar cache
  if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
  }

  // Detectar idioma
  const detectedLang = detectLanguage(cleanText);
  
  // No traducir si ya está en el idioma objetivo
  if (detectedLang === targetLang) {
        return null;
  }

  try {
    
    let translation = null;

    // Intentar LibreTranslate primero
    translation = await tryLibreTranslate(cleanText, targetLang);

    // Si falla, intentar Google
    if (!translation) {
      translation = await tryGoogleTranslate(cleanText, targetLang);
    }

    if (translation) {
      const result = {
        original: cleanText,
        translated: translation,
        detectedLang: detectedLang,
        targetLang: targetLang,
        timestamp: Date.now()
      };

      // Guardar en cache
      translationCache.set(cacheKey, result);
      
            return result;
    }

        return null;

  } catch (error) {
        return null;
  }
};

// 🔧 HOOK DE TRADUCCIÓN
export const useTranslation = () => {
  const [settings, setSettings] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('translationSettings');
        if (saved) {
          return JSON.parse(saved);
        }
      }
    } catch (error) {
          }
    
    return {
      enabled: true,
      targetLanguage: 'es',
      showOriginal: true,
      autoDetect: true,
      translateOutgoing: false,
      showOnlyTranslation: false
    };
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('translationSettings', JSON.stringify(settings));
      }
    } catch (error) {
          }
  }, [settings]);

  const generateMessageId = (message) => {
    if (message.id) return message.id;
    return `${message.text}_${message.timestamp || Date.now()}_${message.type || 'unknown'}`;
  };

  const translateMessage = useCallback(async (message) => {
    if (!settings.enabled || !message || !message.text) {
      return null;
    }

    const messageId = generateMessageId(message);
    
    if (processedMessages.has(messageId)) {
            return null;
    }

    const shouldTranslate = 
      (message.type === 'remote' || message.type === 'incoming') ||
      (message.type === 'local' || message.type === 'outgoing') && settings.translateOutgoing;

    if (!shouldTranslate) {
      return null;
    }

    try {
      processedMessages.add(messageId);
      
      const result = await translateText(message.text, settings.targetLanguage);
      
      if (result) {
        return {
          messageId: messageId,
          ...result
        };
      }

      return null;
    } catch (error) {
            processedMessages.delete(messageId);
      return null;
    }
  }, [settings]);

  const clearProcessedMessages = useCallback(() => {
    processedMessages.clear();
    translationCache.clear();
      }, []);

  return {
    settings,
    setSettings,
    translateMessage,
    clearProcessedMessages,
    languages: TRANSLATION_CONFIG.LANGUAGES
  };
};

// 🎨 COMPONENTE DE MENSAJE TRADUCIDO
export const TranslatedMessage = ({ message, settings }) => {
  const [translationData, setTranslationData] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const safeSettings = settings || {
    enabled: false,
    targetLanguage: 'es',
    showOriginal: true,
    translateOutgoing: false,
    showOnlyTranslation: false
  };

  useEffect(() => {
    const handleTranslation = async () => {
      if (!safeSettings.enabled || !message?.text) {
        setTranslationData(null);
        return;
      }

      const shouldTranslate = 
        (message.type === 'remote' || message.type === 'incoming') ||
        (message.type === 'local' || message.type === 'outgoing') && safeSettings.translateOutgoing;

      if (!shouldTranslate) {
        setTranslationData(null);
        return;
      }

      setIsTranslating(true);

      try {
        const result = await translateText(message.text, safeSettings.targetLanguage);
        setTranslationData(result);
      } catch (error) {
                setTranslationData(null);
      } finally {
        setIsTranslating(false);
      }
    };

    handleTranslation();
  }, [message?.text, safeSettings.enabled, safeSettings.targetLanguage, safeSettings.translateOutgoing, message?.type]);

  if (!safeSettings.enabled || !translationData) {
    return <span>{message?.text || ''}</span>;
  }

  if (isTranslating) {
    return (
      <div className="flex items-center gap-2">
        <span>{message.text}</span>
        <div className="animate-spin rounded-full h-3 w-3 border-b border-current opacity-50"></div>
        <span className="text-xs opacity-50">traduciendo...</span>
      </div>
    );
  }

  if (safeSettings.showOnlyTranslation) {
    return (
      <div>
        <div>{translationData.translated}</div>
        <div className="text-xs opacity-50 flex items-center gap-1 mt-1">
          <Languages size={10} />
          {TRANSLATION_CONFIG.LANGUAGES[translationData.detectedLang]?.flag} traducido
        </div>
      </div>
    );
  }

  if (safeSettings.showOriginal) {
    return (
      <div className="space-y-1">
        <div className="opacity-75 text-sm">
          {translationData.original}
        </div>
        <div className="border-l-2 border-current border-opacity-40 pl-2 font-medium">
          {translationData.translated}
        </div>
        <div className="text-xs opacity-50 flex items-center gap-1">
          <Languages size={10} />
          {TRANSLATION_CONFIG.LANGUAGES[translationData.detectedLang]?.flag} → {TRANSLATION_CONFIG.LANGUAGES[translationData.targetLang]?.flag}
        </div>
      </div>
    );
  }

  return <span>{message?.text || ''}</span>;
};

// ⚙️ CONFIGURACIÓN DEL TRADUCTOR
export const TranslationSettings = ({ isOpen, onClose, settings, onSettingsChange, languages }) => {
  if (!isOpen) return null;

  const popularLanguages = ['es', 'en', 'pt', 'fr', 'de', 'it'];
  const otherLanguages = Object.keys(languages).filter(code => !popularLanguages.includes(code));

  const handleLanguageChange = (newLang) => {
        const newSettings = { ...settings, targetLanguage: newLang };
    onSettingsChange(newSettings);
  };

  const handleSettingChange = (key, value) => {
        const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1f2125] rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Globe className="text-[#ff007a]" size={24} />
            <h3 className="text-white font-semibold text-lg">Configuración de Traducción</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        <div className="mb-6 p-4 bg-[#2b2d31] rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-medium">Traducción automática</span>
            <button
              onClick={() => handleSettingChange('enabled', !settings.enabled)}
              className="text-[#ff007a] transition-transform hover:scale-110"
            >
              {settings.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>
          <p className="text-sm text-gray-400">
            Traduce automáticamente todos los mensajes del chat
          </p>
        </div>

        {settings.enabled && (
          <>
            <div className="mb-6">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <Languages size={18} className="text-[#ff007a]" />
                Traducir todo a: {languages[settings.targetLanguage]?.flag} {languages[settings.targetLanguage]?.name}
              </h4>

              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Idiomas populares:</p>
                <div className="grid grid-cols-2 gap-2">
                  {popularLanguages.map((code) => {
                    const lang = languages[code];
                    if (!lang) return null;
                    return (
                      <button
                        key={code}
                        onClick={() => handleLanguageChange(code)}
                        className={`
                          p-3 rounded-lg text-left transition flex items-center gap-2 text-sm
                          ${settings.targetLanguage === code 
                            ? 'bg-[#ff007a] text-white shadow-lg ring-2 ring-[#ff007a]' 
                            : 'bg-[#383c44] text-white hover:bg-[#4a4f58]'
                          }
                        `}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                        {settings.targetLanguage === code && (
                          <span className="ml-auto text-xs">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {otherLanguages.length > 0 && (
                <details className="mb-4">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-white transition">
                    Ver más idiomas ({otherLanguages.length})
                  </summary>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {otherLanguages.map((code) => {
                      const lang = languages[code];
                      if (!lang) return null;
                      return (
                        <button
                          key={code}
                          onClick={() => handleLanguageChange(code)}
                          className={`
                            p-2 rounded-lg text-left transition flex items-center gap-2 text-xs
                            ${settings.targetLanguage === code 
                              ? 'bg-[#ff007a] text-white ring-1 ring-[#ff007a]' 
                              : 'bg-[#383c44] text-white hover:bg-[#4a4f58]'
                            }
                          `}
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                          {settings.targetLanguage === code && (
                            <span className="ml-auto">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Eye size={18} className="text-[#ff007a]" />
                Opciones de visualización:
              </h4>

              <div className="flex justify-between items-center p-3 bg-[#2b2d31] rounded-lg">
                <div>
                  <span className="text-white text-sm font-medium">Mostrar texto original</span>
                  <p className="text-xs text-gray-400">Ver mensaje original + traducción</p>
                </div>
                <button
                  onClick={() => handleSettingChange('showOriginal', !settings.showOriginal)}
                  className="text-[#ff007a] transition-transform hover:scale-110"
                >
                  {settings.showOriginal ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>

              <div className="flex justify-between items-center p-3 bg-[#2b2d31] rounded-lg">
                <div>
                  <span className="text-white text-sm font-medium">Solo mostrar traducción</span>
                  <p className="text-xs text-gray-400">Reemplazar completamente el mensaje original</p>
                </div>
                <button
                  onClick={() => handleSettingChange('showOnlyTranslation', !settings.showOnlyTranslation)}
                  className="text-[#ff007a] transition-transform hover:scale-110"
                >
                  {settings.showOnlyTranslation ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>

              <div className="flex justify-between items-center p-3 bg-[#2b2d31] rounded-lg">
                <div>
                  <span className="text-white text-sm font-medium">Traducir mis mensajes</span>
                  <p className="text-xs text-gray-400">También traduce los mensajes que envías</p>
                </div>
                <button
                  onClick={() => handleSettingChange('translateOutgoing', !settings.translateOutgoing)}
                  className="text-[#ff007a] transition-transform hover:scale-110"
                >
                  {settings.translateOutgoing ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>
            </div>
          </>
        )}
        <div className="mt-4 p-3 bg-[#2b2d31] rounded-lg">
          <p className="text-xs text-gray-400">
            💡 <strong>Tip:</strong> La traducción usa LibreTranslate y Google Translate para mejor precisión.
          </p>
        </div>
      </div>
    </div>
  );
};

// 🧹 FUNCIONES DE UTILIDAD
export const clearTranslationCache = () => {
  translationCache.clear();
  processedMessages.clear();
  };

export const getTranslationCacheSize = () => {
  return {
    cache: translationCache.size,
    processed: processedMessages.size
  };
};

export const translateSingleMessage = async (text, targetLang = 'es') => {
  if (!text) return null;
  const result = await translateText(text, targetLang);
  return result;
};

// 🔧 CONFIGURACIÓN POR DEFECTO
export const DEFAULT_TRANSLATION_SETTINGS = {
  enabled: true,
  targetLanguage: 'es',
  showOriginal: true,
  autoDetect: true,
  translateOutgoing: false,
  showOnlyTranslation: false
};

// 🎮 COMPONENTE DE CONTROLES SIMPLE
export const TranslatorControls = ({ 
  isEnabled, 
  onToggle, 
  onOpenSettings, 
  isProcessing = false 
}) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-1 rounded-lg transition ${
          isEnabled 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-300 text-gray-700'
        }`}
      >
        <Globe size={16} />
        <span className="text-sm">
          {isEnabled ? 'ON' : 'OFF'}
        </span>
      </button>

      {isEnabled && (
        <>
          <button
            onClick={onOpenSettings}
            className="p-1 text-gray-600 hover:text-gray-800 transition"
            title="Configuración"
          >
            <Settings size={16} />
          </button>

          {isProcessing && (
            <div className="flex items-center gap-1 text-xs text-blue-500">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
              <span>Traduciendo...</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// 📝 EJEMPLO DE USO COMPLETO
export const VideoChatTranslatorExample = () => {
  const {
    settings,
    setSettings,
    translateMessage,
    clearProcessedMessages,
    languages
  } = useTranslation();

  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: "Hola, ¿cómo estás?", 
      type: "remote", 
      sender: "María", 
      timestamp: Date.now() - 10000 
    },
    { 
      id: 2, 
      text: "Hello, how are you doing today?", 
      type: "remote", 
      sender: "John", 
      timestamp: Date.now() - 5000 
    },
    { 
      id: 3, 
      text: "Oi, como você está?", 
      type: "remote", 
      sender: "Carlos", 
      timestamp: Date.now() - 2000 
    }
  ]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-bold text-center">Sistema de Traducción para Videochat</h2>
      
      {/* Controles */}
      <TranslatorControls
        isEnabled={settings.enabled}
        onToggle={() => setSettings({...settings, enabled: !settings.enabled})}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Mensajes */}
      <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h3 className="font-semibold">Mensajes del chat:</h3>
        {messages.map(message => (
          <div key={message.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">{message.sender}:</div>
            <TranslatedMessage
              message={message}
              settings={settings}
            />
          </div>
        ))}
      </div>

      {/* Configuración */}
      <TranslationSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={(newSettings) => setSettings({...settings, ...newSettings})}
        languages={languages}
      />

      {/* Información */}
      <div className="text-center text-sm text-gray-600">
        <p>✅ Detección automática de idioma</p>
        <p>✅ Traducción en tiempo real</p>
        <p>✅ APIs gratuitas (LibreTranslate + Google)</p>
      </div>
    </div>
  );
};

// 🔥 EXPORTACIÓN POR DEFECTO
const translationSystem = {
  TRANSLATION_CONFIG,
  detectLanguage,
  translateText,
  useTranslation,
  TranslatedMessage,
  TranslationSettings,
  TranslatorControls,
  VideoChatTranslatorExample,
  clearTranslationCache,
  getTranslationCacheSize,
  translateSingleMessage,
  DEFAULT_TRANSLATION_SETTINGS
};

export default translationSystem;