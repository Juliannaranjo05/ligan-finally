import { useEffect, useRef } from 'react';
import { useLocalParticipant, useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";

const MediaControlsImproved = ({ 
  micEnabled, 
  cameraEnabled, 
  volumeEnabled, 
  setMicEnabled, 
  setCameraEnabled, 
  setVolumeEnabled,
  userData 
}) => {
  
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const lastVolumeState = useRef(null);
  // 🔥 REF para prevenir desactivación de cámara en modelo
  const isActivatingCamera = useRef(false);

  // 🎤 CONTROL DE MICRÓFONO
  useEffect(() => {
    if (!localParticipant || micEnabled === undefined) return;
    
        
    // MÉTODO 1: LiveKit nativo
    localParticipant.setMicrophoneEnabled(micEnabled).catch(error => {
          });

    // MÉTODO 2: Control directo de WebRTC Senders
    if (window.livekitRoom?.engine?.pcManager?.publisher?.pc) {
      const pc = window.livekitRoom.engine.pcManager.publisher.pc;
      const senders = pc.getSenders();
      
      let controlledSenders = 0;
      senders.forEach((sender, index) => {
        if (sender.track && sender.track.kind === 'audio') {
          const oldEnabled = sender.track.enabled;
          sender.track.enabled = micEnabled;
          
          if (oldEnabled !== micEnabled) {
            controlledSenders++;
                      }
        }
      });
      
      if (controlledSenders > 0) {
              }
    }
    
  }, [micEnabled, localParticipant]);

  // 🎥 CONTROL DE CÁMARA - OPTIMIZADO CON APLICACIÓN INMEDIATA
  useEffect(() => {
    if (!localParticipant || cameraEnabled === undefined) return;
    
    // 🔥 PARA MODELO: SIEMPRE MANTENER LA CÁMARA ENCENDIDA - NO PERMITIR DESACTIVARLA
    if (userData?.role === 'modelo') {
      // Prevenir múltiples activaciones simultáneas
      if (isActivatingCamera.current) {
        return; // Silenciosamente omitir si ya está activando
      }
      
      // Verificar estado actual en LiveKit
      const cameraPublication = Array.from(localParticipant.videoTrackPublications.values())
        .find(pub => pub.source === Track.Source.Camera);
      
      const isCurrentlyEnabled = cameraPublication?.isEnabled === true;
      const hasTrack = !!cameraPublication?.track;
      const hasActiveTrack = hasTrack && cameraPublication?.track?.isMuted === false;
      
      // 🔥 SOLO ACTIVAR SI REALMENTE NO ESTÁ ACTIVA Y NO HAY TRACK ACTIVO
      // Esto previene ciclos de activación/desactivación
      // IMPORTANTE: Si hay track pero está muted, NO reactivar inmediatamente - puede ser un mute temporal
      if (!isCurrentlyEnabled && !hasTrack) {
        isActivatingCamera.current = true;
        localParticipant.setCameraEnabled(true).then(() => {
          // NO actualizar estado React aquí para evitar re-renders innecesarios
          setTimeout(() => {
            isActivatingCamera.current = false;
          }, 3000); // 🔥 AUMENTADO A 3 segundos para dar más tiempo entre activaciones
        }).catch(error => {
          // Si es NotReadableError, esperar más tiempo antes de permitir otro intento
          const retryDelay = error.name === 'NotReadableError' ? 5000 : 3000;
          setTimeout(() => {
            isActivatingCamera.current = false;
          }, retryDelay);
        });
      } else if (isCurrentlyEnabled && hasActiveTrack && !cameraEnabled) {
        // Solo sincronizar estado React si LiveKit está activo con track activo pero React no
        setCameraEnabled(true);
      }
      
      // 🔥 IMPORTANTE: NO continuar ejecutando el código de abajo para modelo
      return;
    }
    
    // 🔥 SOLO PARA CLIENTES: Aplicar el estado de cameraEnabled normalmente
    
    // 🔥 APLICAR INMEDIATAMENTE sin delays
    localParticipant.setCameraEnabled(cameraEnabled).catch(error => {
    });
    
    // 🔥 VERIFICACIÓN INMEDIATA: Si se habilita, verificar que el track se publique
    if (cameraEnabled) {
      // Verificar inmediatamente si hay una publicación
      const checkPublication = () => {
        if (localParticipant.videoTrackPublications) {
          for (const [trackSid, publication] of localParticipant.videoTrackPublications.entries()) {
            if (publication.source === Track.Source.Camera) {
                // debug info (omitted)
                // const info = { trackSid, isEnabled: publication.isEnabled, hasTrack: !!publication.track };
                return true;
            }
          }
        }
        return false;
      };
      
      // Verificar inmediatamente
      if (!checkPublication()) {
        // Si no hay publicación inmediata, escuchar el evento
        const handleTrackPublished = (publication) => {
          if (publication.source === Track.Source.Camera) {
            localParticipant.off('trackPublished', handleTrackPublished);
          }
        };
        
        localParticipant.on('trackPublished', handleTrackPublished);
        
        // Timeout de seguridad (más corto)
        setTimeout(() => {
          localParticipant.off('trackPublished', handleTrackPublished);
          if (!checkPublication()) {
          }
        }, 1000);
      }
    }
    
  }, [cameraEnabled, localParticipant]);

  // 🔊 CONTROL DE VOLUMEN - VERSIÓN MEJORADA CON REINTENTOS
  useEffect(() => {
    // APLICAR CONTROL DE VOLUMEN TAMBIÉN PARA MODELOS
    // Antes se omitía para modelos; ahora queremos que el control de "audio de sala" afecte
    // tanto el audio remoto como, junto con DesktopControls, el micrófono local cuando corresponda.

    // ✅ APLICAR CONTROL INICIAL Y EN CAMBIOS
    const targetVolumeState = volumeEnabled !== false; // true por defecto si undefined

    const applyVolumeControl = () => {
      let controlledCount = 0;

      // MÉTODO 1: Control de TODOS los elementos HTML audio (incluidos autoplay)
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((audio, index) => {
        // ✅ CONTROLAR TODOS LOS AUDIOS (sin filtrar autoplay)
        const wasMuted = audio.muted;
        const wasVolume = audio.volume;

        audio.muted = !targetVolumeState;
        audio.volume = targetVolumeState ? 1 : 0;

        if (wasMuted !== audio.muted || wasVolume !== audio.volume) {
          controlledCount++;
        }
      });

      // MÉTODO 2: Control directo de WebRTC Receivers
      if (window.livekitRoom?.engine?.pcManager?.subscriber?.pc) {
        const pc = window.livekitRoom.engine.pcManager.subscriber.pc;
        const receivers = pc.getReceivers();

        receivers.forEach((receiver, index) => {
          if (receiver.track && receiver.track.kind === 'audio') {
            const wasEnabled = receiver.track.enabled;
            receiver.track.enabled = targetVolumeState;

            if (wasEnabled !== receiver.track.enabled) {
              controlledCount++;
            }
          }
        });
      }

      // MÉTODO 3: Control de audio tracks en videos
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach((video, index) => {
        if (video.srcObject) {
          const audioTracks = video.srcObject.getAudioTracks();
          audioTracks.forEach((track, trackIndex) => {
            // Solo tracks remotos (no micrófono local)
            if (!track.label.toLowerCase().includes('microphone')) {
              const wasEnabled = track.enabled;
              track.enabled = targetVolumeState;

              if (wasEnabled !== track.enabled) {
                controlledCount++;
              }
            }
          });
        }
      });

      // MÉTODO 4: Control via LiveKit remote participants
      if (remoteParticipants && remoteParticipants.length > 0) {
        remoteParticipants.forEach((participant, index) => {
          if (participant.audioTracks) {
            participant.audioTracks.forEach((trackPub, trackKey) => {
              if (trackPub.track) {
                try {
                  if (typeof trackPub.track.setEnabled === 'function') {
                    trackPub.track.setEnabled(targetVolumeState);
                    controlledCount++;
                  }
                } catch (error) {
                }
              }
            });
          }
        });
      }

      lastVolumeState.current = targetVolumeState;

      // 🔥 LOG SOLO SI HUBO CAMBIOS
      if (controlledCount > 0) {
      }

      return controlledCount;
    };

    // Aplicar control inmediatamente
    const controlled = applyVolumeControl();

    // Si no se controló nada, reintentar después de delays progresivos
    if (controlled === 0) {
      const retryDelays = [500, 1000, 2000, 3000];

      retryDelays.forEach((delay, index) => {
        setTimeout(() => {
          if (applyVolumeControl() > 0) {
          }
        }, delay);
      });
    }

  }, [volumeEnabled, remoteParticipants, userData?.role]); // ✅ Se ejecuta siempre que cambie volumeEnabled

  // 🔄 SINCRONIZACIÓN DE ESTADOS - MEJORADA CON VERIFICACIÓN REAL
  useEffect(() => {
    if (!localParticipant) return;
    
    // 🔥 FUNCIÓN PARA VERIFICAR ESTADO REAL DEL TRACK - MEJORADA
    const verifyCameraState = () => {
      if (!setCameraEnabled) return;
      
      // 🔥 PARA MODELO: LA CÁMARA SIEMPRE DEBE ESTAR ENCENDIDA
      if (userData?.role === 'modelo') {
        // Si la cámara está apagada, activarla automáticamente
        if (!cameraEnabled) {
          setCameraEnabled(true);
          return;
        }
        
        // Verificar que haya una publicación activa, si no, intentar activar
        const hasActivePublication = localParticipant.videoTrackPublications && 
          Array.from(localParticipant.videoTrackPublications.values()).some(
            pub => pub.source === Track.Source.Camera && pub.isEnabled
          );
        
        if (!hasActivePublication && cameraEnabled) {
          // Intentar reactivar la cámara
          localParticipant.setCameraEnabled(true).catch(error => {
          });
        }
        
        // Siempre asegurar que el estado sea true para modelo
        if (!cameraEnabled) {
          setCameraEnabled(true);
        }
        return;
      }
      
      // Verificar publicaciones de video (solo para clientes)
      if (localParticipant.videoTrackPublications) {
        for (const [trackSid, publication] of localParticipant.videoTrackPublications.entries()) {
          if (publication.source === Track.Source.Camera) {
            // 🔥 VERIFICAR ESTADO REAL: Si hay publicación, la cámara está activa (incluso si el track aún no está listo)
            const hasTrack = !!publication.track;
            const isEnabled = publication.isEnabled !== false;
            const trackEnabled = publication.track?.enabled !== false;
            const isSubscribed = publication.isSubscribed !== false;
            
            // 🔥 CRITERIO MEJORADO: Si hay publicación activa (incluso sin track aún), la cámara está ON
            // Esto corrige el problema donde la cámara está enviando pero el estado dice que está apagada
            if (isEnabled && isSubscribed) {
              // Si hay track, verificar que esté habilitado
              if (hasTrack) {
                if (trackEnabled) {
                  setCameraEnabled(true);
                  return;
                }
              } else {
                // Si no hay track aún pero la publicación está activa, la cámara está inicializándose pero activa
                setCameraEnabled(true);
                return;
              }
            }
          }
        }
      }
      
      // 🔥 Si no hay publicación activa, verificar si realmente debería estar apagada
      // Solo marcar como apagada si realmente no hay ninguna publicación
      const hasAnyCameraPublication = localParticipant.videoTrackPublications && 
        Array.from(localParticipant.videoTrackPublications.values()).some(
          pub => pub.source === Track.Source.Camera
        );
      
      if (!hasAnyCameraPublication) {
        // No hay publicación, verificar si el estado actual es diferente
        // No forzar a false si el usuario no lo ha hecho explícitamente
      }
    };
    
    const verifyMicState = () => {
      if (!setMicEnabled) return;
      
      // 🔥 RESPETAR LA DECISIÓN DEL USUARIO: Si el micrófono está desactivado explícitamente, no reactivarlo
      if (micEnabled === false) {
        return; // No verificar ni reactivar si el usuario lo desactivó
      }
      
      // Verificar publicaciones de audio
      if (localParticipant.audioTrackPublications) {
        for (const [trackSid, publication] of localParticipant.audioTrackPublications.entries()) {
          const hasTrack = !!publication.track;
          const isEnabled = publication.isEnabled !== false;
          const trackEnabled = publication.track?.enabled !== false;
          const isMuted = publication.track?.isMuted === true;
          
          // 🔥 SOLO reactivar si hay publicación activa, track habilitado Y NO está muted
          // Si está muted, significa que el usuario lo desactivó explícitamente
          if (hasTrack && isEnabled && trackEnabled && !isMuted) {
            setMicEnabled(true);
            return;
          }
        }
      }
    };
    
    const handleTrackMuted = (track) => {
      // 🔥 NO ACTUALIZAR INMEDIATAMENTE - Verificar estado real primero
      
      // 🔥 PARA MODELO: Si la cámara se mutea, esperar un momento antes de reactivar
      // Esto previene reacciones excesivas a mutes temporales (como durante cambios de dispositivo)
      if (track.kind === 'video' && userData?.role === 'modelo') {
        // Prevenir múltiples reactivaciones simultáneas
        if (isActivatingCamera.current) {
          return;
        }
        
        // 🔥 ESPERAR 1 segundo antes de reactivar - puede ser un mute temporal durante cambio de dispositivo
        setTimeout(() => {
          // Verificar nuevamente antes de reactivar
          const cameraPublication = Array.from(localParticipant.videoTrackPublications.values())
            .find(pub => pub.source === Track.Source.Camera);
          
          // Solo reactivar si realmente está muted y no hay otra activación en progreso
          if (cameraPublication && cameraPublication.track?.isMuted && !isActivatingCamera.current) {
            isActivatingCamera.current = true;
            localParticipant.setCameraEnabled(true).then(() => {
              setTimeout(() => {
                isActivatingCamera.current = false;
              }, 3000);
            }).catch(error => {
              const retryDelay = error.name === 'NotReadableError' ? 5000 : 3000;
              setTimeout(() => {
                isActivatingCamera.current = false;
              }, retryDelay);
            });
            setCameraEnabled(true);
          }
        }, 1000); // 🔥 ESPERAR 1 segundo para evitar reacciones excesivas
        return;
      }
      
      // Verificar después de un breve delay para asegurar que el estado sea real (solo para clientes)
      setTimeout(() => {
        if (track.kind === 'audio') {
          verifyMicState();
        } else if (track.kind === 'video' && userData?.role !== 'modelo') {
          // Solo verificar para clientes, no para modelo
          verifyCameraState();
        }
      }, 100);
    };

    const handleTrackUnmuted = (track) => {
      // 🔥 ACTUALIZAR cuando se desmutea, pero solo si el estado actual no está explícitamente desactivado
      
      if (track.kind === 'audio' && setMicEnabled) {
        // Solo actualizar si no está explícitamente desactivado por el usuario
        if (micEnabled !== false) {
          setMicEnabled(true);
        }
      } else if (track.kind === 'video' && setCameraEnabled) {
        setCameraEnabled(true);
      }
    };
    
    // 🔥 ESCUCHAR EVENTOS DE PUBLICACIÓN para detectar cuando se publica un track
    const handleTrackPublished = (publication) => {
      
      // 🔥 PARA MODELO: Si se publica un track de cámara, asegurar que esté activo
      if (publication.kind === 'video' && publication.source === Track.Source.Camera && userData?.role === 'modelo') {
        // Asegurar que el estado React esté en true
        if (!cameraEnabled) {
          setCameraEnabled(true);
        }
        // Asegurar que esté activo en LiveKit
        if (!publication.isEnabled) {
          localParticipant.setCameraEnabled(true).catch(error => {
          });
        }
        // NO llamar a verifyCameraState para modelo - puede interferir
        return;
      }
      
      // Verificar estado después de que se publique (solo para clientes)
      setTimeout(() => {
        if (publication.kind === 'video' && publication.source === Track.Source.Camera && userData?.role !== 'modelo') {
          verifyCameraState();
        } else if (publication.kind === 'audio') {
          verifyMicState();
        }
      }, 200);
    };

    localParticipant.on('trackMuted', handleTrackMuted);
    localParticipant.on('trackUnmuted', handleTrackUnmuted);
    localParticipant.on('trackPublished', handleTrackPublished);

    // 🔥 VERIFICACIÓN INICIAL del estado real (con delay para asegurar que los tracks estén listos)
    // Para modelo, NO verificar cámara aquí - se maneja en el efecto de control y monitor especial
    setTimeout(() => {
      if (userData?.role !== 'modelo') {
        verifyCameraState();
      }
      verifyMicState();
    }, 1000); // 🔥 AUMENTADO A 1 segundo para dar tiempo a que se estabilice
    
    // 🔥 VERIFICACIÓN PERIÓDICA para mantener sincronización (menos frecuente para modelo)
    const verifyInterval = setInterval(() => {
      // Para modelo, solo verificar micrófono periódicamente, NO cámara
      // La cámara de la modelo se maneja en el monitor especial con menos frecuencia
      if (userData?.role !== 'modelo') {
        verifyCameraState();
      }
      verifyMicState();
    }, 3000); // 🔥 AUMENTADO A 3 segundos para reducir interferencias

    return () => {
      localParticipant.off('trackMuted', handleTrackMuted);
      localParticipant.off('trackUnmuted', handleTrackUnmuted);
      localParticipant.off('trackPublished', handleTrackPublished);
      clearInterval(verifyInterval);
    };
  }, [localParticipant, setMicEnabled, setCameraEnabled, cameraEnabled, userData?.role]);

  // 🔥 EFECTO ESPECIAL PARA MODELO: Monitorear constantemente que la cámara esté encendida
  useEffect(() => {
    if (!localParticipant || userData?.role !== 'modelo') return;
    
    // 🔥 Verificar cada 3 segundos (menos frecuente para evitar interferencias)
    const modelCameraMonitor = setInterval(() => {
      // Prevenir múltiples activaciones simultáneas
      if (isActivatingCamera.current) {
        return; // Silenciosamente omitir si ya está activando
      }
      
      // Verificar estado real de LiveKit
      const cameraPublications = localParticipant.videoTrackPublications ? 
        Array.from(localParticipant.videoTrackPublications.values()).filter(
          pub => pub.source === Track.Source.Camera
        ) : [];
      
      const hasActivePublication = cameraPublications.some(pub => pub.isEnabled && pub.track);
      const hasAnyPublication = cameraPublications.length > 0;
      
      // 🔥 SOLO REACTIVAR SI REALMENTE NO HAY PUBLICACIÓN ACTIVA Y NO HAY TRACK
      // Esto previene ciclos de activación/desactivación
      // IMPORTANTE: Verificar también si hay track pero está muted (puede ser temporal)
      const hasMutedTrack = cameraPublications.some(pub => pub.track && pub.track.isMuted);
      
      if (!hasActivePublication && !hasAnyPublication && !isActivatingCamera.current) {
        isActivatingCamera.current = true;
        localParticipant.setCameraEnabled(true).then(() => {
          setTimeout(() => {
            isActivatingCamera.current = false;
          }, 5000); // 🔥 AUMENTADO A 5 segundos para dar más tiempo entre activaciones
        }).catch(error => {
          // Si es NotReadableError, esperar más tiempo
          const retryDelay = error.name === 'NotReadableError' ? 8000 : 5000;
          setTimeout(() => {
            isActivatingCamera.current = false;
          }, retryDelay);
        });
      } else if (hasActivePublication && !cameraEnabled) {
        // Solo sincronizar estado React si LiveKit está activo pero React no
        setCameraEnabled(true);
      } else if (hasMutedTrack && !isActivatingCamera.current) {
        // Si hay track pero está muted, esperar un poco más antes de reactivar
        // Puede ser un mute temporal durante cambio de dispositivo
      }
    }, 5000); // 🔥 AUMENTADO A 5 segundos para reducir interferencias y ciclos
    
    return () => {
      clearInterval(modelCameraMonitor);
    };
  }, [localParticipant, cameraEnabled, userData?.role]);

  // ✅ CONTROL INICIAL AL MONTAR (CRÍTICO)
  useEffect(() => {
    if (userData?.role === 'modelo') return;
    
    // Aplicar control inicial después de un breve delay
    const initTimer = setTimeout(() => {
            
      // Forzar el estado de volumen inicial
      const targetState = volumeEnabled !== false;
      
      // Control de todos los audios
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((audio, index) => {
        audio.muted = !targetState;
        audio.volume = targetState ? 1 : 0;
              });
      
      // Control de WebRTC Receivers
      if (window.livekitRoom?.engine?.pcManager?.subscriber?.pc) {
        const pc = window.livekitRoom.engine.pcManager.subscriber.pc;
        const receivers = pc.getReceivers();
        
        receivers.forEach((receiver, index) => {
          if (receiver.track && receiver.track.kind === 'audio') {
            receiver.track.enabled = targetState;
                      }
        });
      }
      
    }, 1000);

    return () => clearTimeout(initTimer);
  }, [localParticipant, volumeEnabled, userData?.role]);

  // 🧹 CLEANUP al desmontar
  useEffect(() => {
    return () => {
      // Restaurar audio al desmontar (solo si era usuario)
      if (userData?.role !== 'modelo') {
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
          audio.muted = false;
          audio.volume = 1;
        });
              }
    };
  }, [userData?.role]);

  // 🔄 MONITOREO CONTINUO (solo si volumeEnabled es false)
  useEffect(() => {
    if (userData?.role === 'modelo' || volumeEnabled !== false) return;

        
    const monitorInterval = setInterval(() => {
      let foundActiveAudio = false;
      
      // Verificar elementos audio
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((audio, index) => {
        if (!audio.muted || audio.volume > 0) {
                    audio.muted = true;
          audio.volume = 0;
          foundActiveAudio = true;
        }
      });
      
      // Verificar WebRTC Receivers
      if (window.livekitRoom?.engine?.pcManager?.subscriber?.pc) {
        const pc = window.livekitRoom.engine.pcManager.subscriber.pc;
        const receivers = pc.getReceivers();
        
        receivers.forEach((receiver, index) => {
          if (receiver.track && receiver.track.kind === 'audio' && receiver.track.enabled) {
                        receiver.track.enabled = false;
            foundActiveAudio = true;
          }
        });
      }
      
      if (foundActiveAudio) {
              }
      
    }, 3000); // Cada 3 segundos

    return () => {
            clearInterval(monitorInterval);
    };
  }, [volumeEnabled, userData?.role]);

  return null;
};

export default MediaControlsImproved;