import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./headercliente";
import { useTranslation } from "react-i18next";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

import { useSearching } from '../../contexts/SearchingContext.jsx';

export default function PreCallLobbyClient() {

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
  const { t } = useTranslation();
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
      return { text: 'Cámara lista para videollamada', color: 'text-green-400', icon: '✅' };
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
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1f2125] rounded-xl p-6 max-w-md w-full border border-[#ff007a]/20">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-3">
              {t('preCallLobby.errors.permissionDenied')}
            </h3>
            
            <div className="text-white/70 mb-6 space-y-3">
              <p>{t('preCallLobby.notices.permissionsRequired')}</p>
              
              <div className="bg-[#2b2d31] rounded-lg p-3 text-sm">
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
            
            <div className="flex flex-col gap-3">
              <button
                onClick={retryPermissions}
                className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200"
              >
                {t('preCallLobby.errors.retryVideoOnly')}
              </button>
              
              <button
                onClick={() => navigate(-1)}
                className="w-full bg-transparent border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-6 py-2 rounded-lg font-medium transition-colors"
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
    <div className="min-h-screen bg-ligand-mix-dark from-[#0a0d10] to-[#131418] text-white">
      <div className="w-full px-6 pt-6">
        <Header />
      </div>

      <div className="flex justify-center items-center px-6 mt-[-30px]">
        <div className="bg-[#1f2125] rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-md w-full">
          
          {/* Video container con overlay de estado */}
          <div className="w-full h-60 rounded-xl overflow-hidden mb-4 bg-black relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`object-cover w-full h-full ${mirrorMode ? 'scale-x-[-1]' : ''}`}
            />
            
            {/* Overlay de estado de cámara */}
            {!isStreamActive && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-white/70 text-sm text-center px-4">
                  {cameraPermission === 'checking' ? t('preCallLobby.actions.preparing') : 
                   cameraPermission === 'denied' ? 'Permisos de cámara denegados' :
                   cameraPermission === 'error' ? 'Error de cámara' :
                   'Cámara no disponible'}
                </p>
                {cameraPermission === 'denied' && (
                  <button
                    onClick={() => setShowPermissionModal(true)}
                    className="mt-3 bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    {t('preCallLobby.errors.permissionDenied')}
                  </button>
                )}
              </div>
            )}
            
            {/* Botón de modo espejo */}
            <button
              onClick={toggleMirrorMode}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              title={mirrorMode ? "Desactivar espejo" : "Activar espejo"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18m0-18l4 4m-4-4L8 7"/>
                <path d="M12 21l4-4m-4 4L8 17"/>
              </svg>
            </button>

            {/* Indicador de estado del espejo */}
            {mirrorMode && isStreamActive && (
              <div className="absolute bottom-2 left-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded">
                {t('preCallLobby.mirror.active')}
              </div>
            )}
          </div>

          {/* Estado de permisos */}
          <div className="w-full mb-4">
            <div className={`flex items-center justify-center gap-2 p-3 rounded-lg bg-black/20 ${permissionStatus.color}`}>
              <span>{permissionStatus.icon}</span>
              <span className="text-sm font-medium">{permissionStatus.text}</span>
            </div>
          </div>

          {/* Título y estado */}
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">
              {t("preCallLobby.title")}
            </h2>
            <p className={`text-sm flex items-center justify-center gap-2 ${
              canStartVideoCall() ? 'text-green-400' : 'text-yellow-400'
            }`}>
              <span className={`w-2 h-2 rounded-full inline-block ${
                canStartVideoCall() ? 'bg-green-400' : 'bg-yellow-400'
              }`} />
              {canStartVideoCall() 
                ? t("preCallLobby.status")
                : t("preCallLobby.actions.preparing")
              }
            </p>
          </div>

          {/* Controles */}
          <div className="w-full space-y-4">
            {/* Selector de cámara */}
            <div>
              <label className="text-sm text-white/70">
                {t("preCallLobby.devices.camera")}
              </label>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-[#2b2d31] text-white outline-none disabled:opacity-50"
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
            <div>
              <label className="text-sm text-white/70">
                {t("preCallLobby.devices.microphone")}
              </label>
              <select
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg bg-[#2b2d31] text-white outline-none disabled:opacity-50"
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
            <div className="flex items-center justify-between py-2">
              <label className="text-sm text-white/70">
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
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mirrorMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Error message */}
          {cameraError && cameraPermission !== 'denied' && (
            <div className="w-full mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm text-center">{cameraError}</p>
            </div>
          )}

          {/* Botón principal */}
          <button
            className={`mt-6 w-full px-6 py-3 rounded-full text-lg font-semibold transition-all duration-200 ${
              canStartVideoCall() && !loading
                ? 'bg-[#ff007a] hover:bg-[#e6006e] text-white'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }`}
            onClick={iniciarRuleta}
            disabled={!canStartVideoCall() || loading}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                {t("preCallLobby.actions.start")}
              </div>
            ) : !canStartVideoCall() ? (
              <div className="flex items-center justify-center gap-2">
                <span>🚫</span>
                {cameraPermission === 'denied' ? 'Permitir Cámara' :
                 cameraPermission === 'error' ? 'Error de Cámara' :
                 t('preCallLobby.actions.preparing')}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>🎥</span>
                {t("preCallLobby.actions.start")}
              </div>
            )}
          </button>

          {/* Texto informativo */}
          <div className="mt-4 text-center text-xs text-white/50">
            <p>{t('preCallLobby.notices.checkDevices')}</p>
          </div>
        </div>
      </div>

      {/* Modal de permisos */}
      <PermissionModal />
    </div>
  );
}