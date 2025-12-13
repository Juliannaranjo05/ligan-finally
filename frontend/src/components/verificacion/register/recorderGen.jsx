import React, { useEffect, useRef, useState } from "react";

const VideoRecorder = ({ onRecorded, onCancel }) => {
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [stream, setStream] = useState(null);
  const [time, setTime] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  
  const MAX_RECORDING_TIME = 5; // Límite de 5 segundos

  useEffect(() => {
    if (recording) {
      const id = setInterval(() => {
        setTime((prev) => {
          const newTime = prev + 1;
          // Detener automáticamente cuando llegue a 5 segundos
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
      setIntervalId(id);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [recording]);

  // Efecto para manejar la previsualización automática
  useEffect(() => {
    if (videoUrl && previewRef.current) {
      previewRef.current.src = videoUrl;
      previewRef.current.load(); // Importante: cargar el nuevo video
      previewRef.current.play().catch(error => {
        console.log("Error al reproducir automáticamente:", error);
      });
    }
  }, [videoUrl]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
    } catch (error) {
      console.error("Error al acceder a la cámara:", error);
    }
  };

  const startRecording = () => {
    if (!stream) return;
    
    setVideoUrl(null);
    setVideoBlob(null);
    setTime(0);

    const chunks = [];
    
    // Configurar opciones para MediaRecorder
    const options = {
      mimeType: 'video/webm;codecs=vp9,opus'
    };
    
    // Fallback si no soporta vp9
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8,opus';
    }
    
    // Fallback final
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }
    
    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => chunks.push(e.data);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setVideoBlob(blob);
    };

    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    // Detener el stream de la cámara
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    
    // Limpiar el video de la cámara
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setRecording(false);
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  };

  const restart = async () => {
    // Detener cualquier grabación en curso
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    // Detener el stream anterior si existe
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    
    // Limpiar timer
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    setRecording(false);
    setTime(0);
    
    // Limpiar URL anterior para evitar memory leaks
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    
    setVideoUrl(null);
    setVideoBlob(null);
    
    // Iniciar nueva cámara
    await startCamera();
  };

  const handleClose = () => {
    cleanupResources();
    if (onCancel) {
      onCancel();
    }
  };

  const handleSend = () => {
    if (!videoBlob) return;
    
    // Crear un archivo con el nombre y tipo correcto
    const videoFile = new File([videoBlob], "video.webm", { 
      type: "video/webm" 
    });
    
    // Enviar el archivo de video al componente padre
    if (onRecorded) {
      onRecorded(videoFile);
    }
    
    // Limpiar recursos después de enviar
    cleanupResources();
  };

  const cleanupResources = () => {
    // Detener cualquier grabación en curso
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    // Detener el stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    
    // Limpiar video refs
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Limpiar timer
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    // Limpiar URL para evitar memory leaks
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    
    // Reset estados
    setRecording(false);
    setTime(0);
    setVideoUrl(null);
    setVideoBlob(null);
    setStream(null);
  };

  useEffect(() => {
    startCamera();
    return () => {
      cleanupResources();
    };
  }, []);

  const formatTime = (sec) => {
    const minutes = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (sec % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  // Calcular el progreso para la barra
  const progressPercentage = (time / MAX_RECORDING_TIME) * 100;

  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full gap-4 overflow-hidden relative"
      style={{ maxHeight: "100%"}}
    >
      {/* Botón de cerrar */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-white text-2xl z-10 hover:text-gray-300"
      >
        ✕
      </button>

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl">
        {!videoUrl ? (
          <video
            ref={videoRef}
            className="w-full rounded-2xl"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <video
            ref={previewRef}
            className="w-full rounded-2xl"
            controls
            playsInline
          />
        )}
        {recording && (
          <>
            <div className="absolute top-2 left-2 px-3 py-1 text-white text-sm bg-red-600 rounded-full shadow-lg">
              ⏺ {formatTime(time)} / {formatTime(MAX_RECORDING_TIME)}
            </div>
            {/* Barra de progreso */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="w-full bg-black bg-opacity-50 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </>
        )}
      </div>

      {!recording && !videoUrl && (
        <button
          onClick={startRecording}
          className="bg-[#ff007a] text-white px-6 py-2 rounded-2xl"
        >
          Comenzar grabación (máx. 5 seg)
        </button>
      )}

      {recording && (
        <button
          onClick={stopRecording}
          className="bg-[#ff007a] text-white px-6 py-2 rounded-2xl"
        >
          Finalizar grabación
        </button>
      )}

      {!recording && videoUrl && (
        <div className="flex gap-4">
          <button
            onClick={restart}
            className="bg-[#ff007a] text-white px-4 py-2 rounded-2xl"
          >
            Volver a grabar
          </button>
          <button
            onClick={handleSend}
            className="bg-[#ff007a] text-white px-4 py-2 rounded-2xl"
          >
            Enviar video
          </button>
        </div>
      )}

      {!recording && videoUrl && (
        <p className="text-sm text-white text-center mt-2">
          Asegúrate de que el video sea claro y tu rostro esté visible.
        </p>
      )}
    </div>
  );
};

export default VideoRecorder;