import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Heart, Mic, MicOff, Video, VideoOff, PhoneOff, SkipForward, 
  SwitchCamera, MoreVertical, Star, UserX, Gift, Settings, Volume2, VolumeX,
  RefreshCw, Camera, Headphones, X 
} from 'lucide-react';

const MobileControlsImproved = ({
  // Props básicos
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
  
  // Props para sincronización
  currentCameraId = '',
  currentMicrophoneId = '',
  
  // NUEVA PROP: Determina si es vista de usuario o modelo
  isModelView = false, // false = usuario, true = modelo
  // Prop para ocultar controles principales (para modelo cuando están arriba)
  hideTopControls = false
}) => {
  
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMainSettings, setShowMainSettings] = useState(false);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);

  // Estados locales para controlar los dropdowns
  const [localSelectedCamera, setLocalSelectedCamera] = useState('');
  const [localSelectedMicrophone, setLocalSelectedMicrophone] = useState('');

  const isUserChangingCamera = useRef(false);
  const isUserChangingMicrophone = useRef(false);
  
  useEffect(() => {
    if (!isUserChangingCamera.current) {
            setLocalSelectedCamera(currentCameraId || selectedCamera);
    }
  }, [currentCameraId, selectedCamera]);

  useEffect(() => {
    if (!isUserChangingMicrophone.current) {
            setLocalSelectedMicrophone(currentMicrophoneId || selectedMicrophone);
    }
  }, [currentMicrophoneId, selectedMicrophone]);
  
  const handleCameraChangeInternal = (deviceId) => {
    // 🔥 OPTIMIZADO: Cambio inmediato sin delays innecesarios
    // Marcar que el usuario está cambiando la cámara
    isUserChangingCamera.current = true;
    
    // Actualizar estado local inmediatamente
    setLocalSelectedCamera(deviceId);
    
    // Llamar función padre INMEDIATAMENTE
    onCameraChange(deviceId);
    
    // 🔥 REDUCIDO: Delay mínimo solo para sincronización
    setTimeout(() => {
      isUserChangingCamera.current = false;
    }, 100); // REDUCIDO DE 500ms A 100ms
  };

  const handleMicrophoneChangeInternal = (deviceId) => {
    // 🔥 OPTIMIZADO: Cambio inmediato sin delays innecesarios
    // Marcar que el usuario está cambiando el micrófono
    isUserChangingMicrophone.current = true;
    
    // Actualizar estado local inmediatamente
    setLocalSelectedMicrophone(deviceId);
    
    // Llamar función padre INMEDIATAMENTE
    onMicrophoneChange(deviceId);
    
    // 🔥 REDUCIDO: Delay mínimo solo para sincronización
    setTimeout(() => {
      isUserChangingMicrophone.current = false;
    }, 100); // REDUCIDO DE 500ms A 100ms
  };  

  const handleLoadDevicesInternal = () => {
        onLoadDevices();
  };

  const handleGiftClick = () => {
    setShowGiftsModal(true); // ← DIRECTO, sin condiciones
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

  // Función para truncar el nombre de usuario a máximo 8 caracteres
  const truncateUserName = (name) => {
    if (!name) return '';
    return name.length > 8 ? name.substring(0, 8) : name;
  };

  return (
    <>
      {/* CONTROLES PRINCIPALES */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="bg-transparent">
          
          {/* Barra de controles principales - Ocultar si hideTopControls es true */}
          {!hideTopControls && (
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

            {/* 🔄 INTERCAMBIAR VISTA - Solo para modelos */}
            {isModelView && (
              <button
                onClick={handleCameraSwitch}
                className="relative p-3 rounded-xl transition-all duration-300 hover:scale-105 bg-purple-500/20 text-purple-400 border border-purple-400/30"
                title="Intercambiar vista de cámara"
              >
                <SwitchCamera size={16} />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              </button>
            )}

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
              title={isModelView ? "Siguiente usuario" : "Siguiente modelo"}
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

            {/* 🔘 MENÚ DE 3 PUNTOS - Solo para usuarios */}
            {!isModelView && (
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
            )}

            {isModelView && (
              <div className="relative">
                {/* Botón de tres puntos */}
                <button
                  onClick={() => setShowThreeDotsMenu(!showThreeDotsMenu)}
                  className="p-3 rounded-xl transition-all duration-300 hover:scale-105 bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50"
                  title="Más opciones"
                >
                  <MoreVertical size={16} />
                </button>

                {/* Menú desplegable FIXED */}
                {showThreeDotsMenu && (
                  <div className="fixed bottom-20 right-4 w-48 bg-gray-900/95 backdrop-blur-lg rounded-xl border border-gray-700/50 shadow-2xl z-[9999]">
                    
                    {/* Header con X para cerrar */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
                      <span className="text-white text-sm font-medium">Opciones</span>
                      <button
                        onClick={() => setShowThreeDotsMenu(false)}
                        className="text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg p-1 transition-all duration-200"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Contenido del menú */}
                    <div className="p-2 space-y-1">
                      
                      {/* ⭐ FAVORITO */}
                      <button
                        onClick={() => {
                          toggleFavorite();
                          setShowThreeDotsMenu(false);
                        }}
                        disabled={isAddingFavorite || !otherUser}
                        className={`
                          w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 text-left
                          ${isFavorite 
                            ? 'bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30' 
                            : 'text-gray-300 hover:bg-gray-700/50 hover:text-[#ff007a]'
                          }
                          ${isAddingFavorite || !otherUser ? 'opacity-40 cursor-not-allowed' : ''}
                        `}
                      >
                        <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                        <span className="text-sm">
                          {isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                        </span>
                        {isAddingFavorite && (
                          <div className="ml-auto">
                            <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                          </div>
                        )}
                      </button>

                      {/* 🚫 BLOQUEAR */}
                      <button
                        onClick={() => {
                          blockCurrentUser();
                          setShowThreeDotsMenu(false);
                        }}
                        disabled={isBlocking || !otherUser}
                        className={`
                          w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 text-left
                          text-gray-300 hover:bg-red-500/20 hover:text-red-400
                          ${isBlocking || !otherUser ? 'opacity-40 cursor-not-allowed' : ''}
                        `}
                      >
                        <UserX size={16} />
                        <span className="text-sm">Bloquear usuario</span>
                        {isBlocking && (
                          <div className="ml-auto">
                            <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                          </div>
                        )}
                      </button>

                      {/* 🎁 PEDIR REGALO */}
                      <button
                        onClick={() => {
                          handleGiftClick();
                          setShowThreeDotsMenu(false);
                        }}
                        disabled={!otherUser}
                        className={`
                          w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 text-left
                          ${otherUser 
                            ? 'text-gray-300 hover:bg-[#ff007a]/20 hover:text-[#ff007a]' 
                            : 'opacity-40 cursor-not-allowed text-gray-500'
                          }
                        `}
                      >
                        <Gift size={16} />
                        <span className="text-sm">Pedir regalo</span>
                      </button>

                      {/* 💖 EMOJI */}
                      <button
                        onClick={() => {
                          handleEmojiClick();
                          setShowThreeDotsMenu(false);
                        }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 text-left text-gray-300 hover:bg-[#ff007a]/20 hover:text-[#ff007a]"
                      >
                        <Heart size={16} />
                        <span className="text-sm">Agregar emoji</span>
                      </button>

                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Input de mensaje - Ocupa todo el espacio */}
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

              {/* 🎁 BOTÓN DE REGALO - MISMO TAMAÑO QUE INPUT */}
              <button
                onClick={handleGiftClick}
                className="
                  relative h-10 w-10 rounded-xl transition-all duration-300 overflow-hidden shrink-0
                  bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:scale-105 shadow-lg 
                  hover:from-amber-600 hover:to-amber-700 flex items-center justify-center
                  border border-amber-400/30
                "
                title={isModelView ? "Pedir regalo" : "Enviar regalo"}
              >
                <Gift size={18} />
                
                {/* Efecto de brillo */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
              </button>

              {/* Botón enviar - MISMO TAMAÑO */}
              <button
                onClick={enviarMensaje}
                disabled={!mensaje.trim()}
                className={`
                  relative h-10 w-10 rounded-xl transition-all duration-300 overflow-hidden shrink-0
                  flex items-center justify-center
                  ${mensaje.trim() 
                    ? 'bg-gradient-to-r from-[#ff007a] to-[#ff007a]/80 text-white hover:scale-105 shadow-lg border border-[#ff007a]/30' 
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/30'
                  }
                `}
                title="Enviar mensaje"
              >
                <Send size={18} />
                
                {/* Efecto de brillo */}
                {mensaje.trim() && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
                )}
              </button>

              {/* Indicador de saldo - Solo para usuarios */}
              {!isModelView && userBalance > 0 && (
                <div className="bg-gradient-to-r from-amber-500/20 to-amber-500/10 backdrop-blur-lg rounded-full px-2 py-1.5 border border-amber-500/30 shrink-0 h-10 flex items-center">
                  <div className="flex items-center gap-1">
                    <Gift size={14} className="text-amber-500" />
                    <span className="text-amber-500 text-xs font-bold">
                      {userBalance}
                    </span>
                  </div>
                </div>
              )}
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

      {/* 🔧 MODAL DE CONFIGURACIÓN UNIFICADO */}
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
                {isModelView && (
                  <div className="bg-pink-500/20 text-pink-400 text-xs px-2 py-1 rounded-full border border-pink-500/30">
                    MODELO
                  </div>
                )}
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
                  
                  {isModelView ? (
                    // MODELO: Indicador de que siempre está activa
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 text-sm font-medium">SIEMPRE ACTIVA</span>
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                  ) : (
                    // USUARIO: Toggle switch
                    <button
                    >
                    </button>
                  )}
                </div>

                {/* Para modelos: siempre mostrar selección de cámara */}
                {/* Para usuarios: solo si la cámara está habilitada */}
                {(isModelView || cameraEnabled) && (
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

              {/* Sección de Acciones Sociales - Solo dentro del modal para usuarios */}
              {!isModelView && (
                <div className="space-y-4 bg-black/20 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Heart size={18} className="text-[#ff007a]" />
                    <span className="text-white text-base font-medium">Acciones</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {/* ⭐ FAVORITO */}
                    <button
                      onClick={toggleFavorite}
                      disabled={isAddingFavorite || !otherUser}
                      className={`
                        flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300
                        ${isFavorite 
                          ? 'bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30' 
                          : 'bg-gray-800/50 text-gray-400 hover:text-[#ff007a] hover:bg-[#ff007a]/10'
                        }
                        ${isAddingFavorite ? 'animate-pulse' : ''}
                        ${!otherUser ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
                      `}
                    >
                      <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
                      <span className="text-xs text-center">
                        {isFavorite ? 'Favorito' : 'Agregar'}
                      </span>
                    </button>

                    {/* 🚫 BLOQUEAR */}
                    <button
                      onClick={blockCurrentUser}
                      disabled={isBlocking || !otherUser}
                      className={`
                        flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300
                        bg-gray-800/50 text-gray-400 hover:text-red-400 hover:bg-red-400/10
                        ${isBlocking ? 'animate-pulse' : ''}
                        ${!otherUser ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105'}
                      `}
                    >
                      <UserX size={20} />
                      <span className="text-xs text-center">Bloquear</span>
                    </button>

                    {/* 🎁 REGALO */}
                   <button
                      onClick={handleGiftClick}
                      // ← SIN disabled
                      className="
                        relative p-3 rounded-xl transition-all duration-300 overflow-hidden shrink-0
                        bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:scale-105 shadow-lg hover:from-amber-600 hover:to-amber-700
                      "
                    >
                      <Gift size={20} />
                      <span className="text-xs text-center">Regalo</span>
                      {userBalance > 0 && (
                        <span className="text-xs bg-amber-500/30 text-amber-300 px-1 py-0.5 rounded text-center min-w-[20px]">
                          {userBalance}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Acciones del Sistema */}
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

              {/* Información de Usuario Conectado - Limitar nombre a 8 caracteres */}
              {otherUser && (
                <div className="bg-[#00ff66]/10 border border-[#00ff66]/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="relative">
                      <div className="w-2 h-2 bg-[#00ff66] rounded-full"></div>
                      <div className="absolute inset-0 w-2 h-2 bg-[#00ff66] rounded-full animate-ping opacity-40"></div>
                    </div>
                    <span className="text-[#00ff66] text-sm font-medium">
                      {isModelView ? 'Usuario conectado' : 'Modelo conectada'}
                    </span>
                  </div>
                  <div className="text-white font-bold text-lg">
                    {truncateUserName(otherUser.name)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileControlsImproved;