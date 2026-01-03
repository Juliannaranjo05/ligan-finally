import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./headercliente";
import { useTranslation } from "react-i18next";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

import { useSearching } from '../../contexts/SearchingContext.jsx';
import { useSessionValidation } from '../hooks/useSessionValidation';

export default function PreCallLobbyClient() {
  // 🔥 VALIDACIÓN DE SESIÓN: Solo clientes pueden acceder
  useSessionValidation('cliente');

  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(() => {
    const saved = localStorage.getItem("mirrorMode");
    return saved ? JSON.parse(saved) : true;
  });

  // 🔥 NUEVOS ESTADOS PARA VALIDACIÓN DE PERMISOS
  const [cameraPermission, setCameraPermission] = useState('checking'); // 'checking', 'granted', 'denied', 'error'
  const [micPermission, setMicPermission] = useState('checking');
  const [cameraError, setCameraError] = useState('');
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionRetryCount, setPermissionRetryCount] = useState(0);

  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const isNavigatingRef = useRef(false);
  
  const { startSearching, stopSearching } = useSearching();
  const translationResult = useTranslation();
  // 🔥 Safe fallback for translation function to prevent "t is not defined" errors
  const t = translationResult?.t || ((key) => key);
  const navigate = useNavigate();

  // 🔥 FUNCIÓN PARA VERIFICAR SI PUEDE INICIAR VIDEOLLAMADA
  const canStartVideoCall = () => {
    return cameraPermission === 'granted' && isStreamActive && selectedCamera;
  };

  // 🔥 FUNCIÓN PARA OBTENER MENSAJE DE ESTADO DE PERMISOS
  const getPermissionStatusMessage = () => {
    if (cameraPermission === 'checking') {
      return { text: 'Verificando permisos de cámara...', color: 'text-yellow-400', icon: '🔍' };
    }
    if (cameraPermission === 'denied') {
      return { text: t('preCallLobby.errors.permissionDenied'), color: 'text-red-400', icon: '❌' };
    }
    if (cameraPermission === 'error') {
      return { text: 'Error al acceder a la cámara', color: 'text-red-400', icon: '⚠️' };
    }
    if (cameraPermission === 'granted' && isStreamActive) {
      return { text: t('preCallLobby.status') || 'Lista para empezar', color: 'text-green-400', icon: '✅' };
    }
    if (cameraPermission === 'granted' && !isStreamActive) {
      return { text: t('preCallLobby.actions.preparing'), color: 'text-yellow-400', icon: '⏳' };
    }
    return { text: 'Estado desconocido', color: 'text-gray-400', icon: '❓' };
  };

  // Función para alternar modo espejo
  const toggleMirrorMode = () => {
    const newMirrorMode = !mirrorMode;
    setMirrorMode(newMirrorMode);
    localStorage.setItem("mirrorMode", JSON.stringify(newMirrorMode));
  };

  // 🔥 FUNCIÓN MEJORADA PARA SOLICITAR PERMISOS
  const requestMediaPermissions = async (retryAttempt = 0) => {
    try {
            
      setCameraPermission('checking');
      setMicPermission('checking');
      setCameraError('');

      // Solicitar permisos
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });

            
      setCameraPermission('granted');
      setMicPermission('granted');
      setIsStreamActive(true);
      
      // Detener el stream temporal
      stream.getTracks().forEach(track => track.stop());
      
      // Enumerar dispositivos
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === "videoinput");
      const audioInputs = devices.filter(d => d.kind === "audioinput");
      
      setCameras(videoInputs);
      setMicrophones(audioInputs);
      
      // Seleccionar dispositivos por defecto si no están seleccionados
      if (!selectedCamera && videoInputs.length > 0) {
        setSelectedCamera(videoInputs[0].deviceId);
      }
      if (!selectedMic && audioInputs.length > 0) {
        setSelectedMic(audioInputs[0].deviceId);
      }
      
    } catch (err) {
            
      setIsStreamActive(false);
      
      if (err.name === 'NotAllowedError') {
        setCameraPermission('denied');
        setMicPermission('denied');
        setCameraError('Permisos denegados por el usuario');
        setShowPermissionModal(true);
      } else if (err.name === 'NotFoundError') {
        setCameraPermission('error');
        setCameraError('No se encontraron dispositivos de cámara');
      } else if (err.name === 'NotReadableError') {
        setCameraPermission('error');
        setCameraError('Cámara en uso por otra aplicación');
      } else {
        setCameraPermission('error');
        setCameraError(`Error desconocido: ${err.message}`);
      }
    }
  };

  // 🔥 FUNCIÓN PARA REINTENTAR PERMISOS
  const retryPermissions = async () => {
    setPermissionRetryCount(prev => prev + 1);
    setShowPermissionModal(false);
    await requestMediaPermissions(permissionRetryCount);
  };

  // 🔥 FUNCIÓN MEJORADA PARA INICIAR STREAM
  const startStream = async () => {
    if (!selectedCamera && !selectedMic) return;
    
    try {
      // Detener stream anterior
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      
      const constraints = {};
      
      if (selectedCamera) {
        constraints.video = { 
          deviceId: { exact: selectedCamera },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
      }
      
      if (selectedMic) {
        constraints.audio = { 
          deviceId: { exact: selectedMic },
          echoCancellation: true,
          noiseSuppression: true
        };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      mediaStreamRef.current = stream;
      setIsStreamActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
            
    } catch (err) {
            setIsStreamActive(false);
      
      if (err.name === 'NotAllowedError') {
        setCameraPermission('denied');
        setCameraError('Permisos revocados');
        setShowPermissionModal(true);
      } else {
        setCameraError(`Error al iniciar stream: ${err.message}`);
      }
    }
  };

  // 🔥 MODAL DE PERMISOS
  const PermissionModal = () => {
    if (!showPermissionModal) return null;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-[#1f2125] rounded-xl p-4 sm:p-5 md:p-6 max-w-md w-full border border-[#ff007a]/20">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
              {t('preCallLobby.errors.permissionDenied')}
            </h3>
            
            <div className="text-white/70 mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-sm sm:text-base">
              <p>{t('preCallLobby.notices.permissionsRequired')}</p>
              
              <div className="bg-[#2b2d31] rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm">
                <p className="text-white/50 mb-2">{t('preCallLobby.permissions.howToEnable')}</p>
                <ol className="text-left space-y-1 text-xs">
                  <li>1. {t('preCallLobby.permissions.step1')}</li>
                  <li>2. {t('preCallLobby.permissions.step2')}</li>
                  <li>3. {t('preCallLobby.permissions.step3')}</li>
                </ol>
              </div>
              
              {cameraError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{cameraError}</p>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2 sm:gap-3">
              <button
                onClick={retryPermissions}
                className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200"
              >
                {t('preCallLobby.errors.retryVideoOnly')}
              </button>
              
              <button
                onClick={() => navigate(-1)}
                className="w-full bg-transparent border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-4 sm:px-6 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors"
              >
                Volver Atrás
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 🔥 FUNCIÓN MODIFICADA PARA INICIAR RULETA CON VALIDACIÓN
  const iniciarRuleta = async () => {
    // Verificar si puede iniciar videollamada
    if (!canStartVideoCall()) {
      if (cameraPermission === 'denied') {
        setShowPermissionModal(true);
        return;
      }
      
      if (cameraPermission === 'error') {
        setCameraError('Debes tener una cámara funcionando para continuar');
        return;
      }
      
      // Si los permisos están bien pero no hay stream, intentar iniciarlo
      if (cameraPermission === 'granted' && !isStreamActive) {
        await startStream();
        if (!isStreamActive) return;
      }
    }

        setLoading(true);
    
    try {
      // Detener stream de cámara
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      
      isNavigatingRef.current = true;
      
            navigate(`/usersearch?role=cliente&selectedCamera=${selectedCamera}&selectedMic=${selectedMic}`);
      
    } catch (error) {
            setLoading(false);
      isNavigatingRef.current = false;
    }
  };

  // 🔥 LIMPIAR DATOS DE VIDEOLLAMADA AL MONTAR EL COMPONENTE
  useEffect(() => {
    // Limpiar datos de videollamada para desbloquear navegación
    localStorage.removeItem('roomName');
    localStorage.removeItem('userName');
    localStorage.removeItem('currentRoom');
    localStorage.removeItem('inCall');
    localStorage.removeItem('videochatActive');
    localStorage.removeItem('callToken');
    localStorage.removeItem('sessionTime');
    localStorage.removeItem('sessionStartTime');
    
    // También limpiar sessionStorage
    sessionStorage.removeItem('roomName');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('currentRoom');
    sessionStorage.removeItem('inCall');
    sessionStorage.removeItem('videochatActive');
    sessionStorage.removeItem('callToken');
    
    console.log('🧹 [EsperaCallCliente] Datos de videollamada limpiados');
  }, []);

  // 🔥 USEEFFECTS MODIFICADOS
  useEffect(() => {
    requestMediaPermissions();
  }, []);

  useEffect(() => {
    if (selectedCamera || selectedMic) {
      startStream();
    }
  }, [selectedCamera, selectedMic]);

  useEffect(() => {
    const sendBrowsingHeartbeat = async () => {
      try {
        const authToken = localStorage.getItem('token');
        if (!authToken) return;

        await fetch(`${API_BASE_URL}/api/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            activity_type: 'browsing',
            room: null
          })
        });

              } catch (error) {
              }
    };

    sendBrowsingHeartbeat();
    const interval = setInterval(sendBrowsingHeartbeat, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (!isNavigatingRef.current) {
                if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        stopSearching();
      }
    };
  }, [stopSearching]);

  const permissionStatus = getPermissionStatusMessage();

  return (
    <div className="h-screen overflow-hidden bg-ligand-mix-dark from-[#0a0d10] to-[#131418] text-white flex flex-col">
      <div className="flex-shrink-0 w-full px-2 sm:px-4 pt-2 sm:pt-3">
        <Header />
      </div>
      <div className="flex-1 flex justify-center items-center px-3 sm:px-4 min-h-0 overflow-hidden pb-2">
        <div className="bg-[#1f2125] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col items-center max-w-md sm:max-w-lg w-full justify-center">
          
          {/* Video container con overlay de estado */}
          <div className="w-full aspect-video max-w-[240px] sm:max-w-[280px] md:max-w-[320px] mx-auto rounded-lg sm:rounded-xl overflow-hidden mb-1 sm:mb-1.5 bg-black relative flex-shrink-0 border-2 border-[#ff007a]/20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`object-cover w-full h-full ${mirrorMode ? 'scale-x-[-1]' : ''}`}
            />
            
            {/* Overlay de estado de cámara */}
            {!isStreamActive && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-1.5 sm:p-2 md:p-4">
                <div className="text-2xl sm:text-3xl md:text-4xl mb-1 sm:mb-2">📷</div>
                <p className="text-white/70 text-[10px] sm:text-xs md:text-sm text-center px-1 sm:px-2 md:px-4">
                  {cameraPermission === 'checking' ? t('preCallLobby.actions.preparing') : 
                   cameraPermission === 'denied' ? 'Permisos de cámara denegados' :
                   cameraPermission === 'error' ? 'Error de cámara' :
                   'Cámara no disponible'}
                </p>
                {cameraPermission === 'denied' && (
                  <button
                    onClick={() => setShowPermissionModal(true)}
                    className="mt-1.5 sm:mt-2 md:mt-3 bg-[#ff007a] hover:bg-[#e6006e] text-white px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 rounded-lg text-[10px] sm:text-xs md:text-sm transition-colors"
                  >
                    {t('preCallLobby.errors.permissionDenied')}
                  </button>
                )}
              </div>
            )}
            
            {/* Indicador de estado del espejo */}
            {mirrorMode && isStreamActive && (
              <div className="absolute bottom-1 sm:bottom-1.5 md:bottom-2 left-1 sm:left-1.5 md:left-2 bg-green-500/80 text-white text-[10px] sm:text-xs px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 rounded">
                {t('preCallLobby.mirror.active')}
              </div>
            )}
          </div>

          {/* Título y estado */}
          <div className="text-center mb-1 sm:mb-1.5 w-full flex-shrink-0">
            <h2 className="text-sm sm:text-base font-semibold mb-0.5 sm:mb-1 text-white">
              {t("preCallLobby.title")}
            </h2>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
              canStartVideoCall() ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                canStartVideoCall() ? 'bg-green-400' : 'bg-yellow-400'
              }`} />
              <p className="text-xs font-medium">
                {canStartVideoCall() 
                  ? t("preCallLobby.status")
                  : t("preCallLobby.actions.preparing")
                }
              </p>
            </div>
          </div>

          {/* Controles */}
          <div className="w-full space-y-1 sm:space-y-1.5 flex-shrink-0">
            {/* Selector de cámara */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-white mb-0.5">
                {t("preCallLobby.devices.camera")}
              </label>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="w-full p-1.5 rounded-lg bg-[#2b2d31] border border-[#ff007a]/20 text-white text-xs outline-none focus:border-[#ff007a]/50 focus:ring-2 focus:ring-[#ff007a]/20 transition-all disabled:opacity-50"
                disabled={loading || cameraPermission !== 'granted'}
              >
                <option value="">{t("preCallLobby.deviceSelection.selectCamera")}</option>
                {cameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || t("preCallLobby.devices.defaultCamera", { number: cameras.indexOf(cam) + 1 })}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de micrófono */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-white mb-0.5">
                {t("preCallLobby.devices.microphone")}
              </label>
              <select
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                className="w-full p-1.5 rounded-lg bg-[#2b2d31] border border-[#ff007a]/20 text-white text-xs outline-none focus:border-[#ff007a]/50 focus:ring-2 focus:ring-[#ff007a]/20 transition-all disabled:opacity-50"
                disabled={loading || micPermission !== 'granted'}
              >
                <option value="">{t("preCallLobby.deviceSelection.selectMicrophone")}</option>
                {microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || t("preCallLobby.devices.defaultMicrophone", { number: microphones.indexOf(mic) + 1 })}
                  </option>
                ))}
              </select>
            </div>

            {/* Control de modo espejo */}
            <div className="flex items-center justify-between py-1 flex-shrink-0 bg-[#2b2d31] rounded-lg px-2.5">
              <label className="text-xs font-medium text-white">
                {t("preCallLobby.mirror.label")}
              </label>
              <button
                onClick={toggleMirrorMode}
                disabled={!isStreamActive}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  mirrorMode ? 'bg-[#ff007a]' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                    mirrorMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Error message */}
          {cameraError && cameraPermission !== 'denied' && (
            <div className="w-full mt-1 p-1.5 bg-red-500/10 border border-red-500/20 rounded-lg flex-shrink-0">
              <p className="text-red-400 text-xs text-center">{cameraError}</p>
            </div>
          )}

          {/* Botón principal */}
          <button
            className={`mt-1 w-full px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex-shrink-0 shadow-md ${
              canStartVideoCall() && !loading
                ? 'bg-[#ff007a] hover:bg-[#e6006e] text-white hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }`}
            onClick={iniciarRuleta}
            disabled={!canStartVideoCall() || loading}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-1.5">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>{t("preCallLobby.actions.start")}</span>
              </div>
            ) : !canStartVideoCall() ? (
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-xs">🚫</span>
                <span className="text-xs">
                  {cameraPermission === 'denied' ? 'Permitir Cámara' :
                   cameraPermission === 'error' ? 'Error de Cámara' :
                   t('preCallLobby.actions.preparing')}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>{t("preCallLobby.actions.start")}</span>
              </div>
            )}
          </button>

          {/* Texto informativo */}
          <div className="mt-0.5 text-center text-[10px] text-white/50 px-2 flex-shrink-0">
            <p>{t('preCallLobby.notices.checkDevices')}</p>
          </div>
        </div>
      </div>

      {/* Modal de permisos */}
      <PermissionModal />

      {/* Estilos para scrollbar personalizado */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 0, 122, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 0, 122, 0.5);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 0, 122, 0.3) rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}