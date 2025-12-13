import React, { useState, useEffect } from 'react';
import { 
  Send, Heart, Mic, MicOff, Video, VideoOff, PhoneOff, SkipForward, 
  SwitchCamera, MoreVertical, Star, UserX, Gift, Settings, Volume2, VolumeX,
  RefreshCw, Camera, Headphones, X
} from 'lucide-react';

const MobileControlsImprovedClient = ({
  mensaje = '',
  setMensaje = () => {},
  enviarMensaje = () => {},
  handleKeyPress = () => {},
  toggleFavorite = () => {},
  blockCurrentUser = () => {},
  isFavorite = false,
  isAddingFavorite = false,
  isBlocking = false,
  otherUser = null,
  setShowGiftsModal = () => {},
  micEnabled = true,
  setMicEnabled = () => {},
  cameraEnabled = true,
  setCameraEnabled = () => {},
  volumeEnabled = true,
  setVolumeEnabled = () => {},
  onCameraSwitch = () => {},
  onEndCall = () => {},
  siguientePersona = () => {},
  finalizarChat = () => {},
  userBalance = 0,
  // Props para configuración
  cameras = [],
  microphones = [],
  selectedCamera = '',
  selectedMicrophone = '',
  isLoadingDevices = false,
  onCameraChange = () => {},
  onMicrophoneChange = () => {},
  onLoadDevices = () => {},
  // NUEVAS PROPS PARA SINCRONIZACIÓN
  currentCameraId = '', // ID de la cámara que realmente está activa
  currentMicrophoneId = '' // ID del micrófono que realmente está activo
}) => {
  
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMainSettings, setShowMainSettings] = useState(false);

  // Estados locales para controlar los dropdowns
  const [localSelectedCamera, setLocalSelectedCamera] = useState('');
  const [localSelectedMicrophone, setLocalSelectedMicrophone] = useState('');

  // Sincronizar los estados locales con los props cuando cambien
  useEffect(() => {
    console.log('🔄 [SYNC] Actualizando cámara local:', currentCameraId || selectedCamera);
    setLocalSelectedCamera(currentCameraId || selectedCamera);
  }, [currentCameraId, selectedCamera]);

  useEffect(() => {
    console.log('🔄 [SYNC] Actualizando micrófono local:', currentMicrophoneId || selectedMicrophone);
    setLocalSelectedMicrophone(currentMicrophoneId || selectedMicrophone);
  }, [currentMicrophoneId, selectedMicrophone]);

  // Función para cambio de cámara con sincronización inmediata
  const handleCameraChangeInternal = (deviceId) => {
    console.log('🎥 [MÓVIL] Cambiando cámara a:', deviceId);
    
    // Actualizar inmediatamente el estado local para feedback visual
    setLocalSelectedCamera(deviceId);
    
    // Llamar a la función padre
    onCameraChange(deviceId);
  };

  // Función para cambio de micrófono con sincronización inmediata
  const handleMicrophoneChangeInternal = (deviceId) => {
    console.log('🎤 [MÓVIL] Cambiando micrófono a:', deviceId);
    
    // Actualizar inmediatamente el estado local para feedback visual
    setLocalSelectedMicrophone(deviceId);
    
    // Llamar a la función padre
    onMicrophoneChange(deviceId);
  };

  const handleLoadDevicesInternal = () => {
    console.log('🔄 [MÓVIL] Recargando dispositivos...');
    onLoadDevices();
  };

  const handleGiftClick = () => {
    if (otherUser && userBalance > 0) {
      setShowGiftsModal(true);
    }
  };

  const handleEmojiClick = () => {
    const heartsEmojis = ['❤️', '💕', '😍', '🥰', '😘', '💋', '🔥', '✨'];
    const randomHeart = heartsEmojis[Math.floor(Math.random() * heartsEmojis.length)];
    setMensaje(prev => prev + randomHeart);
  };

  const handleCameraSwitch = () => {
    if (onCameraSwitch) {
      onCameraSwitch();
    }
  };

  const handleEndCall = () => {
    if (onEndCall) {
      onEndCall();
    } else if (finalizarChat) {
      finalizarChat();
    }
  };

  const handleNextPerson = () => {
    if (siguientePersona) {
      siguientePersona();
    }
  };

  // Función para manejar acciones del menú y cerrarlo
  const handleMenuAction = (action) => {
    setShowMoreMenu(false);
    if (typeof action === 'function') {
      action();
    }
  };

  // Función para abrir/cerrar configuración
  const toggleSettings = () => {
    console.log('🔧 Toggle settings:', !showMainSettings);
    setShowMainSettings(!showMainSettings);
  };

  // Función para cerrar configuración
  const closeSettings = () => {
    console.log('🔧 Cerrando configuración');
    setShowMainSettings(false);
  };

  // Función para manejar tecla Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showMainSettings) {
          closeSettings();
        }
        if (showMoreMenu) {
          setShowMoreMenu(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showMainSettings, showMoreMenu]);

  return (
    <>
      {/* CONTROLES PRINCIPALES */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-2 bg-gradient-to-t from-[#0a0d10] via-[#131418]/80 to-transparent backdrop-blur-sm">
        <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-xl rounded-2xl border border-[#ff007a]/20 shadow-xl">
          
          {/* Barra de controles principales */}
          <div className="flex items-center justify-center gap-1 p-3 border-b border-gray-700/50">
            
            {/* 🎤 MICRÓFONO */}
            <button
              onClick={() => setMicEnabled(!micEnabled)}
              className={`
                relative p-3 rounded-xl transition-all duration-300 hover:scale-105
                ${micEnabled 
                  ? 'bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-400/30'
                }
              `}
              title={micEnabled ? "Desactivar micrófono" : "Activar micrófono"}
            >
              {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                micEnabled ? 'bg-[#00ff66]' : 'bg-red-400'
              } animate-pulse`}></div>
            </button>

            {/* 🎥 CÁMARA */}
            <button
              onClick={() => setCameraEnabled(!cameraEnabled)}
              className={`
                relative p-3 rounded-xl transition-all duration-300 hover:scale-105
                ${cameraEnabled 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-400/30'
                }
              `}
              title={cameraEnabled ? "Apagar cámara" : "Encender cámara"}
            >
              {cameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                cameraEnabled ? 'bg-blue-400' : 'bg-red-400'
              } animate-pulse`}></div>
            </button>

            {/* 🔊 VOLUMEN */}
            <button
              onClick={() => setVolumeEnabled(!volumeEnabled)}
              className={`
                relative p-3 rounded-xl transition-all duration-300 hover:scale-105
                ${volumeEnabled 
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-400/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-400/30'
                }
              `}
              title={volumeEnabled ? "Silenciar audio" : "Activar audio"}
            >
              {volumeEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                volumeEnabled ? 'bg-purple-400' : 'bg-red-400'
              } animate-pulse`}></div>
            </button>

            {/* ⚙️ CONFIGURACIÓN */}
            <button
              onClick={toggleSettings}
              className={`
                relative p-3 rounded-xl transition-all duration-300 hover:scale-105
                ${showMainSettings 
                  ? 'bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30' 
                  : 'bg-gray-700/50 text-gray-300 hover:text-white hover:bg-gray-600/50 border border-gray-600/30'
                }
              `}
              title="Configuración"
            >
              <Settings size={16} className={`transition-transform duration-300 ${
                showMainSettings ? 'rotate-90' : ''
              }`} />
              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                showMainSettings ? 'bg-[#ff007a]' : 'bg-gray-500'
              } animate-pulse`}></div>
            </button>

            {/* ⏭️ SIGUIENTE PERSONA */}
            <button
              onClick={handleNextPerson}
              className="p-3 rounded-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-[#ff007a] to-[#ff007a]/80 text-white hover:from-[#ff007a] hover:to-[#ff007a] shadow-lg"
              title="Siguiente modelo"
            >
              <SkipForward size={16} />
            </button>

            {/* ☎️ COLGAR */}
            <button
              onClick={handleEndCall}
              className="p-3 rounded-xl transition-all duration-300 hover:scale-105 bg-red-500/80 text-white hover:bg-red-600 shadow-lg"
              title="Finalizar chat"
            >
              <PhoneOff size={16} />
            </button>

            {/* 🔘 MENÚ DE 3 PUNTOS */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`
                  p-3 rounded-xl transition-all duration-300 hover:scale-105
                  ${showMoreMenu 
                    ? 'bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30' 
                    : 'bg-gray-700/50 text-gray-300 hover:text-white hover:bg-gray-600/50 border border-gray-600/30'
                  }
                `}
                title="Más opciones"
              >
                <MoreVertical size={16} />
              </button>

              {/* Menú desplegable */}
              {showMoreMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-gradient-to-b from-[#0a0d10] to-[#131418] border border-[#ff007a]/20 rounded-xl shadow-2xl backdrop-blur-xl min-w-[180px] z-50">
                  <div className="p-3 space-y-2">

                    {/* ⭐ FAVORITO */}
                    <button
                      onClick={() => handleMenuAction(toggleFavorite)}
                      disabled={isAddingFavorite || !otherUser}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm flex items-center gap-3
                        ${isFavorite 
                          ? 'bg-[#ff007a]/10 text-[#ff007a] border border-[#ff007a]/30' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                        }
                        ${!otherUser ? 'opacity-40 cursor-not-allowed' : ''}
                        ${isAddingFavorite ? 'animate-pulse' : ''}
                      `}
                    >
                      <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                      <span>{isFavorite ? 'Quitar favorito' : 'Agregar favorito'}</span>
                    </button>

                    {/* 🚫 BLOQUEAR */}
                    <button
                      onClick={() => handleMenuAction(blockCurrentUser)}
                      disabled={isBlocking || !otherUser}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm flex items-center gap-3
                        text-gray-300 hover:text-red-400 hover:bg-red-500/10
                        ${!otherUser ? 'opacity-40 cursor-not-allowed' : ''}
                        ${isBlocking ? 'animate-pulse' : ''}
                      `}
                    >
                      <UserX size={14} />
                      <span>Bloquear modelo</span>
                    </button>

                    {/* 🎁 REGALO */}
                    <button
                      onClick={() => handleMenuAction(handleGiftClick)}
                      disabled={!otherUser || !userBalance || userBalance <= 0}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm flex items-center gap-3
                        ${otherUser && userBalance > 0
                          ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' 
                          : 'text-gray-500 opacity-40 cursor-not-allowed'
                        }
                      `}
                    >
                      <Gift size={14} />
                      <span>Enviar regalo</span>
                      {userBalance > 0 && (
                        <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                          {userBalance}
                        </span>
                      )}
                    </button>

                    {/* 💖 EMOJI */}
                    <button
                      onClick={() => handleMenuAction(handleEmojiClick)}
                      className="w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm flex items-center gap-3 text-gray-300 hover:text-[#ff007a] hover:bg-[#ff007a]/10"
                    >
                      <Heart size={14} />
                      <span>Agregar emoji</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input de mensaje */}
          <div className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative max-w-[60%]">
                <input
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe mensaje..."
                  maxLength={200}
                  className="
                    w-full bg-gray-800/60 backdrop-blur-sm px-3 py-2 rounded-xl 
                    outline-none text-white text-sm placeholder-gray-400
                    border border-gray-600/30 focus:border-[#ff007a]/50 
                    transition-all duration-300 focus:bg-gray-800/80
                    pr-10
                  "
                />
                
                {/* Contador de caracteres */}
                {mensaje.length > 150 && (
                  <div className="absolute -top-6 right-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded backdrop-blur-sm ${
                      mensaje.length > 190 
                        ? 'bg-red-500/20 text-red-300' 
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {mensaje.length}/200
                    </span>
                  </div>
                )}
              </div>

              {/* Botón enviar */}
              <button
                onClick={enviarMensaje}
                disabled={!mensaje.trim()}
                className={`
                  relative p-3 rounded-xl transition-all duration-300 overflow-hidden shrink-0
                  ${mensaje.trim() 
                    ? 'bg-gradient-to-r from-[#ff007a] to-[#ff007a]/80 text-white hover:scale-105 shadow-lg' 
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  }
                `}
                title="Enviar mensaje"
              >
                <Send size={16} />
                
                {/* Efecto de brillo */}
                {mensaje.trim() && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
                )}
              </button>

            <button
              onClick={setShowGiftsModal  }
              className="
                relative h-10 w-10 rounded-xl transition-all duration-300 overflow-hidden shrink-0
                bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:scale-105 shadow-lg 
                hover:from-amber-600 hover:to-amber-700 flex items-center justify-center
                border border-amber-400/30
              "
            >
              <Gift size={18} />
              
              {/* Efecto de brillo */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
            </button>
            </div>
          </div>
        </div>

        {/* Overlay para cerrar menú */}
        {showMoreMenu && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMoreMenu(false)}
          ></div>
        )}
      </div>

      {/* 🔧 MODAL DE CONFIGURACIÓN */}
      {showMainSettings && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Fondo oscuro */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
          
          {/* Modal */}
          <div className="relative bg-gradient-to-b from-[#0a0d10] to-[#131418] border border-[#ff007a]/20 rounded-2xl shadow-2xl backdrop-blur-xl w-full max-w-md max-h-[80vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-600/30 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-[#ff007a]" />
                <h4 className="text-white font-semibold text-lg">Configuración</h4>
              </div>
              <button
                onClick={closeSettings}
                className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700/50 transition-all duration-200"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Sección Cámara */}
              <div className="space-y-4 bg-black/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera size={18} className="text-blue-400" />
                    <span className="text-white text-base font-medium">Cámara</span>
                  </div>
                  <button
                    onClick={() => setCameraEnabled(!cameraEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0 ${cameraEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${cameraEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {cameraEnabled && (
                  <div className="space-y-3">
                    <label className="text-sm text-gray-300 flex items-center gap-2 justify-center">
                      <Video size={14} />
                      Seleccionar cámara:
                    </label>
                    
                    <div className="w-full">
                      {isLoadingDevices ? (
                        <div className="p-3 bg-black/30 rounded-lg text-gray-400 text-sm text-center flex items-center justify-center gap-2">
                          <RefreshCw size={16} className="animate-spin" />
                          Cargando dispositivos...
                        </div>
                      ) : cameras.length > 0 ? (
                        <select
                          value={localSelectedCamera}
                          onChange={(e) => handleCameraChangeInternal(e.target.value)}
                          className="w-full p-3 bg-black/30 border border-gray-600/50 rounded-lg text-white text-sm text-center focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          {cameras.map((camera) => (
                            <option key={camera.deviceId} value={camera.deviceId} className="bg-gray-800">
                              {camera.label || `Cámara ${camera.deviceId.slice(0, 8)}...`}
                              {(currentCameraId === camera.deviceId) && ' ✓ ACTIVA'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                          ⚠️ No se encontraron cámaras
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sección Micrófono */}
              <div className="space-y-4 bg-black/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Headphones size={18} className="text-green-400" />
                    <span className="text-white text-base font-medium">Micrófono</span>
                  </div>
                  <button
                    onClick={() => setMicEnabled(!micEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0 ${micEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${micEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {micEnabled && (
                  <div className="space-y-3">
                    <label className="text-sm text-gray-300 flex items-center gap-2 justify-center">
                      <Mic size={14} />
                      Seleccionar micrófono:
                    </label>
                    <div className="w-full">
                      {isLoadingDevices ? (
                        <div className="p-3 bg-black/30 rounded-lg text-gray-400 text-sm text-center flex items-center justify-center gap-2">
                          <RefreshCw size={16} className="animate-spin" />
                          Cargando dispositivos...
                        </div>
                      ) : microphones.length > 0 ? (
                        <select
                          value={localSelectedMicrophone}
                          onChange={(e) => handleMicrophoneChangeInternal(e.target.value)}
                          className="w-full p-3 bg-black/30 border border-gray-600/50 rounded-lg text-white text-sm text-center focus:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                        >
                          {microphones.map((mic) => (
                            <option key={mic.deviceId} value={mic.deviceId} className="bg-gray-800">
                              {mic.label || `Micrófono ${mic.deviceId.slice(0, 8)}...`}
                              {(currentMicrophoneId === mic.deviceId) && ' ✓ ACTIVO'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                          ⚠️ No se encontraron micrófonos
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Acciones */}
              <div className="space-y-3 pt-2 border-t border-gray-700/50">
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleLoadDevicesInternal}
                    disabled={isLoadingDevices}
                    className="w-full px-4 py-3 rounded-xl transition-all duration-200 text-sm border border-green-500/20 hover:border-green-500/40 text-gray-300 hover:text-white hover:bg-green-500/10 flex items-center justify-center gap-3"
                  >
                    <RefreshCw size={16} className={`${isLoadingDevices ? 'animate-spin text-green-400' : 'text-green-500'}`} />
                    <span>{isLoadingDevices ? 'Actualizando dispositivos...' : 'Actualizar dispositivos'}</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      if (confirm('¿Estás seguro de que quieres recargar la página? Se perderá la conexión actual.')) {
                        window.location.reload();
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl transition-all duration-200 text-sm border border-red-500/20 hover:border-red-500/40 text-gray-300 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-3"
                  >
                    🔄 <span>Recargar página</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileControlsImprovedClient;