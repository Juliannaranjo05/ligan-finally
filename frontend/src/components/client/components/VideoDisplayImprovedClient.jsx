import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParticipants, VideoTrack, useTracks, useRoomContext, useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Camera, CameraOff, Loader2, Users, Eye, MoreVertical, MessageSquare, MessageSquareOff, Gift } from "lucide-react";
import { useGlobalTranslation, GlobalTranslatedText } from '../../../contexts/GlobalTranslationContext';
import { getTranslatedGiftName, getGiftCardText } from '../../GiftSystem/giftTranslations';
import { getVideoChatText } from '../../videochatTranslations';

const VideoDisplayImprovedClient = ({ 
  onCameraSwitch, 
  mainCamera, 
  connected, 
  hadRemoteParticipant, 
  otherUser,
  isDetectingUser,
  getDisplayName,
  apodos,
  cameraEnabled,
  t,
  hardcodedTexts = {},
  // 🔥 NUEVAS PROPS PARA BOTÓN DE TRES PUNTOS
  showMainSettings = false,
  setShowMainSettings = () => {},
  showMoreMenu = false,
  setShowMoreMenu = () => {},
  // 🔥 NUEVA PROP PARA OCULTAR/MOSTRAR CHAT
  chatVisible = true,
  setChatVisible = () => {},
  // 🔥 PROPS PARA CHAT INTEGRADO
  messages = [],
  userData = null,
  // 🔥 PROPS PARA ACEPTAR REGALOS
  handleAcceptGift = null,
  giftBalance = 0,
  userBalance = 0,
  // 🔥 PROPS PARA SEGUNDO MODELO
  modelo2 = null, // { id, name, avatar, status }
  callData = null // Información completa de la llamada
}) => {
  
  // 🔥 FALLBACK A TEXTO EN ESPAÑOL SI NO HAY hardcodedTexts
  const texts = {
    yourCamera: hardcodedTexts.yourCamera || "Tu cámara"
  };
  const participants = useParticipants();
  const remoteParticipants = useRemoteParticipants();
  const localParticipant = participants.find(p => p.isLocal);
  const room = useRoomContext();
  
  // 🔥 DETECTAR SI HAY 2 MODELOS (2VS1)
  // Verificar desde callData, location.state, o sessionStorage
  const isDualCall = callData?.is_dual_call || 
                       callData?.modelo_id_2 || 
                       sessionStorage.getItem('isDualCall') === 'true';
  
  const hasSecondModel = isDualCall && (
    (callData?.modelo_id_2 && (callData?.modelo_2_status === 'accepted' || callData?.modelo_2_status === 'pending')) ||
    (callData?.modelo_2_status === 'accepted' || callData?.modelo_2_status === 'pending') ||
    remoteParticipants.length >= 2 ||
    participants.length >= 3 // Cliente + 2 modelos = 3 participantes
  );
  
  // 🔥 OBTENER PARTICIPANTES REMOTOS (2 modelos en llamada 2vs1)
  // En una llamada 2vs1, hay 2 modelos remotos + el cliente local
  const remoteParticipant1 = remoteParticipants.length > 0 
    ? remoteParticipants[0] 
    : participants.find(p => !p.isLocal && p.identity !== localParticipant?.identity);
  
  const remoteParticipant2 = hasSecondModel && remoteParticipants.length > 1
    ? remoteParticipants[1]
    : (hasSecondModel && remoteParticipants.length === 1 && participants.length > 2)
      ? participants.find(p => !p.isLocal && p.identity !== remoteParticipant1?.identity && p.identity !== localParticipant?.identity)
      : null;
  
  // Para compatibilidad, mantener remoteParticipant como el primero
  const remoteParticipant = remoteParticipant1;
  
  // 🔥 OBTENER CONTEXTO GLOBAL DE TRADUCCIÓN
  const { 
    translateGlobalText, 
    isEnabled: translationEnabled,
    getExistingTranslation,
    currentLanguage: globalCurrentLanguage
  } = useGlobalTranslation();
  
  // 🔥 OBTENER IDIOMA ACTUAL
  const currentLanguage = globalCurrentLanguage || 'es';
  
  // 🔥 ESTADOS PARA CHAT INTEGRADO
  const [chatOpacity, setChatOpacity] = useState(1);
  const lastMessageTimeRef = useRef(Date.now());
  const chatTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [translations, setTranslations] = useState(new Map());
  const [translatingIds, setTranslatingIds] = useState(new Set());
  
  // 🔥 EFECTO PARA MOSTRAR CHAT POR 3 SEGUNDOS Y LUEGO OPACAR
  useEffect(() => {
    if (!chatVisible) {
      setChatOpacity(0);
      if (chatTimeoutRef.current) {
        clearTimeout(chatTimeoutRef.current);
      }
      return;
    }

    if (messages && messages.length > 0) {
      // Cuando chat se vuelve visible, mostrar todos los mensajes inmediatamente
      setChatOpacity(1);
      if (chatTimeoutRef.current) {
        clearTimeout(chatTimeoutRef.current);
      }
      chatTimeoutRef.current = setTimeout(() => {
        setChatOpacity(0.3);
      }, 3000);
    }
    
    return () => {
      if (chatTimeoutRef.current) {
        clearTimeout(chatTimeoutRef.current);
      }
    };
  }, [messages, chatVisible]);

  // 🔥 EFECTO PARA SCROLL AUTOMÁTICO AL FINAL (ÚLTIMO MENSAJE)
  useEffect(() => {
    if (messagesEndRef.current && chatVisible) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, chatVisible]);

  // 🔥 REFS PARA TRADUCCIONES (para evitar dependencias en useCallback)
  const translationsRef = useRef(new Map());
  const translatingIdsRef = useRef(new Set());

  // Sincronizar refs con estados
  useEffect(() => {
    translationsRef.current = translations;
  }, [translations]);

  useEffect(() => {
    translatingIdsRef.current = translatingIds;
  }, [translatingIds]);

  // 🔥 FUNCIÓN PARA TRADUCIR MENSAJES
  const translateMessage = useCallback(async (message) => {
    if (!translationEnabled || !message?.id) return;
    
    const originalText = message.text || message.message;
    if (!originalText || originalText.trim() === '') return;

    if (translationsRef.current.has(message.id) || translatingIdsRef.current.has(message.id)) return;

    setTranslatingIds(prev => new Set(prev).add(message.id));

    try {
      let result = null;
      
      if (typeof translateGlobalText === 'function') {
        try {
          result = await translateGlobalText(originalText, message.id);
        } catch (error) {
          console.warn('Error traduciendo mensaje:', error);
        }
      }
      
      if (result && result !== originalText && result.trim() !== '') {
        setTranslations(prev => new Map(prev).set(message.id, result));
      } else {
        setTranslations(prev => new Map(prev).set(message.id, null));
      }
    } catch (error) {
      setTranslations(prev => new Map(prev).set(message.id, null));
    } finally {
      setTranslatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(message.id);
        return newSet;
      });
    }
  }, [translationEnabled, translateGlobalText]);

  // 🔥 EFECTO PARA TRADUCIR MENSAJES AUTOMÁTICAMENTE
  useEffect(() => {
    if (!translationEnabled) return;

    const messagesToTranslate = messages.filter(message => {
      return (
        message.type !== 'system' && 
        !['gift_request', 'gift_sent', 'gift_received', 'gift'].includes(message.type) &&
        !translationsRef.current.has(message.id) &&
        !translatingIdsRef.current.has(message.id) &&
        (message.text || message.message) &&
        (message.text || message.message).trim() !== ''
      );
    });

    messagesToTranslate.forEach((message, index) => {
      setTimeout(() => {
        translateMessage(message);
      }, index * 100);
    });

  }, [messages, translationEnabled, translateMessage]);

  // 🔥 FUNCIÓN PARA DETECTAR SI ES MENSAJE DE REGALO
  const isGiftMessage = useCallback((msg) => {
    return msg.type === 'gift_sent' || 
           msg.type === 'gift_received' || 
           msg.type === 'gift_request' ||
           (msg.text && (msg.text.includes('Enviaste:') || msg.text.includes('Recibiste:') || msg.text.includes('Solicitud de regalo'))) ||
           (msg.message && (msg.message.includes('Enviaste:') || msg.message.includes('Recibiste:') || msg.message.includes('Solicitud de regalo'))) ||
           (msg.gift_data && Object.keys(msg.gift_data).length > 0) ||
           (msg.extra_data && (typeof msg.extra_data === 'object' && (msg.extra_data.gift_name || msg.extra_data.gift_image)));
  }, []);

  // 🔥 FUNCIÓN PARA PARSEAR DATOS DE REGALO
  const parseGiftData = useCallback((msg) => {
    let giftData = {};
    
    // Intentar obtener de gift_data
    if (msg.gift_data) {
      try {
        giftData = typeof msg.gift_data === 'string' ? JSON.parse(msg.gift_data) : msg.gift_data;
      } catch (e) {
        // Si falla el parse, intentar como objeto directo
        giftData = msg.gift_data;
      }
    }
    
    // Intentar obtener de extra_data
    if (msg.extra_data) {
      try {
        const extraData = typeof msg.extra_data === 'string' ? JSON.parse(msg.extra_data) : msg.extra_data;
        giftData = { ...giftData, ...extraData };
      } catch (e) {
        // Si falla el parse, intentar como objeto directo
        if (typeof msg.extra_data === 'object') {
          giftData = { ...giftData, ...msg.extra_data };
        }
      }
    }
    
    // Si no hay datos, intentar parsear del texto del mensaje
    const text = msg.text || msg.message || '';
    if (text && (!giftData.gift_name || !giftData.gift_image)) {
      // Buscar nombre del regalo en el texto (ej: "¡Moño Elegante para ti!")
      const giftNameMatch = text.match(/(?:¡|!)?([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)(?:\s+para\s+ti[!:]|$)/);
      if (giftNameMatch) {
        giftData.gift_name = giftNameMatch[1].trim();
      }
      
      // También buscar en formatos "Enviaste: Nombre" o "Recibiste: Nombre"
      const sentReceivedMatch = text.match(/(?:Enviaste:|Recibiste:)\s*(.+?)(?:\s*[!💝❤️]|$)/);
      if (sentReceivedMatch) {
        giftData.gift_name = sentReceivedMatch[1].trim();
      }
    }
    
    return {
      gift_name: giftData.gift_name || 'Regalo Especial',
      gift_price: giftData.gift_price || 10,
      gift_image: giftData.gift_image || null,
      request_id: giftData.request_id || giftData.transaction_id || null,
      transaction_id: giftData.transaction_id || giftData.request_id || null,
      security_hash: giftData.security_hash || giftData.securityHash || null,
      ...giftData
    };
  }, []);

  // 🔥 FUNCIÓN PARA CONSTRUIR URL DE IMAGEN COMPLETA
  const buildCompleteImageUrl = useCallback((imagePath) => {
    if (!imagePath) return null;
    
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath.includes('?') ? imagePath : imagePath;
    }
    
    const cleanPath = imagePath.replace(/\\/g, '/');
    let finalUrl;
    let fileName;
    
    if (cleanPath.startsWith('storage/')) {
      const pathParts = cleanPath.split('/');
      fileName = pathParts.pop();
      const directory = pathParts.join('/');
      const encodedFileName = encodeURIComponent(fileName);
      finalUrl = `${cleanBaseUrl}/${directory}/${encodedFileName}`;
    } else if (cleanPath.startsWith('/')) {
      const pathParts = cleanPath.split('/');
      fileName = pathParts.pop();
      const directory = pathParts.join('/');
      const encodedFileName = encodeURIComponent(fileName);
      finalUrl = `${cleanBaseUrl}${directory}/${encodedFileName}`;
    } else {
      fileName = cleanPath;
      const encodedFileName = encodeURIComponent(cleanPath);
      finalUrl = `${cleanBaseUrl}/storage/gifts/${encodedFileName}`;
    }
    
    const version = fileName ? encodeURIComponent(fileName).substring(0, 20) : Date.now();
    return `${finalUrl}?v=${version}`;
  }, []);

  // 🔥 FUNCIÓN PARA RENDERIZAR MENSAJE CON TRADUCCIÓN
  const renderMessageWithTranslation = useCallback((message) => {
    const originalText = message.text || message.message;
    const translatedText = translations.get(message.id);
    const isTranslating = translatingIds.has(message.id);
    
    const hasTranslation = translatedText && translatedText !== originalText && translatedText.trim() !== '';

    return (
      <div style={{ maxWidth: '100%', width: '100%', wordBreak: 'break-word', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
        <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
          {originalText}
          {isTranslating && (
            <span className="ml-2 inline-flex items-center">
              <div className="animate-spin rounded-full h-2 w-2 border-b border-current opacity-50"></div>
            </span>
          )}
        </div>

        {hasTranslation && (
          <div className="text-xs italic text-gray-400 border-l-2 border-gray-500 pl-2 mt-1" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
            {translatedText}
          </div>
        )}
      </div>
    );
  }, [translations, translatingIds]);
  
  // 🔥 SOLUCIÓN SIMPLIFICADA: Usar solo useTracks (LiveKit maneja todo automáticamente)
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ], { onlySubscribed: false });

  // 🔥 OBTENER TRACKS DE FORMA SIMPLE Y CONFIABLE (MEJORADO)
  const localVideoTrack = useMemo(() => {
    if (!tracks || tracks.length === 0 || !localParticipant) return null;
    
    // Buscar en todos los tracks
    for (const trackRef of tracks) {
      if (trackRef.participant?.sid === localParticipant.sid && 
          trackRef.source === Track.Source.Camera) {
        // Verificar si tiene track directamente o en publication
        if (trackRef.track) {
          return trackRef;
        }
        // Si no tiene track pero tiene publication con track, usar ese
        if (trackRef.publication?.track) {
          return {
            ...trackRef,
            track: trackRef.publication.track
          };
        }
      }
    }
    return null;
  }, [tracks, localParticipant?.sid]);

  const remoteVideoTrack = useMemo(() => {
    if (!tracks || tracks.length === 0 || !remoteParticipant) return null;
    
    // Buscar en todos los tracks
    for (const trackRef of tracks) {
      if (trackRef.participant?.sid === remoteParticipant.sid && 
          trackRef.source === Track.Source.Camera) {
        // Verificar si tiene track directamente o en publication
        if (trackRef.track) {
          return trackRef;
        }
        // Si no tiene track pero tiene publication con track, usar ese
        if (trackRef.publication?.track) {
          return {
            ...trackRef,
            track: trackRef.publication.track
          };
        }
      }
    }
    return null;
  }, [tracks, remoteParticipant?.sid]);

  // 🔥 FALLBACK: Buscar tracks directamente en publicaciones si no están en useTracks
  const localTrackFromPublication = useMemo(() => {
    if (localVideoTrack) return null; // Ya tenemos track de useTracks
    
    if (localParticipant?.videoTrackPublications) {
      for (const [trackSid, publication] of localParticipant.videoTrackPublications.entries()) {
        if (publication?.source === Track.Source.Camera && publication.track && publication.isEnabled !== false) {
          return {
            participant: localParticipant,
            publication: publication,
            source: Track.Source.Camera,
            track: publication.track
          };
        }
      }
    }
    return null;
  }, [localParticipant, localVideoTrack]);

  const remoteTrackFromPublication = useMemo(() => {
    if (remoteVideoTrack) return null; // Ya tenemos track de useTracks
    
    if (remoteParticipant?.videoTrackPublications) {
      for (const [trackSid, publication] of remoteParticipant.videoTrackPublications.entries()) {
        if (publication?.source === Track.Source.Camera && publication.track && publication.isEnabled !== false) {
          return {
            participant: remoteParticipant,
            publication: publication,
            source: Track.Source.Camera,
            track: publication.track
          };
        }
      }
    }
    return null;
  }, [remoteParticipant, remoteVideoTrack]);
  
  // 🔥 OBTENER TRACKS DE VIDEO DE LOS DOS PARTICIPANTES REMOTOS (PARA 2VS1)
  const remoteVideoTrack1 = useMemo(() => {
    if (!tracks || tracks.length === 0 || !remoteParticipant1) return null;
    
    for (const trackRef of tracks) {
      if (trackRef.participant?.sid === remoteParticipant1.sid && 
          trackRef.source === Track.Source.Camera) {
        if (trackRef.track) {
          return trackRef;
        }
        if (trackRef.publication?.track) {
          return {
            ...trackRef,
            track: trackRef.publication.track
          };
        }
      }
    }
    return null;
  }, [tracks, remoteParticipant1?.sid]);
  
  const remoteVideoTrack2 = useMemo(() => {
    if (!tracks || tracks.length === 0 || !remoteParticipant2) return null;
    
    for (const trackRef of tracks) {
      if (trackRef.participant?.sid === remoteParticipant2.sid && 
          trackRef.source === Track.Source.Camera) {
        if (trackRef.track) {
          return trackRef;
        }
        if (trackRef.publication?.track) {
          return {
            ...trackRef,
            track: trackRef.publication.track
          };
        }
      }
    }
    return null;
  }, [tracks, remoteParticipant2?.sid]);

  // 🔥 USAR TRACKS DISPONIBLES (priorizar useTracks, luego publicaciones)
  const finalLocalTrack = localVideoTrack || localTrackFromPublication;
  const finalRemoteTrack = remoteVideoTrack || remoteTrackFromPublication;

  // 🔥 EFECTO PARA APLICAR ESTILOS RESPONSIVE A TODOS LOS VIDEOS (AGRESIVO CON DEBUG)
  useEffect(() => {
    const applyResponsiveStyles = () => {
      // #region agent log
      // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImprovedClient.jsx:122',message:'applyResponsiveStyles ejecutándose',data:{hasLocalTrack:!!finalLocalTrack,hasRemoteTrack:!!finalRemoteTrack,connected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Buscar TODOS los contenedores de video
      const videoContainers = document.querySelectorAll('.video-main-container');
      
      // #region agent log
      // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImprovedClient.jsx:127',message:'Contenedores encontrados',data:{containerCount:videoContainers.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      videoContainers.forEach((container, idx) => {
        if (container && container instanceof HTMLElement) {
          // #region agent log
          // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImprovedClient.jsx:132',message:'Procesando contenedor',data:{idx,containerWidth:container.offsetWidth,containerHeight:container.offsetHeight,scrollWidth:container.scrollWidth,scrollHeight:container.scrollHeight,hasOverflow:container.scrollWidth > container.offsetWidth || container.scrollHeight > container.offsetHeight,computedOverflow:window.getComputedStyle(container).overflow},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // Aplicar overflow-hidden al contenedor
          container.style.overflow = 'hidden';
          container.style.minHeight = '0';
          container.style.minWidth = '0';
          
          // Buscar todos los videos dentro
          const videos = container.querySelectorAll('video');
          
          // #region agent log
          // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImprovedClient.jsx:142',message:'Videos encontrados en contenedor',data:{videoCount:videos.length,containerIdx:idx},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          videos.forEach((video, videoIdx) => {
            if (video && video instanceof HTMLVideoElement) {
              // #region agent log
              const beforeStyles = {
                width:video.style.width || window.getComputedStyle(video).width,
                height:video.style.height || window.getComputedStyle(video).height,
                objectFit:video.style.objectFit || window.getComputedStyle(video).objectFit,
                offsetWidth:video.offsetWidth,
                offsetHeight:video.offsetHeight,
                scrollWidth:video.scrollWidth,
                scrollHeight:video.scrollHeight,
                clientWidth:video.clientWidth,
                clientHeight:video.clientHeight
              };
              // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImprovedClient.jsx:153',message:'Antes de aplicar estilos',data:{videoIdx,containerIdx:idx,beforeStyles},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              
              // Estilos críticos con !important usando setProperty
              video.style.setProperty('width', '100%', 'important');
              video.style.setProperty('height', '100%', 'important');
              video.style.setProperty('object-fit', 'contain', 'important');
              video.style.setProperty('max-width', '100%', 'important');
              video.style.setProperty('max-height', '100%', 'important');
              video.style.setProperty('display', 'block', 'important');
              
              // #region agent log
              setTimeout(() => {
                const afterStyles = {
                  computedWidth:window.getComputedStyle(video).width,
                  computedHeight:window.getComputedStyle(video).height,
                  computedObjectFit:window.getComputedStyle(video).objectFit,
                  computedMaxWidth:window.getComputedStyle(video).maxWidth,
                  computedMaxHeight:window.getComputedStyle(video).maxHeight,
                  offsetWidth:video.offsetWidth,
                  offsetHeight:video.offsetHeight,
                  scrollWidth:video.scrollWidth,
                  scrollHeight:video.scrollHeight,
                  hasOverflow:video.scrollWidth > video.offsetWidth || video.scrollHeight > video.offsetHeight || video.offsetWidth > container.offsetWidth || video.offsetHeight > container.offsetHeight
                };
                // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImprovedClient.jsx:169',message:'Después de aplicar estilos',data:{videoIdx,containerIdx:idx,afterStyles,containerWidth:container.offsetWidth,containerHeight:container.offsetHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              }, 50);
              // #endregion
            }
          });
          
          // #region agent log
          setTimeout(() => {
            const finalContainerState = {
              offsetWidth:container.offsetWidth,
              offsetHeight:container.offsetHeight,
              scrollWidth:container.scrollWidth,
              scrollHeight:container.scrollHeight,
              hasScrollbars:container.scrollWidth > container.offsetWidth || container.scrollHeight > container.offsetHeight,
              computedOverflow:window.getComputedStyle(container).overflow
            };
            // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImprovedClient.jsx:182',message:'Estado final del contenedor',data:{containerIdx:idx,finalContainerState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          }, 100);
          // #endregion
        }
      });
    };

    // Aplicar estilos inmediatamente y frecuentemente
    applyResponsiveStyles();
    const interval = setInterval(applyResponsiveStyles, 500); // Reducido para logs

    return () => clearInterval(interval);
  }, [finalLocalTrack, finalRemoteTrack, connected]);

  // 🔥 SUSCRIBIRSE AUTOMÁTICAMENTE A TRACKS REMOTOS NO SUSCRITOS
  useEffect(() => {
    if (!connected || !room || room.state !== 'connected' || !remoteParticipant) {
      return;
    }

    // Si tenemos publicación pero no track suscrito, forzar suscripción
    if (remoteParticipant.videoTrackPublications) {
      for (const [trackSid, publication] of remoteParticipant.videoTrackPublications.entries()) {
        if (publication?.source === Track.Source.Camera && 
            publication.trackSid && 
            !publication.isSubscribed &&
            publication.isEnabled !== false) {
          
          
          // Intentar suscribirse usando múltiples métodos
          const subscribeRemoteTrack = async () => {
            try {
              // Método 1: participant.setSubscribed
              if (remoteParticipant.setSubscribed && typeof remoteParticipant.setSubscribed === 'function') {
                await remoteParticipant.setSubscribed(trackSid, true);
              }
            } catch (err1) {
              try {
                // Método 2: room.setSubscribed
                if (room.setSubscribed && typeof room.setSubscribed === 'function') {
                  await room.setSubscribed(trackSid, true);
                }
              } catch (err2) {
              }
            }
          };
          
          subscribeRemoteTrack();
          break; // Solo suscribirse al primer track de cámara no suscrito
        }
      }
    }
  }, [connected, room?.state, remoteParticipant, finalRemoteTrack]);

  // 🔥 FORZAR PUBLICACIÓN DE CÁMARA LOCAL SI ESTÁ HABILITADA (CON RETRY PERIÓDICO)
  useEffect(() => {
    if (!connected || !room || room.state !== 'connected' || !cameraEnabled || !localParticipant) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 5;

    const checkAndForceCamera = () => {
      // Verificar si hay publicación de cámara
      let hasCameraPublication = false;
      let hasActiveTrack = false;
      
      if (localParticipant.videoTrackPublications) {
        for (const [trackSid, publication] of localParticipant.videoTrackPublications.entries()) {
          if (publication?.source === Track.Source.Camera) {
            hasCameraPublication = true;
            if (publication.track && publication.isEnabled !== false) {
              hasActiveTrack = true;
              break;
            }
          }
        }
      }

      // Si cameraEnabled es true pero no hay track activo, forzar publicación
      if (cameraEnabled && (!hasCameraPublication || !hasActiveTrack || !finalLocalTrack) && retryCount < maxRetries) {
        retryCount++;
        
        if (localParticipant.setCameraEnabled && typeof localParticipant.setCameraEnabled === 'function') {
          localParticipant.setCameraEnabled(true).catch(err => {
          });
          
          // Reintentar si aún no hay track después de 2 segundos
          if (retryCount < maxRetries) {
            setTimeout(checkAndForceCamera, 2000);
          }
        }
      } else if (hasActiveTrack && finalLocalTrack) {
        // Si ya tenemos track activo, no hacer nada más
        retryCount = maxRetries;
      }
    };

    // Ejecutar inmediatamente y luego cada 2 segundos hasta que tengamos track
    checkAndForceCamera();
    const interval = setInterval(() => {
      if (retryCount < maxRetries && (!finalLocalTrack || !localParticipant.videoTrackPublications?.size)) {
        checkAndForceCamera();
      } else {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [connected, room?.state, cameraEnabled, localParticipant, finalLocalTrack]);

  // 🔥 LOG DE DIAGNÓSTICO (throttled)
  const lastLogRef = React.useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastLogRef.current < 3000) return; // Log cada 3 segundos
    lastLogRef.current = now;
    console.log('🔍 [diagnostic]', {
      totalTracks: tracks.length,
      hasLocalTrack: !!localVideoTrack,
      hasRemoteTrack: !!remoteVideoTrack,
      hasLocalFromPub: !!localTrackFromPublication,
      hasRemoteFromPub: !!remoteTrackFromPublication,
      cameraEnabled,
      localParticipantSid: localParticipant?.sid,
      remoteParticipantSid: remoteParticipant?.sid,
      roomState: room?.state
    });
  }, [tracks.length, localVideoTrack, remoteVideoTrack, localTrackFromPublication, remoteTrackFromPublication, cameraEnabled, localParticipant?.sid, remoteParticipant?.sid, room?.state]);

  // 🔥 FUNCIÓN PARA RENDERIZAR VIDEO CON VideoTrack (RESPONSIVE Y CONFIABLE)
  const renderVideoTrack = (trackRef, overlayText, overlayColor = "green", showOnTop = false) => {
    if (!trackRef || !trackRef.track) return null;

    return (
      <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] overflow-hidden" style={{ minHeight: 0, minWidth: 0, position: 'relative' }}>
        <VideoTrack
          trackRef={trackRef}
          className="w-full h-full"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
          }}
        />
        {overlayText && (
          <div className={`absolute ${showOnTop ? 'top-4' : 'bottom-4'} left-4 z-20`}>
            <div className={`bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border ${overlayColor === "green" ? "border-green-400/30" : "border-[#ff007a]/30"}`}>
              <div className="flex items-center gap-2">
                {overlayColor === "green" && (
                  <div className="w-2 h-2 bg-[#00ff66] rounded-full animate-pulse"></div>
                )}
                {overlayColor === "pink" && (
                  <div className="w-2 h-2 bg-[#ff007a] rounded-full animate-pulse"></div>
                )}
                <span className={`text-sm font-semibold ${overlayColor === "green" ? "text-[#00ff66]" : "text-[#ff007a]"}`}>
                  {overlayText}
                </span>
              </div>
            </div>
          </div>
        )}
        {/* 🔥 BOTONES DE TRES PUNTOS Y OCULTAR CHAT - En la esquina superior derecha cuando hay video (modelo o tu cámara) - SOLO MÓVIL */}
        {showOnTop && overlayText && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 flex lg:hidden">
            {/* Botón para ocultar/mostrar chat */}
            <button
              onClick={() => {
                if (typeof setChatVisible === 'function') {
                  setChatVisible(!chatVisible);
                }
              }}
              className={`
                bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm 
                px-3 py-1.5 rounded-lg border border-gray-500/30
                hover:border-gray-400/50 transition-all duration-200
                ${!chatVisible ? 'border-[#ff007a]/50 bg-[#ff007a]/10' : ''}
              `}
              title={chatVisible ? "Ocultar chat" : "Mostrar chat"}
            >
              {chatVisible ? (
                <MessageSquareOff size={16} className="text-gray-400" />
              ) : (
                <MessageSquare size={16} className="text-[#ff007a]" />
              )}
            </button>
            
            {/* Botón de tres puntos */}
            <button
              onClick={() => {
                // 🔥 Abrir el menú de más opciones (Quitar favorito, Bloquear, etc.)
                if (typeof setShowMoreMenu === 'function') {
                  setShowMoreMenu(!showMoreMenu);
                }
              }}
              className={`
                bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm 
                px-3 py-1.5 rounded-lg border border-gray-500/30
                hover:border-gray-400/50 transition-all duration-200
                ${showMainSettings ? 'border-[#ff007a]/50 bg-[#ff007a]/10' : ''}
              `}
              title="Más opciones"
            >
              <MoreVertical 
                size={16} 
                className={showMoreMenu ? 'text-[#ff007a]' : 'text-gray-400'} 
              />
            </button>
          </div>
        )}
      </div>
    );
  };

  // 🔥 RENDERIZAR VIDEO PRINCIPAL (SIMPLE Y DIRECTÓ)
  const getMainVideo = () => {
    try {
      // 🔥 LAYOUT PARA 2 MODELOS (2vs1) - CLIENTE ARRIBA, 2 MODELOS ABAJO
      // Mostrar layout 2vs1 si es llamada dual O si hay 2+ participantes remotos
      const shouldShow2vs1Layout = isDualCall || remoteParticipants.length >= 2 || participants.length >= 3;
      
      if (shouldShow2vs1Layout && (hasSecondModel || remoteParticipants.length >= 2)) {
        const modelo1Name = otherUser?.name || remoteParticipant1?.name || 'Modelo 1';
        const modelo2Name = modelo2?.name || remoteParticipant2?.name || 'Modelo 2';
        
        console.log('🎥 [VideoDisplay] Renderizando layout 2vs1:', {
          hasSecondModel,
          isDualCall,
          remoteParticipantsCount: remoteParticipants.length,
          participantsCount: participants.length,
          modelo1Name,
          modelo2Name,
          remoteParticipant1: remoteParticipant1?.identity,
          remoteParticipant2: remoteParticipant2?.identity,
          hasRemoteTrack1: !!remoteVideoTrack1,
          hasRemoteTrack2: !!remoteVideoTrack2,
          allTracksCount: tracks.length
        });
        
        return (
          <div className="w-full h-full flex flex-col gap-3 p-3 bg-gradient-to-b from-[#0a0d10] to-[#131418]">
            {/* 🔥 CLIENTE ARRIBA (PANTALLA GRANDE - 2/3 DEL ESPACIO) */}
            {finalLocalTrack && (
              <div className="relative h-2/3 rounded-xl overflow-hidden border-3 border-[#ff007a] shadow-lg shadow-[#ff007a]/20 bg-gray-900 min-h-0">
                <VideoTrack
                  trackRef={finalLocalTrack}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg z-10 border border-[#ff007a]/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-[#ff007a] rounded-full animate-pulse shadow-lg shadow-[#ff007a]/50"></div>
                    <span className="text-sm font-bold text-white">Tú</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* 🔥 2 MODELOS ABAJO (LADO A LADO - 1/3 DEL ESPACIO CADA UNO) */}
            <div className="grid grid-cols-2 gap-3 h-1/3 min-h-[180px]">
              {/* Modelo 1 - Borde Verde */}
              <div className="relative rounded-xl overflow-hidden border-3 border-green-400 shadow-lg shadow-green-400/20 bg-gray-900">
                {remoteVideoTrack1 ? (
                  <VideoTrack
                    trackRef={remoteVideoTrack1}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-green-400" size={40} />
                      <span className="text-xs text-green-400 font-medium">Conectando...</span>
                    </div>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg z-10 border border-green-400/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50"></div>
                    <span className="text-xs font-semibold text-white truncate max-w-[120px]">{modelo1Name}</span>
                  </div>
                </div>
              </div>
              
              {/* Modelo 2 - Borde Azul */}
              <div className="relative rounded-xl overflow-hidden border-3 border-blue-400 shadow-lg shadow-blue-400/20 bg-gray-900">
                {remoteVideoTrack2 ? (
                  <VideoTrack
                    trackRef={remoteVideoTrack2}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-blue-400" size={40} />
                      <span className="text-xs text-blue-400 font-medium">Conectando...</span>
                    </div>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg z-10 border border-blue-400/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"></div>
                    <span className="text-xs font-semibold text-white truncate max-w-[120px]">{modelo2Name}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      // 🔥 LAYOUT ALTERNATIVO: Si solo hay 1 modelo pero se espera el segundo
      if (isDualCall && remoteParticipant1 && !remoteParticipant2) {
        const modelo1Name = otherUser?.name || remoteParticipant1?.name || 'Modelo 1';
        
        return (
          <div className="w-full h-full flex flex-col gap-3 p-3 bg-gradient-to-b from-[#0a0d10] to-[#131418]">
            {/* Cliente arriba (2/3 del espacio) */}
            {finalLocalTrack && (
              <div className="relative h-2/3 rounded-xl overflow-hidden border-3 border-[#ff007a] shadow-lg shadow-[#ff007a]/20 bg-gray-900 min-h-0">
                <VideoTrack
                  trackRef={finalLocalTrack}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg z-10 border border-[#ff007a]/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-[#ff007a] rounded-full animate-pulse shadow-lg shadow-[#ff007a]/50"></div>
                    <span className="text-sm font-bold text-white">Tú</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Modelo 1 y espacio para modelo 2 (1/3 del espacio) */}
            <div className="grid grid-cols-2 gap-3 h-1/3 min-h-[180px]">
              {/* Modelo 1 - Borde Verde */}
              <div className="relative rounded-xl overflow-hidden border-3 border-green-400 shadow-lg shadow-green-400/20 bg-gray-900">
                {remoteVideoTrack1 ? (
                  <VideoTrack
                    trackRef={remoteVideoTrack1}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-green-400" size={40} />
                      <span className="text-xs text-green-400 font-medium">Conectando...</span>
                    </div>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg z-10 border border-green-400/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50"></div>
                    <span className="text-xs font-semibold text-white truncate max-w-[120px]">{modelo1Name}</span>
                  </div>
                </div>
              </div>
              
              {/* Espacio para modelo 2 (pendiente) - Borde Azul con estilo */}
              <div className="relative rounded-xl overflow-hidden border-3 border-blue-400/30 border-dashed shadow-lg shadow-blue-400/10 bg-gray-900/50 flex items-center justify-center">
                <div className="text-center p-4">
                  <Loader2 className="animate-spin text-blue-400 mx-auto mb-3" size={40} />
                  <p className="text-xs text-blue-400 font-medium">Esperando modelo 2...</p>
                  <p className="text-xs text-gray-500 mt-1">Invitación pendiente</p>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      // Si mainCamera es "local", mostrar cámara del cliente
      if (mainCamera === "local" && localParticipant) {
        if (finalLocalTrack) {
          return renderVideoTrack(finalLocalTrack, texts.yourCamera, "pink", true); // showOnTop = true
        }
        
        // Si no hay track pero cameraEnabled es true, mostrar carga
        if (cameraEnabled) {
          return (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative">
              {/* Nombre arriba */}
              <div className="absolute top-4 left-4 z-20">
                <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#ff007a]/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#ff007a] rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-[#ff007a]">{texts.yourCamera}</span>
                  </div>
                </div>
              </div>
              {/* 🔥 BOTONES DE TRES PUNTOS Y OCULTAR CHAT - En la esquina superior derecha - SOLO MÓVIL */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2 flex lg:hidden">
                {/* Botón para ocultar/mostrar chat */}
                <button
                  onClick={() => {
                    if (typeof setChatVisible === 'function') {
                      setChatVisible(!chatVisible);
                    }
                  }}
                  className={`
                    bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm 
                    px-3 py-1.5 rounded-lg border border-gray-500/30
                    hover:border-gray-400/50 transition-all duration-200
                    ${!chatVisible ? 'border-[#ff007a]/50 bg-[#ff007a]/10' : ''}
                  `}
                  title={chatVisible ? "Ocultar chat" : "Mostrar chat"}
                >
                  {chatVisible ? (
                    <MessageSquareOff size={16} className="text-gray-400" />
                  ) : (
                    <MessageSquare size={16} className="text-[#ff007a]" />
                  )}
                </button>
                
                {/* Botón de tres puntos */}
                <button
                  onClick={() => {
                    // 🔥 Abrir el menú de más opciones (Quitar favorito, Bloquear, etc.)
                    if (typeof setShowMoreMenu === 'function') {
                      setShowMoreMenu(!showMoreMenu);
                    }
                  }}
                  className={`
                    bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm 
                    px-3 py-1.5 rounded-lg border border-gray-500/30
                    hover:border-gray-400/50 transition-all duration-200
                    ${showMoreMenu ? 'border-[#ff007a]/50 bg-[#ff007a]/10' : ''}
                  `}
                  title="Más opciones"
                >
                  <MoreVertical 
                    size={16} 
                    className={showMoreMenu ? 'text-[#ff007a]' : 'text-gray-400'} 
                  />
                </button>
              </div>
              <div className="text-center text-gray-400">
                <Loader2 className="animate-spin mx-auto mb-2" size={48} />
                <p>{getVideoChatText('startingCamera', currentLanguage, 'Iniciando cámara...')}</p>
              </div>
            </div>
          );
        }
        
        // Si cameraEnabled es false, mostrar cámara apagada
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418]">
            <div className="text-center">
              <CameraOff className="mx-auto mb-4 text-gray-500" size={64} />
              <p className="text-gray-500">{getVideoChatText('cameraOff', currentLanguage, 'Cámara apagada')}</p>
            </div>
          </div>
        );
      }
      
      // Por defecto, mostrar video de la modelo (remote)
      if (remoteParticipant) {
        if (finalRemoteTrack) {
          const displayName = (() => {
            if (typeof getDisplayName === 'function') {
              try {
                return getDisplayName();
              } catch (error) {
              }
            }
            if (otherUser) {
              const nickname = apodos?.[otherUser.id];
              return nickname || otherUser.name || otherUser.display_name || getVideoChatText('model', currentLanguage, 'Modelo');
            }
            return getVideoChatText('model', currentLanguage, 'Modelo');
          })();
          
          return renderVideoTrack(finalRemoteTrack, displayName, "green", true); // showOnTop = true
        }
        
        // Si hay participante remoto pero no hay track, mostrar carga
        const displayName = (() => {
          if (typeof getDisplayName === 'function') {
            try {
              return getDisplayName();
            } catch (error) {
            }
          }
          if (otherUser) {
            const nickname = apodos?.[otherUser.id];
            return nickname || otherUser.name || otherUser.display_name || getVideoChatText('model', currentLanguage, 'Modelo');
          }
          return getVideoChatText('model', currentLanguage, 'Modelo');
        })();
        
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative">
            {/* Nombre arriba */}
            <div className="absolute top-4 left-4 z-20">
              <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-green-400/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#00ff66] rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-[#00ff66]">{displayName}</span>
                </div>
              </div>
            </div>
            {/* 🔥 BOTONES DE TRES PUNTOS Y OCULTAR CHAT - En la esquina superior derecha - SOLO MÓVIL */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 flex lg:hidden">
              {/* Botón para ocultar/mostrar chat */}
              <button
                onClick={() => {
                  if (typeof setChatVisible === 'function') {
                    setChatVisible(!chatVisible);
                  }
                }}
                className={`
                  bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm 
                  px-3 py-1.5 rounded-lg border border-gray-500/30
                  hover:border-gray-400/50 transition-all duration-200
                  ${!chatVisible ? 'border-[#ff007a]/50 bg-[#ff007a]/10' : ''}
                `}
                title={chatVisible ? "Ocultar chat" : "Mostrar chat"}
              >
                {chatVisible ? (
                  <MessageSquareOff size={16} className="text-gray-400" />
                ) : (
                  <MessageSquare size={16} className="text-[#ff007a]" />
                )}
              </button>
              
              {/* Botón de tres puntos */}
              <button
                onClick={() => {
                  if (typeof setShowMainSettings === 'function') {
                    setShowMainSettings(!showMainSettings);
                  }
                }}
                className={`
                  bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm 
                  px-3 py-1.5 rounded-lg border border-gray-500/30
                  hover:border-gray-400/50 transition-all duration-200
                  ${showMoreMenu ? 'border-[#ff007a]/50 bg-[#ff007a]/10' : ''}
                `}
                title="Más opciones"
              >
                <MoreVertical 
                  size={16} 
                  className={showMainSettings ? 'text-[#ff007a]' : 'text-gray-400'} 
                />
              </button>
            </div>
            <div className="text-center text-gray-400">
              <Loader2 className="animate-spin mx-auto mb-2" size={48} />
              <p>{getVideoChatText('waitingForModelVideo', currentLanguage, 'Esperando video de la modelo...')}</p>
            </div>
          </div>
        );
      }
      
      // Si no hay participante remoto, mostrar estado de espera
      let status;
      if (participants.length === 1 && localParticipant && !remoteParticipant && !hadRemoteParticipant) {
        status = {
          icon: <Users size={48} className="text-[#ff007a]" />,
          title: getVideoChatText('waitingForModel', currentLanguage, 'Esperando modelo'),
          subtitle: getVideoChatText('roomReadyToConnect', currentLanguage, 'Sala lista para conectar'),
          bgColor: 'from-[#ff007a]/10 to-[#ff007a]/5',
          borderColor: 'border-[#ff007a]/20'
        };
      } else {
        status = {
          icon: <Loader2 size={48} className="text-[#ff007a] animate-spin" />,
          title: 'Conectando...',
          subtitle: 'Verificando conexión en tiempo real',
          bgColor: 'from-[#ff007a]/10 to-[#ff007a]/5',
          borderColor: 'border-[#ff007a]/20'
        };
      }

      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 opacity-30">
            <div className={`absolute inset-0 bg-gradient-to-br ${status.bgColor}`}></div>
          </div>
          <div className="text-center max-w-md mx-auto relative z-10 p-8">
            <div className={`bg-gradient-to-br ${status.bgColor} backdrop-blur-xl border ${status.borderColor} rounded-2xl p-12 mb-8 shadow-2xl`}>
              {status.icon}
            </div>
            <h3 className="text-2xl font-bold text-white leading-tight mb-2">
              {status.title}
            </h3>
            <p className="text-gray-300 text-base leading-relaxed">
              {status.subtitle}
            </p>
          </div>
        </div>
      );
    } catch (error) {
      return null;
    }
  };

  // 🔥 RENDERIZAR VIDEO MINI (SIMPLE Y DIRECTO)
  const getMiniVideo = () => {
    try {
      // Si mainCamera es "local", mini muestra modelo (remote)
      if (mainCamera === "local") {
        if (finalRemoteTrack) {
          return (
            <div className="relative w-full h-full">
              <VideoTrack
                trackRef={finalRemoteTrack}
                className="w-full h-full object-cover rounded-xl"
              />
              <div className="absolute bottom-1 left-1 right-1">
                <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-2 py-1 rounded-md">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#00ff66] rounded-full animate-pulse"></div>
                    <span className="text-white text-xs font-medium truncate">
                      {otherUser?.name || getVideoChatText('model', currentLanguage, 'Modelo')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative rounded-xl">
            <div className="relative z-10 text-center">
              <Loader2 size={16} className="text-gray-400 mb-1 animate-spin" />
              <div className="text-gray-400 text-xs font-medium">{getVideoChatText('waitingForVideo', currentLanguage, 'Esperando video...')}</div>
            </div>
          </div>
        );
      }
      
      // Si mainCamera es "remote", mini muestra cliente (local)
      if (cameraEnabled === false) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative rounded-xl border-2 border-gray-700/50">
            <div className="relative z-10 text-center p-2">
              <CameraOff size={20} className="text-gray-500 mx-auto mb-2" />
              <div className="text-gray-500 text-xs font-medium">{getVideoChatText('cameraOff', currentLanguage, 'Cámara apagada')}</div>
            </div>
          </div>
        );
      }
      
      if (finalLocalTrack) {
        return (
          <div className="relative w-full h-full">
            <VideoTrack
              trackRef={finalLocalTrack}
              className="w-full h-full object-cover rounded-xl"
            />
            <div className="absolute bottom-1 left-1 right-1">
              <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-2 py-1 rounded-md">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-[#ff007a] rounded-full"></div>
                  <span className="text-white text-xs font-medium truncate">{texts.yourCamera}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative rounded-xl border-2 border-gray-700/50">
          <div className="relative z-10 text-center p-2">
            <Loader2 size={16} className="text-gray-400 mx-auto mb-2 animate-spin" />
            <div className="text-gray-400 text-xs font-medium">{getVideoChatText('startingCamera', currentLanguage, 'Iniciando cámara...')}</div>
          </div>
        </div>
      );
    } catch (error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative rounded-xl border-2 border-gray-700/50">
          <div className="relative z-10 text-center p-2">
            <CameraOff size={20} className="text-gray-500 mx-auto mb-2" />
            <div className="text-gray-500 text-xs font-medium">{getVideoChatText('cameraOff', currentLanguage, 'Cámara apagada')}</div>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      {/* Video principal - RESPONSIVE */}
      <div className="w-full h-full relative rounded-2xl overflow-hidden" style={{ minHeight: 0, minWidth: 0 }}>
        {getMainVideo()}
      </div>

      {/* 🔥 CHAT INTEGRADO - Entre username (top) y cámara pequeña (bottom) - SOLO MÓVIL */}
      {chatVisible && messages && messages.length > 0 && (
        <div 
          className="absolute left-0 right-0 z-30 transition-opacity duration-500 max-lg:flex lg:hidden"
          style={{ 
            opacity: chatOpacity,
            top: '4.5rem', // Un poco más cerca del username para ocupar más espacio
            bottom: 'calc(1rem + 5.5rem)', // Un poco más cerca de la cámara pequeña
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '0 1rem'
          }}
        >
          <div 
            ref={messagesEndRef}
            className="bg-transparent p-2 w-full h-full overflow-y-auto"
            style={{
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE and Edge */
            }}
          >
            <style>{`
              div::-webkit-scrollbar {
                display: none; /* Chrome, Safari, Opera */
                width: 0;
                height: 0;
              }
            `}</style>
            {/* Mostrar todos los mensajes del historial ordenados (más antiguos arriba, más recientes abajo) */}
            {[...messages].sort((a, b) => {
              // 🔥 ORDENAR POR TIMESTAMP MEJORADO - Manejar múltiples campos de tiempo
              const getTimestamp = (msg) => {
                // Intentar obtener timestamp de múltiples fuentes
                if (msg.timestamp && msg.timestamp > 0) return msg.timestamp;
                if (msg.created_at) {
                  const date = new Date(msg.created_at);
                  if (!isNaN(date.getTime())) return date.getTime();
                }
                if (msg.id && typeof msg.id === 'number' && msg.id > 1000000000000) {
                  // Si el ID es un timestamp válido (mayor a 2001-09-09)
                  return msg.id;
                }
                // Si no hay timestamp válido, usar el índice como fallback (pero con un valor muy bajo)
                return 0;
              };
              
              const timestampA = getTimestamp(a);
              const timestampB = getTimestamp(b);
              
              // Si ambos tienen timestamp válido, ordenar por timestamp
              if (timestampA > 0 && timestampB > 0) {
                return timestampA - timestampB;
              }
              
              // Si solo uno tiene timestamp, el que tiene timestamp va después
              if (timestampA > 0) return 1;
              if (timestampB > 0) return -1;
              
              // Si ninguno tiene timestamp, mantener el orden original usando el ID
              const idA = a.id || 0;
              const idB = b.id || 0;
              return idA - idB;
            }).map((msg, idx) => {
              if (msg.type === 'system') return null;
              
              const isLocal = msg.type === 'local' || (msg.senderRole && msg.senderRole === userData?.role);
              const senderName = isLocal 
                ? (userData?.name || 'Tú') 
                : (msg.sender || otherUser?.name || getVideoChatText('model', currentLanguage, 'Modelo'));
              
              // 🔥 DETECTAR SI ES MENSAJE DE REGALO
              const isGift = isGiftMessage(msg);
              
              // 🔥 RENDERIZAR TARJETA DE REGALO
              if (isGift) {
                const giftData = parseGiftData(msg);
                const imageUrl = giftData.gift_image ? buildCompleteImageUrl(giftData.gift_image) : null;
                const isFromCurrentUser = isLocal;
                const isGiftSent = msg.type === 'gift_sent' || (isFromCurrentUser && (msg.text?.includes('Enviaste:') || msg.message?.includes('Enviaste:')));
                const isGiftRequest = msg.type === 'gift_request' || (!isFromCurrentUser && (msg.text?.includes('Solicitud') || msg.message?.includes('Solicitud')));
                
                return (
                  <div 
                    key={msg.id || idx} 
                    className={`mb-2 last:mb-0 ${isGiftSent ? 'text-right' : 'text-left'}`}
                    style={{ display: 'flex', justifyContent: isGiftSent ? 'flex-end' : 'flex-start', width: '100%' }}
                  >
                    <div 
                      className="rounded-xl p-3"
                      style={{ 
                        backgroundColor: isGiftSent 
                          ? 'rgba(59, 130, 246, 0.2)' 
                          : isGiftRequest
                          ? 'rgba(255, 0, 122, 0.2)'
                          : 'rgba(34, 197, 94, 0.2)',
                        border: `1px solid ${isGiftSent ? 'rgba(59, 130, 246, 0.3)' : isGiftRequest ? 'rgba(255, 0, 122, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                        maxWidth: '200px',
                        width: 'fit-content',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* Icono y título */}
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="rounded-full p-1.5"
                          style={{ 
                            backgroundColor: isGiftSent 
                              ? 'rgba(59, 130, 246, 0.8)' 
                              : isGiftRequest
                              ? 'rgba(255, 0, 122, 0.8)'
                              : 'rgba(34, 197, 94, 0.8)'
                          }}
                        >
                          <Gift size={12} className="text-white" />
                        </div>
                        <span className="text-xs font-semibold text-white">
                          {isGiftSent 
                            ? getGiftCardText('giftSent', currentLanguage) 
                            : isGiftRequest 
                            ? getGiftCardText('requestGift', currentLanguage)
                            : getGiftCardText('giftReceived', currentLanguage)}
                        </span>
                      </div>
                      
                      {/* Imagen del regalo */}
                      {imageUrl && (
                        <div className="mb-2 flex justify-center">
                          <div 
                            className="rounded-lg flex items-center justify-center overflow-hidden"
                            style={{
                              width: '48px',
                              height: '48px',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)'
                            }}
                          >
                            <img
                              src={imageUrl}
                              alt={giftData.gift_name || 'Regalo'}
                              className="object-contain"
                              style={{ width: '40px', height: '40px' }}
                              loading="lazy"
                              decoding="async"
                              key={`gift-mobile-${giftData.gift_name}-${imageUrl}`}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const fallback = e.target.parentNode.querySelector('.gift-fallback-mobile');
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="gift-fallback-mobile hidden items-center justify-center" style={{ width: '40px', height: '40px' }}>
                              <Gift size={16} className="text-white opacity-50" />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Nombre del regalo */}
                      <div className="text-center mb-1">
                        <p className="text-white font-bold text-xs" style={{ wordBreak: 'break-word' }}>
                          {getTranslatedGiftName(giftData.gift_name, currentLanguage, giftData.gift_name || 'Regalo Especial')}
                        </p>
                      </div>
                      
                      {/* Precio */}
                      {giftData.gift_price && (
                        <div className="text-center">
                          <span className="text-xs font-semibold text-amber-200">
                            ✨ {giftData.gift_price} {getGiftCardText('minutes', currentLanguage)}
                          </span>
                        </div>
                      )}
                      
                      {/* 🔥 BOTÓN ACEPTAR Y PAGAR - SOLO PARA SOLICITUDES DE REGALO */}
                      {isGiftRequest && handleAcceptGift && (() => {
                        const currentBalance = giftBalance !== undefined ? giftBalance : (userBalance !== undefined ? userBalance : 0);
                        const giftPrice = giftData.gift_price || 0;
                        const hasEnoughBalance = currentBalance >= giftPrice;
                        const requestId = giftData.request_id || giftData.transaction_id || msg.id;
                        
                        // 🔥 VERIFICAR SI EL REGALO YA FUE ACEPTADO
                        const giftAlreadyAccepted = messages.some(m => {
                          if (m.type === 'gift_sent' && m.user_id === userData?.id) {
                            try {
                              const sentGiftData = typeof m.extra_data === 'string' ? JSON.parse(m.extra_data) : (m.extra_data || {});
                              const sentGiftData2 = typeof m.gift_data === 'string' ? JSON.parse(m.gift_data) : (m.gift_data || {});
                              const sentRequestId = sentGiftData.request_id || sentGiftData.transaction_id || sentGiftData2.request_id || sentGiftData2.transaction_id;
                              
                              return sentRequestId === requestId || 
                                     String(sentRequestId) === String(requestId) ||
                                     sentRequestId === giftData.request_id || 
                                     sentRequestId === giftData.transaction_id;
                            } catch (e) {
                              return false;
                            }
                          }
                          return false;
                        });
                        
                        if (giftAlreadyAccepted) {
                          return (
                            <div className="text-center mt-2 pt-2 border-t border-white/10">
                              <span className="text-green-400 text-xs font-medium">
                                {getGiftCardText('giftSentCheck', currentLanguage)}
                              </span>
                            </div>
                          );
                        }
                        
                        return (
                          <button
                            onClick={async () => {
                              if (!handleAcceptGift || !hasEnoughBalance) {
                                if (window.showNotification) {
                                  window.showNotification('error', 'Saldo insuficiente', `Necesitas ${giftPrice} ${getGiftCardText('minutes', currentLanguage)} para aceptar este regalo. Tu saldo actual: ${currentBalance}`);
                                }
                                return;
                              }
                              
                              const result = await handleAcceptGift(requestId, giftData);
                              if (!result.success && result.error !== 'request_not_found') {
                                if (window.showNotification) {
                                  window.showNotification('error', 'Error', result.error || 'No se pudo procesar el regalo');
                                }
                              }
                            }}
                            disabled={!hasEnoughBalance}
                            className={`mt-2 w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                              hasEnoughBalance
                                ? 'bg-gradient-to-r from-[#ff007a] to-[#cc0062] text-white hover:from-[#ff3399] hover:to-[#e6006e] active:scale-95'
                                : 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {hasEnoughBalance ? 'Regalar' : `Faltan ${giftPrice - currentBalance} ${getGiftCardText('minutes', currentLanguage)}`}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              }
              
              // 🔥 RENDERIZAR MENSAJE NORMAL
              return (
                <div 
                  key={msg.id || idx} 
                  className={`mb-1 last:mb-0 ${isLocal ? 'text-right' : 'text-left'}`}
                  style={{ display: 'flex', justifyContent: isLocal ? 'flex-end' : 'flex-start', width: '100%' }}
                >
                  <div 
                    className={`px-3 py-2 rounded-lg ${
                      isLocal 
                        ? 'text-right' 
                        : 'text-left'
                    }`}
                    style={{ 
                      backgroundColor: '#4a4a4a',
                      maxWidth: '250px',
                      minWidth: '0',
                      width: 'fit-content',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                  >
                    {!isLocal && (
                      <div className="text-xs font-semibold mb-1 text-gray-300" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {senderName}
                      </div>
                    )}
                    <div 
                      className="text-sm font-medium"
                      style={{
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        overflow: 'hidden',
                        maxWidth: '100%',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      {renderMessageWithTranslation(msg)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mini video con borde fucsia - OCULTO EN MODO 2VS1 */}
      {!(callData?.is_dual_call || callData?.modelo_id_2 || sessionStorage.getItem('isDualCall') === 'true') && (
        <div
          className="absolute bottom-4 left-4
                     w-16 h-20
                     sm:w-20 sm:h-24
                     md:w-24 md:h-28
                     lg:w-28 lg:h-32
                     xl:w-32 xl:h-36
                     rounded-xl overflow-hidden border-2 border-[#ff007a]/50 shadow-2xl cursor-pointer transition-all duration-300 hover:scale-105 hover:border-[#ff007a] group backdrop-blur-sm"
          onClick={onCameraSwitch}
        >
          {getMiniVideo()}

          {/* Overlay de intercambio */}
          <div className="absolute inset-0 bg-[#ff007a]/20 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center rounded-xl">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
              <Camera size={14} className="text-white" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoDisplayImprovedClient;
