/**
 * 🔥 UTILIDADES PARA MANEJO DE SESIÓN SUSPENDIDA
 * Función centralizada para detectar y manejar SESSION_SUSPENDED
 */

/**
 * Verifica si una respuesta HTTP indica sesión suspendida y recarga inmediatamente
 * @param {Response} response - La respuesta del fetch
 * @returns {Promise<boolean>} - true si se detectó SESSION_SUSPENDED y se recargó
 */
export const checkAndHandleSuspendedSession = async (response) => {
  if (response.status === 401 || response.status === 403) {
    try {
      const errorData = await response.json().catch(() => ({}));
      const codigo = errorData.code || errorData.codigo || '';
      
      if (codigo === 'SESSION_SUSPENDED') {
        console.warn('⏸️ [SessionUtils] Sesión suspendida detectada - cerrando inmediatamente');
        
        // 🔥 LIMPIAR TODO Y RECARGAR INMEDIATAMENTE
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (error) {
          // Ignorar errores de storage
        }
        
        // 🔥 RECARGAR INMEDIATAMENTE - Sin delays, sin eventos, sin modales
        console.warn('🔄 [SessionUtils] Recargando página...');
        window.location.reload();
        
        return true; // Indica que se recargó
      }
    } catch (error) {
      // Si no se puede parsear el JSON, no es SESSION_SUSPENDED
      console.debug('No se pudo parsear respuesta de error:', error);
    }
  }
  
  return false; // No se detectó SESSION_SUSPENDED
};

/**
 * Maneja errores de fetch que pueden contener SESSION_SUSPENDED
 * @param {Error} error - El error del fetch
 * @returns {Promise<boolean>} - true si se detectó SESSION_SUSPENDED y se recargó
 */
export const handleFetchError = async (error) => {
  // Si el error tiene una respuesta, verificar si es SESSION_SUSPENDED
  if (error.response) {
    return await checkAndHandleSuspendedSession(error.response);
  }
  
  return false;
};











