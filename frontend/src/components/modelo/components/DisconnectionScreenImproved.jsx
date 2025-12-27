import React from 'react';
import { ArrowRight, Zap, Heart, Sparkles, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DisconnectionScreenImproved = ({ 
  disconnectionType, 
  disconnectionReason, 
  redirectCountdown
}) => {
  const { t } = useTranslation();
  
  const getDisconnectionInfo = () => {
    switch (disconnectionType) {
      case 'next':
        return {
          icon: '⏭️',
          title: t('disconnect.clientSkippedYou', 'El chico fue a la siguiente modelo'),
          subtitle: t('disconnect.clientSearchedOther', 'Buscó a otra modelo'),
          bgGradient: 'from-amber-500/20 to-orange-500/20',
          borderColor: 'border-amber-400/30',
          iconBg: 'from-amber-500/20 to-amber-500/10',
          textColor: 'text-amber-100',
          accentColor: 'text-amber-400'
        };
      case 'stop':
      case 'partner_left_session':
        return {
          icon: '🛑',
          title: t('disconnect.clientDisconnected', 'El chico colgó'),
          subtitle: t('disconnect.clientEndedVideoCall', 'Finalizó la videollamada'),
          bgGradient: 'from-red-500/20 to-red-500/10',
          borderColor: 'border-red-400/30',
          iconBg: 'from-red-500/20 to-red-500/10',
          textColor: 'text-red-100',
          accentColor: 'text-red-400'
        };
      case 'left':
        return {
          icon: '👋',
          title: t('disconnect.clientLeft', 'El chico abandonó la sala'),
          subtitle: t('disconnect.clientLeftSession', 'Salió de la sesión'),
          bgGradient: 'from-[#ff007a]/20 to-[#ff007a]/10',
          borderColor: 'border-[#ff007a]/30',
          iconBg: 'from-[#ff007a]/20 to-[#ff007a]/10',
          textColor: 'text-[#ff007a]',
          accentColor: 'text-[#ff007a]'
        };
      case 'balance_exhausted':
        return {
          icon: '💰',
          title: t('disconnect.balanceExhausted', 'Saldo agotado'),
          subtitle: t('disconnect.ranOutOfCoins', 'Te has quedado sin monedas'),
          bgGradient: 'from-amber-500/20 to-amber-500/10',
          borderColor: 'border-amber-400/30',
          iconBg: 'from-amber-500/20 to-amber-500/10',
          textColor: 'text-amber-100',
          accentColor: 'text-amber-400'
        };
      default:
        return {
          icon: '💔',
          title: t('disconnect.sessionEnded', 'Sesión finalizada'),
          subtitle: t('disconnect.connectionLost', 'Se perdió la conexión'),
          bgGradient: 'from-gray-500/20 to-gray-500/10',
          borderColor: 'border-gray-400/30',
          iconBg: 'from-gray-500/20 to-gray-500/10',
          textColor: 'text-gray-100',
          accentColor: 'text-gray-400'
        };
    }
  };

  const info = getDisconnectionInfo();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0d10] to-[#131418] text-white flex items-center justify-center p-3 relative overflow-hidden">
      {/* Fondo minimalista */}
      <div className="absolute inset-0">
        <div className={`absolute inset-0 bg-gradient-to-br ${info.bgGradient} opacity-30`}></div>
        
        {/* Solo 2 partículas pequeñas */}
        <div className="absolute top-10 left-10 w-1 h-1 bg-[#ff007a]/30 rounded-full animate-ping"></div>
        <div className="absolute bottom-10 right-10 w-1 h-1 bg-[#ff007a]/20 rounded-full animate-pulse"></div>
      </div>
      
      <div className="text-center max-w-sm mx-auto relative z-10 w-full">
        {/* Contenedor compacto */}
        <div className="bg-gradient-to-b from-[#0a0d10]/90 to-[#131418]/90 backdrop-blur-xl rounded-xl border border-[#ff007a]/20 p-4 shadow-xl">
          
          {/* Icono medio */}
          <div className={`bg-gradient-to-br ${info.iconBg} rounded-xl p-4 mx-auto mb-4 border ${info.borderColor} shadow-lg relative overflow-hidden`}>
            <div className="text-3xl relative z-10">
              {info.icon}
            </div>
          </div>
          
          {/* Info compacta */}
          <div className="space-y-2 mb-4">
            <h2 className="text-base font-bold text-white leading-tight">
              {info.title}
            </h2>
            <p className={`text-sm ${info.textColor} font-medium`}>
              {info.subtitle}
            </p>
          </div>
          
          {/* Razón opcional */}
          {disconnectionReason && (
            <div className={`bg-[#0a0d10]/50 border ${info.borderColor} rounded-xl p-3 mb-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} className={info.accentColor} />
                <span className="text-white font-medium text-sm">
                  {t('disconnect.details', 'Detalles')}
                </span>
              </div>
              <p className={`${info.textColor} text-sm`}>
                {disconnectionReason}
              </p>
            </div>
          )}
          
          {/* Reconexión */}
          <div className="bg-gradient-to-r from-[#ff007a]/10 to-[#ff007a]/5 border border-[#ff007a]/20 rounded-xl p-4 space-y-3">
            
            {/* Mensaje */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Heart size={12} className="text-[#ff007a]" />
                <h3 className="text-white font-bold text-sm">
                  {t('disconnect.dontWorryClient', '¡No te preocupes!')}
                </h3>
              </div>
              <p className="text-[#ff007a] text-sm">
                {t('disconnect.connectingWithOtherClient', 'Buscando nuevo chico...')}
              </p>
            </div>
            
            {/* Countdown */}
            {redirectCountdown > 0 ? (
              <div className="flex items-center justify-center space-x-3">
                {/* Spinner */}
                <div className="relative">
                  <div className="w-8 h-8 border-2 border-gray-600/30 rounded-full"></div>
                  <div className="absolute inset-0 w-8 h-8 border-2 border-[#ff007a] border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[#ff007a] font-bold text-sm">
                      {redirectCountdown}
                    </span>
                  </div>
                </div>
                
                {/* Info */}
                <div className="text-left">
                  <div className="text-[#ff007a] font-bold text-sm flex items-center gap-1">
                    <Clock size={12} />
                    {t('disconnect.inSeconds', 'En {{seconds}}s', { seconds: redirectCountdown })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-3">
                <div className="w-6 h-6 border-2 border-[#ff007a] border-t-transparent rounded-full animate-spin"></div>
                <div className="text-[#ff007a] font-bold text-sm flex items-center gap-1">
                  <Zap size={12} />
                  {t('disconnect.connecting', 'Conectando...')}
                </div>
              </div>
            )}

            {/* Barra */}
            {redirectCountdown > 0 && (
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div 
                  className="h-full bg-[#ff007a] rounded-full transition-all duration-1000"
                  style={{ width: `${((3 - redirectCountdown) / 3) * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
        
        {/* Consejos */}
        <div className="mt-3 space-y-2">
          <div className="bg-[#0a0d10]/80 rounded-xl p-2.5 border border-[#00ff66]/20">
            <div className="flex items-center gap-2 text-[#00ff66]">
              <Sparkles size={10} />
              <span className="text-sm font-medium">
                💰 {t('disconnect.keepSufficientCoins', 'Mantén monedas suficientes')}
              </span>
            </div>
          </div>
          
          <div className="bg-[#0a0d10]/80 rounded-xl p-2.5 border border-[#ff007a]/20">
            <div className="flex items-center gap-2 text-[#ff007a]">
              <Heart size={10} />
              <span className="text-sm font-medium">
                🎯 {t('disconnect.beRespectful', 'Sé respetuoso siempre')}
              </span>
            </div>
          </div>
          
          <div className="bg-[#0a0d10]/80 rounded-xl p-2.5 border border-[#ff007a]/20">
            <div className="flex items-center gap-2 text-[#ff007a]">
              <ArrowRight size={10} />
              <span className="text-sm font-medium">
                ✨ {t('disconnect.eachConnectionUnique', 'Cada conexión es única')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisconnectionScreenImproved;