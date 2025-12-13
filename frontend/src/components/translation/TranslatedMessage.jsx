// 📁 src/components/Translation/TranslatedMessage.jsx
import React from 'react';

export const TranslatedMessage = ({ 
  message, 
  isOwn = false, 
  getTranslation, 
  isTranslating, 
  translationEnabled 
}) => {
  const originalText = message.text || message.message;
  const translatedText = getTranslation(message.id);
  const isTranslatingNow = isTranslating(message.id);
  
  const hasTranslation = translatedText && translatedText !== originalText && translatedText.trim() !== '';

  return (
    <div className="space-y-1">
      {/* TEXTO ORIGINAL */}
      <div className="text-white">
        {originalText}
        {isTranslatingNow && (
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
          {translatedText}
        </div>
      )}
    </div>
  );
};

// 📁 src/components/Translation/TranslationModal.jsx
import React from 'react';
import { Globe, Settings, X } from 'lucide-react';

export const TranslationModal = ({ 
  isOpen, 
  onClose, 
  currentLanguage, 
  languages, 
  localTranslationEnabled,
  handleLanguageChange 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-xl border border-[#ff007a]/30 shadow-2xl w-80 max-h-[75vh] overflow-hidden">
        {/* Header del modal */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#ff007a]/20 rounded-lg border border-[#ff007a]/30">
              <Globe size={16} className="text-[#ff007a]" />
            </div>
            <h2 className="text-base font-bold text-white">Traductor</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido del modal */}
        <div className="p-3 overflow-y-auto max-h-[calc(75vh-80px)]">
          {/* Advertencia temporal */}
          <div className="mb-3 p-3 bg-amber-500/10 border border-amber-400/30 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white font-bold">!</span>
              </div>
              <div>
                <h4 className="text-amber-300 font-semibold text-sm mb-1">Solo para esta conversación</h4>
                <p className="text-amber-200/80 text-xs leading-tight">
                  Para traducción permanente: 
                  <span className="font-semibold text-amber-100"> Configuración → Idiomas</span>
                </p>
              </div>
            </div>
          </div>

          {/* Sección de idioma */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-[#ff007a]" />
              <h3 className="text-sm font-semibold text-white">Cambiar Idioma</h3>
            </div>

            {/* Estado actual */}
            <div className="mb-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600/30">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Actual:</span>
                <div className="px-2 py-1 rounded-full text-sm font-medium bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30">
                  {languages.find(l => l.code === currentLanguage)?.name || 'Español'}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-300">Traducir:</span>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  localTranslationEnabled 
                    ? 'bg-green-500/20 text-green-300 border border-green-400/30' 
                    : 'bg-gray-500/20 text-gray-400 border border-gray-400/30'
                }`}>
                  {localTranslationEnabled ? 'Activado' : 'Desactivado'}
                </div>
              </div>
            </div>
            
            {/* Lista de idiomas */}
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    handleLanguageChange(lang.code);
                    onClose();
                  }}
                  className={`
                    w-full flex items-center gap-2 p-2.5 rounded-lg transition-all duration-200
                    hover:bg-[#ff007a]/10 hover:border-[#ff007a]/30 border text-left
                    ${currentLanguage === lang.code 
                      ? 'bg-[#ff007a]/20 border-[#ff007a]/50 text-white' 
                      : 'bg-gray-800/50 border-gray-600/30 text-gray-300 hover:text-white'
                    }
                  `}
                >
                  <span className="text-sm">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{lang.name}</p>
                  </div>
                  {currentLanguage === lang.code && (
                    <div className="w-1.5 h-1.5 bg-[#ff007a] rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Información adicional */}
          <div className="p-3 bg-blue-500/10 border border-blue-400/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Settings size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-blue-300 font-semibold text-sm mb-1">Configuración Permanente</h4>
                <p className="text-blue-200/80 text-xs leading-tight">
                  Menú → Configuración → Idiomas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700/50 bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Temporal - Solo esta sesión
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-[#ff007a] text-white text-sm font-medium rounded-lg hover:bg-[#ff007a]/90 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 📁 src/components/Translation/TranslationButton.jsx
import React from 'react';
import { Globe } from 'lucide-react';

export const TranslationButton = ({ onClick, className = "" }) => {
  return (
    <button
      onClick={onClick}
      className={`text-white hover:text-[#ff007a] transition-colors p-2 ${className}`}
      title="Configuración de traducción"
    >
      <Globe size={18} />
    </button>
  );
};
