import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../utils/auth';

const RateLimitWait = ({ 
  message = "Servidor ocupado, reintentando...", 
  waitTime = 10000,
  onRetry = null,
  fallbackRoute = "/home" 
}) => {
  const [timeLeft, setTimeLeft] = useState(Math.ceil(waitTime / 1000));
  const [isRetrying, setIsRetrying] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const intervalRef = useRef(null);
  const hasRedirected = useRef(false);

  // 🔥 OBTENER PARÁMETROS DESDE REACT ROUTER STATE
  const routerState = location.state || {};
  const finalMessage = routerState.message || message;
  const finalWaitTime = routerState.waitTime || waitTime;
  const finalFallbackRoute = routerState.fallbackRoute || fallbackRoute;
  const finalOnRetry = routerState.onRetry || onRetry;

  // Actualizar timeLeft si viene un waitTime diferente del router
  useEffect(() => {
    setTimeLeft(Math.ceil(finalWaitTime / 1000));
  }, [finalWaitTime]);

  // 🔥 INTENTAR OBTENER ROL DE USUARIO SIN HACER REQUESTS
  useEffect(() => {
    const tryGetUserRole = async () => {
      try {
        // 🔥 BUSCAR EN CACHE PRIMERO (sin hacer request)
        const cachedUser = localStorage.getItem('userCache');
        if (cachedUser) {
          try {
            const parsed = JSON.parse(cachedUser);
            const role = parsed.rol || parsed.role;
            if (role) {
              setUserRole(role);
              return;
            }
          } catch (e) {
          }
        }

        // 🔥 INTENTAR getUser SOLO UNA VEZ (usando cache si está disponible)
        const user = await getUser(false); // NO force refresh
        const role = user.rol || user.role;
        if (role) {
          setUserRole(role);
          
          // Guardar en localStorage para futuras referencias
          localStorage.setItem('userCache', JSON.stringify(user));
        }
      } catch (error) {
        // No hacer nada, dejar que el timer redirija al fallback
      }
    };

    tryGetUserRole();
  }, []);

  // 🔥 COUNTDOWN TIMER
  useEffect(() => {
    if (timeLeft <= 0) {
      handleRedirect();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeLeft, userRole]);

  // 🔥 FUNCIÓN DE REDIRECCIÓN INTELIGENTE
  const handleRedirect = () => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    setIsRetrying(true);

    // Determinar ruta según el rol
    let targetRoute = finalFallbackRoute;

    if (userRole === 'cliente') {
      targetRoute = '/homecliente';
    } else if (userRole === 'modelo') {
      targetRoute = '/homellamadas';
    } else {
    }

    // 🔥 SI HAY CALLBACK PERSONALIZADO, USARLO
    if (finalOnRetry && typeof finalOnRetry === 'function') {
      try {
        const result = finalOnRetry(userRole);
        if (result && typeof result === 'string') {
          targetRoute = result;
        }
      } catch (error) {
      }
    }

    // Pequeño delay para mostrar el estado "reintentando"
    setTimeout(() => {
      navigate(targetRoute, { replace: true });
    }, 500);
  };

  // 🔥 BOTÓN PARA REINTENTAR MANUALMENTE
  const handleManualRetry = () => {
    if (hasRedirected.current) return;
    
    setIsRetrying(true);
    
    // Dar un poco más de tiempo en el reintento manual
    setTimeout(() => {
      handleRedirect();
    }, 1000);
  };

  // 🔥 PROGRESO VISUAL
  const progressPercentage = ((finalWaitTime / 1000 - timeLeft) / (finalWaitTime / 1000)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0d10] to-[#131418] text-white flex items-center justify-center p-4">
      <div className="text-center max-w-md mx-auto">
        {/* ICONO ANIMADO */}
        <div className="mb-8">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-[#ff007a] mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
        </div>

        {/* MENSAJE PRINCIPAL */}
        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">
          {isRetrying ? 'Redirigiendo...' : 'Servidor Ocupado'}
        </h2>
        
        <p className="text-gray-300 mb-6 text-sm sm:text-base">
          {isRetrying 
            ? 'Preparando tu experiencia...' 
            : finalMessage
          }
        </p>

        {/* INFORMACIÓN DEL USUARIO */}
        {userRole && (
          <div className="bg-[#1f2125] rounded-lg p-3 mb-6 border border-[#ff007a]/20">
            <p className="text-sm text-gray-400">Detectado como:</p>
            <p className="text-[#ff007a] font-semibold capitalize">
              {userRole === 'cliente' ? '👤 Cliente' : '👩‍💼 Modelo'}
            </p>
          </div>
        )}

        {!isRetrying && (
          <>
            {/* COUNTDOWN */}
            <div className="mb-6">
              <div className="text-3xl sm:text-4xl font-bold text-[#ff007a] mb-2">
                {timeLeft}
              </div>
              <p className="text-gray-400 text-sm">
                segundos restantes
              </p>
            </div>

            {/* BARRA DE PROGRESO */}
            <div className="w-full bg-gray-700 rounded-full h-2 mb-6">
              <div 
                className="bg-gradient-to-r from-[#ff007a] to-[#ff4081] h-2 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>

            {/* BOTÓN DE REINTENTO MANUAL */}
            <button
              onClick={handleManualRetry}
              className="bg-[#ff007a] hover:bg-[#e6006d] px-6 py-3 rounded-full text-white font-medium transition-all duration-200 hover:scale-105 mb-4"
            >
              🚀 Continuar Ahora
            </button>

            {/* INFORMACIÓN ADICIONAL */}
            <div className="text-xs text-gray-500 mt-4 space-y-1">
              <p>• El servidor está procesando muchas solicitudes</p>
              <p>• Redirigiendo automáticamente en {timeLeft}s</p>
              <p>• Gracias por tu paciencia</p>
            </div>
          </>
        )}

        {isRetrying && (
          <div className="space-y-4">
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-[#ff007a] rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-[#ff007a] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-[#ff007a] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <p className="text-gray-400 text-sm">
              {userRole === 'cliente' ? 'Accediendo al área de clientes...' : 
               userRole === 'modelo' ? 'Accediendo al área de modelos...' : 
               'Accediendo a la plataforma...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RateLimitWait;