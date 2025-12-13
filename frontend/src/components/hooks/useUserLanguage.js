// hooks/useUserLanguage.js
import { useEffect } from 'react';

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
            localStorage.setItem('userPreferredLanguage', dbLanguage);
                        
            // Actualizar i18next si está disponible
            if (window.i18n && typeof window.i18n.changeLanguage === 'function') {
              window.i18n.changeLanguage(dbLanguage);
                          }
            
            // Disparar evento personalizado para notificar el cambio
            window.dispatchEvent(new CustomEvent('userLanguageChanged', {
              detail: { language: dbLanguage }
            }));
          } else {
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
        // Actualizar localStorage
        localStorage.setItem('userPreferredLanguage', data.preferred_language);
                
        // Actualizar i18next
        if (window.i18n && typeof window.i18n.changeLanguage === 'function') {
          window.i18n.changeLanguage(data.preferred_language);
        }
        
        return { success: true, language: data.preferred_language };
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