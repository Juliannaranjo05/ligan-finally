import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Wifi, WifiOff, User, Signal, Link, Info, X } from 'lucide-react';
import ClientRemainingMinutes from '../../ClientRemainingMinutes';

const TimeDisplayImproved = ({ 
 tiempoReal, 
 formatoTiempo, 
 connected, 
 otherUser, 
 roomName, 
 t 
}) => {

 // 🔥 ESTADO PARA TIEMPO PERSISTENTE
 const [persistentTime, setPersistentTime] = useState(0);
 const [sessionStarted, setSessionStarted] = useState(false);
 const [showInfoModal, setShowInfoModal] = useState(false);
 const [showInitialWarning, setShowInitialWarning] = useState(false);

 // 🔥 MOSTRAR ADVERTENCIA INICIAL AL CONECTAR
 useEffect(() => {
   if (connected && otherUser && !localStorage.getItem('betaWarningShown')) {
     setShowInitialWarning(true);
     localStorage.setItem('betaWarningShown', 'true');
   }
 }, [connected, otherUser]);

 // 🔥 FUNCIÓN PARA LIMPIAR TIEMPO
 const clearSessionTime = () => {
   localStorage.removeItem('sessionTime');
   localStorage.removeItem('sessionStartTime');
    };
 
 function truncateName(name, maxLength = 8) {
  if (!name) return '';
  return name.length > maxLength ? name.substring(0, maxLength) + '…' : name;
}


 // 🔥 RESTAURAR TIEMPO AL CARGAR
 useEffect(() => {
   const savedTime = localStorage.getItem('sessionTime');
   const savedStartTime = localStorage.getItem('sessionStartTime');
   
   if (savedTime && savedStartTime) {
     const elapsed = Date.now() - parseInt(savedStartTime);
     const totalTime = parseInt(savedTime) + Math.floor(elapsed / 1000);
     setPersistentTime(totalTime);
     setSessionStarted(true);
        }
 }, []);

 // 🔥 INICIAR TIEMPO CUANDO SE CONECTA
 useEffect(() => {
   if (connected && otherUser && !sessionStarted) {
          setSessionStarted(true);
     setPersistentTime(0);
   }
 }, [connected, otherUser, sessionStarted]);

 // 🔥 GUARDAR TIEMPO CADA SEGUNDO
 useEffect(() => {
   if (!connected || !sessionStarted) return;
   
   const interval = setInterval(() => {
     setPersistentTime(prev => {
       const newTime = prev + 1;
       localStorage.setItem('sessionTime', newTime.toString());
       localStorage.setItem('sessionStartTime', Date.now().toString());
       return newTime;
     });
   }, 1000);

   return () => clearInterval(interval);
 }, [connected, sessionStarted]);

 // 🔥 LIMPIAR AL DESMONTAR COMPLETAMENTE
 useEffect(() => {
   return () => {
     // Solo limpiar si el componente se desmonta por navegación
     if (window.location.pathname !== window.location.pathname) {
       clearSessionTime();
     }
   };
 }, []);

 // 🔥 USAR TIEMPO PERSISTENTE EN LUGAR DEL PROP
 const formatoTiempoPersistente = () => {
   const tiempo = persistentTime || 0;
   const minutos = Math.floor(tiempo / 60).toString().padStart(2, "0");
   const segundos = (tiempo % 60).toString().padStart(2, "0");
   return `${minutos}:${segundos}`;
 };

  return (
    <>
      <div className="w-full">
        {/* Versión móvil - compacta */}
        <div className="mobile-version">
          <div className="flex items-center justify-between gap-3">
            {/* Tiempo principal con rojo brillante */}
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#ff2e57]/20 rounded-lg border border-[#ff2e57]/30">
                <Clock size={14} className="text-[#ff2e57]" />
              </div>
              <div>
                <div className="text-gray-300 text-xs">Tiempo:</div>
                <div className="text-[#ff2e57] font-bold text-sm font-mono tracking-wider">
                  {formatoTiempoPersistente()}
                </div>
              </div>
            </div>
            
            {/* Estado de conexión */}
            <div className="flex items-center gap-2">
              {connected ? (
                <div className="flex items-center gap-1 bg-[#00ff66]/20 px-2 py-1 rounded-lg border border-[#00ff66]/30">
                  <div className="w-2 h-2 bg-[#00ff66] rounded-full animate-pulse"></div>
                  <span className="text-[#00ff66] text-xs font-medium">Conectada</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-red-500/20 px-2 py-1 rounded-lg border border-red-400/30">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-red-300 text-xs font-medium">Desconectada</span>
                </div>
              )}
              
              {/* Botón de información en móvil */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="bg-[#ff007a]/20 hover:bg-[#ff007a]/30 border border-[#ff007a]/40 text-[#ff007a] p-2 rounded-lg transition-all duration-200"
                title="Información de pagos"
              >
                <Info size={14} />
              </button>
            </div>
          </div>
          
          {/* Info del chico en móvil */}
          {otherUser && (
            <div className="mt-3 pt-3 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {otherUser.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <span className="text-white text-sm font-medium">{truncateName(otherUser.name)}</span>
                </div>
                
                {connected && (
                  <div className="bg-[#00ff66]/20 px-2 py-1 rounded-lg border border-[#00ff66]/30">
                    <ClientRemainingMinutes
                      roomName={roomName}
                      clientUserId={otherUser.id}
                      connected={connected}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Versión desktop - cabecera superior MÁS COMPACTA */}
        <div className="desktop-version">
            {/* Panel izquierdo - Tiempo y minutos del chico */}
          <div className="flex items-center gap-3">
            {/* Tiempo de llamada con rojo brillante */}
            <div className="flex items-center gap-2">
              <div className="p-1 bg-[#ff2e57]/20 rounded-md border border-[#ff2e57]/30">
                <Clock size={14} className="text-[#ff2e57]" />
              </div>
              <div>
                <div className="text-gray-300 text-xs font-medium">Tiempo:</div>
                <div className="text-[#ff2e57] font-bold text-base font-mono tracking-wider">
                  {formatoTiempoPersistente()}
                </div>
              </div>
            </div>
            
            {/* Minutos del chico con verde */}
            {otherUser && connected && (
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#00ff66]/20 rounded-md border border-[#00ff66]/30">
                  <Link size={14} className="text-[#00ff66]" />
                </div>
                <div>
                  <div className="text-[#00ff66] font-bold text-sm">
                    <ClientRemainingMinutes
                      roomName={roomName}
                      clientUserId={otherUser.id}
                      connected={connected}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Panel central - Información del chico */}
          {otherUser && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-[#ff007a] to-[#ff007a]/70 rounded-lg flex items-center justify-center border border-[#ff007a]/50">
                  <span className="text-white font-bold text-xs">
                    {otherUser.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                {connected && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#00ff66] rounded-full border border-[#0a0d10] animate-pulse"></div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[#ff007a] text-xs font-medium">Chico conectado</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Panel derecho - Estado compacto CON BOTÓN DE INFO */}
          <div className="flex items-center gap-2">
            {/* Estado de conexión */}
            <div className={`
              bg-gradient-to-br rounded-lg p-2 border shadow-md
              ${connected 
                ? 'from-[#00ff66]/10 to-[#00ff66]/5 border-[#00ff66]/30' 
                : 'from-red-500/10 to-red-500/5 border-red-400/30'
              }
            `}>
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-md border ${
                  connected 
                    ? 'bg-[#00ff66]/20 border-[#00ff66]/30' 
                    : 'bg-red-500/20 border-red-400/30'
                }`}>
                  {connected ? (
                    <Wifi size={12} className="text-[#00ff66]" />
                  ) : (
                    <WifiOff size={12} className="text-red-400" />
                  )}
                </div>
                <div>
                  <div className={`text-xs font-semibold ${
                    connected ? 'text-[#00ff66]' : 'text-red-300'
                  }`}>
                    {connected ? 'Conectada' : 'Desconectada'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {connected ? 'Transmisión activa' : 'Sin conexión'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Calidad de conexión */}
            {connected && (
              <div className="bg-gradient-to-br from-[#ff007a]/10 to-[#ff007a]/5 rounded-lg p-2 border border-[#ff007a]/30">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#ff007a]/20 rounded-md border border-[#ff007a]/30">
                    <Signal size={12} className="text-[#ff007a]" />
                  </div>
                  <div>
                    <div className="text-[#ff007a] text-xs font-semibold">Excelente</div>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        <div className="w-0.5 h-2 bg-[#00ff66] rounded-full"></div>
                        <div className="w-0.5 h-3 bg-[#00ff66] rounded-full"></div>
                        <div className="w-0.5 h-4 bg-[#00ff66] rounded-full"></div>
                        <div className="w-0.5 h-3 bg-[#00ff66] rounded-full"></div>
                      </div>
                      <span className="text-xs text-gray-400 ml-1">HD</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Hora actual compacta */}
            <div className="bg-gradient-to-br from-gray-600/10 to-slate-600/10 rounded-lg p-2 border border-gray-500/30">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-gray-500/20 rounded-md border border-gray-400/30">
                  <Clock size={12} className="text-gray-400" />
                </div>
                <div>
                  <div className="text-gray-300 text-xs font-medium mb-0.5">Hora local</div>
                  <div className="text-white font-mono text-xs">
                    {new Date().toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 🔥 BOTÓN DE INFORMACIÓN INTEGRADO EN EL PANEL DERECHO */}
            <div className="bg-gradient-to-br from-[#ff007a]/10 to-[#ff007a]/5 rounded-lg p-2 border border-[#ff007a]/30">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="p-1 bg-[#ff007a]/20 rounded-md border border-[#ff007a]/30 hover:bg-[#ff007a]/30 transition-all duration-200"
                  title="Información de pagos"
                >
                  <Info size={12} className="text-[#ff007a]" />
                </button>
                <div>
                  <div className="text-[#ff007a] text-xs font-semibold">Info</div>
                  <div className="text-xs text-gray-400">Pagos</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style jsx>
          {
  `/* 🚨 CSS RESPONSIVE PARA TU CÓDIGO EXACTO */

  /* 🔥 MÓVIL - Mantener como está */
  @media (max-width: 1023px) {
    .mobile-version {
      max-width: calc(100vw - 32px) !important;
      margin: 0 16px 16px 16px !important;
      padding: 12px !important;
      background: linear-gradient(to bottom, #0a0d10, #131418) !important;
      backdrop-filter: blur(12px) !important;
      border-radius: 12px !important;
      border: 1px solid rgba(255, 0, 122, 0.2) !important;
      overflow: hidden !important;
      flex-direction: column !important;
    }

    .desktop-version {
      display: none !important;
    }
  }

  /* 🔥 DESKTOP BASE (1024px+) - REDUCIR TODO */
  @media (min-width: 1024px) {
    .mobile-version {
      display: none !important;
    }

    .desktop-version {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      width: 100% !important;
      max-width: calc(100vw - 24px) !important;
      margin: 0 12px 6px 12px !important;
      background: linear-gradient(to bottom, #0a0d10, #131418) !important;
      backdrop-filter: blur(12px) !important;
      border-radius: 6px !important;
      border: 1px solid rgba(255, 0, 122, 0.2) !important;
      padding: 8px 12px !important;
      min-height: 44px !important;
      overflow: hidden !important;
    }

    /* Reducir gaps principales */
    .desktop-version > div:first-child {
      gap: 16px !important;
    }

    .desktop-version > div:last-child {
      gap: 12px !important;
    }

    /* Reducir padding de iconos */
    .desktop-version .p-1 {
      padding: 6px !important;
    }

    .desktop-version .p-2 {
      padding: 6px 8px !important;
    }

    /* Reducir tamaño de íconos */
    .desktop-version svg[size="14"] {
      width: 12px !important;
      height: 12px !important;
    }

    .desktop-version svg[size="12"] {
      width: 12px !important;
      height: 12px !important;
    }

    /* Reducir fuentes */
    .desktop-version .text-xs {
      font-size: 0.625rem !important;
    }

    .desktop-version .text-base {
      font-size: 0.8rem !important;
    }

    .desktop-version .text-sm {
      font-size: 0.7rem !important;
    }

    /* Reducir avatar */
    .desktop-version .w-8.h-8 {
      width: 28px !important;
      height: 28px !important;
      border-radius: 8px !important;
    }

    .desktop-version .w-8.h-8 span {
      font-size: 0.625rem !important;
    }

    /* Reducir punto de estado */
    .desktop-version .w-2\\.5.h-2\\.5 {
      width: 10px !important;
      height: 10px !important;
    }

    /* Reducir barras de señal */
    .desktop-version .w-0\\.5 {
      width: 2px !important;
    }

    .desktop-version .h-2 {
      height: 8px !important;
    }

    .desktop-version .h-3 {
      height: 12px !important;
    }

    .desktop-version .h-4 {
      height: 16px !important;
    }
  }

  /* 🔥 REDUCCIÓN MEDIA: 1200px-1439px (20% menos) */
  @media (min-width: 1200px) and (max-width: 1439px) {
    .desktop-version {
      max-width: calc(100vw - 19px) !important;
      padding: 6px 10px !important;
      min-height: 35px !important;
      margin: 0 10px 5px 10px !important;
    }

    .desktop-version > div:first-child {
      gap: 13px !important;
    }

    .desktop-version > div:last-child {
      gap: 10px !important;
    }

    .desktop-version .p-1 {
      padding: 5px !important;
    }

    .desktop-version .p-2 {
      padding: 5px 6px !important;
    }

    .desktop-version svg[size="14"],
    .desktop-version svg[size="12"] {
      width: 10px !important;
      height: 10px !important;
    }

    .desktop-version .text-xs {
      font-size: 0.5rem !important;
    }

    .desktop-version .text-base {
      font-size: 0.64rem !important;
    }

    .desktop-version .text-sm {
      font-size: 0.56rem !important;
    }

    .desktop-version .w-8.h-8 {
      width: 22px !important;
      height: 22px !important;
    }

    .desktop-version .w-8.h-8 span {
      font-size: 0.5rem !important;
    }

    .desktop-version .w-2\\.5.h-2\\.5 {
      width: 8px !important;
      height: 8px !important;
    }

    .desktop-version .w-0\\.5 {
      width: 1.5px !important;
    }

    .desktop-version .h-2 {
      height: 6px !important;
    }

    .desktop-version .h-3 {
      height: 10px !important;
    }

    .desktop-version .h-4 {
      height: 13px !important;
    }
  }

  /* 🔥 REDUCCIÓN GRANDE: 1024px-1199px (40% menos) */
  @media (min-width: 1024px) and (max-width: 1199px) {
    .desktop-version {
      max-width: calc(100vw - 14px) !important;
      padding: 5px 7px !important;
      min-height: 26px !important;
      margin: 0 7px 4px 7px !important;
    }

    .desktop-version > div:first-child {
      gap: 10px !important;
    }

    .desktop-version > div:last-child {
      gap: 7px !important;
    }

    .desktop-version .p-1 {
      padding: 4px !important;
    }

    .desktop-version .p-2 {
      padding: 4px 5px !important;
    }

    .desktop-version svg[size="14"],
    .desktop-version svg[size="12"] {
      width: 7px !important;
      height: 7px !important;
    }

    .desktop-version .text-xs {
      font-size: 0.375rem !important;
    }

    .desktop-version .text-base {
      font-size: 0.48rem !important;
    }

    .desktop-version .text-sm {
      font-size: 0.42rem !important;
    }

    .desktop-version .w-8.h-8 {
      width: 17px !important;
      height: 17px !important;
    }

    .desktop-version .w-8.h-8 span {
      font-size: 0.375rem !important;
    }

    .desktop-version .w-2\\.5.h-2\\.5 {
      width: 6px !important;
      height: 6px !important;
    }

    .desktop-version .w-0\\.5 {
      width: 1px !important;
    }

    .desktop-version .h-2 {
      height: 4px !important;
    }

    .desktop-version .h-3 {
      height: 7px !important;
    }

    .desktop-version .h-4 {
      height: 10px !important;
    }

    /* Ocultar elementos en pantallas pequeñas */
    .desktop-version > div:nth-child(2) {
      display: none !important; /* Panel central (usuario) */
    }

    /* Ocultar minutos del chico en pantallas pequeñas */
    .desktop-version > div:first-child > div:nth-child(2) {
      display: none !important;
    }
  }

  /* 🔥 REDUCCIÓN EXTREMA: < 1100px */
  @media (max-width: 1100px) {
    /* Ocultar panel central completamente */
    .desktop-version > div:nth-child(2) {
      display: none !important;
    }

    /* Ocultar timestamp (última sección del panel derecho) */
    .desktop-version > div:last-child > div:nth-last-child(2) {
      display: none !important;
    }

    /* Ocultar calidad de señal (tercer elemento del panel derecho) */
    .desktop-version > div:last-child > div:nth-child(2) {
      display: none !important;
    }

    /* Ajustar espaciado final */
    .desktop-version {
      justify-content: space-between !important;
    }
  }

  /* 🔥 ANIMACIÓN PULSE */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* 🔥 PROTECCIÓN ANTI-OVERFLOW */
  * {
    box-sizing: border-box !important;
  }

  .w-full {
    max-width: 100vw !important;
    overflow: hidden !important;
  }
    `
          }
        </style>
      </div>

      {/* 🔥 MODAL DE INFORMACIÓN - FUERA DEL CONTENEDOR PRINCIPAL */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-xl border border-[#ff007a]/30 shadow-2xl w-full max-w-sm sm:w-1/2 sm:max-w-lg max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#ff007a]/20 rounded-lg border border-[#ff007a]/30">
                  <Info size={16} className="text-[#ff007a]" />
                </div>
                <h2 className="text-lg font-bold text-white">Sistema de Pagos</h2>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Advertencia BETA */}
              <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-white font-bold">β</span>
                  </div>
                  <div>
                    <h4 className="text-amber-300 font-semibold text-sm mb-1">FASE BETA</h4>
                    <p className="text-amber-200/80 text-xs leading-tight">
                      Esta función está en pruebas y puede tener errores. Reporta cualquier problema.
                    </p>
                  </div>
                </div>
              </div>

              {/* Información de pagos */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold text-sm border-b border-gray-600/30 pb-2">
                  💰 Sistema de Ganancias
                </h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-[#ff007a] font-bold">•</span>
                    <p className="text-gray-300">
                      <span className="text-white font-semibold">$0.25 por minuto</span> - Pago fijo por cada minuto de videollamada
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <span className="text-[#ff007a] font-bold">•</span>
                    <p className="text-gray-300">
                      <span className="text-white font-semibold">60% de regalos</span> - Comisión de cada regalo recibido
                    </p>
                  </div>
                </div>
              </div>

              {/* Reglas importantes */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold text-sm border-b border-gray-600/30 pb-2">
                  ⚠️ Consideraciones Importantes
                </h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">1.</span>
                    <p className="text-gray-300">
                      <span className="text-red-300 font-semibold">Chico con menos de 2 minutos</span> - Finalizar la sala porque ya no cuenta con saldo y el tiempo transcurrido no se reflejará
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">2.</span>
                    <p className="text-gray-300">
                      <span className="text-red-300 font-semibold">Tiempo no inicia en 0</span> - Si al iniciar el tiempo no está en 00:00, finalizar y volver a iniciar otra sala
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">3.</span>
                    <p className="text-gray-300">
                      <span className="text-red-300 font-semibold">Chico se desconecta durante la llamada</span> - Si sale conectado y no regresa después de 1 minuto, finalizar la sala. Si no lo haces, no se reflejará nada en el saldo
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">4.</span>
                    <p className="text-gray-300">
                      <span className="text-red-300 font-semibold">Aparece "Conectando" en pantalla</span> - Si sale conectando después de 1 minuto, finalizar la sala. Si no lo haces, no se reflejará nada en el saldo
                    </p>
                  </div>
                </div>
              </div>

              {/* Consejos */}
              <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
                <h4 className="text-blue-300 font-semibold text-xs mb-2">💡 Consejos</h4>
                <ul className="text-blue-200/80 text-xs space-y-1">
                  <li>• Mantén conversaciones interesantes</li>
                  <li>• Anima a los usuarios a enviar regalos</li>
                  <li>• No cierres las salas muy rápido</li>
                  <li>• Reporta errores para mejorar el sistema</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700/50 bg-gray-900/50">
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full bg-[#ff007a] text-white text-sm font-medium rounded-lg py-2 hover:bg-[#ff007a]/90 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 ADVERTENCIA INICIAL - FUERA DEL CONTENEDOR PRINCIPAL */}
      {showInitialWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-xl border border-[#ff007a]/30 shadow-2xl w-80 max-w-sm">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-[#ff007a]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#ff007a]/30">
                <Info size={32} className="text-[#ff007a]" />
              </div>
              <h3 className="text-white font-bold text-lg mb-3">¡Importante!</h3>
              <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                Lee las reglas de pago antes de comenzar. Haz clic en el botón de información (ℹ️) para conocer el sistema.
              </p>
              <button
                onClick={() => setShowInitialWarning(false)}
                className="w-full bg-[#ff007a] text-white font-medium rounded-lg py-3 hover:bg-[#ff007a]/90 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TimeDisplayImproved;