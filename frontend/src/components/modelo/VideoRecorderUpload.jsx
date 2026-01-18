import React, { useEffect, useRef, useState } from "react";
import { Camera, Video, Square, Trash2, RotateCcw, Heart, Sparkles } from "lucide-react";
import instance from "../../api/axios"; // Asegúrate que este sea tu axios con withCredentials

export default function VideoRecorderUpload() {
  const videoRef = useRef(null);
  const recordedVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const streamRef = useRef(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [videoURL, setVideoURL] = useState(null);
  const [isFlipped, setIsFlipped] = useState(true);
  const [videoBlob, setVideoBlob] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [buttonsDisabled, setButtonsDisabled] = useState(false); // ✅ Added missing state

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = (time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  useEffect(() => {
    const init = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(device => device.kind === "videoinput");

        setDevices(videoDevices);

        if (videoDevices.length > 0) {
          const defaultDeviceId = videoDevices[0].deviceId;
          setSelectedDeviceId(defaultDeviceId);
          await startCamera(defaultDeviceId);
        } else {
          alert("No se encontró ninguna cámara disponible.");
        }
      } catch (error) {
                alert("Hubo un problema al acceder a la cámara/micrófono.");
      }
    };

    init();
  }, []);

  const startCamera = async (deviceId) => {
    if (!videoRef.current) return;

    setRecording(false);

    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true,
      };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
      setDevices(videoDevices);

          } catch (err) {
            if (err.name === "NotAllowedError") {
        alert("Permiso denegado. Por favor, permite acceso en tu navegador.");
      } else if (err.name === "NotFoundError") {
        alert("No se encontró cámara o micrófono.");
      } else {
        alert("Error al acceder: " + err.message);
      }
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const startRecording = () => {
    setRecordingTime(0);

    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    if (!streamRef.current) {
      alert("No hay acceso a la cámara");
      return;
    }

    const chunks = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm; codecs=vp9",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      if (chunks.length === 0) {
                return;
      }

      const blob = new Blob(chunks, { type: "video/webm" });
      setVideoBlob(blob);
      const url = URL.createObjectURL(blob);

      setVideoURL(url);             // Vista previa
      setRecordedChunks(chunks);   // Guardamos los chunks para subir
      setRecording(false);         // Desactiva grabación
      setShowPreview(true);        // Mostrar vista previa
      setButtonsDisabled(true);    // ✅ Now using the correct state setter
    };

    recorder.start();
    setMediaRecorder(recorder);
    setRecording(true);
      };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
          }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  const deleteRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setVideoURL(null);
    setRecordedChunks([]);
    setMediaRecorder(null);
    setRecording(false);
    setRecordingTime(0);
    setButtonsDisabled(false); // ✅ Re-enable buttons when deleting
    setShowPreview(false);     // ✅ Hide preview when deleting
      };

  const switchCamera = () => {
    const currentIndex = devices.findIndex(device => device.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setSelectedDeviceId(devices[nextIndex].deviceId);
  };

  const uploadStory = async () => {
    if (!videoBlob) {
      alert("No hay video para subir. Por favor, graba un video primero.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", videoBlob, "recorded-video.webm");
      formData.append("source_type", "record");
      
      const response = await instance.post("/api/stories", formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000, // 60 segundos de timeout para archivos grandes
      });
      
      if (response.status === 201) {
        alert("¡Historia subida correctamente! Está esperando aprobación.");
        deleteRecording();
      }
    } catch (error) {
      console.error("Error al subir historia:", error);
      
      // Manejo de errores más detallado
      if (error.response) {
        // El servidor respondió con un código de error
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 403) {
          if (data.error === 'No autenticado' || data.message === 'No autorizado') {
            alert("Error de autenticación. Por favor, inicia sesión nuevamente.");
          } else {
            alert("No tienes permiso para subir historias. Solo los modelos pueden subir historias.");
          }
        } else if (status === 422) {
          // Errores de validación
          if (data.errors) {
            const errorMessages = Object.values(data.errors).flat();
            alert(`Error de validación:\n${errorMessages.join('\n')}`);
          } else if (data.message) {
            alert(data.message);
          } else if (data.error_type === 'pending_story') {
            alert("Ya tienes una historia esperando aprobación. Debes esperar a que sea procesada antes de subir otra.");
          } else if (data.error_type === 'active_story') {
            alert(data.message || "Ya tienes una historia activa. Debes esperar antes de subir otra.");
          } else {
            alert("Error al validar el archivo. Verifica que sea un video válido (MP4 o WEBM) de máximo 15 segundos.");
          }
        } else if (status === 413) {
          alert("El archivo es demasiado grande. Por favor, intenta con un video más corto o de menor calidad.");
        } else if (status === 500) {
          alert("Error interno del servidor. Por favor, intenta nuevamente más tarde.");
        } else {
          alert(`Error al subir el video (${status}). ${data.message || 'Inténtalo de nuevo.'}`);
        }
      } else if (error.request) {
        // La petición se hizo pero no hubo respuesta
        if (error.code === 'ECONNABORTED') {
          alert("La subida está tardando demasiado. Verifica tu conexión a internet e intenta nuevamente.");
        } else {
          alert("No se pudo conectar con el servidor. Verifica tu conexión a internet.");
        }
      } else {
        // Error al configurar la petición
        alert("Error al preparar la subida. Por favor, intenta nuevamente.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50">
      {/* Header con decoración */}
      <div className="relative pt-8 pb-6">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-pink-200/30 to-purple-200/30 blur-3xl"></div>
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-pink-500" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Crea tu Historia
            </h1>
            <Heart className="w-7 h-7 text-pink-400 fill-pink-400" />
          </div>
          <p className="text-gray-600 font-medium">Grábate radiante y comparte tu momento especial</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-8">
        {/* Selector de cámara elegante */}
        {devices.length > 1 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-pink-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-pink-500" />
              Selecciona tu cámara
            </label>
            <select
              value={selectedDeviceId || ""}
              onChange={e => setSelectedDeviceId(e.target.value)}
              className="w-full p-3 bg-white border-2 border-pink-200 rounded-xl text-gray-700 focus:border-pink-400 focus:outline-none transition-colors"
            >
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Cámara ${device.deviceId}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Área de video principal */}
        <div className="relative">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border border-pink-100">
            <div className="relative aspect-[9/16] bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl overflow-hidden shadow-inner">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                className={`w-full h-full object-cover ${isFlipped ? 'scale-x-[-1]' : ''}`}
              />
              
              {/* Overlay de grabación */}
              {recording && (
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-3 py-2 rounded-full">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold">REC</span>
                  </div>
                  <div className="bg-black/50 backdrop-blur-sm text-white px-3 py-2 rounded-full">
                    <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
                  </div>
                </div>
              )}

              {/* Botón cambiar cámara */}
              {devices.length > 1 && (
                <button
                  onClick={switchCamera}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                  disabled={recording}
                >
                  <RotateCcw className="w-5 h-5 text-gray-700" />
                </button>
              )}
            </div>

            {/* Controles de grabación */}
            <div className="flex items-center justify-center gap-6 mt-6">
              {!recording && !videoURL && (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-200 active:scale-95"
                >
                  <Video className="w-7 h-7 text-white" />
                </button>
              )}

              {recording && (
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-200 active:scale-95"
                >
                  <Square className="w-6 h-6 text-white fill-white" />
                </button>
              )}

              {!recording && videoURL && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={startRecording}
                    className="w-14 h-14 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-200"
                  >
                    <Video className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={deleteRecording}
                    className="w-12 h-12 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-200"
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vista previa del video grabado */}
        {videoURL && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border border-pink-100">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-pink-500" />
              <h3 className="text-lg font-semibold text-gray-800">Tu historia está lista</h3>
            </div>
            <div className="aspect-[9/16] bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl overflow-hidden">
              <video 
                src={videoURL} 
                controls 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 mb-3">¡Perfecta! Tu historia se ve increíble</p>
              <button 
              onClick={uploadStory}
              className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-200"
              >
                Compartir Historia
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Decoración de fondo */}
      <div className="fixed top-20 left-10 w-32 h-32 bg-pink-200/20 rounded-full blur-3xl"></div>
      <div className="fixed bottom-20 right-10 w-40 h-40 bg-purple-200/20 rounded-full blur-3xl"></div>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-200/10 rounded-full blur-3xl -z-10"></div>
    </div>
  );
}