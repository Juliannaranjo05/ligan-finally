import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * MessageBubble - Componente modular para burbujas de mensaje
 * Mejora la visualización con gradientes, sombras y mejor espaciado
 */
const MessageBubble = ({
  message,
  isOwnMessage = false,
  userName = '',
  getInitial,
  formatearTiempo,
  renderMessageContent,
  index = 0
}) => {
  const { t } = useTranslation();

  if (!message) return null;

  const messageType = message.type || 'text';
  const isGiftType = ['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(messageType);

  return (
    <div 
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} animate-fadeIn`}
      style={{ animationDelay: `${index * 50}ms` }}
      role="article"
      aria-label={`${isOwnMessage ? t('chat.yourMessage') || "Tu mensaje" : t('chat.messageFrom', { name: userName }) || `Mensaje de ${userName}`}`}
    >
      <div className="flex flex-col max-w-sm md:max-w-md lg:max-w-lg">
        {/* Nombre del usuario (solo para mensajes de otros) */}
        {!isOwnMessage && userName && (
          <div className="flex items-center gap-2 mb-1 px-2">
            <div className="w-5 h-5 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md">
              {getInitial ? getInitial(userName) : userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-white/60 font-medium">{userName}</span>
          </div>
        )}

        {/* Burbuja de mensaje */}
        <div
          className={`relative px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl text-sm break-words overflow-wrap-anywhere transition-all duration-200 ${
            isGiftType
              ? '' // Sin fondo adicional para regalos (ya tienen su propio diseño)
              : isOwnMessage
                ? "bg-gradient-to-r from-[#ff007a] to-[#e6006e] text-white rounded-br-md shadow-lg hover:shadow-xl"
                : "bg-gradient-to-br from-[#2b2d31] to-[#1f2125] text-white/90 rounded-bl-md shadow-lg hover:shadow-xl border border-[#ff007a]/10"
          }`}
        >
          {/* Contenido del mensaje */}
          <div className="relative z-10">
            {renderMessageContent ? renderMessageContent(message) : (
              <span className="text-white break-words overflow-wrap-anywhere whitespace-pre-wrap">
                {message.message || message.text || ''}
              </span>
            )}
          </div>

          {/* Timestamp */}
          {formatearTiempo && message.created_at && (
            <div className={`text-xs mt-1.5 flex items-center gap-1 ${
              isOwnMessage ? 'text-white/70' : 'text-white/50'
            }`}>
              <span>{formatearTiempo(message.created_at)}</span>
              {isOwnMessage && (
                <span className="text-white/50">•</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(MessageBubble);


