import React, { useState } from 'react';
import { X, Gift, Sparkles, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ModelGiftRequestModal = ({
  isOpen,
  onClose,
  recipientName,
  recipientId,
  roomName,
  gifts = [],
  onRequestGift,
  loading = false
}) => {
  const { t } = useTranslation();
  
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGiftSelect = async (gift) => {
    setIsLoading(true);
    
    try {
      // Validar que onRequestGift existe
      if (!onRequestGift) {
        console.error('❌ [ModelGiftRequestModal] onRequestGift no está configurado');
        alert(t('gifts.error', { defaultValue: 'Error: No se puede solicitar regalo. Función no disponible.' }));
        setIsLoading(false);
        return;
      }

      // Validar IDs
      const giftId = gift.id;
      const recipientIdNumber = parseInt(recipientId);

      if (!giftId) {
        alert(t('gifts.invalidGiftId'));
        setIsLoading(false);
        return;
      }

      if (isNaN(recipientIdNumber)) {
        alert(t('gifts.invalidRecipientId'));
        setIsLoading(false);
        return;
      }

      // Solicitar el regalo
      const result = await onRequestGift(
        giftId,
        recipientIdNumber,
        roomName,
        message
      );

      if (result.success) {
        alert(t('gifts.requestSent', { giftName: gift.name, recipientName: recipientName }) || `Solicitud de ${gift.name} enviada a ${recipientName}`);
        onClose();
      } else {
        alert(`${t('error') || 'Error'}: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ [ModelGiftRequestModal] Error:', error);
      alert(t('gifts.processingError') || 'Error procesando solicitud');
    }
    
    setIsLoading(false);
  };

  const handleClose = () => {
    setMessage('');
    onClose();
  };

  if (!isOpen) return null;

  const title = t('gifts.requestGift') || 'Pedir Regalo';
  const subtitle = t('gifts.requestFrom', { name: recipientName }) || `Solicitar a ${recipientName}`;
  const messagePlaceholder = t('gifts.placeholderRequest') || 'Ej: ¡Quiero este regalo! ❤️';
  const messageLabel = t('gifts.optionalRequestMessage') || 'Mensaje opcional para acompañar tu solicitud:';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-2 sm:p-4">
      <div
        className="border border-[#ff007a]/30 rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0a0d10 0%, #131418 100%)' }}
      >
        {/* Header */}
        <div
          className="p-3 sm:p-4 border-b border-[#ff007a]/20"
          style={{ background: 'linear-gradient(90deg, rgba(255, 0, 122, 0.15) 0%, rgba(255, 0, 122, 0.08) 100%)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#ff007a] to-[#cc0062] rounded-full flex items-center justify-center shadow-lg shadow-[#ff007a]/20">
                <Gift size={20} className="sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {title}
                </h2>
                <p className="text-[#ff007a] text-xs">{subtitle}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Mensaje opcional */}
        <div className="p-3 sm:p-4 border-b border-[#ff007a]/10">
          <label className="block text-white text-sm font-medium mb-2">
            {messageLabel}
          </label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
            <input
              type="text"
              placeholder={messagePlaceholder}
              className="w-full pl-10 pr-4 py-2 bg-[#1a1c20] text-white placeholder-white/60 rounded-lg outline-none focus:ring-2 focus:ring-[#ff007a]/50"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={100}
            />
          </div>
          <p className="text-xs text-white/50 mt-1">
            {t('gifts.characters', { current: message.length, max: 100 }) || `${message.length}/100 caracteres`}
          </p>
        </div>

        {/* Grid de regalos */}
        <div 
          className="p-3 overflow-y-auto gift-scroll-container" 
          style={{ maxHeight: '340px', minHeight: '340px' }}
        >
          {gifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <Gift size={48} className="text-gray-500 mb-4" />
              <p className="text-white/60 text-center">
                {loading ? (t('gifts.loading') || 'Cargando regalos...') : (t('gifts.noGiftsAvailable') || 'No hay regalos disponibles')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {gifts.map((gift) => {
              return (
                <div
                  key={gift.id}
                  onClick={() => !isLoading && handleGiftSelect(gift)}
                  className={`group cursor-pointer border rounded-xl p-3 transition-all duration-300 flex flex-col items-center justify-center aspect-square ${
                    isLoading
                      ? 'opacity-50 cursor-not-allowed border-gray-600' 
                      : 'border-[#ff007a]/20 hover:border-[#ff007a]/50 hover:scale-105 hover:shadow-xl hover:shadow-[#ff007a]/10'
                  }`}
                  style={{ background: 'linear-gradient(180deg, #1a1c20 0%, #2b2d31 100%)' }}
                >
                  {/* Imagen del regalo */}
                  <div className="w-16 h-16 flex items-center justify-center flex-shrink-0 mb-2">
                    <img
                      src={(() => {
                        const imagePath = gift.image_path || gift.image || gift.image_url || gift.pic || gift.icon || '';
                        if (!imagePath) return '';
                        
                        // Construir URL con versión basada en nombre del archivo
                        let imageUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://')
                          ? imagePath 
                          : imagePath;
                        
                        // Extraer nombre del archivo y crear hash para versión
                        const urlParts = imageUrl.split('/');
                        const fileName = urlParts[urlParts.length - 1].split('?')[0];
                        const fileHash = fileName ? btoa(fileName).substring(0, 8) : Date.now();
                        const separator = imageUrl.includes('?') ? '&' : '?';
                        return `${imageUrl.split('?')[0]}${separator}v=${fileHash}`;
                      })()}
                      alt={gift.name}
                      key={`${gift.id}-${gift.image_path || gift.image || gift.image_url || gift.pic || gift.icon}`}
                      className="w-12 h-12 object-contain transition-all duration-300 filter group-hover:brightness-110"
                      loading="eager"
                      decoding="async"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.parentNode.querySelector('.fallback-icon');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="fallback-icon hidden w-12 h-12 items-center justify-center">
                      <Gift size={24} className="text-[#ff007a]" />
                    </div>
                  </div>

                  {/* Información del regalo */}
                  <div className="text-center w-full">
                    <h3 className="font-semibold text-xs mb-2 transition-colors leading-tight line-clamp-2 text-white group-hover:text-[#ff007a]">
                      {gift.name}
                    </h3>

                    {/* Precio */}
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold shadow-lg bg-gradient-to-r from-[#ff007a] to-[#cc0062] text-white shadow-[#ff007a]/20">
                      <Sparkles size={8} />
                      {gift.price}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 sm:p-3 border-t border-[#ff007a]/20 bg-[#1a1c20]/50">
          <div className="flex items-center justify-center text-xs text-white/60">
            <span>
              ✨ {t('gifts.giftsAvailable', { count: gifts.length }) || `${gifts.length} regalos disponibles`} - {t('gifts.clickToRequest') || 'Haz clic en un regalo para solicitarlo'}
            </span>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-[#0a0d10] border border-[#ff007a]/30 rounded-lg p-6 flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#ff007a]"></div>
              <span className="text-white font-medium">
                {t('gifts.sendingRequest') || 'Enviando solicitud...'}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Estilos del scrollbar */}
      <style jsx>{`
        .gift-scroll-container::-webkit-scrollbar {
          width: 8px;
        }

        .gift-scroll-container::-webkit-scrollbar-track {
          background: rgba(43, 45, 49, 0.5);
          border-radius: 10px;
          margin: 4px 0;
        }

        .gift-scroll-container::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #ff007a 0%, #cc0062 100%);
          border-radius: 10px;
          border: 2px solid rgba(43, 45, 49, 0.3);
          box-shadow: 0 2px 4px rgba(255, 0, 122, 0.3);
        }

        .gift-scroll-container::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #ff3399 0%, #e6006e 100%);
          box-shadow: 0 2px 6px rgba(255, 0, 122, 0.5);
        }

        .gift-scroll-container::-webkit-scrollbar-thumb:active {
          background: linear-gradient(180deg, #cc0062 0%, #99004d 100%);
        }

        .gift-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: #ff007a rgba(43, 45, 49, 0.5);
        }
      `}</style>
    </div>
  );
};








