import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../utils/auth';

const RouteGuard = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAndRedirect = async () => {
      const token = localStorage.getItem('token');
      const roomName = localStorage.getItem('roomName');
      const inCall = localStorage.getItem('inCall');
      const videochatActive = localStorage.getItem('videochatActive');

      // Solo redirigir automáticamente si realmente estamos en una sesión de video
      if (token && roomName && (inCall === 'true' || videochatActive === 'true')) {
        const currentPath = location.pathname;
        
        // 🔥 OBTENER ROL DEL USUARIO PARA REDIRIGIR A LA RUTA CORRECTA
        let userRole = 'modelo'; // Default a modelo
        
        try {
          // Intentar obtener del localStorage primero (más rápido)
          const userDataStr = localStorage.getItem('userData');
          if (userDataStr) {
            try {
              const userData = JSON.parse(userDataStr);
              userRole = userData.role || userData.rol || 'modelo';
            } catch (e) {
              // Si no se puede parsear, intentar obtener del token
              try {
                const tokenParts = token.split('.');
                if (tokenParts.length === 3) {
                  const payload = JSON.parse(atob(tokenParts[1]));
                  userRole = payload.role || payload.user_role || payload.rol || 'modelo';
                }
              } catch (e2) {
                // Si falla, intentar getUser (último recurso)
                try {
                  const userData = await getUser(false); // No forzar refresh
                  const user = userData.user || userData;
                  userRole = user.role || user.rol || 'modelo';
                } catch (e3) {
                  // Si todo falla, usar 'modelo' por defecto
                  userRole = 'modelo';
                }
              }
            }
          } else {
            // Si no hay userData en localStorage, intentar obtener del token
            try {
              const tokenParts = token.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                userRole = payload.role || payload.user_role || payload.rol || 'modelo';
              }
            } catch (e) {
              // Si falla, intentar getUser
              try {
                const userData = await getUser(false);
                const user = userData.user || userData;
                userRole = user.role || user.rol || 'modelo';
              } catch (e2) {
                userRole = 'modelo';
              }
            }
          }
        } catch (error) {
          // Si hay algún error, usar 'modelo' por defecto
          userRole = 'modelo';
        }
        
        // 🔥 BLOQUEAR TODAS LAS RUTAS EXCEPTO VIDEOCHAT SI HAY SALA ACTIVA
        // Verificar que NO estemos ya en videochat
        const isVideoChatRoute = currentPath === '/videochatclient' || 
                                  currentPath === '/videochat' ||
                                  currentPath.startsWith('/videochatclient?') ||
                                  currentPath.startsWith('/videochat?');
        
        if (!isVideoChatRoute) {
          console.log('Redirigiendo a videochat desde:', currentPath, 'role:', userRole);
          
          // 🔥 REDIRIGIR A LA RUTA CORRECTA SEGÚN EL ROL
          const videochatRoute = userRole === 'cliente' ? '/videochatclient' : '/videochat';
          const roomName = localStorage.getItem('roomName');
          const userName = localStorage.getItem('userName');
          
          if (roomName && userName) {
            navigate(`${videochatRoute}?roomName=${encodeURIComponent(roomName)}&userName=${encodeURIComponent(userName)}`, { replace: true });
          } else {
            navigate(videochatRoute, { replace: true });
          }
        }
      }
    };

    checkAndRedirect();
  }, [location.pathname, navigate]);

  return children;

};

export default RouteGuard;