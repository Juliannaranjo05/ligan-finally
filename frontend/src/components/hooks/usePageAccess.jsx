// src/hooks/usePageAccess.jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../../utils/auth';

// 🔥 PROTECCIONES GLOBALES CONTRA LOOPS
let GLOBAL_PROCESSING = false;

export function usePageAccess() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const hasFetched = useRef(false);
  const componentId = useRef(Math.random().toString(36).substr(2, 9));
  
  // 🎯 DEFINIR RUTAS POR ROL (Solo para usuarios con registro COMPLETADO)
  const ROLE_ROUTES = {
    cliente: {
      home: '/homecliente',
      allowedPaths: [
        '/homecliente',
        '/esperandocallcliente', 
        '/videochatclient',
        '/message',
        '/mensajes', // 🔗 Permitir acceso a mensajes para clientes (usado por links de perfil)
        '/mensajesmobileclient',
        '/favoritesboy',
        '/usersearch', // 🔍 Compartida con modelo
        '/settings'
      ]
    },
    modelo: {
      home: '/homellamadas',
      allowedPaths: [
        '/homellamadas',
        '/mensajes',
        '/mensajesmobile',
        '/favorites', 
        '/historysu',
        '/esperandocall',
        '/videochat',
        '/configuracion',
        '/VideoRecorderUpload',
        '/usersearch' // 🔍 Compartida con cliente
      ]
    },
    admin: {
      home: '/verificacionesadmin',
      allowedPaths: [
        '/verificacionesadmin'
      ]
    }
  };

  // 🔓 RUTAS PÚBLICAS (no requieren verificación de rol)
  const PUBLIC_ROUTES = [
    '/home',
    '/login', 
    '/logout',
    '/rate-limit-wait'
  ];

  // 📝 RUTAS DE REGISTRO (manejadas por useRegistrationAccess)
  const REGISTRATION_ROUTES = [
    '/verificaremail',
    '/genero',
    '/verificacion',
    '/anteveri', 
    '/esperando'
  ];

  // 🛡️ VERIFICAR SI USUARIO VERIFICADO INTENTA ACCEDER A RUTAS BLOQUEADAS
  const isAttemptingBlockedRoute = (user, currentPath) => {
    const isFullyVerified = isRegistrationComplete(user);
    const isBlockedRoute = REGISTRATION_ROUTES.includes(currentPath); // 🔧 USAR REGISTRATION_ROUTES
    
    if (isFullyVerified && isBlockedRoute) {
            return true;
    }
    
    return false;
  };

  // 🎯 VERIFICAR SI EL USUARIO TIENE REGISTRO COMPLETADO
  const isRegistrationComplete = (user) => {
    if (!user.email_verified_at) {
      return false;
    }

    // 🔧 CORREGIDO: Usar solo verificacion_estado
    const verificacionEstado = user.verificacion_estado;

    
    switch (user.rol) {
      case 'cliente':
        // CLIENTE: Solo necesita email verificado + rol cliente
        const clienteCompleto = user.rol === 'cliente';
                return clienteCompleto;
        
      case 'modelo':
        // MODELO: Si estado es 'aprobada', está completo independientemente de verificacion_completa
        const modeloCompleto = verificacionEstado === 'aprobada' || (user.verificacion_completa && verificacionEstado === 'aprobada');
                return modeloCompleto;
        
      case 'admin':
        // ADMIN: Si estado es 'aprobada', está completo independientemente de verificacion_completa  
        const adminCompleto = verificacionEstado === 'aprobada' || (user.verificacion_completa && verificacionEstado === 'aprobada');
                return adminCompleto;
        
      default:
                return false;
    }
  };

  useEffect(() => {
    const checkAndRedirect = async () => {
      // 🛑 PREVENIR MÚLTIPLES EJECUCIONES
      if (hasFetched.current || GLOBAL_PROCESSING) {
                return;
      }

      const currentPath = location.pathname;

      // 🔓 Si está en ruta pública, no verificar
      if (PUBLIC_ROUTES.includes(currentPath)) {
                setLoading(false);
        return;
      }

      // 📝 Si está en ruta de registro, delegar a useRegistrationAccess
      if (REGISTRATION_ROUTES.includes(currentPath)) {
                setLoading(false);
        return;
      }

      // Verificar token
      const token = localStorage.getItem('token');
      if (!token) {
                navigate("/home", { replace: true });
        return;
      }

      try {
                
        hasFetched.current = true;
        GLOBAL_PROCESSING = true;

        // Obtener usuario
        const response = await getUser();
        const user = response?.user || response;

        if (!user) {
                    navigate("/home", { replace: true });
          return;
        }

        // 🔧 CORREGIDO: Usar solo verificacion_estado para el log
        const verificacionEstado = user.verificacion_estado;

        
        // 🛡️ VERIFICAR SI USUARIO VERIFICADO INTENTA ACCEDER A RUTAS BLOQUEADAS
        if (isAttemptingBlockedRoute(user, currentPath)) {
          const roleConfig = ROLE_ROUTES[user.rol];
          if (roleConfig) {
                        navigate(roleConfig.home, { replace: true });
            return;
          }
        }

        // 🔍 VERIFICAR SI EL REGISTRO ESTÁ COMPLETO
        if (!isRegistrationComplete(user)) {
                              
          // Redirigir al inicio del flujo de registro
          if (!user.email_verified_at) {
            navigate("/verificaremail", { replace: true });
          } else if (!user.rol || user.rol === 'user') {
            navigate("/genero", { replace: true });
          } else if (user.rol === 'cliente') {
            // Cliente con email verificado debería estar completo
            // Si llegó aquí es porque hay un problema, verificar en género
            navigate("/genero", { replace: true });
          } else if (user.rol === 'modelo') {
            // 🔧 CORREGIDO: Usar solo verificacion_estado para las condiciones
            if (!user.verificacion_completa) {
              navigate("/anteveri", { replace: true });
            } else if (verificacionEstado === 'pendiente') {
                            navigate("/esperando", { replace: true });
            } else if (verificacionEstado === 'rechazada') {
              navigate("/anteveri", { replace: true });
            } else {
              navigate("/anteveri", { replace: true });
            }
          } else {
            navigate("/verificaremail", { replace: true });
          }
          return;
        }

        // 🎯 USUARIO CON REGISTRO COMPLETO - VERIFICAR ACCESO POR ROL
        const userRole = user.rol;
        
        const roleConfig = ROLE_ROUTES[userRole];
        
        if (!roleConfig) {
                    navigate("/home", { replace: true });
          return;
        }

        // Si está en /dashboard, redirigir a su home correspondiente
        if (currentPath === '/dashboard') {
                    navigate(roleConfig.home, { replace: true });
          return;
        }

        // Si está en rutas de registro pero ya está completo, BLOQUEAR y redirigir a su home
        if (REGISTRATION_ROUTES.includes(currentPath)) {
                              navigate(roleConfig.home, { replace: true });
          return;
        }

        // Verificar si la ruta actual está permitida para este rol
        const isAllowedPath = roleConfig.allowedPaths.includes(currentPath);

        if (!isAllowedPath) {
                    navigate(roleConfig.home, { replace: true });
          return;
        }

        
      } catch (error) {
                
        // Si hay error, redirigir a home
        if (error.response?.status === 401 || error.response?.status === 403) {
          navigate("/home", { replace: true });
        }
        
      } finally {
        GLOBAL_PROCESSING = false;
        setLoading(false);
      }
    };

    // 🚀 INICIAR VERIFICACIÓN
    if (!hasFetched.current && !GLOBAL_PROCESSING) {
      checkAndRedirect();
    }

    // 🧹 CLEANUP
    return () => {
      hasFetched.current = false;
      GLOBAL_PROCESSING = false;
    };

  }, [location.pathname]); // Se ejecuta cuando cambia la ruta

  return { loading };
}

// 🛡️ COMPONENTE WRAPPER para rutas con registro completo
export function ProtectedPage({ children }) {
  const { loading } = usePageAccess();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white/80">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  return children;
}