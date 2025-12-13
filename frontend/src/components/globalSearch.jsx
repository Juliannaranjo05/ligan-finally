// src/components/GlobalSearching.jsx - CREAR ESTE ARCHIVO
import React from 'react';
import { useSearching } from '../contexts/SearchingContext.jsx';

// 🔥 TU COMPONENTE EXACTO - COPIADO TAL COMO LO TIENES
const SearchingUserLoading = ({ userRole, isVisible }) => {
  if (!isVisible) return null;

  const isModel = userRole === 'modelo';

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#0a0d10] to-[#131418] text-white flex items-center justify-center z-50">
      <div className="text-center max-w-md mx-auto p-6">
        {/* Spinner animado */}
        <div className="relative mb-8">
          <div className="animate-spin rounded-full h-24 w-24 border-4 border-transparent border-t-[#ff007a] border-r-[#ff007a] mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-4xl animate-pulse">
              {isModel ? '👩‍💼' : '👤'}
            </div>
          </div>
        </div>

        {/* Título principal */}
        <h2 className="text-2xl font-bold mb-4 text-white">
          🔍 Buscando {isModel ? 'clientes' : 'modelos'}...
        </h2>

        {/* Descripción */}
        <p className="text-gray-400 mb-6 text-sm leading-relaxed">
          {isModel 
            ? 'Conectándote con clientes disponibles para tu próximo show'
            : 'Buscando modelos en línea para tu próxima experiencia'
          }
        </p>

        {/* Indicadores de progreso */}
        <div className="space-y-4">
          <div className="w-full bg-[#1e1f24] rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-[#ff007a] to-pink-500 h-2 rounded-full animate-pulse"
                 style={{
                   animation: 'loading-bar 2s ease-in-out infinite',
                   width: '60%'
                 }}>
            </div>
          </div>

          {/* Estados de búsqueda */}
          <div className="text-xs text-gray-500 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
              <span>Escaneando usuarios disponibles...</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span>Verificando compatibilidad...</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
              <span>Preparando conexión...</span>
            </div>
          </div>
        </div>

        {/* Consejos mientras espera */}
        <div className="mt-8 p-4 bg-[#1a1b1f] rounded-lg border border-[#ff007a]/30">
          <p className="text-xs text-gray-300">
            💡 <strong>Consejo:</strong> {isModel 
              ? 'Asegúrate de tener buena iluminación y una sonrisa lista'
              : 'Ten tus monedas listas para enviar regalos'
            }
          </p>
        </div>

        {/* Información adicional */}
        <div className="mt-6 text-xs text-gray-500">
          <p>⚡ Conexión automática en segundos</p>
          <p>🌐 Sistema Omegle Premium</p>
        </div>
      </div>

      {/* CSS para la animación de la barra */}
      <style jsx>{`
        @keyframes loading-bar {
          0% { width: 10%; }
          50% { width: 70%; }
          100% { width: 10%; }
        }
      `}</style>
    </div>
  );
};

// 🔥 WRAPPER QUE USA EL CONTEXTO GLOBAL
const GlobalSearching = () => {
  const { isSearchingUser, searchingUserRole } = useSearching();
  
  return (
    <SearchingUserLoading 
      userRole={searchingUserRole} 
      isVisible={isSearchingUser} 
    />
  );
};

export default GlobalSearching;