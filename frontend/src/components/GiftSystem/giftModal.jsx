import React, { useState, useEffect } from 'react';
import { X, Gift, Sparkles, Send, MessageSquare, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const GiftsModal = ({
  isOpen,
  onClose,
  recipientName,
  recipientId,
  roomName,
  userRole,
  gifts = [],
  onRequestGift,     // Para modelos (pedir regalo)
  onSendGift,        // Para clientes (enviar regalo directamente)
  userBalance = 0,   // Saldo del usuario
  loading = false
}) => {
  const { t } = useTranslation();
  const [selectedGift, setSelectedGift] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageCacheBuster, setImageCacheBuster] = useState(Date.now());
  
  // 🔥 NORMALIZAR userRole PARA COMPARACIÓN
  // 🔥 PRIORIDAD 1: Si roomName contiene "modelo", ES MODELO (viene de videochat.jsx de modelo)
  // 🔥 PRIORIDAD 2: Si userRole es explícitamente "modelo", SIEMPRE ES MODELO
  // 🔥 PRIORIDAD 3: Si onSendGift es explícitamente undefined Y onRequestGift está definido, ES MODELO
  // 🔥 PRIORIDAD 4: Si onRequestGift está disponible, ES MODELO
  const normalizedUserRole = (userRole || '').toLowerCase();
  const isModeloByRoomName = roomName && roomName.toLowerCase().includes('modelo');
  const isModeloByUserRole = normalizedUserRole === 'modelo';
  const isModeloByProps = (onSendGift === undefined && onRequestGift !== undefined) || (onRequestGift && !onSendGift);
  
  // 🔥 SI roomName CONTIENE "modelo" O userRole ES "modelo", FORZAR QUE SEA MODELO
  const effectiveUserRole = (isModeloByRoomName || isModeloByUserRole) ? 'modelo' : (isModeloByProps ? 'modelo' : (userRole || 'cliente'));
  const normalizedRole = effectiveUserRole?.toLowerCase() || '';
  const isModelo = normalizedRole === 'modelo';
  
  // 🔥 DEBUG: Log solo cuando cambian las props relevantes (no en cada render)
  useEffect(() => {
    if (isOpen) {
      console.log('🎁 [GIFTMODAL] Modal abierto - userRole:', userRole, 'effectiveUserRole:', effectiveUserRole, 'isModelo:', isModelo);
    }
  }, [isOpen, userRole, effectiveUserRole, isModelo]);
  
  // 🔥 FORZAR RECARGA DE IMÁGENES CUANDO SE ABRE EL MODAL
  useEffect(() => {
    if (isOpen) {
      setImageCacheBuster(Date.now());
    }
  }, [isOpen]);

  const handleGiftSelect = async (gift) => {
    setIsLoading(true);
    
    try {

      // 🔥 VALIDACIÓN PARA STRING IDs
      const giftId = gift.id; // Mantener como string o number
      const recipientIdNumber = parseInt(recipientId);

      // Validar que gift.id existe
      if (!giftId) {
        alert(t('gifts.invalidGiftId'));
        return;
      }

      // Validar que recipientId es un número válido
      if (isNaN(recipientIdNumber)) {
        alert(t('gifts.invalidRecipientId'));
        return;
      }

      // payload prepared: giftId, recipientIdNumber, roomName, message, userRole
      // (no-op debug)

      let result;

      // 🔥 USAR isModelo QUE YA ESTÁ DEFINIDO ARRIBA
      if (isModelo) {
        // 🔥 MODELO: SOLO PEDIR REGALO (NO ENVIAR)
        if (!onRequestGift) {
          alert('Función de solicitar regalo no disponible');
          setIsLoading(false);
          return;
        }
        
        result = await onRequestGift(
          giftId,              // ✅ ID del regalo
          recipientIdNumber,   // ✅ ID del cliente
          roomName,
          message
        );

        if (result.success) {
          alert(t('gifts.requestSent', { giftName: gift.name, recipientName: recipientName }));
          onClose();
        } else {
          alert(`${t('error')}: ${result.error}`);
        }

      } else {
        // 🔥 CLIENTE: ENVIAR REGALO DIRECTAMENTE
        
        // Verificar saldo suficiente
        if (userBalance < gift.price) {
          alert(t('gifts.insufficientBalance', { required: gift.price, current: userBalance }));
          setIsLoading(false);
          return;
        }

        // Confirmación antes de enviar
        const confirmSend = window.confirm(
          t('gifts.confirmSend', {
            giftName: gift.name,
            recipientName: recipientName,
            price: gift.price,
            balance: userBalance
          })
        );

        if (!confirmSend) {
          setIsLoading(false);
          return;
        }

        result = await onSendGift(
          giftId,              // ✅ ID del regalo
          recipientIdNumber,   // ✅ ID de la modelo
          roomName,
          message || `¡${gift.name} para ti! 💝`
        );

        if (result.success) {
          alert(t('gifts.giftSent', { giftName: gift.name, recipientName: recipientName }));
          onClose();
        } else {
          alert(`${t('error')}: ${result.error}`);
        }
      }

    } catch (error) {
      alert(t('gifts.processingError'));
    }
    
    setIsLoading(false);
  };

  const handleClose = () => {
    setSelectedGift(null);
    setMessage('');
    onClose();
  };

  if (!isOpen) return null;
  
  // 🎯 TÍTULOS DINÁMICOS TRADUCIDOS
  const title = isModelo ? t('gifts.requestGift') : t('gifts.sendGift');
  const subtitle = isModelo 
    ? t('gifts.requestFrom', { name: recipientName })
    : t('gifts.forRecipient', { name: recipientName });
  
  const buttonText = isModelo 
    ? t('gifts.clickToRequest')
    : t('gifts.clickToSend');

  const messagePlaceholder = isModelo
    ? t('gifts.placeholderRequest')
    : t('gifts.placeholderGift');

  const messageLabel = isModelo
    ? t('gifts.optionalRequestMessage')
    : t('gifts.optionalMessage');

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
                {isModelo ? (
                  <Gift size={20} className="sm:w-6 sm:h-6 text-white" />
                ) : (
                  <Heart size={20} className="sm:w-6 sm:h-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
                <p className="text-[#ff007a] text-xs">{subtitle}</p>
                {!isModelo && (
                  <p className="text-yellow-400 text-xs">
                    {t('gifts.yourBalance', { balance: userBalance })}
                  </p>
                )}
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
            {t('gifts.characters', { current: message.length, max: 100 })}
          </p>
        </div>

        {/* Grid de regalos */}
        <div 
          className="p-3 overflow-y-auto gift-scroll-container" 
          style={{ maxHeight: '340px', minHeight: '340px' }}
        >
          <div className="grid grid-cols-2 gap-3">
            {gifts.map((gift) => {
              // 🔥 VERIFICAR SI EL CLIENTE TIENE SALDO SUFICIENTE (modelo siempre puede pedir)
              const canAfford = isModelo || userBalance >= gift.price;
              
              return (
                <div
                  key={gift.id}
                  onClick={() => !isLoading && canAfford && handleGiftSelect(gift)}
                  className={`group cursor-pointer border rounded-xl p-3 transition-all duration-300 flex flex-col items-center justify-center aspect-square ${
                    isLoading || !canAfford
                      ? 'opacity-50 cursor-not-allowed border-gray-600' 
                      : 'border-[#ff007a]/20 hover:border-[#ff007a]/50 hover:scale-105 hover:shadow-xl hover:shadow-[#ff007a]/10'
                  }`}
                  style={{ background: 'linear-gradient(180deg, #1a1c20 0%, #2b2d31 100%)' }}
                >
                  {/* Imagen del regalo */}
                  <div className="w-16 h-16 flex items-center justify-center flex-shrink-0 mb-2">
                    <img
                      src={(() => {
                        const imagePath = gift.image_path || '';
                        if (!imagePath) return '';
                        
                        // Construir URL con versión basada en nombre del archivo + timestamp
                        let imageUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://')
                          ? imagePath 
                          : imagePath;
                        
                        // Extraer nombre del archivo y crear hash para versión
                        const urlParts = imageUrl.split('/');
                        const fileName = urlParts[urlParts.length - 1].split('?')[0];
                        const fileHash = fileName ? btoa(fileName).substring(0, 8) : Date.now();
                        const separator = imageUrl.includes('?') ? '&' : '?';
                        // 🔥 AGREGAR TIMESTAMP PARA FORZAR RECARGA CADA VEZ QUE SE ABRE EL MODAL
                        return `${imageUrl.split('?')[0]}${separator}v=${fileHash}&_t=${imageCacheBuster}`;
                      })()}
                      alt={gift.name}
                      key={`${gift.id}-${gift.image_path}`}
                      className={`w-12 h-12 object-contain transition-all duration-300 ${
                        canAfford ? 'filter group-hover:brightness-110' : 'filter grayscale'
                      }`}
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
                    <h3 className={`font-semibold text-xs mb-2 transition-colors leading-tight line-clamp-2 ${
                      canAfford 
                        ? 'text-white group-hover:text-[#ff007a]' 
                        : 'text-gray-500'
                    }`}>
                      {gift.name}
                    </h3>

                    {/* Precio con indicador de saldo */}
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold shadow-lg ${
                      canAfford
                        ? 'bg-gradient-to-r from-[#ff007a] to-[#cc0062] text-white shadow-[#ff007a]/20'
                        : 'bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 shadow-gray-500/20'
                    }`}>
                      <Sparkles size={8} />
                      {gift.price}
                      {!isModelo && !canAfford && (
                        <span className="ml-1 text-red-300">💸</span>
                      )}
                    </div>

                    {/* Indicador de saldo insuficiente */}
                    {!isModelo && !canAfford && (
                      <div className="mt-1 text-xs text-red-400 line-clamp-1">
                        {t('gifts.insufficient', { amount: gift.price - userBalance })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-2 sm:p-3 border-t border-[#ff007a]/20 bg-[#1a1c20]/50">
          <div className="flex items-center justify-center text-xs text-white/60">
            <span>
              ✨ {t('gifts.giftsAvailable', { count: gifts.length })} - {buttonText}
              {!isModelo && (
                <span className="ml-2 text-yellow-400">
                  💰 {t('gifts.yourBalance', { balance: userBalance })}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-[#0a0d10] border border-[#ff007a]/30 rounded-lg p-6 flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#ff007a]"></div>
              <span className="text-white font-medium">
                {isModelo ? t('gifts.sendingRequest') : t('gifts.sendingGift')}
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

// ==================== ESTILOS CSS ====================
export const giftSystemStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }

  .animate-scaleIn {
    animation: scaleIn 0.4s ease-out;
  }

  /* Scrollbar personalizado para el contenedor de regalos */
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

  /* Firefox */
  .gift-scroll-container {
    scrollbar-width: thin;
    scrollbar-color: #ff007a rgba(43, 45, 49, 0.5);
  }
`;