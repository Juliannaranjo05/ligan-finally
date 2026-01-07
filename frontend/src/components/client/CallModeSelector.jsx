import React, { useState, useEffect } from 'react';
import { Users, User, AlertCircle, Info } from 'lucide-react';

// 🔥 DETECTAR SI ESTAMOS EN PRODUCCIÓN
const isProduction = () => {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
  return apiUrl.includes('ligandome.com') || apiUrl.includes('https://');
};

const CallModeSelector = ({
  onModeChange,
  disabled = false,
  initialMode = 'normal',
  availableModelos = [] // 🔥 NUEVO: Lista de modelos disponibles
}) => {
  const [mode, setMode] = useState(initialMode);
  const [selectedModelos, setSelectedModelos] = useState([]);
  const [showDisabledTooltip, setShowDisabledTooltip] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const isProd = isProduction();
  const is2vs1Disabled = isProd; // 🔥 Deshabilitar 2vs1 en producción

  // Sincronizar con initialMode cuando cambie
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleModeToggle = (newMode) => {
    if (disabled) return;
    
    // 🔥 BLOQUEAR 2VS1 EN PRODUCCIÓN
    if (newMode === 'dual' && is2vs1Disabled) {
      setShowDisabledTooltip(true);
      setTimeout(() => setShowDisabledTooltip(false), 3000);
      return;
    }
    
    setMode(newMode);
    if (newMode === 'normal') {
      setSelectedModelos([]);
      onModeChange('normal', []);
    } else {
      // Modo dual: el modal se abrirá desde el componente padre
      onModeChange('dual', []);
    }
  };

  return (
    <div className="call-mode-selector flex flex-col items-center justify-center w-full">
      {/* Label */}
      <label className="text-sm font-medium text-white/80 mb-3 whitespace-nowrap">
        Modo de llamada:
      </label>
      
      {/* Toggle moderno estilo iOS/Android */}
      <div className="relative inline-flex items-center bg-[#1f2125] rounded-full p-1 border border-[#ff007a]/20 shadow-lg">
        {/* Indicador deslizante */}
        <div
          className={`absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-[#ff007a] to-[#e6006e] transition-all duration-300 ease-out shadow-lg shadow-[#ff007a]/50 ${
            mode === 'normal' ? 'left-1 w-[calc(50%-0.25rem)]' : 'left-[calc(50%+0.125rem)] w-[calc(50%-0.25rem)]'
          }`}
        />
        
        {/* Botón 1vs1 */}
        <button
          type="button"
          onClick={() => handleModeToggle('normal')}
          disabled={disabled}
          className={`
            relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 whitespace-nowrap min-w-[100px] justify-center
            ${mode === 'normal'
              ? 'text-white font-semibold'
              : 'text-white/60 hover:text-white/80'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-label="Modo 1vs1"
          aria-pressed={mode === 'normal'}
        >
          <User size={18} className={`transition-transform duration-300 ${mode === 'normal' ? 'scale-110' : ''}`} />
          <span className="text-sm font-medium">1vs1</span>
        </button>
        
        {/* Botón 2vs1 */}
        <button
          type="button"
          onClick={() => handleModeToggle('dual')}
          disabled={disabled || is2vs1Disabled}
          className={`
            relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 whitespace-nowrap min-w-[100px] justify-center
            ${mode === 'dual' && !is2vs1Disabled
              ? 'text-white font-semibold'
              : is2vs1Disabled
              ? 'text-gray-500 cursor-not-allowed opacity-60'
              : 'text-white/60 hover:text-white/80'
            }
            ${disabled || is2vs1Disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          title={is2vs1Disabled ? 'Función 2vs1 no disponible temporalmente' : ''}
          aria-label="Modo 2vs1"
          aria-pressed={mode === 'dual'}
          aria-disabled={is2vs1Disabled}
        >
          <Users size={18} className={`transition-transform duration-300 ${mode === 'dual' ? 'scale-110' : ''}`} />
          <span className="text-sm font-medium">2vs1</span>
          {is2vs1Disabled && (
            <AlertCircle size={14} className="ml-1 text-yellow-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* 🔥 MENSAJE DE FUNCIÓN NO DISPONIBLE - Mejorado */}
      {is2vs1Disabled && (
        <div className="mt-3 px-3 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg text-center w-full max-w-xs backdrop-blur-sm">
          <div className="flex items-center gap-2 justify-center">
            <AlertCircle size={14} className="text-yellow-400 flex-shrink-0" />
            <p className="text-xs text-yellow-300 leading-tight font-medium">
              2vs1 no disponible temporalmente
            </p>
            <div 
              className="relative"
              onMouseEnter={() => setShowInfoTooltip(true)}
              onMouseLeave={() => setShowInfoTooltip(false)}
            >
              <Info size={12} className="text-yellow-400/70 cursor-help" />
              {showInfoTooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[#1f2125] text-white text-xs rounded-lg border border-[#ff007a]/30 whitespace-nowrap z-20 shadow-xl">
                  Esta función estará disponible próximamente
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1f2125]"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Indicador cuando está en modo dual - Solo si no está deshabilitado */}
      {mode === 'dual' && !is2vs1Disabled && (
        <div className="mt-3 px-3 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg w-full max-w-xs backdrop-blur-sm animate-fadeIn">
          <p className="text-xs text-blue-300 text-center leading-tight font-medium">
            Haz clic en "Iniciar Llamada" para configurar los 2 modelos
          </p>
        </div>
      )}

      {/* Tooltip cuando intentan hacer clic en 2vs1 deshabilitado */}
      {showDisabledTooltip && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-3 rounded-xl shadow-2xl border border-red-500/50 animate-slideDown backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="animate-pulse" />
            <span className="text-sm font-semibold">
              Función 2vs1 no disponible en este momento
            </span>
          </div>
        </div>
      )}

      {/* Estilos adicionales para animaciones */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CallModeSelector;

