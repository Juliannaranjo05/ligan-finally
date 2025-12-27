// utils/cameraaudiosettings.jsx - VERSIÓN CORREGIDA SIN DEPENDENCIAS DE LIVEKIT CONTEXT
import React, { useState, useEffect } from 'react';
import { X, Camera, Mic, Eye, EyeOff, Settings, Video, Headphones, Volume2, RefreshCw } from 'lucide-react';

const CameraAudioSettings = ({
  isOpen,
  onClose,
  cameraEnabled,
  micEnabled,
  setCameraEnabled,
  setMicEnabled,
  mirrorMode,
  setMirrorMode,
  onMirrorToggle,
  volumeEnabled,
  setVolumeEnabled,
  // 🔥 NUEVAS PROPS para comunicación con el componente padre
  selectedCamera: propSelectedCamera,
  selectedMicrophone: propSelectedMicrophone,
  onCameraChange,
  onMicrophoneChange,
  cameras: propCameras = [],
  microphones: propMicrophones = [],
  isLoadingDevices: propIsLoadingDevices = false,
  onLoadDevices
}) => {
  const [cameras, setCameras] = useState(propCameras);
  const [microphones, setMicrophones] = useState(propMicrophones);
  const [selectedCamera, setSelectedCamera] = useState(propSelectedCamera || '');
  const [selectedMicrophone, setSelectedMicrophone] = useState(propSelectedMicrophone || '');
  const [isLoadingDevices, setIsLoadingDevices] = useState(propIsLoadingDevices);

  // 🔥 Sincronizar con props del padre
  useEffect(() => {
    if (propCameras.length > 0) {
      setCameras(propCameras);
    }
    if (propMicrophones.length > 0) {
      setMicrophones(propMicrophones);
    }
    if (propSelectedCamera) {
      setSelectedCamera(propSelectedCamera);
    }
    if (propSelectedMicrophone) {
      setSelectedMicrophone(propSelectedMicrophone);
    }
    setIsLoadingDevices(propIsLoadingDevices);
  }, [propCameras, propMicrophones, propSelectedCamera, propSelectedMicrophone, propIsLoadingDevices]);

  // 🔥 Cargar dispositivos disponibles (solo si no vienen del padre)
  const loadDevices = async () => {
    if (onLoadDevices) {
      // Si hay callback del padre, usarlo
      onLoadDevices();
      return;
    }

    setIsLoadingDevices(true);
    try {
      // Solicitar permisos primero
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      setCameras(videoDevices);
      setMicrophones(audioDevices);
      
      // Cerrar stream temporal
      stream.getTracks().forEach(track => track.stop());
      
      // Establecer dispositivos seleccionados actuales
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      if (audioDevices.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(audioDevices[0].deviceId);
      }
    } catch (error) {
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // 🔥 Cargar dispositivos cuando se abre el modal (solo si no vienen del padre)
  useEffect(() => {
    if (isOpen && (!propCameras.length || !propMicrophones.length)) {
      loadDevices();
    }
  }, [isOpen]);

  // 🔥 Manejar cambio de cámara - COMUNICAR AL PADRE INMEDIATAMENTE
  const handleCameraChange = (deviceId) => {
    setSelectedCamera(deviceId);
    // Comunicar cambio al componente padre inmediatamente
    if (onCameraChange) {
      onCameraChange(deviceId);
    }
  };

  // 🔥 Manejar cambio de micrófono - COMUNICAR AL PADRE INMEDIATAMENTE
  const handleMicrophoneChange = (deviceId) => {
    setSelectedMicrophone(deviceId);
    // Comunicar cambio al componente padre inmediatamente
    if (onMicrophoneChange) {
      onMicrophoneChange(deviceId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-[#0a0d10] to-[#131418] rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto border border-[#ff007a]/20 shadow-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="p-5 space-y-4">
          
          {/* 🎛️ TÍTULO */}
          <div className="flex items-center justify-between border-b border-gray-600/30 pb-3">
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-[#ff007a]" />
              <h4 className="text-white font-semibold text-base">
                Configuración de Dispositivos
              </h4>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          
          {/* 🎥 SECCIÓN DE CÁMARA */}
          <div className="space-y-3 bg-black/20 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Camera size={16} className="text-blue-400" />
              <span className="text-white text-sm font-medium">Seleccionar Cámara</span>
            </div>

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
                  onChange={(e) => handleCameraChange(e.target.value)}
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
          </div>

          {/* 🎤 SECCIÓN DE MICRÓFONO - CON TOGGLE */}
          <div className="space-y-3 bg-black/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones size={16} className="text-green-400" />
                <span className="text-white text-sm font-medium">Micrófono</span>
              </div>
              <button
                onClick={() => setMicEnabled(!micEnabled)}
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
                    onChange={(e) => handleMicrophoneChange(e.target.value)}
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

          {/* 🔊 SECCIÓN DE VOLUMEN */}
          <div className="space-y-3 bg-black/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-purple-400" />
                <span className="text-white text-sm font-medium">Audio de Sala</span>
              </div>
              <button
                onClick={() => setVolumeEnabled && setVolumeEnabled(!volumeEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  volumeEnabled !== false ? 'bg-purple-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    volumeEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="text-xs text-gray-400">
              {volumeEnabled !== false ? 'Audio de sala activado' : 'Audio de sala silenciado'}
            </div>
          </div>
          
          <div className="border-t border-gray-700/50"></div>
          
          {/* 🔄 ACCIONES */}
          <div className="space-y-2">
            <button
              onClick={onLoadDevices}
              disabled={isLoadingDevices}
              className="w-full text-left px-3 py-3 rounded-xl text-white hover:bg-green-500/10 transition-all duration-200 text-sm flex items-center gap-3 bg-green-500 border border-green-500/40 hover:border-green-500"
            >
              <RefreshCw size={16} className={`${isLoadingDevices ? 'animate-spin text-white' : 'text-white'}`} />
              <span>{isLoadingDevices ? 'Actualizando dispositivos...' : 'Actualizar dispositivos'}</span>
            </button>
            
            <button
              onClick={() => {
                if (confirm('¿Estás seguro de que quieres recargar la página? Se perderá la conexión actual.')) {
                  window.location.reload();
                }
              }}
              className="w-full text-left px-3 py-3 rounded-xl text-white hover:bg-purple-500/10 transition-all duration-200 text-sm flex items-center gap-3 bg-purple-500 border border-purple-500/40 hover:border-purple-500"
            >
              <RefreshCw size={16} className="text-white" />
              <span>Recargar página</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraAudioSettings;