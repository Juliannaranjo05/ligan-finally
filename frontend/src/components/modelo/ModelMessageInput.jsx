import React, { memo } from 'react';
import { Gift, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EmojiPickerButton from '../common/EmojiPickerButton.jsx';

/**
 * ModelMessageInput - Componente modular para el input de mensajes de la modelo
 * Incluye botones mejorados (regalo para pedir, enviar) con gradientes y animaciones
 */
const ModelMessageInput = ({
  message = '',
  onMessageChange,
  onSend,
  onGiftClick,
  isChatBlocked = false,
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

  const handleEmojiSelect = (emoji) => {
    if (!emoji || isChatBlocked || disabled) return;
    onMessageChange(`${message}${emoji}`);
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

      {/* Botón de regalos mejorado (para modelos - pedir regalo) */}
      {onGiftClick && (
        <button
          onClick={onGiftClick}
          disabled={!hasConversation || isChatBlocked || disabled}
          className={`
            flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full font-semibold transition-all duration-300 flex items-center gap-2 relative z-10
            ${!hasConversation || isChatBlocked || disabled
              ? 'bg-gray-800/50 text-gray-500 opacity-50 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl border border-purple-400/30 hover:border-purple-300/50'
            }
          `}
          style={{ pointerEvents: 'auto' }}
          title={
            !hasConversation 
              ? t('chat.selectConversationForGifts') || "Selecciona una conversación para pedir regalos"
              : isChatBlocked
                ? t('chat.cannotSendGiftsBlocked') || "No puedes pedir regalos (chat bloqueado)"
                : t('chat.sendGift') || "Pedir regalo"
          }
          aria-label={t('chat.sendGift') || "Abrir modal de regalos"}
        >
          <Gift size={16} className="sm:w-5 sm:h-5" />
          {!isMobile && (
            <span className="hidden sm:inline text-sm">
              {hasConversation ? t('chat.gift') || "Regalo" : ""}
            </span>
          )}
        </button>
      )}

      <EmojiPickerButton
        onSelect={handleEmojiSelect}
        disabled={isChatBlocked || disabled}
        buttonClassName={isMobile ? 'px-3 py-2' : 'px-3 py-2.5'}
        buttonSize={16}
      />

      {/* Botón de enviar mejorado */}
      <button
        onClick={onSend}
        disabled={!message.trim() || isChatBlocked || disabled || sending}
        className={`
          flex-shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-semibold transition-all duration-300 flex items-center gap-2
          ${!message.trim() || isChatBlocked || disabled || sending
            ? 'bg-gray-800/50 text-gray-500 opacity-50 cursor-not-allowed'
            : 'bg-gradient-to-r from-[#ff007a] to-[#e6006e] hover:from-[#ff007a] hover:to-[#cc0062] text-white hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl border border-[#ff007a]/30 hover:border-[#ff007a]/50'
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

export default memo(ModelMessageInput);









