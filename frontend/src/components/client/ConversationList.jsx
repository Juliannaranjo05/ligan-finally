import React, { memo, useMemo } from 'react';
import { MessageSquare, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SkeletonLoader from './SkeletonLoader';

/**
 * ConversationList - Componente modular para la lista de conversaciones
 * Incluye búsqueda, filtros y estados mejorados
 */
const ConversationList = ({
  conversations = [],
  filteredConversations = [],
  searchQuery = '',
  onSearchChange,
  activeConversation,
  onSelectConversation,
  loading = false,
  onlineUsers = new Set(),
  favoritos = new Set(),
  bloqueados = new Set(),
  bloqueadoPor = new Set(),
  unreadCounts = {},
  getDisplayName,
  getInitial,
  getBlockStatus,
  formatearTiempo,
  currentUser,
  isMobile = false,
  onCloseSidebar,
  showSidebar = true
}) => {
  const { t } = useTranslation();

  // Función helper para obtener estado de bloqueo
  const getBlockStatusForUser = (userId) => {
    if (getBlockStatus) {
      return getBlockStatus(userId);
    }
    const yoBloquee = bloqueados.has(userId);
    const meBloquearon = bloqueadoPor.has(userId);
    if (yoBloquee && meBloquearon) return 'mutuo';
    if (yoBloquee) return 'yo_bloquee';
    if (meBloquearon) return 'me_bloquearon';
    return null;
  };

  // Función helper para calcular no leídos
  const getUnreadCount = (conversation) => {
    if (unreadCounts && typeof unreadCounts === 'function') {
      return unreadCounts(conversation);
    }
    if (unreadCounts && unreadCounts[conversation.room_name]) {
      return unreadCounts[conversation.room_name];
    }
    return 0;
  };

  return (
    <aside 
      className={`${
        isMobile
          ? `fixed inset-y-0 left-0 z-40 w-full bg-gradient-to-b from-[#2b2d31] to-[#1f2125] transform transition-transform duration-300 ${
              showSidebar ? 'translate-x-0' : '-translate-x-full'
            }`
          : 'w-1/3 bg-gradient-to-b from-[#2b2d31] to-[#1f2125]'
      } p-4 overflow-y-auto custom-scrollbar shadow-xl border-r border-[#ff007a]/10`}
      role="complementary"
      aria-label={t('chat.conversations') || "Conversaciones"}
    >
      {isMobile && (
        <button
          onClick={onCloseSidebar}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10 p-2 rounded-lg hover:bg-white/10"
          aria-label={t('chat.closeSidebar') || "Cerrar sidebar"}
        >
          <X size={20} />
        </button>
      )}

      {/* Búsqueda mejorada */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" aria-hidden="true" />
        <input
          type="text"
          placeholder={t('chat.searchPlaceholder') || "Buscar conversaciones..."}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1c20] border border-[#ff007a]/20 text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-[#ff007a]/50 focus:border-[#ff007a]/50 transition-all shadow-inner"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t('chat.searchConversations') || "Buscar conversaciones"}
        />
      </div>

      {/* Lista de conversaciones */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#ff007a] border-t-transparent"></div>
              <p className="text-xs text-white/60">{t('chat.loading') || "Cargando..."}</p>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare size={48} className="text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/60 font-medium">{t('chat.noConversations') || "No hay conversaciones"}</p>
            {searchQuery && (
              <p className="text-xs text-white/40 mt-2">
                {t('chat.noResultsFor') || "No se encontraron resultados para"} "{searchQuery}"
              </p>
            )}
          </div>
        ) : (
          filteredConversations.map((conv, index) => {
            const isOnline = conv.is_online !== undefined 
              ? conv.is_online 
              : onlineUsers.has(conv.other_user_id);
            const unreadCount = getUnreadCount(conv);
            const blockStatus = getBlockStatusForUser(conv.other_user_id);
            const isFavorite = favoritos.has(conv.other_user_id);
            const isActive = activeConversation === conv.room_name;
            const displayName = getDisplayName 
              ? getDisplayName(conv.other_user_id, conv.other_user_display_name || conv.other_user_name)
              : (conv.other_user_display_name || conv.other_user_name || 'Usuario');

            return (
              <div
                key={conv.id || conv.room_name || index}
                onClick={() => onSelectConversation(conv)}
                className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ff007a]/30 to-[#e6006e]/20 border-[#ff007a] shadow-lg shadow-[#ff007a]/20'
                    : 'bg-[#1a1c20]/50 hover:bg-[#1a1c20] border-transparent hover:border-[#ff007a]/20 hover:shadow-md'
                } animate-fadeIn group`}
                style={{ animationDelay: `${index * 30}ms` }}
                role="button"
                tabIndex={0}
                aria-label={`${displayName}, ${isOnline ? t('chat.status.online') : t('chat.status.offline')}${unreadCount > 0 ? `, ${unreadCount} ${t('chat.unreadMessages') || 'mensajes no leídos'}` : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectConversation(conv);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {conv.avatar_url || conv.avatar ? (
                      <img 
                        src={conv.avatar_url || (conv.avatar && conv.avatar.startsWith('http') ? conv.avatar : `${import.meta.env.VITE_API_BASE_URL}/storage/${conv.avatar}`)} 
                        alt={displayName} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#ff007a] transition-all duration-200 group-hover:border-[#ff3399] group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) {
                            e.target.nextElementSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div className={`w-12 h-12 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${conv.avatar_url || conv.avatar ? 'hidden' : ''}`}>
                      {getInitial ? getInitial(displayName) : displayName.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Indicador de estado: Online/Offline o Bloqueado */}
                    {blockStatus ? (
                      blockStatus === 'yo_bloquee' ? (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#2b2d31] shadow-lg" title={t('chat.status.blockedByYou') || "Bloqueado por ti"} />
                      ) : blockStatus === 'me_bloquearon' ? (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 rounded-full border-2 border-[#2b2d31] shadow-lg" title={t('chat.status.blockedYou') || "Te bloqueó"} />
                      ) : (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-700 rounded-full border-2 border-[#2b2d31] shadow-lg" title={t('chat.status.mutualBlock') || "Bloqueo mutuo"} />
                      )
                    ) : (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#2b2d31] shadow-lg ${
                        isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                      }`} title={isOnline ? (t('chat.status.online') || 'En línea') : (t('chat.status.offline') || 'Desconectado')} />
                    )}
                    
                    {/* Badge de no leídos */}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -left-1 bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-lg border-2 border-[#2b2d31] animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </div>
                    )}

                    {/* Badge de favorito */}
                    {isFavorite && (
                      <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center shadow-lg border border-[#2b2d31]">
                        <span className="text-[10px]">★</span>
                      </div>
                    )}
                  </div>

                  {/* Información de la conversación */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm truncate text-white">
                        {displayName}
                      </p>
                      {isFavorite && (
                        <span className="text-yellow-400 text-xs" title={t('chat.favorite') || "Favorito"}>★</span>
                      )}
                    </div>
                    <div className="text-xs text-white/60 truncate">
                      {typeof isTyping === 'function' && isTyping(conv.room_name) ? (
                        <span className="text-[#ff007a] italic">{t('chat.typing') || 'Escribiendo...'}</span>
                      ) : conv.last_message_sender_id === currentUser?.id ? (
                        <span>
                          <span className="text-white/40">{t('chat.you') || "Tú"}:</span>{' '}
                          <span>{conv.last_message || t('chat.noMessages') || "Sin mensajes"}</span>
                        </span>
                      ) : (
                        <span>{conv.last_message || t('chat.noMessages') || "Sin mensajes"}</span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right flex-shrink-0">
                    {conv.last_message_time && formatearTiempo && formatearTiempo(conv.last_message_time) && (
                      <span className="text-xs text-white/40 block">
                        {formatearTiempo(conv.last_message_time)}
                      </span>
                    )}
                    {unreadCount > 0 && !isActive && (
                      <div className="mt-1 w-2 h-2 bg-[#ff007a] rounded-full mx-auto"></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default memo(ConversationList);






