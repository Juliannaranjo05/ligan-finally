import React, { useState, useMemo, memo } from 'react';
import { Phone, MessageSquare, Star, Search, Calendar, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SkeletonLoader from './SkeletonLoader';

/**
 * CallHistoryList - Componente mejorado para el historial de llamadas
 * Incluye agrupación por fecha, filtros y búsqueda
 */
const CallHistoryList = ({ 
  callHistory = [], 
  loadingHistory = false,
  onCall,
  onMessage
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'calls', 'favorites'

  // Función helper para obtener inicial
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Agrupar por fecha
  const groupByDate = (items) => {
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    items.forEach(item => {
      const itemDate = new Date(item.timestamp || item.created_at);
      
      if (itemDate >= today) {
        groups.today.push(item);
      } else if (itemDate >= yesterday) {
        groups.yesterday.push(item);
      } else if (itemDate >= thisWeek) {
        groups.thisWeek.push(item);
      } else if (itemDate >= thisMonth) {
        groups.thisMonth.push(item);
      } else {
        groups.older.push(item);
      }
    });

    return groups;
  };

  // Filtrar y buscar
  const filteredHistory = useMemo(() => {
    let filtered = callHistory;

    // Filtrar por tipo
    if (filterType === 'calls') {
      filtered = filtered.filter(item => item.type !== 'favorite');
    } else if (filterType === 'favorites') {
      filtered = filtered.filter(item => item.type === 'favorite');
    }

    // Buscar por nombre
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const name = (item.user_name || '').toLowerCase();
        return name.includes(query);
      });
    }

    return filtered;
  }, [callHistory, filterType, searchQuery]);

  // Agrupar resultados filtrados
  const groupedHistory = useMemo(() => {
    return groupByDate(filteredHistory);
  }, [filteredHistory]);

  const hasResults = Object.values(groupedHistory).some(group => group.length > 0);

  if (loadingHistory) {
    return (
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex items-center justify-center py-4 flex-1">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#ff007a] border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (callHistory.length === 0) {
    return (
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="text-center py-4 flex-1 flex flex-col items-center justify-center">
          <Clock size={24} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/60 text-xs">
            {t("client.history.noHistory")}
          </p>
        </div>
      </div>
    );
  }

  const renderGroup = (title, items, icon) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 px-1">
          {icon}
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wide">
            {title}
          </h4>
          <span className="text-xs text-white/40">({items.length})</span>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="flex justify-between items-start bg-[#1f2125] p-3 rounded-xl hover:bg-[#25282c] transition-all duration-200 group"
            >
              <div className="flex gap-3 items-center flex-1 min-w-0">
                <div className={`w-9 h-9 flex-shrink-0 ${
                  item.type === 'favorite' 
                    ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' 
                    : 'bg-gradient-to-br from-[#ff007a] to-[#e6006e]'
                } text-white font-bold rounded-full flex items-center justify-center text-sm shadow-lg overflow-hidden relative`}>
                  {item.avatar_url || item.avatar ? (
                    <img 
                      src={item.avatar_url || (item.avatar && item.avatar.startsWith('http') ? item.avatar : `${import.meta.env.VITE_API_BASE_URL}/storage/${item.avatar}`)}
                      alt={item.user_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 flex items-center justify-center ${item.avatar_url || item.avatar ? 'hidden' : ''}`}>
                    {item.type === 'favorite' ? (
                      <Star size={16} className="text-white" fill="white" />
                    ) : (
                      getInitial(item.user_name)
                    )}
                  </div>
                </div>
                <div className="text-sm min-w-0 flex-1">
                  <p className="font-medium text-white truncate">{item.user_name}</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {item.type === 'favorite' 
                      ? `${item.user_name} ${t("client.history.addedToFavorites")}`
                      : item.status === 'ended' 
                      ? t("client.history.callEnded")
                      : item.status === 'rejected'
                      ? t("client.history.callRejected")
                      : t("client.history.callCancelled")
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right text-white/40 text-xs">
                  {item.formatted_date || new Date(item.timestamp).toLocaleDateString()}
                </div>
                {item.user_id && (
                  <>
                                  {item.type === 'favorite' ? (
                                    <button
                                      onClick={() => onMessage({ id: item.user_id, name: item.user_name, role: 'modelo' })}
                                      className="p-2 rounded-full bg-gradient-to-br from-gray-600/20 to-gray-700/20 hover:from-gray-500/30 hover:to-gray-600/30 border border-gray-500/20 hover:border-gray-400/30 transition-all duration-200 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg"
                                      title={t("client.history.sendMessage")}
                                      aria-label={t("client.history.sendMessage")}
                                    >
                                      <MessageSquare size={16} className="text-white" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => onCall({ id: item.user_id, name: item.user_name, role: 'modelo' })}
                                      className="p-2 rounded-full bg-gradient-to-br from-[#ff007a] to-[#e6006e] hover:from-[#ff3399] hover:to-[#ff007a] text-white transition-all duration-200 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg hover:shadow-[#ff007a]/50"
                                      title={t("client.history.callAgain")}
                                      aria-label={t("client.history.callAgain")}
                                    >
                                      <Phone size={16} className="text-white" />
                                    </button>
                                  )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[#ff007a]/10 flex flex-col lg:flex-1 lg:min-h-0">
      {/* Barra de búsqueda y filtros */}
      <div className="flex-shrink-0 bg-[#2b2d31] pt-2 pb-2 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4">
        {/* Búsqueda */}
        <div className="relative mb-1.5">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            placeholder={t("client.history.search") || "Buscar en historial..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#1f2125] border border-[#ff007a]/20 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#ff007a]/50 focus:ring-1 focus:ring-[#ff007a]/20 transition-all"
            aria-label="Buscar en historial"
          />
        </div>

        {/* Filtros - Mejorados */}
        <div className="flex items-center gap-0.5 bg-[#1f2125] rounded-lg p-0.5 border border-[#ff007a]/20 shadow-inner">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-1 text-[10px] rounded transition-all duration-200 font-medium ${
              filterType === 'all'
                ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            aria-label={t("client.filters.all") || "Todos"}
          >
            {t("client.filters.all") || "Todos"}
          </button>
          <button
            onClick={() => setFilterType('calls')}
            className={`px-2 py-1 text-[10px] rounded transition-all duration-200 font-medium ${
              filterType === 'calls'
                ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            aria-label={t("client.filters.calls") || "Solo llamadas"}
          >
            {t("client.filters.calls") || "Llamadas"}
          </button>
          <button
            onClick={() => setFilterType('favorites')}
            className={`px-2 py-1 text-[10px] rounded transition-all duration-200 font-medium ${
              filterType === 'favorites'
                ? 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white shadow-sm shadow-[#ff007a]/30'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            aria-label={t("client.filters.favorites") || "Solo favoritos"}
          >
            {t("client.filters.favorites") || "Favoritos"}
          </button>
        </div>

        {/* Contador de resultados */}
        {searchQuery || filterType !== 'all' ? (
          <p className="text-[10px] text-white/50 mt-1">
            {filteredHistory.length} {filteredHistory.length === 1 
              ? (t("client.searchResults.single") || "resultado") 
              : (t("client.searchResults.plural") || "resultados")}
          </p>
        ) : null}
      </div>

      {/* Historial agrupado */}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto custom-scrollbar space-y-1.5 pt-2">
        {!hasResults ? (
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
          <>
            {renderGroup(t("client.history.today") || "Hoy", groupedHistory.today, <Calendar size={14} className="text-[#ff007a]" />)}
            {renderGroup(t("client.history.yesterday") || "Ayer", groupedHistory.yesterday, <Calendar size={14} className="text-[#ff007a]" />)}
            {renderGroup(t("client.history.thisWeek") || "Esta semana", groupedHistory.thisWeek, <Calendar size={14} className="text-[#ff007a]" />)}
            {renderGroup(t("client.history.thisMonth") || "Este mes", groupedHistory.thisMonth, <Calendar size={14} className="text-[#ff007a]" />)}
            {renderGroup(t("client.history.older") || "Más antiguo", groupedHistory.older, <Calendar size={14} className="text-[#ff007a]" />)}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(CallHistoryList);
