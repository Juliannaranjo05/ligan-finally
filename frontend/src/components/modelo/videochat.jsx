  // VideoChat.jsx - Componente Principal Mejorado COMPLETO
  import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
  import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
  import { useTranslation } from 'react-i18next';
  import {
    LiveKitRoom,
    RoomAudioRenderer,
    useParticipants,
    useLocalParticipant,
    useRoomContext
  } from "@livekit/components-react";
  import "@livekit/components-styles";

  // Componentes modularizados
  import Header from "./header";
  import VideoDisplayImproved from "./components/VideoDisplayImproved";
  import FloatingMessagesImproved from "./components/FloatingMessagesImproved";
  import DesktopChatPanel from "./components/DesktopChatPanel";
  import MobileControlsImproved from "./components/MobileControlsImproved";
  import DesktopControlsImproved from "./components/DesktopControlsImproved";
  import TimeDisplayImproved from "./components/TimeDisplayImproved";
  import NotificationSystemImproved from "./components/NotificationSystemImproved.jsx";
  import DisconnectionScreenImproved from "./components/DisconnectionScreenImproved";
  import MediaControlsImproved from "./components/MediaControlsImproved";
  import { useGlobalTranslation } from '../../contexts/GlobalTranslationContext.jsx';

  // Componentes originales necesarios
  import SimpleChat from "../messages.jsx";
  import { useVideoChatGifts } from '../../components/GiftSystem/useVideoChatGifts';
  import { GiftsModal } from '../../components/GiftSystem/giftModal.jsx';
  import {
    useTranslation as useCustomTranslation,
    TranslationSettings,
    TranslatedMessage
  } from '../../utils/translationSystem.jsx';
  import CameraAudioSettings from './utils/cameraaudiosettings.jsx';  

  // Utilities y contextos
  import { getUser } from "../../utils/auth";
  import { useSessionCleanup } from '../closesession.jsx';
  import { useSearching } from '../../contexts/SearchingContext';


  // Configuraciones
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const USER_CACHE = new Map();

  // Agregar antes del componente principal
  const RoomCapture = ({ onRoomReady }) => {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    
    useEffect(() => {
      if (room && localParticipant) {
        onRoomReady(room);
      }
    }, [room, localParticipant, onRoomReady]);
    
    return null;
  };

  // Función para generar clave única de la sala
  const getRoomCacheKey = (roomName, currentUserName) => {
    return `${roomName}_${currentUserName}`;
  };

  // 🔥 FUNCIONES PARA ESPEJO
  const applyMirrorToAllVideos = (shouldMirror) => {
    
    const selectors = [
      '[data-lk-participant-video]',
      'video[data-participant="local"]',
      '.lk-participant-tile video',
      '.lk-video-track video',
      'video[autoplay][muted]',
      'video[class*="object-cover"]',
      '.VideoTrack video',
      '[class*="VideoDisplay"] video'
    ];
    
    selectors.forEach(selector => {
      const videos = document.querySelectorAll(selector);
      videos.forEach(video => {
        if (video && video.style) {
          video.style.transform = shouldMirror ? 'scaleX(-1)' : 'scaleX(1)';
          video.style.webkitTransform = shouldMirror ? 'scaleX(-1)' : 'scaleX(1)';
          
          if (shouldMirror) {
            video.classList.add('mirror-video');
            video.classList.remove('normal-video');
          } else {
            video.classList.add('normal-video');
            video.classList.remove('mirror-video');
          }
        }
      });
    });
  };

  let mirrorObserver = null;

  const setupMirrorObserver = (shouldMirror) => {
    if (mirrorObserver) {
      mirrorObserver.disconnect();
    }
    
    mirrorObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.tagName === 'VIDEO') {
              node.style.transform = shouldMirror ? 'scaleX(-1)' : 'scaleX(1)';
              node.style.webkitTransform = shouldMirror ? 'scaleX(-1)' : 'scaleX(1)';
            }
            
            const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
            videos.forEach(video => {
              video.style.transform = shouldMirror ? 'scaleX(-1)' : 'scaleX(1)';
              video.style.webkitTransform = shouldMirror ? 'scaleX(-1)' : 'scaleX(1)';
            });
          }
        });
      });
    });
    
    mirrorObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // 🔥 COMPONENTE PRINCIPAL CON ESTRUCTURA MODULAR
  export default function VideoChat() {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();
    
    // 🔥 HOOKS Y CONTEXTOS
    const { startSearching, stopSearching, forceStopSearching } = useSearching();
    const { finalizarSesion, limpiarDatosSession } = useSessionCleanup();
    
    // 🔥 PARÁMETROS DE LA SALA
    const modelo = location.state?.modelo;
    const getParam = (key) => {
      const stateValue = location.state?.[key];
      const sessionValue = localStorage.getItem(key);
      const urlValue = searchParams.get(key);
      return stateValue || sessionValue || urlValue;
    };

    const roomName = getParam("roomName");
    const userName = getParam("userName");
    const selectedCamera = location.state?.selectedCamera;
    const selectedMic = location.state?.selectedMic;

    // 🔥 ESTADOS PRINCIPALES
    const [userData, setUserData] = useState({
      name: "",
      role: "",
      id: null,
    });

    const [otherUser, setOtherUser] = useState(() => {
      if (!roomName || !userName) return null;
      const cacheKey = getRoomCacheKey(roomName, userName);
      const cached = USER_CACHE.get(cacheKey);
      return cached || null;
    });

    // Estados de conexión
    const [token, setToken] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [connected, setConnected] = useState(false);
    const [room, setRoom] = useState(null);
    const [modeloStoppedWorking, setModeloStoppedWorking] = useState(false);
    const [receivedNotification, setReceivedNotification] = useState(false);
    const [isProcessingLeave, setIsProcessingLeave] = useState(false);

    // Estados de controles
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [camaraPrincipal, setCamaraPrincipal] = useState("remote");
    const [volumeEnabled, setVolumeEnabled] = useState(() => {
      // Para modelos: siempre true (no controlan volumen)
      // Para usuarios: true por defecto
      return true; // Siempre empezar en true
    });
    const [cameras, setCameras] = useState([]);
    const [microphones, setMicrophones] = useState([]);
    const [selectedCameraDevice, setSelectedCameraDevice] = useState('');
    const [selectedMicrophoneDevice, setSelectedMicrophoneDevice] = useState('');
    const [isLoadingDevices, setIsLoadingDevices] = useState(false);

    // Estados de UI
    const [tiempo, setTiempo] = useState(0);
    const [tiempoReal, setTiempoReal] = useState(0);
    const tiempoInicioRef = useRef(null);
    const tiempoGuardadoRef = useRef(0);
    const tiempoIntervalRef = useRef(null);

    // Estados de mensajes
    const [messages, setMessages] = useState([]);
    const [mensaje, setMensaje] = useState("");
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [mainCamera, setMainCamera] = useState();


    // Estados de desconexión
    const [clientDisconnected, setClientDisconnected] = useState(false);
    const [clientWentNext, setClientWentNext] = useState(false);
    const [disconnectionReason, setDisconnectionReason] = useState('');
    const [disconnectionType, setDisconnectionType] = useState('');
    const [redirectCountdown, setRedirectCountdown] = useState(0);


    const { translateGlobalText, isEnabled: translationEnabled } = useGlobalTranslation();


    // Estados de detección
    const [isDetectingUser, setIsDetectingUser] = useState(() => {
      if (!roomName || !userName) return false;
      const cacheKey = getRoomCacheKey(roomName, userName);
      const hasCache = USER_CACHE.has(cacheKey);
      return !hasCache;
    });

    // Estados de configuración
    const [showSettings, setShowSettings] = useState(false);
    const [showTranslationSettings, setShowTranslationSettings] = useState(false);
    const [showMainSettings, setShowMainSettings] = useState(false);
    const [showCameraAudioModal, setShowCameraAudioModal] = useState(false);
    const [showGiftsModal, setShowGiftsModal] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    const [isAddingFavorite, setIsAddingFavorite] = useState(false);
    const [showClientBalance, setShowClientBalance] = useState(true);
    const [mostrarRegalos, setMostrarRegalos] = useState(false);
    const [showSidePanel, setShowSidePanel] = useState(false);
    const handleRoomReady = (roomInstance) => {
      setRoom(roomInstance);
      setConnected(true);
      
      // 🔥 IMPORTANTE: Guardar room globalmente para el sistema de auto-siguiente
      window.livekitRoom = roomInstance;
          };
    const [showGiftNotification, setShowGiftNotification] = useState(false);
    const [processingGift, setProcessingGift] = useState(null);
    const [availableGifts, setAvailableGifts] = useState([]);

    // Estados de notificaciones
    const [notifications, setNotifications] = useState([]);

    // Estados de espejo
    const [mirrorMode, setMirrorMode] = useState(() => {
      const saved = localStorage.getItem("mirrorMode");
      return saved ? JSON.parse(saved) : true;
    });

    // Chat functions
    const [chatFunctions, setChatFunctions] = useState(null);
    const messagesContainerRef = useRef(null);

    // Sistema de traducción
    const {
      settings: translationSettings = { enabled: false },
      setSettings: setTranslationSettings,
      translateMessage,
      clearProcessedMessages,
      languages = {}
    } = useCustomTranslation() || {};

    // Sistema de regalos
    const {
      gifts,
      pendingRequests,
      userBalance,
      loading: giftLoading,
      requestGift,        // ✅ PARA PEDIR REGALOS
      acceptGift,         // ✅ PARA RECIBIR REGALOS  
      rejectGift,         // ✅ PARA RECHAZAR REGALOS
      loadGifts,
      loadUserBalance,
      setPendingRequests
    } = useVideoChatGifts(
      roomName,
      { id: userData.id, role: userData.role, name: userData.name },
      otherUser ? { id: otherUser.id, name: otherUser.name } : null
    );


const processSessionEarnings = async (durationSeconds, endedBy = 'user') => {


  // PASO 3: Verificar condiciones básicas
    
  const checks = {
    hasRoomName: !!roomName,
    hasOtherUserId: !!otherUser?.id,
    hasUserDataId: !!userData?.id,
    validDuration: durationSeconds > 0
  };
  
    
  const allChecksPass = Object.values(checks).every(check => check === true);
  
  if (!allChecksPass) {
            return { success: false, error: 'Condiciones básicas no cumplidas' };
  }

  
  try {
    // PASO 4: Verificar token
        const authToken = localStorage.getItem('token');
    
    if (!authToken) {
            return { success: false, error: 'No hay token' };
    }
    
    
    // PASO 5: Determinar roles correctamente
        
    let modeloId, clienteId, modeloName, clienteName;
    
        
    if (userData.role === 'modelo') {
      modeloId = userData.id;
      modeloName = userData.name;
      clienteId = otherUser.id;
      clienteName = otherUser.name;
          } else {
      // Esto no debería pasar en VideoChat modelo, pero por seguridad
      modeloId = otherUser.id;
      modeloName = otherUser.name;
      clienteId = userData.id;
      clienteName = userData.name;
          }


    // PASO 6: Crear payload
        
    const requestPayload = {
      room_name: roomName,
      duration_seconds: durationSeconds,
      modelo_user_id: modeloId,
      cliente_user_id: clienteId,
      session_type: 'video_chat',
      ended_by: endedBy
    };

    
    // PASO 7: Verificar URL
    const url = `${API_BASE_URL}/api/earnings/process-session`;
    
    // PASO 8: Enviar request
        
    const startTime = Date.now();
    
    const earningsResponse = await Promise.race([
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestPayload)
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout después de 10 segundos')), 10000))
    ]);
    
    const responseTime = Date.now() - startTime;
    
    // PASO 9: Analizar response
                
    // PASO 10: Leer contenido
        
    let responseText = '';
    try {
      responseText = await earningsResponse.text();
          } catch (textError) {
            return { success: false, error: 'Error leyendo response' };
    }

    // PASO 11: Parsear JSON
        
    let responseData = null;
    try {
      if (responseText.trim()) {
        responseData = JSON.parse(responseText);
              } else {
        console.warn('⚠️ [STEP 11] Response text está vacío');
        return { success: false, error: 'Response vacío' };
      }
    } catch (parseError) {
                  return { success: false, error: 'Error parseando JSON' };
    }

    // PASO 12: Verificar status HTTP
    if (!earningsResponse.ok) {

      if (earningsResponse.status === 400) {
              } else if (earningsResponse.status === 404) {
              } else if (earningsResponse.status === 401) {
              } else if (earningsResponse.status === 500) {
              }

      return { 
        success: false, 
        error: `HTTP ${earningsResponse.status}: ${responseData?.error || 'Error desconocido'}` 
      };
    }

    // PASO 13: Verificar respuesta exitosa
        
    if (responseData && responseData.success) {
            
      if (responseData.model_earnings && responseData.model_earnings > 0) {
        const minutes = Math.floor(durationSeconds / 60);
                
        return {
          success: true,
          model_earnings: responseData.model_earnings,
          duration_minutes: minutes,
          modelo_id: modeloId,
          cliente_id: clienteId
        };
      } else {
        console.warn('⚠️ [STEP 13] Success pero sin ganancias:', responseData);
        return { success: true, model_earnings: 0, message: 'Sin ganancias registradas' };
      }
    } else {
            return { 
        success: false, 
        error: responseData?.error || 'Respuesta sin success' 
      };
    }
    
  } catch (error) {
    return { 
      success: false, 
      error: `Error de conexión: ${error.message}` 
    };
  }
};

    // 🔥 SISTEMA DE NOTIFICACIONES MEJORADO
    const addNotification = useCallback((type, title, message, duration = 5000) => {
      const id = Date.now();
      const notification = {
        id,
        type, // 'success', 'error', 'warning', 'info'
        title,
        message,
        timestamp: Date.now(),
        duration
      };
      
      setNotifications(prev => [...prev, notification]);
      
      // Auto-remove después del duration
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
      
      return id;
    }, []);

    const removeNotification = useCallback((id) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // 🔥 FUNCIONES DE TIEMPO MEJORADAS
    const formatoTiempo = () => {
      const minutos = Math.floor(tiempoReal / 60).toString().padStart(2, "0");
      const segundos = (tiempoReal % 60).toString().padStart(2, "0");
      return `${minutos}:${segundos}`;
    };

    const iniciarTiempoReal = () => {
            if (tiempoIntervalRef.current) {
        clearInterval(tiempoIntervalRef.current);
        tiempoIntervalRef.current = null;
      }
      tiempoInicioRef.current = Date.now();
      setTiempoReal(0);
      
      tiempoIntervalRef.current = setInterval(() => {
        const tiempoTranscurrido = Math.floor((Date.now() - tiempoInicioRef.current) / 1000);
        setTiempoReal(tiempoTranscurrido);
      }, 1000);
    };

    const detenerTiempoReal = () => {
      if (tiempoIntervalRef.current) {
        clearInterval(tiempoIntervalRef.current);
        tiempoIntervalRef.current = null;
        
        const tiempoFinal = tiempoInicioRef.current ?
          Math.floor((Date.now() - tiempoInicioRef.current) / 1000) : tiempoReal;
        
        if (tiempoFinal <= 0) {
          const tiempoSeguro = Math.max(tiempoReal, 30);
          setTiempoReal(tiempoSeguro);
          return tiempoSeguro;
        }
        
        setTiempoReal(tiempoFinal);
        return tiempoFinal;
      }
      
      const tiempoActual = Math.max(tiempoReal, 30);
      return tiempoActual;
    };
   


    const enviarTiempoReal = async (sessionId, tiempoEspecifico = null) => {
          let tiempoAEnviar;
          
          if (tiempoEspecifico !== null) {
            tiempoAEnviar = tiempoEspecifico;
          } else if (tiempoInicioRef.current) {
            tiempoAEnviar = Math.floor((Date.now() - tiempoInicioRef.current) / 1000);
          } else {
            tiempoAEnviar = tiempoReal;
          }
          
          if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
                        return;
          }
          
          if (tiempoAEnviar <= 0) {
                        return;
          }

    

          try {
            const token = localStorage.getItem('token');
            if (!token) {
                            return;
            }

            const requestBody = {
              session_id: sessionId,
              duration_seconds: tiempoAEnviar
            };

            const response = await fetch(`${API_BASE_URL}/api/earnings/update-duration`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
              const errorText = await response.text();
                            return;
            }

            const data = await response.json();
            
            if (data.success) {
                                        } else {
                          }
          } catch (error) {
                      }
    };
        

      // 🔥 FUNCIONES DE CACHE MEJORADAS
      const updateOtherUser = (user) => {
        if (!user || !roomName || !userName) return;

        if (user.id === userData.id || user.name === userData.name) {
                    return;
        }
      
                
                
        const cacheKey = getRoomCacheKey(roomName, userName);
        USER_CACHE.set(cacheKey, user);
        setOtherUser(user);
        setIsDetectingUser(false);
        checkIfFavorite(user.id);
        
        // 🔥 LIMPIAR MENSAJES LEGACY AL ACTIVAR HÍBRIDO
        if (messages.length > 0) {
                    setMessages([]);
        }
      };

      const clearUserCache = () => {
      if (!roomName || !userName) return;
      const cacheKey = getRoomCacheKey(roomName, userName);
      USER_CACHE.delete(cacheKey);
      setOtherUser(null);
      setIsDetectingUser(true);
      
      // 🔥 LIMPIAR TAMBIÉN MENSAJES HÍBRIDOS Y LEGACY
      setMessages([]);
      // Los mensajes híbridos se limpiarán automáticamente en el hook
      };

      // 7. EFECTO PARA LIMPIAR MENSAJES CUANDO CAMBIA LA SALA
      useEffect(() => {
        // 🔥 LIMPIAR MENSAJES AL CAMBIAR DE SALA
        setMessages([]);
        setMensaje("");
        
        // Resetear flags de duplicación en HybridChat
        if (window.hybridChatAPI) {
          // El HybridChat se reiniciará automáticamente
        }
      }, [roomName]);

      // 🔥 FUNCIONES DE CONTROL MEJORADAS
      const cambiarCamara = () => {
        setCamaraPrincipal(prev => prev === "remote" ? "local" : "remote");
      };

      const toggleMirrorMode = useCallback(() => {
        const newMirrorMode = !mirrorMode;
        setMirrorMode(newMirrorMode);
        localStorage.setItem("mirrorMode", JSON.stringify(newMirrorMode));
        
        applyMirrorToAllVideos(newMirrorMode);
        setupMirrorObserver(newMirrorMode);
        
              }, [mirrorMode]);

      const forceApplyMirror = useCallback(() => {
                applyMirrorToAllVideos(mirrorMode);
        setupMirrorObserver(mirrorMode);
      }, [mirrorMode]);

    const enviarMensaje = async () => {
      if (mensaje.trim() && !isSendingMessage) {
        setIsSendingMessage(true);
        const messageToSend = mensaje.trim();
        
        if (chatFunctions?.sendMessage) {
          const success = chatFunctions.sendMessage(messageToSend);
          
          if (success) {
            const nuevoMensaje = {
              id: Date.now(),
              type: 'local',
              text: messageToSend,
              timestamp: Date.now(),
              isOld: false,
              sender: userData.name,
              senderRole: userData.role
            };
            
            setMessages(prev => [nuevoMensaje, ...prev]);
            setMensaje("");
          }
        }
        
        setIsSendingMessage(false);
      }
    };

    const loadDevices = async () => {
    setIsLoadingDevices(true);
    try {
            
      // Solicitar permisos primero
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Obtener lista de dispositivos
      const devices = await navigator.mediaDevices.enumerateDevices();
            
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      setCameras(videoDevices);
      setMicrophones(audioDevices);
      
                  
      // Establecer dispositivos seleccionados actuales
      if (videoDevices.length > 0 && !selectedCameraDevice) {
        const defaultCamera = selectedCamera || videoDevices[0].deviceId;
        setSelectedCameraDevice(defaultCamera);
              }
      
      if (audioDevices.length > 0 && !selectedMicrophoneDevice) {
        const defaultMic = selectedMic || audioDevices[0].deviceId;
        setSelectedMicrophoneDevice(defaultMic);
              }
      
      // Cerrar el stream temporal
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
            addNotification('error', 'Error', 'No se pudieron obtener los dispositivos de audio/video');
    } finally {
      setIsLoadingDevices(false);
    }
    }

    const handleCameraChange = (deviceId) => {
            
      // Solo actualizar el estado, el cambio real lo hace el useEffect
      setSelectedCameraDevice(deviceId);
    };

    // 2️⃣ REEMPLAZAR handleMicrophoneChange - VERSION SINCRONIZADA  
    const handleMicrophoneChange = (deviceId) => {
            
      // Solo actualizar el estado, el cambio real lo hace el useEffect
      setSelectedMicrophoneDevice(deviceId);
    };

    // 3️⃣ AGREGAR useEffect PARA CAMBIO REAL DE CÁMARA
    useEffect(() => {
      if (!selectedCameraDevice || !room?.localParticipant || !cameraEnabled) {
                return;
      }

      const changeCameraDevice = async () => {
        try {
                    
          const localParticipant = room.localParticipant;
          
          // Detener cámara actual
          const currentVideoTrack = localParticipant.getTrackPublication('camera')?.track;
          if (currentVideoTrack) {
                        currentVideoTrack.stop();
            await localParticipant.unpublishTrack(currentVideoTrack);
          }

          // Crear nueva cámara
                    const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: selectedCameraDevice },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });

          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
                        await localParticipant.publishTrack(videoTrack, {
              name: 'camera',
              source: 'camera'
            });
            
                        addNotification('success', 'Cámara Cambiada', 'Dispositivo actualizado');
            
            // Re-aplicar espejo
            setTimeout(() => {
                            applyMirrorToAllVideos(mirrorMode);
            }, 1000);
          }
        } catch (error) {
                    addNotification('error', 'Error', `Error: ${error.message}`);
        }
      };

      // Pequeño delay para evitar llamadas muy rápidas
      const timer = setTimeout(changeCameraDevice, 200);
      return () => clearTimeout(timer);

    }, [selectedCameraDevice, room, cameraEnabled, mirrorMode]); // ← DEPENDENCIAS

    // 4️⃣ AGREGAR useEffect PARA CAMBIO REAL DE MICRÓFONO
    useEffect(() => {
      if (!selectedMicrophoneDevice || !room?.localParticipant || !micEnabled) {
                return;
      }

      const changeMicrophoneDevice = async () => {
        try {
                    
          const localParticipant = room.localParticipant;
          
          // Detener micrófono actual
          const currentAudioTrack = localParticipant.getTrackPublication('microphone')?.track;
          if (currentAudioTrack) {
                        currentAudioTrack.stop();
            await localParticipant.unpublishTrack(currentAudioTrack);
          }

          // Crear nuevo micrófono
                    const stream = await navigator.mediaDevices.getUserMedia({
            audio: { 
              deviceId: { exact: selectedMicrophoneDevice },
              echoCancellation: true,
              noiseSuppression: true
            }
          });

          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
                        await localParticipant.publishTrack(audioTrack, {
              name: 'microphone',
              source: 'microphone'
            });
            
                        addNotification('success', 'Micrófono Cambiado', 'Dispositivo actualizado');
          }
        } catch (error) {
                    addNotification('error', 'Error', `Error: ${error.message}`);
        }
      };

      // Pequeño delay para evitar llamadas muy rápidas
      const timer = setTimeout(changeMicrophoneDevice, 200);
      return () => clearTimeout(timer);

    }, [selectedMicrophoneDevice, room, micEnabled]); // ← DEPENDENCIAS

    // 4️⃣ EFECTO PARA CARGAR DISPOSITIVOS INICIALMENTE (agregar después de otros useEffect)
    useEffect(() => {
      // Cargar dispositivos cuando el componente se monta
      loadDevices();
      
      // Listener para detectar cambios en dispositivos
      const handleDeviceChange = () => {
                setTimeout(() => loadDevices(), 1000);
      };
      
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }, []);

    // 5️⃣ EFECTO PARA CONFIGURAR ROOM INSTANCE (agregar después del efecto anterior)
    useEffect(() => {
      // Listener global para establecer la instancia de room
      const handleRoomReady = (event) => {
        if (event.detail && event.detail.room) {
                    setRoom(event.detail.room);
        }
      };
      
      // Escuchar evento personalizado
      window.addEventListener('livekitRoomReady', handleRoomReady);
      
      // También verificar si ya existe globalmente
      if (window.livekitRoom && !room) {
                setRoom(window.livekitRoom);
      }
      
      return () => {
        window.removeEventListener('livekitRoomReady', handleRoomReady);
      };
    }, [room]);

    // 6️⃣ EFECTO PARA APLICAR CONFIGURACIONES CUANDO CAMBIA LA ROOM (agregar después del efecto anterior)
    useEffect(() => {
      if (room && connected) {
                
        // Pequeño delay para asegurar que todo esté listo
        setTimeout(() => {
          // Re-aplicar dispositivos seleccionados
          if (selectedCameraDevice && cameraEnabled) {
            handleCameraChange(selectedCameraDevice);
          }
          
          if (selectedMicrophoneDevice && micEnabled) {
            handleMicrophoneChange(selectedMicrophoneDevice);
          }
          
          // Re-aplicar modo espejo
          applyMirrorToAllVideos(mirrorMode);
        }, 2000);
      }
    }, [room, connected]);


    useEffect(() => {
      // Cargar mensajes cuando se conecte a la sala
      if (roomName && connected) {
        const loadMessages = async () => {
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/chat/messages/${roomName}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.messages) {
                const formattedMessages = data.messages.map(msg => {
                  
                  return {
                    id: msg.id,
                    type: msg.type || (msg.user_id === userData?.id ? 'local' : 'remote'), // 🔥 USAR msg.type DE LA BD
                    text: msg.message,
                    timestamp: new Date(msg.created_at).getTime(),
                    sender: msg.user_name,
                    senderRole: msg.user_role,
                    isOld: true,
                    // 🔥 PRESERVAR DATOS DE REGALO DE LA BD
                    ...(msg.gift_data && { gift_data: msg.gift_data }),
                    ...(msg.extra_data && { extra_data: msg.extra_data })
                  };
                }).sort((a, b) => b.timestamp - a.timestamp);
                
                setMessages(formattedMessages);
              }
            }
          } catch (error) {
                      }
        };
        
        loadMessages();
      }
    }, [roomName, connected, userData?.id]);

    const handleMessageReceived = (newMessage) => {
      
      // 🔥 MEJORAR MENSAJES DE REGALO QUE VIENEN INCOMPLETOS
      if (newMessage.text && (newMessage.text.includes('Enviaste:') || newMessage.text.includes('Recibiste:'))) {
                
        const giftName = newMessage.text.split(':')[1]?.trim() || 'Regalo';
        const isReceived = newMessage.text.includes('Recibiste:');
        
        // 🔥 COMPLETAR DATOS FALTANTES
        newMessage.type = isReceived ? 'gift_received' : 'gift_sent';
        
        if (!newMessage.extra_data || Object.keys(newMessage.extra_data).length === 0) {
          newMessage.extra_data = {
            gift_name: giftName,
            gift_image: '', // Se puede buscar después
            gift_price: 0,
            action_text: isReceived ? 'Recibiste' : 'Enviaste',
            sender_name: newMessage.sender
          };
        }
        
        if (!newMessage.gift_data || Object.keys(newMessage.gift_data).length === 0) {
          newMessage.gift_data = newMessage.extra_data;
        }
        
              }

      const formattedMessage = {
        ...newMessage,
        id: newMessage.id || Date.now() + Math.random(),
        type: newMessage.type || 'remote',
        senderRole: newMessage.senderRole || 'cliente'
      };
      
      setMessages(prev => [formattedMessage, ...prev]);
    };


    const handleRequestGift = async (giftId, recipientId, roomName, message) => {
      try {
        // 🔥 DEBUG: Ver todos los regalos disponibles
                        
        // 🔥 DEBUG: Ver estructura de cada regalo


    
        
        const selectedGift = gifts.find(g => g.id === giftId);
        
        if (!selectedGift) {
                              addNotification('error', 'Error', 'Regalo no encontrado');
          return { success: false, error: 'Regalo no encontrado' };
        }
        
        
        // Resto de la función...
        const result = await requestGift(giftId, message);
        
        if (result.success) {
          setShowGiftsModal(false);
                    
          // 🔥 PROBAR DIFERENTES PROPIEDADES DE IMAGEN
          const imageProperty = selectedGift.image || 
                              selectedGift.image_url || 
                              selectedGift.image_path || 
                              selectedGift.pic || 
                              selectedGift.icon || 
                              null;
          
                    
          const requestMessage = {
            id: Date.now(),
            type: 'gift_request',
            text: `🎁 Pediste: ${selectedGift.name}`,
            timestamp: Date.now(),
            isOld: false,
            sender: userData.name,
            senderRole: userData.role,
            gift_data: {
              gift_name: selectedGift.name,
              gift_image: imageProperty,  // 🔥 USAR LA PROPIEDAD CORRECTA
              gift_price: selectedGift.price,
              action_text: "Pediste",
              recipient_name: otherUser?.name || "Cliente",
              original_message: message || ""
            },
            extra_data: {
              gift_name: selectedGift.name,
              gift_image: imageProperty,  // 🔥 USAR LA PROPIEDAD CORRECTA
              gift_price: selectedGift.price,
              action_text: "Pediste",
              recipient_name: otherUser?.name || "Cliente",
              original_message: message || ""
            }
          };
          
          
          setMessages(prev => [requestMessage, ...prev]);
          
          addNotification('success', '🎁 Solicitud Enviada', 
            `Pediste ${selectedGift.name} a ${otherUser?.name || 'Cliente'}`);
          
          return { success: true };
        } else {
                    addNotification('error', 'Error', result.error || 'Error pidiendo regalo');
          return { success: false, error: result.error };
        }
        
      } catch (error) {
                addNotification('error', 'Error', 'Error de conexión');
        return { success: false, error: error.message };
      }
    };

    const handleUserLoadedFromChat = (user) => {
            updateOtherUser(user);
    };



    const siguientePersona = async () => {
  
      
      const tiempoFinalSesion = tiempo;
            
      if (roomName && tiempoFinalSesion > 0 && otherUser?.id && userData?.id) {
                try {
          await processSessionEarnings(tiempoFinalSesion, 'model_next');
                    
          addNotification('success', 'Sesión guardada', 
            `Tiempo registrado: ${Math.floor(tiempoFinalSesion / 60)} min`);
            
        } catch (error) {
                    addNotification('error', 'Error', 'No se pudo guardar la sesión');
        }
      } else {
      
      }
      
      // Resto del código...
      setTiempo(0);
      tiempoInicioRef.current = null;
      setTiempoReal(0);
      
      setMessages([]);
      setMensaje("");
      clearUserCache();
      startSearching();
      
      if (otherUser?.id && roomName) {
        fetch(`${API_BASE_URL}/api/livekit/notify-partner-next`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ roomName })
        }).catch(() => {});

         localStorage.removeItem('sessionTime');
        localStorage.removeItem('sessionStartTime');
      }
      localStorage.removeItem('sessionTime');
      localStorage.removeItem('sessionStartTime');
      
      const urlParams = new URLSearchParams({
        role: 'modelo',
        action: 'siguiente',
        from: 'videochat_siguiente',
        excludeUser: otherUser?.id || '',
        excludeUserName: otherUser?.name || '',
        selectedCamera: selectedCamera || '',
        selectedMic: selectedMic || ''
      });
      
      navigate(`/usersearch?${urlParams}`, { replace: true });
    };
    window.siguientePersona = siguientePersona;

    // 3️⃣ VERSIÓN DEBUG DE finalizarChat
    const finalizarChat = useCallback(async () => {
      
      setModeloStoppedWorking(true);
      setClientDisconnected(false);
      setClientWentNext(false);
      
      const tiempoFinalSesion = tiempo;
            
      if (roomName && tiempoFinalSesion > 0 && otherUser?.id && userData?.id) {
                try {
          await processSessionEarnings(tiempoFinalSesion, 'model_ended');
                    addNotification('success', 'Sesión finalizada', 
            `Tiempo registrado: ${Math.floor(tiempoFinalSesion / 60)} min`);
        } catch (error) {
                    addNotification('error', 'Error', 'No se pudo guardar el tiempo');
        }
      } else {
    
      }
      
      // Resto del código...
      if (roomName && tiempoFinalSesion > 0) {
        try {
          await enviarTiempoReal(roomName, tiempoFinalSesion);
                  } catch (error) {
          console.warn('⚠️ [DEBUG] Error enviando tiempo real:', error);
        }
      }
      
      setTiempo(0);
      tiempoInicioRef.current = null;
      setTiempoReal(0);
      clearUserCache();

      if (otherUser?.id && roomName) {
        fetch(`${API_BASE_URL}/api/livekit/notify-partner-stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ roomName })
        }).catch(() => {});
        
      }

      localStorage.removeItem('roomName');
      localStorage.removeItem('userName');
      localStorage.removeItem('currentRoom');
      localStorage.removeItem('inCall');
      localStorage.removeItem('sessionTime');
      localStorage.removeItem('sessionStartTime');
            navigate('/homellamadas', { replace: true });
    }, [roomName, navigate, addNotification, otherUser, userData, tiempo]);

// 4️⃣ FUNCIÓN DE TEST MANUAL MEJORADA
const testProcessEarningsManually = async () => {
    
  const testData = {
    tiempo: tiempo || 60,      // Al menos 1 minuto
    roomName: roomName || 'test_room',
    otherUser: otherUser || { id: 999, name: 'Test User' },
    userData: userData || { id: 1, name: 'Test Modelo', role: 'modelo' }
  };
  
    
  try {
    await processSessionEarnings(testData.tiempo, 'manual_test');
      } catch (error) {
      }
};

// 5️⃣ AGREGAR FUNCIÓN AL WINDOW PARA DEBUG
useEffect(() => {
  // Hacer disponible para debugging desde consola
  window.debugEarnings = {
    testProcessEarnings: testProcessEarningsManually,
    currentState: {
      tiempo,
      tiempoReal, 
      roomName,
      otherUser,
      userData
    },
    processSessionEarnings: (duration) => processSessionEarnings(duration, 'manual_debug')
  };
  
    
  return () => {
    delete window.debugEarnings;
  };
}, [tiempo, tiempoReal, roomName, otherUser, userData]);
    const onCameraSwitch = useCallback(() => {
      cambiarCamara();
    }, []);

    const handleClientDisconnected = (reason = 'stop', customMessage = '') => {
      setLoading(false);
      setConnected(false);
      
      if (reason === 'next' || reason === 'partner_went_next') {
        setClientWentNext(true);
        setDisconnectionType('next');
        setDisconnectionReason(customMessage || 'El chico te saltó y fue a la siguiente persona'); // 🔥 CAMBIO: chico
      } else if (reason === 'stop' || reason === 'partner_left_session') {
        setClientDisconnected(true);
        setDisconnectionType('stop');
        setDisconnectionReason(customMessage || 'El chico se desconectó de la videollamada'); // 🔥 CAMBIO: chico
      } else {
        setClientDisconnected(true);
        setDisconnectionType('left');
        setDisconnectionReason(customMessage || 'El chico salió de la sesión'); // 🔥 CAMBIO: chico
      }
      
      startRedirectCountdown();
    };

    const startRedirectCountdown = () => {
      let timeLeft = 3;
      setRedirectCountdown(timeLeft);
      
      const countdownInterval = setInterval(() => {
        timeLeft--;
        setRedirectCountdown(timeLeft);
        
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);
    };

    // 🔥 FUNCIONES DE FAVORITOS Y BLOQUEO MEJORADAS
    const toggleFavorite = async () => {
      if (!otherUser?.id || isAddingFavorite) return;
      
      setIsAddingFavorite(true);
      
      try {
        const authToken = localStorage.getItem('token');
        
        if (isFavorite) {
          const response = await fetch(`${API_BASE_URL}/api/favorites/remove`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ favorite_user_id: otherUser.id })
          });
          
          const data = await response.json();
          if (data.success) {
            setIsFavorite(false);
            addNotification('success', 'Favorito removido', `${otherUser.name} removido de favoritos`);
          }
        } else {
          const note = '';
          
          const response = await fetch(`${API_BASE_URL}/api/favorites/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              favorite_user_id: otherUser.id,
              note: note
            })
          });
          
          const data = await response.json();
          if (data.success) {
            setIsFavorite(true);
            addNotification('success', 'Favorito agregado', `${otherUser.name} agregado a favoritos ⭐`);
          }
        }
      } catch (error) {
        addNotification('error', 'Error', 'Error de conexión con favoritos');
      } finally {
        setIsAddingFavorite(false);
      }
    };

    const blockCurrentUser = async () => {
      if (!otherUser?.id || isBlocking) return;
      
      const reason = 'Comportamiento inapropiado';
      
      setIsBlocking(true);
      
      try {
        const authToken = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/blocks/block-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            blocked_user_id: otherUser.id,
            reason: reason,
            current_room: roomName
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          addNotification('success', 'Usuario bloqueado', `Has bloqueado a ${otherUser.name}`);
          
          setTimeout(() => {
            siguientePersona();
          }, 1500);
        } else {
          addNotification('error', 'Error', data.error || 'Error al bloquear usuario');
        }
      } catch (error) {
        addNotification('error', 'Error', 'Error de conexión');
      } finally {
        setIsBlocking(false);
      }
    };

    const checkIfFavorite = async (userId) => {
      try {
        const authToken = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/favorites/list`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        if (data.success) {
          const isFav = data.favorites.some(fav => fav.id == userId);
          setIsFavorite(isFav);
        }
      } catch (error) {
              }
    };

    // 🔥 FUNCIÓN PARA OBTENER NOMBRE DISPLAY MEJORADA
    const getDisplayName = () => {
      if (!roomName || !userName) return "Configurando...";
      
      const cacheKey = getRoomCacheKey(roomName, userName);
      const cached = USER_CACHE.get(cacheKey);
      
      if (cached) return cached.name;
      if (otherUser) return otherUser.name;
      if (isDetectingUser) return "Conectando...";
      
      return "Esperando chico..."; // 🔥 CAMBIO: chico en lugar de usuario
    };


   

    // 🔥 FUNCIÓN DE RATE LIMITING
    const handleRateLimit = useCallback((error, context = 'general') => {
      if (error?.response?.status === 429) {
        console.warn(`⚠️ Rate limit detectado en VideoChat MODELO (${context})`);
        
        navigate('/rate-limit-wait', {
          state: {
            message: `Servidor ocupado en videochat modelo, reintentando...`,
            waitTime: 12000,
            fallbackRoute: "/homellamadas",
            onRetry: (userRole) => {
                            if (userRole === 'cliente') return '/homecliente';
              if (userRole === 'modelo') return '/homellamadas';
              return '/home';
            }
          },
          replace: true
        });
        return true;
      }
      return false;
    }, [navigate]);

    // 🔥 EVENTOS DE CONEXIÓN
    const handleRoomConnected = () => {
      setConnected(true);
      iniciarTiempoReal();
      addNotification('success', 'Conectado', 'Conexión establecida exitosamente');
    };

    const handleRoomDisconnected = () => {
      setConnected(false);
      detenerTiempoReal();
      addNotification('warning', 'Desconectado', 'Se perdió la conexión');
    };

    // 🔥 MANEJO DE TECLAS
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        enviarMensaje();
      }
    };

    // 🔥 EFECTOS DE INICIALIZACIÓN

    // Efecto para heartbeat
    useEffect(() => {
      if (!roomName || modeloStoppedWorking) {
                return;
      }

      
      const authToken = localStorage.getItem('token');
      if (authToken) {
        fetch(`${API_BASE_URL}/api/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            activity_type: 'videochat',
            room: roomName
          })
        }).catch(() => {});
      }

      const interval = setInterval(() => {
        if (modeloStoppedWorking) {
                    clearInterval(interval);
          return;
        }
        
        const token = localStorage.getItem('token');
        if (token) {
          fetch(`${API_BASE_URL}/api/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              activity_type: 'videochat',
              room: roomName
            })
          }).catch(() => {});
        }
      }, 15000);

      return () => {
                clearInterval(interval);
        
        if (!modeloStoppedWorking) {
          const token = localStorage.getItem('token');
          if (token) {
            fetch(`${API_BASE_URL}/api/heartbeat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                activity_type: 'browsing',
                room: null
              })
            }).catch(() => {});
          }
        }
      };
    }, [roomName, modeloStoppedWorking]);

    // Efecto para cargar usuario
    useEffect(() => {
      const fetchUser = async () => {
        try {
          const user = await getUser(false);
          const name = user.alias || user.name || user.username || "";
          const role = user.rol || user.role || "modelo";
          
          setUserData({ name, role, id: user.id });
        } catch (err) {
                    
          const wasRateLimited = handleRateLimit(err, 'getUser');
          if (wasRateLimited) {
            return;
          }
          
          addNotification('error', 'Error', 'No se pudo cargar la información del usuario');
        }
      };
      
      fetchUser();
    }, [addNotification, handleRateLimit]);


    // Efecto para obtener token
    const memoizedRoomName = useMemo(() => {
      const room = getParam("roomName");
      return room && room !== 'null' && room !== 'undefined' ? room : null;
    }, [location.state, searchParams]);


    const memoizedUserName = useMemo(() => {
      const user = getParam("userName");
      return user && user !== 'null' && user !== 'undefined' ? user : null;
    }, [location.state, searchParams]);

    useEffect(() => {
      let isMounted = true;
      let retryCount = 0;
      const maxRetries = 3;
      
      const getTokenWithRetry = async () => {
        try {
          if (!memoizedRoomName || !memoizedUserName) {
            throw new Error(`Parámetros inválidos - roomName: "${memoizedRoomName}", userName: "${memoizedUserName}"`);
          }

          

          const authToken = localStorage.getItem('token');
          if (!authToken) {
            throw new Error('No se encontró token de autenticación');
          }

          const response = await fetch(`${API_BASE_URL}/api/livekit/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              room: memoizedRoomName.trim(),
              identity: memoizedUserName.trim(),
              preferredCamera: selectedCamera,
              preferredMic: selectedMic
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            const error = new Error(`Error ${response.status}: ${errorData}`);
            error.response = { status: response.status };
            
            if (response.status === 429) {
              const wasRateLimited = handleRateLimit(error, 'livekit-token');
              if (wasRateLimited) {
                return;
              }
              
              if (retryCount < maxRetries) {
                retryCount++;
                const delay = 3000 * retryCount;
                console.warn(`⚠️ Rate limited token, reintentando en ${delay}ms...`);
                setTimeout(() => {
                  if (isMounted) getTokenWithRetry();
                }, delay);
                return;
              }
            }
            
            throw error;
          }

          const data = await response.json();
          
          if (isMounted) {
            setToken(data.token);
            setServerUrl(data.serverUrl);
            setLoading(false);
          }
        } catch (err) {
                    
          const wasRateLimited = handleRateLimit(err, 'token-error');
          if (!wasRateLimited && isMounted) {
            setError(err.message);
            setLoading(false);
          }
        }
      };

      if (memoizedRoomName && memoizedUserName) {
        getTokenWithRetry();
      } else {
  
        setError(`Faltan parámetros de la sala.`);
        setLoading(false);
      }

      return () => {
        isMounted = false;
      };
    }, [memoizedRoomName, memoizedUserName, handleRateLimit, selectedCamera, selectedMic]);

    // Efecto para espejo
    useEffect(() => {
      const savedMirrorMode = localStorage.getItem("mirrorMode");
      const shouldMirror = savedMirrorMode ? JSON.parse(savedMirrorMode) : true;
      
      setMirrorMode(shouldMirror);
      
      const timer = setTimeout(() => {
        applyMirrorToAllVideos(shouldMirror);
        setupMirrorObserver(shouldMirror);
      }, 2000);
      
      return () => {
        clearTimeout(timer);
        if (mirrorObserver) {
          mirrorObserver.disconnect();
        }
      };
    }, []);

    // Efecto para aplicar espejo cuando conecta
    useEffect(() => {
      if (connected && token) {
        const timer = setTimeout(() => {
                    applyMirrorToAllVideos(mirrorMode);
          setupMirrorObserver(mirrorMode);
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }, [connected, token, mirrorMode]);

    // Efecto para re-aplicar espejo cuando cambien participantes
    useEffect(() => {
      if (chatFunctions && chatFunctions.participantsCount > 0) {
        const timer = setTimeout(() => {
                    forceApplyMirror();
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }, [chatFunctions?.participantsCount, forceApplyMirror]);


    // Efecto para traducir mensajes
    useEffect(() => {
      const processMessagesForTranslation = async () => {
        if (!translationSettings?.enabled) return;
        
        for (const message of messages) {
          if (!message.processed) {
            try {
              const result = await translateMessage(message);
              if (result) {
                                message.processed = true;
              }
            } catch (error) {
              console.warn('Error traduciendo mensaje:', error);
            }
          }
        }
      };
      
      processMessagesForTranslation();
    }, [messages, translateMessage, translationSettings.enabled]);

    // Efecto para detener loading cuando conecta
    useEffect(() => {
      const shouldStopLoading = 
        connected && 
        token && 
        chatFunctions && 
        (
          chatFunctions.participantsCount > 1 || 
          chatFunctions.hasOtherParticipant || 
          !chatFunctions.isDetecting
        );

      if (shouldStopLoading) {
     
      
        
        forceStopSearching();
      }
    }, [connected, token, chatFunctions, forceStopSearching]);

    useEffect(() => {
            
      window.livekitChatFunctions = (functions) => {
     
        
        setChatFunctions(functions);
        
        // 🔥 SOLO ACTUALIZAR SI NO TENEMOS USUARIO AÚN
        if (functions.otherParticipant && !otherUser) {
                    updateOtherUser(functions.otherParticipant);
        }
        
        if (functions.isDetecting !== undefined) {
          setIsDetectingUser(functions.isDetecting);
        }
      };
      
      return () => {
        delete window.livekitChatFunctions;
      };
    }, [roomName, userName, otherUser]); // 🔥 AGREGAR otherUser A DEPENDENCIAS

    useEffect(() => {
  if (!roomName || !userName || !connected || modeloStoppedWorking) {
    return;
  }

  
  let isPolling = true;
  let pollInterval = 3000;
  let consecutiveEmpty = 0;

  const checkNotifications = async () => {
    
    if (!isPolling || modeloStoppedWorking) {
                return;
      }
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) return;

      const response = await fetch(`${API_BASE_URL}/api/status/updates`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
                return;
      }

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.has_notifications) {
          consecutiveEmpty = 0;
          const notification = data.notification;
                    
          isPolling = false;
          
          if (notification.type === 'partner_went_next') {
                          localStorage.removeItem('sessionTime');
              localStorage.removeItem('sessionStartTime');
            
            // 🔥 PROCESAR GANANCIAS CON TIEMPO LEGACY ANTES DE REDIRIGIR
            const tiempoActual = tiempo; // ← USAR TIEMPO LEGACY
            if (tiempoActual > 0 && otherUser?.id && userData?.id) {
              try {
                await processSessionEarnings(tiempoActual, 'partner_went_next');
                              } catch (error) {
                              }
            }
            
            handleClientDisconnected('next', 'El cliente fue a la siguiente modelo');
            
            clearUserCache();
            startSearching();
            
            const redirectParams = notification.data.redirect_params || {};
            const urlParams = new URLSearchParams({
              role: 'modelo',
              from: 'partner_went_next',
              action: 'siguiente',
              excludeUser: redirectParams.excludeUser || '',
              excludeUserName: redirectParams.excludeUserName || '',
              selectedCamera: selectedCamera || '',
              selectedMic: selectedMic || ''
            });
            
            setTimeout(() => {
              navigate(`/usersearch?${urlParams}`, { replace: true });
            }, 3000);
          }
          
          if (notification.type === 'partner_left_session') {
                        localStorage.removeItem('sessionTime');
            localStorage.removeItem('sessionStartTime');    
            // 🔥 PROCESAR GANANCIAS CON TIEMPO LEGACY ANTES DE REDIRIGIR  
            const tiempoActual = tiempo; // ← USAR TIEMPO LEGACY
            if (tiempoActual > 0 && otherUser?.id && userData?.id) {
              try {
                await processSessionEarnings(tiempoActual, 'partner_left_session');
                              } catch (error) {
                              }
            }
            
            handleClientDisconnected('stop', 'El cliente finalizó la videollamada');
            
            setTimeout(() => {
              setModeloStoppedWorking(true);
              setReceivedNotification(true);
              clearUserCache();
              
              localStorage.removeItem('roomName');
              localStorage.removeItem('userName');
              localStorage.removeItem('currentRoom');
              localStorage.removeItem('inCall');
              localStorage.removeItem('videochatActive');
              
              startSearching();
              
              const urlParams = new URLSearchParams({
                role: 'modelo',
                from: 'client_stopped_session',
                action: 'find_new_client',
                reason: 'previous_client_left',
                selectedCamera: selectedCamera || '',
                selectedMic: selectedMic || ''
              });
              
              setTimeout(() => {
                navigate(`/usersearch?${urlParams}`, { replace: true });
              }, 3000);
            }, 100);
          }
        } else {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) {
            pollInterval = Math.min(pollInterval + 1000, 8000);
          }
        }
      }
    } catch (error) {
          }
    
    if (isPolling && !modeloStoppedWorking) {
      setTimeout(checkNotifications, pollInterval);
    }
  };

  checkNotifications();

  return () => {
        isPolling = false;
  };
    }, [roomName, userName, connected, modeloStoppedWorking, navigate, selectedCamera, selectedMic, tiempo, otherUser, userData]); // ← AGREGAR tiempo, otherUser, userData


    
    // Efecto para resetear flags
    useEffect(() => {
      setModeloStoppedWorking(false);
      setReceivedNotification(false);
      setClientDisconnected(false);
      setClientWentNext(false);
      setDisconnectionReason('');
      setDisconnectionType('');
      setRedirectCountdown(0);
    }, [roomName]);

    // Efecto para timer legacy
    useEffect(() => {
      const intervalo = setInterval(() => setTiempo((prev) => prev + 1), 1000);
      
      return () => {
        clearInterval(intervalo);
        if (tiempoIntervalRef.current) {
          clearInterval(tiempoIntervalRef.current);
        }
      };
    }, []);

    // Efecto para verificar favoritos
    useEffect(() => {
      if (otherUser?.id) {
        checkIfFavorite(otherUser.id);
      } else {
        setIsFavorite(false);
      }
    }, [otherUser?.id]);

// 🔥 REEMPLAZAR EL useEffect DEL AUTO-SIGUIENTE CON ESTA VERSIÓN DEFINITIVA
    useEffect(() => {
      // ✅ CONDICIONES MEJORADAS
      if (!room || !connected || modeloStoppedWorking) {
        return;
      }

      
      let autoNextTimer = null;
      let warningTimer = null;
      let checkInterval = null;
      let isActive = true;

      // ✅ FUNCIÓN DE CLEANUP MEJORADA
      const cleanupTimers = () => {
        if (autoNextTimer) {
          clearTimeout(autoNextTimer);
          autoNextTimer = null;
        }
        if (warningTimer) {
          clearTimeout(warningTimer);
          warningTimer = null;
        }
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      };

      // ✅ FUNCIÓN DE EJECUCIÓN CON SAFETY CHECKS
      const executeAutoNext = async () => {
        if (!isActive || modeloStoppedWorking) {
                    return;
        }

                
        try {
          // Marcar como inactivo inmediatamente
          isActive = false;
          cleanupTimers();

          // Procesar ganancias si hay datos válidos
          if (tiempo > 0 && otherUser?.id && userData?.id) {
                        await processSessionEarnings(tiempo, 'auto_empty_room');
          }

          // Verificar que siguientePersona existe
          if (typeof window.siguientePersona === 'function') {
                        window.siguientePersona();
          } else {
                        navigate('/usersearch?role=modelo&action=auto_next&from=empty_room', { replace: true });
          }

        } catch (error) {
                    // Fallback: navegar directamente
          navigate('/usersearch?role=modelo&action=auto_error', { replace: true });
        }
      };

      // ✅ VERIFICADOR DE SALA VACÍA OPTIMIZADO
      const checkEmptyRoom = () => {
        if (!isActive || !room || room.state !== 'connected') {
          return;
        }

        const remoteCount = room.remoteParticipants?.size || 0;
        const hasLocal = !!room.localParticipant;
        
        // Solo proceder si estoy conectado pero sin usuarios remotos
        if (remoteCount === 0 && hasLocal) {
          
          if (!autoNextTimer) {
                        
            // Warning a los 20 segundos
            warningTimer = setTimeout(() => {
              if (isActive && !modeloStoppedWorking) {
                addNotification('warning', 'Usuario Desconectado', 
                  'Cambiando en 10 segundos...');
              }
            }, 20000);
            
            // Auto-next a los 30 segundos
            autoNextTimer = setTimeout(() => {
              if (isActive) {
                executeAutoNext();
              }
            }, 30000);
          }
          
        } else if (remoteCount > 0) {
          // Hay usuarios - cancelar timers
          if (autoNextTimer || warningTimer) {
                        cleanupTimers();
          }
        }
      };

      // ✅ VERIFICACIÓN INICIAL
      checkEmptyRoom();
      
      // ✅ INTERVALO DE VERIFICACIÓN CADA 10 SEGUNDOS (menos frecuente)
      checkInterval = setInterval(() => {
        if (isActive) {
          checkEmptyRoom();
        }
      }, 10000);

      // ✅ LISTENERS DE PARTICIPANTES
      const handleParticipantConnected = () => {
                setTimeout(checkEmptyRoom, 2000);
      };

      const handleParticipantDisconnected = () => {
                setTimeout(checkEmptyRoom, 2000);
      };

      if (room) {
        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);
      }

      // ✅ CLEANUP FUNCTION DEFINITIVO
      return () => {
                isActive = false;
        cleanupTimers();
        
        if (room) {
          room.off('participantConnected', handleParticipantConnected);
          room.off('participantDisconnected', handleParticipantDisconnected);
        }
      };

    }, [room?.state, connected, modeloStoppedWorking]); // ✅ DEPENDENCIAS MÍNIMAS Y ESTABLES

    // 🔥 AGREGAR TAMBIÉN ESTA FUNCIÓN DE EMERGENCIA PERMANENTE
    useEffect(() => {
      // Función de emergencia disponible globalmente
      window.emergencyExit = () => {
                
        // Detener todos los timers
        for (let i = 1; i < 9999; i++) {
          clearTimeout(i);
          clearInterval(i);
        }
        
        // Desconectar LiveKit si existe
        if (window.livekitRoom) {
          window.livekitRoom.disconnect().catch(() => {});
        }
        
        // Navegar inmediatamente
        window.location.href = '/usersearch?role=modelo&action=emergency&from=manual';
      };
      
      return () => {
        delete window.emergencyExit;
      };
    }, []);
    // Efecto para scroll de mensajes
    useEffect(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, [messages]);

    // Efecto para clicks fuera de settings
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (showMainSettings && !event.target.closest('.settings-dropdown')) {
          setShowMainSettings(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showMainSettings]);

    // Efecto para guardar parámetros
    useEffect(() => {
      if (roomName && roomName !== 'null' && roomName !== 'undefined') {
        localStorage.setItem("roomName", roomName);
      }
      if (userName && userName !== 'null' && userName !== 'undefined') {
        localStorage.setItem("userName", userName);
      }
    }, [roomName, userName]);

    // Efecto de cleanup
    useEffect(() => {
      return () => {
        if (tiempoIntervalRef.current) {
          clearInterval(tiempoIntervalRef.current);
          tiempoIntervalRef.current = null;
        }
        tiempoInicioRef.current = null;
      };
    }, []);
    useEffect(() => {
  // Usar valor de UserSearch o default a local para modelo
  const initialCamera = location.state?.camaraPrincipal || 
    (userData.role === 'modelo' ? 'local' : 'remote');
    setCamaraPrincipal(initialCamera);
    }, [location.state, userData.role]);

    // 🔥 RENDER CONDICIONAL PARA ESTADOS DE DESCONEXIÓN
    if (clientDisconnected || clientWentNext) {
      return (
        <DisconnectionScreenImproved
          disconnectionType={disconnectionType}
          disconnectionReason={disconnectionReason}
          redirectCountdown={redirectCountdown}
          t={t}
        />
      );
    }

    // 🔥 RENDER CONDICIONAL PARA ESTADOS DE DESCONEXIÓN
    if (clientDisconnected || clientWentNext) {
      return (
        <DisconnectionScreenImproved
          disconnectionType={disconnectionType}
          disconnectionReason={disconnectionReason}
          redirectCountdown={redirectCountdown}
          t={t}
        />
      );
    }


    // 🔥 RENDER PRINCIPAL
    return (
      //<GlobalTranslationProvider>
        <div className="min-h-screen bg-gradient-to-b from-[#0a0d10] to-[#131418] text-white">
          {/* Sistema de notificaciones */}
          <NotificationSystemImproved
            notifications={notifications}
            onRemove={removeNotification}
          />
          
          {/* Modal de regalos */}
          <GiftsModal
            isOpen={showGiftsModal}
            onClose={() => setShowGiftsModal(false)}
            recipientName={getDisplayName()}
            recipientId={otherUser?.id}
            roomName={roomName}
            userRole="modelo"                    // ✅ MODELO
            gifts={gifts}
            onRequestGift={handleRequestGift}    // ✅ PEDIR (no enviar)
            loading={giftLoading}
          />
          
          {/* Configuración de traducción */}
          <TranslationSettings
            isOpen={showTranslationSettings}
            onClose={() => setShowTranslationSettings(false)}
            settings={translationSettings}
            onSettingsChange={setTranslationSettings}
            languages={languages}
          />
          
          {/* Configuración de cámara y audio */}
          <CameraAudioSettings
            isOpen={showCameraAudioModal}
            onClose={() => setShowCameraAudioModal(false)}
            cameraEnabled={cameraEnabled}
            micEnabled={micEnabled}
            setCameraEnabled={setCameraEnabled}
            setMicEnabled={setMicEnabled}
            mirrorMode={mirrorMode}
            setMirrorMode={setMirrorMode}
            onMirrorToggle={toggleMirrorMode}
          />
          
          {loading && (
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
                <p className="text-white">Conectando...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="min-h-screen flex items-center justify-center p-4">
              <div className="text-center max-w-md mx-auto">
                <p className="text-red-500 text-lg mb-4">Error: {error}</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => navigate('/precallmodel')}
                    className="bg-[#ff007a] px-6 py-3 rounded-full text-white font-medium"
                  >
                    Volver a Inicio
                  </button>
                  <button
                    onClick={() => navigate(-1)}
                    className="bg-gray-600 px-6 py-3 rounded-full text-white font-medium"
                  >
                    Atrás
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {!loading && !error && token && (
            <LiveKitRoom
              video={cameraEnabled}
              audio={micEnabled}
              token={token}
              serverUrl={serverUrl}
              data-lk-theme="default"
              onConnected={handleRoomConnected}
              onDisconnected={handleRoomDisconnected}
              className="min-h-screen"
              options={{
                videoCaptureDefaults: selectedCamera ? { deviceId: selectedCamera } : undefined,
                audioCaptureDefaults: selectedMic ? { deviceId: selectedMic } : undefined,
              }}
            >
              <RoomAudioRenderer />
              <RoomCapture onRoomReady={handleRoomReady} />
               {memoizedRoomName && memoizedUserName && (
                  <SimpleChat
                    key={`${memoizedRoomName}-${memoizedUserName}`}
                    userName={userData.name}
                    userRole={userData.role}
                    roomName={memoizedRoomName}
                    onMessageReceived={handleMessageReceived}
                    onUserLoaded={handleUserLoadedFromChat}
                    onParticipantsUpdated={(participants) => {
                                          }}
                  />
               )}

              {/* Controles de media ocultos */}
             <MediaControlsImproved
                micEnabled={micEnabled}
                cameraEnabled={cameraEnabled}
                volumeEnabled={volumeEnabled}
                setMicEnabled={setMicEnabled}
                setCameraEnabled={setCameraEnabled}
                setVolumeEnabled={setVolumeEnabled}
                userData={userData}  // ← AGREGAR ESTA LÍNEA
              />
                          
              <div className="p-2 sm:p-4">
                <Header />
                
                {/* Tiempo mejorado - visible entre header y cámara */}
                <TimeDisplayImproved
                  tiempoReal={tiempoReal}
                  formatoTiempo={formatoTiempo}
                  connected={connected}
                  otherUser={otherUser}
                  roomName={roomName}
                  t={t}
                />
                
                  {/* MÓVIL - Video adaptativo entre tiempo y chat */}
                  <div className="lg:hidden bg-[#1f2125] rounded-2xl overflow-hidden relative mt-4" 
                      style={{height: 'calc(100vh - 360px)'}}>                
                  <VideoDisplayImproved
                    onCameraSwitch={cambiarCamara}
                    mainCamera={camaraPrincipal}
                    connected={connected}
                    hadRemoteParticipant={otherUser !== null}
                    otherUser={otherUser}
                    isDetectingUser={isDetectingUser}
                    t={t}
                    
                  />  
                  <FloatingMessagesImproved
                    messages={messages || []}
                    t={t}
                  />
                                  
                  {/* Controles móviles mejorados */}
                  <MobileControlsImproved
                    // Props existentes...
                    mensaje={mensaje}
                    setMensaje={setMensaje}
                    enviarMensaje={enviarMensaje}
                    handleKeyPress={handleKeyPress}
                    toggleFavorite={toggleFavorite}
                    blockCurrentUser={blockCurrentUser}
                    isFavorite={isFavorite}
                    isAddingFavorite={isAddingFavorite}
                    isBlocking={isBlocking}
                    otherUser={otherUser}
                    setShowGiftsModal={setShowGiftsModal}
                    micEnabled={micEnabled}
                    setMicEnabled={setMicEnabled}
                    cameraEnabled={cameraEnabled}
                    setCameraEnabled={setCameraEnabled}
                    onCameraSwitch={onCameraSwitch}
                    onEndCall={finalizarChat}
                    siguientePersona={siguientePersona}
                    volumeEnabled={volumeEnabled}
                    setVolumeEnabled={setVolumeEnabled}
                    cameras={cameras}
                    microphones={microphones}
                    selectedCamera={selectedCameraDevice}
                    selectedMicrophone={selectedMicrophoneDevice}
                    isLoadingDevices={isLoadingDevices}
                    onCameraChange={handleCameraChange}
                    onMicrophoneChange={handleMicrophoneChange}
                    onLoadDevices={loadDevices}
                    showMainSettings={showMainSettings}
                    setShowMainSettings={setShowMainSettings}
                    isModelView={userData.role === 'modelo'}  // ← AGREGAR
                    userData={userData}   
                  />
                </div>
                
                
                {/* DESKTOP - Layout principal */}
                <div className="hidden lg:flex flex-col lg:flex-row lg:gap-6 mx-4">
                  {/* ZONA VIDEO */}
                <div className="flex-1 bg-[#1f2125] rounded-xl lg:rounded-2xl overflow-hidden relative flex items-center justify-center video-main-container">
                    <VideoDisplayImproved
                      onCameraSwitch={cambiarCamara}
                      mainCamera={camaraPrincipal}
                      connected={connected}
                      hadRemoteParticipant={otherUser !== null}
                      otherUser={otherUser}
                      isDetectingUser={isDetectingUser}
                      t={t}
                    />
                  </div>
                  
                  {/* PANEL DERECHO - Desktop */}
                    <DesktopChatPanel
                      getDisplayName={getDisplayName}
                      isDetectingUser={isDetectingUser}
                      toggleFavorite={toggleFavorite}
                      blockCurrentUser={blockCurrentUser}
                      isFavorite={isFavorite}
                      isAddingFavorite={isAddingFavorite}
                      isBlocking={isBlocking}
                      otherUser={otherUser}
                      setShowGiftsModal={setShowGiftsModal}
                      messages={messages || []}                    // ✅ FALLBACK a array vacío
                      mensaje={mensaje || ''}                      // ✅ AGREGAR esta prop que faltaba
                      setMensaje={setMensaje}
                      enviarMensaje={enviarMensaje}
                      handleKeyPress={handleKeyPress}
                      userData={userData || {}}                    // ✅ FALLBACK a objeto vacío
                      userBalance={userBalance || 0}               // ✅ FALLBACK a 0
                      t={t}
                    />
                </div>
                
                {/* CONTROLES PRINCIPALES MEJORADOS */}
                <DesktopControlsImproved
                  micEnabled={micEnabled}
                  setMicEnabled={setMicEnabled}
                  cameraEnabled={cameraEnabled}
                  setCameraEnabled={setCameraEnabled}
                  siguientePersona={siguientePersona}
                  finalizarChat={finalizarChat}
                  showMainSettings={showMainSettings}
                  setShowMainSettings={setShowMainSettings}
                  setShowTranslationSettings={setShowTranslationSettings}
                  setShowCameraAudioModal={setShowCameraAudioModal}
                  translationSettings={translationSettings}
                  languages={languages}
                  loading={loading}
                  t={t}
                  volumeEnabled={volumeEnabled}
                  setVolumeEnabled={setVolumeEnabled}
                  cameras={cameras}
                  microphones={microphones}
                  selectedCamera={selectedCameraDevice}
                  selectedMicrophone={selectedMicrophoneDevice}
                  isLoadingDevices={isLoadingDevices}
                  onCameraChange={handleCameraChange}
                  onMicrophoneChange={handleMicrophoneChange}
                  onLoadDevices={loadDevices}
                  isModelView={userData.role === 'modelo'}  // ← AGREGAR
  userData={userData}   
                />
              </div>
            </LiveKitRoom>
            
          )}
   </div>
        
      //</GlobalTranslationProvider>
    );
  }