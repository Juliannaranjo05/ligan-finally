import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const RouteGuard = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const roomName = localStorage.getItem('roomName');
    const inCall = localStorage.getItem('inCall');
    const videochatActive = localStorage.getItem('videochatActive');

    // Solo redirigir automáticamente si realmente estamos en una sesión de video
    if (token && roomName && (inCall === 'true' || videochatActive === 'true')) {
      const currentPath = location.pathname;
      
      // Rutas bloqueadas
      const rutasBloqueadas = [
        '/homellamadas',
        '/esperando', 
        '/mensajes',
        '/favorites',
        '/historysu',
        '/esperandocall',
        '/configuracion',
        '/home',
        '/'
      ];
      
      if (rutasBloqueadas.includes(currentPath)) {
        console.log('🚫 RUTA BLOQUEADA POR GUARD (session active):', currentPath);
        
        // Redirigir inmediatamente a videochat
        navigate('/videochat', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return children;

};

export default RouteGuard;