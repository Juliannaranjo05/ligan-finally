import { useEffect } from 'react';
import { getUser } from '../../utils/auth';

/**
 * Hook para validar sesión y rol en componentes protegidos
 * @param {string} requiredRole - Rol requerido ('cliente', 'modelo', 'admin')
 * @param {boolean} enabled - Si la validación está habilitada (default: true)
 */
export const useSessionValidation = (requiredRole, enabled = true) => {
  // 🔥 ESTABILIZADO: navigate no se usa en este hook, se usa window.location.href
  // Removido useNavigate ya que no es necesario

  useEffect(() => {
    console.log('🔄 [useSessionValidation] useEffect ejecutado', { requiredRole, enabled });
    if (!enabled) return;

    const validateSession = async () => {
      console.log('🔍 [useSessionValidation] Validando sesión...', { requiredRole });
      // Verificar flag de sesión cerrada primero
      const sessionClosedFlag = localStorage.getItem('session_closed_by_other_device');
      if (sessionClosedFlag === 'true') {
        // Si hay flag de sesión cerrada, no hacer nada aquí
        // SessionClosedAlert se encargará de mostrar el alert y redirigir
        return;
      }

      // Verificar que existe token
      const token = localStorage.getItem('token');
      if (!token || token.trim() === '') {
        // No hay token, limpiar todo y redirigir a /home
        try {
          localStorage.removeItem('user');
          localStorage.removeItem('session_closed_by_other_device');
        } catch (e) {
          // Ignorar errores
        }
        window.location.href = '/home';
        return;
      }

      // Verificar con el servidor
      try {
        const userData = await getUser();
        
        // Verificar que se obtuvo un usuario válido
        if (!userData || (!userData.user && !userData.id)) {
          // No hay usuario válido, limpiar y redirigir
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('session_closed_by_other_device');
          } catch (e) {
            // Ignorar errores
          }
          window.location.href = '/home';
          return;
        }

        const user = userData.user || userData;
        const userRole = user.rol || user.role;

        // Verificar que el usuario tiene el rol requerido
        if (userRole !== requiredRole) {
          console.log('⚠️ [useSessionValidation] Rol incorrecto', { userRole, requiredRole });
          // Rol incorrecto, redirigir según rol
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } catch (e) {
            // Ignorar errores
          }
          
          if (userRole === 'cliente') {
            window.location.href = '/homecliente';
          } else if (userRole === 'modelo') {
            window.location.href = '/homellamadas';
          } else if (userRole === 'admin') {
            window.location.href = '/admin/dashboard';
          } else {
            window.location.href = '/home';
          }
          return;
        }
        
        console.log('✅ [useSessionValidation] Sesión validada correctamente', { userRole, requiredRole });
      } catch (err) {
        // Si hay error, verificar si es por sesión cerrada
        const sessionClosedFlag = localStorage.getItem('session_closed_by_other_device');
        if (sessionClosedFlag !== 'true') {
          // No es sesión cerrada por otro dispositivo, limpiar y redirigir
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } catch (e) {
            // Ignorar errores
          }
          window.location.href = '/home';
        }
      }
    };

    validateSession();
  }, [requiredRole, enabled]); // 🔥 ESTABILIZADO: Removido navigate de las dependencias
};



