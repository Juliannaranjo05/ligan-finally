import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const RouteGuard = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const roomName = localStorage.getItem('roomName');
    
    if (token && roomName) {
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
        console.log('🚫 RUTA BLOQUEADA POR GUARD:', currentPath);
        
        // Redirigir inmediatamente a videochat
        navigate('/videochat', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return children;

};

export default RouteGuard;