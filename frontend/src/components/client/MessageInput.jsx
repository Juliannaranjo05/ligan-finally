import React, { memo } from 'react';
import { Gift, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * MessageInput - Componente modular para el input de mensajes
 * Incluye botones mejorados (regalo, enviar) con gradientes y animaciones
 */
const MessageInput = ({
  message = '',
  onMessageChange,
  onSend,
  onGiftClick,
  isChatBlocked = false,
  hasGiftBalance = false,
  hasConversation = false,
  isMobile = false,
  disabled = false,
  sending = false
}) => {
  const { t } = useTranslation();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isChatBlocked && !disabled) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div 
      className={`bg-gradient-to-r from-[#2b2d31] to-[#1f2125] border-t border-[#ff007a]/20 flex gap-2 sm:gap-3 ${
        isMobile ? 'p-3 pb-safe-area-inset-bottom' : 'p-4'
      }`}
      role="region"
      aria-label={t('chat.messageInput') || "Input de mensaje"}
    >
      <input
        type="text"
        placeholder={
          isChatBlocked
            ? t('chat.status.cannotSendBlocked') || "No puedes enviar mensajes (chat bloqueado)"
            : t('chat.messagePlaceholder') || "Escribe un mensaje..."
        }
        className={`flex-1 px-4 py-2.5 sm:py-3 rounded-full outline-none placeholder-white/60 transition-all ${
          isChatBlocked || disabled
            ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
            : 'bg-[#1a1c20] text-white focus:ring-2 focus:ring-[#ff007a]/50 focus:border-[#ff007a]/50 border border-[#ff007a]/20'
        }`}
        value={message}
        onChange={(e) => {
          if (!isChatBlocked && !disabled) {
            onMessageChange(e.target.value);
          }
        }}
        onKeyDown={handleKeyDown}
        disabled={isChatBlocked || disabled}
        aria-label={t('chat.messageInput') || "Escribe un mensaje"}
        aria-disabled={isChatBlocked || disabled}
      />

      {/* Botón de regalos mejorado */}
      <button
        onClick={onGiftClick}
        disabled={!hasConversation || !hasGiftBalance || isChatBlocked || disabled}
        className={`
          flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full font-semibold transition-all duration-300 flex items-center gap-2 relative z-10
          ${!hasConversation || !hasGiftBalance || isChatBlocked || disabled
            ? 'bg-gray-800/50 text-gray-500 opacity-50 cursor-not-allowed'
            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl border border-amber-400/30 hover:border-amber-300/50'
          }
        `}
        style={{ pointerEvents: 'auto' }}
        title={
          !hasConversation 
            ? t('chat.selectConversationForGifts') || "Selecciona una conversación para enviar regalos"
            : !hasGiftBalance
              ? t('chat.needGiftCoins') || "Necesitas gift coins para enviar regalos"
              : isChatBlocked
                ? t('chat.cannotSendGiftsBlocked') || "No puedes enviar regalos (chat bloqueado)"
                : t('chat.sendGift') || "Enviar regalo"
        }
        aria-label={t('chat.sendGift') || "Abrir modal de regalos"}
      >
        <Gift size={16} className="sm:w-5 sm:h-5" />
        {!isMobile && (
          <span className="hidden sm:inline text-sm">
            {hasConversation && hasGiftBalance ? t('chat.gift') || "Regalo" : ""}
          </span>
        )}
      </button>

      {/* Botón de enviar mejorado */}
      <button
        onClick={onSend}
        disabled={!message.trim() || isChatBlocked || disabled || sending}
        className={`
          flex-shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-semibold transition-all duration-300 flex items-center gap-2
          ${!message.trim() || isChatBlocked || disabled || sending
            ? 'bg-gray-800/50 text-gray-500 opacity-50 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl border border-blue-400/30 hover:border-blue-300/50'
          }
        `}
        title={
          isChatBlocked
            ? t('chat.status.cannotSendBlocked') || "No puedes enviar mensajes (chat bloqueado)"
            : !message.trim()
              ? t('chat.typeMessage') || "Escribe un mensaje"
              : t('chat.send') || "Enviar mensaje"
        }
        aria-label={t('chat.send') || "Enviar mensaje"}
      >
        {sending ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        ) : (
          <Send size={16} className="sm:w-5 sm:h-5" />
        )}
        {!isMobile && (
          <span className="hidden sm:inline text-sm">
            {t('chat.send') || "Enviar"}
          </span>
        )}
      </button>
    </div>
  );
};

export default memo(MessageInput);









