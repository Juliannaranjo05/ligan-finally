import React, { memo } from 'react';
import { Gift, Star, Settings, Ban, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * ModelChatHeader - Componente modular para el header del chat de la modelo
 * Incluye información del usuario y acciones (regalo, favoritos, settings)
 */
const ModelChatHeader = ({
  conversation,
  isOnline = false,
  blockStatus = null,
  isFavorite = false,
  loadingActions = false,
  isChatBlocked = false,
  onGiftClick,
  onToggleFavorite,
  onOpenSettings,
  onOpenNickname,
  onToggleBlock,
  getDisplayName,
  getInitial,
  isMobile = false,
  onBackToConversations,
  bloqueados = new Set()
}) => {
  const { t } = useTranslation();

  if (!conversation) return null;

  const displayName = getDisplayName 
    ? getDisplayName(conversation.other_user_id, conversation.other_user_name)
    : (conversation.other_user_name || 'Usuario');

  return (
    <div 
      className="bg-gradient-to-r from-[#2b2d31] to-[#1f2125] px-4 sm:px-5 py-3 flex justify-between items-center border-b border-[#ff007a]/20 shadow-md flex-shrink-0"
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
            <ArrowLeft size={20} />
          </button>
        )}

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg transition-all duration-200 hover:scale-105">
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
          {/* Estado de bloqueo o online */}
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
        {/* Botón de regalo (para modelos - pedir regalo) */}
        {onGiftClick && (
          <button
            onClick={onGiftClick}
            disabled={isChatBlocked || bloqueados.has(conversation.other_user_id) || loadingActions}
            className={`px-2 py-2 rounded-lg text-xs hover:scale-105 transition-transform flex items-center gap-1 ${
              isChatBlocked || bloqueados.has(conversation.other_user_id) || loadingActions
                ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg'
            }`}
            title={t('chat.gift') || "Regalo"}
            aria-label={t('chat.sendGift') || "Abrir modal de regalos"}
          >
            <Gift size={14} />
            {!isMobile && (t("chat.gift") || "Regalo")}
          </button>
        )}

        {/* Botón de configuración */}
        <div className="relative">
          <button
            onClick={onOpenSettings}
            disabled={loadingActions}
            className="p-2 sm:p-2.5 rounded-lg transition-all duration-200 bg-gradient-to-br from-[#ff007a]/10 to-[#e6006e]/10 hover:from-[#ff007a]/20 hover:to-[#e6006e]/20 text-white/60 hover:text-white hover:scale-110 active:scale-95 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('chat.menu.settings') || "Configuración"}
            aria-label={t('chat.menu.settings') || "Abrir configuración"}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ModelChatHeader);


