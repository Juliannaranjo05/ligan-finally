import React, { useState, useMemo, memo } from 'react';
import { Users, Phone, MessageSquare, Search, Filter, Grid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SkeletonLoader from './SkeletonLoader';

/**
 * ActiveGirlsList - Componente mejorado para la lista de chicas activas
 * Incluye filtros, búsqueda, y vista grid/list
 */
const ActiveGirlsList = ({ 
  chicasActivas = [], 
  loadingUsers = false,
  onCall,
  onMessage,
  isCallActive = false,
  isReceivingCall = false
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'online', 'offline'
  const [viewMode, setViewMode] = useState('list'); // 'list', 'grid'

  // Función helper para obtener inicial
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Filtrar y buscar chicas
  const filteredChicas = useMemo(() => {
    let filtered = chicasActivas;

    // Filtrar por estado
    if (filterStatus === 'online') {
      filtered = filtered.filter(chica => chica.is_online !== false);
    } else if (filterStatus === 'offline') {
      filtered = filtered.filter(chica => chica.is_online === false);
    }

    // Buscar por nombre
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(chica => {
        const name = (chica.display_name || chica.name || chica.alias || '').toLowerCase();
        return name.includes(query);
      });
    }

    return filtered;
  }, [chicasActivas, filterStatus, searchQuery]);

  if (loadingUsers) {
    return (
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 lg:flex-1 lg:min-h-0 lg:overflow-hidden flex flex-col">
        <div className="flex items-center justify-center py-4 flex-1">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#ff007a] border-t-transparent"></div>
            <span className="ml-3 text-sm text-white/60">
              {t('clientInterface.loadingGirls')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (chicasActivas.length === 0) {
    return (
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 lg:flex-1 lg:min-h-0 lg:overflow-hidden flex flex-col">
        <div className="flex flex-col items-center justify-center text-center py-4 flex-1">
          <Users size={48} className="text-white/20 mb-3" />
          <p className="text-sm text-white/60 font-medium">
            {t('clientInterface.noActiveGirls')}
          </p>
          <p className="text-xs text-white/40 mt-1">
            {t('clientInterface.girlsWillAppear')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 lg:flex-1 lg:min-h-0 lg:overflow-hidden flex flex-col">
      {/* Barra de búsqueda y filtros */}
      <div className="flex-shrink-0 bg-[#2b2d31] pt-2 pb-2 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4">
        {/* Búsqueda */}
        <div className="relative mb-1.5">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            placeholder={t('clientInterface.searchGirls') || 'Buscar chicas...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#1f2125] border border-[#ff007a]/20 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#ff007a]/50 focus:ring-1 focus:ring-[#ff007a]/20 transition-all"
            aria-label="Buscar chicas"
          />
        </div>

        {/* Filtros y vista */}
        <div className="flex items-center justify-between gap-1.5">
          {/* Filtros de estado - Mejorados */}
          <div className="flex items-center gap-0.5 bg-[#1f2125] rounded-lg p-0.5 border border-[#ff007a]/20 shadow-inner">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2 py-1 text-[10px] rounded transition-all duration-200 font-medium ${
                filterStatus === 'all'
                  ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              aria-label={t("client.filters.all") || "Todas"}
            >
              {t("client.filters.all") || "Todas"}
            </button>
            <button
              onClick={() => setFilterStatus('online')}
              className={`px-2 py-1 text-[10px] rounded transition-all duration-200 font-medium ${
                filterStatus === 'online'
                  ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              aria-label={t("client.filters.online") || "Solo online"}
            >
              {t("client.filters.online") || "Online"}
            </button>
            <button
              onClick={() => setFilterStatus('offline')}
              className={`px-2 py-1 text-[10px] rounded transition-all duration-200 font-medium ${
                filterStatus === 'offline'
                  ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              aria-label={t("client.filters.offline") || "Solo offline"}
            >
              {t("client.filters.offline") || "Offline"}
            </button>
          </div>

          {/* Toggle vista - Compacto y mejorado */}
          <div className="flex items-center gap-0.5 bg-[#1f2125] rounded-lg p-0.5 border border-[#ff007a]/20 shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
              aria-label={t("client.viewList") || "Vista de lista"}
              title={t("client.viewList") || "Vista de lista"}
            >
              <List size={12} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition-all duration-200 ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
              aria-label={t("client.viewGrid") || "Vista de cuadrícula"}
              title={t("client.viewGrid") || "Vista de cuadrícula"}
            >
              <Grid size={12} />
            </button>
          </div>
        </div>

        {/* Contador de resultados */}
        {searchQuery || filterStatus !== 'all' ? (
          <p className="text-[10px] text-white/50 mt-1">
            {filteredChicas.length} {filteredChicas.length === 1 
              ? (t("client.searchResults.single") || "resultado") 
              : (t("client.searchResults.plural") || "resultados")}
          </p>
        ) : null}
      </div>

      {/* Lista de chicas */}
      <div className="flex-1 min-h-0 flex flex-col">
        {filteredChicas.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-4 flex-1">
            <Search size={24} className="text-white/20 mb-2" />
            <p className="text-xs text-white/60 font-medium">
              {t("client.searchResults.noResults") || "No se encontraron resultados"}
            </p>
            <p className="text-[10px] text-white/40 mt-1">
              {t("client.searchResults.tryOtherTerms") || "Intenta con otros términos de búsqueda"}
            </p>
          </div>
        ) : (
          <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${viewMode === 'grid' ? 'grid grid-cols-2 gap-2 p-2' : 'space-y-2 p-2'}`}>
          {filteredChicas.map((chica, index) => {
            const isOnline = chica.is_online !== undefined ? chica.is_online : true;
            const avatarUrl = chica.avatar_url || chica.avatar;
            const displayName = chica.display_name || chica.name || chica.alias || 'Usuario';

            return (
              <div
                key={chica.id}
                className={`relative ${
                  viewMode === 'grid'
                    ? 'flex flex-col items-center p-2 bg-[#1f2125] rounded-lg hover:bg-[#25282c] transition-all duration-200'
                    : 'flex items-center justify-between bg-[#1f2125] p-2 rounded-lg hover:bg-[#25282c] transition-all duration-200'
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
                      className={`${viewMode === 'grid' ? 'w-12 h-12' : 'w-10 h-10'} rounded-full object-cover border-2 border-[#ff007a] transition-all duration-200 group-hover:border-[#ff3399] group-hover:scale-105`}
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
                    className={`${viewMode === 'grid' ? 'w-12 h-12' : 'w-10 h-10'} rounded-full bg-gradient-to-br from-[#ff007a] to-[#e6006e] flex items-center justify-center font-bold text-xs ${avatarUrl ? 'hidden' : ''}`}
                  >
                    {getInitial(displayName)}
                  </div>
                  {/* Indicador online */}
                  {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#2b2d31] animate-pulse shadow-lg shadow-green-500/50"></div>
                  )}
                </div>

                {/* Información */}
                <div className={`flex-1 min-w-0 ${viewMode === 'grid' ? 'text-center mt-1' : 'ml-2'}`}>
                  <div className="font-semibold text-xs truncate">
                    {displayName}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
                    {isOnline ? (t('clientInterface.online') || 'Online') : (t('clientInterface.offline') || 'Offline')}
                  </div>
                </div>

                {/* Acciones - Botones mejorados */}
                <div className={`flex items-center gap-1.5 ${viewMode === 'grid' ? 'mt-2' : 'ml-2'}`}>
                  <button
                    onClick={() => onCall(chica)}
                    disabled={isCallActive || isReceivingCall}
                    className={`p-1.5 rounded-full transition-all duration-200 shadow-sm ${
                      isCallActive || isReceivingCall 
                        ? 'bg-gray-500/20 cursor-not-allowed opacity-50 shadow-none' 
                        : 'bg-gradient-to-br from-[#ff007a] to-[#e6006e] hover:from-[#ff3399] hover:to-[#ff007a] text-white hover:scale-110 active:scale-95 hover:shadow-md hover:shadow-[#ff007a]/50'
                    }`}
                    title={
                      isCallActive || isReceivingCall 
                        ? t('clientInterface.callInProgress')
                        : t('clientInterface.callThisGirl')
                    }
                    aria-label={t('clientInterface.callThisGirl')}
                  >
                    <Phone 
                      size={14} 
                      className="text-white transition-colors" 
                    />
                  </button>
                  <button
                    onClick={() => onMessage(chica)}
                    className="p-1.5 rounded-full bg-gradient-to-br from-gray-600/20 to-gray-700/20 hover:from-gray-500/30 hover:to-gray-600/30 border border-gray-500/20 hover:border-gray-400/30 transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                    title={t('clientInterface.messageThisGirl')}
                    aria-label={t('clientInterface.messageThisGirl')}
                  >
                    <MessageSquare size={14} className="text-white transition-colors" />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ActiveGirlsList);
