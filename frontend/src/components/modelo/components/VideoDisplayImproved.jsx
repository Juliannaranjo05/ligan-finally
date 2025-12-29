import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParticipants, VideoTrack, useTracks, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Camera, CameraOff, Loader2, Users, Eye, Gift, MessageSquare, MessageSquareOff, MoreVertical } from "lucide-react";
import { useGlobalTranslation } from '../../../contexts/GlobalTranslationContext';
import { getTranslatedGiftName, getGiftCardText } from '../../GiftSystem/giftTranslations';
import { getVideoChatText } from '../../videochatTranslations';

const VideoDisplayImproved = ({ 
  onCameraSwitch, 
  mainCamera, 
  connected, 
  hadRemoteParticipant, 
  otherUser,
  isDetectingUser,
  cameraEnabled,
  t,
  // 🔥 PROPS PARA CHAT INTEGRADO
  messages = [],
  userData = null,
  chatVisible = true,
  setChatVisible = () => {}
}) => {
  const participants = useParticipants();
  const localParticipant = participants.find(p => p.isLocal);
  const remoteParticipant = participants.find(p => !p.isLocal);
  const room = useRoomContext();
  
  // 🔥 OBTENER CONTEXTO GLOBAL DE TRADUCCIÓN
  const { 
    translateGlobalText, 
    isEnabled: translationEnabled,
    getExistingTranslation,
    currentLanguage: globalCurrentLanguage
  } = useGlobalTranslation();
  
  // 🔥 OBTENER IDIOMA ACTUAL (usar estado local para detectar cambios)
  const [currentLanguage, setCurrentLanguage] = useState(() => globalCurrentLanguage || 'es');
  
  // 🔥 SINCRONIZAR CON EL IDIOMA GLOBAL CUANDO CAMBIA
  useEffect(() => {
    if (globalCurrentLanguage && globalCurrentLanguage !== currentLanguage) {
      setCurrentLanguage(globalCurrentLanguage);
    }
  }, [globalCurrentLanguage, currentLanguage]);
  
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

  // 🔥 REFS PARA TRADUCCIONES
  const translationsRef = useRef(new Map());
  const translatingIdsRef = useRef(new Set());

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
        message &&
        (message.text || message.message) &&
        !translationsRef.current.has(message.id) &&
        !translatingIdsRef.current.has(message.id)
      );
    });

    messagesToTranslate.forEach(translateMessage);
  }, [messages, translationEnabled, translateMessage]);

  // 🔥 EFECTO PARA RE-TRADUCIR MENSAJES CUANDO CAMBIA EL IDIOMA
  useEffect(() => {
    if (!translationEnabled || !currentLanguage) return;

    // Limpiar traducciones existentes cuando cambia el idioma
    setTranslations(new Map());
    setTranslatingIds(new Set());
    translationsRef.current = new Map();
    translatingIdsRef.current = new Set();

    // Re-traducir todos los mensajes con el nuevo idioma
    const messagesToRetranslate = messages.filter(message => {
      return (
        message &&
        (message.text || message.message) &&
        (message.text || message.message).trim() !== ''
      );
    });

    // Re-traducir con un pequeño delay para asegurar que el contexto global se actualizó
    setTimeout(() => {
      messagesToRetranslate.forEach((message, index) => {
        setTimeout(() => {
          translateMessage(message);
        }, index * 100);
      });
    }, 200);
  }, [currentLanguage, translationEnabled, translateMessage]);

  // 🔥 EFECTO PARA ESCUCHAR CAMBIOS DE IDIOMA GLOBAL (eventos personalizados)
  useEffect(() => {
    const handleGlobalLanguageChange = (event) => {
      const newLanguage = event.detail?.language || event.detail;
      if (newLanguage && newLanguage !== currentLanguage) {
        setCurrentLanguage(newLanguage);
        // Limpiar traducciones existentes
        setTranslations(new Map());
        setTranslatingIds(new Set());
        translationsRef.current = new Map();
        translatingIdsRef.current = new Set();
        
        // Re-traducir mensajes con el nuevo idioma
        setTimeout(() => {
          const messagesToRetranslate = messages.filter(message => {
            return (
              message &&
              (message.text || message.message) &&
              (message.text || message.message).trim() !== ''
            );
          });
          
          messagesToRetranslate.forEach((message, index) => {
            setTimeout(() => {
              translateMessage(message);
            }, index * 100);
          });
        }, 200);
      }
    };

    // Escuchar eventos de cambio de idioma global
    window.addEventListener('globalLanguageChanged', handleGlobalLanguageChange);
    
    return () => {
      window.removeEventListener('globalLanguageChanged', handleGlobalLanguageChange);
    };
  }, [currentLanguage, translationEnabled, translateMessage, messages]);

  // 🔥 FUNCIÓN PARA RENDERIZAR MENSAJE CON TRADUCCIÓN
  const renderMessageWithTranslation = useCallback((message) => {
    const originalText = message.text || message.message;
    const translatedText = translations.get(message.id);
    const isTranslating = translatingIds.has(message.id);
    
    const hasTranslation = translatedText && translatedText !== originalText && translatedText.trim() !== '';

    // 🔥 SI HAY TRADUCCIÓN, MOSTRAR OVERLAY FLOTANTE COMO EN LA IMAGEN
    if (hasTranslation) {
      return (
        <div 
          style={{ 
            maxWidth: '100%', 
            width: '100%', 
            wordBreak: 'break-word', 
            overflowWrap: 'break-word', 
            boxSizing: 'border-box',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            padding: '8px 12px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          {/* TEXTO ORIGINAL ARRIBA */}
          <div 
            style={{ 
              wordBreak: 'break-word', 
              overflowWrap: 'break-word', 
              whiteSpace: 'pre-wrap',
              color: '#e5e7eb',
              fontSize: '14px',
              lineHeight: '1.4',
              marginBottom: '4px'
            }}
          >
            {originalText}
            {isTranslating && (
              <span className="ml-2 inline-flex items-center">
                <div className="animate-spin rounded-full h-2 w-2 border-b border-current opacity-50"></div>
              </span>
            )}
          </div>

          {/* TRADUCCIÓN ABAJO CON LÍNEA VERTICAL */}
          <div 
            style={{ 
              wordBreak: 'break-word', 
              overflowWrap: 'break-word', 
              whiteSpace: 'pre-wrap',
              color: '#9ca3af',
              fontSize: '12px',
              lineHeight: '1.4',
              paddingLeft: '8px',
              borderLeft: '2px solid rgba(156, 163, 175, 0.5)',
              marginTop: '4px'
            }}
          >
            {translatedText}
          </div>
        </div>
      );
    }

    // 🔥 SI NO HAY TRADUCCIÓN, MOSTRAR SOLO EL TEXTO ORIGINAL
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
      </div>
    );
  }, [translations, translatingIds]);

  // 🔥 FUNCIONES PARA DETECTAR Y PARSEAR REGALOS
  const isGiftMessage = useCallback((msg) => {
    if (!msg) return false;
    
    // 🔥 PRIMERO: Verificar si tiene datos de regalo en extra_data o gift_data
    let hasGiftData = false;
    if (msg.extra_data) {
      try {
        const extraData = typeof msg.extra_data === 'string' ? JSON.parse(msg.extra_data) : msg.extra_data;
        if (extraData && (extraData.gift_name || extraData.gift_image || extraData.gift_price)) {
          hasGiftData = true;
        }
      } catch (e) {
        // Si no se puede parsear, continuar con otras verificaciones
      }
    }
    if (msg.gift_data) {
      try {
        const giftData = typeof msg.gift_data === 'string' ? JSON.parse(msg.gift_data) : msg.gift_data;
        if (giftData && (giftData.gift_name || giftData.gift_image || giftData.gift_price)) {
          hasGiftData = true;
        }
      } catch (e) {
        // Si no se puede parsear, continuar con otras verificaciones
      }
    }
    
    const text = msg.text || msg.message || '';
    return msg.type === 'gift' || 
           msg.type === 'gift_sent' || 
           msg.type === 'gift_received' ||
           msg.type === 'gift_request' ||
           hasGiftData ||
           text.includes('Regalo') ||
           text.includes('regalo') ||
           text.includes('Enviaste:') ||
           text.includes('Recibiste:') ||
           text.includes('para ti') ||
           text.includes('para ti!');
  }, []);

  const parseGiftData = useCallback((msg) => {
    let giftData = {};
    
    // Intentar obtener de extra_data primero
    if (msg.extra_data) {
      try {
        if (typeof msg.extra_data === 'string') {
          giftData = JSON.parse(msg.extra_data);
        } else if (typeof msg.extra_data === 'object') {
          giftData = { ...msg.extra_data };
        }
      } catch (e) {
        console.warn('Error parsing extra_data:', e);
      }
    }
    
    // Fallback a gift_data (combinar, no reemplazar)
    if (msg.gift_data) {
      try {
        let parsedGiftData = {};
        if (typeof msg.gift_data === 'string') {
          parsedGiftData = JSON.parse(msg.gift_data);
        } else if (typeof msg.gift_data === 'object') {
          parsedGiftData = msg.gift_data;
        }
        // Combinar datos, dando prioridad a extra_data pero preservando gift_data
        giftData = { ...parsedGiftData, ...giftData };
      } catch (e) {
        console.warn('Error parsing gift_data:', e);
      }
    }
    
    // Buscar gift_image en múltiples campos
    const giftImage = giftData.gift_image || 
                      giftData.image || 
                      giftData.image_path || 
                      giftData.gift_image_path || 
                      null;
    
    const text = msg.text || msg.message || '';
    if (text && (!giftData.gift_name || !giftImage)) {
      const giftNameMatch = text.match(/(?:¡|!)?([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)(?:\s+para\s+ti[!:]|$)/);
      if (giftNameMatch) {
        giftData.gift_name = giftNameMatch[1].trim();
      }
      
      const sentReceivedMatch = text.match(/(?:Enviaste:|Recibiste:)\s*(.+?)(?:\s*[!💝❤️]|$)/);
      if (sentReceivedMatch) {
        giftData.gift_name = sentReceivedMatch[1].trim();
      }
    }
    
    return {
      gift_name: giftData.gift_name || 'Regalo Especial',
      gift_price: giftData.gift_price || 10,
      gift_image: giftImage,
      request_id: giftData.request_id || giftData.transaction_id || msg.id,
      transaction_id: giftData.transaction_id || giftData.request_id || null,
      ...giftData
    };
  }, []);

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

  // 🔥 USAR TRACKS DISPONIBLES (priorizar useTracks, luego publicaciones)
  const finalLocalTrack = localVideoTrack || localTrackFromPublication;
  const finalRemoteTrack = remoteVideoTrack || remoteTrackFromPublication;

  // 🔥 EFECTO PARA APLICAR ESTILOS RESPONSIVE A TODOS LOS VIDEOS (AGRESIVO CON DEBUG)
  useEffect(() => {
    const applyResponsiveStyles = () => {
      // #region agent log
      // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImproved.jsx:117',message:'applyResponsiveStyles ejecutándose (MODELO)',data:{hasLocalTrack:!!finalLocalTrack,hasRemoteTrack:!!finalRemoteTrack,connected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Buscar TODOS los contenedores de video
      const videoContainers = document.querySelectorAll('.video-main-container');
      
      // #region agent log
      // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImproved.jsx:122',message:'Contenedores encontrados (MODELO)',data:{containerCount:videoContainers.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      videoContainers.forEach((container, idx) => {
        if (container && container instanceof HTMLElement) {
          // #region agent log
          // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImproved.jsx:128',message:'Procesando contenedor (MODELO)',data:{idx,containerWidth:container.offsetWidth,containerHeight:container.offsetHeight,scrollWidth:container.scrollWidth,scrollHeight:container.scrollHeight,hasOverflow:container.scrollWidth > container.offsetWidth || container.scrollHeight > container.offsetHeight,computedOverflow:window.getComputedStyle(container).overflow},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // Aplicar overflow-hidden al contenedor
          container.style.overflow = 'hidden';
          container.style.minHeight = '0';
          container.style.minWidth = '0';
          
          // Buscar todos los videos dentro
          const videos = container.querySelectorAll('video');
          
          // #region agent log
          // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImproved.jsx:138',message:'Videos encontrados en contenedor (MODELO)',data:{videoCount:videos.length,containerIdx:idx},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
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
              // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImproved.jsx:149',message:'Antes de aplicar estilos (MODELO)',data:{videoIdx,containerIdx:idx,beforeStyles},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
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
                // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImproved.jsx:165',message:'Después de aplicar estilos (MODELO)',data:{videoIdx,containerIdx:idx,afterStyles,containerWidth:container.offsetWidth,containerHeight:container.offsetHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
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
            // TELEMETRY DISABLED: fetch('http://localhost:7242/ingest/48eaf2bf-f708-4455-8fc5-0bd03846e662',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoDisplayImproved.jsx:177',message:'Estado final del contenedor (MODELO)',data:{containerIdx:idx,finalContainerState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
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
  const renderVideoTrack = (trackRef, overlayText, overlayColor = "pink", showOnTop = false) => {
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
              {overlayColor === "green" ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#00ff66] rounded-full animate-pulse"></div>
                  <span className="text-[#00ff66] text-sm font-semibold">{overlayText}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#ff007a] rounded-full animate-pulse"></div>
                  <span className="text-[#ff007a] text-sm font-semibold">{overlayText}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {/* 🔥 BOTONES DE MOSTRAR/OCULTAR CHAT Y MENÚ - En la esquina superior derecha - SOLO MÓVIL */}
        {showOnTop && overlayText && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 lg:hidden">
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
            
            {/* Botón de menú (tres puntos) */}
            <button
              onClick={() => {
                // Función para abrir menú de opciones
                window.dispatchEvent(new CustomEvent('openCameraAudioSettings'));
              }}
              className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-500/30 hover:border-gray-400/50 transition-all duration-200"
              title="Más opciones"
            >
              <MoreVertical size={16} className="text-gray-400" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // 🔥 RENDERIZAR VIDEO PRINCIPAL (SIMPLE Y DIRECTÓ)
  const getMainVideo = () => {
    try {
      // Por defecto mostrar modelo en grande (local), pero si mainCamera es "remote" mostrar cliente
      if ((mainCamera === "local" || !mainCamera) && localParticipant) {
        if (finalLocalTrack) {
          return renderVideoTrack(finalLocalTrack, getVideoChatText('yourCamera', currentLanguage, "Tu cámara"), "pink", true); // showOnTop = true
        }
        
        // Si no hay track pero cameraEnabled es true, mostrar carga
        if (cameraEnabled) {
          return (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative overflow-hidden">
            {/* Nombre arriba */}
            <div className="absolute top-4 left-4 z-20">
              <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#ff007a]/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#ff007a] rounded-full animate-pulse"></div>
                  <span className="text-[#ff007a] text-sm font-semibold">{getVideoChatText('yourCamera', currentLanguage, "Tu cámara")}</span>
                </div>
              </div>
            </div>
            {/* 🔥 BOTONES DE MOSTRAR/OCULTAR CHAT Y MENÚ - En la esquina superior derecha - SOLO MÓVIL */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 lg:hidden">
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
              
              {/* Botón de menú (tres puntos) */}
              <button
                onClick={() => {
                  // Función para abrir menú de opciones
                  window.dispatchEvent(new CustomEvent('openCameraAudioSettings'));
                }}
                className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-500/30 hover:border-gray-400/50 transition-all duration-200"
                title="Más opciones"
              >
                <MoreVertical size={16} className="text-gray-400" />
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
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative overflow-hidden">
            {/* Nombre arriba */}
            <div className="absolute top-4 left-4 z-20">
              <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#ff007a]/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#ff007a] rounded-full animate-pulse"></div>
                  <span className="text-[#ff007a] text-sm font-semibold">{getVideoChatText('yourCamera', currentLanguage, "Tu cámara")}</span>
                </div>
              </div>
            </div>
            {/* 🔥 BOTONES DE MOSTRAR/OCULTAR CHAT Y MENÚ - En la esquina superior derecha - SOLO MÓVIL */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 lg:hidden">
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
              
              {/* Botón de menú (tres puntos) */}
              <button
                onClick={() => {
                  // Función para abrir menú de opciones
                  window.dispatchEvent(new CustomEvent('openCameraAudioSettings'));
                }}
                className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-500/30 hover:border-gray-400/50 transition-all duration-200"
                title="Más opciones"
              >
                <MoreVertical size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="text-center">
              <CameraOff className="mx-auto mb-4 text-gray-500" size={64} />
              <p className="text-gray-500">{getVideoChatText('cameraOff', currentLanguage, 'Cámara apagada')}</p>
            </div>
          </div>
        );
      }
      
      // Si mainCamera es "remote", mostrar video del cliente
      if (mainCamera === "remote" && remoteParticipant) {
        if (finalRemoteTrack) {
          return renderVideoTrack(finalRemoteTrack, otherUser?.name || 'Chico', "green", true); // showOnTop = true
        }
        
        // Si hay participante remoto pero no hay track, mostrar carga o cámara apagada
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative overflow-hidden">
            {/* Nombre arriba */}
            <div className="absolute top-4 left-4 z-20">
              <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-green-400/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#00ff66] rounded-full animate-pulse"></div>
                  <span className="text-[#00ff66] text-sm font-semibold">{otherUser?.name || 'Chico'}</span>
                </div>
              </div>
            </div>
            {/* 🔥 BOTONES DE MOSTRAR/OCULTAR CHAT Y MENÚ - En la esquina superior derecha - SOLO MÓVIL */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 lg:hidden">
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
              
              {/* Botón de menú (tres puntos) */}
              <button
                onClick={() => {
                  // Función para abrir menú de opciones
                  window.dispatchEvent(new CustomEvent('openCameraAudioSettings'));
                }}
                className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-500/30 hover:border-gray-400/50 transition-all duration-200"
                title="Más opciones"
              >
                <MoreVertical size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="text-center text-gray-400">
              <CameraOff className="mx-auto mb-4 text-gray-500" size={64} />
              <p className="text-gray-500">{getVideoChatText('boyCameraOff', currentLanguage, 'Cámara del chico apagada')}</p>
            </div>
          </div>
        );
      }
      
      // Si no hay participante remoto, mostrar estado de espera
      let status;
      if (participants.length === 1 && localParticipant && !remoteParticipant && !hadRemoteParticipant) {
        status = {
          icon: <Users size={48} className="text-[#ff007a]" />,
          title: getVideoChatText('waitingForGuy', currentLanguage, 'Esperando chico'),
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
            {isDetectingUser && (
              <div className="mt-6">
                <div className="bg-gradient-to-r from-[#0a0d10] to-[#131418] backdrop-blur-lg border border-[#ff007a]/30 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 size={18} className="text-[#ff007a] animate-spin" />
                    <span className="text-[#ff007a] text-sm font-medium">
                      Detectando usuario...
                    </span>
                  </div>
                </div>
              </div>
            )}
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
      // Si mainCamera es "local" o no está definido, mini muestra cliente (remote)
      if (mainCamera === "local" || !mainCamera) {
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
                      {otherUser?.name || 'Chico'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        // Si no hay track remoto, mostrar estado de cámara apagada del cliente
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#1a1d20] to-[#0f1114] relative rounded-xl border border-gray-700/30">
            <div className="relative z-10 text-center p-1">
              <CameraOff size={18} className="text-gray-500 mx-auto mb-1" />
              <div className="text-gray-500 text-[10px] font-medium leading-tight">
                {remoteParticipant ? getVideoChatText('cameraOff', currentLanguage, 'Cámara apagada') : getVideoChatText('waiting', currentLanguage, 'Esperando')}
              </div>
            </div>
          </div>
        );
      }
      
      // Si mainCamera es "remote", mini muestra modelo (local)
      if (mainCamera === "remote") {
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
                    <span className="text-white text-xs font-medium truncate">Tu cámara</span>
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
      }
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
            top: '4.5rem',
            bottom: 'calc(1rem + 5.5rem)',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '0 1rem'
          }}
        >
          <div 
            ref={messagesEndRef}
            className="bg-transparent p-2 w-full h-full overflow-y-auto"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <style>{`
              div::-webkit-scrollbar {
                display: none;
                width: 0;
                height: 0;
              }
            `}</style>
            {[...messages].filter((msg) => {
              // 🔥 FILTRAR DUPLICADOS DE REGALOS (similar a desktop)
              if (msg.type === 'gift_sent' || msg.type === 'gift_received' || msg.extra_data || msg.gift_data) {
                try {
                  const extraData = typeof msg.extra_data === 'string' ? JSON.parse(msg.extra_data) : (msg.extra_data || {});
                  const giftData = typeof msg.gift_data === 'string' ? JSON.parse(msg.gift_data) : (msg.gift_data || {});
                  
                  const transactionId = extraData.transaction_id || giftData.transaction_id || extraData.gift_request_id || giftData.gift_request_id;
                  const requestId = extraData.request_id || giftData.request_id || extraData.gift_request_id || giftData.gift_request_id;
                  const uniqueId = transactionId || requestId;
                  
                  // Si tiene ID único, verificar duplicados usando un Set temporal
                  // Nota: Este filtro se ejecuta en cada render, así que usamos un enfoque simple
                  // En producción, esto debería estar en un useMemo o useEffect
                } catch (e) {
                  // Si hay error parseando, continuar con el mensaje
                }
              }
              return true;
            }).sort((a, b) => {
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
            }).reduce((acc, msg, idx) => {
              // 🔥 FILTRAR DUPLICADOS DE REGALOS POR transaction_id/request_id
              if (msg.type === 'gift_sent' || msg.type === 'gift_received' || msg.extra_data || msg.gift_data) {
                try {
                  const extraData = typeof msg.extra_data === 'string' ? JSON.parse(msg.extra_data) : (msg.extra_data || {});
                  const giftData = typeof msg.gift_data === 'string' ? JSON.parse(msg.gift_data) : (msg.gift_data || {});
                  
                  const transactionId = extraData.transaction_id || giftData.transaction_id || extraData.gift_request_id || giftData.gift_request_id;
                  const requestId = extraData.request_id || giftData.request_id || extraData.gift_request_id || giftData.gift_request_id;
                  const uniqueId = transactionId || requestId;
                  
                  if (uniqueId) {
                    // Normalizar tipo: gift_sent del cliente = gift_received para la modelo
                    const normalizedType = (msg.type === 'gift_sent' && (msg.user_role === 'cliente' || msg.senderRole === 'cliente')) 
                      ? 'gift_received' 
                      : msg.type;
                    
                    const giftKey = `${uniqueId}-${normalizedType}`;
                    
                    // Verificar si ya existe un mensaje con esta clave
                    const existingIndex = acc.findIndex(m => {
                      if (m.type === 'gift_sent' || m.type === 'gift_received' || m.extra_data || m.gift_data) {
                        try {
                          const mExtraData = typeof m.extra_data === 'string' ? JSON.parse(m.extra_data) : (m.extra_data || {});
                          const mGiftData = typeof m.gift_data === 'string' ? JSON.parse(m.gift_data) : (m.gift_data || {});
                          const mTransactionId = mExtraData.transaction_id || mGiftData.transaction_id || mExtraData.gift_request_id || mGiftData.gift_request_id;
                          const mRequestId = mExtraData.request_id || mGiftData.request_id || mExtraData.gift_request_id || mGiftData.gift_request_id;
                          const mUniqueId = mTransactionId || mRequestId;
                          
                          if (mUniqueId === uniqueId) {
                            const mNormalizedType = (m.type === 'gift_sent' && (m.user_role === 'cliente' || m.senderRole === 'cliente')) 
                              ? 'gift_received' 
                              : m.type;
                            return `${mUniqueId}-${mNormalizedType}` === giftKey;
                          }
                        } catch (e) {
                          // Si hay error, no considerar duplicado
                        }
                      }
                      return false;
                    });
                    
                    if (existingIndex >= 0) {
                      // Ya existe un mensaje con este ID único, omitir este
                      console.log('🔍 [MODELO-MOBILE] Mensaje de regalo duplicado detectado y filtrado:', {
                        msgId: msg.id,
                        uniqueId,
                        type: msg.type,
                        normalizedType,
                        giftKey
                      });
                      return acc;
                    }
                  }
                } catch (e) {
                  // Si hay error parseando, continuar con el mensaje
                }
              }
              acc.push(msg);
              return acc;
            }, []).map((msg, idx) => {
              if (msg.type === 'system') return null;
              
              const isLocal = msg.type === 'local' || (msg.senderRole && msg.senderRole === userData?.role);
              const senderName = isLocal 
                ? (userData?.name || 'Tú') 
                : (msg.sender || otherUser?.name || 'Cliente');
              
              const isGift = isGiftMessage(msg);
              
              if (isGift) {
                const giftData = parseGiftData(msg);
                const imageUrl = giftData.gift_image ? buildCompleteImageUrl(giftData.gift_image) : null;
                const isFromCurrentUser = isLocal;
                
                // 🔥 DETECTAR SI ES gift_sent DEL CLIENTE (regalo recibido para la modelo)
                const isGiftSentFromClient = msg.type === 'gift_sent' && !isFromCurrentUser && (msg.user_role === 'cliente' || msg.senderRole === 'cliente');
                // 🔥 DETECTAR SI ES gift_sent DE LA MODELO (raro, pero posible)
                const isGiftSentFromModel = msg.type === 'gift_sent' && isFromCurrentUser;
                // 🔥 CORREGIDO: Las solicitudes de regalo de la modelo (isFromCurrentUser) deben mostrarse del lado derecho
                const isGiftRequest = msg.type === 'gift_request' || (msg.text?.includes('Solicitud') || msg.message?.includes('Solicitud'));
                // 🔥 Si es solicitud de regalo del usuario actual (modelo), debe mostrarse del lado derecho
                const isGiftRequestFromModel = isGiftRequest && isFromCurrentUser;
                // 🔥 Determinar alineación: derecha si es enviado por el usuario o si es solicitud del usuario
                const shouldAlignRight = isGiftSentFromModel || isGiftRequestFromModel;
                
                return (
                  <div 
                    key={msg.id || idx} 
                    className={`mb-2 last:mb-0 ${shouldAlignRight ? 'text-right' : 'text-left'}`}
                    style={{ display: 'flex', justifyContent: shouldAlignRight ? 'flex-end' : 'flex-start', width: '100%' }}
                  >
                    <div 
                      className="rounded-xl p-3"
                      style={{ 
                        backgroundColor: isGiftSentFromModel 
                          ? 'rgba(59, 130, 246, 0.2)' 
                          : isGiftRequest
                          ? 'rgba(255, 0, 122, 0.2)'
                          : 'rgba(34, 197, 94, 0.2)',
                        border: `1px solid ${isGiftSentFromModel ? 'rgba(59, 130, 246, 0.3)' : isGiftRequest ? 'rgba(255, 0, 122, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                        maxWidth: '200px',
                        width: 'fit-content',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="rounded-full p-1.5"
                          style={{ 
                            backgroundColor: isGiftSentFromModel 
                              ? 'rgba(59, 130, 246, 0.8)' 
                              : isGiftRequest
                              ? 'rgba(255, 0, 122, 0.8)'
                              : 'rgba(34, 197, 94, 0.8)'
                          }}
                        >
                          <Gift size={12} className="text-white" />
                        </div>
                        <span className="text-xs font-semibold text-white">
                          {isGiftSentFromModel 
                            ? getGiftCardText('giftSent', currentLanguage) 
                            : isGiftRequest 
                            ? getGiftCardText('requestGift', currentLanguage)
                            : getGiftCardText('giftReceived', currentLanguage)}
                        </span>
                      </div>
                      
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
                      
                      <div className="text-center mb-1">
                        <p className="text-white font-bold text-xs" style={{ wordBreak: 'break-word' }}>
                          {getTranslatedGiftName(giftData.gift_name, currentLanguage, giftData.gift_name || 'Regalo Especial')}
                        </p>
                      </div>
                      
                      {giftData.gift_price && (
                        <div className="text-center">
                          <span className="text-xs font-semibold text-amber-200">
                            ✨ {giftData.gift_price} {getGiftCardText('coins', currentLanguage)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              
              // 🔥 VERIFICAR SI HAY TRADUCCIÓN PARA APLICAR ESTILOS DIFERENTES
              const hasTranslationForThisMsg = translations.get(msg.id) && 
                                               translations.get(msg.id) !== (msg.text || msg.message) && 
                                               translations.get(msg.id).trim() !== '';
              
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
                      // 🔥 SI HAY TRADUCCIÓN, NO APLICAR FONDO (el overlay ya lo tiene)
                      backgroundColor: hasTranslationForThisMsg ? 'transparent' : '#4a4a4a',
                      maxWidth: '250px',
                      minWidth: '0',
                      width: 'fit-content',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      padding: hasTranslationForThisMsg ? '0' : undefined // 🔥 QUITAR PADDING SI HAY TRADUCCIÓN
                    }}
                  >
                    {!isLocal && !hasTranslationForThisMsg && (
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

      {/* Mini video con borde fucsia */}
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
    </>
  );
};

export default VideoDisplayImproved;
