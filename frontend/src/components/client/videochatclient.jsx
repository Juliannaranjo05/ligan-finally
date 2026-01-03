// VideoChatClient.jsx - Componente Principal Mejorado COMPLETO
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,        
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

// Componentes modularizados para cliente
import HeaderCliente from "./headercliente.jsx";
import VideoDisplayImprovedClient from "./components/VideoDisplayImprovedClient";
import FloatingMessagesImprovedClient from "./components/FloatingMessagesImprovedClient";
import DesktopChatPanelClient from "./components/DesktopChatPanelClient";
import MobileControlsImprovedClient from "./components/MobileControlsImprovedClient";
import TimeDisplayImprovedClient from "./components/TimeDisplayImprovedClient";
import NotificationSystemImprovedClient from "./components/NotificationSystemImprovedClient";
import DisconnectionScreenImprovedClient from "./components/DisconnectionScreenImprovedClient";
import MediaControlsImprovedClient from "./components/MediaControlsImprovedClient";
import { useAppNotifications } from "../../contexts/NotificationContext.jsx";

// Componentes modularizados para modelo (para soportar ambos roles)
import HeaderModelo from "../modelo/header";
import VideoDisplayImproved from "../modelo/components/VideoDisplayImproved";
import FloatingMessagesImproved from "../modelo/components/FloatingMessagesImproved";
import DesktopChatPanel from "../modelo/components/DesktopChatPanel";
import MobileControlsImproved from "../modelo/components/MobileControlsImproved";
import DesktopControlsImproved from "../modelo/components/DesktopControlsImproved";
import TimeDisplayImproved from "../modelo/components/TimeDisplayImproved";
import NotificationSystemImproved from "../modelo/components/NotificationSystemImproved.jsx";
import DisconnectionScreenImproved from "../modelo/components/DisconnectionScreenImproved";
import MediaControlsImproved from "../modelo/components/MediaControlsImproved";


// Componentes originales necesarios
import SimpleChat from "../messages.jsx";
import { useVideoChatGifts } from '../../components/GiftSystem/useVideoChatGifts';
import { GiftsModal } from '../../components/GiftSystem/giftModal.jsx';
import { GiftMessageComponent } from '../../components/GiftSystem/GiftMessageComponent.jsx';
import { GiftNotificationOverlay } from '../../components/GiftSystem/GiftNotificationOverlay';
import { Gift, Send } from 'lucide-react';
import {
  useTranslation as useCustomTranslation,
  TranslationSettings,
  TranslatedMessage
} from '../../utils/translationSystem.jsx';
import CameraAudioSettings from '../modelo/utils/cameraaudiosettings.jsx';  

// Utilities y contextos
import { getUser } from "../../utils/auth";
import { useSessionCleanup } from '../closesession.jsx';
import { useSearching } from '../../contexts/SearchingContext';
import { ProtectedPage } from '../hooks/usePageAccess.jsx';
import { useVideoChatHeartbeat } from '../../utils/heartbeat';

// Configuraciones
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const USER_CACHE = new Map();

// Función para generar clave única de la sala
const getRoomCacheKey = (roomName, currentUserName) => {
  return `${roomName}_${currentUserName}`;
};

// 🔥 REF GLOBAL PARA PREVENIR MÚLTIPLAS LLAMADAS A onRoomReady (persiste entre re-renders)
const roomReadyCalledGlobal = new Map();

const RoomCapture = ({ onRoomReady }) => {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const hasCalledReady = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!room) {
      return;
    }

    // 🔥 USAR ROOM SID COMO CLAVE ÚNICA PARA EVITAR MÚLTIPLAS LLAMADAS
    const roomKey = room.sid || room.name;
    const globalCalled = roomReadyCalledGlobal.has(roomKey);

    // 🔥 Solo llamar onRoomReady UNA VEZ cuando la room esté conectada
    if (room.state === 'connected' && localParticipant && !hasCalledReady.current && !globalCalled) {
      hasCalledReady.current = true;
      roomReadyCalledGlobal.set(roomKey, true);

      // 🔥 DELAY PARA ASEGURAR QUE LOS STREAMS ESTÉN LISTOS
      timeoutRef.current = setTimeout(async () => {
        onRoomReady(room);
      }, 1000); // 🔥 REDUCIDO A 1 segundo para conexión más rápida

    } else if (room.state !== 'connected' && !hasCalledReady.current && !globalCalled) {
      // Esperar a que se conecte solo si aún no se ha llamado
      const handleStateChange = () => {
        if (room.state === 'connected' && localParticipant && !hasCalledReady.current && !roomReadyCalledGlobal.has(roomKey)) {
          hasCalledReady.current = true;
          roomReadyCalledGlobal.set(roomKey, true);

          // 🔥 DELAY PARA ASEGURAR QUE LOS STREAMS ESTÉN LISTOS
          timeoutRef.current = setTimeout(async () => {
            onRoomReady(room);
            room.removeListener('connectionStateChanged', handleStateChange);
          }, 1000); // 🔥 REDUCIDO A 1 segundo para conexión más rápida
        }
      };

      room.on('connectionStateChanged', handleStateChange);

      return () => {
        room.removeListener('connectionStateChanged', handleStateChange);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }

    // 🔥 CLEANUP: Limpiar timeout si el componente se desmonta
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [room, localParticipant, onRoomReady]);

  return null;
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

// 🔥 REF GLOBAL PARA PREVENIR MÚLTIPLOS MONTAJES DEL COMPONENTE
const componentMountRef = new Map();

// 🔥 TEXTO HARDCODEADO POR IDIOMA PARA VIDEOCHAT CLIENTE
const getHardcodedTexts = (language) => {
  const texts = {
    es: {
      yourCamera: "Tu cámara",
      chatWith: "Conversa con",
      startConversation: "Inicia una conversación interesante y disfruta del chat",
      writeMessage: "Escribe tu mensaje...",
      gifts: "Regalos:",
      minutes: "Minutos:",
      connected: "Conectado",
      online: "En línea",
      info: "Info",
      system: "Sistema",
      connecting: "Conectando...",
      waitingModel: "Esperando modelo...",
      modelWillConnect: "Una modelo se conectará pronto para chatear contigo",
      connectingToRoom: "Conectando a la sala...",
      connectionEstablished: "Videollamada establecida exitosamente"
    },
    en: {
      yourCamera: "Your camera",
      chatWith: "Chat with",
      startConversation: "Start an interesting conversation and enjoy the chat",
      writeMessage: "Write your message...",
      gifts: "Gifts:",
      minutes: "Minutes:",
      connected: "Connected",
      online: "Online",
      info: "Info",
      system: "System",
      connecting: "Connecting...",
      waitingModel: "Waiting for model...",
      modelWillConnect: "A model will connect soon to chat with you",
      connectingToRoom: "Connecting to room...",
      connectionEstablished: "Video call established successfully"
    },
    pt: {
      yourCamera: "Sua câmera",
      chatWith: "Conversa com",
      startConversation: "Inicie uma conversa interessante e aproveite o chat",
      writeMessage: "Escreva sua mensagem...",
      gifts: "Presentes:",
      minutes: "Minutos:",
      connected: "Conectado",
      online: "Conectada",
      info: "Info",
      system: "Sistema",
      connecting: "Conectando...",
      waitingModel: "Aguardando modelo...",
      modelWillConnect: "Uma modelo se conectará em breve para conversar com você",
      connectingToRoom: "Conectando à sala...",
      connectionEstablished: "Vide chamada estabelecida com sucesso"
    },
    fr: {
      yourCamera: "Votre caméra",
      chatWith: "Chattez avec",
      startConversation: "Démarrez une conversation intéressante et profitez du chat",
      writeMessage: "Écrivez votre message...",
      gifts: "Cadeaux:",
      minutes: "Minutes:",
      connected: "Connecté",
      online: "Connectée",
      info: "Info",
      system: "Système",
      connecting: "Connexion...",
      waitingModel: "En attente du modèle...",
      modelWillConnect: "Un modèle se connectera bientôt pour discuter avec vous",
      connectingToRoom: "Connexion à la salle...",
      connectionEstablished: "Appel vidéo établi avec succès"
    },
    de: {
      yourCamera: "Ihre Kamera",
      chatWith: "Chatten Sie mit",
      startConversation: "Starten Sie ein interessantes Gespräch und genießen Sie den Chat",
      writeMessage: "Schreiben Sie Ihre Nachricht...",
      gifts: "Geschenke:",
      minutes: "Minuten:",
      connected: "Verbunden",
      online: "Verbunden",
      info: "Info",
      system: "System",
      connecting: "Verbinde...",
      waitingModel: "Warten auf Modell...",
      modelWillConnect: "Ein Modell wird sich bald verbinden, um mit Ihnen zu chatten",
      connectingToRoom: "Verbinden mit Raum...",
      connectionEstablished: "Videoanruf erfolgreich hergestellt"
    },
    ru: {
      yourCamera: "Ваша камера",
      chatWith: "Чат с",
      startConversation: "Начните интересный разговор и наслаждайтесь чатом",
      writeMessage: "Напишите ваше сообщение...",
      gifts: "Подарки:",
      minutes: "Минуты:",
      connected: "Подключено",
      online: "Подключена",
      info: "Инфо",
      system: "Система",
      connecting: "Подключаемся...",
      waitingModel: "Ожидание модели...",
      modelWillConnect: "Модель скоро подключится, чтобы пообщаться с вами",
      connectingToRoom: "Подключение к комнате...",
      connectionEstablished: "Видеозвонок успешно установлен"
    },
    tr: {
      yourCamera: "Kameranız",
      chatWith: "Sohbet edin",
      startConversation: "İlginç bir sohbet başlatın ve sohbetin tadını çıkarın",
      writeMessage: "Mesajınızı yazın...",
      gifts: "Hediyeler:",
      minutes: "Dakika:",
      connected: "Bağlı",
      online: "Bağlı",
      info: "Bilgi",
      system: "Sistem",
      connecting: "Bağlanıyor...",
      waitingModel: "Model bekleniyor...",
      modelWillConnect: "Bir model yakında sizinle sohbet etmek için bağlanacak",
      connectingToRoom: "Odaya bağlanılıyor...",
      connectionEstablished: "Video araması başarıyla kuruldu"
    },
    hi: {
      yourCamera: "आपका कैमरा",
      chatWith: "चैट करें",
      startConversation: "एक दिलचस्प बातचीत शुरू करें और चैट का आनंद लें",
      writeMessage: "अपना संदेश लिखें...",
      gifts: "उपहार:",
      minutes: "मिनट:",
      connected: "कनेक्टेड",
      online: "जुड़ी हुई",
      info: "जानकारी",
      system: "सिस्टम",
      connecting: "जुड़ रहे हैं...",
      waitingModel: "मॉडल की प्रतीक्षा कर रहे हैं...",
      modelWillConnect: "एक मॉडल जल्द ही आपसे चैट करने के लिए कनेक्ट होगा",
      connectingToRoom: "कमरे से कनेक्ट हो रहे हैं...",
      connectionEstablished: "वीडियो कॉल सफलतापूर्वक स्थापित किया गया"
    },
    it: {
      yourCamera: "La tua fotocamera",
      chatWith: "Chatta con",
      startConversation: "Inizia una conversazione interessante e goditi la chat",
      writeMessage: "Scrivi il tuo messaggio...",
      gifts: "Regali:",
      minutes: "Minuti:",
      connected: "Connesso",
      online: "Connessa",
      info: "Info",
      system: "Sistema",
      connecting: "Connettendo...",
      waitingModel: "In attesa del modello...",
      modelWillConnect: "Un modello si collegherà presto per chattare con te",
      connectingToRoom: "Connessione alla stanza...",
      connectionEstablished: "Videochiamata stabilita con successo"
    },
    ja: {
      yourCamera: "あなたのカメラ",
      chatWith: "チャット",
      startConversation: "興味深い会話を始めて、チャットをお楽しみください",
      writeMessage: "メッセージを入力...",
      gifts: "ギフト:",
      minutes: "分:",
      connected: "接続済み",
      online: "接続済み",
      info: "情報",
      system: "システム",
      connecting: "接続中...",
      waitingModel: "モデルを待っています...",
      modelWillConnect: "モデルがすぐに接続してチャットします",
      connectingToRoom: "ルームに接続中...",
      connectionEstablished: "ビデオ通話が正常に確立されました"
    },
    ko: {
      yourCamera: "카메라",
      chatWith: "채팅",
      startConversation: "흥미로운 대화를 시작하고 채팅을 즐기세요",
      writeMessage: "메시지를 입력하세요...",
      gifts: "선물:",
      minutes: "분:",
      connected: "연결됨",
      online: "연결됨",
      info: "정보",
      system: "시스템",
      connecting: "연결 중...",
      waitingModel: "모델 대기 중...",
      modelWillConnect: "모델이 곧 연결되어 채팅할 것입니다",
      connectingToRoom: "룸에 연결 중...",
      connectionEstablished: "영상 통화가 성공적으로 설정되었습니다"
    },
    zh: {
      yourCamera: "您的摄像头",
      chatWith: "与聊天",
      startConversation: "开始有趣的对话并享受聊天",
      writeMessage: "输入您的消息...",
      gifts: "礼物:",
      minutes: "分钟:",
      connected: "已连接",
      online: "已连接",
      info: "信息",
      system: "系统",
      connecting: "连接中...",
      waitingModel: "等待模特...",
      modelWillConnect: "模特很快就会连接并与您聊天",
      connectingToRoom: "正在连接到房间...",
      connectionEstablished: "视频通话已成功建立"
    }
  };
  
  // Obtener el idioma base (sin región, ej: 'en-US' -> 'en')
  const lang = language?.split('-')[0] || 'es';
  return texts[lang] || texts.es;
};

// 🔥 COMPONENTE PRINCIPAL CON ESTRUCTURA MODULAR
export default function VideoChatClient() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  
  // 🔥 OBTENER TEXTO HARDCODEADO SEGÚN IDIOMA ACTUAL (se actualiza cuando cambia el idioma)
  const hardcodedTexts = useMemo(() => getHardcodedTexts(i18n.language), [i18n.language]);
  
  // 🔥 REF PARA PREVENIR MÚLTIPLOS MONTAJES
  const componentKeyRef = useRef(`${location.pathname}_${Date.now()}`);
  const hasLoggedMountRef = useRef(false);
  
  // 🔥 LOG SOLO UNA VEZ AL MONTAR
  if (!hasLoggedMountRef.current) {
    const componentKey = componentKeyRef.current;
    if (!componentMountRef.has(componentKey)) {
      componentMountRef.set(componentKey, true);
      hasLoggedMountRef.current = true;
    }
  }
  
  // 🔥 HOOKS Y CONTEXTOS
  const { startSearching, stopSearching, forceStopSearching } = useSearching();
  const { finalizarSesion, limpiarDatosSession } = useSessionCleanup();

  // 🔥 REF PARA PREVENIR MÚLTIPLAS VERIFICACIONES DE ROL
  const roleCheckDoneRef = useRef(false);

  // 🔥 VERIFICACIÓN DE ROL - REDIRIGIR MODELO A SU VISTA (SOLO UNA VEZ)
  useEffect(() => {
    // Nota: se removió la redirección automática para evitar que modelos sean forzadas
    // a `/videochat` desde este componente cuando no corresponde.
  }, []);

  // 🔥 LOG INICIAL SOLO UNA VEZ
  if (!hasLoggedMountRef.current) {
  }
  
  // 🔥 PARÁMETROS DE LA SALA - MÚLTIPLES FUENTES (IGUAL QUE videochat.jsx)
  const modelo = location.state?.modelo;
  const getParam = (key) => {
    // 🔥 PRIORIDAD: location.state > URL params > localStorage > sessionStorage
    // 🔥 CAMBIO: URL params tienen prioridad sobre localStorage para evitar usar valores antiguos
    const stateValue = location.state?.[key];
    const urlValue = searchParams.get(key);
    const localValue = localStorage.getItem(key);
    const sessionValue = sessionStorage.getItem(key);
    
    // 🔥 GUARDAR EN LOCALSTORAGE CUANDO VIENE DE LOCATION.STATE (PARA PERSISTENCIA)
    if (stateValue && stateValue !== 'null' && stateValue !== 'undefined') {
      localStorage.setItem(key, stateValue);
      return stateValue;
    }

    // 🔥 PRIORIDAD A URL PARAMS - Si hay parámetros en la URL, usarlos primero
    if (urlValue && urlValue !== 'null' && urlValue !== 'undefined') {
      // Guardar en localStorage para persistencia
      localStorage.setItem(key, urlValue);
      return urlValue;
    }

    // Si no hay stateValue ni urlValue, intentar recuperar de localStorage
    if (localValue && localValue !== 'null' && localValue !== 'undefined') {
      return localValue;
    }

    // Si no, usar sessionStorage (más reciente que localStorage)
    if (sessionValue && sessionValue !== 'null' && sessionValue !== 'undefined') {
      return sessionValue;
    }

    // Si no hay nada, retornar null
    return null;
  };

  // 🔥 VERIFICACIÓN MUY TEMPRANA: Verificar la ruta ANTES de leer parámetros
  // Si estamos en /homecliente o /usersearch, NO renderizar este componente
  // 🔥 AMBOS ROLES USAN /videochatclient AHORA (también acepta /videochat por compatibilidad)
  if (location.pathname !== '/videochatclient' && location.pathname !== '/videochat') {
    return null;
  }
  
  const roomName = getParam("roomName");
  const userName = getParam("userName");
  
  // 🔥 DEBUG: Verificar que los parámetros se lean correctamente
  const urlRoomName = searchParams.get('roomName');
  const urlUserName = searchParams.get('userName');
  const selectedCamera = location.state?.selectedCamera;
  const selectedMic = location.state?.selectedMic;
  
  // 🔥 REF PARA PREVENIR LOGS REPETIDOS DE PARÁMETROS (declarado antes de su uso)
  const lastParamsKeyRef = useRef('');
  
  // 🔥 ESTADO PARA ESPERAR PARÁMETROS (declarado antes de cualquier return)
  const [waitingForParams, setWaitingForParams] = useState(true);
  const safeNavigateHomeTimerRef = useRef(null);

  const safeNavigateHome = (options = {}) => {
    // options: { replace: true, state: null, immediate: false }
    const immediate = options.immediate || false;
    const navState = options.state || null;
    
    // 🔥 FUNCIÓN PARA LIMPIAR Y NAVEGAR
    const cleanupAndNavigate = () => {
      // 🔥 LIMPIAR DATOS DE VIDEOCHAT ANTES DE NAVEGAR
      const itemsToRemove = [
        'roomName', 'userName', 'currentRoom',
        'inCall', 'callToken', 'videochatActive',
        'sessionTime', 'sessionStartTime'
      ];
      
      itemsToRemove.forEach(item => {
        localStorage.removeItem(item);
        sessionStorage.removeItem(item);
      });
      
      // 🔥 DISPARAR EVENTO PERSONALIZADO PARA NOTIFICAR AL HEADER QUE SE LIMPIÓ
      window.dispatchEvent(new CustomEvent('videochatCleaned', { detail: { cleaned: true } }));
      
      setTimeout(() => {
        navigate('/homecliente', { replace: true, state: navState });
      }, 100);
    };
    
    if (immediate) {
      cleanupAndNavigate();
      return;
    }

    // Si recientemente hubo participantes remotos, esperar unos segundos antes de navegar
    if (safeNavigateHomeTimerRef.current) {
      clearTimeout(safeNavigateHomeTimerRef.current);
      safeNavigateHomeTimerRef.current = null;
    }

    safeNavigateHomeTimerRef.current = setTimeout(() => {
      const currentRoom = room || window.livekitRoom;
      const remoteCount = currentRoom?.remoteParticipants?.size || 0;
      // Si aparece alguien, cancelar navegación
      if (remoteCount > 0 || hadRemoteParticipantsRef.current === false) {
        // Cancelar navegación
        console.log('✅ [VideoChat] Safe navigate: participante reconectado o no había sesión previa, cancelando ir a home');
        safeNavigateHomeTimerRef.current = null;
        return;
      }

      cleanupAndNavigate();
      safeNavigateHomeTimerRef.current = null;
    }, 8000); // esperar 8s antes de navegar
  };
  
  // 🔥 VERIFICACIÓN MUY TEMPRANA: Si no hay roomName o userName válido
  const paramsKey = `${roomName}_${userName}`;
  
  // 🔥 EFECTO PARA ESPERAR PARÁMETROS (especialmente cuando vienen de location.state)
  useEffect(() => {


    // Si hay parámetros válidos, dejar de esperar inmediatamente
    if (roomName && roomName !== 'null' && roomName !== 'undefined' && 
        userName && userName !== 'null' && userName !== 'undefined') {
      setWaitingForParams(false);
    } else {
      // Esperar 3 segundos antes de mostrar error
      console.log('⏳ [VideoChatClient] Esperando parámetros, timer iniciado...');
      const timer = setTimeout(() => {
        console.log('⏰ [VideoChatClient] Timer expirado, mostrando error...');
        setWaitingForParams(false);
      }, 3000);
      return () => {
        console.log('🧹 [VideoChatClient] Limpiando timer...');
        clearTimeout(timer);
      };
    }
  }, [roomName, userName, location.state, searchParams]);
  
  // 🔥 SI NO HAY PARÁMETROS, ESPERAR O MOSTRAR ERROR
  if (!roomName || roomName === 'null' || roomName === 'undefined' || 
      !userName || userName === 'null' || userName === 'undefined') {
    if (lastParamsKeyRef.current !== 'INVALID') {
      lastParamsKeyRef.current = 'INVALID';
      console.log('⚠️ [VideoChatClient] No hay parámetros válidos:', {
        roomName,
        userName,
        locationState: location.state,
        urlParams: {
          roomName: searchParams.get('roomName'),
          userName: searchParams.get('userName')
        },
        waitingForParams
      });
    }
    
    // 🔥 SI AÚN ESTAMOS ESPERANDO, MOSTRAR SPINNER
    if (waitingForParams) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0d10]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
            <p className="text-white">{t('videochat.waitingRoomParams')}</p>
            <p className="text-white/50 text-sm mt-2">{t('videochat.waitingRoomParamsSubtext')}</p>
          </div>
        </div>
      );
    }
    
    // 🔥 SI YA PASÓ EL TIEMPO Y NO HAY PARÁMETROS, MOSTRAR ERROR PERO NO REDIRIGIR AUTOMÁTICAMENTE
    console.log('❌ [VideoChatClient] Mostrando pantalla de error - NO redirigiendo automáticamente');
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0d10]">
        <div className="text-center max-w-md mx-auto p-4">
          <p className="text-red-500 text-lg mb-4">{t('videochat.error.missingRoomParams')}</p>
          <p className="text-white/70 text-sm mb-4">
            {t('videochat.error.couldNotGetParams')}
          </p>
          <button
            onClick={() => {
              console.log('🔘 [VideoChatClient] Botón "Volver al Inicio" clickeado');
              
              // 🔥 LIMPIAR DATOS DE VIDEOCHAT ANTES DE NAVEGAR
              const itemsToRemove = [
                'roomName', 'userName', 'currentRoom',
                'inCall', 'callToken', 'videochatActive',
                'sessionTime', 'sessionStartTime'
              ];
              
              itemsToRemove.forEach(item => {
                localStorage.removeItem(item);
                sessionStorage.removeItem(item);
              });
              
              // 🔥 DISPARAR EVENTO PERSONALIZADO PARA NOTIFICAR AL HEADER QUE SE LIMPIÓ
              window.dispatchEvent(new CustomEvent('videochatCleaned', { detail: { cleaned: true } }));
              
              const userRole = localStorage.getItem('userRole') || 'cliente';
              setTimeout(() => {
                if (userRole === 'modelo') {
                  console.log('🔄 [VideoChatClient] Navegando a /homellamadas');
                  navigate('/homellamadas', { replace: true });
                } else {
                  console.log('🔄 [VideoChatClient] Navegando a /homecliente');
                  navigate('/homecliente', { replace: true });
                }
              }, 100);
            }}
            className="bg-[#ff007a] px-6 py-3 rounded-full text-white font-medium"
          >
            {t('videochat.backToHome')}
          </button>
        </div>
      </div>
    );
  }
  
  // 🔥 SOLO LOGGEAR CUANDO LOS PARÁMETROS CAMBIAN
  if (paramsKey !== lastParamsKeyRef.current) {
    lastParamsKeyRef.current = paramsKey;
  }

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
  const [modeloWentNext, setModeloWentNext] = useState(false);
  const [receivedNotification, setReceivedNotification] = useState(false);
  const [isProcessingLeave, setIsProcessingLeave] = useState(false);
  const [isHangingUp, setIsHangingUp] = useState(false); // 🔥 ESTADO PARA FEEDBACK VISUAL INMEDIATO
  const previousParticipantsCount = useRef(0); // 🔥 REF PARA RASTREAR PARTICIPANTES ANTERIORES
  const isDisconnectingRef = useRef(false); // 🔥 REF PARA EVITAR QUE SE GUARDE roomName DURANTE DESCONEXIÓN
  const isFinalizingRef = useRef(false); // 🔥 REF ADICIONAL PARA PROTECCIÓN CONTRA MÚLTIPLES EJECUCIONES
  const tiempoIntervalRef = useRef(null); // 🔥 REF PARA CONTROLAR EL INTERVALO DEL TIEMPO DE SESIÓN (EVITA ReferenceError)
  const hadRemoteParticipantsRef = useRef(false); // 🔥 REF PARA SABER SI YA HABÍA PARTICIPANTES REMOTOS (evita falsos positivos al inicio)
  const lastRenderStateKeyRef = useRef(''); // 🔥 REF PARA PREVENIR LOGS REPETIDOS DE RENDER
  const lastRenderLogTimeRef = useRef(0); // 🔥 REF PARA THROTTLING DE LOGS DE RENDER
  const disconnectDetectionTimeoutRef = useRef(null); // 🔥 REF PARA PERÍODO DE GRACIA DE DETECCIÓN DE DESCONEXIÓN
  const isDetectingDisconnectionRef = useRef(false); // 🔥 REF PARA PREVENIR MÚLTIPLES DETECCIONES SIMULTÁNEAS
  const connectionTimeoutRef = useRef(null); // 🔥 REF PARA TIMEOUT DE CONEXIÓN (20 segundos)
  const reconnectInProgressRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(3);

  // Estados de controles
  // 🔥 CÁMARA: Para modelo siempre encendida, para cliente apagada por defecto
  const [micEnabled, setMicEnabled] = useState(true);
  const micEnabledRef = useRef(true); // Ref para acceder al valor actual en closures
  const [cameraEnabled, setCameraEnabled] = useState(false); // Se actualizará cuando se detecte el rol
  const [volumeEnabled, setVolumeEnabled] = useState(true);
  const [camaraPrincipal, setCamaraPrincipal] = useState("remote");
  
  // Sincronizar ref con estado
  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  // Estados de UI
  const [tiempo, setTiempo] = useState(0);
  
  // 🔥 FUNCIÓN PARA CARGAR TIEMPO DESDE localStorage
  const getStoredTime = (room) => {
    if (!room) return 0;
    const storageKey = `videochat_tiempo_${room}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseInt(stored, 10);
      // 🔥 Verificar que el tiempo guardado no sea muy antiguo (máximo 24 horas = 86400 segundos)
      if (!isNaN(parsed) && parsed >= 0 && parsed < 86400) {
        console.log('⏱️ [TIEMPO] Tiempo cargado desde localStorage:', parsed, 'segundos');
        return parsed;
      }
    }
    return 0;
  };
  
  // 🔥 CARGAR TIEMPO DESDE localStorage CUANDO roomName ESTÉ DISPONIBLE
  useEffect(() => {
    if (roomName) {
      const storedTime = getStoredTime(roomName);
      if (storedTime > 0) {
        console.log('⏱️ [TIEMPO] Cargando tiempo guardado:', storedTime, 'segundos');
        setTiempo(storedTime);
      }
    }
  }, [roomName]);
  
  // 🔥 GUARDAR TIEMPO EN localStorage CADA VEZ QUE CAMBIE
  useEffect(() => {
    if (roomName && tiempo > 0) {
      const storageKey = `videochat_tiempo_${roomName}`;
      localStorage.setItem(storageKey, tiempo.toString());
      // 🔥 Log solo cada 10 segundos para no saturar la consola
      if (tiempo % 10 === 0) {
        console.log('⏱️ [TIEMPO] Tiempo guardado en localStorage:', tiempo, 'segundos');
      }
    }
  }, [tiempo, roomName]);

  // Estados de mensajes
  const [messages, setMessages] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatVisible, setChatVisible] = useState(true); // 🔥 ESTADO PARA MOSTRAR/OCULTAR CHAT

  // Estados de desconexión
  const [disconnectionReason, setDisconnectionReason] = useState('');
  const [disconnectionType, setDisconnectionType] = useState('');
  const [pendingRedirectAction, setPendingRedirectAction] = useState(null); // 'next' para ruletear, 'stop' para inicio
  const [redirectCountdown, setRedirectCountdown] = useState(0);

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
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false); // 🔥 NUEVO: Modal de saldo bajo durante llamada
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isAddingFavorite, setIsAddingFavorite] = useState(false);
  const [isMonitoringBalance, setIsMonitoringBalance] = useState(false);
  const [availableGifts, setAvailableGifts] = useState([]);
  const [apodos, setApodos] = useState({}); // 🔥 ESTADO PARA APODOS/NICKNAMES
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [selectedCameraDevice, setSelectedCameraDevice] = useState('');
  const [selectedMicrophoneDevice, setSelectedMicrophoneDevice] = useState('');
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const roomReadyCalled = useRef(false);

  // 🔥 REFS PARA PREVENIR MÚLTIPLES CONEXIONES (sin causar re-renders)
  const connectionAttemptedRef = useRef(false);
  const currentRoomKeyRef = useRef(null);
  
  // 🔥 REFS PARA CONTROL DE DISPOSITIVOS Y PREVENIR CAMBIOS DUPLICADOS (igual que modelo)
  const isChangingCamera = useRef(false);
  const isChangingMicrophone = useRef(false);
  const lastCameraDeviceId = useRef('');
  const lastMicrophoneDeviceId = useRef('');
  




  // Estados de notificaciones
  const [notifications, setNotifications] = useState([]);

  // Estados de espejo
  const [mirrorMode, setMirrorMode] = useState(() => {
    const saved = localStorage.getItem("mirrorMode");
    return saved ? JSON.parse(saved) : true;
  });

  // Estados de balance
  const [userBalance, setUserBalance] = useState(0);        // Balance de COINS (monedas)
  const [giftBalanceState, setGiftBalanceState] = useState(0); // Balance de GIFTS (estado local)
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  
  // 🔥 ESTADOS PARA DATOS DEL CLIENTE (cuando el rol es modelo)
  const [clientBalance, setClientBalance] = useState(0);        // Balance de COINS del cliente
  const [clientGiftBalance, setClientGiftBalance] = useState(0); // Balance de GIFTS del cliente
  const [clientRemainingMinutes, setClientRemainingMinutes] = useState(0); // Minutos restantes del cliente

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
    userBalance: giftBalanceFromHook,
    loading: giftLoading,
    requestGift,
    acceptGift,
    rejectGift,
    loadGifts,
    loadUserBalance,
    setPendingRequests
  } = useVideoChatGifts(
    roomName || '', // 🔥 Asegurar que nunca sea null/undefined
    { id: userData.id, role: userData.role, name: userData.name },
    otherUser ? { id: otherUser.id, name: otherUser.name } : null
  );
  
  // 🔥 USAR EL BALANCE DEL HOOK O EL ESTADO LOCAL (el que tenga valor)
  const giftBalance = giftBalanceFromHook || giftBalanceState;
  
  // 🔥 DEBUG: Log cuando cambien los valores de balance
  useEffect(() => {
    console.log('💰 [BALANCE] Valores de balance actualizados:', {
      giftBalanceFromHook,
      giftBalanceState,
      giftBalance,
      remainingMinutes,
      userBalance
    });
  }, [giftBalanceFromHook, giftBalanceState, giftBalance, remainingMinutes, userBalance]);
  
  // 🔥 FUNCIÓN PARA ACTUALIZAR GIFT BALANCE
  const setGiftBalance = (value) => {
    if (typeof value === 'function') {
      setGiftBalanceState(prev => value(prev));
    } else {
      setGiftBalanceState(value);
    }
  };

  // Estados para notificaciones de regalo
  const [showGiftNotification, setShowGiftNotification] = useState(false);
  const [processingGift, setProcessingGift] = useState(null);
  const [modeloDisconnected, setModeloDisconnected] = useState(false);
  
  // 🔥 ESTADOS PARA CONTROL DE ADVERTENCIA Y FINALIZACIÓN AUTOMÁTICA
  const [warningShown, setWarningShown] = useState(false); // Para controlar si ya se mostró la advertencia de 2 minutos
  const hasAutoEndedRef = useRef(false); // Para prevenir múltiples finalizaciones automáticas
  const hasAddedMinutesRef = useRef(false); // Para prevenir agregar minutos múltiples veces


  const processSessionEarnings = async (durationSeconds, endedBy = 'user') => {
    if (!roomName || !otherUser?.id || !userData?.id || durationSeconds <= 0) {
      console.warn('⚠️ [EARNINGS] Condiciones no cumplidas para procesar ganancias:', {
        roomName: !!roomName,
        otherUserId: !!otherUser?.id,
        userDataId: !!userData?.id,
        durationSeconds
      });
      return;
    }

    try {
      const authToken = localStorage.getItem('token');
      
      if (!authToken) {
        console.warn('⚠️ [EARNINGS] No hay token de autenticación');
        return;
      }

      // 🔥 DETERMINAR CORRECTAMENTE QUIÉN ES LA MODELO Y QUIÉN ES EL CLIENTE
      let modeloUserId, clienteUserId;
      
      if (userData?.role === 'modelo') {
        // Si el usuario actual es la modelo, entonces otherUser es el cliente
        modeloUserId = userData.id;
        clienteUserId = otherUser.id;
      } else {
        // Si el usuario actual es el cliente, entonces otherUser es la modelo
        modeloUserId = otherUser.id;
        clienteUserId = userData.id;
      }

      console.log('💰 [EARNINGS] Procesando ganancias:', {
        room_name: roomName,
        duration_seconds: durationSeconds,
        modelo_user_id: modeloUserId,
        cliente_user_id: clienteUserId,
        user_role: userData?.role,
        ended_by: endedBy
      });
      
      const earningsResponse = await Promise.race([
        fetch(`${API_BASE_URL}/api/earnings/process-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            room_name: roomName,
            duration_seconds: durationSeconds,
            modelo_user_id: modeloUserId,
            cliente_user_id: clienteUserId,
            session_type: 'video_chat',
            ended_by: endedBy
          })
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      if (earningsResponse.ok) {
        const earningsData = await earningsResponse.json();
        console.log('✅ [EARNINGS] Ganancias procesadas exitosamente:', earningsData);
              
        if (earningsData.success && earningsData.model_earnings > 0) {
          const minutes = Math.floor(durationSeconds / 60);
          console.log(`💰 [EARNINGS] Ganancias registradas: $${earningsData.model_earnings} por ${minutes} minuto(s)`);
        }
      } else {
        const errorData = await earningsResponse.json().catch(() => ({}));
        console.error('❌ [EARNINGS] Error procesando ganancias:', {
          status: earningsResponse.status,
          statusText: earningsResponse.statusText,
          error: errorData
        });
      }
      
    } catch (error) {
      console.error('❌ [EARNINGS] Excepción procesando ganancias:', error);
    }
  };

  // Usar heartbeat
  useVideoChatHeartbeat(roomName, 'cliente');

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

  // 🔥 FUNCIONES DE CACHE MEJORADAS
  const updateOtherUser = (user) => {
    if (!user || !roomName || !userName) return;
    
    const cacheKey = getRoomCacheKey(roomName, userName);
    USER_CACHE.set(cacheKey, user);
    setOtherUser(user);
    setIsDetectingUser(false);
    // 🔥 COMENTADO: Ya se llama en el useEffect cuando otherUser.id cambia
    // checkIfFavorite(user.id);
  };

  const clearUserCache = () => {
    if (!roomName || !userName) return;
    const cacheKey = getRoomCacheKey(roomName, userName);
    USER_CACHE.delete(cacheKey);
    setOtherUser(null);
    setIsDetectingUser(true);
  };

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
      
      setMessages(prev => [...prev, nuevoMensaje]);
      setMensaje(""); // Limpiar input inmediatamente
      
      // Enviar el mensaje usando chatFunctions
      if (chatFunctions?.sendMessage) {
        const success = await chatFunctions.sendMessage(messageToSend);
        
        if (!success) {
          // Si falla, marcar el mensaje como fallido o removerlo
          setMessages(prev => prev.filter(m => m.id !== nuevoMensaje.id));
          setMensaje(messageToSend); // Restaurar el mensaje en el input
          addNotification('error', t('videochat.error.title'), t('videochat.error.couldNotSendMessage'));
        }
      } else {
        addNotification('warning', t('videochat.chat.title'), t('videochat.chat.notReady'));
        // Restaurar el mensaje si no hay función disponible
        setMessages(prev => prev.filter(m => m.id !== nuevoMensaje.id));
        setMensaje(messageToSend);
      }
    } catch (error) {
      addNotification('error', t('videochat.error.title'), t('videochat.error.sendMessageError'));
      setMensaje(messageToSend); // Restaurar el mensaje
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleMessageReceived = (newMessage) => {
    const messageSenderRole = newMessage.senderRole || newMessage.user_role || 'cliente';
    const messageUserId = newMessage.user_id || newMessage.userId;
    const isMessageFromMe = (messageSenderRole === userData?.role) || (messageUserId && messageUserId === userData?.id);
    const messageType = isMessageFromMe ? 'local' : 'remote';

    const messageText = newMessage.text || newMessage.message || '';
    const messageTimestamp = newMessage.timestamp || newMessage.created_at ? new Date(newMessage.created_at).getTime() : Date.now();

    const formattedMessage = {
      ...newMessage,
      id: newMessage.id || Date.now() + Math.random(),
      type: messageType,
      senderRole: messageSenderRole,
      sender: newMessage.sender || newMessage.user_name,
      text: messageText,
      message: messageText,
      timestamp: messageTimestamp
    };

    setMessages(prev => {
      const messageExists = prev.some(msg => {
        if (newMessage.id && msg.id === newMessage.id) return true;
        const msgText = msg.text || msg.message || '';
        const msgTimestamp = msg.timestamp || 0;
        const timeDiff = Math.abs(msgTimestamp - messageTimestamp);

        if (msgText === messageText &&
            ((msg.type === 'local' && isMessageFromMe) || (msg.type === 'remote' && !isMessageFromMe)) &&
            timeDiff < 10000) {
          return true;
        }
        return false;
      });

      if (messageExists) {
        return prev.map(msg => {
          const msgText = msg.text || msg.message || '';
          const msgTimestamp = msg.timestamp || 0;
          const timeDiff = Math.abs(msgTimestamp - messageTimestamp);

          if (msgText === messageText &&
              ((msg.type === 'local' && isMessageFromMe) || (msg.type === 'remote' && !isMessageFromMe)) &&
              timeDiff < 10000) {
            return { ...msg, ...formattedMessage, id: newMessage.id || msg.id };
          }
          return msg;
        });
      }
      const updated = [...prev, formattedMessage];
      // 🔥 ORDENAMIENTO MEJORADO - Usar múltiples fuentes de timestamp
      return updated.sort((a, b) => {
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
        
        if (timeA !== timeB && timeA > 0 && timeB > 0) {
          return timeA - timeB;
        }
        if (timeA > 0 && timeB === 0) return 1;
        if (timeA === 0 && timeB > 0) return -1;
        
        const idA = typeof a.id === 'string' ? parseInt(a.id) || 0 : (a.id || 0);
        const idB = typeof b.id === 'string' ? parseInt(b.id) || 0 : (b.id || 0);
        return idA - idB;
      });
    });
  };

  // 🔥 EFECTO PARA CARGAR MENSAJES CUANDO SE CONECTA (PERSISTENCIA AL RECARGAR)
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
                
                if (timeA !== timeB && timeA > 0 && timeB > 0) {
                  return timeA - timeB;
                }
                if (timeA > 0 && timeB === 0) return 1;
                if (timeA === 0 && timeB > 0) return -1;
                
                const idA = typeof a.id === 'string' ? parseInt(a.id) || 0 : (a.id || 0);
                const idB = typeof b.id === 'string' ? parseInt(b.id) || 0 : (b.id || 0);
                return idA - idB;
              });

              setMessages(formattedMessages);
            }
          }
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      };
      loadMessages();
    }
  }, [roomName, connected, userData?.id]);

  const handleUserLoadedFromChat = (user) => {
        updateOtherUser(user);
  };

  // 🔥 REF PARA EVITAR MÚLTIPLAS LLAMADAS A updateBalance
  const updateBalanceCallRef = useRef(false);
  const updateGiftBalanceCallRef = useRef(false);

  // 🔥 FUNCIÓN PARA CARGAR SOLO GIFTS/BALANCE (solo cuando sea necesario)
  // 🔥 DESHABILITADA TEMPORALMENTE PARA EVITAR LOOPS INFINITOS
  const loadGiftBalance = useCallback(async () => {
    // 🔥 PROTECCIÓN EXTRA CONTRA MÚLTIPLAS EJECUCIONES
    if (updateGiftBalanceCallRef.current) {
      console.warn('⚠️ [GiftBalance] Ya hay una petición en curso, ignorando...');
      return;
    }
    
    // 🔥 VERIFICAR ÚLTIMA LLAMADA (mínimo 10 segundos entre llamadas)
    const now = Date.now();
    const lastCall = window.lastGiftBalanceCall || 0;
    if (now - lastCall < 10000) {
      console.warn('⚠️ [GiftBalance] Demasiado pronto, ignorando...', { 
        elapsed: now - lastCall,
        minInterval: 10000 
      });
      return;
    }
    
    updateGiftBalanceCallRef.current = true;
    window.lastGiftBalanceCall = now;
    
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        updateGiftBalanceCallRef.current = false;
        return;
      }

      const response = await Promise.race([
        fetch(`${API_BASE_URL}/api/videochat/gifts/balance`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      if (response.ok) {
        try {
          const giftsData = await response.json();
          if (giftsData.success) {
            const totalBalance = giftsData.balance || giftsData.gift_balance || 0;
            setGiftBalanceState(totalBalance);
          }
        } catch (error) {
          // Silenciar errores de parsing
        }
      }
    } catch (error) {
      // Silenciar errores
    } finally {
      // 🔥 RESETEAR FLAG DESPUÉS DE UN DELAY MÁS LARGO
      setTimeout(() => {
        updateGiftBalanceCallRef.current = false;
      }, 10000); // 🔥 Mínimo 10 segundos entre llamadas
    }
  }, []);

  // 🔥 FUNCIÓN PARA ACTUALIZAR SOLO BALANCE DE COINS
 const updateBalance = async () => {
  // 🔥 PROTECCIÓN CONTRA MÚLTIPLAS EJECUCIONES SIMULTÁNEAS
  if (updateBalanceCallRef.current) {
    return;
  }
  
  updateBalanceCallRef.current = true;
  
  try {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      updateBalanceCallRef.current = false;
      return;
    }

    // 🔥 SOLO CARGAR BALANCE DE COINS - GIFTS/BALANCE NO SE CARGA AQUÍ
    const coinsResponse = await Promise.race([
      fetch(`${API_BASE_URL}/api/client-balance/my-balance/quick`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);

    // 🔥 PROCESAR RESPUESTA DE COINS
    if (coinsResponse.ok) {
      try {
        const coinsData = await coinsResponse.json();
        if (coinsData.success) {
          setUserBalance(coinsData.total_coins);
          setRemainingMinutes(coinsData.remaining_minutes);
        }
      } catch (error) {
        // Silenciar errores de parsing
      }
    }

  } catch (error) {
    // 🔥 SILENCIAR ERRORES
  } finally {
    // 🔥 RESETEAR FLAG DESPUÉS DE UN DELAY
    setTimeout(() => {
      updateBalanceCallRef.current = false;
    }, 3000); // 🔥 Mínimo 3 segundos entre llamadas
  }
  };
  // 🔥 REF PARA EVITAR MÚLTIPLOS INTERVALOS DE BALANCE
  const balanceIntervalRef = useRef(null);
  const isLoadingBalanceRef = useRef(false);
  const hasLoadedBalanceRef = useRef(false); // 🔥 REF PARA EVITAR CARGAS DUPLICADAS DE BALANCE
  const loadUserBalanceRef = useRef(null); // 🔥 REF PARA loadUserBalance (evitar loops)
  
  // 🔥 ACTUALIZAR REF CUANDO loadUserBalance CAMBIE
  useEffect(() => {
    loadUserBalanceRef.current = loadUserBalance;
  }, [loadUserBalance]);

  // 🎵 FUNCIONES DE SONIDO PARA REGALOS
  // 🔥 DEFINIR playAlternativeGiftSound PRIMERO para evitar errores de inicialización
  const playAlternativeGiftSound = useCallback(async () => {
    try {
      // 🔥 Solo crear AudioContext si realmente se necesita y durante una interacción
      // Usar el AudioManager global si está disponible, o crear uno solo si es necesario
      let audioContext = null;
      try {
        // Intentar usar el AudioContext del AudioManager si existe y está activo
        if (typeof window !== 'undefined' && window.AudioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
        }
      } catch (ctxError) {
        // Si falla, usar HTML5 audio en su lugar
        console.log('ℹ️ [VideoChat] AudioContext no disponible, usando HTML5 audio');
        return; // Salir si no se puede crear AudioContext
      }
      
      if (!audioContext) {
        return; // No continuar sin AudioContext
      }
      
      const playNote = (frequency, startTime, duration, volume = 0.5) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Melodía alegre: Do-Mi-Sol-Do
      const now = audioContext.currentTime;
      playNote(523.25, now, 0.15, 0.6);        // Do
      playNote(659.25, now + 0.1, 0.15, 0.6);  // Mi
      playNote(783.99, now + 0.2, 0.15, 0.6);  // Sol
      playNote(1046.5, now + 0.3, 0.2, 0.7);   // Do (octava alta)
      
      return true;
    } catch (error) {
      // Vibrar en móviles como último recurso
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
      return false;
    }
  }, []);

  const playGiftSound = useCallback(async (soundType = 'sent') => {
    try {
      // 🔥 SOLICITAR PERMISOS DE AUDIO PRIMERO
      // Solo crear AudioContext si realmente se necesita y durante una interacción
      if (typeof window !== 'undefined' && window.AudioContext) {
        let audioContext = null;
        try {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
        } catch (ctxError) {
          // Si falla, no usar AudioContext - el sistema funciona sin él
          console.log('ℹ️ [VideoChat] AudioContext no disponible para sonido de regalo');
          return; // Salir si no se puede crear AudioContext
        }
        
        if (!audioContext || audioContext.state !== 'running') {
          return; // No continuar si el contexto no está activo
        }
      }
      
      // 🔥 SELECCIONAR ARCHIVO DE SONIDO SEGÚN EL TIPO
      const soundUrls = {
        sent: '/sounds/gift-received.mp3',      // Cuando envías/aceptas un regalo
        received: '/sounds/gift-received.mp3',   // Cuando recibes un regalo
        request: '/sounds/gift-request.mp3'      // Cuando solicitas un regalo
      };
      
      const soundUrl = soundUrls[soundType] || soundUrls.sent;
      
      try {
        const audio = new Audio(soundUrl);
        audio.volume = 0.8;
        audio.preload = 'auto';
        
        await audio.play();
        return true;
      } catch (playError) {
        // Si falla, usar sonido sintetizado
        return await playAlternativeGiftSound();
      }
    } catch (error) {
      // Último recurso - sonido sintetizado
      return await playAlternativeGiftSound();
    }
  }, [playAlternativeGiftSound]);

  // 🔥 CARGAR BALANCES INICIALES (COINS Y GIFTS) - CON MANEJO DE ERRORES 500
  useEffect(() => {
    // 🔥 VERIFICAR QUE NO HAYA UN INTERVALO ACTIVO
    if (balanceIntervalRef.current) {
      console.warn('⚠️ [Balance] Ya hay un intervalo activo, limpiando...');
      clearInterval(balanceIntervalRef.current);
      balanceIntervalRef.current = null;
    }

    // 🔥 CARGAR SALDOS TAN PRONTO COMO HAYA roomName (no esperar userData.id)
    if (!roomName) {
      console.log('💰 [BALANCE] Esperando roomName...');
      return;
    }
    
    console.log('💰 [BALANCE] Condiciones cumplidas, cargando saldos:', {
      roomName: roomName,
      userDataId: userData?.id,
      userDataName: userData?.name,
      userDataRole: userData?.role,
      hasLoadedBalance: hasLoadedBalanceRef.current
    });
    
    // 🔥 EVITAR CARGAS DUPLICADAS SOLO SI YA SE ESTÁ CARGANDO
    // Pero permitir recargar si el usuario es cliente (necesita ver sus saldos)
    if (hasLoadedBalanceRef.current && userData?.id && isLoadingBalanceRef.current) {
      console.log('💰 [BALANCE] Ya se está cargando el balance, evitando carga duplicada');
      return;
    }
    
    // 🔥 PARA CLIENTES: Permitir recargar balances periódicamente
    if (hasLoadedBalanceRef.current && userData?.role === 'cliente') {
      console.log('💰 [BALANCE] Cliente detectado, permitiendo recarga de balances');
      // Resetear el flag para permitir recarga
      hasLoadedBalanceRef.current = false;
    }
    
    // 🔥 Si userData.id no está disponible, intentar cargar el usuario primero
    if (!userData?.id) {
      console.log('💰 [BALANCE] userData.id no disponible, intentando cargar usuario...');
      getUser(false).then(user => {
        if (user && user.id) {
          console.log('💰 [BALANCE] Usuario cargado:', user.id);
          setUserData({
            name: user.name || user.alias || user.username || "",
            role: user.rol || user.role || "",
            id: user.id
          });
        }
      }).catch(err => {
        console.warn('💰 [BALANCE] Error cargando usuario:', err);
      });
      return; // 🔥 SALIR SI NO HAY userData.id
    }
    
    // 🔥 MARCAR QUE SE ESTÁ CARGANDO
    hasLoadedBalanceRef.current = true;

    let consecutiveErrors = 0;
    let isMounted = true;
    let errorBackoffMs = 0;

    const loadBalances = async () => {
      // 🔥 PROTECCIÓN CONTRA EJECUCIONES MÚLTIPLES
      if (!isMounted || isLoadingBalanceRef.current) {
        console.log('⏸️ [BALANCE] Carga cancelada - ya en progreso o desmontado');
        return;
      }
      
      // 🔥 VERIFICAR ÚLTIMA LLAMADA (mínimo 5 segundos entre llamadas)
      const now = Date.now();
      const lastCall = window.lastBalanceCall || 0;
      if (now - lastCall < 5000) {
        console.log('⏸️ [BALANCE] Demasiado pronto, ignorando...', { 
          elapsed: now - lastCall,
          minInterval: 5000 
        });
        return;
      }
      
      window.lastBalanceCall = now;
      isLoadingBalanceRef.current = true;
      
      try {
        const authToken = localStorage.getItem('token');
        if (!authToken || !userData.id) {
          isLoadingBalanceRef.current = false;
          return;
        }

        // 🔥 SI HAY ERRORES CONSECUTIVOS 500, ESPERAR ANTES DE REINTENTAR
        if (errorBackoffMs > 0) {
          await new Promise(resolve => setTimeout(resolve, errorBackoffMs));
        }

        // 🔥 SOLO CARGAR BALANCE DE COINS EN EL INTERVALO PERIÓDICO
        // 🔥 GIFTS/BALANCE SOLO SE CARGA CUANDO ES REALMENTE NECESARIO (al aceptar regalo, etc.)
        const coinsResponse = await Promise.race([
          fetch(`${API_BASE_URL}/api/client-balance/my-balance/quick`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);

        // 🔥 PROCESAR RESPUESTA DE COINS
        try {
          if (coinsResponse.ok) {
            const coinsData = await coinsResponse.json();
            if (coinsData.success) {
              // 🔥 MOSTRAR TODOS LOS DATOS REALES DEL BACKEND
              console.log('💰 [BALANCE] ===== DATOS REALES DEL BACKEND =====');
              console.log('💰 [BALANCE] Respuesta completa:', JSON.stringify(coinsData, null, 2));
              console.log('💰 [BALANCE] Valores extraídos:', {
                total_coins: coinsData.total_coins,
                remaining_minutes: coinsData.remaining_minutes,
                status: coinsData.status,
                should_end_session: coinsData.should_end_session,
                should_show_warning: coinsData.should_show_warning
              });
              console.log('💰 [BALANCE] ======================================');
              
              setUserBalance(coinsData.total_coins || 0);
              setRemainingMinutes(coinsData.remaining_minutes || 0);
              
              console.log('💰 [BALANCE] Estados actualizados en React:', {
                userBalance: coinsData.total_coins || 0,
                remainingMinutes: coinsData.remaining_minutes || 0,
                should_end_session: coinsData.should_end_session
              });
              
              // 🔥 CORTAR LLAMADA SI EL BACKEND INDICA QUE DEBE TERMINAR
              if (coinsData.should_end_session && connected && finalizarChat && !hasAutoEndedRef.current) {
                console.warn('🚨 [BALANCE] Backend indica should_end_session=true - Finalizando llamada INMEDIATAMENTE', {
                  remainingMinutes: coinsData.remaining_minutes,
                  should_end_session: coinsData.should_end_session
                });
                hasAutoEndedRef.current = true;
                setShowGiftsModal(false);
                addNotification('error', '⏰ Tiempo agotado', 'Tu tiempo se ha agotado. La llamada se está finalizando...', 2000);
                // 🔥 CORTAR INMEDIATAMENTE SIN DELAY
                if (finalizarChat && connected) {
                  finalizarChat(true);
                }
              }
              consecutiveErrors = 0;
              errorBackoffMs = 0;
            } else {
              console.warn('💰 [BALANCE] Respuesta no exitosa:', coinsData);
            }
          } else if (coinsResponse.status === 500) {
            consecutiveErrors++;
            errorBackoffMs = Math.min(5000 * Math.pow(2, consecutiveErrors - 1), 60000);
            if (consecutiveErrors >= 3) {
              isLoadingBalanceRef.current = false;
              return;
            }
          }
        } catch (error) {
          // Silenciar errores de parsing
        }
      } catch (error) {
        consecutiveErrors++;
        errorBackoffMs = Math.min(5000 * Math.pow(2, consecutiveErrors - 1), 60000);
      } finally {
        isLoadingBalanceRef.current = false;
      }
    };

    // 🔥 CARGAR BALANCES INICIALES INMEDIATAMENTE (solo una vez)
    console.log('💰 [BALANCE] Iniciando carga de balances:', {
      userDataId: userData?.id,
      roomName: roomName,
      hasLoadUserBalance: !!loadUserBalance
    });
    loadBalances();
    
    // 🔥 CARGAR SALDO DE REGALOS INMEDIATAMENTE (en paralelo) - USAR REF
    const currentLoadUserBalance = loadUserBalanceRef.current;
    if (currentLoadUserBalance && typeof currentLoadUserBalance === 'function') {
      console.log('🎁 [BALANCE] Cargando saldo de regalos...');
      // Cargar inmediatamente sin esperar
      currentLoadUserBalance().then(result => {
        console.log('🎁 [BALANCE] Saldo de regalos cargado:', result);
        // 🔥 RESETEAR FLAG SI HAY ERROR PARA PERMITIR REINTENTO
        if (result && result.success === false) {
          hasLoadedBalanceRef.current = false;
        }
      }).catch(err => {
        console.warn('⚠️ [Balance] Error cargando saldo de regalos:', err);
        // 🔥 RESETEAR FLAG EN CASO DE ERROR PARA PERMITIR REINTENTO
        hasLoadedBalanceRef.current = false;
      });
    } else {
      console.warn('⚠️ [BALANCE] loadUserBalance no está disponible');
    }
    
    // 🔥 ACTUALIZAR CADA 5 MINUTOS (300 segundos) - MUCHO MENOS AGRESIVO
    balanceIntervalRef.current = setInterval(() => {
      if (isMounted && !isLoadingBalanceRef.current) {
        loadBalances();
      }
    }, 300000); // 🔥 5 MINUTOS = 300,000 ms
    
    return () => {
      isMounted = false;
      if (balanceIntervalRef.current) {
        clearInterval(balanceIntervalRef.current);
        balanceIntervalRef.current = null;
      }
      isLoadingBalanceRef.current = false;
    };
  }, [userData?.id, roomName]); // 🔥 REMOVIDO loadUserBalance de dependencias para evitar loops

  // 🔥 FUNCIÓN PARA OBTENER DATOS DEL CLIENTE (cuando el rol es modelo)
  const loadClientBalance = useCallback(async () => {
    // Solo cargar si el rol es modelo y hay un cliente conectado
    if (userData?.role !== 'modelo' || !otherUser?.id || !roomName) {
      return;
    }

    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) return;

      const response = await fetch(`${API_BASE_URL}/api/earnings/videochat-balance?room_name=${encodeURIComponent(roomName)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('💰 [CLIENT BALANCE] Datos del cliente obtenidos:', {
            remaining_minutes: data.remaining_minutes,
            gift_balance: data.gift_balance,
            client_id: data.client_id
          });
          
          setClientRemainingMinutes(data.remaining_minutes || 0);
          setClientGiftBalance(data.gift_balance || 0);
          // El balance de coins se calcula desde los minutos
          setClientBalance((data.remaining_minutes || 0) * 10);
        }
      }
    } catch (error) {
      console.warn('⚠️ [CLIENT BALANCE] Error obteniendo datos del cliente:', error);
    }
  }, [userData?.role, otherUser?.id, roomName]);

  // 🔥 REF PARA EVITAR MÚLTIPLOS INTERVALOS DE CLIENT BALANCE
  const clientBalanceIntervalRef = useRef(null);
  const isLoadingClientBalanceRef = useRef(false);

  // 🔥 CARGAR DATOS DEL CLIENTE CUANDO EL ROL ES MODELO
  useEffect(() => {
    // Limpiar intervalo anterior si existe
    if (clientBalanceIntervalRef.current) {
      clearInterval(clientBalanceIntervalRef.current);
      clientBalanceIntervalRef.current = null;
    }

    // Solo cargar si el rol es modelo y hay un cliente conectado
    if (userData?.role !== 'modelo' || !otherUser?.id || !roomName || !connected) {
      return;
    }

    // Función interna para cargar balance con protección
    const loadWithProtection = async () => {
      if (isLoadingClientBalanceRef.current) {
        return;
      }
      isLoadingClientBalanceRef.current = true;
      try {
        await loadClientBalance();
      } finally {
        // Resetear flag después de un delay para evitar llamadas muy frecuentes
        setTimeout(() => {
          isLoadingClientBalanceRef.current = false;
        }, 5000);
      }
    };

    // Cargar inmediatamente
    loadWithProtection();
    
    // Actualizar cada 30 segundos (no más frecuente)
    clientBalanceIntervalRef.current = setInterval(() => {
      if (!isLoadingClientBalanceRef.current) {
        loadWithProtection();
      }
    }, 30000);
    
    return () => {
      if (clientBalanceIntervalRef.current) {
        clearInterval(clientBalanceIntervalRef.current);
        clientBalanceIntervalRef.current = null;
      }
      isLoadingClientBalanceRef.current = false;
    };
  }, [userData?.role, otherUser?.id, roomName, connected]); // 🔥 REMOVIDO loadClientBalance de dependencias

  const siguientePersona = useCallback(async () => {
    // 🔥 PROTECCIÓN CONTRA EJECUCIONES MÚLTIPLES
    if (isDisconnectingRef.current || isFinalizingRef.current) {
      console.log('⏸️ [SiguientePersona] Ya se está ejecutando, ignorando llamada');
      return;
    }
    
    // 🔥 MARCAR INMEDIATAMENTE
    isDisconnectingRef.current = true;
    
    const authToken = localStorage.getItem('token');
    const currentRoomName = roomName;
    const currentOtherUser = otherUser;
    const currentTiempo = tiempo;
    const currentUserData = userData;
    const currentRoom = room || window.livekitRoom;
    
    // 🔥 DESCONECTAR DE LIVEKIT INMEDIATAMENTE (NO ESPERAR)
    const disconnectLiveKit = async () => {
      try {
        if (currentRoom && currentRoom.state !== 'disconnected') {
          await Promise.race([
            currentRoom.disconnect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]).catch(() => {
            // Forzar desconexión si falla
            try {
              if (currentRoom.disconnect) currentRoom.disconnect().catch(() => {});
            } catch (e) {}
          });
        }
      } catch (error) {
        // Intentar desconectar de forma forzada
        try {
          if (currentRoom && currentRoom.disconnect) {
            currentRoom.disconnect().catch(() => {});
          }
        } catch (e) {}
      }
    };
    
    // 🔥 EJECUTAR OPERACIONES EN PARALELO
    const disconnectPromise = disconnectLiveKit();
    
    // 🔥 PROCESAR GANANCIAS EN PARALELO (no bloquear)
    const earningsPromise = currentTiempo > 0 && currentOtherUser?.id && currentUserData?.id
      ? (async () => {
          try {
            const earningsReason = currentUserData?.role === 'modelo' ? 'model_next' : 'client_next';
            console.log('💰 [EARNINGS] Intentando procesar ganancias al ir a siguiente:', {
              tiempo: currentTiempo,
              tiempo_minutos: Math.floor(currentTiempo / 60),
              otherUserId: currentOtherUser?.id,
              userDataId: currentUserData?.id,
              userRole: currentUserData?.role,
              endReason: earningsReason
            });
            await processSessionEarnings(currentTiempo, earningsReason);
          } catch (error) {
            console.error('❌ [EARNINGS] Error procesando ganancias:', error);
          }
        })()
      : Promise.resolve();

    // 🔥 NOTIFICAR AL COMPAÑERO (CRÍTICO - debe llegar)
    if (currentOtherUser?.id && currentRoomName && authToken) {
      try {
        const notifyResponse = await Promise.race([
          fetch(`${API_BASE_URL}/api/livekit/notify-partner-next`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ roomName: currentRoomName })
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        
        if (notifyResponse.ok) {
          console.log('✅ [SiguientePersona] Notificación enviada correctamente al compañero');
        } else {
          console.warn('⚠️ [SiguientePersona] Error al enviar notificación:', notifyResponse.status);
        }
      } catch (error) {
        console.error('❌ [SiguientePersona] Error al notificar compañero:', error);
        // 🔥 REINTENTAR UNA VEZ MÁS
        try {
          await fetch(`${API_BASE_URL}/api/livekit/notify-partner-next`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ roomName: currentRoomName })
          }).catch(() => {});
        } catch (retryError) {
          console.error('❌ [SiguientePersona] Error en reintento:', retryError);
        }
      }
    } else {
      console.warn('⚠️ [SiguientePersona] No se puede notificar - faltan datos:', {
        hasOtherUser: !!currentOtherUser?.id,
        hasRoomName: !!currentRoomName,
        hasAuthToken: !!authToken
      });
    }

    // 🔥 ESPERAR SOLO LO CRÍTICO (máximo 1.5 segundos)
    await Promise.race([
      Promise.all([disconnectPromise, earningsPromise]),
      new Promise((resolve) => setTimeout(resolve, 1500)) // Timeout de 1.5 segundos
    ]);
    
    // 🔥 LIMPIAR DATOS INMEDIATAMENTE
    const itemsToRemove = [
      'roomName', 'userName', 'currentRoom',
      'inCall', 'callToken', 'videochatActive',
      'sessionTime', 'sessionStartTime'
    ];
    
    itemsToRemove.forEach(item => {
      localStorage.removeItem(item);
      sessionStorage.removeItem(item);
    });
    
    clearUserCache();
    
    // 🔥 DISPARAR EVENTO PERSONALIZADO PARA NOTIFICAR AL HEADER QUE SE LIMPIÓ
    window.dispatchEvent(new CustomEvent('videochatCleaned', { detail: { cleaned: true } }));
    
    startSearching();
    
    // 🔥 PEQUEÑO DELAY PARA ASEGURAR QUE EL LOCALSTORAGE SE LIMPIÓ ANTES DE NAVEGAR
    setTimeout(() => {
      // 🔥 NAVEGAR INMEDIATAMENTE
      const userRole = currentUserData?.role || 'cliente';
      const urlParams = new URLSearchParams({
        role: userRole,
        action: 'siguiente',
        from: 'videochat_siguiente',
        excludeUser: currentOtherUser?.id || '',
        excludeUserName: currentOtherUser?.name || '',
        selectedCamera: selectedCamera || selectedCameraDevice || '',
        selectedMic: selectedMic || selectedMicrophoneDevice || ''
      });
      
      navigate(`/usersearch?${urlParams}`, { replace: true });
    }, 100);
    
    // 🔥 RESETEAR FLAG DESPUÉS DE UN DELAY
    setTimeout(() => {
      isDisconnectingRef.current = false;
    }, 1000);
  }, [roomName, otherUser, userData, tiempo, navigate, room, startSearching, clearUserCache, processSessionEarnings, selectedCamera, selectedMic, selectedCameraDevice, selectedMicrophoneDevice]);
  window.siguientePersona = siguientePersona;


  // 🔥 FUNCIÓN PARA TOGGLE DE CÁMARA - CON REGLAS ESPECÍFICAS DE MODELO
  const toggleCamera = useCallback(async () => {
    // 🔥 PARA MODELO: La cámara siempre debe estar encendida, no permitir desactivarla
    if (userData?.role === 'modelo') {
      // Asegurar que esté encendida
      if (!cameraEnabled) {
        setCameraEnabled(true);
        // 🔥 ACTUALIZAR EN LIVEKIT
        try {
          const currentRoom = room || window.livekitRoom;
          if (currentRoom?.localParticipant) {
            await currentRoom.localParticipant.setCameraEnabled(true);
          }
        } catch (error) {
          console.error('❌ Error actualizando cámara en LiveKit:', error);
        }
      }
      return;
    }
    // 🔥 PARA CLIENTE: Permitir toggle normal (activar/desactivar)
    const newValue = !cameraEnabled;
    setCameraEnabled(newValue);
    
    // 🔥 ACTUALIZAR EN LIVEKIT INMEDIATAMENTE
    try {
      const currentRoom = room || window.livekitRoom;
      if (currentRoom?.localParticipant) {
        await currentRoom.localParticipant.setCameraEnabled(newValue);
        console.log(`📹 [CLIENTE] Cámara ${newValue ? 'activada' : 'desactivada'} en LiveKit`);
      }
    } catch (error) {
      console.error('❌ Error actualizando cámara en LiveKit:', error);
    }
  }, [cameraEnabled, room, userData?.role]);

  // 🔥 FUNCIÓN PARA TOGGLE DE MICRÓFONO (PERMITIR PARA AMBOS ROLES)
  const toggleMic = useCallback(async () => {
    // 🔥 PERMITIR DESACTIVAR/ACTIVAR MICRÓFONO PARA AMBOS ROLES (MODELO Y CLIENTE)
    const newValue = !micEnabled;
    setMicEnabled(newValue);
    micEnabledRef.current = newValue; // 🔥 ACTUALIZAR REF TAMBIÉN
    
    // 🔥 ACTUALIZAR EN LIVEKIT INMEDIATAMENTE
    try {
      const currentRoom = room || window.livekitRoom;
      if (currentRoom?.localParticipant) {
        await currentRoom.localParticipant.setMicrophoneEnabled(newValue);
        console.log(`🔊 [${userData?.role || 'USER'}] Micrófono ${newValue ? 'activado' : 'desactivado'} en LiveKit`);
      }
    } catch (error) {
      console.error('❌ Error actualizando micrófono en LiveKit:', error);
    }
  }, [micEnabled, room, userData?.role]);

  // 🔥 WRAPPER PARA setMicEnabled QUE ACEPTA VALOR OPCIONAL O HACE TOGGLE
  const handleSetMicEnabled = useCallback(async (newValue) => {
    // Si se pasa un valor explícito, usarlo; si no, hacer toggle
    const finalValue = newValue !== undefined ? newValue : !micEnabled;
    setMicEnabled(finalValue);
    micEnabledRef.current = finalValue;
    
    // 🔥 ACTUALIZAR EN LIVEKIT INMEDIATAMENTE
    try {
      const currentRoom = room || window.livekitRoom;
      if (currentRoom?.localParticipant) {
        await currentRoom.localParticipant.setMicrophoneEnabled(finalValue);
        console.log(`🔊 [${userData?.role || 'USER'}] Micrófono ${finalValue ? 'activado' : 'desactivado'} en LiveKit`);
      }
    } catch (error) {
      console.error('❌ Error actualizando micrófono en LiveKit:', error);
    }
  }, [micEnabled, room, userData?.role]);

  // 🔥 WRAPPER PARA setCameraEnabled QUE ACEPTA VALOR OPCIONAL O HACE TOGGLE
  const handleSetCameraEnabled = useCallback(async (newValue) => {
    // 🔥 PARA MODELO: La cámara siempre debe estar encendida
    if (userData?.role === 'modelo') {
      if (newValue === false) {
        // No permitir desactivar para modelo
        return;
      }
      // Si se intenta activar o hacer toggle, asegurar que esté encendida
      const finalValue = true;
      setCameraEnabled(finalValue);
      
      try {
        const currentRoom = room || window.livekitRoom;
        if (currentRoom?.localParticipant) {
          await currentRoom.localParticipant.setCameraEnabled(finalValue);
        }
      } catch (error) {
        console.error('❌ Error actualizando cámara en LiveKit:', error);
      }
      return;
    }
    
    // 🔥 PARA CLIENTE: Permitir toggle o establecer valor explícito
    const finalValue = newValue !== undefined ? newValue : !cameraEnabled;
    setCameraEnabled(finalValue);
    
    // 🔥 ACTUALIZAR EN LIVEKIT INMEDIATAMENTE
    try {
      const currentRoom = room || window.livekitRoom;
      if (currentRoom?.localParticipant) {
        await currentRoom.localParticipant.setCameraEnabled(finalValue);
        console.log(`📹 [CLIENTE] Cámara ${finalValue ? 'activada' : 'desactivada'} en LiveKit`);
      }
    } catch (error) {
      console.error('❌ Error actualizando cámara en LiveKit:', error);
    }
  }, [cameraEnabled, room, userData?.role]);

  const onCameraSwitch = useCallback(() => {
    // 🔥 USAR toggleCamera PARA CONSISTENCIA
    toggleCamera();
    cambiarCamara();
  }, [toggleCamera]);

  const finalizarChat = useCallback(async (forceEnd = false) => {
    // 🔥 PROTECCIÓN MÚLTIPLE CONTRA EJECUCIONES SIMULTÁNEAS
    if (isFinalizingRef.current || window.finalizandoChat || isHangingUp) {
      console.log('⏸️ [FinalizarChat] Ya se está ejecutando, ignorando llamada');
      return;
    }
    
    // 🔥 MARCAR INMEDIATAMENTE PARA FEEDBACK VISUAL Y PROTECCIÓN
    isFinalizingRef.current = true;
    window.finalizandoChat = true;
    setIsHangingUp(true); // 🔥 FEEDBACK VISUAL INMEDIATO
    
    const authToken = localStorage.getItem('token');
    const currentRoomName = roomName;
    const currentOtherUser = otherUser;
    const currentTiempo = tiempo;
    const currentUserData = userData;
    const currentRoom = room || window.livekitRoom;
    
    // 🔥 DESCONECTAR DE LIVEKIT INMEDIATAMENTE (NO ESPERAR)
    const disconnectLiveKit = async () => {
      try {
        if (currentRoom && currentRoom.state !== 'disconnected') {
          await Promise.race([
            currentRoom.disconnect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]).catch(() => {
            // Forzar desconexión si falla
            try {
              if (currentRoom.disconnect) currentRoom.disconnect().catch(() => {});
            } catch (e) {}
          });
        }
      } catch (error) {
        // Intentar desconectar de forma forzada
        try {
          if (currentRoom && currentRoom.disconnect) {
            currentRoom.disconnect().catch(() => {});
          }
        } catch (e) {}
      }
    };
    
    // 🔥 EJECUTAR DESCONEXIÓN EN PARALELO CON OTRAS OPERACIONES
    const disconnectPromise = disconnectLiveKit();
    
    try {
      if (!authToken) {
        throw new Error('No auth token');
      }

      // 🔥 PROCESAR GANANCIAS EN PARALELO (no bloquear)
      const earningsPromise = currentTiempo > 0 && currentOtherUser?.id && currentUserData?.id
        ? (async () => {
            try {
              let endReason = forceEnd ? 'balance_exhausted' : 'client_ended';
              if (currentUserData?.role === 'modelo') {
                endReason = forceEnd ? 'balance_exhausted' : 'model_ended';
              }
              console.log('💰 [EARNINGS] Intentando procesar ganancias al desconectar:', {
                tiempo: currentTiempo,
                tiempo_minutos: Math.floor(currentTiempo / 60),
                otherUserId: currentOtherUser?.id,
                userDataId: currentUserData?.id,
                userRole: currentUserData?.role,
                endReason
              });
              await processSessionEarnings(currentTiempo, endReason);
            } catch (error) {
              console.error('❌ [EARNINGS] Error procesando ganancias:', error);
            }
          })()
        : Promise.resolve();

      // 🔥 NOTIFICAR AL COMPAÑERO Y FINALIZAR SESIÓN EN PARALELO
      const apiPromises = [];
      
      // Notificar al compañero
      if (currentOtherUser?.id && currentRoomName && authToken) {
        const notifyPromise = (async () => {
          try {
            let reason = forceEnd ? 'client_balance_exhausted' : 'client_ended_session';
            if (currentUserData?.role === 'modelo') {
              reason = forceEnd ? 'model_balance_exhausted' : 'model_ended_session';
            }
            
            await Promise.race([
              fetch(`${API_BASE_URL}/api/livekit/notify-partner-stop`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ 
                  roomName: currentRoomName,
                  reason: reason
                })
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]).catch(() => {});
          } catch (error) {
            console.error('Error notificando compañero:', error);
          }
        })();
        apiPromises.push(notifyPromise);
      }
      
      // Finalizar sesión de monedas
      if (currentRoomName && authToken) {
        const endSessionPromise = (async () => {
          try {
            await Promise.race([
              fetch(`${API_BASE_URL}/api/livekit/end-coin-session`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ 
                  roomName: currentRoomName,
                  reason: forceEnd ? 'balance_exhausted' : 'user_ended'
                })
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]).catch(() => {});
          } catch (error) {
            console.error('Error finalizando sesión:', error);
          }
        })();
        apiPromises.push(endSessionPromise);
      }
      
      // End room (no esperar respuesta)
      if (currentRoomName && authToken) {
        fetch(`${API_BASE_URL}/api/livekit/end-room`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ 
            roomName: currentRoomName,
            userName: currentUserData?.name || 'Cliente'
          })
        }).catch(() => {});
      }
      
      // 🔥 ESPERAR SOLO LO CRÍTICO (máximo 2 segundos)
      await Promise.race([
        Promise.all([disconnectPromise, earningsPromise, ...apiPromises]),
        new Promise((resolve) => setTimeout(resolve, 2000)) // Timeout de 2 segundos
      ]);

      // Mostrar mensaje si es automático
      if (forceEnd) {
        setMessages(prev => [{
          id: Date.now(),
          type: 'system', 
          text: t('videochat.balance.sessionEndingAuto'),
          timestamp: Date.now(),
          isOld: false
        }, ...prev]);
      }

      // 🔥 MARCAR QUE ESTAMOS DESCONECTANDO (ANTES DE LIMPIAR)
      isDisconnectingRef.current = true;
      
      // 🔥 LIMPIAR DATOS INMEDIATAMENTE
      const itemsToRemove = [
        'roomName', 'userName', 'currentRoom',
        'inCall', 'callToken', 'videochatActive',
        'sessionTime', 'sessionStartTime'
      ];
      
      itemsToRemove.forEach(item => {
        localStorage.removeItem(item);
        sessionStorage.removeItem(item);
      });
      
      clearUserCache();
      
      // 🔥 DISPARAR EVENTO PERSONALIZADO PARA NOTIFICAR AL HEADER QUE SE LIMPIÓ
      window.dispatchEvent(new CustomEvent('videochatCleaned', { detail: { cleaned: true } }));
      
      // 🔥 ACTUALIZAR HEARTBEAT (no esperar)
      if (authToken) {
        fetch(`${API_BASE_URL}/api/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            activity_type: 'browsing',
            room: null
          })
        }).catch(() => {});
      }
      
      // 🔥 PEQUEÑO DELAY PARA ASEGURAR QUE EL LOCALSTORAGE SE LIMPIÓ ANTES DE NAVEGAR
      setTimeout(() => {
        // 🔥 NAVEGAR INMEDIATAMENTE (NO ESPERAR)
        const targetRoute = currentUserData?.role === 'modelo' ? '/homellamadas' : '/homecliente';
        navigate(targetRoute, { replace: true, state: null });
      }, 100);
      
    } catch (error) {
      console.error('Error en finalizarChat:', error);
      
      // Fallback: limpiar y navegar de todas formas
      try {
        localStorage.removeItem('roomName');
        localStorage.removeItem('userName');
        localStorage.removeItem('currentRoom');
        localStorage.removeItem('inCall');
        localStorage.removeItem('videochatActive');
        sessionStorage.removeItem('roomName');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('currentRoom');
        sessionStorage.removeItem('inCall');
        sessionStorage.removeItem('videochatActive');
        
        // 🔥 DISPARAR EVENTO PERSONALIZADO PARA NOTIFICAR AL HEADER QUE SE LIMPIÓ
        window.dispatchEvent(new CustomEvent('videochatCleaned', { detail: { cleaned: true } }));
        
        if (currentRoom) currentRoom.disconnect().catch(() => {});
        if (window.livekitRoom) window.livekitRoom.disconnect().catch(() => {});
        
        setTimeout(() => {
          const targetRoute = currentUserData?.role === 'modelo' ? '/homellamadas' : '/homecliente';
          navigate(targetRoute, { replace: true });
        }, 100);
      } catch (fallbackError) {
        // 🔥 DISPARAR EVENTO PERSONALIZADO INCLUSO EN CASO DE ERROR
        window.dispatchEvent(new CustomEvent('videochatCleaned', { detail: { cleaned: true } }));
        const targetRoute = currentUserData?.role === 'modelo' ? '/homellamadas' : '/homecliente';
        window.location.href = targetRoute;
      }
    } finally {
      // 🔥 RESETEAR FLAGS DESPUÉS DE UN DELAY
      setTimeout(() => {
        isDisconnectingRef.current = false;
        isFinalizingRef.current = false;
        window.finalizandoChat = false;
        setIsHangingUp(false);
      }, 1000);
    }
  }, [roomName, otherUser, userData, tiempo, navigate, setMessages, room, startSearching, clearUserCache, processSessionEarnings, isHangingUp]);

  // 🔥 MONITOREO DE TIEMPO RESTANTE: ADVERTENCIA A 2 MINUTOS Y FINALIZACIÓN AUTOMÁTICA
  useEffect(() => {
    // Solo aplicar para clientes (no para modelos)
    if (userData?.role === 'modelo') {
      return;
    }

    // Solo si hay una llamada activa
    if (!connected || !roomName || !otherUser?.id) {
      return;
    }

    let autoEndTimeout = null;

    // 🔥 ADVERTENCIA A LOS 2 MINUTOS
    if (remainingMinutes <= 2 && remainingMinutes > 0 && !warningShown) {
      console.warn('⚠️ [BALANCE] Advertencia: Quedan 2 minutos o menos');
      setWarningShown(true);
      
      // Mostrar notificación de advertencia
      addNotification(
        'warning',
        '⚠️ Tiempo limitado',
        `Te quedan ${remainingMinutes} minuto${remainingMinutes !== 1 ? 's' : ''}. La llamada se finalizará automáticamente cuando se acabe el tiempo.`,
        10000 // 10 segundos de duración
      );
    }

    // 🔥 MOSTRAR MODAL CUANDO QUEDAN 2 MINUTOS O MENOS
    if (remainingMinutes <= 2 && remainingMinutes >= 0 && !hasAutoEndedRef.current && connected && finalizarChat && !showLowBalanceModal) {
      console.warn('🚨 [BALANCE] Tiempo restante <= 2 minutos - Mostrando modal de saldo bajo', { remainingMinutes });
      setShowLowBalanceModal(true);
      hasAutoEndedRef.current = true;
      
      // Cerrar modal de regalos si está abierto
      setShowGiftsModal(false);
    }

    // 🔥 RESETEAR ADVERTENCIA SI EL TIEMPO AUMENTA (por ejemplo, si recarga monedas)
    // 🔥 IMPORTANTE: NO resetear hasAutoEndedRef si ya se ejecutó el corte (para evitar que se resetee si el tiempo vuelve a subir temporalmente)
    if (remainingMinutes > 2) {
      setWarningShown(false);
      // Solo resetear hasAutoEndedRef si realmente hay tiempo suficiente (más de 2 minutos)
      // y si no se ha ejecutado ya el corte
      if (remainingMinutes > 3 && hasAutoEndedRef.current) {
        // Solo resetear si hay tiempo suficiente (más de 3 minutos) para evitar resets accidentales
        hasAutoEndedRef.current = false;
      }
    }

    // Cleanup: cancelar el timeout si el componente se desmonta o cambian las dependencias
    return () => {
      if (autoEndTimeout) {
        clearTimeout(autoEndTimeout);
      }
    };
  }, [remainingMinutes, connected, roomName, otherUser?.id, userData?.role, warningShown, finalizarChat, addNotification]);

  // 🔥 EFECTO PARA CERRAR MODAL DE REGALOS CUANDO EL TIEMPO ES 2 MINUTOS O MENOS
  useEffect(() => {
    // Solo aplicar para clientes (no para modelos)
    if (userData?.role === 'modelo') {
      return;
    }

    // Si el tiempo es 2 minutos o menos, cerrar el modal de regalos automáticamente
    if (remainingMinutes <= 2 && showGiftsModal) {
      console.log('🚨 [REGALOS] Tiempo <= 2 minutos - Cerrando modal de regalos');
      setShowGiftsModal(false);
    }
  }, [remainingMinutes, showGiftsModal, userData?.role]);

  // 🔥 FUNCIÓN DE DESCONEXIÓN MEJORADA - FUNCIONA PARA AMBOS ROLES
  // ========== FUNCIONES DE DESCONEXIÓN - EXACTAMENTE IGUAL QUE LA MODELO ==========
  const handleModeloDisconnected = (reason = 'stop', customMessage = '') => {
    
    setLoading(false);
    setConnected(false);
    // Nota: En el cliente no hay detenerTiempoReal, pero podemos limpiar el tiempo
    setTiempo(0);
    if (tiempoIntervalRef.current) {
      clearInterval(tiempoIntervalRef.current);
      tiempoIntervalRef.current = null;
    }

    // 🔥 DETERMINAR MENSAJES SEGÚN EL ROL
    const isModelo = userData?.role === 'modelo';
    const partnerName = isModelo ? t('videochat.disconnect.client') : t('videochat.disconnect.model');
    const defaultNextMessage = isModelo 
      ? t('videochat.disconnect.clientWentNext') 
      : t('videochat.disconnect.modelSkipped');
    const defaultStopMessage = isModelo
      ? t('videochat.disconnect.clientEnded')
      : t('videochat.disconnect.modelEnded');

    // 🔥 EXACTAMENTE IGUAL QUE LA MODELO - Simplificado
    // 🔥 IMPORTANTE: Actualizar TODOS los estados de una vez para forzar re-render
    if (reason === 'next' || reason === 'partner_went_next') {
      setDisconnectionReason(customMessage || defaultNextMessage);
      setDisconnectionType('next');
      setPendingRedirectAction('next');
      setModeloDisconnected(true); // 🔥 AGREGADO: También poner en true para que se muestre el cartel
    } else if (reason === 'partner_left_session') {
      // 🔥 CAMBIO: Cuando el compañero cuelga, también ir a ruletear (no a home)
      setModeloDisconnected(true);
      setDisconnectionReason(customMessage || defaultStopMessage);
      setDisconnectionType('partner_left_session'); // 🔥 USAR 'partner_left_session' PARA QUE EL MODAL MUESTRE EL MENSAJE CORRECTO
      setPendingRedirectAction('next'); // 🔥 CAMBIO: Ir a ruletear en lugar de home
    } else if (reason === 'stop') {
      // 🔥 ACTUALIZAR TODOS LOS ESTADOS SIMULTÁNEAMENTE (solo cuando el usuario mismo cuelga)
      setModeloDisconnected(true);
      setDisconnectionReason(customMessage || defaultStopMessage);
      setDisconnectionType('stop');
      // Si es modelo, ir a ruletear; si es cliente, ir a homecliente
      setPendingRedirectAction(isModelo ? 'next' : 'stop');
    } else {
      // 🔥 ACTUALIZAR TODOS LOS ESTADOS SIMULTÁNEAMENTE
      setModeloDisconnected(true);
      setDisconnectionReason(customMessage || t('videochat.disconnect.partnerLeftSession', { partner: partnerName }));
      setDisconnectionType('stop');
      setPendingRedirectAction('next'); // Por defecto, ir a ruletear si no se especifica
    }

    // 🔥 NOTA: Los setState son asíncronos, así que este log muestra el estado ANTES de actualizar
    // El render debería detectar el cambio después
    console.log('🔴 [VideoChat] Desconexión de modelo:', {
      modeloDisconnected,
      disconnectionReason,
      disconnectionType,
      pendingRedirectAction
    });

    startRedirectCountdown();
  };
  
  // 🔥 FUNCIÓN CENTRALIZADA PARA DETECTAR DESCONEXIÓN CON PERÍODO DE GRACIA DE 30 SEGUNDOS
  const detectPartnerDisconnection = useCallback((participant = null, immediate = false) => {
    // 🔥 PREVENIR MÚLTIPLES DETECCIONES SIMULTÁNEAS (más estricto)
    if (isDetectingDisconnectionRef.current && !immediate) {
      console.log('⏸️ [VideoChat] Detección de desconexión ya en progreso - ignorando');
      return;
    }
    
    // 🔥 VERIFICAR QUE NO HAY PARTICIPANTES REMOTOS ANTES DE INICIAR DETECCIÓN
    const currentRoom = room || window.livekitRoom;
    const currentRemoteCount = currentRoom?.remoteParticipants?.size || 0;
    if (currentRemoteCount > 0 && !immediate) {
      console.log('✅ [VideoChat] Hay participantes remotos - cancelando detección de desconexión');
      hadRemoteParticipantsRef.current = true;
      return;
    }
    
    // Si ya hay una desconexión activa, no hacer nada
    if (modeloDisconnected || (disconnectionReason && redirectCountdown > 0) || isProcessingLeave) {
      return;
    }
    
    const currentUserRole = userData?.role;
    const partnerRole = otherUser?.role;
    const remoteCount = room?.remoteParticipants?.size || window.livekitRoom?.remoteParticipants?.size || 0;
    const hadActiveSession = hadRemoteParticipantsRef.current || tiempo > 0 || !!otherUser;
    
    // Verificar si realmente es el compañero
    let isPartner = false;
    if (participant && participant.identity) {
      const participantIdentity = participant.identity.toLowerCase();
      isPartner = 
        (currentUserRole === 'cliente' && (
          participantIdentity.includes('modelo') || 
          participantIdentity.includes('model') ||
          (partnerRole === 'modelo' && participantIdentity.includes(otherUser?.name?.toLowerCase()))
        )) ||
        (currentUserRole === 'modelo' && (
          participantIdentity.includes('cliente') || 
          participantIdentity.includes('client') ||
          (partnerRole === 'cliente' && participantIdentity.includes(otherUser?.name?.toLowerCase()))
        ));
    } else if (remoteCount === 0 && hadActiveSession) {
      // Si no hay participantes remotos y había sesión activa, asumir que es el compañero
      isPartner = true;
    }
    
    if (!isPartner || !hadActiveSession || !connected) {
      return;
    }
    
    // Si es inmediato (notificación del backend), procesar de inmediato
    if (immediate) {
      isDetectingDisconnectionRef.current = true;
      const partnerName = currentUserRole === 'cliente' ? 'La modelo' : 'El cliente';
      handleModeloDisconnected('partner_left_session', `${partnerName} se desconectó de la videollamada`);
      return;
    }
    
    // 🔥 PERÍODO DE GRACIA DE 60 SEGUNDOS ANTES DE DETECTAR DESCONEXIÓN
    // Limpiar timeout anterior si existe
    if (disconnectDetectionTimeoutRef.current) {
      clearTimeout(disconnectDetectionTimeoutRef.current);
    }
    
    isDetectingDisconnectionRef.current = true;
    
    disconnectDetectionTimeoutRef.current = setTimeout(() => {
      // Verificar nuevamente después del período de gracia con múltiples validaciones
      const currentRoom = room || window.livekitRoom;
      const currentRemoteCount = currentRoom?.remoteParticipants?.size || 0;
      const stillConnected = currentRoom?.state === 'connected';
      const currentHadActiveSession = hadRemoteParticipantsRef.current || tiempo > 0 || !!otherUser;
      
      // 🔥 VALIDACIONES MÚLTIPLES PARA EVITAR FALSOS POSITIVOS
      // 1. No debe haber participantes remotos
      // 2. La room debe estar conectada
      // 3. Debe haber tenido una sesión activa
      // 4. No debe haber una desconexión ya procesada
      // 5. No debe estar procesando una salida
      // 6. Verificar que realmente no hay participantes (doble verificación)
      if (currentRemoteCount === 0 && 
          stillConnected && 
          currentHadActiveSession && 
          !modeloDisconnected && 
          !(disconnectionReason && redirectCountdown > 0) && 
          !isProcessingLeave) {
        
        // 🔥 VERIFICACIÓN FINAL: Esperar 2 segundos más y verificar una vez más
        setTimeout(() => {
          const finalRemoteCount = currentRoom?.remoteParticipants?.size || 0;
          const finalStillConnected = currentRoom?.state === 'connected';
          
          // Solo procesar si después de 2 segundos adicionales sigue desconectado
          if (finalRemoteCount === 0 && 
              finalStillConnected && 
              !modeloDisconnected && 
              !(disconnectionReason && redirectCountdown > 0) && 
              !isProcessingLeave) {
            const partnerName = currentUserRole === 'cliente' ? 'La modelo' : 'El cliente';
            // Intentar reconectar antes de marcar desconexión definitiva
            attemptReconnectThenHandle('partner_left_session', `${partnerName} se desconectó de la videollamada`);
          } else {
            // Se reconectó, cancelar detección
            isDetectingDisconnectionRef.current = false;
          }
        }, 2000);
      } else {
        // Se reconectó o ya se procesó, cancelar detección
        isDetectingDisconnectionRef.current = false;
      }
      
      disconnectDetectionTimeoutRef.current = null;
    }, 60000); // 🔥 60 segundos de período de gracia (aumentado para reducir falsos positivos)
  }, [room, userData?.role, otherUser, tiempo, connected, modeloDisconnected, disconnectionReason, redirectCountdown, isProcessingLeave, handleModeloDisconnected]);
  
  // 🔥 EFECTO PARA VERIFICAR CUANDO CAMBIAN LOS ESTADOS DE DESCONEXIÓN
  useEffect(() => {
    if (modeloDisconnected || disconnectionReason) {
      // Estados actualizados
    }
  }, [modeloDisconnected, disconnectionReason, disconnectionType, pendingRedirectAction, redirectCountdown]);

  const startRedirectCountdown = useCallback(() => {
    // 🔥 EXACTAMENTE IGUAL QUE LA MODELO - Sin useCallback, función simple
    
    // Limpiar cualquier intervalo anterior
    if (window.redirectCountdownInterval) {
      clearInterval(window.redirectCountdownInterval);
    }
    
    let timeLeft = 8;
    setRedirectCountdown(timeLeft);

    window.redirectCountdownInterval = setInterval(() => {
      timeLeft--;
      setRedirectCountdown(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(window.redirectCountdownInterval);
        window.redirectCountdownInterval = null;
        // 🔥 FORZAR ACTUALIZACIÓN DEL ESTADO PARA GARANTIZAR QUE EL useEffect SE EJECUTE
        setRedirectCountdown(0);
      }
    }, 1000);
  }, []);

  // 🔥 FUNCIÓN PARA MANEJAR DESCONEXIÓN INICIADA POR EL CLIENTE
  const handleClientInitiatedDisconnect = (reason = 'stop', customMessage = '', redirectAction = null) => {
    
    setLoading(false);
    setConnected(false);
    setTiempo(0);
    if (tiempoIntervalRef.current) {
      clearInterval(tiempoIntervalRef.current);
      tiempoIntervalRef.current = null;
    }

    // Establecer el tipo de desconexión y razón PRIMERO
    if (reason === 'next') {
      setDisconnectionType('next');
      setDisconnectionReason(customMessage || t('videochat.disconnect.youWentNext'));
      setPendingRedirectAction('next'); // Ir a ruletear
      setModeloDisconnected(false); // No es desconexión de la modelo
    } else if (reason === 'stop') {
      setDisconnectionType('stop');
      setDisconnectionReason(customMessage || 'Finalizaste la videollamada');
      setPendingRedirectAction('stop'); // Ir al inicio
      setModeloDisconnected(false); // No es desconexión de la modelo
    } else {
      setDisconnectionType('stop');
      setDisconnectionReason(customMessage || 'Sesión finalizada');
      setPendingRedirectAction(redirectAction || 'stop');
      setModeloDisconnected(false);
    }

    // Iniciar countdown DESPUÉS de establecer los estados
    setTimeout(() => {
      startRedirectCountdown();
    }, 100);
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
          addNotification('success', t('videochat.favorite.removed'), t('videochat.favorite.removedMessage', { name: otherUser.name }));
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
          addNotification('success', t('videochat.favorite.added'), t('videochat.favorite.addedMessage', { name: otherUser.name }));
        }
      }
    } catch (error) {
      addNotification('error', t('videochat.error.title'), t('videochat.error.favoritesConnectionError'));
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
        addNotification('success', t('videochat.block.userBlocked'), t('videochat.block.userBlockedMessage', { name: otherUser.name }));
        
        setTimeout(() => {
          siguientePersona();
        }, 1500);
      } else {
        addNotification('error', t('videochat.error.title'), data.error || t('videochat.error.blockUserError'));
      }
    } catch (error) {
      addNotification('error', t('videochat.error.title'), t('videochat.error.connectionError'));
    } finally {
      setIsBlocking(false);
    }
  };

  // 🔥 REFS PARA EVITAR MÚLTIPLAS PETICIONES A checkIfFavorite
  const checkIfFavoriteCallRef = useRef(false);
  const lastCheckIfFavoriteTimeRef = useRef(0);
  const favoritesCacheRef = useRef({}); // 🔥 Cache de favoritos por userId
  const lastFavoritesListFetchRef = useRef(0);

  const checkIfFavorite = async (userId) => {
    if (!userId) return;
    
    // 🔥 PROTECCIÓN CONTRA MÚLTIPLAS EJECUCIONES SIMULTÁNEAS
    if (checkIfFavoriteCallRef.current) {
      return;
    }
    
    // 🔥 MÍNIMO 10 SEGUNDOS ENTRE LLAMADAS
    const now = Date.now();
    if (now - lastCheckIfFavoriteTimeRef.current < 10000) {
      return;
    }
    
    // 🔥 VERIFICAR CACHE PRIMERO (si tenemos la lista de favoritos en cache)
    const cacheKey = `favorites_${userId}`;
    const cachedTime = lastFavoritesListFetchRef.current;
    if (favoritesCacheRef.current[cacheKey] !== undefined && (now - cachedTime < 60000)) {
      setIsFavorite(favoritesCacheRef.current[cacheKey]);
      return;
    }
    
    checkIfFavoriteCallRef.current = true;
    lastCheckIfFavoriteTimeRef.current = now;
    
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        checkIfFavoriteCallRef.current = false;
        return;
      }
      
      const response = await Promise.race([
        fetch(`${API_BASE_URL}/api/favorites/list`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      
      if (!response.ok) {
        checkIfFavoriteCallRef.current = false;
        return;
      }
      
      const data = await response.json();
      if (data.success && data.favorites) {
        // 🔥 CACHEAR TODA LA LISTA DE FAVORITOS
        lastFavoritesListFetchRef.current = now;
        data.favorites.forEach(fav => {
          favoritesCacheRef.current[`favorites_${fav.id}`] = true;
        });
        
        const isFav = data.favorites.some(fav => fav.id == userId);
        favoritesCacheRef.current[cacheKey] = isFav;
        setIsFavorite(isFav);
      }
    } catch (error) {
      // 🔥 SILENCIAR ERRORES
    } finally {
      setTimeout(() => {
        checkIfFavoriteCallRef.current = false;
      }, 10000); // 🔥 Mínimo 10 segundos entre llamadas
    }
  };

  // 🔥 FUNCIÓN PARA OBTENER NOMBRE DISPLAY MEJORADA (CON NICKNAME)
  const getDisplayName = () => {
    if (!roomName || !userName) return "Configurando...";
    
    const cacheKey = getRoomCacheKey(roomName, userName);
    const cached = USER_CACHE.get(cacheKey);
    
    // Obtener el usuario (de cache o otherUser)
    const user = cached || otherUser;
    
    if (user) {
      // Si hay nickname para este usuario, usarlo; si no, usar el nombre original
      const nickname = apodos[user.id];
      return nickname || user.name || user.display_name || "Modelo";
    }
    
    if (isDetectingUser) return hardcodedTexts.connecting;
    
    return hardcodedTexts.waitingModel;
  };


  const handleAcceptGift = async (requestId, securityHashOrGiftData) => {
    if (processingGift === requestId) {
      return;
    }

    try {
      setProcessingGift(requestId);

      // 🔥 EXTRAER securityHash - puede venir como segundo parámetro directo o dentro de giftData
      let securityHash = null;
      let giftDataFromParam = null;
      
      if (securityHashOrGiftData) {
        if (typeof securityHashOrGiftData === 'string') {
          // Si es un string, es el securityHash directo
          securityHash = securityHashOrGiftData;
        } else if (typeof securityHashOrGiftData === 'object') {
          // Si es un objeto, es giftData - extraer security_hash de ahí
          giftDataFromParam = securityHashOrGiftData;
          securityHash = giftDataFromParam.security_hash || giftDataFromParam.securityHash || null;
        }
      }

      // 🔥 STEP 1: OBTENER INFORMACIÓN DE LA SOLICITUD PENDIENTE Y DEL MENSAJE ORIGINAL
      let giftRequestInfo = null;
      let originalMessageGiftData = null;
      
      // Buscar en las solicitudes pendientes para obtener el precio
      if (pendingRequests && pendingRequests.length > 0) {
        giftRequestInfo = pendingRequests.find(req => req.id === requestId);
      }
      
      // 🔥 BUSCAR EL MENSAJE ORIGINAL DE SOLICITUD PARA OBTENER LA IMAGEN CORRECTA Y security_hash
      if (messages && messages.length > 0) {
        const originalRequestMessage = messages.find(msg => {
          const msgGiftData = msg.extra_data || msg.gift_data || {};
          const parsedGiftData = typeof msgGiftData === 'string' ? JSON.parse(msgGiftData) : msgGiftData;
          return parsedGiftData.request_id === requestId || parsedGiftData.transaction_id === requestId || msg.id === requestId;
        });
        
        if (originalRequestMessage) {
          try {
            const msgExtraData = originalRequestMessage.extra_data;
            const msgGiftData = originalRequestMessage.gift_data;
            
            if (msgExtraData) {
              originalMessageGiftData = typeof msgExtraData === 'string' ? JSON.parse(msgExtraData) : msgExtraData;
            } else if (msgGiftData) {
              originalMessageGiftData = typeof msgGiftData === 'string' ? JSON.parse(msgGiftData) : msgGiftData;
            }
            
            // 🔥 EXTRAER security_hash DEL MENSAJE ORIGINAL SI NO LO TENEMOS
            if (!securityHash && originalMessageGiftData) {
              securityHash = originalMessageGiftData.security_hash || originalMessageGiftData.securityHash || null;
            }
          } catch (e) {
            console.warn('Error parseando datos del mensaje original:', e);
          }
        }
      }
      
      // 🔥 SI TODAVÍA NO TENEMOS security_hash, INTENTAR OBTENERLO DE giftRequestInfo
      if (!securityHash && giftRequestInfo) {
        securityHash = giftRequestInfo.security_hash || giftRequestInfo.securityHash || null;
      }
      
      // 🔥 SI TODAVÍA NO TENEMOS security_hash, INTENTAR OBTENERLO DE giftDataFromParam
      if (!securityHash && giftDataFromParam) {
        securityHash = giftDataFromParam.security_hash || giftDataFromParam.securityHash || null;
      }

      // 🔥 STEP 2: VERIFICAR SALDO ANTES DE ACEPTAR (si tenemos la info)
      // Obtener el precio del regalo de múltiples fuentes
      const requiredGiftCoins = giftDataFromParam?.gift_price || 
                                 giftDataFromParam?.amount ||
                                 originalMessageGiftData?.gift_price ||
                                 originalMessageGiftData?.amount ||
                                 giftRequestInfo?.amount ||
                                 null;

      if (requiredGiftCoins && giftBalance < requiredGiftCoins) {
        addNotification(
          'error', 
          t('videochat.balance.insufficientGiftCoins'), 
          t('videochat.balance.insufficientGiftCoinsMessage', { required: requiredGiftCoins, current: giftBalance })
        );

        // Cerrar notificación automáticamente
        setShowGiftNotification(false);
        
        return { 
          success: false, 
          error: t('videochat.balance.insufficientBalanceToAcceptGift') 
        };
      }

      // 🔥 STEP 3: PROCEDER CON LA ACEPTACIÓN
      // El hook acceptGift ya maneja el session_token internamente, solo necesitamos pasar securityHash si lo tenemos
      const result = await acceptGift(requestId, securityHash);
      
      if (result.success) {
        // 🔥 Si hay networkError pero success es true, el regalo se procesó exitosamente
        // aunque hubo un error de conexión al recibir la respuesta
        if (result.networkError) {
          console.log('✅ [ACCEPT GIFT] Regalo procesado exitosamente a pesar de error de conexión');
        }
                
        // Cerrar notificación
        setShowGiftNotification(false);
        
        // 🔥 STEP 4: ACTUALIZAR GIFT BALANCE (igual que handleSendGift desde el modal)
        // El endpoint de aceptar regalo devuelve UserGiftCoins.balance, pero necesitamos UserCoins.gift_balance
        // Por eso recargamos desde el endpoint de balance que devuelve gift_balance_coins (igual que handleSendGift)
        
        // 🔥 RECARGAR DESDE EL ENDPOINT DE BALANCE (igual que handleSendGift)
        // Este endpoint devuelve gift_balance_coins de UserCoins, que es el balance correcto
        if (loadUserBalanceRef.current && typeof loadUserBalanceRef.current === 'function') {
          // Usar la referencia para evitar problemas de dependencias
          loadUserBalanceRef.current().then((balanceResult) => {
            // El hook ya actualiza giftBalanceFromHook internamente vía setUserBalance
            // giftBalance = giftBalanceFromHook || giftBalanceState, así que se actualizará automáticamente
            console.log('✅ [ACCEPT GIFT] Balance recargado desde endpoint de balance:', balanceResult);
            // También actualizar giftBalanceState con el valor del endpoint (gift_balance_coins)
            if (balanceResult && balanceResult.success && balanceResult.balance !== undefined) {
              if (typeof setGiftBalanceState === 'function') {
                setGiftBalanceState(balanceResult.balance);
              }
            }
          }).catch((error) => {
            console.warn('⚠️ [ACCEPT GIFT] Error recargando balance:', error);
            // Si falla, intentar con loadGiftBalance como fallback
            if (typeof loadGiftBalance === 'function') {
              setTimeout(() => {
                loadGiftBalance();
              }, 500);
            }
          });
        } else if (typeof loadGiftBalance === 'function') {
          // Fallback: usar loadGiftBalance directamente
          setTimeout(() => {
            loadGiftBalance();
          }, 500);
        }
        
        // 🔥 STEP 5: AGREGAR MENSAJE AL CHAT CON DATOS COMPLETOS
        // 🔥 OBTENER IMAGEN DE MÚLTIPLES FUENTES (prioridad: mensaje original > result > giftRequestInfo)
        const giftImage = originalMessageGiftData?.gift_image || 
                         originalMessageGiftData?.image || 
                         originalMessageGiftData?.image_path ||
                         result.giftInfo?.image || 
                         result.giftInfo?.image_path ||
                         result.transaction?.gift?.image_path ||
                         giftRequestInfo?.gift?.image ||
                         giftRequestInfo?.gift?.image_path ||
                         null;
        
        const giftName = result.giftInfo?.name || 
                        originalMessageGiftData?.gift_name ||
                        giftRequestInfo?.gift?.name || 
                        t('videochat.gift.gift');
        
        // 🔥 OBTENER EL COSTO DEL REGALO
        const giftCost = result.giftInfo?.price || 
                        result.giftInfo?.amount || 
                        result.transaction?.amount ||
                        giftRequestInfo?.amount || 
                        giftRequestInfo?.gift?.price || 
                        originalMessageGiftData?.gift_price ||
                        0;
        
        // 🔥 OBTENER REQUEST_ID PARA VINCULAR EL MENSAJE CON LA SOLICITUD
        const requestIdForMessage = giftRequestInfo?.id || 
                         originalMessageGiftData?.request_id || 
                         originalMessageGiftData?.transaction_id ||
                         result.transaction?.id ||
                         result.transaction?.transaction_id ||
                         requestId ||
                         null;
        
        const giftMessage = {
          id: Date.now(),
          type: 'gift_sent',
          text: `🎁 ${t('videochat.gift.youSent')}: ${giftName}`,
          timestamp: Date.now(),
          isOld: false,
          sender: userData.name,
          senderRole: userData.role,
          user_id: userData.id, // 🔥 AGREGAR user_id PARA QUE LA VERIFICACIÓN FUNCIONE
          // 🔥 DATOS COMPLETOS DEL REGALO CON IMAGEN CORRECTA Y REQUEST_ID
          gift_data: {
            gift_name: giftName,
            gift_image: giftImage, // Usar imagen del mensaje original o del resultado
            gift_price: giftCost,
            action_text: t('videochat.gift.youSent'),
            recipient_name: otherUser?.name || t('videochat.model'),
            request_id: requestIdForMessage, // 🔥 AGREGAR REQUEST_ID
            transaction_id: requestIdForMessage // 🔥 TAMBIÉN COMO TRANSACTION_ID PARA COMPATIBILIDAD
          },
          extra_data: {
            gift_name: giftName,
            gift_image: giftImage, // Usar imagen del mensaje original o del resultado
            gift_price: giftCost,
            action_text: t('videochat.gift.youSent'),
            recipient_name: otherUser?.name || t('videochat.model'),
            request_id: requestIdForMessage, // 🔥 AGREGAR REQUEST_ID
            transaction_id: requestIdForMessage // 🔥 TAMBIÉN COMO TRANSACTION_ID PARA COMPATIBILIDAD
          }
        };
        
        setMessages(prev => [giftMessage, ...prev]);
        
        // 🔥 STEP 6: REPRODUCIR SONIDO DE REGALO ACEPTADO/ENVIADO
        try {
          await playGiftSound('sent');
        } catch (error) {
          console.warn('Error reproduciendo sonido de regalo aceptado:', error);
        }
        
        // 🔥 STEP 7: ACTUALIZAR SOLO GIFTS/BALANCE DESPUÉS DE ENVIAR REGALO
        // 🔥 COMENTADO TEMPORALMENTE PARA EVITAR LOOPS INFINITOS
        // 🔥 El balance se actualizará localmente cuando se envíe el regalo
        // setTimeout(() => {
        //   loadGiftBalance(); // Solo actualizar balance de gifts
        // }, 1000);
        
        // 🔥 STEP 7: NOTIFICACIÓN DE ÉXITO
        // Si hay networkError, usar el mensaje del resultado o uno genérico
        const successMessage = result.networkError 
          ? (result.message || t('videochat.gift.sentMessage', { 
              giftName: giftName, 
              userName: otherUser?.name || t('videochat.model'), 
              cost: giftCost 
            }))
          : t('videochat.gift.sentMessage', { 
              giftName: result.giftInfo?.name || giftName || t('videochat.gift.gift'), 
              userName: otherUser?.name || t('videochat.model'), 
              cost: giftCost 
            });
        
        addNotification(
          'success', 
          t('videochat.gift.sent'), 
          successMessage
        );
        
        return { success: true };
        
      } else {
                
        // 🔥 MANEJO DE ERRORES ESPECÍFICOS
        let errorTitle = t('videochat.error.title');
        let errorMessage = result.error || result.message;
        
        // Si el error viene del backend con un mensaje específico, usarlo
        if (result.message && result.message.includes('Error interno')) {
          errorMessage = result.message;
        } else if (result.error === 'processing_failed' || result.error === 'internal_error') {
          errorMessage = result.message || 'Error al procesar el regalo. Por favor, intenta nuevamente.';
        } else if (result.error?.includes('saldo insuficiente') || result.error?.includes('insufficient balance') || result.error === 'insufficient_balance') {
          errorTitle = t('videochat.balance.insufficientGiftCoins');
          errorMessage = result.message || t('videochat.balance.notEnoughGiftCoins');
        } else if (result.error?.includes('expirado') || result.error?.includes('expired')) {
          errorTitle = t('videochat.gift.requestExpired');
          errorMessage = result.message || t('videochat.gift.requestExpiredMessage');
        } else if (result.error?.includes('ya procesada') || result.error?.includes('already processed') || result.error === 'request_not_found' || result.error === 'invalid_request') {
          // Si la solicitud ya fue procesada, no mostrar error (puede ser doble click)
          // Solo recargar balance para asegurar sincronización
          if (loadUserBalanceRef.current && typeof loadUserBalanceRef.current === 'function') {
            loadUserBalanceRef.current();
          }
          console.log('ℹ️ [ACCEPT GIFT] Solicitud ya procesada, ignorando error');
          return { success: true }; // Considerar como éxito
        } else if (result.error === 'security_violation') {
          errorMessage = result.message || 'Error de seguridad. Por favor, recarga la página.';
        }
        
        addNotification('error', errorTitle, errorMessage);
        
        // Cerrar notificación en caso de error
        setShowGiftNotification(false);
        
        return { success: false, error: errorMessage };
      }
      
    } catch (error) {
      // 🔥 MANEJAR ERRORES DE RED ESPECÍFICAMENTE
      // Si es un error 404, puede ser que la solicitud ya fue procesada
      if (error.message?.includes('404') || error.status === 404 || error.response?.status === 404) {
        console.log('ℹ️ [ACCEPT GIFT] Error 404 en catch - solicitud puede que ya fue procesada');
        // Recargar balance por si acaso
        if (loadUserBalanceRef.current && typeof loadUserBalanceRef.current === 'function') {
          loadUserBalanceRef.current();
        }
        // No mostrar error, puede ser doble click o procesado en otra pestaña
        return { success: true };
      }
      
      // Solo mostrar error si es un error real de conexión (no 404)
      console.error('❌ [ACCEPT GIFT] Error real:', error);
      addNotification('error', t('videochat.error.connectionErrorTitle'), t('videochat.error.couldNotProcessGift'));
      
      // Cerrar notificación en caso de error crítico
      setShowGiftNotification(false);
      
      return { success: false, error: t('videochat.error.connectionError') };
      
    } finally {
      setProcessingGift(null);
    }
  };

  // 🔥 FUNCIÓN PARA RECHAZAR REGALO (CLIENTE)
  const handleRejectGift = async (requestId, reason = '') => {
    try {
            
      const result = await rejectGift(requestId, reason);
      
      if (result.success) {
                
        // Cerrar notificación
        setShowGiftNotification(false);
        
        // Agregar mensaje al chat
        const rejectMessage = {
          id: Date.now(),
          type: 'gift_rejected',
          text: `❌ ${t('videochat.gift.giftRejected')}`,
          timestamp: Date.now(),
          isOld: false,
          sender: userData.name,
          senderRole: userData.role
        };
        setMessages(prev => [rejectMessage, ...prev]);
        
        return { success: true };
      } else {
                addNotification('error', t('videochat.error.title'), result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
            addNotification('error', t('videochat.error.title'), t('videochat.error.connectionError'));
      return { success: false, error: t('videochat.error.connectionError') };
    }
  };
 
  const loadDevices = async () => {
  setIsLoadingDevices(true);
  let stream = null;
  
  try {
    // Solicitar permisos primero con reintentos
    let retries = 3;
    let lastError = null;
    
    while (retries > 0) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        console.log('✅ [DEVICES] Permisos obtenidos correctamente');
        break; // Éxito, salir del loop
      } catch (error) {
        lastError = error;
        retries--;
        console.warn(`⚠️ [DEVICES] Error obteniendo permisos (intentos restantes: ${retries}):`, error);
        
        if (retries > 0) {
          // Esperar antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!stream) {
      throw lastError || new Error('No se pudieron obtener permisos después de múltiples intentos');
    }
    
    // Obtener lista de dispositivos
    const devices = await navigator.mediaDevices.enumerateDevices();
        
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const audioDevices = devices.filter(device => device.kind === 'audioinput');
    
    console.log(`✅ [DEVICES] Dispositivos encontrados: ${videoDevices.length} cámaras, ${audioDevices.length} micrófonos`);
    
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
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
  } catch (error) {
    console.error('❌ [DEVICES] Error cargando dispositivos:', error);
    const errorMessage = error.name === 'NotAllowedError' 
      ? t('videochat.error.devicePermissionDenied')
      : error.name === 'NotFoundError'
      ? t('videochat.error.deviceNotFound')
      : t('videochat.error.couldNotGetDevices');
    
    addNotification('error', t('videochat.error.deviceErrorTitle'), errorMessage);
  } finally {
    setIsLoadingDevices(false);
  }
};

// 🔥 CAMBIO DE CÁMARA - APLICACIÓN INMEDIATA COMO MODELO
const handleCameraChange = async (deviceId) => {
  console.log('📹 [DEVICES-CLIENTE] Cambio de cámara solicitado:', deviceId);
  
  // 🔥 PREVENIR CAMBIOS AL MISMO DISPOSITIVO
  if (deviceId === lastCameraDeviceId.current) {
    console.log('✅ [DEVICES-CLIENTE] Mismo dispositivo seleccionado, omitiendo cambio');
    return;
  }
  
  // 🔥 PREVENIR MÚLTIPLES CAMBIOS SIMULTÁNEOS
  if (isChangingCamera.current) {
    console.log('⏳ [DEVICES-CLIENTE] Cambio de cámara ya en progreso, omitiendo...');
    return;
  }
  
  setSelectedCameraDevice(deviceId);
  isChangingCamera.current = true;
  lastCameraDeviceId.current = deviceId;
  
  // 🔥 APLICAR INMEDIATAMENTE si la room está conectada (igual que modelo)
  if (room && room.state === 'connected' && room.localParticipant && cameraEnabled) {
    try {
      const localParticipant = room.localParticipant;
      
      // 🔥 MÉTODO 1: Usar switchActiveDevice si está disponible (MÁS RÁPIDO)
      if (localParticipant && typeof localParticipant.switchActiveDevice === 'function') {
        try {
          await localParticipant.switchActiveDevice('videoinput', deviceId);
          console.log('✅ [DEVICES-CLIENTE] Cámara cambiada INMEDIATAMENTE usando switchActiveDevice');
          addNotification('success', t('videochat.device.cameraChanged'), t('videochat.device.deviceUpdated'));
          
          setTimeout(() => {
            applyMirrorToAllVideos(mirrorMode);
          }, 500);
          isChangingCamera.current = false;
          return;
        } catch (error) {
          console.warn('⚠️ [DEVICES-CLIENTE] Error con switchActiveDevice:', error);
        }
      }
      
      // 🔥 MÉTODO 2: Usar room.switchActiveDevice si está disponible
      if (room && typeof room.switchActiveDevice === 'function') {
        try {
          await room.switchActiveDevice('videoinput', deviceId);
          console.log('✅ [DEVICES-CLIENTE] Cámara cambiada usando room.switchActiveDevice');
          addNotification('success', t('videochat.device.cameraChanged'), t('videochat.device.deviceUpdated'));
          
          setTimeout(() => {
            applyMirrorToAllVideos(mirrorMode);
          }, 500);
          isChangingCamera.current = false;
          return;
        } catch (error) {
          console.warn('⚠️ [DEVICES-CLIENTE] Error con room.switchActiveDevice:', error);
        }
      }
      
      // 🔥 MÉTODO 3: Fallback - cambiar dispositivo directamente
      try {
        const constraints = {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
        
        await localParticipant.setCameraEnabled(true, { video: constraints });
        console.log('✅ [DEVICES-CLIENTE] Cámara cambiada usando método directo');
        addNotification('success', t('videochat.device.cameraChanged'), t('videochat.device.deviceUpdated'));
        
        setTimeout(() => {
          applyMirrorToAllVideos(mirrorMode);
        }, 500);
        isChangingCamera.current = false;
      } catch (error) {
        console.warn('⚠️ [DEVICES-CLIENTE] Error con método directo:', error);
        isChangingCamera.current = false;
      }
    } catch (error) {
      console.error('❌ [DEVICES-CLIENTE] Error aplicando cambio de cámara:', error);
      isChangingCamera.current = false;
    }
  } else {
    isChangingCamera.current = false;
  }
};

// 🔥 CAMBIO DE MICRÓFONO - APLICACIÓN INMEDIATA COMO MODELO
const handleMicrophoneChange = async (deviceId) => {
  console.log('🎤 [DEVICES-CLIENTE] Cambio de micrófono solicitado:', deviceId);
  
  // 🔥 PREVENIR CAMBIOS AL MISMO DISPOSITIVO
  if (deviceId === lastMicrophoneDeviceId.current) {
    console.log('✅ [DEVICES-CLIENTE] Mismo dispositivo seleccionado, omitiendo cambio');
    return;
  }
  
  // 🔥 PREVENIR MÚLTIPLES CAMBIOS SIMULTÁNEOS
  if (isChangingMicrophone.current) {
    console.log('⏳ [DEVICES-CLIENTE] Cambio de micrófono ya en progreso, omitiendo...');
    return;
  }
  
  setSelectedMicrophoneDevice(deviceId);
  isChangingMicrophone.current = true;
  lastMicrophoneDeviceId.current = deviceId;
  
  // 🔥 APLICAR INMEDIATAMENTE si la room está conectada (igual que modelo)
  if (room && room.state === 'connected' && room.localParticipant && micEnabled) {
    try {
      const localParticipant = room.localParticipant;
      
      // 🔥 MÉTODO 1: Usar switchActiveDevice si está disponible (MÁS RÁPIDO)
      if (localParticipant && typeof localParticipant.switchActiveDevice === 'function') {
        try {
          await localParticipant.switchActiveDevice('audioinput', deviceId);
          console.log('✅ [DEVICES-CLIENTE] Micrófono cambiado INMEDIATAMENTE usando switchActiveDevice');
          addNotification('success', t('videochat.device.microphoneChanged'), t('videochat.device.deviceUpdated'));
          isChangingMicrophone.current = false;
          return;
        } catch (error) {
          console.warn('⚠️ [DEVICES-CLIENTE] Error con switchActiveDevice (mic):', error);
        }
      }
      
      // 🔥 MÉTODO 2: Usar room.switchActiveDevice si está disponible
      if (room && typeof room.switchActiveDevice === 'function') {
        try {
          await room.switchActiveDevice('audioinput', deviceId);
          console.log('✅ [DEVICES-CLIENTE] Micrófono cambiado usando room.switchActiveDevice');
          addNotification('success', t('videochat.device.microphoneChanged'), t('videochat.device.deviceUpdated'));
          isChangingMicrophone.current = false;
          return;
        } catch (error) {
          console.warn('⚠️ [DEVICES-CLIENTE] Error con room.switchActiveDevice (mic):', error);
        }
      }
      
      // 🔥 MÉTODO 3: Fallback - Desactivar brevemente y reactivar
      await localParticipant.setMicrophoneEnabled(false);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const constraints = {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
      
      await localParticipant.setMicrophoneEnabled(true, { audio: constraints });
      console.log('✅ [DEVICES-CLIENTE] Micrófono cambiado usando método fallback');
      addNotification('success', t('videochat.device.microphoneChanged'), t('videochat.device.deviceUpdated'));
      isChangingMicrophone.current = false;
    } catch (error) {
      console.error('❌ [DEVICES-CLIENTE] Error aplicando cambio de micrófono:', error);
      isChangingMicrophone.current = false;
    }
  } else {
    isChangingMicrophone.current = false;
  }
};

// 3️⃣ AGREGAR useEffect PARA CAMBIO REAL DE CÁMARA - OPTIMIZADO COMO MODELO
useEffect(() => {
  if (!selectedCameraDevice || !room?.localParticipant || !cameraEnabled) {
        return;
  }

  const changeCameraDevice = async () => {
    try {
      const localParticipant = room.localParticipant;
      
      // 🔥 MÉTODO 1: Usar switchActiveDevice si está disponible (MÁS RÁPIDO) - COMO MODELO
      if (localParticipant && typeof localParticipant.switchActiveDevice === 'function') {
        try {
          await localParticipant.switchActiveDevice('videoinput', selectedCameraDevice);
          console.log('✅ [DEVICES-CLIENTE] Cámara cambiada INMEDIATAMENTE usando switchActiveDevice');
          addNotification('success', t('videochat.device.cameraChanged'), t('videochat.device.deviceUpdated'));
          
          // Re-aplicar espejo
          setTimeout(() => {
            applyMirrorToAllVideos(mirrorMode);
          }, 500);
          return;
        } catch (error) {
          console.warn('⚠️ [DEVICES-CLIENTE] Error con switchActiveDevice:', error);
          // Continuar con método fallback
        }
      }
      
      // 🔥 MÉTODO 2: Usar room.switchActiveDevice si está disponible
      if (room && typeof room.switchActiveDevice === 'function') {
        try {
          await room.switchActiveDevice('videoinput', selectedCameraDevice);
          console.log('✅ [DEVICES-CLIENTE] Cámara cambiada usando room.switchActiveDevice');
          addNotification('success', t('videochat.device.cameraChanged'), t('videochat.device.deviceUpdated'));
          
          setTimeout(() => {
            applyMirrorToAllVideos(mirrorMode);
          }, 500);
          return;
        } catch (error) {
          console.warn('⚠️ [DEVICES-CLIENTE] Error con room.switchActiveDevice:', error);
          // Continuar con método fallback
        }
      }
      
      // 🔥 MÉTODO 3: Fallback - cambiar dispositivo directamente sin desactivar
      try {
        const constraints = {
          deviceId: { exact: selectedCameraDevice },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
        
        await localParticipant.setCameraEnabled(true, { video: constraints });
        console.log('✅ [DEVICES-CLIENTE] Cámara cambiada usando método directo');
        addNotification('success', t('videochat.device.cameraChanged'), t('videochat.device.deviceUpdated'));
        
        setTimeout(() => {
          applyMirrorToAllVideos(mirrorMode);
        }, 500);
      } catch (directError) {
        console.warn('⚠️ [DEVICES-CLIENTE] Error con método directo:', directError);
        // Método fallback final: desactivar y reactivar
        try {
          await localParticipant.setCameraEnabled(false);
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Intentar obtener el stream con reintentos
          let stream = null;
          let retries = 3;
          let lastError = null;
          
          while (retries > 0 && !stream) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                  deviceId: { exact: selectedCameraDevice },
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }
              });
              console.log('✅ [DEVICES-CLIENTE] Stream obtenido en método fallback');
              break;
            } catch (mediaError) {
              lastError = mediaError;
              retries--;
              console.warn(`⚠️ [DEVICES-CLIENTE] Error obteniendo stream (intentos restantes: ${retries}):`, mediaError);
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }
          
          if (!stream) {
            throw lastError || new Error('No se pudo obtener el stream de la cámara');
          }
          
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            await localParticipant.publishTrack(videoTrack, {
              name: 'camera',
              source: Track.Source.Camera
            });
            
            addNotification('success', t('videochat.device.cameraChanged'), t('videochat.device.deviceUpdated'));
            
            setTimeout(() => {
              applyMirrorToAllVideos(mirrorMode);
            }, 500);
          } else {
            throw new Error('No se encontró track de video en el stream');
          }
        } catch (fallbackError) {
          console.error('❌ [DEVICES-CLIENTE] Error en método fallback:', fallbackError);
          const errorMessage = fallbackError.name === 'NotAllowedError'
            ? t('videochat.error.cameraPermissionDenied')
            : fallbackError.name === 'NotFoundError'
            ? t('videochat.error.cameraNotFound')
            : `${t('videochat.error.generic')}: ${fallbackError.message}`;
          addNotification('error', t('videochat.error.cameraErrorTitle'), errorMessage);
        }
      }
    } catch (error) {
      console.error('❌ [DEVICES-CLIENTE] Error general:', error);
      addNotification('error', t('videochat.error.title'), `${t('videochat.error.generic')}: ${error.message}`);
    }
  };

  // 🔥 EJECUTAR INMEDIATAMENTE - Sin delay para cambio instantáneo
  changeCameraDevice();

}, [selectedCameraDevice, room, cameraEnabled, mirrorMode]); // ← DEPENDENCIAS

// 4️⃣ AGREGAR useEffect PARA CAMBIO REAL DE MICRÓFONO - OPTIMIZADO COMO MODELO
useEffect(() => {
  if (!selectedMicrophoneDevice || !room?.localParticipant || !micEnabled) {
        return;
  }

  const changeMicrophoneDevice = async () => {
    try {
      const localParticipant = room.localParticipant;
      
      // 🔥 MÉTODO 1: Usar switchActiveDevice si está disponible (MÁS RÁPIDO) - COMO MODELO
      if (localParticipant && typeof localParticipant.switchActiveDevice === 'function') {
        try {
          await localParticipant.switchActiveDevice('audioinput', selectedMicrophoneDevice);
          console.log('✅ [DEVICES-CLIENTE] Micrófono cambiado INMEDIATAMENTE usando switchActiveDevice');
          addNotification('success', t('videochat.device.microphoneChanged'), t('videochat.device.deviceUpdated'));
          return;
        } catch (error) {
          console.warn('⚠️ [DEVICES-CLIENTE] Error con switchActiveDevice (mic):', error);
          // Continuar con método fallback
        }
      }
      
      // 🔥 MÉTODO 2: Usar room.switchActiveDevice si está disponible
      if (room && typeof room.switchActiveDevice === 'function') {
        try {
          await room.switchActiveDevice('audioinput', selectedMicrophoneDevice);
          console.log('✅ [DEVICES-CLIENTE] Micrófono cambiado usando room.switchActiveDevice');
          addNotification('success', t('videochat.device.microphoneChanged'), t('videochat.device.deviceUpdated'));
          return;
        } catch (error) {
          console.warn('⚠️ [DEVICES-CLIENTE] Error con room.switchActiveDevice (mic):', error);
          // Continuar con método fallback
        }
      }
      
      // 🔥 MÉTODO 3: Fallback - Desactivar brevemente y reactivar con nuevo dispositivo
      await localParticipant.setMicrophoneEnabled(false);
      await new Promise(resolve => setTimeout(resolve, 100)); // Delay mínimo
      
      const constraints = {
        deviceId: { exact: selectedMicrophoneDevice },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
      
      await localParticipant.setMicrophoneEnabled(true, { audio: constraints });
      console.log('✅ [DEVICES-CLIENTE] Micrófono cambiado usando método fallback');
      addNotification('success', t('videochat.device.microphoneChanged'), t('videochat.device.deviceUpdated'));
    } catch (error) {
      console.error('❌ [DEVICES-CLIENTE] Error cambiando micrófono:', error);
      addNotification('error', t('videochat.error.title'), `${t('videochat.error.generic')}: ${error.message}`);
    }
  };

  // 🔥 EJECUTAR INMEDIATAMENTE - Sin delay para cambio instantáneo
  changeMicrophoneDevice();

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
      // 🔥 SOLO ACTUALIZAR SI ES UNA ROOM DIFERENTE
      const newRoom = event.detail.room;
      if (!room || room.sid !== newRoom.sid) {
        setRoom(newRoom);
      }
    }
  };
  
  // Escuchar evento personalizado
  window.addEventListener('livekitRoomReady', handleRoomReady);
  
  // También verificar si ya existe globalmente (solo una vez)
  if (window.livekitRoom && !room && window.livekitRoom.state === 'connected') {
    setRoom(window.livekitRoom);
  }
  
  return () => {
    window.removeEventListener('livekitRoomReady', handleRoomReady);
  };
}, []); // 🔥 SIN DEPENDENCIAS PARA EVITAR RE-EJECUCIONES

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
    // 🔥 FUNCIÓN PARA ENVIAR REGALO DIRECTAMENTE (CLIENTE)
  // 🔥 REEMPLAZA TODA la función handleSendGift en VideoChatClient.jsx


// 🔥 FUNCIÓN PARA MODELOS: PEDIR REGALO
const handleRequestGift = async (giftId, recipientId, roomName, message) => {
  try {
    console.log('🎁 [VIDEOCHATCLIENT] handleRequestGift llamado:', {
      giftId,
      recipientId,
      roomName,
      message,
      userDataRole: userData?.role,
      otherUserId: otherUser?.id,
      currentRoomName: roomName
    });

    if (!requestGift) {
      addNotification('error', 'Error', 'Función de solicitar regalo no disponible');
      return { success: false, error: 'Función de solicitar regalo no disponible' };
    }

    const selectedGift = availableGifts.find(g => g.id === giftId) || gifts.find(g => g.id === giftId);
    if (!selectedGift) {
      addNotification('error', 'Error', 'Regalo no encontrado');
      return { success: false, error: 'Regalo no encontrado' };
    }

    // 🔥 VERIFICAR QUE EL USUARIO SEA MODELO
    if (userData?.role !== 'modelo') {
      console.error('❌ [VIDEOCHATCLIENT] Usuario no es modelo:', userData?.role);
      addNotification('error', 'Error', 'Solo los modelos pueden solicitar regalos');
      return { success: false, error: 'Solo los modelos pueden solicitar regalos' };
    }

    // 🔥 VERIFICAR QUE TENEMOS roomName Y otherUser
    if (!roomName) {
      console.error('❌ [VIDEOCHATCLIENT] roomName no válido:', roomName);
      addNotification('error', 'Error', 'Sala de videochat no válida');
      return { success: false, error: 'Sala de videochat no válida' };
    }

    if (!otherUser?.id) {
      console.error('❌ [VIDEOCHATCLIENT] otherUser no válido:', otherUser);
      addNotification('error', 'Error', 'Cliente no encontrado');
      return { success: false, error: 'Cliente no encontrado' };
    }

    const result = await requestGift(giftId, message);

    if (result.success) {
      setShowGiftsModal(false);

      // 🔥 AGREGAR MENSAJE AL CHAT
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

      // 🔥 REPRODUCIR SONIDO DE SOLICITUD DE REGALO
      try {
        await playGiftSound('request');
      } catch (error) {
        console.warn('Error reproduciendo sonido de solicitud:', error);
      }

      addNotification('success', '🎁 Solicitud Enviada', `Has solicitado ${selectedGift.name} a ${otherUser?.name || 'el cliente'}`);
      
      return { success: true };
    } else {
      addNotification('error', 'Error', result.error || 'Error al solicitar regalo');
      return { success: false, error: result.error };
    }
  } catch (error) {
    addNotification('error', 'Error', 'Error de conexión al solicitar regalo');
    return { success: false, error: error.message };
  }
};

// 🔥 FUNCIÓN PARA CLIENTES: ENVIAR REGALO
const handleSendGift = async (giftId, recipientId, roomName, message) => {
  try {

    const authToken = localStorage.getItem('token');
    if (!authToken) {
      throw new Error('No hay token de autenticación');
    }

    // 🔥 USAR EL ENDPOINT CORRECTO PARA VIDEOCHAT
    const response = await fetch(`${API_BASE_URL}/api/gifts/send-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        gift_id: giftId,
        recipient_id: recipientId,
        room_name: roomName,
        message: message || '',
        sender_type: 'cliente'
      })
    });

    const result = await response.json();

    if (result.success) {
      
      // 🔥 OBTENER EL PRECIO DEL REGALO DE MÚLTIPLES FUENTES
      const selectedGift = availableGifts.find(g => g.id === giftId) || gifts.find(g => g.id === giftId);
      const actualCost = result.gift?.price || 
                        result.gift?.amount ||
                        result.transaction?.amount ||
                        result.amount ||
                        selectedGift?.price ||
                        selectedGift?.amount ||
                        0;
            
      // 🔥 RECARGAR BALANCE DESDE EL BACKEND (igual que cuando se acepta desde la carta)
      // NO descontar localmente - dejar que el backend sea la fuente de verdad
      if (loadUserBalanceRef.current && typeof loadUserBalanceRef.current === 'function') {
        loadUserBalanceRef.current().then((balanceResult) => {
          console.log('✅ [SEND GIFT] Balance recargado desde backend:', balanceResult);
        }).catch((error) => {
          console.warn('⚠️ [SEND GIFT] Error recargando balance:', error);
          if (typeof loadGiftBalance === 'function') {
            setTimeout(() => {
              loadGiftBalance();
            }, 500);
          }
        });
      } else if (typeof loadGiftBalance === 'function') {
        setTimeout(() => {
          loadGiftBalance();
        }, 500);
      }
      
      // 🔥 AGREGAR MENSAJE AL CHAT
      const giftMessage = {
        id: Date.now(),
        type: 'gift_sent',
        text: `🎁 ${t('videochat.gift.youSent')}: ${result.gift_name || selectedGift?.name || 'Regalo'}`,
        timestamp: Date.now(),
        isOld: false,
        sender: userData.name,
        senderRole: userData.role,
        gift_data: {
          gift_name: result.gift_name || selectedGift?.name || 'Regalo',
          gift_image: result.gift_image || selectedGift?.image || selectedGift?.image_url || selectedGift?.image_path || null,
          gift_price: actualCost,
          action_text: t('videochat.gift.youSent'),
          recipient_name: otherUser?.name || t('videochat.model')
        },
        extra_data: {
          gift_name: result.gift_name || selectedGift?.name || 'Regalo',
          gift_image: result.gift_image || selectedGift?.image || selectedGift?.image_url || selectedGift?.image_path || null,
          gift_price: actualCost,
          action_text: t('videochat.gift.youSent'),
          recipient_name: otherUser?.name || t('videochat.model')
        }
      };
      
      setMessages(prev => [giftMessage, ...prev]);
      
      // 🔥 REPRODUCIR SONIDO DE REGALO ENVIADO
      try {
        await playGiftSound('sent');
      } catch (error) {
        console.warn('Error reproduciendo sonido de regalo enviado:', error);
      }
      
      // 🔥 NO CERRAR EL MODAL AQUÍ - dejar que el modal lo haga después de recibir la respuesta
      // El modal manejará el cierre y el reseteo del loading
      // setShowGiftsModal(false); // 🔥 COMENTADO: El modal debe cerrarse desde giftModal.jsx
      
      // 🔥 NOTIFICACIÓN
      addNotification(
        'success', 
        t('videochat.gift.giftSentTitle'), 
        t('videochat.gift.giftSentTo', { giftName: result.gift_name, userName: otherUser?.name || t('videochat.model') })
      );
      
      // 🔥 RETORNAR INMEDIATAMENTE para que el modal pueda procesar la respuesta y cerrarse
      return { success: true };
      
    } else {
      // 🔥 MEJORAR MENSAJE DE ERROR SEGÚN EL TIPO
      let errorTitle = t('videochat.error.title');
      let errorMessage = result.error || result.message || t('videochat.error.sendGiftError');
      
      // Si el error viene del backend con un mensaje específico, usarlo
      if (result.message && result.message.includes('Error interno')) {
        errorMessage = result.message;
      } else if (result.error === 'processing_failed' || result.error === 'internal_error') {
        errorMessage = result.message || 'Error al procesar el regalo. Por favor, intenta nuevamente.';
      } else if (result.error === 'insufficient_balance') {
        errorTitle = t('videochat.balance.insufficientGiftCoins');
        errorMessage = result.message || t('videochat.balance.notEnoughGiftCoins');
      }
      
      addNotification('error', errorTitle, errorMessage);
      return { success: false, error: errorMessage };
    }
    
  } catch (error) {
      // 🔥 MEJORAR MANEJO DE ERRORES DE RED
      let errorMessage = t('videochat.error.couldNotSendGift');
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification('error', t('videochat.error.connectionErrorTitle'), errorMessage);
      // 🔥 SIEMPRE retornar un objeto, incluso en caso de error
      return { success: false, error: errorMessage };
  }
  
  // 🔥 FALLBACK: Si por alguna razón no se retornó nada, retornar error
  return { success: false, error: 'Error desconocido al enviar regalo' };
};
  // 🔥 FUNCIÓN DE RATE LIMITING
  const handleRateLimit = useCallback((error, context = 'general') => {
    if (error?.response?.status === 429) {
      
      navigate('/rate-limit-wait', {
        state: {
          message: `Servidor ocupado en videochat cliente, reintentando...`,
          waitTime: 12000,
          fallbackRoute: "/homecliente",
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
  const handleRoomDisconnected = useCallback((reason) => {
    setConnected(false);
  }, [room, connected]);

  // ========== FUNCIONES DE CONEXIÓN ==========
  const handleRoomConnected = useCallback(async () => {
    // 🔥 ELIMINADA VERIFICACIÓN DE PERMISOS - Redirección automática sin demoras
    setConnected(true);
    addNotification('success', hardcodedTexts.connected, hardcodedTexts.connectionEstablished);

    // 🔥 REGLA DE MODELO: Asegurar que la cámara esté encendida cuando se conecta
    if (userData?.role === 'modelo' && !cameraEnabled) {
      setCameraEnabled(true);
    }

    // 🔥 DELAY ANTES DE DETENER BÚSQUEDA PARA PERMITIR PUBLICACIÓN DE TRACKS
    setTimeout(() => {
      forceStopSearching();
    }, 2000);

  }, [addNotification, forceStopSearching, cameraEnabled, micEnabled, userData?.role]);

  // 🔥 MANEJO DE TECLAS
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      enviarMensaje();
    }
  };

  // 🔥 EFECTOS DE INICIALIZACIÓN

  // Efecto para cargar usuario
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getUser(false);
        const name = user.alias || user.name || user.username || "";
        const role = user.rol || user.role || "cliente";
        
        setUserData({ name, role, id: user.id });
        
        // 🔥 REGLA DE MODELO: La cámara SIEMPRE debe estar encendida para modelos
        if (role === 'modelo') {
          setCameraEnabled(true);
        }
        
        // 🔥 COMENTADO: Ya se carga automáticamente en el useEffect de balance
        // updateBalance();
      } catch (err) {
                
        const wasRateLimited = handleRateLimit(err, 'getUser');
        if (wasRateLimited) {
          return;
        }
        
        addNotification('error', t('videochat.error.title'), t('videochat.error.couldNotLoadUserInfo'));
      }
    };
    
    fetchUser();
  }, [addNotification, handleRateLimit]);
  // 🔥 REF PARA EVITAR MÚLTIPLAS LLAMADAS A loadAvailableGifts
  const loadAvailableGiftsCallRef = useRef(false);
  const lastLoadAvailableGiftsTimeRef = useRef(0);

  useEffect(() => {
    // 🔥 PROTECCIÓN CONTRA MÚLTIPLAS EJECUCIONES
    if (loadAvailableGiftsCallRef.current) {
      return;
    }
    
    // 🔥 MÍNIMO 60 SEGUNDOS ENTRE LLAMADAS
    const now = Date.now();
    if (now - lastLoadAvailableGiftsTimeRef.current < 60000) {
      return;
    }

    const loadAvailableGifts = async () => {
      if (!userData?.id) return;
      
      loadAvailableGiftsCallRef.current = true;
      lastLoadAvailableGiftsTimeRef.current = now;
      
      try {
        const authToken = localStorage.getItem('token');
        if (!authToken) {
          loadAvailableGiftsCallRef.current = false;
          return;
        }

        const response = await Promise.race([
          fetch(`${API_BASE_URL}/api/gifts/available`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setAvailableGifts(data.gifts);
          }
        }
      } catch (error) {
        // Silenciar errores
      } finally {
        setTimeout(() => {
          loadAvailableGiftsCallRef.current = false;
        }, 60000); // 🔥 Mínimo 60 segundos entre llamadas
      }
    };
    
    loadAvailableGifts();
  }, [userData?.id]); // 🔥 Solo dependencia crítica

  // 🔥 CARGAR APODOS/NICKNAMES
  useEffect(() => {
    const loadNicknames = async () => {
      try {
        const authToken = localStorage.getItem('token');
        if (!authToken) return;

        const response = await fetch(`${API_BASE_URL}/api/nicknames/my-nicknames`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.nicknames) {
            const apodosMap = {};
            data.nicknames.forEach(item => {
              apodosMap[item.target_user_id] = item.nickname;
            });
            setApodos(apodosMap);
          }
        } else if (response.status === 500) {
          // Si hay error 500, no reintentar inmediatamente
          // Se reintentará cuando cambie userData.id
          return;
        }
      } catch (error) {
        // Silenciar errores de red
      }
    };

    if (userData.id) {
      loadNicknames();
    }
  }, [userData.id]);

  // Efecto para obtener token
  // 🔥 NORMALIZAR roomName: trim y asegurar que sea exactamente el mismo
  const memoizedRoomName = useMemo(() => {
      const room = getParam("roomName");
      if (!room || room === 'null' || room === 'undefined') {
      return null;
    }
    // Normalizar: trim y eliminar espacios extra
    const normalized = room.trim().replace(/\s+/g, '');
    return normalized;
  }, [location.state, searchParams]);

  const memoizedUserName = useMemo(() => {
    const user = getParam("userName");

    const result = user && user !== 'null' && user !== 'undefined' ? user : null;
    if (!result) {
    }
    return result;
  }, [location.state, searchParams]);

  // 🔥 LÓGICA MEJORADA: Conectar y suscribirse automáticamente con mejor manejo de errores
  const handleRoomReady = useCallback(async (roomInstance) => {
    if (!roomInstance || roomReadyCalled.current) {
      return;
    }

    roomReadyCalled.current = true;

    // 🔥 VERIFICAR QUE EL roomName COINCIDA EXACTAMENTE
    const livekitRoomName = roomInstance.name;
    const expectedRoomName = memoizedRoomName;
    const roomNamesMatch = livekitRoomName === expectedRoomName;

    console.log('🔍 [VideoChat] Verificación de nombres de sala:', {
      livekitRoomName: livekitRoomName,
      expectedRoomName: expectedRoomName,
      match: roomNamesMatch ? '✅ COINCIDE' : '❌ NO COINCIDE',
      livekitLength: livekitRoomName?.length,
      expectedLength: expectedRoomName?.length
    });

    if (!roomNamesMatch) {
      console.warn('⚠️ [VideoChat] Nombres de sala no coinciden:', {
        livekit: livekitRoomName,
        expected: expectedRoomName
      });
      return;
    }

    setRoom(roomInstance);
    window.livekitRoom = roomInstance;

    if (roomInstance.state === 'connected') {
      console.log('✅ [CLIENTE] Room conectada, estableciendo connected=true');
      setConnected(true);
      
      // 🔥 VERIFICACIÓN ADICIONAL: Asegurar que connected se mantenga en true
      const verifyConnectionState = () => {
        if (roomInstance.state === 'connected' && !connected) {
          console.log('⚠️ [CLIENTE] Room conectada pero connected=false, corrigiendo...');
          setConnected(true);
        }
      };
      
      // Verificar inmediatamente y después de un delay
      verifyConnectionState();
      setTimeout(verifyConnectionState, 1000);

      try {
        // 🔥 REDUCIR DELAY Y HABILITAR CÁMARA AUTOMÁTICAMENTE
        await new Promise(resolve => setTimeout(resolve, 1000)); // 🔥 REDUCIDO DE 3s A 1s
        
        // 🔥 FUNCIÓN MEJORADA PARA ACTIVAR CÁMARA CON REINTENTOS
        const activateCameraWithRetry = async (maxRetries = 3, retryDelay = 1000) => {
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              // Primero verificar que getUserMedia funcione
              try {
                const testStream = await navigator.mediaDevices.getUserMedia({
                  video: { 
                    deviceId: selectedCameraDevice ? { exact: selectedCameraDevice } : true,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                  },
                  audio: false
                });
                testStream.getTracks().forEach(track => track.stop());
                console.log(`✅ [CLIENTE] getUserMedia funcionando (intento ${attempt + 1})`);
              } catch (mediaError) {
                console.error(`❌ [CLIENTE] Error en getUserMedia (intento ${attempt + 1}):`, mediaError);
                if (attempt < maxRetries - 1) {
                  await new Promise(resolve => setTimeout(resolve, retryDelay));
                  continue;
                } else {
                  throw new Error(`No se pudo acceder a la cámara: ${mediaError.message}`);
                }
              }

              // Ahora activar en LiveKit
              if (roomInstance.localParticipant) {
                console.log(`📹 [CLIENTE] Activando cámara en LiveKit (intento ${attempt + 1}/${maxRetries})...`);
                await roomInstance.localParticipant.setCameraEnabled(true);
                console.log('✅ [CLIENTE] Cámara activada en LiveKit');
                
                // Esperar un poco para que el track se publique
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Verificar que el track se haya publicado
                const cameraPublication = Array.from(roomInstance.localParticipant.videoTrackPublications.values())
                  .find(pub => pub.source === Track.Source.Camera);
                
                if (cameraPublication && cameraPublication.isEnabled && cameraPublication.track) {
                  console.log('✅ [CLIENTE] Track de cámara publicado correctamente:', {
                    trackSid: cameraPublication.trackSid,
                    isEnabled: cameraPublication.isEnabled,
                    hasTrack: !!cameraPublication.track,
                    trackState: cameraPublication.track?.readyState
                  });
                  return true; // Éxito
                } else {
                  console.warn(`⚠️ [CLIENTE] Track de cámara no publicado correctamente (intento ${attempt + 1}):`, {
                    hasPublication: !!cameraPublication,
                    isEnabled: cameraPublication?.isEnabled,
                    hasTrack: !!cameraPublication?.track
                  });
                  
                  if (attempt < maxRetries - 1) {
                    // Desactivar y reactivar
                    try {
                      await roomInstance.localParticipant.setCameraEnabled(false);
                      await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (e) {
                      console.warn('⚠️ [CLIENTE] Error al desactivar cámara para retry:', e);
                    }
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                  } else {
                    throw new Error('Track de cámara no se publicó después de múltiples intentos');
                  }
                }
              } else {
                throw new Error('localParticipant no disponible');
              }
            } catch (error) {
              console.error(`❌ [CLIENTE] Error activando cámara (intento ${attempt + 1}/${maxRetries}):`, error);
              if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              } else {
                throw error;
              }
            }
          }
          return false;
        };

        // 🔥 HABILITAR CÁMARA Y MICRÓFONO AUTOMÁTICAMENTE cuando se conecta
        // PRIMERO activar directamente en LiveKit ANTES de actualizar estado React
        if (roomInstance.localParticipant) {
          try {
            const cameraActivated = await activateCameraWithRetry(3, 1500);
            
            if (!cameraActivated) {
              console.error('❌ [CLIENTE] No se pudo activar la cámara después de múltiples intentos');
              addNotification('error', t('videochat.error.cameraErrorTitle'), t('videochat.error.couldNotConnectCamera'));
            }
            
            // Ahora activar micrófono solo si está habilitado
            // 🔥 RESPETAR EL ESTADO ACTUAL DEL MICRÓFONO - USAR REF PARA OBTENER VALOR ACTUAL
            const currentMicEnabled = micEnabledRef.current;
            if (currentMicEnabled === true) {
              try {
                await roomInstance.localParticipant.setMicrophoneEnabled(true);
                console.log('✅ [CLIENTE] Micrófono activado en LiveKit');
                // 🔥 NO FORZAR setMicEnabled(true) - YA ESTÁ EN TRUE SI LLEGAMOS AQUÍ
              } catch (micError) {
                console.error('❌ [CLIENTE] Error activando micrófono:', micError);
              }
            } else {
              await roomInstance.localParticipant.setMicrophoneEnabled(false);
              console.log('🔇 [CLIENTE] Micrófono desactivado - respetando decisión del usuario');
            }
            
            // LUEGO actualizar estado React después de activar en LiveKit
            setCameraEnabled(true);
            
          } catch (error) {
            console.error('❌ [CLIENTE] Error activando cámara/micrófono:', error);
            // Fallback: actualizar estado React respetando el estado del micrófono
            setCameraEnabled(true);
            // 🔥 NO FORZAR MICRÓFONO - RESPETAR DECISIÓN DEL USUARIO
            // El micrófono mantendrá su estado actual (no se fuerza a true)
            // Reintentar después de un delay más largo
            setTimeout(async () => {
              try {
                if (roomInstance.localParticipant && roomInstance.state === 'connected') {
                  await activateCameraWithRetry(2, 2000);
                  // Respetar el estado del micrófono usando ref
                  const currentMicEnabledRetry = micEnabledRef.current;
                  if (currentMicEnabledRetry !== false) {
                    await roomInstance.localParticipant.setMicrophoneEnabled(true);
                  } else {
                    await roomInstance.localParticipant.setMicrophoneEnabled(false);
                  }
                }
              } catch (retryError) {
                console.error('❌ [CLIENTE] Error en retry de cámara/micrófono:', retryError);
              }
            }, 3000);
          }
        } else {
          // Si no hay localParticipant aún, solo actualizar estado React respetando el estado del micrófono
          setCameraEnabled(true);
          // 🔥 NO FORZAR MICRÓFONO - RESPETAR DECISIÓN DEL USUARIO
          // El micrófono mantendrá su estado actual
        }
        
        // 🔥 ESPERAR PARA QUE LOS TRACKS SE PUBLIQUEN antes de continuar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 🔥 VERIFICACIÓN PERIÓDICA: Asegurar que la cámara esté activa y reconectar si se pierde
        const cameraHealthCheckInterval = setInterval(() => {
          if (!roomInstance || roomInstance.state !== 'connected' || !roomInstance.localParticipant) {
            clearInterval(cameraHealthCheckInterval);
            return;
          }

          const cameraPublication = Array.from(roomInstance.localParticipant.videoTrackPublications.values())
            .find(pub => pub.source === Track.Source.Camera);
          
          const shouldBeEnabled = cameraEnabled;
          
          if (shouldBeEnabled) {
            // Verificar si el track está activo y funcionando
            const isTrackActive = cameraPublication && 
                                 cameraPublication.isEnabled && 
                                 cameraPublication.track && 
                                 cameraPublication.track.readyState === 'live';
            
            if (!isTrackActive) {
              console.warn('⚠️ [CLIENTE] Cámara perdida, reconectando...', {
                hasPublication: !!cameraPublication,
                isEnabled: cameraPublication?.isEnabled,
                hasTrack: !!cameraPublication?.track,
                trackState: cameraPublication?.track?.readyState
              });
              
              // Intentar reactivar
              roomInstance.localParticipant.setCameraEnabled(true).catch(err => {
                console.error('❌ [CLIENTE] Error en verificación periódica de cámara:', err);
              });
            }
          }
        }, 5000); // Verificar cada 5 segundos

        // Limpiar intervalo cuando se desconecte
        roomInstance.on('disconnected', () => {
          clearInterval(cameraHealthCheckInterval);
        });
        
        // 🔥 VERIFICACIÓN FINAL: Asegurar que la cámara esté activa
        setTimeout(() => {
          if (roomInstance.localParticipant && roomInstance.state === 'connected') {
            const finalCheck = Array.from(roomInstance.localParticipant.videoTrackPublications.values())
              .find(pub => pub.source === Track.Source.Camera && pub.isEnabled);
            
            if (!finalCheck || !finalCheck.track || finalCheck.track.readyState !== 'live') {
              console.warn('⚠️ [CLIENTE] Cámara no activa después de verificación final, reactivando...');
              roomInstance.localParticipant.setCameraEnabled(true).catch(err => {
                console.error('❌ [CLIENTE] Error en verificación final de cámara:', err);
              });
            } else {
              console.log('✅ [CLIENTE] Cámara verificada y activa');
            }
          }
        }, 2000);

        setLoading(false); // 🔥 Asegurar que loading se ponga en false cuando se conecta
        setConnected(true); // 🔥 Marcar como conectado
        
        // 🔥 CANCELAR TIMEOUT DE CONEXIÓN SI SE CONECTÓ EXITOSAMENTE
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
          console.log('✅ [VideoChat] Conexión establecida - timeout cancelado');
        }

        // 🔥 SUSCRIBIRSE AUTOMÁTICAMENTE A TODOS LOS PARTICIPANTES REMOTOS
        const subscribeToParticipant = (participant) => {
          if (!participant) {
            return;
          }


          // 🔥 VERIFICACIONES MÚLTIPLES ANTES DE SUSCRIBIRSE
            if (!participant.setSubscribed || typeof participant.setSubscribed !== 'function') {
              console.warn('⚠️ [VideoChat] Participant sin setSubscribed:', {
                identity: participant.identity,
                hasMethod: !!participant.setSubscribed,
                type: typeof participant.setSubscribed
              });
            return;
          }

          // Verificar que el participante esté conectado
          if (participant.connectionState !== 'connected') {
            return;
          }

          // Verificar que tenga trackPublications
          if (!participant.trackPublications || participant.trackPublications.size === 0) {
            return;
          }

          participant.trackPublications.forEach((publication) => {
            if (!publication) return;
            
            // 🔥 VERIFICAR QUE TENGA trackSid Y NO ESTÉ YA SUSCRITO
            if (publication.trackSid && !publication.isSubscribed) {
              try {
                participant.setSubscribed(publication.trackSid, true).catch((err) => {
                });
              } catch (error) {
              }
            }
          });
        };

        // Suscribirse a participantes existentes
        if (roomInstance.remoteParticipants.size > 0) {
          roomInstance.remoteParticipants.forEach(subscribeToParticipant);
        }

        // 🔥 LISTENER PARA CUANDO LA MODELO PUBLICA SU PROPIO TRACK DE CÁMARA
        // Esto asegura que el cliente se suscriba automáticamente cuando la modelo publica su cámara
        if (roomInstance.localParticipant) {
          roomInstance.localParticipant.on('trackPublished', (publication) => {
            if (publication.source === Track.Source.Camera) {
              console.log('📹 [CLIENTE] Track de cámara LOCAL publicado:', {
                trackSid: publication.trackSid,
                isEnabled: publication.isEnabled,
                hasTrack: !!publication.track
              });
              
              // Verificar que los participantes remotos puedan suscribirse
              if (publication.trackSid && roomInstance.remoteParticipants.size > 0) {
                console.log('👥 [CLIENTE] Notificando a participantes remotos sobre track local publicado');
              }
            }
          });
        }

        // Listener para nuevos participantes
        const handleParticipantConnected = (participant) => {
          subscribeToParticipant(participant);

          // 🔥 Suscribirse a tracks nuevos - SUSCRIPCIÓN AGRESIVA MEJORADA
          participant.on('trackPublished', (publication) => {
            if (!publication || !participant) {
              return;
            }

            console.log('🔍 [VideoChat-CLIENTE] Track publicado:', {
              kind: publication.kind,
              source: publication.source,
              trackSid: publication.trackSid,
              isSubscribed: publication.isSubscribed,
              isEnabled: publication.isEnabled,
              participantIdentity: participant.identity
            });
            
            // 🔥 SUSCRIPCIÓN AGRESIVA PARA TRACKS DE CÁMARA DE LA MODELO
            if (publication.source === Track.Source.Camera && publication.kind === 'video') {
              const subscribeToCameraTrack = async (attempt = 0) => {
                const maxAttempts = 5;
                
                // Obtener publicación actualizada
                const getCurrentPublication = () => {
                  if (!participant.videoTrackPublications) return publication;
                  for (const [sid, pub] of participant.videoTrackPublications.entries()) {
                    if (pub.source === Track.Source.Camera && 
                        (pub.trackSid === publication.trackSid || sid === publication.trackSid)) {
                      return pub;
                    }
                  }
                  return publication;
                };
                
                const currentPub = getCurrentPublication();
                const trackSid = currentPub.trackSid;
                
                if (!trackSid) {
                  // Esperar hasta que tenga trackSid
                  if (attempt < maxAttempts) {
                    setTimeout(() => subscribeToCameraTrack(attempt + 1), 500);
                  }
                  return;
                }
                
                // Si ya está suscrito, no hacer nada
                if (currentPub.isSubscribed) {
                  console.log('✅ [VideoChat-CLIENTE] Track de cámara ya está suscrito:', trackSid);
                  return;
                }
                
                console.log(`📹 [VideoChat-CLIENTE] Suscribiéndose al track de cámara (intento ${attempt + 1}/${maxAttempts}):`, trackSid);
                
                let subscribed = false;
                
                // Método 1: participant.setSubscribed
                if (participant.setSubscribed && typeof participant.setSubscribed === 'function') {
                  try {
                    const result = participant.setSubscribed(trackSid, true);
                    if (result && typeof result.then === 'function') {
                      await result;
                    }
                    await new Promise(resolve => setTimeout(resolve, 800));
                    const updatedPub = getCurrentPublication();
                    if (updatedPub && updatedPub.isSubscribed) {
                      console.log('✅ [VideoChat-CLIENTE] Suscrito usando participant.setSubscribed:', trackSid);
                      subscribed = true;
                    }
                  } catch (err) {
                    console.warn('⚠️ [VideoChat-CLIENTE] Error con participant.setSubscribed:', err);
                  }
                }
                
                // Método 2: room.setSubscribed
                if (!subscribed && roomInstance && typeof roomInstance.setSubscribed === 'function') {
                  try {
                    const result = roomInstance.setSubscribed(trackSid, true);
                    if (result && typeof result.then === 'function') {
                      await result;
                    }
                    await new Promise(resolve => setTimeout(resolve, 800));
                    const updatedPub = getCurrentPublication();
                    if (updatedPub && updatedPub.isSubscribed) {
                      console.log('✅ [VideoChat-CLIENTE] Suscrito usando room.setSubscribed:', trackSid);
                      subscribed = true;
                    }
                  } catch (err) {
                    console.warn('⚠️ [VideoChat-CLIENTE] Error con room.setSubscribed:', err);
                  }
                }
                
                // Método 3: publication.setSubscribed
                if (!subscribed && currentPub.setSubscribed && typeof currentPub.setSubscribed === 'function') {
                  try {
                    const result = currentPub.setSubscribed(true);
                    if (result && typeof result.then === 'function') {
                      await result;
                    }
                    await new Promise(resolve => setTimeout(resolve, 800));
                    const updatedPub = getCurrentPublication();
                    if (updatedPub && updatedPub.isSubscribed) {
                      console.log('✅ [VideoChat-CLIENTE] Suscrito usando publication.setSubscribed:', trackSid);
                      subscribed = true;
                    }
                  } catch (err) {
                    console.warn('⚠️ [VideoChat-CLIENTE] Error con publication.setSubscribed:', err);
                  }
                }
                
                // Si no se suscribió y aún hay intentos, reintentar
                if (!subscribed && attempt < maxAttempts - 1) {
                  console.log(`🔄 [VideoChat-CLIENTE] Reintentando suscripción en 1.5 segundos...`);
                  setTimeout(() => subscribeToCameraTrack(attempt + 1), 1500);
                } else if (!subscribed) {
                  console.warn('⚠️ [VideoChat-CLIENTE] No se pudo suscribir después de', maxAttempts, 'intentos');
                }
              };
              
              subscribeToCameraTrack(0);
            } else {
              // Para otros tipos de tracks, usar lógica original
              if (publication.trackSid && !publication.isSubscribed && participant.connectionState === 'connected') {
                try {
                  participant.setSubscribed(publication.trackSid, true).then(() => {
                  }).catch((err) => {
                    setTimeout(() => {
                      if (publication.trackSid && !publication.isSubscribed) {
                        participant.setSubscribed(publication.trackSid, true).catch(() => {});
                      }
                    }, 1000);
                  });
                } catch (error) {
                }
              }
            }
          });
        };

        roomInstance.on('participantConnected', handleParticipantConnected);

        // 🔥 Verificar periódicamente por si se perdió algún evento (MÁS FRECUENTE PARA TRACKS DE CÁMARA)
        const checkInterval = setInterval(() => {
          if (roomInstance.state !== 'connected') {
            clearInterval(checkInterval);
            return;
          }

          roomInstance.remoteParticipants.forEach((participant) => {
            if (!participant || typeof participant.setSubscribed !== 'function') {
              return;
            }

            if (participant.connectionState === 'connected') {
              participant.trackPublications.forEach((publication) => {
                if (!publication) return;
                
                // 🔥 PRIORIDAD ESPECIAL PARA TRACKS DE CÁMARA (más frecuente)
                if (publication.source === Track.Source.Camera && publication.kind === 'video' && publication.trackSid && !publication.isSubscribed && publication.isEnabled !== false) {
                  console.log('🔍 [VideoChat-CLIENTE] Suscribiendo track de cámara de la modelo:', {
                    trackSid: publication.trackSid,
                    participantIdentity: participant.identity,
                    isEnabled: publication.isEnabled,
                    isSubscribed: publication.isSubscribed
                  });
                  
                  // Intentar múltiples métodos de suscripción
                  const subscribeTrack = async () => {
                    try {
                      // Método 1: participant.setSubscribed
                      await participant.setSubscribed(publication.trackSid, true);
                      console.log('✅ [VideoChat-CLIENTE] Track de cámara suscrito exitosamente (método 1)');
                    } catch (error1) {
                      try {
                        // Método 2: room.setSubscribed
                        if (roomInstance && typeof roomInstance.setSubscribed === 'function') {
                          await roomInstance.setSubscribed(publication.trackSid, true);
                          console.log('✅ [VideoChat-CLIENTE] Track de cámara suscrito exitosamente (método 2)');
                        }
                      } catch (error2) {
                        console.warn('⚠️ [VideoChat-CLIENTE] Error suscribiéndose al track de cámara:', error2);
                      }
                    }
                  };
                  
                  subscribeTrack();
                } else if (publication.trackSid && !publication.isSubscribed) {
                  try {
                    participant.setSubscribed(publication.trackSid, true).catch(() => {});
                  } catch (error) {
                    // Silenciar errores en el check periódico
                  }
                }
              });
            }
          });
        }, 500); // 🔥 REDUCIDO A 500ms para detección más rápida de tracks de cámara

        // Limpiar intervalo cuando se desconecte
        roomInstance.on('disconnected', () => {
          clearInterval(checkInterval);
        });

        forceStopSearching();

      } catch (error) {
      }
    }
  }, [memoizedRoomName, forceStopSearching]);

// 🚨 DIAGNÓSTICO: ¿POR QUÉ SE QUITAN 500 COINS EN 3 MINUTOS?

// ❌ PROBLEMA #1: MÚLTIPLES useEffect EJECUTÁNDOSE
// Tu useEffect tiene estas dependencias:
// [connected, room, roomName, setUserBalance, setRemainingMinutes, addNotification, finalizarChat]
// 
// Cada vez que cualquiera cambia, se crea un nuevo sistema de descuentos
// Esto significa que puedes tener 10+ sistemas corriendo simultáneamente

// ❌ PROBLEMA #2: EL ENDPOINT PUEDE ESTAR LLAMÁNDOSE MÚLTIPLES VECES
// Si tienes 10 sistemas, cada uno hace:
// - 1 descuento inicial de 10 coins = 10 x 10 = 100 coins
// - Descuentos regulares de 5 coins cada 30s = 10 x 5 = 50 coins cada 30s
// En 3 minutos = 180 segundos = 6 intervalos de 30s
// Total: 100 + (50 x 6) = 400 coins + otros descuentos = ~500 coins

// ✅ SOLUCIÓN RADICAL: SISTEMA COMPLETAMENTE AISLADO

// 1️⃣ PRIMERO: AGREGAR LOGS DETALLADOS PARA VER QUÉ PASA
const DEBUG_DEDUCTION = true; // Cambiar a false en producción

const logDeduction = (message, data = {}) => {
  if (DEBUG_DEDUCTION) {

  }
};

// 2️⃣ REEMPLAZAR COMPLETAMENTE TU useEffect CON ESTE:
useEffect(() => {
  // ✅ VALIDACIÓN ESTRICTA INICIAL
  if (!connected || !room || !roomName) {
    logDeduction('❌ Condiciones no cumplidas', { connected, hasRoom: !!room, roomName });
    return;
  }

  // ✅ CLAVE ÚNICA ABSOLUTA POR SALA
  const UNIQUE_KEY = `DEDUCTION_${roomName}_${Date.now()}`;
  const GLOBAL_LOCK = `LOCK_${roomName}`;
  
  // ✅ VERIFICAR SI YA HAY UN LOCK GLOBAL PARA ESTA SALA
  if (window[GLOBAL_LOCK]) {
    logDeduction('🚨 BLOQUEADO - Ya existe sistema para esta sala', { 
      existingLock: window[GLOBAL_LOCK],
      newKey: UNIQUE_KEY 
    });
    return;
  }

  // ✅ ESTABLECER LOCK GLOBAL
  window[GLOBAL_LOCK] = UNIQUE_KEY;
  logDeduction('🔒 LOCK establecido', { lockKey: GLOBAL_LOCK, uniqueKey: UNIQUE_KEY });

  // ✅ VARIABLES DE CONTROL ESTRICTAS
  let isSystemActive = true;
  let lastDeductedMinute = 0; // Minuto último descontado

  // ✅ TIEMPO DE INICIO DE SESIÓN
  const getSessionStart = () => {
    const key = `session_start_${roomName}`;
    let startTime = localStorage.getItem(key);
    
    if (!startTime) {
      startTime = Date.now().toString();
      localStorage.setItem(key, startTime);
      logDeduction('⏰ Nuevo tiempo de sesión creado', { startTime });
    } else {
      logDeduction('⏰ Tiempo de sesión existente', { startTime });
    }
    
    return parseInt(startTime);
  };

  const sessionStartTime = getSessionStart();

  // ✅ FUNCIÓN DE DESCUENTO CON VALIDACIÓN MÚLTIPLE
  const applySecureDeduction = async (amount, reason) => {
    // Verificar que el sistema sigue activo
    if (!isSystemActive) {
      logDeduction('🛑 Sistema inactivo, cancelando descuento', { reason, amount });
      return false;
    }

    // Verificar que el lock sigue siendo nuestro
    if (window[GLOBAL_LOCK] !== UNIQUE_KEY) {
      logDeduction('🚨 LOCK perdido, cancelando descuento', { 
        reason, 
        amount,
        ourKey: UNIQUE_KEY,
        currentLock: window[GLOBAL_LOCK]
      });
      isSystemActive = false;
      return false;
    }

    // Verificar que seguimos en la misma sala
    const currentRoom = localStorage.getItem('roomName');
    if (currentRoom !== roomName) {
      logDeduction('🚪 Sala cambió, cancelando descuento', { 
        reason,
        originalRoom: roomName,
        currentRoom 
      });
      isSystemActive = false;
      return false;
    }

    try {
      logDeduction(`💰 APLICANDO DESCUENTO: ${amount} coins (${amount / 10} minuto(s))`, { reason });
      
      const authToken = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/livekit/periodic-deduction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          room_name: roomName,
          session_duration_seconds: 60,
          manual_coins_amount: parseInt(amount, 10), // 🔥 Asegurar que sea integer
          reason: `${reason}_${UNIQUE_KEY.slice(-8)}` // Agregar ID único
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          logDeduction(`✅ DESCUENTO EXITOSO: ${amount} coins`, { 
            reason,
            remainingBalance: data.remaining_balance,
            remainingMinutes: data.minutes_remaining,
            uniqueId: UNIQUE_KEY.slice(-8)
          });

          // Actualizar UI
          setUserBalance(data.remaining_balance);
          setRemainingMinutes(data.minutes_remaining);

          // Verificar saldo agotado
          if (data.remaining_balance <= 0) {
            logDeduction('💳 SALDO AGOTADO', { reason });
            isSystemActive = false;
            window[GLOBAL_LOCK] = null;
            addNotification('error', t('videochat.balance.balanceExhausted'), t('videochat.balance.sessionEnding'));
            setTimeout(() => finalizarChat(true), 2000);
            return false;
          }

          return true;
        } else {
          // 🔥 Si el backend retorna success: false, loggear pero NO desconectar
          logDeduction(`⚠️ DESCUENTO FALLÓ (success: false): ${data.error || 'Unknown error'}`, { 
            reason,
            error: data.error,
            message: data.message
          });
          // NO desconectar al cliente, solo retornar false para que se reintente
          return false;
        }
      } else {
        // 🔥 Manejar errores HTTP sin desconectar
        let errorData = { error: 'Unknown error' };
        try {
          const responseText = await response.text();
          errorData = responseText ? JSON.parse(responseText) : { error: 'Empty response' };
        } catch (parseError) {
          logDeduction(`⚠️ No se pudo parsear respuesta de error: ${parseError.message}`, { reason });
          errorData = { error: `HTTP ${response.status}` };
        }
        
        logDeduction(`❌ ERROR HTTP EN DESCUENTO: ${response.status} - ${errorData.error || 'Unknown'}`, { 
          reason,
          status: response.status,
          error: errorData.error,
          message: errorData.message
        });
        
        // 🔥 Solo desconectar si es un error 402 (Payment Required / Saldo insuficiente real)
        if (response.status === 402) {
          logDeduction('💳 SALDO REALMENTE INSUFICIENTE (402)', { reason });
          isSystemActive = false;
          window[GLOBAL_LOCK] = null;
          addNotification('error', t('videochat.balance.balanceExhausted'), t('videochat.balance.sessionEnding'));
          setTimeout(() => finalizarChat(true), 2000);
          return false;
        }
        
        // 🔥 Para errores de validación (422) u otros errores, NO desconectar
        // Solo loggear y retornar false para que se pueda reintentar
        if (response.status === 422) {
          logDeduction('⚠️ ERROR DE VALIDACIÓN (422) - No se desconectará al cliente', { 
            reason,
            validationErrors: errorData.errors || errorData.message
          });
        }
        
        // Para otros errores, NO desconectar, solo retornar false
        return false;
      }
    } catch (error) {
      // 🔥 Error de red u otro error - NO desconectar, solo loggear
      logDeduction(`❌ ERROR DE RED EN DESCUENTO: ${error.message}`, { reason, error: error.message });
      // NO desconectar al cliente por errores de red
      return false;
    }
  };

  // ✅ FUNCIÓN PARA OBTENER TIEMPO TRANSCURRIDO
  const getElapsedSeconds = () => {
    return Math.floor((Date.now() - sessionStartTime) / 1000);
  };

  // ✅ FUNCIÓN PARA OBTENER MINUTOS COMPLETOS TRANSCURRIDOS
  const getCompletedMinutes = () => {
    const elapsedSeconds = getElapsedSeconds();
    return Math.floor(elapsedSeconds / 60); // Minutos completos (sin decimales)
  };

  // ✅ EJECUTOR PRINCIPAL - DESCUENTO POR MINUTOS COMPLETOS
  const runDeductionSystem = () => {
    const elapsed = getElapsedSeconds();
    const completedMinutes = getCompletedMinutes();
    
    logDeduction('🚀 INICIANDO SISTEMA DE DESCUENTO POR MINUTOS', { 
      elapsedSeconds: elapsed,
      completedMinutes: completedMinutes,
      lastDeductedMinute: lastDeductedMinute
    });

    // 🔥 NO DESCONTAR AL INICIO - Solo el intervalo se encargará de descontar
    // Esto evita descuentos duplicados entre el descuento inicial y el intervalo
    // El intervalo comenzará a descontar cuando se complete el primer minuto (60 segundos)
    logDeduction('⏸️ Inicio del sistema - Esperando a que se complete el primer minuto para comenzar descuentos', {
      completedMinutes,
      lastDeductedMinute
    });

    // Configurar interval para descontar cada minuto completo
    const interval = setInterval(async () => {
      if (!isSystemActive) {
        logDeduction('🛑 Sistema inactivo, deteniendo interval');
        clearInterval(interval);
        return;
      }

      const currentCompletedMinutes = getCompletedMinutes();
      
      // 🔥 CORRECCIÓN: Solo descontar 1 minuto a la vez, sin importar cuántos minutos hayan pasado
      // Esto evita descuentos dobles si hay algún delay
      if (currentCompletedMinutes > lastDeductedMinute) {
        // 🔥 SIEMPRE descontar solo 1 minuto (10 coins), no acumulado
        const coinsToDeduct = 10; // Siempre 10 coins = 1 minuto
        
        // 🔥 ACTUALIZAR lastDeductedMinute INMEDIATAMENTE antes del descuento para evitar doble descuento
        const previousLastDeductedMinute = lastDeductedMinute;
        const nextMinute = lastDeductedMinute + 1;
        lastDeductedMinute = nextMinute;
        
        logDeduction(`⏰ Minuto ${nextMinute} completado - Descontando 1 minuto (10 coins)`, {
          currentCompletedMinutes,
          previousLastDeductedMinute,
          newLastDeductedMinute: lastDeductedMinute,
          coinsToDeduct
        });
        
        const success = await applySecureDeduction(coinsToDeduct, `minute_${nextMinute}`);
        if (!success) {
          // 🔥 Si falla el descuento, revertir lastDeductedMinute
          lastDeductedMinute = previousLastDeductedMinute;
          logDeduction('⚠️ Descuento falló, revirtiendo lastDeductedMinute', {
            revertedTo: lastDeductedMinute
          });
        }
      }
    }, 5000); // 🔥 Verificar cada 5 segundos para detectar cuando se completa un minuto exactamente

    // Guardar referencia para limpieza
    window[`${UNIQUE_KEY}_interval`] = interval;
    
    logDeduction('✅ Sistema de descuento iniciado - Descontará 1 minuto cada 60 segundos', {
      interval: '60000ms',
      costPerMinute: '10 coins'
    });
  };

  // ✅ EJECUTAR EL SISTEMA
  runDeductionSystem();

  // ✅ FUNCIÓN DE LIMPIEZA COMPLETA
  return () => {
    logDeduction('🧹 LIMPIANDO SISTEMA', { uniqueKey: UNIQUE_KEY });
    
    // Desactivar sistema
    isSystemActive = false;
    
    // Limpiar interval
    const intervalKey = `${UNIQUE_KEY}_interval`;
    if (window[intervalKey]) {
      clearInterval(window[intervalKey]);
      delete window[intervalKey];
      logDeduction('🗑️ Interval limpiado');
    }
    
    // Liberar lock solo si es nuestro
    if (window[GLOBAL_LOCK] === UNIQUE_KEY) {
      window[GLOBAL_LOCK] = null;
      logDeduction('🔓 LOCK liberado');
    }
  };

// ✅ DEPENDENCIAS MÍNIMAS - SOLO LAS ESENCIALES
}, [connected, room, roomName]); // ← QUITAR las funciones de las dependencias

// 3️⃣ EFECTO SEPARADO PARA LIMPIEZA FINAL
useEffect(() => {
  return () => {
    if (roomName) {
      // Limpiar localStorage
      localStorage.removeItem(`session_start_${roomName}`);
      
      // Limpiar todos los locks de esta sala
      Object.keys(window).forEach(key => {
        if (key.includes(`LOCK_${roomName}`) || key.includes(`DEDUCTION_${roomName}`)) {
          window[key] = null;
          delete window[key];
        }
      });
      
      logDeduction('🧹 LIMPIEZA FINAL COMPLETA');
    }
  };
}, []); // Sin dependencias para que solo se ejecute al desmontar

// 4️⃣ MONITOR DE SISTEMAS ACTIVOS (PARA DEBUG)
if (DEBUG_DEDUCTION) {
  useEffect(() => {
    const monitor = setInterval(() => {
      const activeSystems = Object.keys(window).filter(key => 
        key.includes('DEDUCTION_SYSTEM') || key.includes('LOCK_')
      ).length;
      
      if (activeSystems > 0) {
      }
    }, 10000); // Cada 10 segundos

    return () => clearInterval(monitor);
  }, []);
}

// ✅ FLUJO CORRECTO DE DESCUENTO:
// - Descuenta exactamente 1 minuto (10 coins) por cada minuto completo transcurrido
// - Minuto 1 (60s): -10 coins (1 minuto)
// - Minuto 2 (120s): -10 coins (1 minuto)
// - Minuto 3 (180s): -10 coins (1 minuto)
// - etc.

// Total en 3 minutos (180s):
// - 10 + 10 + 10 = 30 coins (3 minutos)

useEffect(() => {

}, [connected, room, roomName, isProcessingLeave, userBalance, remainingMinutes]);


  useEffect(() => {
  let isMounted = true;
  let retryCount = 0;
  const maxRetries = 3;
  
  const getSecureTokenWithRetry = async () => {
    try {
      if (!memoizedRoomName || !memoizedUserName) {
        throw new Error(`Parámetros inválidos - roomName: "${memoizedRoomName}", userName: "${memoizedUserName}"`);
      }

      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('No se encontró token de autenticación');
      }

      // 🔥 USAR ENDPOINT SEGURO PARA CLIENTES
      // NOTA: El backend ahora genera automáticamente una identidad única basada en user_id + role
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
      
      console.log('🔍 [VideoChat] Token request:', {
        room: memoizedRoomName,
        roomLength: memoizedRoomName?.length,
        note: 'Identity será generada por el backend basada en user_id + role'
      });

      // TEMP LOG: registro de respuesta del token (cliente)
      try {
        const _respText = await response.clone().text();
        console.log('🔍 [VideoChat][CLIENT] Token response', { status: response.status, body: _respText ? _respText.slice(0, 1000) : '<empty>' });
      } catch (e) {
        console.log('🔍 [VideoChat][CLIENT] Token response parse error', e);
      }

      if (!response.ok) {
        const errorData = await response.json();
        
        // 🔥 MANEJO ESPECÍFICO DE SALDO INSUFICIENTE
        if (response.status === 402) { // Payment Required
                    
          addNotification('error', t('videochat.balance.insufficientBalance'), 
            t('videochat.balance.insufficientBalanceMessage', { required: errorData.required_coins || 30, current: errorData.current_coins || 0 }));
          
          // Redirigir a compra de monedas
          setTimeout(() => {
            navigate('/buy-coins', {
              state: {
                requiredCoins: errorData.required_coins || 30,
                currentCoins: errorData.current_coins || 0,
                returnTo: '/videochatclient',
                returnState: location.state
              }
            });
          }, 2000);
          
          return;
        }
        
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
      
      // #region agent log
      // #endregion

      console.log('🔍 [VideoChat] Token response:', {
        hasToken: !!data.token,
        serverUrl: data.serverUrl,
        roomName: memoizedRoomName,
        roomNameLength: memoizedRoomName?.length
      });
            
      if (isMounted) {
          setToken(data.token);
          setServerUrl(data.serverUrl);
          setLoading(false);
          addNotification('success', hardcodedTexts.connecting, hardcodedTexts.connectingToRoom);
          
          // 🔥 INICIAR TIMEOUT DE 20 SEGUNDOS PARA CONEXIÓN
          // Si después de 20 segundos no se conecta, redirigir a home
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
          }
          
          connectionTimeoutRef.current = setTimeout(() => {
            // Verificar el estado actual (usar window.livekitRoom para verificar estado real)
            const isStillConnecting = !window.livekitRoom || 
                                     window.livekitRoom.state !== 'connected' ||
                                     !connected;
            
              if (isStillConnecting) {
              console.warn('⏰ [VideoChat] Timeout de conexión (20s) - redirigiendo a home', {
                roomState: window.livekitRoom?.state,
                connected: connected
              });
              
              // Limpiar datos de videochat
              localStorage.removeItem('roomName');
              localStorage.removeItem('userName');
              localStorage.removeItem('currentRoom');
              localStorage.removeItem('inCall');
              localStorage.removeItem('videochatActive');
              
              // Desconectar LiveKit si existe
              if (window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
                window.livekitRoom.disconnect().catch(() => {});
              }
              
              // Redirigir según el rol
              // Si el otro usuario es la modelo, intentar reconectar antes de manejar desconexión
              if (otherUser && otherUser.role === 'modelo') {
                try {
                  attemptReconnectThenHandle('partner_left_session', 'La conexión se perdió');
                } catch (e) {
                  const userRole = userData?.role || '';
                  if (userRole === 'modelo') {
                    navigate('/homellamadas', { replace: true });
                  } else {
                    safeNavigateHome();
                  }
                }
              } else {
                const userRole = userData?.role || '';
                if (userRole === 'modelo') {
                  navigate('/homellamadas', { replace: true });
                } else {
                  safeNavigateHome();
                }
              }
            }
          }, 40000); // 40 segundos (aumentado para reducir falsos positivos)
          
          // #region agent log
          // #endregion
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
    getSecureTokenWithRetry();
  } else {
    setError(`Faltan parámetros de la sala.`);
    setLoading(false);
  }

  return () => {
    isMounted = false;
  };
  }, [memoizedRoomName, memoizedUserName, handleRateLimit, selectedCamera, selectedMic]);

  // ===== Reconexión: intentar obtener token y forzar reconexión antes de marcar desconexión =====
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const tryReconnect = async () => {
    if (reconnectInProgressRef.current) return false;
    reconnectInProgressRef.current = true;
    reconnectAttemptsRef.current = 0;

    const maxAttempts = maxReconnectAttemptsRef.current || 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      reconnectAttemptsRef.current = attempt;
      try {
        console.log(`🔄 [VideoChat] Intento de reconexión ${attempt}/${maxAttempts}`);
        const authToken = localStorage.getItem('token');
        if (!authToken || !memoizedRoomName || !memoizedUserName) {
          console.warn('⚠️ [VideoChat] No hay token o parámetros, no se puede reconectar');
          break;
        }

        const resp = await fetch(`${API_BASE_URL}/api/livekit/token-secure`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ room: memoizedRoomName, preferredCamera: selectedCamera, preferredMic: selectedMic })
        });

        if (!resp.ok) {
          console.warn('⚠️ [VideoChat] Reconnect token request failed', resp.status);
        } else {
          const data = await resp.json();
          if (data && data.token) {
            console.log('✅ [VideoChat] Token reconexión obtenido, actualizando token y serverUrl');
            setToken(data.token);
            setServerUrl(data.serverUrl || serverUrl);

            // esperar un par de segundos a que LiveKit conecte usando el nuevo token
            await delay(3000);
            const roomState = window.livekitRoom?.state || room?.state;
            const remoteCount = window.livekitRoom?.remoteParticipants?.size || room?.remoteParticipants?.size || 0;
            console.log('🔍 [VideoChat] Estado tras reintento:', { roomState, remoteCount });
            if (roomState === 'connected' || remoteCount > 0) {
              reconnectInProgressRef.current = false;
              return true;
            }
          }
        }
      } catch (e) {
        console.warn('❌ [VideoChat] Error en intento de reconexión:', e);
      }

      // backoff exponencial (1s, 2s, 4s...)
      await delay(1000 * Math.pow(2, attempt - 1));
    }

    reconnectInProgressRef.current = false;
    return false;
  };

  const attemptReconnectThenHandle = async (reason, message) => {
    try {
      const reconnected = await tryReconnect();
      if (reconnected) {
        console.log('✅ [VideoChat] Reconexión exitosa - cancelando manejo de desconexión');
        return;
      }
    } catch (e) {
      console.warn('❌ [VideoChat] Error intentando reconexión', e);
    }

    // Si fallo la reconexión, proceder con el handler original
    handleModeloDisconnected(reason, message);
  };
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
          }
        }
      }
    };
    
    processMessagesForTranslation();
  }, [messages, translateMessage, translationSettings.enabled]);

  // Efecto para detener loading cuando conecta (MEJORADO - solo una vez)
  const hasStoppedSearching = useRef(false);
  useEffect(() => {
    const shouldStopLoading = 
      connected && 
      token && 
      chatFunctions && 
      room &&
      room.state === 'connected' &&
      (
        chatFunctions.participantsCount > 1 || 
        chatFunctions.hasOtherParticipant || 
        !chatFunctions.isDetecting
      );

    if (shouldStopLoading && !hasStoppedSearching.current) {
      hasStoppedSearching.current = true;
      forceStopSearching();
    }
  }, [connected, token, chatFunctions, forceStopSearching, room]);

  // Efecto para configurar chatFunctions
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

  // Efecto para notificaciones de regalo
  useEffect(() => {
    if (pendingRequests.length > 0 && userData.role === 'cliente') {
      setShowGiftNotification(true);
          } else {
      setShowGiftNotification(false);
    }
  }, [pendingRequests, userData.role]);


  // 🔥 REFS PARA VALORES QUE CAMBIAN FRECUENTEMENTE (evitar reiniciar polling)
  const disconnectionReasonRef = useRef(disconnectionReason);
  const redirectCountdownRef = useRef(redirectCountdown);
  const pendingRedirectActionRef = useRef(pendingRedirectAction);
  const modeloDisconnectedRef = useRef(modeloDisconnected);
  const otherUserRef = useRef(otherUser);
  const tiempoRef = useRef(tiempo);
  const userDataRef = useRef(userData);
  const handleModeloDisconnectedRef = useRef(handleModeloDisconnected);
  const clearUserCacheRef = useRef(clearUserCache);
  const startSearchingRef = useRef(startSearching);
  const processSessionEarningsRef = useRef(processSessionEarnings);
  const navigateRef = useRef(navigate);
  const selectedCameraRef = useRef(selectedCamera);
  const selectedMicRef = useRef(selectedMic);
  const selectedCameraDeviceRef = useRef(selectedCameraDevice);
  const selectedMicrophoneDeviceRef = useRef(selectedMicrophoneDevice);
  
  // 🔥 ACTUALIZAR REFS CUANDO CAMBIAN LOS VALORES
  useEffect(() => {
    disconnectionReasonRef.current = disconnectionReason;
    redirectCountdownRef.current = redirectCountdown;
    pendingRedirectActionRef.current = pendingRedirectAction;
    modeloDisconnectedRef.current = modeloDisconnected;
    otherUserRef.current = otherUser;
    tiempoRef.current = tiempo;
    userDataRef.current = userData;
    handleModeloDisconnectedRef.current = handleModeloDisconnected;
    clearUserCacheRef.current = clearUserCache;
    startSearchingRef.current = startSearching;
    processSessionEarningsRef.current = processSessionEarnings;
    navigateRef.current = navigate;
    selectedCameraRef.current = selectedCamera;
    selectedMicRef.current = selectedMic;
    selectedCameraDeviceRef.current = selectedCameraDevice;
    selectedMicrophoneDeviceRef.current = selectedMicrophoneDevice;
  }, [
    disconnectionReason, redirectCountdown, pendingRedirectAction, modeloDisconnected,
    otherUser, tiempo, userData, handleModeloDisconnected, clearUserCache, startSearching,
    processSessionEarnings, navigate, selectedCamera, selectedMic, selectedCameraDevice, selectedMicrophoneDevice
  ]);

  // 🔥 EFECTO PARA POLLING DE NOTIFICACIONES - FUNCIONA PARA AMBOS ROLES
  useEffect(() => {
    // 🔥 IMPORTANTE: Permitir polling incluso si loading es true, para detectar desconexiones
    const isModelo = userData?.role === 'modelo';
    
    if (!roomName || !userName) {
      console.log(`⏸️ [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Polling skip - sin parámetros:`, {
        noRoomName: !roomName,
        noUserName: !userName,
        role: userData?.role
      });
      return;
    }
    
    // 🔥 LOG INICIAL PARA VERIFICAR QUE EL POLLING SE INICIA
    console.log(`🔄 [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Iniciando polling de notificaciones:`, {
      role: userData?.role,
      roomName,
      userName,
      connected
    });

    let isPolling = true;
    // 🔥 MISMO INTERVALO PARA AMBOS ROLES (igual que cliente)
    let pollInterval = 2000; // 🔥 2 SEGUNDOS PARA AMBOS
    let consecutiveEmpty = 0;
    let timeoutId = null; // 🔥 REF PARA EL TIMEOUT RECURSIVO

    const checkNotifications = async () => {
      // 🔥 USAR REFS EN LUGAR DE ESTADOS DIRECTOS (evitar reinicios)
      const isCurrentlyRedirecting = (
        disconnectionReasonRef.current && 
        redirectCountdownRef.current === 0 && 
        pendingRedirectActionRef.current
      );
      
      if (!isPolling || isCurrentlyRedirecting) {
        console.log(`⏸️ [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Polling cancelado:`, {
          isPolling,
          isCurrentlyRedirecting,
          disconnectionReason: disconnectionReasonRef.current,
          redirectCountdown: redirectCountdownRef.current,
          pendingRedirectAction: pendingRedirectActionRef.current,
          role: userData?.role
        });
        return;
      }
      
      // 🔥 LOG PARA VERIFICAR QUE EL POLLING ESTÁ ACTIVO (cada 5 intentos para modelo, 10 para cliente)
      const logInterval = isModelo ? 5 : 10;
      if (consecutiveEmpty === 0 || consecutiveEmpty % logInterval === 0) {
        console.log(`🔄 [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Polling activo (intento ${consecutiveEmpty}):`, {
          role: userData?.role,
          roomName,
          connected,
          hasOtherUser: !!otherUser,
          isPolling,
          isCurrentlyRedirecting: (disconnectionReasonRef.current && redirectCountdownRef.current === 0 && pendingRedirectActionRef.current)
        });
      }
      

      try {
        const authToken = localStorage.getItem('token');
        if (!authToken) {
          return;
        }

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
          const isModelo = userData?.role === 'modelo';
          console.log(`🔔 [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Notificación recibida:`, {
            success: data.success,
            has_notifications: data.has_notifications,
            notification_type: data.notification?.type,
            role: userData?.role,
            full_response: data
          });

        if (data.success && data.has_notifications) {
          consecutiveEmpty = 0;
          const notification = data.notification;

          const isModelo = userData?.role === 'modelo';
          console.log(`🔔 [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Procesando notificación:`, {
            type: notification.type,
            data: notification.data,
            role: userData?.role,
            full_notification: notification
          });

          // 🔥 NO DETENER EL POLLING - Continuar igual que el cliente

          if (notification.type === 'partner_went_next') {
            // 🔥 USAR REFS PARA VALORES ACTUALES
            const currentUserData = userDataRef.current;
            const currentOtherUser = otherUserRef.current;
            const currentTiempo = tiempoRef.current;
            const isModelo = currentUserData?.role === 'modelo';
            
            console.log(`✅ [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Cliente dio siguiente - procesando...`, {
              role: currentUserData?.role,
              hasOtherUser: !!currentOtherUser,
              tiempo: currentTiempo
            });
            
            localStorage.removeItem('sessionTime');
            localStorage.removeItem('sessionStartTime');

            if (currentTiempo > 0 && currentOtherUser?.id && currentUserData?.id) {
              try {
                await processSessionEarningsRef.current(currentTiempo, 'partner_went_next');
              } catch (error) {
                console.error('Error procesando ganancias:', error);
              }
            }

            // 🔥 EXACTAMENTE IGUAL QUE LA MODELO - Mostrar pantalla de desconexión primero
            const nextMessage = isModelo 
              ? t('videochat.disconnect.clientWentNext')
              : t('videochat.disconnect.modelSkipped');
            
            handleModeloDisconnectedRef.current('next', nextMessage);
            clearUserCacheRef.current();
            startSearchingRef.current();

            // 🔥 EXACTAMENTE IGUAL QUE LA MODELO - Navegar después de 3 segundos
            setTimeout(() => {
              const userRole = isModelo ? 'modelo' : 'cliente';
              const currentSelectedCamera = selectedCameraRef.current || selectedCameraDeviceRef.current || '';
              const currentSelectedMic = selectedMicRef.current || selectedMicrophoneDeviceRef.current || '';
              
              const urlParams = new URLSearchParams({
                role: userRole,
                from: 'partner_went_next',
                action: 'siguiente',
                excludeUser: currentOtherUser?.id || '',
                excludeUserName: currentOtherUser?.name || '',
                selectedCamera: currentSelectedCamera,
                selectedMic: currentSelectedMic
              });
              
              navigateRef.current(`/usersearch?${urlParams}`, { replace: true });
            }, 3000); // 🔥 3 SEGUNDOS (igual que el countdown)
          }

          if (notification.type === 'call_replaced') {
            localStorage.removeItem('sessionTime');
            localStorage.removeItem('sessionStartTime');

            const tiempoActual = tiempo;
            if (tiempoActual > 0 && otherUser?.id && userData?.id) {
              try {
                await processSessionEarnings(tiempoActual, 'call_replaced');
              } catch (error) {
              }
            }

            // 🔥 DESCONECTAR DE LIVEKIT
            try {
              if (room && room.state !== 'disconnected') {
                await room.disconnect();
              } else if (window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
                await window.livekitRoom.disconnect();
              }
            } catch (error) {
            }

            // 🔥 MOSTRAR PANTALLA DE DESCONEXIÓN
            handleModeloDisconnected('call_replaced', t('videochat.disconnect.modelAcceptedAnotherCall'));
            clearUserCache();
            startSearching();

            // 🔥 NAVEGAR A RULETEAR DESPUÉS DE 3 SEGUNDOS
            setTimeout(() => {
              
              const notificationData = typeof notification.data === 'string' 
                ? JSON.parse(notification.data) 
                : notification.data;
              
              const redirectParams = notificationData?.redirect_params || {};
              
              const urlParams = new URLSearchParams({
                role: 'cliente',
                from: 'call_replaced',
                action: 'siguiente',
                excludeUser: otherUser?.id || '',
                excludeUserName: otherUser?.name || '',
                selectedCamera: selectedCamera || selectedCameraDevice || '',
                selectedMic: selectedMic || selectedMicrophoneDevice || '',
                ...redirectParams
              });
              
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

            // 🔥 EXACTAMENTE IGUAL QUE LA MODELO - Mostrar pantalla de desconexión primero
            // 🔥 CAMBIO: Cuando el compañero cuelga, también ir a ruletear (no a home)
            const isModelo = userData?.role === 'modelo';
            const stopMessage = isModelo
              ? t('videochat.disconnect.clientEnded')
              : t('videochat.disconnect.modelEnded');
            handleModeloDisconnected('partner_left_session', stopMessage);
            
            // 🔥 NAVEGAR DESPUÉS DE 3 SEGUNDOS (igual que partner_went_next)
            clearUserCache();
            startSearching();
            
            setTimeout(() => {
              const userRole = isModelo ? 'modelo' : 'cliente';
              const urlParams = new URLSearchParams({
                role: userRole,
                from: 'partner_left_session',
                action: isModelo ? 'find_new_client' : 'siguiente',
                excludeUser: otherUser?.id || '',
                excludeUserName: otherUser?.name || '',
                selectedCamera: selectedCamera || selectedCameraDevice || '',
                selectedMic: selectedMic || selectedMicrophoneDevice || ''
              });
              
              navigate(`/usersearch?${urlParams}`, { replace: true });
            }, 3000);
          }
        } else {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) {
            pollInterval = Math.min(pollInterval + 2000, 15000); // ✅ MÁXIMO 15 SEGUNDOS
          }
        }
      } catch (error) {
        console.error(`❌ [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Error en polling:`, error);
        // 🔥 CONTINUAR POLLING AUNQUE HAYA ERROR
      }

      // 🔥 CONTINUAR POLLING SIEMPRE (igual que cliente)
      if (isPolling) {
        timeoutId = setTimeout(checkNotifications, pollInterval);
      }
    };

    checkNotifications();

    return () => {
      isPolling = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.log(`🛑 [VideoChat][${isModelo ? 'MODELO' : 'CLIENTE'}] Polling detenido (cleanup)`);
    };
  }, [roomName, userName]); // 🔥 REMOVIDO userData?.role de dependencias para evitar reinicios innecesarios
  
  // 🔥 VERIFICACIÓN PERIÓDICA AGRESIVA PARA DETECTAR DESCONEXIÓN DE LA MODELO
  useEffect(() => {
    

    // No ejecutar si ya sabemos que se desconectó o si nosotros estamos saliendo
    if (modeloDisconnected || (disconnectionReason && redirectCountdown > 0) || isProcessingLeave) {
      console.log('⏸️ [VideoChat] Polling skip:', {
        modeloDisconnected,
        hasDisconnectionReason: !!(disconnectionReason && redirectCountdown > 0),
        isProcessingLeave
      });
      return;
    }

    // 🔥 IMPORTANTE: Solo verificar si YA había una conexión establecida
    // No verificar al inicio cuando la sala está vacía (es normal)
    if (!connected || !room || room.state !== 'connected') {
      return;
    }

    // Si hay participantes remotos ahora, marcar que los había
    const currentRemoteCount = room?.remoteParticipants?.size || 0;
    if (currentRemoteCount > 0) {
      hadRemoteParticipantsRef.current = true;
    }

    // Log removido para reducir ruido

    const checkModeloConnection = () => {
      // 🔥 Usar tanto room como window.livekitRoom para detectar cualquier cambio
      const currentRoom = room || window.livekitRoom;

      if (!currentRoom) {
        return;
      }

      // 🔥 SOLO DETECTAR DESCONEXIÓN SI:
      // 1. Ya había una conexión establecida (connected === true)
      // 2. Ya había participantes remotos antes (hadRemoteParticipantsRef.current === true)
      // 3. O hay tiempo de sesión > 0 (indica que ya había una sesión activa)
      // 4. O hay otherUser cargado (indica que ya había una modelo conectada)
      const hadActiveSession = hadRemoteParticipantsRef.current || tiempo > 0 || !!otherUser;

      if (!hadActiveSession) {
        // Aún no había una sesión activa, es normal que no haya participantes
        const currentRemoteCount = currentRoom.remoteParticipants?.size || 0;
        if (currentRemoteCount > 0) {
          hadRemoteParticipantsRef.current = true; // Marcar que ahora sí hay participantes
        }
        return;
      }

      // 🔥 ELIMINADO: No detectar desconexión basándose solo en el estado de la room
      // Esto causa falsos positivos cuando la modelo refresca la pestaña
      // Solo confiar en las notificaciones del backend que indican cuando la modelo realmente colgó/saltó
      // Las notificaciones se manejan en el useEffect de checkNotifications (línea ~3634)
      
      // Si la room no está conectada, solo actualizar el estado pero no redirigir
      if (currentRoom.state !== 'connected' && hadActiveSession) {
        // No hacer nada, esperar a que se reconecte o a que llegue una notificación del backend
        return;
      }

      // 🔥 Verificar cantidad de participantes remotos
      const remoteParticipants = currentRoom.remoteParticipants;
      const remoteCount = remoteParticipants?.size || 0;

      // 🔥 ELIMINADO: No detectar desconexión basándose solo en la ausencia de participantes
      // Esto causa falsos positivos cuando la modelo refresca la pestaña
      // Solo confiar en las notificaciones del backend que indican cuando la modelo realmente colgó/saltó
      // Las notificaciones se manejan en el useEffect de checkNotifications (línea ~3634)
      
      // Actualizar el ref si ahora hay participantes
      if (remoteCount > 0) {
        hadRemoteParticipantsRef.current = true;
      }
    };

    // 🔥 REDUCIR FRECUENCIA A 5 SEGUNDOS (menos agresivo, evita falsos positivos)
    const checkInterval = setInterval(checkModeloConnection, 5000);

    return () => {
      clearInterval(checkInterval);
    };
  }, [room, connected, modeloDisconnected, disconnectionReason, redirectCountdown, isProcessingLeave, handleModeloDisconnected, tiempo, otherUser]);

  
  // 🔥 REF PARA RASTREAR SI EL COMPONENTE ESTÁ MONTADO
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  useEffect(() => {
    // ✅ CONDICIONES MEJORADAS PARA CLIENTE
    if (!room || !connected || (disconnectionReason && redirectCountdown > 0) || isProcessingLeave) {
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
      if (!isActive || (disconnectionReason && redirectCountdown > 0) || isProcessingLeave) {
                return;
      }

            
      try {
        // Marcar como inactivo inmediatamente
        isActive = false;
        cleanupTimers();

        // Procesar ganancias si hay datos válidos (para cliente es diferente)
        if (tiempo > 0 && otherUser?.id && userData?.id) {
                    await processSessionEarnings(tiempo, 'auto_empty_room_client');
        }

        // 🔥 MOSTRAR PANTALLA DE DESCONEXIÓN ANTES DE NAVEGAR
        // Verificar que siguientePersona existe
        if (typeof window.siguientePersona === 'function') {
          window.siguientePersona();
        } else {
          // Mostrar pantalla de desconexión antes de navegar
          handleClientInitiatedDisconnect('next', 'Sala vacía - buscando nueva modelo', 'next');
        }

      } catch (error) {
                // Fallback: navegar directamente
        navigate('/usersearch?role=cliente&action=auto_error', { replace: true });
      }
    };

    // ✅ VERIFICADOR DE SALA VACÍA OPTIMIZADO
    const checkEmptyRoom = () => {
      if (!isActive || !room || room.state !== 'connected') {
        return;
      }

      const remoteCount = room.remoteParticipants?.size || 0;
      const hasLocal = !!room.localParticipant;
      
      // 🔥 SI HAY PARTICIPANTES REMOTOS, CANCELAR TODAS LAS DETECCIONES
      if (remoteCount > 0) {
        // Hay usuarios - cancelar timers y cancelar detección de desconexión
        if (autoNextTimer || warningTimer) {
          cleanupTimers();
        }
        // 🔥 CANCELAR DETECCIÓN DE DESCONEXIÓN SI HAY PARTICIPANTES
        if (disconnectDetectionTimeoutRef.current) {
          clearTimeout(disconnectDetectionTimeoutRef.current);
          disconnectDetectionTimeoutRef.current = null;
          isDetectingDisconnectionRef.current = false;
          console.log('✅ [VideoChat] Participantes detectados - cancelando detección de desconexión');
        }
        // 🔥 ACTUALIZAR REF PARA INDICAR QUE HAY PARTICIPANTES
        hadRemoteParticipantsRef.current = true;
        return; // 🔥 SALIR INMEDIATAMENTE SI HAY PARTICIPANTES
      }
      
      // 🔥 SOLO VERIFICAR DESCONEXIÓN SI NO HAY PARTICIPANTES Y HAY SESIÓN ACTIVA
      // PERO SOLO SI NO HAY UNA DETECCIÓN YA EN PROGRESO
      if (remoteCount === 0 && hasLocal && !isDetectingDisconnectionRef.current) {
        const hadActiveSession = hadRemoteParticipantsRef.current || tiempo > 0 || !!otherUser;
        // 🔥 SOLO INICIAR DETECCIÓN SI REALMENTE HABÍA UNA SESIÓN ACTIVA
        // Y NO HAY UNA DETECCIÓN YA EN PROGRESO
        if (hadActiveSession && 
            !modeloDisconnected && 
            !(disconnectionReason && redirectCountdown > 0) && 
            !isProcessingLeave) {
          detectPartnerDisconnection(null, false);
        }
      }
    };

    // ✅ VERIFICACIÓN INICIAL
    checkEmptyRoom();
    
    // ✅ INTERVALO DE VERIFICACIÓN CADA 15 SEGUNDOS (menos frecuente, más conservador)
    checkInterval = setInterval(() => {
      if (isActive) {
        checkEmptyRoom();
      }
    }, 15000);

    // ✅ LISTENERS DE PARTICIPANTES
    const handleParticipantConnected = (participant) => {
      // 🔥 CANCELAR DETECCIÓN DE DESCONEXIÓN SI ALGUIEN SE RECONECTA
      if (disconnectDetectionTimeoutRef.current) {
        clearTimeout(disconnectDetectionTimeoutRef.current);
        disconnectDetectionTimeoutRef.current = null;
        isDetectingDisconnectionRef.current = false;
        console.log('✅ [VideoChat] Participante reconectado - cancelando detección de desconexión:', participant?.identity);
      }
      
      // 🔥 ACTUALIZAR REF INMEDIATAMENTE
      hadRemoteParticipantsRef.current = true;
      
      // 🔥 NO LLAMAR checkEmptyRoom INMEDIATAMENTE - esperar un poco para que se estabilice
      // El checkEmptyRoom se ejecutará en el siguiente intervalo
    };

    const handleParticipantDisconnected = (participant) => {
      // 🔥 VERIFICAR PRIMERO SI REALMENTE ES EL COMPAÑERO ANTES DE INICIAR DETECCIÓN
      const currentUserRole = userData?.role;
      const partnerRole = otherUser?.role;
      let isPartner = false;
      
      if (participant && participant.identity) {
        const participantIdentity = participant.identity.toLowerCase();
        isPartner = 
          (currentUserRole === 'cliente' && (
            participantIdentity.includes('modelo') || 
            participantIdentity.includes('model') ||
            (partnerRole === 'modelo' && participantIdentity.includes(otherUser?.name?.toLowerCase()))
          )) ||
          (currentUserRole === 'modelo' && (
            participantIdentity.includes('cliente') || 
            participantIdentity.includes('client') ||
            (partnerRole === 'cliente' && participantIdentity.includes(otherUser?.name?.toLowerCase()))
          ));
      }
      
      // 🔥 SOLO INICIAR DETECCIÓN SI ES EL COMPAÑERO Y NO HAY UNA DETECCIÓN YA EN PROGRESO
      if (isPartner && !isDetectingDisconnectionRef.current) {
        // 🔥 USAR FUNCIÓN CENTRALIZADA CON PERÍODO DE GRACIA DE 30 SEGUNDOS
        detectPartnerDisconnection(participant, false);
      } else if (!isPartner) {
        // Si no es el compañero, solo verificar sala vacía después de un delay
        setTimeout(() => {
          if (isActive) {
            checkEmptyRoom();
          }
        }, 3000);
      }
    };

    if (room) {
      room.on('participantConnected', handleParticipantConnected);
      room.on('participantDisconnected', handleParticipantDisconnected);
    }

    // ✅ CLEANUP FUNCTION DEFINITIVO
    return () => {
      // Log removido para reducir ruido
      isActive = false;
      cleanupTimers();
      
      if (room) {
        room.off('participantConnected', handleParticipantConnected);
        room.off('participantDisconnected', handleParticipantDisconnected);
        
        // 🔥 SOLO DESCONECTAR SI EL COMPONENTE SE ESTÁ DESMONTANDO COMPLETAMENTE
        // No desconectar si solo cambian las dependencias
        if (!isMountedRef.current && room.state !== 'disconnected') {
          room.disconnect().catch((err) => {
          });
        } else {
        }
      }
      
      // También desconectar la instancia global solo si el componente se desmonta
      if (!isMountedRef.current && window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
        window.livekitRoom.disconnect().catch(() => {});
      }
    };

  // ✅ DEPENDENCIAS PARA LA LÓGICA DE VERIFICACIÓN
  // El cleanup verifica isMountedRef para saber si debe desconectar o solo limpiar listeners
  }, [room, connected, disconnectionReason, redirectCountdown, isProcessingLeave, handleModeloDisconnected, otherUser, tiempo, userData, processSessionEarnings, navigate, addNotification]); 

  // 🔥 EFECTO PARA MANEJAR NAVEGACIÓN DESPUÉS DEL COUNTDOWN
  useEffect(() => {

    
    if (redirectCountdown === 0 && pendingRedirectAction && disconnectionReason) {
      
      if (pendingRedirectAction === 'next') {
        // Ir a ruletear
        clearUserCache();
        startSearching();
        
        const urlParams = new URLSearchParams({
          role: 'cliente',
          action: 'siguiente',
          from: 'videochat_siguiente',
          excludeUser: otherUser?.id || '',
          excludeUserName: otherUser?.name || '',
          selectedCamera: selectedCamera || selectedCameraDevice || '',
          selectedMic: selectedMic || selectedMicrophoneDevice || ''
        });
        
        navigate(`/usersearch?${urlParams}`, { replace: true });
      } else if (pendingRedirectAction === 'stop') {
        // Ir al inicio (homecliente)
        
        // 🔥 MARCAR QUE ESTAMOS DESCONECTANDO (ANTES DE LIMPIAR)
        isDisconnectingRef.current = true;
        
        clearUserCache();
        
        // Limpiar datos
        const itemsToRemove = [
          'roomName', 'userName', 'currentRoom',
          'inCall', 'callToken', 'videochatActive',
          'sessionTime', 'sessionStartTime'
        ];
        
        itemsToRemove.forEach(item => {
          localStorage.removeItem(item);
          sessionStorage.removeItem(item);
        });
        
        // Actualizar heartbeat
        const authToken = localStorage.getItem('token');
        if (authToken) {
          fetch(`${API_BASE_URL}/api/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              activity_type: 'browsing',
              room: null
            })
          }).catch(() => {});
        }
        
        safeNavigateHome({ state: null });
        
        // 🔥 RESETEAR FLAG DESPUÉS DE UN DELAY
        setTimeout(() => {
          isDisconnectingRef.current = false;
        }, 1000);
      }
      
      // Limpiar estado
      setPendingRedirectAction(null);
    }
  }, [redirectCountdown, pendingRedirectAction, disconnectionReason, navigate, otherUser, selectedCamera, selectedMic, selectedCameraDevice, selectedMicrophoneDevice, clearUserCache, startSearching]);

  useEffect(() => {
    // Función de emergencia disponible globalmente
    window.emergencyExitClient = () => {
            
      // Detener todos los timers
      for (let i = 1; i < 9999; i++) {
        clearTimeout(i);
        clearInterval(i);
      }
      
      // Desconectar LiveKit si existe
      if (window.livekitRoom) {
        window.livekitRoom.disconnect().catch(() => {});
      }
      if (room) {
        room.disconnect().catch(() => {});
      }
      
      // Navegar inmediatamente
      window.location.href = '/usersearch?role=cliente&action=emergency&from=manual';
    };
    
    // 🔥 PERÍODO DE GRACIA DE 15 SEGUNDOS ANTES DE DESCONECTAR (para permitir refresh)
    let disconnectTimeoutRef = null;
    let isPageVisible = !document.hidden;
    
    const scheduleDisconnect = () => {
      // Limpiar timeout anterior si existe
      if (disconnectTimeoutRef) {
        clearTimeout(disconnectTimeoutRef);
        disconnectTimeoutRef = null;
      }
      
      // Programar desconexión después de 15 segundos
      disconnectTimeoutRef = setTimeout(() => {
        // Solo desconectar si la página sigue oculta
        if (document.hidden && (room || window.livekitRoom)) {
          console.log('⏰ [VideoChat] Período de gracia expirado - desconectando de LiveKit');
          if (room && room.state !== 'disconnected') {
            room.disconnect().catch(() => {});
          }
          if (window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
            window.livekitRoom.disconnect().catch(() => {});
          }
        }
        disconnectTimeoutRef = null;
      }, 15000); // 15 segundos
    };
    
    const cancelDisconnect = () => {
      if (disconnectTimeoutRef) {
        clearTimeout(disconnectTimeoutRef);
        disconnectTimeoutRef = null;
        console.log('✅ [VideoChat] Desconexión cancelada - página visible nuevamente');
      }
    };
    
    // 🔥 DETECTAR CAMBIOS DE VISIBILIDAD (ocultar/mostrar pestaña)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Página oculta - iniciar período de gracia de 15 segundos
        console.log('👁️ [VideoChat] Página oculta - iniciando período de gracia de 15 segundos');
        isPageVisible = false;
        scheduleDisconnect();
      } else {
        // Página visible - cancelar desconexión programada
        console.log('👁️ [VideoChat] Página visible - cancelando desconexión');
        isPageVisible = true;
        cancelDisconnect();
      }
    };
    
    // 🔥 DETECTAR CIERRE DE PÁGINA (pero NO desconectar inmediatamente en refresh)
    const handlePageHide = (event) => {
      // Si es un refresh (persisted = true en algunos navegadores), no desconectar
      if (event.persisted) {
        console.log('🔄 [VideoChat] Refresh detectado - no desconectando inmediatamente');
        return;
      }
      
      // Para cierres reales, iniciar período de gracia
      console.log('🚪 [VideoChat] Página oculta (posible cierre) - iniciando período de gracia');
      scheduleDisconnect();
    };
    
    // 🔥 NO DESCONECTAR EN beforeunload (permitir refresh sin desconexión)
    const handleBeforeUnload = (event) => {
      // No desconectar aquí - solo permitir que el navegador muestre el diálogo si es necesario
      // El período de gracia se manejará en visibilitychange/pagehide
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      console.log('🧹 [VideoChat] Cleanup emergency:', {
        isMounted: isMountedRef.current,
        roomState: room?.state
      });
      
      delete window.emergencyExitClient;
      
      // Limpiar listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Cancelar desconexión programada
      cancelDisconnect();
      
      // 🔥 SOLO DESCONECTAR SI EL COMPONENTE SE ESTÁ DESMONTANDO COMPLETAMENTE
      // No desconectar si solo cambia la referencia de room
      if (!isMountedRef.current && room && room.state !== 'disconnected') {
        room.disconnect().catch(() => {});
      }
      if (!isMountedRef.current && window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
        window.livekitRoom.disconnect().catch(() => {});
      }
    };
  }, [room]);
  // 🔥 EFECTO PARA MANTENER SINCRONIZADO EL ESTADO `connected` CON EL ESTADO REAL DE LA ROOM
  useEffect(() => {
    if (!room) {
      // #region agent log
      // #endregion
      return;
    }
    
    const syncConnectionState = () => {
      const isRoomConnected = room.state === 'connected' || window.livekitRoom?.state === 'connected';
      
      // #region agent log
      // #endregion
      
      if (isRoomConnected && !connected) {
        console.log('✅ [CLIENTE] Room conectada pero connected=false, corrigiendo...');
        setConnected(true);
      } else if (!isRoomConnected && connected) {
        console.log('⚠️ [CLIENTE] Room desconectada pero connected=true, corrigiendo...');
        setConnected(false);
      }
    };
    
    // Verificar inmediatamente
    syncConnectionState();
    
    // Verificar periódicamente
    const syncInterval = setInterval(syncConnectionState, 2000);
    
    // También escuchar cambios en el estado de la room
    const handleStateChange = () => {
      syncConnectionState();
    };
    
    if (room) {
      room.on('connectionStateChanged', handleStateChange);
    }
    
    return () => {
      clearInterval(syncInterval);
      if (room) {
        room.off('connectionStateChanged', handleStateChange);
      }
    };
  }, [room, connected]);

  useEffect(() => {
    if (roomName && connected && !isMonitoringBalance) {
            setIsMonitoringBalance(true);
    } else if ((!roomName || !connected) && isMonitoringBalance) {
            setIsMonitoringBalance(false);
    }
  }, [roomName, connected]); // 🔥 REMOVIDO isMonitoringBalance de dependencias para evitar loop

  // 🔥 INICIAR TIEMPO AUTOMÁTICAMENTE CUANDO HAY roomName (tan pronto como se une a la sala)
  useEffect(() => {
    // 🔥 INICIAR SI HAY roomName (no depende de otherUser, solo de estar en la sala)
    const shouldStartTimer = !!roomName;
    
    console.log('⏱️ [TIEMPO] Verificando inicio de tiempo:', {
      otherUserId: otherUser?.id,
      roomName: roomName,
      shouldStartTimer: shouldStartTimer,
      tiempoActual: tiempo
    });
    
    if (!shouldStartTimer) {
      // Si no hay roomName, resetear pero no iniciar
      if (tiempoIntervalRef.current) {
        clearInterval(tiempoIntervalRef.current);
        tiempoIntervalRef.current = null;
      }
      return;
    }

    // 🔥 INICIAR CONTADOR DE TIEMPO AUTOMÁTICAMENTE
    if (tiempoIntervalRef.current) {
      clearInterval(tiempoIntervalRef.current);
    }
    
    // 🔥 CARGAR TIEMPO DESDE localStorage O RESETEAR SI NO HAY
    const storedTime = getStoredTime(roomName);
    if (storedTime > 0) {
      console.log('⏱️ [TIEMPO] Continuando desde tiempo guardado:', storedTime, 'segundos');
      setTiempo(storedTime);
    } else {
      console.log('⏱️ [TIEMPO] Iniciando contador de tiempo desde 0');
      // 🔥 No resetear a 0 si ya hay un tiempo cargado desde el useEffect anterior
      if (tiempo === 0) {
        setTiempo(0);
      }
    }
    
    tiempoIntervalRef.current = setInterval(() => {
      setTiempo((prev) => {
        const nuevoTiempo = prev + 1;
        // 🔥 GUARDAR EN localStorage CADA SEGUNDO
        if (roomName) {
          const storageKey = `videochat_tiempo_${roomName}`;
          localStorage.setItem(storageKey, nuevoTiempo.toString());
        }
        // 🔥 LOG CADA SEGUNDO EN LOS PRIMEROS 10 SEGUNDOS PARA DEBUG
        if (nuevoTiempo <= 10) {
          console.log('⏱️ [TIEMPO] Tiempo:', nuevoTiempo, 'segundos');
        } else if (nuevoTiempo % 5 === 0) {
          // 🔥 DESPUÉS DE 10 SEGUNDOS, LOG CADA 5 SEGUNDOS
          console.log('⏱️ [TIEMPO] Tiempo transcurrido:', nuevoTiempo, 'segundos');
        }
        return nuevoTiempo;
      });
    }, 1000);
    
    // 🔥 VERIFICAR QUE EL INTERVALO SE CREÓ CORRECTAMENTE
    console.log('⏱️ [TIEMPO] Intervalo configurado, ref:', tiempoIntervalRef.current);
    
    // 🔥 TEST: Verificar que el intervalo funciona después de 1 segundo
    setTimeout(() => {
      console.log('⏱️ [TIEMPO] TEST - Verificando intervalo después de 1 segundo, ref:', tiempoIntervalRef.current);
      if (tiempoIntervalRef.current) {
        console.log('⏱️ [TIEMPO] TEST - Intervalo todavía activo');
      } else {
        console.warn('⏱️ [TIEMPO] TEST - ⚠️ Intervalo fue limpiado prematuramente!');
      }
    }, 1000);
    
    console.log('⏱️ [TIEMPO] Intervalo creado, tiempo iniciará en 1 segundo');
    
    return () => {
      if (tiempoIntervalRef.current) {
        clearInterval(tiempoIntervalRef.current);
        tiempoIntervalRef.current = null;
        console.log('⏱️ [TIEMPO] Contador detenido');
        // 🔥 GUARDAR TIEMPO FINAL EN localStorage AL LIMPIAR
        if (roomName) {
          const storageKey = `videochat_tiempo_${roomName}`;
          // 🔥 Usar el valor actual del estado tiempo
          setTiempo((currentTiempo) => {
            if (currentTiempo > 0) {
              localStorage.setItem(storageKey, currentTiempo.toString());
              console.log('⏱️ [TIEMPO] Tiempo guardado en localStorage:', currentTiempo, 'segundos');
            }
            return currentTiempo;
          });
        }
      }
    };
  }, [roomName]); // 🔥 SOLO DEPENDE DE roomName

  useEffect(() => {
    if (otherUser?.id) {
      // 🔥 LIMPIAR CACHE ANTERIOR SI CAMBIA EL USUARIO
      const previousUserId = favoritesCacheRef.current.lastCheckedUserId;
      if (previousUserId && previousUserId !== otherUser.id) {
        // Limpiar cache de favoritos del usuario anterior
        Object.keys(favoritesCacheRef.current).forEach(key => {
          if (key.startsWith('favorites_')) {
            delete favoritesCacheRef.current[key];
          }
        });
      }
      favoritesCacheRef.current.lastCheckedUserId = otherUser.id;
      
      // 🔥 DELAY PARA EVITAR LLAMADAS INMEDIATAS EN RE-RENDERS
      const timeoutId = setTimeout(() => {
        checkIfFavorite(otherUser.id);
      }, 1000); // 🔥 Aumentado a 1 segundo
      
      return () => clearTimeout(timeoutId);
    } else {
      setIsFavorite(false);
      // 🔥 LIMPIAR CACHE CUANDO NO HAY USUARIO
      favoritesCacheRef.current = {};
    }
  }, [otherUser?.id]); // 🔥 Solo cuando cambia el ID del usuario

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

    // Listener para abrir el modal de configuración desde el botón
    const handleOpenCameraAudioSettings = () => {
      setShowCameraAudioModal(true);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('openCameraAudioSettings', handleOpenCameraAudioSettings);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('openCameraAudioSettings', handleOpenCameraAudioSettings);
    };
  }, [showMainSettings]);

  // 🔥 EFECTO PARA RESETEAR REFS Y ESTADOS CUANDO CAMBIA LA SALA
  useEffect(() => {
    const newRoomKey = `${memoizedRoomName}-${memoizedUserName}`;
    
    // Solo resetear si realmente cambió la sala
    if (currentRoomKeyRef.current !== newRoomKey && currentRoomKeyRef.current !== null) {
      // 🔥 IMPORTANTE: NO resetear si hay una desconexión activa (para que se muestre el modal)
      // Solo resetear cuando realmente cambiamos de sala ANTES de entrar a una nueva
      const hasActiveDisconnection = modeloDisconnected || (disconnectionReason && disconnectionReason.trim() !== '');
      
      if (hasActiveDisconnection) {
        // Solo actualizar la key pero mantener los estados de desconexión
        currentRoomKeyRef.current = newRoomKey;
        return;
      }
      
      console.log('🔄 [VideoChat] Cambiando de sala:', {
        oldKey: currentRoomKeyRef.current,
        newKey: newRoomKey
      });
      
      // Resetear todos los refs y estados de desconexión
      hadRemoteParticipantsRef.current = false;
      previousParticipantsCount.current = 0;
      currentRoomKeyRef.current = newRoomKey;
      
      // 🔥 RESETEAR ESTADOS DE DESCONEXIÓN AL CAMBIAR DE SALA (solo si no hay desconexión activa)
      setModeloDisconnected(false);
      setDisconnectionReason('');
      setDisconnectionType('');
      setPendingRedirectAction(null);
      setRedirectCountdown(0);
      
    } else if (currentRoomKeyRef.current === null && newRoomKey) {
      // Primera vez que se establece la key
      currentRoomKeyRef.current = newRoomKey;
    }
  }, [memoizedRoomName, memoizedUserName, modeloDisconnected, disconnectionReason]);

  // Efecto para guardar parámetros
  useEffect(() => {
    // 🔥 NO GUARDAR SI ESTAMOS DESCONECTANDO
    if (isDisconnectingRef.current) {
      return;
    }
    
    if (roomName && roomName !== 'null' && roomName !== 'undefined') {
      localStorage.setItem("roomName", roomName);
    }
    if (userName && userName !== 'null' && userName !== 'undefined') {
      localStorage.setItem("userName", userName);
    }
  }, [roomName, userName]);

  // 🔥 EFECTO PARA RESETEAR ESTADO DE CONEXIÓN CUANDO CAMBIA LA SALA
  useEffect(() => {
    const newRoomKey = `${memoizedRoomName}-${memoizedUserName}`;
    
    // Solo resetear si realmente cambió la sala
    // 🔥 IMPORTANTE: NO resetear estados de desconexión aquí, solo estados de conexión
    if (currentRoomKeyRef.current !== null && currentRoomKeyRef.current !== newRoomKey) {
      console.log('🔄 [VideoChat] Cambio de sala detectado:', {
        anterior: currentRoomKeyRef.current,
        nueva: newRoomKey
      });
      currentRoomKeyRef.current = newRoomKey;
      connectionAttemptedRef.current = false;
      roomReadyCalled.current = false;
      // 🔥 NO resetear connected aquí si la room ya está conectada
      // Solo resetear si realmente no hay conexión activa
      if (!room || room.state !== 'connected') {
        setConnected(false);
      }
      // 🔥 NO resetear modeloDisconnected ni disconnectionReason aquí
      // Estos estados deben persistir hasta que se navegue
    } else if (currentRoomKeyRef.current === null && newRoomKey) {
      // Primera vez que se establece la key
      currentRoomKeyRef.current = newRoomKey;
    }
  }, [memoizedRoomName, memoizedUserName, room]);



// 🔥 NUEVA FUNCIÓN: Verificación de balance en tiempo real
const checkBalanceRealTime = useCallback(async () => {
  try {
    const authToken = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/livekit/balance-check`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success && !data.can_continue) {
      
      addNotification('error', t('videochat.balance.insufficientBalance'), t('videochat.balance.rechargeToContinue'));
      
      setTimeout(() => {
        finalizarChat(true);
      }, 3000);
    }
    
    return data;
  } catch (error) {
        return null;
  }
}, [finalizarChat, addNotification]);

  // ========== RENDER ==========
  // 🔥 VERIFICACIÓN TEMPRANA: Si no hay roomName válido, no renderizar nada
  // Esto evita que el componente intente conectarse cuando no debería
  // 🔥 LOG REDUCIDO: Solo cuando hay cambios importantes
  const lastLogRef = useRef({});
  useEffect(() => {
    const currentState = {
      memoizedRoomName,
      memoizedUserName,
      loading,
      connected,
      hasToken: !!token,
      hasRoom: !!room,
      roomState: room?.state,
      modeloDisconnected,
      disconnectionReason
    };
    
    // Solo loggear si cambió algo importante
    const stateKey = JSON.stringify(currentState);
    if (lastLogRef.current.key !== stateKey) {
      lastLogRef.current.key = stateKey;
    }
  }, [memoizedRoomName, memoizedUserName, loading, connected, token, room, modeloDisconnected, disconnectionReason]);
  
  if (!memoizedRoomName || !memoizedUserName) {
    console.warn('⚠️ [VideoChat] Faltan parámetros:', {
      memoizedRoomName,
      memoizedUserName,
      locationPathname: location.pathname,
      locationState: location.state,
      searchParams: Object.fromEntries(searchParams.entries()),
      localStorageRoomName: localStorage.getItem('roomName'),
      localStorageUserName: localStorage.getItem('userName'),
      sessionStorageRoomName: sessionStorage.getItem('roomName'),
      sessionStorageUserName: sessionStorage.getItem('userName'),
      stackTrace: new Error().stack
    });
    return null;
  }
  
  // 🔥 MOSTRAR PANTALLA DE DESCONEXIÓN PRIMERO (igual que la modelo)
  // Mostrar si hay desconexión de la modelo O si el cliente inició la desconexión
  const hasDisconnection = modeloDisconnected || (disconnectionReason && disconnectionReason.trim() !== '');
  
  // 🔥 LOG DE DEPURACIÓN THROTTLED
  const disconnectionLogRef = useRef({ lastLog: 0, lastState: '' });
  if (hasDisconnection || modeloDisconnected || disconnectionReason) {
    const now = Date.now();
    const currentState = JSON.stringify({ hasDisconnection, modeloDisconnected, disconnectionReason, redirectCountdown });
    
    // Solo loggear cada 2 segundos o si cambió el estado
    if (now - disconnectionLogRef.current.lastLog > 2000 || disconnectionLogRef.current.lastState !== currentState) {
      disconnectionLogRef.current.lastLog = now;
      disconnectionLogRef.current.lastState = currentState;
      console.log('🔴 [VideoChat] Estado de desconexión:', {
        hasDisconnection,
        modeloDisconnected,
        disconnectionReason,
        redirectCountdown,
        disconnectionType,
        pendingRedirectAction
      });
    }
  }
  
  // 🔥 PRIORIDAD ABSOLUTA: Si hay desconexión, mostrar pantalla de desconexión INMEDIATAMENTE
  // Esto debe estar ANTES de cualquier otra condición de render
  if (hasDisconnection) {
    // 🔥 USAR EL COMPONENTE CORRECTO SEGÚN EL ROL
    const isModelo = userData?.role === 'modelo';
    if (isModelo) {
      return (
        <DisconnectionScreenImproved
          disconnectionType={disconnectionType}
          disconnectionReason={disconnectionReason}
          redirectCountdown={redirectCountdown}
          t={t}
        />
      );
    } else {
      return (
        <DisconnectionScreenImprovedClient
          disconnectionType={disconnectionType}
          disconnectionReason={disconnectionReason}
          redirectCountdown={redirectCountdown}
          t={t}
        />
      );
    }
  }

  // 🔥 RENDER PRINCIPAL
  return (
    <ProtectedPage>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0d10] to-[#131418] text-white overflow-hidden" style={{ maxWidth: '100vw', width: '100%' }}>
        {/* Sistema de notificaciones */}
        <NotificationSystemImprovedClient
          notifications={notifications}
          onRemove={removeNotification}
        />
        
        {/* Modal de regalos */}
        <GiftsModal
          isOpen={showGiftsModal && !(userData?.role === 'cliente' && remainingMinutes <= 2)}
          onClose={() => setShowGiftsModal(false)}
          recipientName={otherUser?.name}
          recipientId={otherUser?.id}
          roomName={roomName}
          userRole={userData?.role || 'cliente'}
          gifts={availableGifts}
          onRequestGift={userData?.role === 'modelo' ? handleRequestGift : undefined}
          onSendGift={userData?.role === 'cliente' ? handleSendGift : undefined}
          userBalance={giftBalance}
        />

        {/* Overlay de notificación de regalo */}
        <GiftNotificationOverlay
          pendingRequests={pendingRequests}
          onAccept={handleAcceptGift}
          onReject={handleRejectGift}
          onClose={() => setShowGiftNotification(false)}
          isVisible={showGiftNotification && userData.role === 'cliente'}
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
          volumeEnabled={volumeEnabled}
          setVolumeEnabled={setVolumeEnabled}
          // 🔥 PROPS PARA COMUNICACIÓN DE DISPOSITIVOS (igual que la modelo)
          selectedCamera={selectedCameraDevice}
          selectedMicrophone={selectedMicrophoneDevice}
          onCameraChange={handleCameraChange}
          onMicrophoneChange={handleMicrophoneChange}
          cameras={cameras}
          microphones={microphones}
          isLoadingDevices={isLoadingDevices}
          onLoadDevices={loadDevices}
        />
        
        {loading && !modeloDisconnected && !(disconnectionReason && disconnectionReason.trim() !== '') && (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff007a] mx-auto mb-4"></div>
              <p className="text-white">{hardcodedTexts.connecting}</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="text-center max-w-md mx-auto">
              <p className="text-red-500 text-lg mb-4">{t('videochat.error.title')}: {error}</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => navigate('/precallclient')}
                  className="bg-[#ff007a] px-6 py-3 rounded-full text-white font-medium"
                >
                  {t('videochat.backToHome')}
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="bg-gray-600 px-6 py-3 rounded-full text-white font-medium"
                >
                  {t('videochat.back')}
                </button>
              </div>
            </div>
          </div>
        )}


    {!loading && !error && token && (
          <>
          {/* Debug log temporal antes de renderizar LiveKitRoom (cliente) */}
          {(() => {
            // mantener el ingest si existe (no bloquear)
            return null;
          })()}
          {/* #endregion */}
          <LiveKitRoom
            key={currentRoomKeyRef.current || `room-${memoizedRoomName}-${memoizedUserName}`} // ✅ KEY ESTABLE
            video={cameraEnabled}
            audio={micEnabled}
            token={token}
            serverUrl={serverUrl}
            data-lk-theme="default"
            onConnected={() => {
              // #region agent log
              // #endregion
              // 🔥 PREVENIR MÚLTIPLES LLAMADAS
              if (connectionAttemptedRef.current) {
                return;
              }
              
              // 🔥 VERIFICAR QUE NO ESTÉ YA CONECTADO
              if (window.livekitRoom?.state === 'connected') {
                connectionAttemptedRef.current = true;
                return;
              }
              
              connectionAttemptedRef.current = true;
              // La lógica se maneja en RoomCapture
            }}
            onDisconnected={(reason) => {
              console.log('🔴 [VideoChat] LiveKit desconectado:', {
                reason,
                roomState: window.livekitRoom?.state,
                remoteParticipants: window.livekitRoom?.remoteParticipants?.size,
                connected,
                isMounted: isMountedRef.current,
                stackTrace: new Error().stack
              });
              
              // Detectar si es un error de identidad duplicada (código 2)
              if (reason === 2 || reason === 'DuplicateIdentity') {
                addNotification('error', t('videochat.error.connectionErrorTitle'), t('videochat.error.identityConflict'));
              }
              
              // 🔥 SOLO MANEJAR DESCONEXIÓN SI NO ES POR DESMONTAJE DEL COMPONENTE
              // Si el componente se está desmontando, no hacer nada aquí
              if (isMountedRef.current) {
                handleRoomDisconnected(reason);
              } else {
              }
            }}
            onConnectionStateChanged={(state) => {
              console.log('🔄 [VideoChat] Estado de conexión cambió:', state, {
                currentConnected: connected,
                roomState: window.livekitRoom?.state,
                remoteCount: window.livekitRoom?.remoteParticipants?.size
              });
              
              if (state === 'disconnected') {
                setConnected(false);
                // 🔥 NO DETECTAR DESCONEXIÓN AQUÍ - se maneja en detectPartnerDisconnection con período de gracia
                // Solo actualizar el estado connected
              } else if (state === 'connected') {
                // 🔥 ESTABLECER CONECTADO INMEDIATAMENTE
                if (!connected) {
                  console.log('✅ [VideoChat] Estableciendo connected=true desde onConnectionStateChanged');
                  setConnected(true);
                }
                
                // 🔥 CANCELAR DETECCIÓN DE DESCONEXIÓN SI SE RECONECTA
                if (disconnectDetectionTimeoutRef.current) {
                  clearTimeout(disconnectDetectionTimeoutRef.current);
                  disconnectDetectionTimeoutRef.current = null;
                  isDetectingDisconnectionRef.current = false;
                  console.log('✅ [VideoChat] Reconexión detectada - cancelando detección de desconexión');
                }
                
                // 🔥 VERIFICAR SI HAY PARTICIPANTES REMOTOS Y ACTUALIZAR REF
                const currentRoom = window.livekitRoom || room;
                const remoteCount = currentRoom?.remoteParticipants?.size || 0;
                if (remoteCount > 0) {
                  hadRemoteParticipantsRef.current = true;
                  // 🔥 RESETEAR ESTADOS DE DESCONEXIÓN SI HAY PARTICIPANTES
                  if (modeloDisconnected) {
                    console.log('✅ [VideoChat] Hay participantes remotos - reseteando estados de desconexión');
                    setModeloDisconnected(false);
                    setDisconnectionReason('');
                    setDisconnectionType('');
                    setRedirectCountdown(0);
                    setPendingRedirectAction(null);
                  }
                }
              }
            }}
            onParticipantConnected={(participant) => {
              // 🔥 CANCELAR DETECCIÓN DE DESCONEXIÓN SI ALGUIEN SE RECONECTA
              if (disconnectDetectionTimeoutRef.current) {
                clearTimeout(disconnectDetectionTimeoutRef.current);
                disconnectDetectionTimeoutRef.current = null;
                isDetectingDisconnectionRef.current = false;
                console.log('✅ [VideoChat] Participante reconectado - cancelando detección de desconexión:', participant?.identity);
              }
              
              // 🔥 ACTUALIZAR REF INMEDIATAMENTE PARA INDICAR QUE HAY PARTICIPANTES
              hadRemoteParticipantsRef.current = true;
              
              // 🔥 RESETEAR ESTADOS DE DESCONEXIÓN SI SE RECONECTA
              if (modeloDisconnected && participant) {
                const participantIdentity = participant.identity?.toLowerCase() || '';
                const isModelo = participantIdentity.includes('modelo') || participantIdentity.includes('model');
                if (isModelo) {
                  console.log('✅ [VideoChat] Modelo reconectada - reseteando estados de desconexión');
                  setModeloDisconnected(false);
                  setDisconnectionReason('');
                  setDisconnectionType('');
                  setRedirectCountdown(0);
                  setPendingRedirectAction(null);
                }
              }
              
              console.log('👤 [VideoChat-CLIENTE] Participante conectado:', {
                identity: participant.identity,
                sid: participant.sid,
                connectionState: participant.connectionState,
                hasVideoTracks: participant.videoTrackPublications?.size || 0,
                hasAudioTracks: participant.audioTrackPublications?.size || 0
              });
              
              // 🔥 SUSCRIBIRSE INMEDIATAMENTE A TODOS LOS TRACKS DEL PARTICIPANTE
              if (participant.setSubscribed && typeof participant.setSubscribed === 'function') {
                // Suscribirse a tracks de video
                if (participant.videoTrackPublications) {
                  participant.videoTrackPublications.forEach((publication) => {
                    if (publication?.trackSid && !publication.isSubscribed && publication.isEnabled !== false) {
                      console.log('📹 [VideoChat-CLIENTE] Suscribiéndose a track de video:', publication.trackSid);
                      participant.setSubscribed(publication.trackSid, true).catch(err => {
                        console.warn('⚠️ [VideoChat-CLIENTE] Error suscribiéndose a track de video:', err);
                      });
                    }
                  });
                }
                
                // Suscribirse a tracks de audio
                if (participant.audioTrackPublications) {
                  participant.audioTrackPublications.forEach((publication) => {
                    if (publication?.trackSid && !publication.isSubscribed && publication.isEnabled !== false) {
                      console.log('🎤 [VideoChat-CLIENTE] Suscribiéndose a track de audio:', publication.trackSid);
                      participant.setSubscribed(publication.trackSid, true).catch(err => {
                        console.warn('⚠️ [VideoChat-CLIENTE] Error suscribiéndose a track de audio:', err);
                      });
                    }
                  });
                }
              }
            }}
            onParticipantDisconnected={(participant) => {
              // 🔥 USAR FUNCIÓN CENTRALIZADA CON PERÍODO DE GRACIA DE 30 SEGUNDOS
              // Solo detectar si hay una sesión activa y no hay una desconexión ya procesada
              const hadActiveSession = hadRemoteParticipantsRef.current || tiempo > 0 || !!otherUser;
              if (hadActiveSession && !modeloDisconnected && !(disconnectionReason && redirectCountdown > 0) && !isProcessingLeave) {
                detectPartnerDisconnection(participant, false);
              }
            }}
            onTrackPublished={(pub, participant) => {
              console.log('📹 [VideoChat-CLIENTE] Track publicado:', {
                kind: pub.kind,
                source: pub.source,
                trackSid: pub.trackSid,
                isSubscribed: pub.isSubscribed,
                isEnabled: pub.isEnabled,
                participantIdentity: participant?.identity
              });
              
              // 🔥 SI ES UN TRACK DE CÁMARA DE UN PARTICIPANTE REMOTO, SUSCRIBIRSE INMEDIATAMENTE
              if (pub.source === Track.Source.Camera && 
                  pub.kind === 'video' && 
                  participant && 
                  !participant.isLocal &&
                  pub.trackSid && 
                  !pub.isSubscribed) {
                
                console.log('🎯 [VideoChat-CLIENTE] Track de cámara remoto detectado, suscribiéndose inmediatamente:', pub.trackSid);
                
                const subscribeTrack = async () => {
                  try {
                    // Intentar múltiples métodos
                    if (participant.setSubscribed && typeof participant.setSubscribed === 'function') {
                      await participant.setSubscribed(pub.trackSid, true);
                      console.log('✅ [VideoChat-CLIENTE] Suscrito a track de cámara remoto usando participant.setSubscribed');
                      return;
                    }
                    
                    if (window.livekitRoom?.setSubscribed && typeof window.livekitRoom.setSubscribed === 'function') {
                      await window.livekitRoom.setSubscribed(pub.trackSid, true);
                      console.log('✅ [VideoChat-CLIENTE] Suscrito a track de cámara remoto usando room.setSubscribed');
                      return;
                    }
                    
                    if (pub.setSubscribed && typeof pub.setSubscribed === 'function') {
                      await pub.setSubscribed(true);
                      console.log('✅ [VideoChat-CLIENTE] Suscrito a track de cámara remoto usando publication.setSubscribed');
                      return;
                    }
                  } catch (error) {
                    console.warn('⚠️ [VideoChat-CLIENTE] Error suscribiéndose a track publicado:', error);
                  }
                };
                
                // Si el trackSid está disponible, suscribirse inmediatamente
                if (pub.trackSid) {
                  subscribeTrack();
                } else {
                  // Si no está disponible aún, esperar un poco y reintentar
                  setTimeout(() => {
                    if (pub.trackSid && !pub.isSubscribed) {
                      subscribeTrack();
                    }
                  }, 500);
                }
              }
            }}
            onTrackUnpublished={(pub, participant) => {
            }}
            onError={(error) => {
              // 🔥 NO REGISTRAR ERRORES DE DESCONEXIÓN INICIADA POR EL CLIENTE COMO ERRORES CRÍTICOS
              // Estos son normales cuando el usuario navega o cierra la página
              if (error?.message?.includes('Client initiated disconnect') || 
                  error?.message?.includes('client initiated disconnect')) {
                return; // No tratar como error crítico
              }
              
              // 🔥 DETECTAR ERRORES DE LÍMITES DE LIVEKIT
              const errorMessage = error?.message || error?.toString() || '';
              const isLimitError = errorMessage.toLowerCase().includes('limit') ||
                                   errorMessage.toLowerCase().includes('upgrade') ||
                                   errorMessage.toLowerCase().includes('minutes') ||
                                   errorMessage.toLowerCase().includes('quota') ||
                                   errorMessage.toLowerCase().includes('exceeded') ||
                                   error?.code === 403 || // Forbidden puede indicar límites
                                   error?.code === 429;   // Too Many Requests
              
              if (isLimitError) {
                console.error('❌ [VideoChat] Error de límites de LiveKit:', {
                  message: error.message,
                  name: error.name,
                  code: error.code
                });
                
                addNotification('error', t('videochat.error.livekitLimitReached'), 
                  t('videochat.error.livekitLimitReachedMessage'));
                
                // Establecer un estado de error específico
                setError('Límite de LiveKit alcanzado. Se requiere actualizar el plan.');
                setLoading(false);
                setConnected(false);
                return;
              }
              
              // Solo registrar errores reales
              console.error('❌ [VideoChat] Error en LiveKit:', {
                message: error.message,
                name: error.name,
                code: error.code,
                stack: error.stack
              });
              
              // 🔥 NO DESCONECTAR AUTOMÁTICAMENTE POR ERRORES - Solo registrar
              // La desconexión debe ser manejada explícitamente por la lógica de la aplicación
            }}
            className="min-h-screen"
            options={{
              // 🔥 CONFIGURACIÓN EXPLÍCITA PARA ASEGURAR SUSCRIPCIÓN AUTOMÁTICA
              autoSubscribe: true,
              publishDefaults: {
                videoSimulcastLayers: [],
                videoCodec: 'vp8',
                audioPreset: {
                  maxBitrate: 16000
                }
              },
              videoCaptureDefaults: selectedCamera ? { deviceId: selectedCamera } : undefined,
              audioCaptureDefaults: selectedMic ? { deviceId: selectedMic } : undefined,
            }}
          >
            <RoomAudioRenderer />
            <RoomCapture onRoomReady={handleRoomReady} />

            
            {/* SimpleChat original */}
            {memoizedRoomName && memoizedUserName && userData.name && (
              <SimpleChat
                key={`${memoizedRoomName}-${memoizedUserName}`}
                userName={userData.name}
                userRole={userData.role}
                roomName={memoizedRoomName}
                onMessageReceived={handleMessageReceived}
                onUserLoaded={handleUserLoadedFromChat}
                onParticipantsUpdated={(participants) => {
                  const currentCount = participants.length;
                  const previousCount = previousParticipantsCount.current;
                  
                  console.log('🔍 [VideoChat] Participants updated:', {
                    otherUser: otherUser?.name,
                    otherUserRole: otherUser?.role,
                    connected: connected,
                    modeloDisconnected: modeloDisconnected,
                    disconnectionReason: disconnectionReason,
                    redirectCountdown: redirectCountdown
                  });

                  // 🔥 SI HAY PARTICIPANTES, ACTUALIZAR REF Y CANCELAR DETECCIONES
                  if (currentCount > 0) {
                    hadRemoteParticipantsRef.current = true;
                    // Cancelar detección de desconexión si hay participantes
                    if (disconnectDetectionTimeoutRef.current) {
                      clearTimeout(disconnectDetectionTimeoutRef.current);
                      disconnectDetectionTimeoutRef.current = null;
                      isDetectingDisconnectionRef.current = false;
                      console.log('✅ [VideoChat] Participantes detectados en onParticipantsChange - cancelando detección');
                    }
                    // Reseteo estados de desconexión si hay participantes
                    if (modeloDisconnected) {
                      setModeloDisconnected(false);
                      setDisconnectionReason('');
                      setDisconnectionType('');
                      setRedirectCountdown(0);
                      setPendingRedirectAction(null);
                    }
                  } else {
                    // 🔥 SOLO INICIAR DETECCIÓN SI:
                    // 1. Había participantes antes
                    // 2. Ahora no hay participantes
                    // 3. Hay sesión activa
                    // 4. No hay una detección ya en progreso
                    const hadActiveSession = hadRemoteParticipantsRef.current || tiempo > 0 || !!otherUser;
                    if (previousCount > 0 && currentCount === 0 && connected && hadActiveSession && !modeloDisconnected && !(disconnectionReason && redirectCountdown > 0) && !isProcessingLeave && !isDetectingDisconnectionRef.current) {
                      // 🔥 USAR FUNCIÓN CENTRALIZADA CON PERÍODO DE GRACIA
                      detectPartnerDisconnection(null, false);
                    }
                  }
                  
                  // Actualizar el contador anterior
                  previousParticipantsCount.current = currentCount;
                }}
              />
            )}
            
            {/* Controles de media ocultos */}
            <MediaControlsImprovedClient 
              micEnabled={micEnabled}
              cameraEnabled={cameraEnabled}
              volumeEnabled={volumeEnabled} // ← AGREGADO
              setMicEnabled={setMicEnabled}
              setCameraEnabled={setCameraEnabled}
              setVolumeEnabled={setVolumeEnabled} // ← AGREGADO (opcional)
              userData={userData} // ← AGREGADO (opcional)
            />
            
            <div className="p-2 sm:p-4 lg:hidden mobile-video-container" style={{ 
              height: '100dvh', // 🔥 Usar dvh (dynamic viewport height) para adaptarse a la barra del navegador
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '0.5rem',
              paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' // 🔥 Espacio para el input fijo + safe area
            }}>
              {/* Header condicional basado en rol */}
              {userData?.role === 'modelo' ? (
                <HeaderModelo />
              ) : (
                <HeaderCliente />
              )}
              
              {/* MÓVIL - Layout reorganizado: Tiempo/Regalos/Controles arriba, luego video */}
              <div className="flex-1 flex flex-col" style={{ minHeight: 0, overflow: 'hidden' }}>
                {/* 🔥 TIEMPO, REGALOS Y CONTROLES ARRIBA - SOLO MÓVIL */}
                {userData?.role === 'modelo' ? (
                  <TimeDisplayImproved
                    tiempo={tiempo}
                    connected={connected}
                    otherUser={otherUser}
                    roomName={roomName}
                    userBalance={clientBalance}
                    giftBalance={clientGiftBalance}
                    remainingMinutes={clientRemainingMinutes}
                    t={t}
                    micEnabled={micEnabled}
                    setMicEnabled={handleSetMicEnabled}
                    cameraEnabled={cameraEnabled}
                    setCameraEnabled={handleSetCameraEnabled}
                    volumeEnabled={volumeEnabled}
                    setVolumeEnabled={setVolumeEnabled}
                    siguientePersona={siguientePersona}
                    finalizarChat={finalizarChat}
                    showMainSettings={showMainSettings}
                    setShowMainSettings={setShowMainSettings}
                    loading={loading || isHangingUp}
                    userData={userData}
                  />
                ) : (
                  <TimeDisplayImprovedClient
                    tiempo={tiempo}
                    connected={connected}
                    otherUser={otherUser}
                    roomName={roomName}
                    userBalance={userBalance}
                    giftBalance={giftBalance}
                    remainingMinutes={remainingMinutes}
                    t={t}
                    hardcodedTexts={hardcodedTexts}
                    micEnabled={micEnabled}
                    setMicEnabled={handleSetMicEnabled}
                    cameraEnabled={cameraEnabled}
                    setCameraEnabled={handleSetCameraEnabled}
                    volumeEnabled={volumeEnabled}
                    setVolumeEnabled={setVolumeEnabled}
                    siguientePersona={siguientePersona}
                    finalizarChat={finalizarChat}
                    showMainSettings={showMainSettings}
                    setShowMainSettings={setShowMainSettings}
                    loading={loading || isHangingUp}
                  />
                )}
                
                {/* 🔥 CONTENEDOR DE VIDEO - Después del tiempo/controles - ALTURA MÁXIMA */}
                <div className="bg-[#1f2125] rounded-2xl overflow-hidden relative mt-4 video-main-container flex-1" 
                    style={{
                      minHeight: 0, 
                      minWidth: 0,
                      flex: '1 1 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%', // 🔥 Ocupar todo el espacio disponible
                      maxHeight: '100%'
                    }}>                
                  {/* VideoDisplay condicional basado en rol - CON CHAT INTEGRADO (igual para ambos roles) */}
                  {userData?.role === 'modelo' ? (
                    <VideoDisplayImproved
                      onCameraSwitch={cambiarCamara}
                      mainCamera={camaraPrincipal}
                      connected={connected}
                      hadRemoteParticipant={otherUser !== null}
                      otherUser={otherUser}
                      isDetectingUser={isDetectingUser}
                      cameraEnabled={cameraEnabled}
                      t={t}
                      // 🔥 PROPS PARA CHAT INTEGRADO (igual que cliente)
                      messages={messages}
                      userData={userData}
                      chatVisible={chatVisible}
                      setChatVisible={setChatVisible}
                    />
                  ) : (
                    <VideoDisplayImprovedClient
                      onCameraSwitch={cambiarCamara}
                      mainCamera={camaraPrincipal}
                      connected={connected}
                      hadRemoteParticipant={otherUser !== null}
                      otherUser={otherUser}
                      isDetectingUser={isDetectingUser}
                      getDisplayName={getDisplayName}
                      apodos={apodos}
                      cameraEnabled={cameraEnabled}
                      t={t}
                      hardcodedTexts={hardcodedTexts}
                      // 🔥 PROPS PARA CHAT INTEGRADO
                      messages={messages}
                      userData={userData}
                      chatVisible={chatVisible}
                      setChatVisible={setChatVisible}
                      // 🔥 PROPS PARA ACEPTAR REGALOS EN MÓVIL
                      handleAcceptGift={handleAcceptGift}
                      giftBalance={giftBalance}
                      userBalance={userBalance}
                    />
                  )}
                </div>
                
                {/* 🔥 INPUT DE MENSAJES MÓVIL - Para ambos roles - PEGADO AL FONDO LITERAL */}
                <div className="lg:hidden mobile-chat-input-fixed" style={{
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '0.75rem 1rem',
                  paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))', // 🔥 Respetar safe area en iOS
                  backgroundColor: '#0f0f0f',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  zIndex: 50,
                  boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.3)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div className="flex items-center gap-2">
                    {/* Input de mensaje */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={hardcodedTexts.writeMessage || "Escribe tu mensaje..."}
                        maxLength={200}
                        className="
                          w-full bg-gradient-to-r from-gray-800/60 to-slate-800/60 backdrop-blur-sm 
                          rounded-xl outline-none text-white text-sm
                          border border-gray-600/30 focus:border-[#ff007a]/50 
                          transition-all duration-300 focus:bg-gray-800/80
                          placeholder-gray-400 focus:placeholder-gray-300
                          px-4 py-3
                        "
                      />
                      {/* Contador de caracteres */}
                      {mensaje.length > 150 && (
                        <div className="absolute -top-6 right-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded backdrop-blur-sm ${
                            mensaje.length > 190 
                              ? 'bg-red-500/20 text-red-300' 
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {mensaje.length}/200
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Botón de regalo */}
                    <button
                      onClick={() => setShowGiftsModal(true)}
                      disabled={!otherUser || (userData?.role === 'cliente' && (!giftBalance || giftBalance <= 0)) || (userData?.role === 'cliente' && remainingMinutes <= 2)}
                      className={`
                        relative p-3 rounded-xl transition-all duration-300 hover:scale-105 overflow-hidden shrink-0
                        ${!otherUser || (userData?.role === 'cliente' && (!giftBalance || giftBalance <= 0)) || (userData?.role === 'cliente' && remainingMinutes <= 2)
                          ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed opacity-50' 
                          : 'bg-[#ff007a]/20 text-[#ff007a] hover:bg-[#ff007a]/30 border border-[#ff007a]/30 shadow-lg'
                        }
                      `}
                      title={
                        !otherUser 
                          ? "Esperando conexión" 
                          : userData?.role === 'cliente' && remainingMinutes <= 2
                            ? "Tiempo agotado - No puedes enviar regalos"
                          : userData?.role === 'cliente' && (!giftBalance || giftBalance <= 0) 
                            ? "Necesitas monedas para enviar regalos" 
                            : userData?.role === 'modelo'
                              ? "Solicitar regalo"
                              : "Enviar regalo"
                      }
                    >
                      <Gift size={18} />
                    </button>
                    
                    {/* Botón enviar */}
                    <button
                      onClick={enviarMensaje}
                      disabled={!mensaje.trim() || isSendingMessage}
                      className={`
                        relative p-3 rounded-xl transition-all duration-300 overflow-hidden shrink-0
                        ${mensaje.trim() && !isSendingMessage
                          ? 'bg-gradient-to-r from-[#ff007a] to-[#ff007a]/80 text-white hover:scale-105 shadow-lg' 
                          : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }
                      `}
                      title="Enviar mensaje"
                    >
                      <Send size={18} />
                      {/* Efecto de brillo */}
                      {mensaje.trim() && !isSendingMessage && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* DESKTOP - Layout principal con contenedor inferior */}
              <div className="hidden lg:flex flex-col" style={{ height: 'calc(100vh - 120px)', minHeight: 0 }}>
                {/* Área de Video y Chat - Ocupa el espacio disponible arriba */}
                <div className="flex flex-row gap-6 mx-4 flex-1 mb-1" style={{ minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
                  {/* ZONA VIDEO */}
                  <div className="flex-1 bg-[#1f2125] rounded-xl lg:rounded-2xl overflow-hidden relative flex items-center justify-center video-main-container" style={{ minHeight: 0, minWidth: 0, flex: '0 1 75%' }}>
                      {/* VideoDisplay desktop condicional basado en rol */}
                      {userData?.role === 'modelo' ? (
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
                      ) : (
                        <VideoDisplayImprovedClient
                          onCameraSwitch={cambiarCamara}
                          mainCamera={camaraPrincipal}
                          connected={connected}
                          hadRemoteParticipant={otherUser !== null}
                          otherUser={otherUser}
                          isDetectingUser={isDetectingUser}
                          cameraEnabled={cameraEnabled}
                          t={t}
                          hardcodedTexts={hardcodedTexts}
                          // 🔥 PROPS PARA CHAT INTEGRADO (también en desktop)
                          messages={messages}
                          userData={userData}
                          chatVisible={chatVisible}
                          setChatVisible={setChatVisible}
                          // 🔥 PROPS PARA ACEPTAR REGALOS EN MÓVIL
                          handleAcceptGift={handleAcceptGift}
                          giftBalance={giftBalance}
                          userBalance={userBalance}
                        />
                      )}
                  </div>
                  
                  {/* PANEL DERECHO - Desktop condicional basado en rol */}
                  {userData?.role === 'modelo' ? (
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
                      playGiftSound={playGiftSound}
                      t={t}
                    />
                  ) : (
                    <DesktopChatPanelClient
                    getDisplayName={getDisplayName}
                    isDetectingUser={isDetectingUser}
                    toggleFavorite={toggleFavorite}
                    blockCurrentUser={blockCurrentUser}
                    isFavorite={isFavorite}
                    isAddingFavorite={isAddingFavorite}
                    isBlocking={isBlocking}
                    otherUser={otherUser}
                    setShowGiftsModal={setShowGiftsModal}
                    messages={messages}
                    mensaje={mensaje}
                    setMensaje={setMensaje}
                    enviarMensaje={enviarMensaje}
                    handleKeyPress={handleKeyPress}
                    userData={userData}
                    userBalance={userBalance}
                    giftBalance={giftBalance}           // Balance de GIFTS  
                    handleAcceptGift={handleAcceptGift}
                    handleRejectGift={handleRejectGift}
                    playGiftSound={playGiftSound}
                    t={t}
                    hardcodedTexts={hardcodedTexts}
                  />
                  )}
                </div>
                
                {/* Tiempo/Balance mejorado - EN LA PARTE INFERIOR con controles integrados - condicional basado en rol */}
                <div className="mx-4 mb-1 flex-shrink-0">
                  {userData?.role === 'modelo' ? (
                    <TimeDisplayImproved
                      tiempo={tiempo}
                      connected={connected}
                      otherUser={otherUser}
                      roomName={roomName}
                      userBalance={clientBalance}
                      giftBalance={clientGiftBalance}
                      remainingMinutes={clientRemainingMinutes}
                      t={t}
                      // 🔥 PROPS PARA CONTROLES INTEGRADOS
                      micEnabled={micEnabled}
                      setMicEnabled={handleSetMicEnabled}
                      cameraEnabled={cameraEnabled}
                      setCameraEnabled={handleSetCameraEnabled}
                      volumeEnabled={volumeEnabled}
                      setVolumeEnabled={setVolumeEnabled}
                      siguientePersona={siguientePersona}
                      finalizarChat={finalizarChat}
                      showMainSettings={showMainSettings}
                      setShowMainSettings={setShowMainSettings}
                      loading={loading || isHangingUp}
                      userData={userData}
                    />
                  ) : (
                    <TimeDisplayImprovedClient
                    tiempo={tiempo}
                    connected={connected}
                    otherUser={otherUser}
                    roomName={roomName}
                    userBalance={userBalance}
                    giftBalance={giftBalance}
                    remainingMinutes={remainingMinutes}
                    t={t}
                    hardcodedTexts={hardcodedTexts}
                    // 🔥 PROPS PARA CONTROLES INTEGRADOS
                    micEnabled={micEnabled}
                    setMicEnabled={handleSetMicEnabled}
                    cameraEnabled={cameraEnabled}
                    setCameraEnabled={handleSetCameraEnabled}
                    volumeEnabled={volumeEnabled}
                    setVolumeEnabled={setVolumeEnabled}
                    siguientePersona={siguientePersona}
                    finalizarChat={finalizarChat}
                    showMainSettings={showMainSettings}
                    setShowMainSettings={setShowMainSettings}
                    loading={loading || isHangingUp}
                    />
                  )}
                </div>
              </div>
            </div>
          </LiveKitRoom>
          </>
        )}

        {/* 🔥 MODAL DE SALDO BAJO DURANTE LLAMADA */}
        {showLowBalanceModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
            <div className="bg-[#2b2d31] rounded-xl p-6 max-w-md mx-4 shadow-xl border border-[#ff007a]/20">
              <div className="text-center">
                {/* Icono */}
                <div className="w-16 h-16 bg-[#ff007a]/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <svg className="w-8 h-8 text-[#ff007a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                
                {/* Título */}
                <h3 className="text-xl font-bold text-white mb-3">
                  {t('videochat.balance.lowBalanceTitle') || 'Saldo Bajo'}
                </h3>
                
                {/* Mensaje */}
                <div className="text-white/70 mb-6 leading-relaxed">
                  <p className="mb-3">
                    {t('videochat.balance.lowBalanceMessage') || 'Tu saldo ya es muy poco para seguir en la llamada'}
                  </p>
                  
                  {/* Estado actual */}
                  <div className="bg-[#1f2125] rounded-lg p-3 text-sm">
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70">Minutos restantes:</span>
                      <span className="text-[#ff007a] font-semibold">{remainingMinutes}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                      <span className="text-white/70">Mínimo requerido:</span>
                      <span className="text-yellow-400">3 minutos</span>
                    </div>
                  </div>
                </div>
                
                {/* Botones */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowLowBalanceModal(false);
                      // Terminar la llamada después de mostrar el modal
                      if (finalizarChat && connected) {
                        finalizarChat(true);
                      }
                      // Abrir modal de recarga
                      window.location.href = '/homecliente?recharge=true';
                    }}
                    className="w-full bg-[#ff007a] hover:bg-[#e6006e] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {t('videochat.balance.rechargeNow') || 'Recargar Ahora'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowLowBalanceModal(false);
                      // Terminar la llamada
                      if (finalizarChat && connected) {
                        finalizarChat(true);
                      }
                    }}
                    className="w-full bg-transparent border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {t('common.close') || 'Cerrar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}