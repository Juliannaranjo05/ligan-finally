import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./header";
import { useTranslation } from "react-i18next";
import { useSearching } from '../../contexts/SearchingContext.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PreCallLobbyModelo() {
  const { t, i18n } = useTranslation();
  
  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
    }
  }, []);

  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(() => {
    const saved = localStorage.getItem("mirrorMode");
    return saved ? JSON.parse(saved) : true;
  });
  
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const isNavigatingRef = useRef(false);
  
  const { startSearching, stopSearching } = useSearching();
  const navigate = useNavigate();

  // Función para alternar modo espejo
  const toggleMirrorMode = () => {
    const newMirrorMode = !mirrorMode;
    setMirrorMode(newMirrorMode);
    localStorage.setItem("mirrorMode", JSON.stringify(newMirrorMode));
  };

  useEffect(() => {
    const initDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const audioInputs = devices.filter((d) => d.kind === "audioinput");

        setCameras(videoInputs);
        setMicrophones(audioInputs);

        if (videoInputs[0]) setSelectedCamera(videoInputs[0].deviceId);
        if (audioInputs[0]) setSelectedMic(audioInputs[0].deviceId);
      } catch (err) {
              }
    };

    initDevices();
  }, []);

  useEffect(() => {
    const startStream = async () => {
      // No ejecutar si no tenemos dispositivos seleccionados
      if (!selectedCamera || !selectedMic) return;
      
      // Detener stream anterior si existe
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      try {
                
        // Intentar con un timeout manual más corto
        const streamPromise = navigator.mediaDevices.getUserMedia({
          video: selectedCamera ? 
            { 
              deviceId: { exact: selectedCamera },
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
              frameRate: { ideal: 15, max: 30 }
            } : 
            false,
          audio: selectedMic ? 
            { 
              deviceId: { exact: selectedMic },
              echoCancellation: true,
              noiseSuppression: true
            } : 
            false
        });

        // Timeout manual de 5 segundos
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout manual')), 5000)
        );

        const stream = await Promise.race([streamPromise, timeoutPromise]);
        
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
                  }
      } catch (err) {
                
        // Si hay timeout o error, intentar solo con video
        if (err.name === 'AbortError' || err.name === 'NotReadableError' || err.message === 'Timeout manual') {
                    try {
            const videoOnlyStream = await navigator.mediaDevices.getUserMedia({
              video: selectedCamera ? 
                { deviceId: { exact: selectedCamera } } : 
                { width: 320, height: 240 },
              audio: false
            });
            
            mediaStreamRef.current = videoOnlyStream;
            if (videoRef.current) {
              videoRef.current.srcObject = videoOnlyStream;
                          }
          } catch (videoErr) {
                        alert("No se puede acceder a la cámara. Verifica que no esté siendo usada por otra aplicación.");
          }
        }
      }
    };

    // Solo ejecutar si tenemos ambos dispositivos seleccionados
    if (selectedCamera && selectedMic && cameras.length > 0 && microphones.length > 0) {
      // Agregar un pequeño delay para evitar conflictos
      const timeoutId = setTimeout(startStream, 500);
      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedCamera, selectedMic, cameras.length, microphones.length]);

  useEffect(() => {
    const requestMediaPermissions = async () => {
      try {
                
        // Intentar primero solo con video para evitar conflictos
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 15 } // Framerate más bajo para evitar timeouts
            }, 
            audio: false // Primero solo video
          });
                  } catch (videoErr) {
                    // Fallback a configuración mínima
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 240 }, 
            audio: false 
          });
        }
        
        // Ahora obtener audio por separado
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            video: false, 
            audio: true 
          });
          
          // Combinar streams
          const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...audioStream.getAudioTracks()
          ]);
          
          // Detener streams originales
          stream.getTracks().forEach(track => track.stop());
          audioStream.getTracks().forEach(track => track.stop());
          
          stream = combinedStream;
                  } catch (audioErr) {
                  }
        
                
        // Obtener dispositivos
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === "videoinput");
        const audioInputs = devices.filter(d => d.kind === "audioinput");
        
        setCameras(videoInputs);
        setMicrophones(audioInputs);
        
        // Usar el stream para la vista previa
        if (videoInputs[0]) {
          setSelectedCamera(videoInputs[0].deviceId);
        }
        if (audioInputs[0]) {
          setSelectedMic(audioInputs[0].deviceId);
        }
        
        // Asignar stream al video
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
                  }
        
      } catch (err) {
                if (err.name === 'NotAllowedError') {
          alert(t("permission_alert", "Necesitas permitir el acceso a cámara y micrófono para continuar."));
        } else if (err.name === 'AbortError') {
          alert("Error: La cámara está siendo usada por otra aplicación. Por favor cierra otras aplicaciones que puedan estar usando la cámara (Zoom, Teams, etc.) y recarga la página.");
        }
      }
    };

    requestMediaPermissions();
  }, [t]);

  const iniciarRuleta = async () => {
    setLoading(true);
    isNavigatingRef.current = true;
    
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      navigate(`/usersearch?role=modelo&selectedCamera=${selectedCamera}&selectedMic=${selectedMic}`);
    } catch (error) {
            setLoading(false);
      isNavigatingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      if (!isNavigatingRef.current) {
        stopSearching();
      }
    };
  }, [stopSearching]);

  return (
    <div className="min-h-screen bg-ligand-mix-dark from-[#0a0d10] to-[#131418] text-white">
      <div className="w-full px-6 pt-6">
        <Header />
      </div>

      <div className="flex justify-center items-center px-6 mt-[-30px]">
        <div className="bg-[#1f2125] rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-md w-full">
          <div className="w-full h-60 rounded-xl overflow-hidden mb-4 bg-black relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`object-cover w-full h-full ${mirrorMode ? 'scale-x-[-1]' : ''}`}
            />
            
            {/* Botón de modo espejo */}
            <button
              onClick={toggleMirrorMode}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              title={mirrorMode ? t("mirror.disable", "Desactivar espejo") : t("mirror.enable", "Activar espejo")}
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M12 3v18m0-18l4 4m-4-4L8 7"/>
                <path d="M12 21l4-4m-4 4L8 17"/>
              </svg>
            </button>

            {/* Indicador de estado del espejo */}
            {mirrorMode && (
              <div className="absolute bottom-2 left-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded">
                {t("mirror.active", "Espejo activo")}
              </div>
            )}
          </div>

          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">{t("roulette.titulo")}</h2>
            <p className="text-green-400 text-sm flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              {t("roulette.estado")}
            </p>
          </div>

          <div className="w-full space-y-4">
            <div>
              <label className="text-sm text-white/70">{t("roulette.camera_label")}</label>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-[#2b2d31] text-white outline-none"
                disabled={loading}
              >
                {cameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Cámara ${cameras.indexOf(cam) + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-white/70">{t("roulette.mic_label")}</label>
              <select
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-[#2b2d31] text-white outline-none"
                disabled={loading}
              >
                {microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Micrófono ${microphones.indexOf(mic) + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Control de modo espejo */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/70">
                {t("mirror.label", "Modo espejo")}
              </label>
              <button
                onClick={toggleMirrorMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  mirrorMode ? 'bg-[#ff007a]' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mirrorMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            className="mt-6 w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-6 py-3 rounded-full text-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={iniciarRuleta}
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                {t("searching_user")}
              </div>
            ) : (
              t("roulette.start_button")
            )}
          </button>

          <div className="mt-4 text-center text-xs text-white/50">
            <p>{t('roulette.random_user_notice')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}