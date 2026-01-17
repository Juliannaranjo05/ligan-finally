import { useState, useEffect, useRef } from "react";
import i18n from "../i18n";
import { useGlobalTranslation } from "../contexts/GlobalTranslationContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ligandome.com';

const languages = [
  { code: "es", label: "Español", flag: "/flags/es.png" },
  { code: "en", label: "English", flag: "/flags/en.png" },
  { code: "pt", label: "Português", flag: "/flags/pt.png" },
  { code: "fr", label: "Français", flag: "/flags/fr.png" },
  { code: "de", label: "Deutsch", flag: "/flags/de.png" },
  { code: "ru", label: "Русский", flag: "/flags/ru.png" },
  { code: "tr", label: "Türkçe", flag: "/flags/tr.png" },
  { code: "hi", label: "हिन्दी", flag: "/flags/hi.png" },
  { code: "it", label: "italian", flag: "/flags/it.png" },
];

export default function LanguageSelector() {
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const selectorRef = useRef(null);
  
  // Obtener el contexto global (ahora no lanza error si no está disponible)
  const { changeGlobalLanguage } = useGlobalTranslation();
  
  const selectedLang =
    languages.find((l) => l.code === i18n.language) || languages[0];

  // Función para obtener headers con autenticación
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Requested-With': 'XMLHttpRequest'
    };
  };

  // Función para actualizar el idioma en el backend
  const updateLanguageInBackend = async (languageCode) => {
    const token = localStorage.getItem("token");
    if (!token) {
      // Si no hay token, solo actualizar localmente
      return { success: true };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/language/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ language: languageCode })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('Error actualizando idioma en backend:', error);
      // Retornar éxito para que el cambio local se aplique de todas formas
      return { success: true };
    }
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target)
      ) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = async (code) => {
    // Si ya está actualizando o es el mismo idioma, no hacer nada
    if (isUpdating || code === i18n.language) {
      setShowLangMenu(false);
      return;
    }

    setIsUpdating(true);
    
    try {
      // 🔥 ACTUALIZAR EN EL BACKEND PRIMERO
      const backendResult = await updateLanguageInBackend(code);
      
      // 🔥 GUARDAR EN TODAS LAS CLAVES PARA COMPATIBILIDAD
      localStorage.setItem("lang", code);
      localStorage.setItem("selectedLanguage", code);
      localStorage.setItem("userPreferredLanguage", code);
      
      // 🔥 CAMBIAR IDIOMA EN i18n (esto disparará el listener en GlobalTranslationContext)
      await i18n.changeLanguage(code);
      
      // 🔥 CAMBIAR IDIOMA EN CONTEXTO GLOBAL DE TRADUCCIÓN (ya se sincroniza automáticamente con i18n, pero lo hacemos explícitamente)
      if (typeof changeGlobalLanguage === 'function') {
        try {
          changeGlobalLanguage(code);
        } catch (error) {
          console.warn('Error cambiando idioma global:', error);
        }
      }
      
      // 🔥 DISPARAR EVENTO PARA NOTIFICAR EL CAMBIO
      window.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { language: code }
      }));
      
      // 🔥 OPTIMIZADO: Verificar si estamos en una videollamada activa antes de recargar
      // Si estamos en videollamada, NO recargar para evitar perder el estado
      const isInVideoChat = () => {
        // Verificar localStorage y sessionStorage
        const videochatActive = localStorage.getItem('videochatActive') === 'true' || 
                               sessionStorage.getItem('videochatActive') === 'true';
        const hasRoomName = !!localStorage.getItem('roomName') || !!sessionStorage.getItem('roomName');
        const inCall = localStorage.getItem('inCall') === 'true' || sessionStorage.getItem('inCall') === 'true';
        
        // Verificar ruta actual
        const currentPath = window.location.pathname;
        const isVideoChatRoute = currentPath.includes('/videochatclient') || 
                                currentPath.includes('/videochat');
        
        return (videochatActive || hasRoomName || inCall || isVideoChatRoute);
      };
      
      // Si el backend se actualizó correctamente, recargar la página SOLO si NO estamos en videollamada
      if (backendResult.success) {
        if (isInVideoChat()) {
          // 🔥 NO RECARGAR si estamos en videollamada - el cambio de idioma se aplicará sin recargar
          console.log('🌐 [LanguageSelector] Cambio de idioma aplicado SIN recargar (videollamada activa)');
          // El cambio de idioma ya se aplicó con i18n.changeLanguage, no necesitamos recargar
        } else {
          // Recargar solo si NO estamos en videollamada
        setTimeout(() => {
          window.location.reload();
        }, 300);
        }
      } else {
        // Si no se recarga, asegurarse de que el cambio se refleje inmediatamente
        // (el listener de i18n en GlobalTranslationContext ya lo maneja)
      }
      
      setShowLangMenu(false);
    } catch (error) {
      console.error('Error cambiando idioma:', error);
      // Aún así aplicar el cambio localmente
      localStorage.setItem("lang", code);
      localStorage.setItem("selectedLanguage", code);
      localStorage.setItem("userPreferredLanguage", code);
      i18n.changeLanguage(code);
      setShowLangMenu(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div ref={selectorRef} className="relative z-50 flex items-center">
      <button
        onClick={() => setShowLangMenu(!showLangMenu)}
        disabled={isUpdating}
        className="w-10 h-7 bg-no-repeat bg-center bg-contain rounded-none disabled:opacity-50"
        style={{ backgroundImage: `url(${selectedLang.flag})` }}
        aria-label="Cambiar idioma"
      />

      {showLangMenu && (
        <div className="absolute top-10 left-0 bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-lg shadow-xl p-2 min-w-[160px]">
          {isUpdating && (
            <div className="px-2 py-1 text-xs text-white/60 text-center">
              Actualizando...
            </div>
          )}
          {languages.map(({ code, label, flag }) => (
            <button
              key={code}
              onClick={() => handleLanguageChange(code)}
              disabled={isUpdating}
              className={`flex items-center gap-3 w-full px-2 py-2 text-white text-[15px] rounded-md hover:bg-[#ff007a]/30 disabled:opacity-50 disabled:cursor-not-allowed ${
                i18n.language === code ? "bg-[#ff007a]/20" : ""
              }`}
            >
              <img
                src={flag}
                alt={label}
                className="w-6 h-4 object-cover rounded-sm"
              />
              <span>{label}</span>
              {i18n.language === code && (
                <span className="ml-auto text-[#ff007a] text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
