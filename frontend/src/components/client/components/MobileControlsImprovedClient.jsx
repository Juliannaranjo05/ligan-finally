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
  giftBalance = 0,
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
  currentMicrophoneId = '', // ID del micrófono que realmente está activo
  // 🔥 PROPS PARA CONTROLAR EL MENÚ DE MÁS OPCIONES DESDE EL PADRE
  showMoreMenu: externalShowMoreMenu = null,
  setShowMoreMenu: externalSetShowMoreMenu = null
}) => {
  
  // 🔥 USAR ESTADO EXTERNO SI ESTÁ DISPONIBLE, SINO USAR ESTADO LOCAL
  const [internalShowMoreMenu, setInternalShowMoreMenu] = useState(false);
  const showMoreMenu = externalShowMoreMenu !== null ? externalShowMoreMenu : internalShowMoreMenu;
  const setShowMoreMenu = externalSetShowMoreMenu || setInternalShowMoreMenu;
  
  const [showMainSettings, setShowMainSettings] = useState(false);

  // Estados locales para controlar los dropdowns
  const [localSelectedCamera, setLocalSelectedCamera] = useState('');
  const [localSelectedMicrophone, setLocalSelectedMicrophone] = useState('');

  // Sincronizar los estados locales con los props cuando cambien
  useEffect(() => {
    setLocalSelectedCamera(currentCameraId || selectedCamera);
  }, [currentCameraId, selectedCamera]);

  useEffect(() => {
    setLocalSelectedMicrophone(currentMicrophoneId || selectedMicrophone);
  }, [currentMicrophoneId, selectedMicrophone]);

  // Función para cambio de cámara con sincronización inmediata
  const handleCameraChangeInternal = (deviceId) => {
    
    // Actualizar inmediatamente el estado local para feedback visual
    setLocalSelectedCamera(deviceId);
    
    // Llamar a la función padre
    onCameraChange(deviceId);
  };

  // Función para cambio de micrófono con sincronización inmediata
  const handleMicrophoneChangeInternal = (deviceId) => {
    
    // Actualizar inmediatamente el estado local para feedback visual
    setLocalSelectedMicrophone(deviceId);
    
    // Llamar a la función padre
    onMicrophoneChange(deviceId);
  };

  const handleLoadDevicesInternal = () => {
    onLoadDevices();
  };

  const handleGiftClick = () => {
    if (otherUser && giftBalance > 0) {
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
    if (siguientePersona && typeof siguientePersona === 'function') {
      siguientePersona();
    } else {
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
    setShowMainSettings(!showMainSettings);
  };

  // Función para cerrar configuración
  const closeSettings = () => {
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
      {/* Input de mensaje - Ocupa todo el espacio */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="bg-transparent">
          <div className="w-full px-2 py-2">
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 relative w-full">
                <input
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type message..."
                  maxLength={200}
                  className="
                    w-full bg-transparent px-3 py-3 
                    outline-none text-white text-sm placeholder-gray-400
                    border-none focus:outline-none
                    transition-all duration-300
                    h-auto min-h-[44px]
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
              onClick={() => setShowGiftsModal(true)}
              disabled={!otherUser || !giftBalance || giftBalance <= 0}
              className={`
                relative h-10 w-10 rounded-xl transition-all duration-300 overflow-hidden shrink-0 flex items-center justify-center
                border ${
                  !otherUser || !giftBalance || giftBalance <= 0
                    ? 'bg-gray-800/50 text-gray-500 opacity-50 cursor-not-allowed border-gray-600/30'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:scale-105 shadow-lg hover:from-amber-600 hover:to-amber-700 border-amber-400/30'
                }
              `}
              title={!giftBalance || giftBalance <= 0 ? "Necesitas gift coins para enviar regalos" : "Enviar regalo"}
            >
              <Gift size={18} />
              
              {/* Efecto de brillo */}
              {(!otherUser || !giftBalance || giftBalance <= 0) ? null : (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
              )}
            </button>
            </div>
          </div>
        </div>
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
                    onClick={() => setCameraEnabled()}
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
                    onClick={() => setMicEnabled()}
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