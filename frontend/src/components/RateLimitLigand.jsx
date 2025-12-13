import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Zap, Heart } from 'lucide-react';
import { getUser } from '../utils/auth';
import { useNavigate } from 'react-router-dom';

const RateLimitLigand = ({ 
  retryIn = 60,
  onClose
}) => {
  const [timeLeft, setTimeLeft] = useState(retryIn);
  const [canRetry, setCanRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanRetry(true);
    }
  }, [timeLeft]);

  const handleContinuar = async () => {
    setRetrying(true);
    try {
      // Validar rol del usuario y redirigir
      const userData = await getUser();
      const user = userData.user || userData;
      
      if (user.rol === "cliente") {
        navigate("/homecliente", { replace: true });
      } else if (user.rol === "modelo") {
        navigate("/homellamadas", { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
      
      if (onClose) onClose();
    } catch (error) {
      console.error('Error al validar usuario:', error);
      navigate("/home", { replace: true });
      if (onClose) onClose();
    } finally {
      setRetrying(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-ligand-mix-dark flex items-center justify-center p-4 z-50">
      {/* Efectos de fondo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-fucsia rounded-full opacity-10 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-zorrofucsia rounded-full opacity-10 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-fucsia rounded-full opacity-5 animate-ping"></div>
      </div>

      <div className="relative bg-backgroundDark/90 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-center border border-fucsia/20 shadow-2xl">
        {/* Icono */}
        <div className="mb-6 flex justify-center">
          <div className="bg-gradient-to-r from-fucsia to-zorrofucsia rounded-full p-4 animate-bounce shadow-lg">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Título */}
        <h2 className="text-3xl font-pacifico text-fucsia mb-3">
          ¡Whoa! 🚀
        </h2>

        {/* Mensaje */}
        <p className="text-white/80 mb-6 leading-relaxed text-lg">
          Nuestros servidores están un poco saturados ahora mismo.
        </p>

        <p className="text-white/60 mb-8 text-sm">
          Es por la alta demanda de usuarios conectándose 💕
        </p>

        {/* Timer o Estado */}
        {!canRetry ? (
          <div className="mb-8">
            <div className="bg-fucsia/10 border border-fucsia/30 rounded-2xl p-6 mb-4">
              <Clock className="w-6 h-6 text-fucsia mx-auto mb-2" />
              <div className="text-4xl font-mono font-bold text-fucsia mb-2">
                {formatTime(timeLeft)}
              </div>
              <p className="text-sm text-white/50">
                Podrás continuar en...
              </p>
            </div>
            
            {/* Barra de progreso */}
            <div className="w-full bg-backgroundDark rounded-full h-3 mb-4 border border-fucsia/20">
              <div 
                className="bg-gradient-to-r from-fucsia to-zorrofucsia h-3 rounded-full transition-all duration-1000 shadow-sm"
                style={{ width: `${((retryIn - timeLeft) / retryIn) * 100}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-white/40">
              <Heart className="w-3 h-3 text-fucsia" />
              <span>Mientras tanto, ¿qué tal preparar tu mejor sonrisa?</span>
              <Heart className="w-3 h-3 text-fucsia" />
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 mb-4">
              <RefreshCw className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-green-300 font-semibold text-lg">
                ¡Listo para continuar! ✨
              </p>
              <p className="text-green-400/70 text-sm mt-2">
                Los servidores ya están disponibles
              </p>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="space-y-4">
          {canRetry && (
            <button
              onClick={handleContinuar}
              disabled={retrying}
              className="w-full bg-gradient-to-r from-fucsia to-zorrofucsia text-white font-bold py-4 px-6 rounded-2xl hover:from-fucsia/90 hover:to-zorrofucsia/90 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-3 shadow-lg"
            >
              {retrying ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="text-lg">Validando...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span className="text-lg">¡Continuar! 💕</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => navigate("/home")}
            className="w-full bg-backgroundDark/50 text-white/80 font-medium py-3 px-6 rounded-2xl hover:bg-backgroundDark/70 transition-all duration-200 border border-fucsia/20 text-sm"
          >
            🏠 Volver al inicio
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-fucsia/10">
          <p className="text-xs text-white/40 flex items-center justify-center gap-2">
            <span className="font-pacifico text-fucsia">Ligand</span>
            <Heart className="w-3 h-3 text-fucsia" />
            <span>Esto ayuda a mantener la app rápida para todos</span>
          </p>
        </div>
      </div>
    </div>
  );
};

// Hook para manejar rate limiting
export const useRateLimitHandler = () => {
  const [showRateLimit, setShowRateLimit] = useState(false);
  const [retryAfter, setRetryAfter] = useState(60);

  const handleRateLimit = (error) => {
    if (error.response?.status === 429) {
      const retryAfterHeader = error.response.headers['retry-after'];
      const retryTime = retryAfterHeader ? parseInt(retryAfterHeader) : 60;
      
      setRetryAfter(retryTime);
      setShowRateLimit(true);
      
      console.log(`🚦 Rate limited. Retry after: ${retryTime} seconds`);
      return true;
    }
    return false;
  };

  const hideRateLimit = () => {
    setShowRateLimit(false);
    setRetryAfter(60);
  };

  const RateLimitComponent = showRateLimit ? (
    <RateLimitLigand
      retryIn={retryAfter}
      onClose={hideRateLimit}
    />
  ) : null;

  return {
    showRateLimit,
    handleRateLimit,
    hideRateLimit,
    RateLimitComponent
  };
};

export default RateLimitLigand;