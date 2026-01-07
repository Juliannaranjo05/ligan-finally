import React, { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import audioManager from '../utils/AudioManager';

const SecondModelInvitationOverlay = ({ 
  isVisible = false, 
  invitationData = null,
  onAccept = () => {},
  onReject = () => {}
}) => {
  const { t } = useTranslation();
  const [isResponding, setIsResponding] = useState(false);

  // 🔥 FUNCIÓN PARA OBTENER INICIAL DEL NOMBRE
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // 🔥 RESETEAR ESTADO CUANDO LA INVITACIÓN DESAPARECE
  useEffect(() => {
    if (!isVisible || !invitationData) {
      setIsResponding(false);
      return;
    }
    
    setIsResponding(false);
  }, [isVisible, invitationData?.call_id]);

  // 🔥 FUNCIÓN: ACEPTAR INVITACIÓN
  const handleAccept = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isResponding) return;
    
    setIsResponding(true);
        
    try {
      await onAccept();
      setTimeout(() => {
        setIsResponding(false);
      }, 2000);
    } catch (error) {
      setIsResponding(false);
    }
  };

  // 🔥 FUNCIÓN: RECHAZAR INVITACIÓN
  const handleReject = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isResponding) return;
    
    setIsResponding(true);
        
    try {
      await onReject();
      setTimeout(() => {
        setIsResponding(false);
      }, 2000);
    } catch (error) {
      setIsResponding(false);
    }
  };

  if (!isVisible || !invitationData) {
    return null;
  }

  const cliente = invitationData.cliente || {};
  const modelo1 = invitationData.modelo1 || {};

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] rounded-3xl p-8 max-w-md w-full mx-4 border border-[#ff007a]/30 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#ff007a]/20 to-[#ff007a]/10 border-2 border-[#ff007a]/30 mb-4">
            <Users className="w-10 h-10 text-[#ff007a]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Invitación a Llamada 2vs1
          </h2>
          <p className="text-gray-400 text-sm">
            Un cliente te invita a unirte a una llamada existente
          </p>
        </div>

        {/* Cliente info */}
        <div className="bg-[#1f2125] rounded-xl p-4 mb-4 border border-white/10">
          <div className="flex items-center gap-3">
            {cliente.avatar ? (
              <img 
                src={cliente.avatar} 
                alt={cliente.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-[#ff007a]/30"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff007a] to-[#cc0062] flex items-center justify-center border-2 border-[#ff007a]/30">
                <span className="text-white font-bold text-lg">
                  {getInitial(cliente.name)}
                </span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-white font-semibold">{cliente.name || 'Cliente'}</p>
              <p className="text-gray-400 text-xs">Te está invitando</p>
            </div>
          </div>
        </div>

        {/* Modelo 1 info */}
        {modelo1.id && (
          <div className="bg-[#1f2125] rounded-xl p-4 mb-6 border border-white/10">
            <div className="flex items-center gap-3">
              {modelo1.avatar ? (
                <img 
                  src={modelo1.avatar} 
                  alt={modelo1.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-green-400/30"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center border-2 border-green-400/30">
                  <span className="text-white font-bold text-lg">
                    {getInitial(modelo1.name)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <p className="text-white font-semibold">{modelo1.name || 'Modelo'}</p>
                <p className="text-gray-400 text-xs">Ya está en la llamada</p>
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            disabled={isResponding}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <X size={20} />
            Rechazar
          </button>
          <button
            onClick={handleAccept}
            disabled={isResponding}
            className="flex-1 bg-gradient-to-r from-[#ff007a] to-[#cc0062] hover:from-[#ff3399] hover:to-[#e6006e] text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
          >
            <Users size={20} />
            {isResponding ? 'Aceptando...' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecondModelInvitationOverlay;






