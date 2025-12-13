// utils/cameraaudiosettings.jsx - VERSIÓN CORREGIDA SIN DEPENDENCIAS DE LIVEKIT CONTEXT
import React, { useState, useEffect } from 'react';
import { X, Camera, Mic, Eye, EyeOff } from 'lucide-react';

const CameraAudioSettings = ({
  isOpen,
  onClose,
  cameraEnabled,
  micEnabled,
  setCameraEnabled,
  setMicEnabled,
  mirrorMode,
  setMirrorMode,
  onMirrorToggle
}) => {
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  // Cargar dispositivos disponibles
  const loadDevices = async () => {
    setIsLoadingDevices(true);
    try {
      // Solicitar permisos primero
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      setCameras(videoDevices);
      setMicrophones(audioDevices);
      
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

  // Cargar dispositivos cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  // Manejar cambio de cámara
  const handleCameraChange = (deviceId) => {
    setSelectedCamera(deviceId);
    // Aquí podrías emitir un evento o llamar una función del componente padre
      };

  // Manejar cambio de micrófono
  const handleMicrophoneChange = (deviceId) => {
    setSelectedMicrophone(deviceId);
    // Aquí podrías emitir un evento o llamar una función del componente padre
      };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-[#1f2125] to-[#2a2d31] rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto border border-[#ff007a]/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#ff007a]/20">
          <h2 className="text-xl font-bold text-white">Configuración de Dispositivos</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          {/* Controles de Cámara */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Camera className="text-blue-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">Cámara</h3>
            </div>

            {/* Toggle Cámara */}
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-gray-600/30">
              <span className="text-white font-medium">Activar cámara</span>
              <button
                onClick={() => setCameraEnabled(!cameraEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  cameraEnabled ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    cameraEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Selector de Cámara */}
            {cameraEnabled && (
              <div className="space-y-2">
                <label className="text-sm text-gray-300 font-medium">Seleccionar cámara:</label>
                {isLoadingDevices ? (
                  <div className="p-3 bg-black/20 rounded-lg text-center text-gray-400">
                    Cargando dispositivos...
                  </div>
                ) : (
                  <select
                    value={selectedCamera}
                    onChange={(e) => handleCameraChange(e.target.value)}
                    className="w-full p-3 bg-black/20 border border-gray-600/50 rounded-lg text-white focus:border-blue-500/50 focus:outline-none transition-colors"
                  >
                    {cameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Cámara ${camera.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Modo Espejo */}
            {cameraEnabled && (
              <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-gray-600/30">
                <div className="flex items-center gap-3">
                  {mirrorMode ? (
                    <Eye className="text-blue-400" size={20} />
                  ) : (
                    <EyeOff className="text-gray-400" size={20} />
                  )}
                  <div>
                    <span className="text-white font-medium">Modo espejo</span>
                    <p className="text-xs text-gray-400">Voltear video horizontalmente</p>
                  </div>
                </div>
                <button
                  onClick={onMirrorToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    mirrorMode ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      mirrorMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Controles de Micrófono */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Mic className="text-green-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">Micrófono</h3>
            </div>

            {/* Toggle Micrófono */}
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-gray-600/30">
              <span className="text-white font-medium">Activar micrófono</span>
              <button
                onClick={() => setMicEnabled(!micEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  micEnabled ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    micEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Selector de Micrófono */}
            {micEnabled && (
              <div className="space-y-2">
                <label className="text-sm text-gray-300 font-medium">Seleccionar micrófono:</label>
                {isLoadingDevices ? (
                  <div className="p-3 bg-black/20 rounded-lg text-center text-gray-400">
                    Cargando dispositivos...
                  </div>
                ) : (
                  <select
                    value={selectedMicrophone}
                    onChange={(e) => handleMicrophoneChange(e.target.value)}
                    className="w-full p-3 bg-black/20 border border-gray-600/50 rounded-lg text-white focus:border-green-500/50 focus:outline-none transition-colors"
                  >
                    {microphones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Micrófono ${mic.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Información adicional */}
          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <h4 className="text-blue-300 font-medium mb-2">💡 Consejos</h4>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• Asegúrate de tener buena iluminación</li>
              <li>• Usa auriculares para evitar eco</li>
              <li>• Mantén la cámara a la altura de los ojos</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#ff007a]/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              // Aquí podrías guardar la configuración
                            onClose();
            }}
            className="px-6 py-2 bg-gradient-to-r from-[#ff007a] to-[#e91e63] text-white rounded-lg hover:from-[#e91e63] hover:to-[#ff007a] transition-all"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraAudioSettings;