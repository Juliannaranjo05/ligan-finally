import React, { memo } from 'react';
import { Video, Star, Settings, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * ChatHeader - Componente modular para el header del chat
 * Incluye información del usuario y acciones (video, favoritos, settings)
 */
const ChatHeader = ({
  conversation,
  isOnline = false,
  blockStatus = null,
  isFavorite = false,
  isCallActive = false,
  isReceivingCall = false,
  loadingActions = false,
  isChatBlocked = false,
  isTyping = false,
  typingLabel = null,
  onVideoCall,
  onToggleFavorite,
  onOpenSettings,
  getDisplayName,
  getInitial,
  isMobile = false,
  onBackToConversations
}) => {
  const { t } = useTranslation();

  if (!conversation) return null;

  const displayName = getDisplayName 
    ? getDisplayName(conversation.other_user_id, conversation.other_user_display_name || conversation.other_user_name)
    : (conversation.other_user_display_name || conversation.other_user_name || 'Usuario');

  return (
    <div 
      className="bg-gradient-to-r from-[#2b2d31] to-[#1f2125] px-4 sm:px-5 py-3 flex justify-between items-center border-b border-[#ff007a]/20 shadow-md"
      role="banner"
      aria-label={`Chat con ${displayName}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Botón de volver (móvil) */}
        {isMobile && onBackToConversations && (
          <button
            onClick={onBackToConversations}
            className="text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
            aria-label={t('chat.backToConversations') || "Volver a conversaciones"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {conversation.avatar_url || conversation.avatar ? (
            <img 
              src={conversation.avatar_url || (conversation.avatar && conversation.avatar.startsWith('http') ? conversation.avatar : `${import.meta.env.VITE_API_BASE_URL}/storage/${conversation.avatar}`)} 
              alt={displayName} 
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-[#ff007a] transition-all duration-200 hover:border-[#ff3399] hover:scale-105 shadow-lg"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextElementSibling) {
                  e.target.nextElementSibling.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${conversation.avatar_url || conversation.avatar ? 'hidden' : ''}`}>
            {getInitial ? getInitial(displayName) : displayName.charAt(0).toUpperCase()}
          </div>
          
          {/* Indicador de estado */}
          {blockStatus ? (
            blockStatus === 'yo_bloquee' ? (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#2b2d31] shadow-lg animate-pulse" title={t('chat.status.blockedByYou') || "Bloqueado por ti"} />
            ) : blockStatus === 'me_bloquearon' ? (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-orange-500 rounded-full border-2 border-[#2b2d31] shadow-lg animate-pulse" title={t('chat.status.blockedYou') || "Te bloqueó"} />
            ) : (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-700 rounded-full border-2 border-[#2b2d31] shadow-lg animate-pulse" title={t('chat.status.mutualBlock') || "Bloqueo mutuo"} />
            )
          ) : (
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#2b2d31] shadow-lg ${
              isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            }`} title={isOnline ? (t('chat.online') || 'En línea') : (t('chat.offline') || 'Desconectado')} />
          )}
        </div>

        {/* Información del usuario */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base sm:text-lg text-white truncate">
              {displayName}
            </span>
            {isFavorite && (
              <Star size={16} className="text-yellow-400 fill-yellow-400 flex-shrink-0" title={t('chat.favorite') || "Favorito"} />
            )}
          </div>
          {/* Estado de bloqueo, typing u online */}
          {blockStatus ? (
            <span className={`text-xs flex items-center gap-1 ${
              blockStatus === 'yo_bloquee' ? 'text-red-400' :
              blockStatus === 'me_bloquearon' ? 'text-orange-400' :
              'text-red-600'
            }`}>
              <Ban size={12} />
              {blockStatus === 'yo_bloquee' && (t('chat.status.blockedByYou') || "Bloqueado por ti")}
              {blockStatus === 'me_bloquearon' && (t('chat.status.blockedYou') || "Te bloqueó")}
              {blockStatus === 'mutuo' && (t('chat.status.mutualBlock') || "Bloqueo mutuo")}
            </span>
          ) : isTyping ? (
            <span className="text-xs text-[#ff007a] italic">
              {typingLabel || t('chat.typing') || 'Escribiendo...'}
            </span>
          ) : (
            <span className={`text-xs ${
              isOnline ? 'text-green-400' : 'text-white/50'
            }`}>
              {isOnline ? (t('chat.online') || 'En línea') : (t('chat.offline') || 'Desconectado')}
            </span>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Botón de videollamada */}
        {!isChatBlocked && (
          <button
            onClick={onVideoCall}
            disabled={isCallActive || isReceivingCall || loadingActions}
            className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 ${
              isCallActive || isReceivingCall || loadingActions
                ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-br from-[#ff007a]/10 to-[#e6006e]/10 hover:from-[#ff007a]/20 hover:to-[#e6006e]/20 text-white hover:text-[#ff007a] hover:scale-110 active:scale-95 shadow-md hover:shadow-lg hover:shadow-[#ff007a]/30'
            }`}
            title={t('chat.videoCall') || "Videollamada"}
            aria-label={t('chat.videoCall') || "Iniciar videollamada"}
          >
            <Video size={20} className="sm:w-5 sm:h-5" />
          </button>
        )}

        {/* Botón de favoritos */}
        <button
          onClick={onToggleFavorite}
          disabled={loadingActions}
          className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 ${
            isFavorite
              ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20 text-yellow-400 hover:text-yellow-300'
              : 'bg-gradient-to-br from-[#ff007a]/10 to-[#e6006e]/10 hover:from-[#ff007a]/20 hover:to-[#e6006e]/20 text-white/60 hover:text-yellow-400'
          } hover:scale-110 active:scale-95 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isFavorite ? (t('chat.removeFavorite') || "Quitar de favoritos") : (t('chat.addFavorite') || "Agregar a favoritos")}
          aria-label={isFavorite ? (t('chat.removeFavorite') || "Quitar de favoritos") : (t('chat.addFavorite') || "Agregar a favoritos")}
        >
          <Star 
            size={20} 
            className={`sm:w-5 sm:h-5 transition-all ${isFavorite ? 'fill-yellow-400' : ''}`} 
          />
        </button>

        {/* Botón de configuración */}
        <button
          onClick={onOpenSettings}
          disabled={loadingActions}
          className="p-2 sm:p-2.5 rounded-lg transition-all duration-200 bg-gradient-to-br from-[#ff007a]/10 to-[#e6006e]/10 hover:from-[#ff007a]/20 hover:to-[#e6006e]/20 text-white/60 hover:text-white hover:scale-110 active:scale-95 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('chat.settings') || "Configuración"}
          aria-label={t('chat.settings') || "Abrir configuración"}
        >
          <Settings size={20} className="sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
};

export default memo(ChatHeader);






