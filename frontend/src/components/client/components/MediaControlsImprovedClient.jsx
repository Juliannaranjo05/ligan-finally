import { useEffect, useRef } from 'react';
import { useLocalParticipant, useRemoteParticipants } from "@livekit/components-react";

const MediaControlsImprovedClient = ({ 
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

  // 🎤 CONTROL DE MICRÓFONO
  useEffect(() => {
    if (!localParticipant || micEnabled === undefined) return;
    
    console.log('🎤 [MediaControls] Micrófono:', micEnabled);
    
    // MÉTODO 1: LiveKit nativo
    localParticipant.setMicrophoneEnabled(micEnabled).catch(error => {
      console.warn('⚠️ Error controlando micrófono:', error);
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
            console.log(`🎯 [MediaControls] WebRTC Sender ${index}: ${oldEnabled} → ${micEnabled}`);
          }
        }
      });
      
      if (controlledSenders > 0) {
        console.log(`✅ [MediaControls] Controlados ${controlledSenders} WebRTC audio senders`);
      }
    }
    
  }, [micEnabled, localParticipant]);

  // 🎥 CONTROL DE CÁMARA
  useEffect(() => {
    if (!localParticipant || cameraEnabled === undefined) return;
    
    console.log('🎥 [MediaControls] Cámara:', cameraEnabled);
    
    localParticipant.setCameraEnabled(cameraEnabled).catch(error => {
      console.warn('⚠️ Error controlando cámara:', error);
    });
    
  }, [cameraEnabled, localParticipant]);

  // 🔊 CONTROL DE VOLUMEN - VERSIÓN CORREGIDA
  useEffect(() => {
    // 🚫 SI ES MODELO, NO CONTROLAR VOLUMEN
    
    // ✅ APLICAR CONTROL INICIAL Y EN CAMBIOS
    const targetVolumeState = volumeEnabled !== false; // true por defecto si undefined
    
    console.log(`🔊 [MediaControls] Controlando volumen: ${targetVolumeState}`);
    
    // MÉTODO 1: Control de TODOS los elementos HTML audio (incluidos autoplay)
    const audioElements = document.querySelectorAll('audio');
    let controlledCount = 0;
    
    audioElements.forEach((audio, index) => {
      // ✅ CONTROLAR TODOS LOS AUDIOS (sin filtrar autoplay)
      const wasMuted = audio.muted;
      const wasVolume = audio.volume;
      
      audio.muted = !targetVolumeState;
      audio.volume = targetVolumeState ? 1 : 0;
      
      if (wasMuted !== audio.muted || wasVolume !== audio.volume) {
        controlledCount++;
        console.log(`🎵 Audio ${index}: muted=${audio.muted}, volume=${audio.volume} (cambió)`);
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
            console.log(`📡 WebRTC Receiver ${index}: enabled=${receiver.track.enabled} (cambió)`);
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
              console.log(`🎬 Video ${index} Track ${trackIndex}: enabled=${track.enabled} (cambió)`);
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
                  console.log(`🎯 Participant ${index} Track: enabled=${targetVolumeState}`);
                }
              } catch (error) {
                console.warn('⚠️ Error controlando track de participante:', error);
              }
            }
          });
        }
      });
    }
    
    console.log(`✅ [MediaControls] Controlados ${controlledCount} elementos de audio`);
    lastVolumeState.current = targetVolumeState;
    
  }, [volumeEnabled, remoteParticipants, userData?.role]); // ✅ Se ejecuta siempre que cambie volumeEnabled

  // 🔄 SINCRONIZACIÓN DE ESTADOS
  useEffect(() => {
    if (!localParticipant) return;
    
    const handleTrackMuted = (track) => {
      if (track.kind === 'audio' && setMicEnabled) {
        console.log('🔇 Track audio muted - actualizando UI');
        setMicEnabled(false);
      } else if (track.kind === 'video' && setCameraEnabled) {
        console.log('📹 Track video muted - actualizando UI');
        setCameraEnabled(false);
      }
    };

    const handleTrackUnmuted = (track) => {
      if (track.kind === 'audio' && setMicEnabled) {
        console.log('🔊 Track audio unmuted - actualizando UI');
        setMicEnabled(true);
      } else if (track.kind === 'video' && setCameraEnabled) {
        console.log('📹 Track video unmuted - actualizando UI');
        setCameraEnabled(true);
      }
    };

    localParticipant.on('trackMuted', handleTrackMuted);
    localParticipant.on('trackUnmuted', handleTrackUnmuted);

    return () => {
      localParticipant.off('trackMuted', handleTrackMuted);
      localParticipant.off('trackUnmuted', handleTrackUnmuted);
    };
  }, [localParticipant, setMicEnabled, setCameraEnabled]);

  // ✅ CONTROL INICIAL AL MONTAR (CRÍTICO)
  useEffect(() => {
    if (userData?.role === 'modelo') return;
    
    // Aplicar control inicial después de un breve delay
    const initTimer = setTimeout(() => {
      console.log('🚀 [MediaControls] Control inicial de volumen al montar...');
      
      // Forzar el estado de volumen inicial
      const targetState = volumeEnabled !== false;
      
      // Control de todos los audios
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((audio, index) => {
        audio.muted = !targetState;
        audio.volume = targetState ? 1 : 0;
        console.log(`🎵 Init Audio ${index}: muted=${audio.muted}, volume=${audio.volume}`);
      });
      
      // Control de WebRTC Receivers
      if (window.livekitRoom?.engine?.pcManager?.subscriber?.pc) {
        const pc = window.livekitRoom.engine.pcManager.subscriber.pc;
        const receivers = pc.getReceivers();
        
        receivers.forEach((receiver, index) => {
          if (receiver.track && receiver.track.kind === 'audio') {
            receiver.track.enabled = targetState;
            console.log(`📡 Init Receiver ${index}: enabled=${receiver.track.enabled}`);
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
        console.log('🧹 [MediaControls] Audio restaurado al desmontar');
      }
    };
  }, [userData?.role]);

  // 🔄 MONITOREO CONTINUO (solo si volumeEnabled es false)
  useEffect(() => {
    if (userData?.role === 'modelo' || volumeEnabled !== false) return;

    console.log('👁️ [MediaControls] Iniciando monitoreo de audio entrante...');
    
    const monitorInterval = setInterval(() => {
      let foundActiveAudio = false;
      
      // Verificar elementos audio
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((audio, index) => {
        if (!audio.muted || audio.volume > 0) {
          console.warn(`🚨 Audio ${index} activo detectado!`);
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
            console.warn(`🚨 WebRTC Receiver ${index} activo detectado!`);
            receiver.track.enabled = false;
            foundActiveAudio = true;
          }
        });
      }
      
      if (foundActiveAudio) {
        console.log('🔧 [MediaControls] Audio rebelde silenciado automáticamente');
      }
      
    }, 3000); // Cada 3 segundos

    return () => {
      console.log('🛑 [MediaControls] Deteniendo monitoreo');
      clearInterval(monitorInterval);
    };
  }, [volumeEnabled, userData?.role]);

};

export default MediaControlsImprovedClient;