// components/DesktopControlsImprovedClient.jsx - VERSIÓN ACTUALIZADA CON FUNCIONES COMPLETAS
import React from 'react';
import { 
  Mic, 
  MicOff, 
  Video,
  VideoOff,
  PhoneOff, 
  Settings,
  Volume2,
  VolumeX,
  SkipForward,
  RefreshCw,
  Camera,
  Headphones
} from 'lucide-react';

const DesktopControlsImprovedClient = ({
  micEnabled,
  setMicEnabled,
  cameraEnabled,
  setCameraEnabled,
  volumeEnabled,
  setVolumeEnabled,
  siguientePersona,
  finalizarChat,
  showMainSettings,
  setShowMainSettings,
  loading,
  t,
  // 🔥 PROPS PARA DISPOSITIVOS
  cameras = [],
  microphones = [],
  selectedCamera = '',
  selectedMicrophone = '',
  isLoadingDevices = false,
  onCameraChange = () => {},
  onMicrophoneChange = () => {},
  onLoadDevices = () => {}
}) => {

  // Funciones para controles básicos
  const handleMicToggle = () => {
    console.log('🎤 Toggle micrófono:', !micEnabled);
    setMicEnabled(!micEnabled);
  };

  const handleCameraToggle = () => {
    console.log('🎥 Toggle cámara:', !cameraEnabled);
    setCameraEnabled(!cameraEnabled);
  };

  const handleVolumeToggle = () => {
    console.log('🔊 Toggle volumen:', !volumeEnabled);
    setVolumeEnabled(!volumeEnabled);
  };

  const handleCameraChangeInternal = (deviceId) => {
    console.log('🎥 Cambiando cámara a:', deviceId);
    onCameraChange(deviceId);
  };

  const handleMicrophoneChangeInternal = (deviceId) => {
    console.log('🎤 Cambiando micrófono a:', deviceId);
    onMicrophoneChange(deviceId);
  };

  const handleLoadDevicesInternal = () => {
    console.log('🔄 Recargando dispositivos...');
    onLoadDevices();
  };

  return (
    <div className="hidden md:block fixed bottom-1 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-xl rounded-3xl border border-[#ff007a]/20 shadow-2xl p-4">
        <div className="flex items-center gap-4">
          
          {/* 🎤 MICRÓFONO */}
          <button
            onClick={handleMicToggle}
            disabled={loading}
            className={`
              relative p-4 rounded-2xl transition-all duration-300 hover:scale-110 group
              ${micEnabled 
                ? 'bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/30 shadow-lg shadow-[#00ff66]/20' 
                : 'bg-red-500/20 text-red-400 border border-red-400/30 shadow-lg shadow-red-500/20'
              }
              ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
            `}
            title={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
          >
            {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
              micEnabled ? 'bg-[#00ff66]' : 'bg-red-400'
            } animate-pulse`}></div>
          </button>

          {/* 🎥 CÁMARA */}
          <button
            onClick={handleCameraToggle}
            disabled={loading}
            className={`
              relative p-4 rounded-2xl transition-all duration-300 hover:scale-110 group
              ${cameraEnabled 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30 shadow-lg shadow-blue-500/20' 
                : 'bg-red-500/20 text-red-400 border border-red-400/30 shadow-lg shadow-red-500/20'
              }
              ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
            `}
            title={cameraEnabled ? 'Apagar cámara' : 'Encender cámara'}
          >
            {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
              cameraEnabled ? 'bg-blue-400' : 'bg-red-400'
            } animate-pulse`}></div>
          </button>

          {/* 🔊 VOLUMEN */}
          <button
            onClick={handleVolumeToggle}
            disabled={loading}
            className={`
              relative p-4 rounded-2xl transition-all duration-300 hover:scale-110 group
              ${volumeEnabled 
                ? 'bg-purple-500/20 text-purple-400 border border-purple-400/30 shadow-lg shadow-purple-500/20' 
                : 'bg-red-500/20 text-red-400 border border-red-400/30 shadow-lg shadow-red-500/20'
              }
              ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
            `}
            title={volumeEnabled ? 'Silenciar audio' : 'Activar audio'}
          >
            {volumeEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          <div className="w-px h-8 bg-gray-600/50"></div>

          {/* ⏭️ SIGUIENTE PERSONA */}
          <button
            onClick={siguientePersona}
            disabled={loading}
            className={`
              relative p-4 rounded-2xl transition-all duration-300 hover:scale-110 group overflow-hidden
              bg-gradient-to-r from-[#ff007a] to-[#ff007a]/80 text-white 
              hover:from-[#ff007a] hover:to-[#ff007a] shadow-lg shadow-[#ff007a]/40
              border border-[#ff007a]/30
              ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
            `}
            title="Buscar siguiente persona"
          >
            <SkipForward size={20} className="group-hover:translate-x-1 transition-transform duration-200" />
            {!loading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            )}
          </button>

          {/* ☎️ FINALIZAR CHAT */}
          <button
            onClick={finalizarChat}
            disabled={loading}
            className={`
              relative p-4 rounded-2xl transition-all duration-300 hover:scale-110 group overflow-hidden
              bg-gradient-to-r from-red-500 to-red-600 text-white 
              hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/40
              border border-red-400/30
              ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
            `}
            title="Finalizar chat"
          >
            <PhoneOff size={20} className="group-hover:rotate-12 transition-transform duration-200" />
            {!loading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            )}
          </button>

          <div className="w-px h-8 bg-gray-600/50"></div>

          {/* ⚙️ CONFIGURACIÓN CON DISPOSITIVOS */}
          <div className="relative">
            <button
              onClick={() => setShowMainSettings(!showMainSettings)}
              disabled={loading}
              className={`
                relative p-4 rounded-2xl transition-all duration-300 hover:scale-110 group
                ${showMainSettings 
                  ? 'bg-[#ff007a]/20 text-[#ff007a] border border-[#ff007a]/30' 
                  : 'bg-gray-700/50 text-gray-300 hover:text-white hover:bg-gray-600/50 border border-gray-600/30'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
              `}
              title="Configuración de dispositivos"
            >
              <Settings size={20} className={`group-hover:rotate-90 transition-transform duration-300 ${
                showMainSettings ? 'rotate-90' : ''
              }`} />
            </button>

            {/* 📋 PANEL DE CONFIGURACIÓN */}
            {showMainSettings && (
              <div className="absolute bottom-full mb-2 right-0 bg-gradient-to-b from-[#0a0d10] to-[#131418] border border-[#ff007a]/20 rounded-2xl shadow-2xl backdrop-blur-xl min-w-[320px] max-w-[380px] settings-dropdown">
                <div className="p-5 space-y-4">
                  
                  {/* 🎛️ TÍTULO */}
                  <div className="flex items-center gap-2 border-b border-gray-600/30 pb-3">
                    <Settings size={18} className="text-[#ff007a]" />
                    <h4 className="text-white font-semibold text-base">
                      Configuración de Dispositivos
                    </h4>
                  </div>
                  
                  {/* 🎥 SECCIÓN DE CÁMARA */}
                  <div className="space-y-3 bg-black/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera size={16} className="text-blue-400" />
                        <span className="text-white text-sm font-medium">Cámara</span>
                      </div>
                      <button
                        onClick={handleCameraToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          cameraEnabled ? 'bg-blue-500' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            cameraEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {cameraEnabled && (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-300 flex items-center gap-1">
                          <Video size={12} />
                          Seleccionar cámara:
                        </label>
                        {isLoadingDevices ? (
                          <div className="p-3 bg-black/30 rounded-lg text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                            <RefreshCw size={12} className="animate-spin" />
                            Cargando dispositivos...
                          </div>
                        ) : cameras.length > 0 ? (
                          <select
                            value={selectedCamera}
                            onChange={(e) => handleCameraChangeInternal(e.target.value)}
                            className="w-full p-2 bg-black/30 border border-gray-600/50 rounded-lg text-white text-xs focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                          >
                            {cameras.map((camera) => (
                              <option key={camera.deviceId} value={camera.deviceId} className="bg-gray-800">
                                {camera.label || `Cámara ${camera.deviceId.slice(0, 8)}...`}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-center text-red-400 text-xs">
                            No se encontraron cámaras
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 🎤 SECCIÓN DE MICRÓFONO */}
                  <div className="space-y-3 bg-black/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Headphones size={16} className="text-green-400" />
                        <span className="text-white text-sm font-medium">Micrófono</span>
                      </div>
                      <button
                        onClick={handleMicToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          micEnabled ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            micEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {micEnabled && (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-300 flex items-center gap-1">
                          <Mic size={12} />
                          Seleccionar micrófono:
                        </label>
                        {isLoadingDevices ? (
                          <div className="p-3 bg-black/30 rounded-lg text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                            <RefreshCw size={12} className="animate-spin" />
                            Cargando dispositivos...
                          </div>
                        ) : microphones.length > 0 ? (
                          <select
                            value={selectedMicrophone}
                            onChange={(e) => handleMicrophoneChangeInternal(e.target.value)}
                            className="w-full p-2 bg-black/30 border border-gray-600/50 rounded-lg text-white text-xs focus:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
                          >
                            {microphones.map((mic) => (
                              <option key={mic.deviceId} value={mic.deviceId} className="bg-gray-800">
                                {mic.label || `Micrófono ${mic.deviceId.slice(0, 8)}...`}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-center text-red-400 text-xs">
                            No se encontraron micrófonos
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-gray-700/50"></div>
                  
                  {/* 🔄 ACCIONES */}
                  <div className="space-y-2">
                    <button
                      onClick={handleLoadDevicesInternal}
                      disabled={isLoadingDevices}
                      className="w-full text-left px-3 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-green-500/10 transition-all duration-200 text-sm flex items-center gap-3 border border-green-500/20 hover:border-green-500/40"
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
                      className="w-full text-left px-3 py-3 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 text-sm flex items-center gap-3 border border-red-500/20 hover:border-red-500/40"
                    >
                      🔄 <span>Recargar página</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopControlsImprovedClient;