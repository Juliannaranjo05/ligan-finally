// hooks/useUserLanguage.js
import { useEffect } from 'react';
import i18n from '../../i18n';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useUserLanguage = () => {
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Requested-With': 'XMLHttpRequest'
    };
  };

  const syncUserLanguage = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
            return;
    }

    try {
            
      const response = await fetch(`${API_BASE_URL}/api/profile/info`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.user.preferred_language) {
          const currentLocalLang = localStorage.getItem('userPreferredLanguage');
          const dbLanguage = data.user.preferred_language;
          
                              
          // Solo actualizar si es diferente
          if (currentLocalLang !== dbLanguage) {
            // Guardar en todas las claves para compatibilidad
            localStorage.setItem('lang', dbLanguage); // Clave principal de i18n
            localStorage.setItem('userPreferredLanguage', dbLanguage);
            localStorage.setItem('selectedLanguage', dbLanguage);
            
            // Actualizar i18n
            if (i18n.language !== dbLanguage) {
              i18n.changeLanguage(dbLanguage);
            }
            
            // Disparar evento personalizado para notificar el cambio
            window.dispatchEvent(new CustomEvent('userLanguageChanged', {
              detail: { language: dbLanguage }
            }));
          }
        } else {
                  }
      } else {
              }
    } catch (error) {
          }
  };

  const updateUserLanguage = async (newLanguage) => {
    try {
            
      const response = await fetch(`${API_BASE_URL}/api/profile/language/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ language: newLanguage })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const newLang = data.preferred_language;
        
        // Actualizar localStorage en todas las claves
        localStorage.setItem('lang', newLang); // Clave principal de i18n
        localStorage.setItem('userPreferredLanguage', newLang);
        localStorage.setItem('selectedLanguage', newLang);
        
        // Actualizar i18n
        if (i18n.language !== newLang) {
          i18n.changeLanguage(newLang);
        }
        
        return { success: true, language: newLang };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
            return { success: false, error: 'Error de conexión' };
    }
  };

  // Sincronizar idioma cuando el hook se monta
  useEffect(() => {
    syncUserLanguage();
  }, []);

  // Escuchar cambios en el token (nuevo login)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token' && e.newValue) {
                setTimeout(syncUserLanguage, 500); // Pequeño delay para asegurar que el token esté disponible
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return {
    syncUserLanguage,
    updateUserLanguage
  };
};

export default useUserLanguage;