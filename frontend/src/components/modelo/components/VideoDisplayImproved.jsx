import React, { useEffect, useMemo } from 'react';
import { useParticipants, VideoTrack, useTracks, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Camera, CameraOff, Loader2, Users, Eye } from "lucide-react";

const VideoDisplayImproved = ({ 
  onCameraSwitch, 
  mainCamera, 
  connected, 
  hadRemoteParticipant, 
  otherUser,
  isDetectingUser,
  cameraEnabled,
  t 
}) => {
  const participants = useParticipants();
  const localParticipant = participants.find(p => p.isLocal);
  const remoteParticipant = participants.find(p => !p.isLocal);
  const room = useRoomContext();
  
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
      </div>
    );
  };

  // 🔥 RENDERIZAR VIDEO PRINCIPAL (SIMPLE Y DIRECTÓ)
  const getMainVideo = () => {
    try {
      // Por defecto mostrar modelo en grande (local), pero si mainCamera es "remote" mostrar cliente
      if ((mainCamera === "local" || !mainCamera) && localParticipant) {
        if (finalLocalTrack) {
          return renderVideoTrack(finalLocalTrack, "Tu cámara", "pink", true); // showOnTop = true
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
                    <span className="text-[#ff007a] text-sm font-semibold">Tu cámara</span>
                  </div>
                </div>
              </div>
              <div className="text-center text-gray-400">
                <Loader2 className="animate-spin mx-auto mb-2" size={48} />
                <p>Iniciando cámara...</p>
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
                  <span className="text-[#ff007a] text-sm font-semibold">Tu cámara</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <CameraOff className="mx-auto mb-4 text-gray-500" size={64} />
              <p className="text-gray-500">Cámara apagada</p>
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
            <div className="text-center text-gray-400">
              <CameraOff className="mx-auto mb-4 text-gray-500" size={64} />
              <p className="text-gray-500">Cámara del chico apagada</p>
            </div>
          </div>
        );
      }
      
      // Si no hay participante remoto, mostrar estado de espera
      let status;
      if (participants.length === 1 && localParticipant && !remoteParticipant && !hadRemoteParticipant) {
        status = {
          icon: <Users size={48} className="text-[#ff007a]" />,
          title: 'Esperando chico',
          subtitle: 'Sala lista para conectar',
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
                {remoteParticipant ? 'Cámara apagada' : 'Esperando'}
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
                <div className="text-gray-500 text-xs font-medium">Cámara apagada</div>
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
              <div className="text-gray-400 text-xs font-medium">Iniciando cámara...</div>
            </div>
          </div>
        );
      }
    } catch (error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0d10] to-[#131418] relative rounded-xl border-2 border-gray-700/50">
          <div className="relative z-10 text-center p-2">
            <CameraOff size={20} className="text-gray-500 mx-auto mb-2" />
            <div className="text-gray-500 text-xs font-medium">Cámara apagada</div>
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
