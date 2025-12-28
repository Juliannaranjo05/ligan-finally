// VideoChat.jsx - Reconstrucción completa con LiveKit (diseño original restaurado)
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

// Componentes modularizados (DISEÑO ORIGINAL RESTAURADO)
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

// ========== COMPONENTE PARA CAPTURAR ROOM INSTANCE ==========
const RoomCapture = ({ onRoomReady }) => {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const hasCalledReady = useRef(false);

  useEffect(() => {
    // 🔥 Solo llamar onRoomReady UNA VEZ cuando la room esté conectada
    if (room && room.state === 'connected' && localParticipant && !hasCalledReady.current) {
      hasCalledReady.current = true;
      onRoomReady(room);
    } else if (room && room.state !== 'connected' && !hasCalledReady.current) {
      // Esperar a que se conecte solo si aún no se ha llamado
      const handleStateChange = () => {
        if (room.state === 'connected' && localParticipant && !hasCalledReady.current) {
          hasCalledReady.current = true;
          onRoomReady(room);
          room.removeListener('connectionStateChanged', handleStateChange);
        }
      };

      room.on('connectionStateChanged', handleStateChange);

      return () => {
        room.removeListener('connectionStateChanged', handleStateChange);
      };
    }
  }, [room, localParticipant, onRoomReady]);

  return null;
};

// Instrumentación: contador de renders y trazas (inicializado después de declarar los estados)
const renderCountRef = { current: 0 };


// ========== COMPONENTE PRINCIPAL ==========
export default function VideoChat() {
  
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  // 🔥 HOOKS Y CONTEXTOS
  const { startSearching, stopSearching, forceStopSearching } = useSearching();
  const { finalizarSesion, limpiarDatosSession } = useSessionCleanup();

  // 🔥 VERIFICACIÓN DE ROL - REDIRIGIR CLIENTE A SU VISTA
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const user = await getUser(false);
        if (user && user.rol === 'cliente') {
          const currentParams = new URLSearchParams(window.location.search);
          navigate(`/videochatclient?${currentParams}`, { replace: true });
          return;
        }
      } catch (error) {
      }
    };

    checkUserRole();
  }, [navigate]);

  // 🔥 PARÁMETROS DE LA SALA - MÚLTIPLES FUENTES
  // 🔥 PRIORIDAD: location.state > sessionStorage > localStorage > URL params
  // Esto asegura que cuando se navega con un nuevo roomName, se use el nuevo y no el anterior
  const getParam = (key) => {
    
    const stateValue = location.state?.[key];
    const sessionValue = sessionStorage.getItem(key);
    const localValue = localStorage.getItem(key);
    const urlValue = searchParams.get(key);
    

    // 🔥 GUARDAR EN LOCALSTORAGE CUANDO VIENE DE LOCATION.STATE (PARA PERSISTENCIA)
    if (stateValue && stateValue !== 'null' && stateValue !== 'undefined') {
      localStorage.setItem(key, stateValue);
      return stateValue;
    }

    // Si no hay stateValue, intentar recuperar de localStorage primero (para redirecciones)
    if (localValue && localValue !== 'null' && localValue !== 'undefined') {
      return localValue;
    }

    // Si no, usar sessionStorage (más reciente que localStorage)
    if (sessionValue && sessionValue !== 'null' && sessionValue !== 'undefined') {
      return sessionValue;
    }

    // Finalmente URL params
    return urlValue;
  };

  const roomName = getParam("roomName");
  const userName = getParam("userName");
  const selectedCamera = location.state?.selectedCamera;
  const selectedMic = location.state?.selectedMic;
  
  // Solo logear parámetros en el primer render para evitar spam
  const firstRenderParamsRef = useRef(false);
  if (!firstRenderParamsRef.current) {
    console.log('🔍 [VideoChat][MODELO] Parámetros iniciales', { roomName: getParam("roomName"), userName: getParam("userName"), locationState: location.state });
    firstRenderParamsRef.current = true;
  }

  // Instrumentación: contador de renders (se inicializará después de los estados)
  

  // 🔥 ESTADOS PRINCIPALES
  const [userData, setUserData] = useState({
    name: "",
    role: "",
    id: null,
  });

  // 🔥 ESTADO PARA PREVENIR MÚLTIPLES CONEXIONES
  const [connectionAttempted, setConnectionAttempted] = useState(false);

  const [otherUser, setOtherUser] = useState(() => {
    if (!roomName || !userName) return null;
    const cacheKey = `${roomName}_${userName}`;
    const cached = USER_CACHE.get(cacheKey);
    return cached || null;
  });

  useEffect(() => {
    if (!roomName || !userName) {
      console.warn('⚠️ [VideoChat][MODELO] roomName o userName faltante, redirigiendo a homellamadas', { roomName, userName });
      const id = setTimeout(() => navigate('/homellamadas', { replace: true }), 800);
      return () => clearTimeout(id);
    }
  }, [roomName, userName, navigate]);

  // Estados de conexión
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  
  // 🔥 LOG TEMPRANO PARA VERIFICAR QUE EL CÓDIGO LLEGA HASTA AQUÍ
  
  // 🔥 USAR useMemo COMO EN videochatclient.jsx PARA EVITAR RECÁLCULOS EN CADA RENDER
  const memoizedRoomName = useMemo(() => {
    const room = getParam("roomName");
    console.log('🔍 [VideoChat][MODELO] useMemo memoizedRoomName ejecutado', {
      room,
      locationState: location.state?.roomName,
      localStorageRoomName: localStorage.getItem('roomName'),
      sessionStorageRoomName: sessionStorage.getItem('roomName'),
      searchParamsRoomName: searchParams.get('roomName')
    });
    if (!room || room === 'null' || room === 'undefined') {
      return null;
    }
    // Normalizar: trim y eliminar espacios extra
    const normalized = room.trim().replace(/\s+/g, '');
    return normalized;
  }, [location.state, searchParams]);

  const memoizedUserName = useMemo(() => {
    const user = getParam("userName");
    console.log('🔍 [VideoChat][MODELO] useMemo memoizedUserName ejecutado', {
      user,
      locationState: location.state?.userName,
      localStorageUserName: localStorage.getItem('userName'),
      sessionStorageUserName: sessionStorage.getItem('userName'),
      searchParamsUserName: searchParams.get('userName')
    });
    const result = user && user !== 'null' && user !== 'undefined' ? user : null;
    return result;
  }, [location.state, searchParams]);
  
  // 🔥 FUNCIÓN DE RATE LIMITING - MOVER AQUÍ ANTES DEL useEffect (igual que videochatclient.jsx)
  const handleRateLimit = useCallback((error, context = 'general') => {
    if (error?.response?.status === 429) {
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
  
  // 🔥 EFECTO PRINCIPAL PARA OBTENER TOKEN - EXACTAMENTE IGUAL QUE videochatclient.jsx
  useEffect(() => {
    console.log('🚀 [VideoChat][MODELO] useEffect EJECUTADO', {
      memoizedRoomName,
      memoizedUserName,
      hasRoomName: !!memoizedRoomName,
      hasUserName: !!memoizedUserName
    });
    
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const getSecureTokenWithRetry = async () => {
      console.log('🚀 [VideoChat][MODELO] getSecureTokenWithRetry LLAMADO', {
        memoizedRoomName,
        memoizedUserName
      });
      
      try {
        if (!memoizedRoomName || !memoizedUserName) {
          console.error('❌ [VideoChat][MODELO] Parámetros faltantes', {
            memoizedRoomName,
            memoizedUserName
          });
          throw new Error(`Parámetros inválidos - roomName: "${memoizedRoomName}", userName: "${memoizedUserName}"`);
        }

        const authToken = localStorage.getItem('token');
        if (!authToken) {
          throw new Error('No se encontró token de autenticación');
        }

        const response = await fetch(`${API_BASE_URL}/api/livekit/token-secure`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            room: memoizedRoomName, // Ya está normalizado
            // identity ya no se envía - el backend lo genera automáticamente para evitar DuplicateIdentity
            preferredCamera: selectedCamera,
            preferredMic: selectedMic
          }),
        });
        
        console.log('🔍 [VideoChat][MODELO] Token request:', {
          room: memoizedRoomName,
          roomLength: memoizedRoomName?.length,
          note: 'Identity será generada por el backend basada en user_id + role'
        });

        if (!response.ok) {
          const errorData = await response.json();
          
          // Rate limiting
          if (response.status === 429) {
            const wasRateLimited = handleRateLimit({ response: { status: 429 } }, 'secure-token');
            if (wasRateLimited) return;
            
            if (retryCount < maxRetries) {
              retryCount++;
              const delay = 3000 * retryCount;
              setTimeout(() => {
                if (isMounted) getSecureTokenWithRetry();
              }, delay);
              return;
            }
          }
          
          throw new Error(`Error ${response.status}: ${errorData.error || 'Error desconocido'}`);
        }

        const data = await response.json();
        
        console.log('🔍 [VideoChat][MODELO] Token response:', {
          hasToken: !!data.token,
          serverUrl: data.serverUrl,
          roomName: memoizedRoomName,
          roomNameLength: memoizedRoomName?.length
        });
            
        if (isMounted) {
          setToken(data.token);
          setServerUrl(data.serverUrl);
          setLoading(false);
        }
      } catch (err) {
        const wasRateLimited = handleRateLimit(err, 'secure-token-error');
        if (!wasRateLimited && isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    if (memoizedRoomName && memoizedUserName) {
      console.log('✅ [VideoChat][MODELO] Parámetros OK, llamando getSecureTokenWithRetry');
      getSecureTokenWithRetry();
    } else {
      console.error('❌ [VideoChat][MODELO] Faltan parámetros', {
        memoizedRoomName,
        memoizedUserName
      });
      setError(`Faltan parámetros de la sala.`);
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [memoizedRoomName, memoizedUserName, handleRateLimit, selectedCamera, selectedMic]);
  
  // 🔥 ALIAS PARA COMPATIBILIDAD CON CÓDIGO EXISTENTE
  const normalizedRoomName = memoizedRoomName;
  const normalizedUserName = memoizedUserName;
  
  const [modeloStoppedWorking, setModeloStoppedWorking] = useState(false);
  const [receivedNotification, setReceivedNotification] = useState(false);
  const [isProcessingLeave, setIsProcessingLeave] = useState(false);

  // Estados de controles
  // Inicializar en false para evitar que LiveKit intente publicar tracks antes de que el engine esté conectado
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [camaraPrincipal, setCamaraPrincipal] = useState("remote");
  const [volumeEnabled, setVolumeEnabled] = useState(() => {
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

  // 🔥 REFS PARA CONTROL DE DISPOSITIVOS Y PREVENIR LOOPS
  const applyDevicesTimeoutRef = useRef(null);
  const isChangingCamera = useRef(false);
  const isChangingMicrophone = useRef(false);
  const lastAppliedCameraDevice = useRef('');
  const lastAppliedMicrophoneDevice = useRef('');
  const lastCameraDeviceId = useRef('');
  const lastMicrophoneDeviceId = useRef('');

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

  const { 
    translateGlobalText, 
    isEnabled: translationEnabled,
    currentLanguage: globalCurrentLanguage,
    changeGlobalLanguage
  } = useGlobalTranslation();
  
  // 🔥 OBTENER i18n PARA SINCRONIZAR CON EL IDIOMA GLOBAL
  const { i18n: i18nInstance } = useTranslation();
  
  // 🔥 SINCRONIZAR EL IDIOMA DEL VIDEOCHAT CON EL SELECTOR GLOBAL
  useEffect(() => {
    // Obtener el idioma actual de i18n (tiene prioridad)
    const i18nLang = i18nInstance.language?.split('-')[0] || i18nInstance.language;
    
    // También verificar localStorage como respaldo
    const userLang = localStorage.getItem('userPreferredLanguage') || 
                    localStorage.getItem('selectedLanguage') || 
                    localStorage.getItem('lang');
    
    // Usar el idioma de i18n si está disponible, sino usar localStorage o el global
    const finalLang = i18nLang || userLang || globalCurrentLanguage || 'es';
    
    // 🔥 INICIALIZAR EL IDIOMA AL CARGAR EL COMPONENTE
    // Si el idioma es diferente al global o a i18n, sincronizar ambos
    if (finalLang) {
      // Sincronizar i18n si es diferente
      if (i18nInstance.language !== finalLang) {
        try {
          i18nInstance.changeLanguage(finalLang);
        } catch (error) {
          console.warn('Error cambiando idioma en i18n al inicializar:', error);
        }
      }
      
      // Sincronizar contexto global si es diferente
      if (finalLang !== globalCurrentLanguage) {
        if (typeof changeGlobalLanguage === 'function') {
          try {
            changeGlobalLanguage(finalLang);
          } catch (error) {
            console.warn('Error sincronizando idioma al inicializar:', error);
          }
        }
      }
    }
    
    // Listener para cambios en i18n
    const handleI18nLanguageChange = (lng) => {
      const langCode = lng?.split('-')[0] || lng;
      if (langCode && typeof changeGlobalLanguage === 'function') {
        try {
          changeGlobalLanguage(langCode);
        } catch (error) {
          console.warn('Error sincronizando idioma desde i18n:', error);
        }
      }
    };
    
    // Escuchar cambios en i18n
    i18nInstance.on('languageChanged', handleI18nLanguageChange);
    
    // También escuchar el evento global de cambio de idioma
    const handleGlobalLanguageChange = (event) => {
      const { newLanguage } = event.detail || {};
      if (newLanguage) {
        const langCode = newLanguage?.split('-')[0] || newLanguage;
        if (langCode && i18nInstance.language !== langCode) {
          try {
            i18nInstance.changeLanguage(langCode);
          } catch (error) {
            console.warn('Error cambiando idioma en i18n desde evento global:', error);
          }
        }
      }
    };
    
    window.addEventListener('globalLanguageChanged', handleGlobalLanguageChange);
    
    return () => {
      i18nInstance.off('languageChanged', handleI18nLanguageChange);
      window.removeEventListener('globalLanguageChanged', handleGlobalLanguageChange);
    };
  }, [i18nInstance, globalCurrentLanguage, changeGlobalLanguage]);

  // Estados de detección
  const [isDetectingUser, setIsDetectingUser] = useState(() => {
    if (!roomName || !userName) return false;
    const cacheKey = `${roomName}_${userName}`;
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

  // Instrumentación: contador de renders y trazas para diagnóstico
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  if (renderCountRef.current <= 30 || renderCountRef.current % 50 === 0) {
    console.log(`🔁 [VideoChat][MODELO] render #${renderCountRef.current}`, {
      roomName,
      userName,
      loading: !!loading,
      token: !!token,
      serverUrl: !!serverUrl,
      connected,
      tiempo,
      redirectCountdown,
      clientDisconnected,
      modeloStoppedWorking,
      receivedNotification,
      isProcessingLeave,
      messagesCount: messages.length,
      otherUserId: otherUser?.id || null
    });
    if (renderCountRef.current <= 5) console.trace('🔍 [VideoChat][MODELO] stack trace for render');
  }

  // 🔥 LÓGICA SIMPLE TIPO OMEGLE: Conectar y suscribirse automáticamente
  const handleRoomReady = useCallback(async (roomInstance) => {
    // #region agent log
    // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:230',message:'handleRoomReady called',data:{roomName:roomInstance?.name,roomState:roomInstance?.state,memoizedRoomName,hasExistingRoom:!!room,existingRoomState:room?.state,existingRoomName:room?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    
    if (!roomInstance) return;

    // #region agent log
    // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:234',message:'Setting room instance',data:{roomName:roomInstance.name,roomState:roomInstance.state,memoizedRoomName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    setRoom(roomInstance);
    window.livekitRoom = roomInstance;

    if (roomInstance.state === 'connected') {
      // 🔥 ESPERAR A QUE EL ENGINE ESTÉ COMPLETAMENTE LISTO ANTES DE ACTIVAR TRACKS
      
      // Esperar un poco más para asegurar que el engine esté completamente inicializado
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verificar que el engine esté realmente conectado
      if (roomInstance.engine?.connectionState === 'connected' || roomInstance.state === 'connected') {
        // 🔥 PARA MODELO: Activar cámara y micrófono automáticamente
        // La cámara siempre debe estar encendida para la modelo
        setConnected(true);
        
        // 🔥 ACTIVAR CÁMARA DIRECTAMENTE EN LIVEKIT PRIMERO, LUEGO EN ESTADO REACT
        if (roomInstance.localParticipant) {
          try {
            await roomInstance.localParticipant.setCameraEnabled(true);
            
            // Esperar un poco para que el track se publique
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verificar que el track se haya publicado
            const cameraPublication = Array.from(roomInstance.localParticipant.videoTrackPublications.values())
              .find(pub => pub.source === Track.Source.Camera);
            
            if (cameraPublication) {
              // 🔥 VERIFICAR QUE EL TRACK ESTÉ DISPONIBLE PARA REMOTOS
              if (cameraPublication.trackSid) {
              } else {
                // Esperar un poco más y verificar nuevamente
                setTimeout(() => {
                  const retryPublication = Array.from(roomInstance.localParticipant.videoTrackPublications.values())
                    .find(pub => pub.source === Track.Source.Camera);
                  if (retryPublication?.trackSid) {
                  } else {
                  }
                }, 1000);
              }
            } else {
              // Intentar reactivar después de un delay
              setTimeout(() => {
                roomInstance.localParticipant.setCameraEnabled(true).catch(err => {
                });
              }, 1000);
            }
            
            // Ahora activar micrófono
            await roomInstance.localParticipant.setMicrophoneEnabled(true);
            
            // Actualizar estado React después de activar en LiveKit
            setCameraEnabled(true);
            setMicEnabled(true);
            
          } catch (error) {
            // Intentar de nuevo con estado React como fallback
            setCameraEnabled(true);
            setMicEnabled(true);
          }
        } else {
          setCameraEnabled(true);
          setMicEnabled(true);
        }
        
        // 🔥 VERIFICACIÓN ADICIONAL: Asegurar que la cámara se active realmente después de un delay
        setTimeout(() => {
          if (roomInstance.localParticipant) {
            roomInstance.localParticipant.setCameraEnabled(true).catch(error => {
            });
            
            // Verificar publicación nuevamente
            const cameraPublication = Array.from(roomInstance.localParticipant.videoTrackPublications.values())
              .find(pub => pub.source === Track.Source.Camera);
            
            if (cameraPublication && cameraPublication.isEnabled) {
            } else {
              roomInstance.localParticipant.setCameraEnabled(true).catch(err => {
              });
            }
          }
        }, 1000);
      } else {
        // Esperar un poco más y verificar nuevamente
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (roomInstance.state === 'connected') {
          setConnected(true);
          
          // 🔥 ACTIVAR CÁMARA DIRECTAMENTE EN LIVEKIT PRIMERO (RETRY)
          if (roomInstance.localParticipant) {
            try {
              await roomInstance.localParticipant.setCameraEnabled(true);
              
              await roomInstance.localParticipant.setMicrophoneEnabled(true);
              
              // Actualizar estado React después de activar en LiveKit
              setCameraEnabled(true);
              setMicEnabled(true);
            } catch (error) {
              setCameraEnabled(true);
              setMicEnabled(true);
            }
          } else {
            setCameraEnabled(true);
            setMicEnabled(true);
          }
        }
      }
      
      // 🔥 DELAY ADICIONAL PARA ESTABILIZAR STREAMS
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        testStream.getTracks().forEach(track => track.stop());
      } catch (error) {
      }

      // 🔥 SUSCRIBIRSE AUTOMÁTICAMENTE A TODOS LOS PARTICIPANTES REMOTOS
      const subscribeToParticipant = (participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.trackSid && !publication.isSubscribed) {
            participant.setSubscribed(publication.trackSid, true).catch((err) => {
            });
          }
        });
      };

      // Suscribirse a participantes existentes
      if (roomInstance.remoteParticipants.size > 0) {
        roomInstance.remoteParticipants.forEach(subscribeToParticipant);
      }

      // Listener para nuevos participantes
      const handleParticipantConnected = (participant) => {
        subscribeToParticipant(participant);

        // 🔥 Suscribirse a tracks nuevos INMEDIATAMENTE cuando se publican
        participant.on('trackPublished', (publication) => {
          // 🔥 SUSCRIPCIÓN INMEDIATA sin esperar
          if (publication.trackSid && !publication.isSubscribed) {
            try {
              if (participant.setSubscribed && typeof participant.setSubscribed === 'function') {
                participant.setSubscribed(publication.trackSid, true).then(() => {
                }).catch((err) => {
                });
              } else if (roomInstance.setSubscribed && typeof roomInstance.setSubscribed === 'function') {
                roomInstance.setSubscribed(publication.trackSid, true).then(() => {
                }).catch((err) => {
                });
              }
            } catch (error) {
            }
          } else if (!publication.trackSid) {
            // Esperar y reintentar suscripción cuando tenga trackSid
            setTimeout(() => {
              const retryPublication = participant.trackPublications.get(publication.trackSid || publication.sid);
              if (retryPublication?.trackSid && !retryPublication.isSubscribed) {
                participant.setSubscribed(retryPublication.trackSid, true).catch(() => {});
              }
            }, 1000);
          }
        });
        
        // 🔥 ESCUCHAR CUANDO LA MODELO PUBLICA SU PROPIO TRACK PARA VERIFICAR QUE SE PUBLIQUE CORRECTAMENTE
        roomInstance.localParticipant.on('trackPublished', (publication) => {
          if (publication.source === Track.Source.Camera) {
            // Verificar que los participantes remotos puedan suscribirse
            if (publication.trackSid && roomInstance.remoteParticipants.size > 0) {
              roomInstance.remoteParticipants.forEach((remoteParticipant) => {
              });
            }
          }
        });
      };

      roomInstance.on('participantConnected', handleParticipantConnected);

      // 🔥 Verificar periódicamente por si se perdió algún evento (más frecuente)
      const checkInterval = setInterval(() => {
        if (roomInstance.state !== 'connected') {
          clearInterval(checkInterval);
          return;
        }

        roomInstance.remoteParticipants.forEach((participant) => {
          if (!participant || typeof participant.setSubscribed !== 'function') {
            return;
          }
          
          participant.trackPublications.forEach((publication) => {
            if (!publication) return;
            
            if (publication.trackSid && !publication.isSubscribed && publication.isEnabled !== false) {
              
              // 🔥 INTENTAR MÚLTIPLES MÉTODOS
              const subscribeTrack = async () => {
                try {
                  // Método 1: participant.setSubscribed
                  if (participant && typeof participant.setSubscribed === 'function') {
                    await participant.setSubscribed(publication.trackSid, true);
                  }
                } catch (error1) {
                  try {
                    // Método 2: room.setSubscribed
                    if (roomInstance && typeof roomInstance.setSubscribed === 'function') {
                      await roomInstance.setSubscribed(publication.trackSid, true);
                    }
                  } catch (error2) {
                  }
                }
              };
              
              subscribeTrack();
            }
          });
        });
      }, 1000); // 🔥 REDUCIDO DE 2s A 1s para detección más rápida

      // Limpiar intervalo cuando se desconecte
      roomInstance.on('disconnected', () => {
        clearInterval(checkInterval);
      });

      forceStopSearching();
    }
  }, [forceStopSearching]);

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

    const cacheKey = `${roomName}_${userName}`;
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
    const cacheKey = `${roomName}_${userName}`;
    USER_CACHE.delete(cacheKey);
    setOtherUser(null);
    setIsDetectingUser(true);

    // 🔥 LIMPIAR TAMBIÉN MENSAJES HÍBRIDOS Y LEGACY
    setMessages([]);
    // Los mensajes híbridos se limpiarán automáticamente en el hook
  };

  // 🔥 FUNCIONES DE CONTROL MEJORADAS
  const cambiarCamara = () => {
    setCamaraPrincipal(prev => prev === "remote" ? "local" : "remote");
  };

  const toggleMirrorMode = useCallback(() => {
    const newMirrorMode = !mirrorMode;
    setMirrorMode(newMirrorMode);
    localStorage.setItem("mirrorMode", JSON.stringify(newMirrorMode));

    // Aplicar espejo a todos los videos
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
          video.style.transform = newMirrorMode ? 'scaleX(-1)' : 'scaleX(1)';
          video.style.webkitTransform = newMirrorMode ? 'scaleX(-1)' : 'scaleX(1)';

          if (newMirrorMode) {
            video.classList.add('mirror-video');
            video.classList.remove('normal-video');
          } else {
            video.classList.add('normal-video');
            video.classList.remove('mirror-video');
          }
        }
      });
    });
  }, [mirrorMode]);

  const enviarMensaje = async () => {
    if (!mensaje.trim() || isSendingMessage) return;
    
    setIsSendingMessage(true);
    const messageToSend = mensaje.trim();
    
    try {
      // Agregar mensaje inmediatamente a la UI para feedback instantáneo
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
      setMensaje(""); // Limpiar input inmediatamente
      
      // Enviar el mensaje usando chatFunctions
      if (chatFunctions?.sendMessage) {
        const success = await chatFunctions.sendMessage(messageToSend);
        
        if (!success) {
          // Si falla, marcar el mensaje como fallido o removerlo
          setMessages(prev => prev.filter(m => m.id !== nuevoMensaje.id));
          setMensaje(messageToSend); // Restaurar el mensaje en el input
          addNotification('error', 'Error', 'No se pudo enviar el mensaje. Intenta de nuevo.');
        }
      } else {
        addNotification('warning', 'Chat', 'El chat no está listo aún. Intenta de nuevo.');
        // Restaurar el mensaje si no hay función disponible
        setMessages(prev => prev.filter(m => m.id !== nuevoMensaje.id));
        setMensaje(messageToSend);
      }
    } catch (error) {
      addNotification('error', 'Error', 'Error al enviar mensaje');
      setMensaje(messageToSend); // Restaurar el mensaje
    } finally {
      setIsSendingMessage(false);
    }
  };

  // ========== FUNCIONES DE CONEXIÓN ==========
  const handleRoomConnected = useCallback(async () => {

    // 🔥 VERIFICAR PERMISOS ANTES DE CONTINUAR
    try {
      const permissions = await navigator.permissions.query({ name: 'camera' });
      const micPermissions = await navigator.permissions.query({ name: 'microphone' });

      if (permissions.state === 'denied' || micPermissions.state === 'denied') {
        // Intentar solicitar permisos
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraEnabled,
          audio: micEnabled
        });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
    }

    setConnected(true);
    iniciarTiempoReal();
    addNotification('success', 'Conectado', 'Videollamada establecida exitosamente');

    // 🔥 DELAY ANTES DE DETENER BÚSQUEDA PARA PERMITIR PUBLICACIÓN DE TRACKS
    setTimeout(() => {
      forceStopSearching();
    }, 2000);

  }, [addNotification, forceStopSearching, cameraEnabled, micEnabled]);

  const handleRoomDisconnected = useCallback(() => {
    setConnected(false);
    detenerTiempoReal();
    addNotification('warning', 'Desconectado', 'Se perdió la conexión');
  }, [addNotification]);

  // ========== FUNCIONES DE DISPOSITIVOS - OPTIMIZADO ==========
  const loadDevices = async () => {
    setIsLoadingDevices(true);
    try {
      // 🔥 OPTIMIZACIÓN: Intentar obtener dispositivos directamente primero (más rápido)
      let devices = [];
      try {
        devices = await navigator.mediaDevices.enumerateDevices();
        
        // Si los dispositivos tienen labels, significa que ya tenemos permisos
        const hasLabels = devices.some(d => d.label && d.label.length > 0);
        
        if (!hasLabels) {
          // Solo solicitar permisos si no tenemos labels
          try {
            // 🔥 INTENTAR OBTENER PERMISOS - Si la cámara ya está activa, puede que ya tengamos permisos
            // Intentar primero sin constraints específicos
            const stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true
            });
            // Obtener dispositivos nuevamente con permisos
            devices = await navigator.mediaDevices.enumerateDevices();
            // Cerrar el stream temporal inmediatamente
            stream.getTracks().forEach(track => track.stop());
          } catch (permError) {
            // Si falla, puede ser porque la cámara ya está activa - intentar enumerar de nuevo
            try {
              devices = await navigator.mediaDevices.enumerateDevices();
            } catch (enumError) {
            }
          }
        } else {
        }
      } catch (permError) {
        // Intentar enumerar de nuevo como fallback
        try {
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (enumError) {
        }
      }

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

    } catch (error) {
      // 🔥 EN CASO DE ERROR, INTENTAR CARGAR DISPOSITIVOS SIN LABELS COMO FALLBACK
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        if (videoDevices.length > 0 || audioDevices.length > 0) {
          setCameras(videoDevices);
          setMicrophones(audioDevices);
        }
      } catch (fallbackError) {
        addNotification('error', 'Error', 'No se pudieron obtener los dispositivos de audio/video');
      }
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // 🔥 CAMBIO DE CÁMARA - APLICACIÓN INMEDIATA CON switchActiveDevice
  const handleCameraChange = async (deviceId) => {
    setSelectedCameraDevice(deviceId);
    
    // 🔥 APLICAR INMEDIATAMENTE si la room está conectada
    if (room && room.state === 'connected' && room.localParticipant && cameraEnabled) {
      try {
        const localParticipant = room.localParticipant;
        
        // 🔥 MÉTODO 1: Usar switchActiveDevice si está disponible (MÁS RÁPIDO)
        if (localParticipant && typeof localParticipant.switchActiveDevice === 'function') {
          try {
            await localParticipant.switchActiveDevice('videoinput', deviceId);
            isChangingCamera.current = false;
            return;
          } catch (error) {
            // Continuar con otros métodos
          }
        }
        
        // 🔥 MÉTODO 2: Usar room.switchActiveDevice si está disponible
        if (room && typeof room.switchActiveDevice === 'function') {
          try {
            await room.switchActiveDevice('videoinput', deviceId);
            isChangingCamera.current = false;
            return;
          } catch (error) {
            // 🔥 MANEJO ESPECÍFICO DE NotReadableError
            if (error.name === 'NotReadableError' || error.message?.includes('Could not start video source')) {
              // Esperar más tiempo para que la cámara se libere
              await new Promise(resolve => setTimeout(resolve, 2000));
              // NO continuar con switchActiveDevice, usar método alternativo directamente
            } else {
            }
            // Continuar con otros métodos
          }
        }
        
        // 🔥 MÉTODO 3: Desactivar y reactivar con nuevo dispositivo (fallback)
        // 🔥 IMPORTANTE: Para modelo, NO desactivar completamente, solo cambiar dispositivo
        
        // Definir constraints una sola vez
        const constraints = {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
        
        // Intentar cambiar dispositivo directamente primero
        try {
          await localParticipant.setCameraEnabled(true, { video: constraints });
          isChangingCamera.current = false;
          return;
        } catch (directError) {
          // 🔥 MANEJO ESPECÍFICO DE NotReadableError
          if (directError.name === 'NotReadableError' || directError.message?.includes('Could not start video source')) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Intentar una vez más después de esperar
            try {
              await localParticipant.setCameraEnabled(true, { video: constraints });
              isChangingCamera.current = false;
              return;
            } catch (retryError) {
              // Continuar con método fallback solo si es necesario
            }
          }
        }
        
        // 🔥 MÉTODO FALLBACK: Desactivar brevemente y reactivar (SOLO PARA MODELO CUANDO ES ABSOLUTAMENTE NECESARIO)
        // Este método puede causar un breve parpadeo pero es más confiable cuando switchActiveDevice falla
        try {
          
          // 🔥 DESACTIVAR SOLO POR UN MOMENTO MÍNIMO
          await localParticipant.setCameraEnabled(false);
          // 🔥 DELAY MÁS LARGO para asegurar que se detenga completamente
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Reactivar con nuevo dispositivo
          await localParticipant.setCameraEnabled(true, { video: constraints });
        } catch (fallbackError) {
          // 🔥 MANEJO ESPECÍFICO DE NotReadableError
          if (fallbackError.name === 'NotReadableError' || fallbackError.message?.includes('Could not start video source')) {
            // Intentar reactivar con el dispositivo anterior si es posible
            try {
              await localParticipant.setCameraEnabled(true);
            } catch (reactivateError) {
            }
          }
        } finally {
          isChangingCamera.current = false;
        }
      } catch (error) {
        isChangingCamera.current = false;
      }
    } else {
      isChangingCamera.current = false;
    }
  };

  // 🔥 CAMBIO DE MICRÓFONO - APLICACIÓN INMEDIATA CON switchActiveDevice
  const handleMicrophoneChange = async (deviceId) => {
    
    // 🔥 PREVENIR MÚLTIPLES CAMBIOS SIMULTÁNEOS
    if (isChangingMicrophone.current) {
      return;
    }
    
    // 🔥 PREVENIR CAMBIOS AL MISMO DISPOSITIVO
    if (deviceId === lastMicrophoneDeviceId.current) {
      return;
    }
    
    setSelectedMicrophoneDevice(deviceId);
    isChangingMicrophone.current = true;
    lastMicrophoneDeviceId.current = deviceId;
    
    // 🔥 APLICAR INMEDIATAMENTE si la room está conectada
    if (room && room.state === 'connected' && room.localParticipant && micEnabled) {
      try {
        const localParticipant = room.localParticipant;
        
        // 🔥 MÉTODO 1: Usar switchActiveDevice si está disponible (MÁS RÁPIDO)
        if (localParticipant && typeof localParticipant.switchActiveDevice === 'function') {
          try {
            await localParticipant.switchActiveDevice('audioinput', deviceId);
            isChangingMicrophone.current = false;
            return;
          } catch (error) {
            // Continuar con otros métodos
          }
        }
        
        // 🔥 MÉTODO 2: Usar room.switchActiveDevice si está disponible
        if (room && typeof room.switchActiveDevice === 'function') {
          try {
            await room.switchActiveDevice('audioinput', deviceId);
            isChangingMicrophone.current = false;
            return;
          } catch (error) {
            // Continuar con otros métodos
          }
        }
        
        // 🔥 MÉTODO 3: Desactivar y reactivar con nuevo dispositivo (fallback)
        await localParticipant.setMicrophoneEnabled(false);
        // 🔥 DELAY MÍNIMO para asegurar que se detenga
        await new Promise(resolve => setTimeout(resolve, 100)); // REDUCIDO DE 300ms
        
        const constraints = {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        };
        
        await localParticipant.setMicrophoneEnabled(true, { audio: constraints });
      } catch (error) {
      } finally {
        isChangingMicrophone.current = false;
      }
    } else {
      isChangingMicrophone.current = false;
    }
  };

  // ========== FUNCIONES DE MENSAJES ==========
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
    console.log('🎁 [VIDEOCHAT] handleRequestGift llamado con:', { giftId, recipientId, roomName, message });
    try {
      const selectedGift = gifts.find(g => g.id === giftId);

      if (!selectedGift) {
        addNotification('error', 'Error', 'Regalo no encontrado');
        return { success: false, error: 'Regalo no encontrado' };
      }

      const result = await requestGift(giftId, message);

      if (result.success) {
        setShowGiftsModal(false);

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
            gift_image: selectedGift.image || selectedGift.image_url || selectedGift.image_path || selectedGift.pic || selectedGift.icon || null,
            gift_price: selectedGift.price,
            action_text: "Pediste",
            recipient_name: otherUser?.name || "Cliente",
            original_message: message || ""
          },
          extra_data: {
            gift_name: selectedGift.name,
            gift_image: selectedGift.image || selectedGift.image_url || selectedGift.image_path || selectedGift.pic || selectedGift.icon || null,
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

  // ========== FUNCIONES DE DESCONEXIÓN ==========
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
    }

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
    }

    if (roomName && tiempoFinalSesion > 0) {
      try {
        await enviarTiempoReal(roomName, tiempoFinalSesion);
      } catch (error) {
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

    // 🔥 LLAMAR A endRoom EN EL BACKEND PARA LIMPIEZA COMPLETA
    if (roomName) {
      try {
        await fetch(`${API_BASE_URL}/api/livekit/end-room`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            roomName,
            userName: userData?.name || 'Modelo'
          })
        }).catch(() => {}); // Ignorar errores, ya estamos limpiando
      } catch (error) {
      }
    }

    // Limpiar datos (localStorage y sessionStorage)
    const itemsToRemove = [
      'roomName', 'userName', 'currentRoom',
      'inCall', 'sessionTime', 'sessionStartTime', 'videochatActive'
    ];

    itemsToRemove.forEach(item => {
      localStorage.removeItem(item);
      sessionStorage.removeItem(item);
    });

    navigate('/homellamadas', { replace: true });
  }, [roomName, navigate, addNotification, otherUser, userData, tiempo]);

  // ========== FUNCIONES DE FAVORITOS Y BLOQUEO ==========
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

  // ========== FUNCIONES DE UI ==========
  const getDisplayName = () => {
    if (!roomName || !userName) return "Configurando...";

    const cacheKey = `${roomName}_${userName}`;
    const cached = USER_CACHE.get(cacheKey);

    if (cached) return cached.name;
    if (otherUser) return otherUser.name;
    if (isDetectingUser) return "Conectando...";

    return "Esperando chico...";
  };

  // ========== FUNCIONES DE RATE LIMITING ==========
  // 🔥 handleRateLimit ya está definido arriba, antes del useEffect para obtener token

  // ========== FUNCIONES DE DESCONEXIÓN ==========
  const startRedirectCountdown = useCallback(() => {
    let timeLeft = 3;
    setRedirectCountdown(timeLeft);

    const countdownInterval = setInterval(() => {
      timeLeft--;
      setRedirectCountdown(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }, []);

  const handleClientDisconnected = useCallback((reason = 'stop', customMessage = '') => {
    setLoading(false);
    setConnected(false);
    detenerTiempoReal();

    if (reason === 'next' || reason === 'partner_went_next') {
      setDisconnectionReason(customMessage || 'El chico te saltó y fue a la siguiente persona');
    } else if (reason === 'stop' || reason === 'partner_left_session') {
      setClientDisconnected(true);
      setDisconnectionReason(customMessage || 'El chico se desconectó de la videollamada');
    } else {
      setClientDisconnected(true);
      setDisconnectionReason(customMessage || 'El chico salió de la sesión');
    }

    startRedirectCountdown();
  }, [detenerTiempoReal, startRedirectCountdown]);

  // ========== FUNCIONES DE CONTROLES ==========
  const toggleMic = useCallback(async () => {
    // 🔥 PERMITIR DESACTIVAR/ACTIVAR MICRÓFONO PARA MODELO
    const newValue = !micEnabled;
    setMicEnabled(newValue);
    
    // 🔥 ACTUALIZAR EN LIVEKIT INMEDIATAMENTE
    try {
      const currentRoom = room || window.livekitRoom;
      if (currentRoom?.localParticipant) {
        await currentRoom.localParticipant.setMicrophoneEnabled(newValue);
        console.log(`🔊 [${userData?.role || 'MODELO'}] Micrófono ${newValue ? 'activado' : 'desactivado'} en LiveKit`);
      }
    } catch (error) {
      console.error('❌ Error actualizando micrófono en LiveKit:', error);
    }
  }, [micEnabled, room, userData?.role]);

  const toggleCamera = useCallback(() => {
    // 🔥 PARA MODELO: La cámara siempre debe estar encendida, no permitir desactivarla
    if (userData?.role === 'modelo') {
      // Asegurar que esté encendida
      if (!cameraEnabled) {
        setCameraEnabled(true);
      }
      return;
    }
    setCameraEnabled(prev => !prev);
  }, [cameraEnabled, userData?.role]);

  const toggleVolume = useCallback(() => {
    setVolumeEnabled(prev => !prev);
  }, []);

  // ========== EFECTOS ==========
  const initKeyRef = useRef(null);

  useEffect(() => {
    // Este efecto solo carga la información del usuario local.
    // La obtención del token de LiveKit la realiza el efecto `getTokenWithRetry` más abajo
    const initialize = async () => {
      try {
        const user = await getUser(false);
        setUserData({
          name: user.alias || user.name || user.username || "",
          role: user.rol || user.role || "modelo",
          id: user.id
        });
      } catch (error) {
        // solo registrar y permitir que el efecto de getUser separado maneje notificaciones/errores
        console.warn('[VideoChat][MODELO] initialize getUser failed', error?.message || error);
      }
    };

    const key = `${roomName}_${userName}`;
    // No hacer nada si faltan parámetros; el efecto de token se encargará de setear errores/loading
    if (!roomName || !userName) return;
    // Ejecutar solo la carga de usuario (no token) para evitar llamadas duplicadas
    initialize();
  }, [roomName, userName]);

  // 🔥 EFECTO PARA CARGAR MENSAJES CUANDO SE CONECTA
  useEffect(() => {
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
                // Preservar el type original si es un tipo especial (gift_sent, gift_received, gift_request)
                let messageType = msg.type;
                if (!messageType || !['gift_sent', 'gift_received', 'gift_request', 'gift'].includes(messageType)) {
                  // Si no es un tipo especial, determinar si es local o remote
                  messageType = (msg.user_id === userData?.id) ? 'local' : 'remote';
                }
                
                return {
                  id: msg.id,
                  type: messageType,
                  text: msg.message,
                  message: msg.message,
                  timestamp: new Date(msg.created_at).getTime(),
                  sender: msg.user_name,
                  senderRole: msg.user_role,
                  user_id: msg.user_id,
                  isOld: true,
                  ...(msg.gift_data && { gift_data: msg.gift_data }),
                  ...(msg.extra_data && { extra_data: msg.extra_data })
                };
              }).sort((a, b) => {
                // 🔥 ORDENAMIENTO MEJORADO - Usar múltiples fuentes de timestamp
                const getTimestamp = (msg) => {
                  if (msg.timestamp && typeof msg.timestamp === 'number' && msg.timestamp > 0) {
                    return msg.timestamp;
                  }
                  if (msg.created_at) {
                    const date = new Date(msg.created_at);
                    if (!isNaN(date.getTime()) && date.getTime() > 0) {
                      return date.getTime();
                    }
                  }
                  if (msg.id) {
                    const idNum = typeof msg.id === 'string' ? parseInt(msg.id) : msg.id;
                    if (typeof idNum === 'number' && idNum > 1000000000000) {
                      return idNum;
                    }
                  }
                  return 0;
                };
                
                const timeA = getTimestamp(a);
                const timeB = getTimestamp(b);
                
                // Orden descendente (más recientes primero) para este caso específico
                if (timeA !== timeB && timeA > 0 && timeB > 0) {
                  return timeB - timeA;
                }
                if (timeA > 0 && timeB === 0) return -1;
                if (timeA === 0 && timeB > 0) return 1;
                
                const idA = typeof a.id === 'string' ? parseInt(a.id) || 0 : (a.id || 0);
                const idB = typeof b.id === 'string' ? parseInt(b.id) || 0 : (b.id || 0);
                return idB - idA;
              });

              setMessages(formattedMessages);
            }
          }
        } catch (error) {
        }
      };

      loadMessages();
    }
  }, [roomName, connected, userData?.id]);

  // 🔥 EFECTO PARA LIMPIAR MENSAJES CUANDO CAMBIA LA SALA
  useEffect(() => {
    setMessages([]);
    setMensaje("");
  }, [roomName]);

  // 🔥 EFECTO PARA HEARTBEAT
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

  // 🔥 EFECTO PARA CARGAR USUARIO
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

  // 🔥 normalizedRoomName y normalizedUserName ya están calculados arriba
  // 🔥 El useEffect para obtener el token ya está movido arriba, justo después de calcular normalizedRoomName y normalizedUserName

  // 🔥 EFECTO PARA ESPEJO
  useEffect(() => {
    const savedMirrorMode = localStorage.getItem("mirrorMode");
    const shouldMirror = savedMirrorMode ? JSON.parse(savedMirrorMode) : true;

    setMirrorMode(shouldMirror);

    const timer = setTimeout(() => {
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
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // 🔥 EFECTO PARA CARGAR DISPOSITIVOS
  useEffect(() => {
    // 🔥 CARGAR DISPOSITIVOS CON DELAY PARA EVITAR CONFLICTOS CON LA ACTIVACIÓN AUTOMÁTICA DE CÁMARA
    const loadDevicesWithDelay = () => {
      setTimeout(() => {
        loadDevices();
      }, 500); // Esperar 500ms para que la cámara se active primero
    };
    
    loadDevicesWithDelay();

    const handleDeviceChange = () => {
      setTimeout(() => loadDevices(), 1000);
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  // 🔥 EFECTO PARA CONFIGURAR ROOM INSTANCE
  useEffect(() => {
    const handleRoomReady = (event) => {
      if (event.detail && event.detail.room) {
        setRoom(event.detail.room);
      }
    };

    window.addEventListener('livekitRoomReady', handleRoomReady);

    if (window.livekitRoom && !room) {
      setRoom(window.livekitRoom);
    }

    return () => {
      window.removeEventListener('livekitRoomReady', handleRoomReady);
    };
  }, [room]);

  // 🔥 EFECTO PARA FORZAR PUBLICACIÓN DE CÁMARA CUANDO cameraEnabled CAMBIA A TRUE
  useEffect(() => {
    if (room && room.state === 'connected' && room.localParticipant && cameraEnabled) {
      // Verificar si ya hay una publicación de cámara activa
      const cameraPublication = Array.from(room.localParticipant.videoTrackPublications.values())
        .find(pub => pub.source === Track.Source.Camera && pub.isEnabled);
      
      // Si no hay publicación o está deshabilitada, forzar publicación
      if (!cameraPublication || !cameraPublication.isEnabled) {
        room.localParticipant.setCameraEnabled(true).catch(error => {
        });
      }
    }
  }, [room, cameraEnabled]);

  // 🔥 EFECTO PARA APLICAR CONFIGURACIONES CUANDO CAMBIA LA ROOM - OPTIMIZADO
  useEffect(() => {
    if (room && connected && room.state === 'connected' && room.localParticipant) {
      // 🔥 LIMPIAR TIMEOUT ANTERIOR si existe
      if (applyDevicesTimeoutRef.current) {
        clearTimeout(applyDevicesTimeoutRef.current);
      }
      
      // 🔥 DEBOUNCING: Esperar 1 segundo antes de aplicar cambios para evitar ejecuciones múltiples
      // Aumentado a 1 segundo para dar más tiempo entre cambios y evitar NotReadableError
      applyDevicesTimeoutRef.current = setTimeout(async () => {
        // Verificar nuevamente que el room esté conectado antes de cambiar dispositivos
        if (room.state === 'connected' && room.localParticipant) {
          try {
            // 🔥 SOLO APLICAR SI EL DISPOSITIVO ES DIFERENTE AL ÚLTIMO APLICADO Y NO HAY CAMBIO EN PROGRESO
            if (selectedCameraDevice && cameraEnabled && 
                selectedCameraDevice !== lastAppliedCameraDevice.current &&
                !isChangingCamera.current &&
                selectedCameraDevice !== lastCameraDeviceId.current) {
              lastAppliedCameraDevice.current = selectedCameraDevice;
              await handleCameraChange(selectedCameraDevice);
            }

            if (selectedMicrophoneDevice && micEnabled && 
                selectedMicrophoneDevice !== lastAppliedMicrophoneDevice.current &&
                !isChangingMicrophone.current &&
                selectedMicrophoneDevice !== lastMicrophoneDeviceId.current) {
              lastAppliedMicrophoneDevice.current = selectedMicrophoneDevice;
              await handleMicrophoneChange(selectedMicrophoneDevice);
            }
          } catch (error) {
            // Si es NotReadableError, resetear flags para permitir reintento más tarde
            if (error.name === 'NotReadableError' || error.message?.includes('Could not start video source')) {
              isChangingCamera.current = false;
              isChangingMicrophone.current = false;
            }
          }
        } else {
        }
      }, 1000); // 🔥 DEBOUNCING DE 1 segundo para evitar conflictos

      // Aplicar mirror mode a los videos
      setTimeout(() => {
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
              video.style.transform = mirrorMode ? 'scaleX(-1)' : 'scaleX(1)';
              video.style.webkitTransform = mirrorMode ? 'scaleX(-1)' : 'scaleX(1)';
            }
          });
        });
      }, 2000);
    }
    
    return () => {
      if (applyDevicesTimeoutRef.current) {
        clearTimeout(applyDevicesTimeoutRef.current);
      }
    };
  }, [room, connected, selectedCameraDevice, cameraEnabled, selectedMicrophoneDevice, micEnabled, mirrorMode]);

  // 🔥 EFECTO PARA TRADUCIR MENSAJES - OPTIMIZADO
  useEffect(() => {
    // 🚫 NO EJECUTAR SI NO HAY TRADUCCIÓN HABILITADA
    if (!translationSettings?.enabled || !messages.length) return;

    const processMessagesForTranslation = async () => {
      const unprocessedMessages = messages.filter(msg => !msg.processed);

      // 🚫 NO HACER NADA SI TODOS LOS MENSAJES YA ESTÁN PROCESADOS
      if (unprocessedMessages.length === 0) return;

      for (const message of unprocessedMessages) {
        // 🚫 VERIFICAR NUEVAMENTE POR SI CAMBIÓ DURANTE EL LOOP
        if (message.processed || !translationSettings?.enabled) break;

        try {
          const result = await translateMessage(message);
          if (result) {
            message.processed = true;
          }
        } catch (error) {
          // Silenciar errores para evitar spam
        }
      }
    };

    // ✅ PEQUEÑO DELAY PARA EVITAR EJECUCIONES CONSTANTES
    const timeoutId = setTimeout(processMessagesForTranslation, 500);

    return () => clearTimeout(timeoutId);
  }, [messages.length, translateMessage, translationSettings.enabled]); // ✅ DEPENDENCIA SOLO EN LENGTH, NO EN EL ARRAY COMPLETO

  // 🔥 EFECTO PARA DETENER LOADING CUANDO CONECTA - OPTIMIZADO
  useEffect(() => {
    // 🚫 NO EJECUTAR SI YA ESTAMOS DETENIENDO LA BÚSQUEDA
    if (!connected || !token || !chatFunctions || loading === false) return;

    const shouldStopLoading =
      chatFunctions.participantsCount > 1 ||
      chatFunctions.hasOtherParticipant ||
      !chatFunctions.isDetecting;

    if (shouldStopLoading) {
      forceStopSearching();
    }
  }, [connected, token, chatFunctions?.participantsCount, chatFunctions?.hasOtherParticipant, chatFunctions?.isDetecting, loading]); // ✅ DEPENDENCIAS MÁS ESPECÍFICAS

  // 🔥 EFECTO PARA ESTABLECER CHAT FUNCTIONS
  useEffect(() => {
    window.livekitChatFunctions = (functions) => {
      setChatFunctions(functions);

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
  }, [roomName, userName]);

  // 🔥 EFECTO PARA POLLING DE NOTIFICACIONES - OPTIMIZADO
  useEffect(() => {
    // 🚫 NO EJECUTAR SI NO ESTAMOS CONECTADOS O SI EL MODELO SE DETUVO
    if (!roomName || !userName || !connected || modeloStoppedWorking || clientDisconnected) {
      return;
    }

    let isPolling = true;
    let pollInterval = 5000; // ✅ AUMENTADO A 5 SEGUNDOS PARA REDUCIR CARGA
    let consecutiveEmpty = 0;

    const checkNotifications = async () => {
      // 🚫 DOBLE VERIFICACIÓN PARA EVITAR EJECUCIONES INNECESARIAS
      if (!isPolling || modeloStoppedWorking || clientDisconnected) {
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

        const data = await response.json();

        if (data.success && data.has_notifications) {
          consecutiveEmpty = 0;
          const notification = data.notification;

          isPolling = false; // ✅ DETENER POLLING DESPUÉS DE RECIBIR NOTIFICACIÓN

          if (notification.type === 'partner_went_next') {
            localStorage.removeItem('sessionTime');
            localStorage.removeItem('sessionStartTime');

            const tiempoActual = tiempo;
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

            const tiempoActual = tiempo;
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
            pollInterval = Math.min(pollInterval + 2000, 15000); // ✅ MÁXIMO 15 SEGUNDOS
          }
        }
      } catch (error) {
        // Silenciar errores para evitar spam
      }

      // ✅ CONTINUAR POLLING SOLO SI TODAS LAS CONDICIONES SE MANTIENEN
      if (isPolling && !modeloStoppedWorking && !clientDisconnected && connected) {
        setTimeout(checkNotifications, pollInterval);
      }
    };

    // ✅ PEQUEÑO DELAY INICIAL PARA EVITAR EJECUCIONES INMEDIATAS
    const initialTimeout = setTimeout(checkNotifications, 2000);

    return () => {
      clearTimeout(initialTimeout);
      isPolling = false;
    };
  }, [roomName, userName, connected, modeloStoppedWorking, clientDisconnected]); // ✅ DEPENDENCIAS REDUCIDAS

  // 🔥 EFECTO PARA RESET FLAGS (solo cuando cambia la sala, no cuando hay desconexión activa)
  useEffect(() => {
    // 🔥 IMPORTANTE: NO resetear si hay una desconexión activa (para que se muestre el modal)
    const hasActiveDisconnection = clientDisconnected || (disconnectionReason && disconnectionReason.trim() !== '');
    
    if (hasActiveDisconnection) {
      return;
    }
    
    setModeloStoppedWorking(false);
    setReceivedNotification(false);
    setClientDisconnected(false);
    setClientWentNext(false);
    setDisconnectionReason('');
    setDisconnectionType('');
    setRedirectCountdown(0);
  }, [roomName, clientDisconnected, disconnectionReason]);

  // 🔥 EFECTO PARA DETECTAR DESCONEXIÓN DEL CLIENTE (similar al cliente detectando modelo)
  useEffect(() => {
    if (!connected || !window.livekitRoom || clientDisconnected || (disconnectionReason && redirectCountdown > 0)) {
      return;
    }

    const room = window.livekitRoom;
    let isActive = true;

    const handleParticipantDisconnected = (participant) => {
      if (!isActive) return;
      
      const remoteCount = room?.remoteParticipants?.size || 0;
      
      // 🔥 SOLO DETECTAR DESCONEXIÓN SI YA HABÍA UNA SESIÓN ACTIVA
      const hadActiveSession = tiempo > 0 || !!otherUser;
      
      // 🔥 DETECTAR SI ES EL CLIENTE Y MANEJAR INMEDIATAMENTE
      if (participant && participant.identity) {
        const participantIdentity = participant.identity.toLowerCase();
        const isClient = participantIdentity.includes('cliente') || 
                        participantIdentity.includes('client') ||
                        (otherUser && otherUser.role === 'cliente' && participantIdentity.includes(otherUser.name?.toLowerCase()));
        
        if (isClient && remoteCount === 0 && connected && hadActiveSession && !clientDisconnected && !(disconnectionReason && redirectCountdown > 0)) {
          // 🔥 CAMBIO: Cuando el cliente se desconecta, mostrar pantalla de desconexión
          handleClientDisconnected('partner_left_session', 'El cliente se desconectó de la videollamada');
          return;
        }
      }
      
      // Si no hay participantes remotos y había sesión activa, también detectar desconexión
      if (remoteCount === 0 && connected && hadActiveSession && !clientDisconnected && !(disconnectionReason && redirectCountdown > 0)) {
        handleClientDisconnected('partner_left_session', 'El cliente se desconectó de la videollamada');
      }
    };

    if (room) {
      room.on('participantDisconnected', handleParticipantDisconnected);
    }

    return () => {
      isActive = false;
      if (room) {
        room.off('participantDisconnected', handleParticipantDisconnected);
      }
    };
  }, [connected, clientDisconnected, disconnectionReason, redirectCountdown, tiempo, otherUser, handleClientDisconnected]);

  // 🔥 EFECTO PARA TIMER LEGACY - OPTIMIZADO PARA EVITAR RE-RENDERS
  useEffect(() => {
    // Solo ejecutar si estamos conectados y no hay modelo parada
    if (!connected || modeloStoppedWorking) return;

    const intervalo = setInterval(() => {
      setTiempo((prev) => {
        // Evitar actualizaciones innecesarias si el componente se va a desmontar
        if (modeloStoppedWorking) return prev;
        return prev + 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalo);
      if (tiempoIntervalRef.current) {
        clearInterval(tiempoIntervalRef.current);
        tiempoIntervalRef.current = null;
      }
    };
  }, [connected, modeloStoppedWorking]); // ✅ DEPENDENCIAS PARA CONTROLAR EJECUCIÓN

  // 🔥 EFECTO PARA VERIFICAR FAVORITOS
  useEffect(() => {
    if (otherUser?.id) {
      checkIfFavorite(otherUser.id);
    } else {
      setIsFavorite(false);
    }
  }, [otherUser?.id]);

  // 🔥 EFECTO PARA GUARDAR PARÁMETROS
  useEffect(() => {
    if (roomName && roomName !== 'null' && roomName !== 'undefined') {
      localStorage.setItem("roomName", roomName);
    }
    if (userName && userName !== 'null' && userName !== 'undefined') {
      localStorage.setItem("userName", userName);
    }
  }, [roomName, userName]);

  // 🔥 REF para rastrear el último roomName procesado y prevenir desconexiones múltiples
  const lastProcessedRoomName = useRef('');
  const isDisconnecting = useRef(false);
  
  // 🔥 EFECTO PARA RESETEAR ESTADO DE CONEXIÓN CUANDO CAMBIA LA SALA
  useEffect(() => {
    // #region agent log
    // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2334',message:'Effect reset connection triggered',data:{memoizedRoomName,lastProcessed:lastProcessedRoomName.current,isDisconnecting:isDisconnecting.current,roomState:room?.state,windowRoomState:window.livekitRoom?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // 🔥 PREVENIR EJECUCIONES MÚLTIPLES
    if (!normalizedRoomName || normalizedRoomName === lastProcessedRoomName.current) {
      return; // No hacer nada si es el mismo roomName o no hay roomName
    }
    
    // 🔥 PREVENIR DESCONEXIONES SIMULTÁNEAS
    if (isDisconnecting.current) {
      return;
    }
    
    // Actualizar lastProcessedRoomName ANTES de desconectar para evitar ejecuciones múltiples
    lastProcessedRoomName.current = normalizedRoomName;
    
    // 🔥 DESCONECTAR CONEXIÓN LIVEKIT ANTERIOR SI EXISTE
    const disconnectPreviousRoom = async () => {
      // #region agent log
      // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2350',message:'disconnectPreviousRoom called',data:{memoizedRoomName,hasWindowRoom:!!window.livekitRoom,windowRoomState:window.livekitRoom?.state,windowRoomName:window.livekitRoom?.name,hasRoom:!!room,roomState:room?.state,roomName:room?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      isDisconnecting.current = true;
      try {
        // Desconectar room global si existe Y es diferente al nuevo roomName
        if (window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
          const currentRoomName = window.livekitRoom.name;
          // #region agent log
          // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2354',message:'Checking window room before disconnect',data:{currentRoomName,memoizedRoomName,roomState:window.livekitRoom.state,willDisconnect:currentRoomName !== memoizedRoomName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          if (currentRoomName !== normalizedRoomName) {
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2358',message:'Calling window.livekitRoom.disconnect',data:{currentRoomName,memoizedRoomName,roomState:window.livekitRoom.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            await window.livekitRoom.disconnect();
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2359',message:'window.livekitRoom.disconnect completed',data:{currentRoomName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            window.livekitRoom = null;
          } else {
          }
        }
        
        // Desconectar room local si existe Y es diferente al nuevo roomName
        if (room && room.state !== 'disconnected') {
          const currentRoomName = room.name;
          // #region agent log
          // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2366',message:'Checking local room before disconnect',data:{currentRoomName,memoizedRoomName,roomState:room.state,willDisconnect:currentRoomName !== memoizedRoomName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          if (currentRoomName !== normalizedRoomName) {
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2370',message:'Calling room.disconnect',data:{currentRoomName,memoizedRoomName,roomState:room.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            await room.disconnect();
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2371',message:'room.disconnect completed',data:{currentRoomName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
          } else {
          }
        }
      } catch (error) {
        // #region agent log
        // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2375',message:'Error in disconnectPreviousRoom',data:{errorName:error.name,errorMessage:error.message,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        // Si es ConnectionError de "Client initiated disconnect", ignorarlo (ya está desconectado)
        if (error.name === 'ConnectionError' && error.message.includes('Client initiated disconnect')) {
        }
      } finally {
        isDisconnecting.current = false;
        // #region agent log
        // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2383',message:'disconnectPreviousRoom finished',data:{memoizedRoomName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      }
    };
    
    disconnectPreviousRoom();
    
    // Resetear estados cuando cambia la sala (ya verificamos que cambió arriba)
    setConnectionAttempted(false);
    setConnected(false);
    setToken('');
    setServerUrl('');
    setLoading(true);
    setError(null);
    setRoom(null);
    
    // Limpiar mensajes
    setMessages([]);
    setMensaje("");
  }, [normalizedRoomName, normalizedUserName]);

  // 🔥 EFECTO DE CLEANUP
  useEffect(() => {
    return () => {
      if (tiempoIntervalRef.current) {
        clearInterval(tiempoIntervalRef.current);
        tiempoIntervalRef.current = null;
      }
      tiempoInicioRef.current = null;
    };
  }, []);

  // 🔥 EFECTO PARA CÁMARA PRINCIPAL
  useEffect(() => {
    const initialCamera = location.state?.camaraPrincipal ||
      (userData.role === 'modelo' ? 'local' : 'remote');
    setCamaraPrincipal(initialCamera);
  }, [location.state, userData.role]);

  // ========== RENDER ==========
  console.log('🔍 [VideoChat][MODELO] INICIO DEL RENDER', {
    clientDisconnected,
    loading,
    error,
    hasToken: !!token,
    tokenType: typeof token,
    tokenIsString: typeof token === 'string',
    tokenLength: typeof token === 'string' ? token.length : 0,
    hasServerUrl: !!serverUrl,
    serverUrlType: typeof serverUrl,
    serverUrlIsString: typeof serverUrl === 'string',
    willRender: !loading && !error && token && serverUrl
  });

  if (clientDisconnected) {
    return (
      <DisconnectionScreenImproved
        disconnectionType="disconnected"
        disconnectionReason={disconnectionReason}
        redirectCountdown={redirectCountdown}
        t={t}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0d10] to-[#131418] text-white overflow-hidden" style={{ maxWidth: '100vw', width: '100%' }}>
      {/* Sistema de notificaciones */}
      <NotificationSystemImproved
        notifications={notifications}
        onRemove={removeNotification}
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
                onClick={() => navigate('/homellamadas')}
                className="bg-[#ff007a] px-6 py-3 rounded-full text-white font-medium"
              >
                Volver a Inicio
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 px-6 py-3 rounded-full text-white font-medium"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !token && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md mx-auto">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
            <p className="text-white text-lg mb-4">Esperando token de conexión...</p>
            <p className="text-gray-400 text-sm mb-4">Si esto persiste, verifica tu conexión</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#ff007a] px-6 py-3 rounded-full text-white font-medium"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
      
      {!loading && !error && token && (
        <>
        <LiveKitRoom
          key={`room-${memoizedRoomName}-${memoizedUserName}`} // ✅ KEY MÁS ESTABLE
          video={cameraEnabled} // 🔥 ACTIVAR SIEMPRE QUE cameraEnabled SEA TRUE (para modelo siempre debe estar activo)
          audio={micEnabled} // 🔥 ACTIVAR SIEMPRE QUE micEnabled SEA TRUE
          token={token}
          serverUrl={serverUrl}
          videoCaptureDefaults={selectedCameraDevice ? { deviceId: selectedCameraDevice } : undefined}
          audioCaptureDefaults={selectedMicrophoneDevice ? { deviceId: selectedMicrophoneDevice } : undefined}
          options={{
            // 🔥 CONFIGURACIÓN EXPLÍCITA PARA ASEGURAR PUBLICACIÓN AUTOMÁTICA
          }}
          onConnected={() => {
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2526',message:'LiveKitRoom onConnected',data:{memoizedRoomName,roomState:window.livekitRoom?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
            setConnectionAttempted(true);
            // La lógica de conexión se maneja en RoomCapture
          }}
          onDisconnected={(reason) => {
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2488',message:'onDisconnected callback triggered',data:{reason,isDisconnecting:isDisconnecting.current,roomState:window.livekitRoom?.state,roomName:window.livekitRoom?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            // 🔥 IGNORAR DESCONEXIONES SI YA ESTAMOS DESCONECTANDO MANUALMENTE
            if (isDisconnecting.current) {
              // #region agent log
              // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2490',message:'Ignoring disconnect - manual disconnect in progress',data:{reason},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              return;
            }
            
            
            // Detectar si es un error de identidad duplicada (código 2)
            if (reason === 2 || reason === 'DuplicateIdentity') {
            }
            
            // 🔥 SOLO LLAMAR handleRoomDisconnected SI NO ES UNA DESCONEXIÓN MANUAL
            // Verificar si la razón es "Client initiated disconnect" (desconexión manual)
            const isManualDisconnect = reason === 'Client initiated disconnect' || 
                                      (typeof reason === 'object' && reason?.message?.includes('Client initiated disconnect'));
            
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2505',message:'Checking if manual disconnect',data:{reason,isManualDisconnect,reasonType:typeof reason},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            if (!isManualDisconnect) {
              // #region agent log
              // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2507',message:'Calling handleRoomDisconnected',data:{reason},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              handleRoomDisconnected();
            } else {
              // #region agent log
              // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2510',message:'Manual disconnect detected - not calling handleRoomDisconnected',data:{reason},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
            }
          }}
          onConnectionStateChanged={(state) => {
            if (state === 'disconnected') {
              const remoteCount = window.livekitRoom?.remoteParticipants?.size || 0;
            }
          }}
          onParticipantConnected={(participant) => {
          }}
          onParticipantDisconnected={(participant) => {
            const remoteCount = window.livekitRoom?.remoteParticipants?.size || 0;
            
            // 🔥 SOLO DETECTAR DESCONEXIÓN SI YA HABÍA UNA SESIÓN ACTIVA
            const hadActiveSession = tiempo > 0 || !!otherUser;
            
            // 🔥 DETECTAR SI ES EL CLIENTE Y MANEJAR INMEDIATAMENTE
            if (participant && participant.identity) {
              const participantIdentity = participant.identity.toLowerCase();
              const isClient = participantIdentity.includes('cliente') || 
                              participantIdentity.includes('client') ||
                              (otherUser && otherUser.role === 'cliente' && participantIdentity.includes(otherUser.name?.toLowerCase()));
              
              if (isClient && remoteCount === 0 && connected && hadActiveSession && !clientDisconnected && !(disconnectionReason && redirectCountdown > 0)) {
                // 🔥 CAMBIO: Cuando el cliente se desconecta, mostrar pantalla de desconexión
                handleClientDisconnected('partner_left_session', 'El cliente se desconectó de la videollamada');
                return;
              }
            }
            
            // Si no hay participantes remotos y había sesión activa, también detectar desconexión
            if (remoteCount === 0 && connected && hadActiveSession && !clientDisconnected && !(disconnectionReason && redirectCountdown > 0)) {
              handleClientDisconnected('partner_left_session', 'El cliente se desconectó de la videollamada');
            }
          }}
          onTrackPublished={(pub, participant) => {
          }}
          onTrackUnpublished={(pub, participant) => {
          }}
          onError={(error) => {
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2599',message:'onError callback triggered',data:{errorName:error.name,errorMessage:error.message,isDisconnecting:isDisconnecting.current,roomState:window.livekitRoom?.state,roomName:window.livekitRoom?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            // 🔥 IGNORAR ERRORES DE DESCONEXIÓN INICIADA POR CLIENTE (son normales)
            if (error.name === 'ConnectionError' && error.message.includes('Client initiated disconnect')) {
              // #region agent log
              // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2601',message:'Ignoring Client initiated disconnect error',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
              // #endregion
              return; // No hacer nada, es una desconexión normal
            }
            
            // #region agent log
            // TELEMETRY DISABLED: // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videochat.jsx:2605',message:'Non-disconnect error logged',data:{errorName:error.name,errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            // 🔥 NO DESCONECTAR AUTOMÁTICAMENTE POR ERRORES - Solo loggear
            // La desconexión debe ser manejada por el usuario o por lógica específica
          }}
          className="min-h-screen"
        >
          <RoomAudioRenderer />
          <RoomCapture onRoomReady={handleRoomReady} />

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
            <div className="lg:hidden bg-[#1f2125] rounded-2xl overflow-hidden relative mt-4 video-main-container"
                style={{height: 'calc(100vh - 360px)', minHeight: 0 }}>
              <VideoDisplayImproved
                onCameraSwitch={cambiarCamara}
                mainCamera={camaraPrincipal}
                connected={connected}
                hadRemoteParticipant={otherUser !== null}
                otherUser={otherUser}
                isDetectingUser={isDetectingUser}
                cameraEnabled={cameraEnabled}
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
                handleKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
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
                onCameraSwitch={cambiarCamara}
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
                isModelView={userData.role === 'modelo'}
                userData={userData}
              />
            </div>

            {/* DESKTOP - Layout principal */}
            <div className="hidden lg:flex flex-col lg:flex-row lg:gap-6 mx-4" style={{ maxHeight: 'calc(100vh - 180px)', minHeight: 0 }}>
              {/* ZONA VIDEO - RESPONSIVE */}
              <div className="flex-1 bg-[#1f2125] rounded-xl lg:rounded-2xl overflow-hidden relative flex items-center justify-center video-main-container" style={{ minHeight: 0, minWidth: 0, maxHeight: 'calc(100vh - 180px)', flex: '0 1 75%' }}>
                <VideoDisplayImproved
                  onCameraSwitch={cambiarCamara}
                  mainCamera={camaraPrincipal}
                  connected={connected}
                  hadRemoteParticipant={otherUser !== null}
                  otherUser={otherUser}
                  isDetectingUser={isDetectingUser}
                  cameraEnabled={cameraEnabled}
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
                messages={messages || []}
                mensaje={mensaje || ''}
                setMensaje={setMensaje}
                enviarMensaje={enviarMensaje}
                handleKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
                userData={userData || {}}
                userBalance={userBalance || 0}
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
              isModelView={userData.role === 'modelo'}
              userData={userData}
            />
          </div>

          {/* Modal de regalos - SIEMPRE MODELO */}
          {showGiftsModal && (
            <GiftsModal
              key={`gifts-modal-modelo-${roomName}`}
              isOpen={showGiftsModal}
              onClose={() => setShowGiftsModal(false)}
              recipientName={getDisplayName()}
              recipientId={otherUser?.id}
              roomName={roomName}
              userRole="modelo"
              gifts={gifts}
              onRequestGift={handleRequestGift}
              onSendGift={undefined}
              userBalance={0}
              loading={giftLoading}
            />
          )}

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
            // 🔥 PROPS PARA COMUNICACIÓN DE DISPOSITIVOS
            selectedCamera={selectedCameraDevice}
            selectedMicrophone={selectedMicrophoneDevice}
            onCameraChange={handleCameraChange}
            onMicrophoneChange={handleMicrophoneChange}
            cameras={cameras}
            microphones={microphones}
            isLoadingDevices={isLoadingDevices}
            onLoadDevices={loadDevices}
          />

          {/* Controles de media ocultos */}
          <MediaControlsImproved
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            volumeEnabled={volumeEnabled}
            setMicEnabled={setMicEnabled}
            setCameraEnabled={setCameraEnabled}
            setVolumeEnabled={setVolumeEnabled}
            userData={userData}
          />

          {memoizedRoomName && memoizedUserName && (
            <SimpleChat
              key={`${memoizedRoomName}-${memoizedUserName}`}
              userName={userData.name}
              userRole={userData.role}
              roomName={memoizedRoomName}
              onMessageReceived={handleMessageReceived}
              onUserLoaded={handleUserLoadedFromChat}
              onParticipantsUpdated={(participants) => {}}
            />
          )}
        </LiveKitRoom>
        </>
      )}
    </div>
  );
}

}