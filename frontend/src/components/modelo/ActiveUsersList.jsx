import React, { useState, useMemo, memo } from 'react';
import { Users, Phone, MessageSquare, Search, Grid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SkeletonLoader from '../client/SkeletonLoader';

/**
 * ActiveUsersList - Componente mejorado para la lista de usuarios activos (modelo)
 * Incluye filtros, búsqueda, y vista grid/list
 */
const ActiveUsersList = ({ 
  usuariosActivos = [], 
  loadingUsers = false,
  onCall,
  onMessage,
  isCallActive = false,
  isReceivingCall = false
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list', 'grid'

  // Función helper para obtener inicial
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Filtrar usuarios por búsqueda
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return usuariosActivos;

    const query = searchQuery.toLowerCase();
    return usuariosActivos.filter(usuario => {
      const name = (usuario.display_name || usuario.name || usuario.alias || '').toLowerCase();
      return name.includes(query);
    });
  }, [usuariosActivos, searchQuery]);

  if (loadingUsers) {
    return (
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#ff007a] border-t-transparent"></div>
            <span className="ml-3 text-sm text-white/60">
              {t("client.loadingUsers")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (usuariosActivos.length === 0) {
    return (
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <Users size={48} className="text-white/20 mb-3" />
          <p className="text-sm text-white/60 font-medium">
            {t("client.noActiveUsers")}
          </p>
          <p className="text-xs text-white/40 mt-1">
            {t("client.contactsWillAppear")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
      {/* Barra de búsqueda y vista */}
      <div className="sticky top-0 bg-[#2b2d31] pt-2 pb-2 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4">
        {/* Búsqueda y controles en una fila */}
        <div className="flex items-center gap-2 mb-2">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder={t("client.searchUsers") || t("clientInterface.searchGirls") || "Buscar usuarios..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#1f2125] border border-[#ff007a]/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#ff007a]/50 focus:ring-2 focus:ring-[#ff007a]/20 transition-all"
              aria-label={t("client.searchUsers") || t("clientInterface.searchGirls") || "Buscar usuarios"}
            />
          </div>

          {/* Toggle vista - Compacto y mejorado */}
          <div className="flex items-center gap-0.5 bg-[#1f2125] rounded-lg p-0.5 border border-[#ff007a]/20 shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
              aria-label={t("client.viewList") || "Vista de lista"}
              title={t("client.viewList") || "Vista de lista"}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-all duration-200 ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
              aria-label={t("client.viewGrid") || "Vista de cuadrícula"}
              title={t("client.viewGrid") || "Vista de cuadrícula"}
            >
              <Grid size={14} />
            </button>
          </div>
        </div>

        {/* Contador de resultados */}
        {searchQuery ? (
          <p className="text-xs text-white/50 mt-2">
            {filteredUsers.length} {filteredUsers.length === 1 
              ? (t("client.searchResults.single") || "resultado") 
              : (t("client.searchResults.plural") || "resultados")}
          </p>
        ) : null}
      </div>

      {/* Lista de usuarios */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-8">
          <Search size={32} className="text-white/20 mb-3" />
          <p className="text-sm text-white/60 font-medium">
            {t("client.searchResults.noResults") || "No se encontraron resultados"}
          </p>
          <p className="text-xs text-white/40 mt-1">
            {t("client.searchResults.tryOtherTerms") || "Intenta con otros términos de búsqueda"}
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3 pt-3' : 'space-y-3 pt-3'}>
          {filteredUsers.map((usuario, index) => {
            const avatarUrl = usuario.avatar_url;
            const displayName = usuario.display_name || usuario.name || usuario.alias || 'Usuario';

            return (
              <div
                key={usuario.id}
                className={`relative ${
                  viewMode === 'grid'
                    ? 'flex flex-col items-center p-3 bg-[#1f2125] rounded-xl hover:bg-[#25282c] transition-all duration-200'
                    : 'flex items-center justify-between bg-[#1f2125] p-3 rounded-xl hover:bg-[#25282c] transition-all duration-200'
                } animate-fadeIn group`}
                style={{
                  animationDelay: `${index * 30}ms`
                }}
              >
                {/* Avatar */}
                <div className="relative">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={displayName} 
                      className={`${viewMode === 'grid' ? 'w-16 h-16' : 'w-10 h-10'} rounded-full object-cover border-2 border-[#ff007a] transition-all duration-200 group-hover:border-[#ff3399] group-hover:scale-105`}
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextElementSibling) {
                          e.target.nextElementSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className={`${viewMode === 'grid' ? 'w-16 h-16' : 'w-10 h-10'} rounded-full bg-gradient-to-br from-[#ff007a] to-[#e6006e] flex items-center justify-center font-bold text-sm ${avatarUrl ? 'hidden' : ''}`}
                  >
                    {getInitial(displayName)}
                  </div>
                  {/* Indicador online */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#2b2d31] animate-pulse shadow-lg shadow-green-500/50"></div>
                </div>

                {/* Información */}
                <div className={`flex-1 min-w-0 ${viewMode === 'grid' ? 'text-center mt-2' : 'ml-3'}`}>
                  <div className="font-semibold text-sm truncate">
                    {displayName}
                  </div>
                  <div className="text-xs text-green-400 mt-0.5">
                    {t("client.status.home.online")}
                  </div>
                </div>

                {/* Acciones - Botones mejorados */}
                <div className={`flex items-center gap-2 ${viewMode === 'grid' ? 'mt-3' : 'ml-2'}`}>
                  <button
                    onClick={() => onCall(usuario)}
                    disabled={isCallActive || isReceivingCall}
                    className={`p-2.5 rounded-full transition-all duration-200 shadow-md ${
                      isCallActive || isReceivingCall 
                        ? 'bg-gray-500/20 cursor-not-allowed opacity-50 shadow-none' 
                        : 'bg-gradient-to-br from-[#ff007a] to-[#e6006e] hover:from-[#ff3399] hover:to-[#ff007a] text-white hover:scale-110 active:scale-95 hover:shadow-lg hover:shadow-[#ff007a]/50'
                    }`}
                    title={
                      isCallActive || isReceivingCall 
                        ? t("client.errors.callError")
                        : t("client.call")
                    }
                    aria-label={t("client.call")}
                  >
                    <Phone 
                      size={18} 
                      className={`${
                        isCallActive || isReceivingCall 
                          ? 'text-gray-500' 
                          : 'text-white'
                      } transition-colors`} 
                    />
                  </button>
                  <button
                    onClick={() => onMessage(usuario)}
                    className="p-2.5 rounded-full bg-gradient-to-br from-gray-600/20 to-gray-700/20 hover:from-gray-500/30 hover:to-gray-600/30 border border-gray-500/20 hover:border-gray-400/30 transition-all duration-200 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg"
                    title={t("client.message")}
                    aria-label={t("client.message")}
                  >
                    <MessageSquare size={18} className="text-white transition-colors" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default memo(ActiveUsersList);
