import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Mic, X, RotateCcw, Volume2, Settings, Check, RefreshCw } from 'lucide-react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';

/**
 * Componente de configuración de cámara y audio
 * Se integra con LiveKit para cambiar dispositivos en tiempo real
 */


const isLocalVideoElement = (video) => {
  if (!video) {
    return false;
  }
  const lkLocal = video.getAttribute('data-lk-local-participant');
  if (lkLocal !== null) {
    return lkLocal === 'true';
  }
  const participant = video.getAttribute('data-participant');
  if (participant !== null) {
    return participant === 'local';
  }
  return true;
};

const applyMirrorToVideo = (video, shouldMirror) => {
  if (!video || !video.style) {
    return;
  }
  const shouldApplyMirror = shouldMirror && isLocalVideoElement(video);
  const transformValue = shouldApplyMirror ? 'scaleX(-1)' : 'scaleX(1)';

  video.style.transform = transformValue;
  video.style.webkitTransform = transformValue;
};

const applyMirrorToAllVideos = (shouldMirror) => {
  const selectors = [
    '[data-lk-participant-video]',
    'video[data-participant="local"]',
    '.local-video video',
    '[data-testid="participant-video"]',
    'video[autoplay][muted]',
    '.participant-video video'
  ];

  selectors.forEach((selector) => {
    const videos = document.querySelectorAll(selector);
    videos.forEach((video) => {
      applyMirrorToVideo(video, shouldMirror);
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
            applyMirrorToVideo(node, shouldMirror);
          }

          const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
          videos.forEach((video) => {
            applyMirrorToVideo(video, shouldMirror);
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

const CameraAudioSettings = ({ 
  isOpen, 
  onClose, 
  cameraEnabled, 
  micEnabled, 
  setCameraEnabled, 
  setMicEnabled, 
  mirrorMode,
  setMirrorMode,
  onMirrorToggle
}) => {
  // Hooks de LiveKit
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  // Estados para dispositivos
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applyingToMain, setApplyingToMain] = useState(false); // Nuevo estado para indicar cuando se aplica al principal

  // Estados de configuración actuales
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const isFlipped = mirrorMode;
  const setIsFlipped = setMirrorMode;
  const [volume, setVolume] = useState(80);
  const [isTesting, setIsTesting] = useState({ mic: false, speaker: false });
  const [countdown, setCountdown] = useState(0); // Nuevo estado para mostrar countdown
  const [previewApplied, setPreviewApplied] = useState(false); // Nuevo estado para saber si ya se aplicó el cambio

  // Referencias
  const videoRef = useRef(null);
  const previewStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micTestIntervalRef = useRef(null);
  const isChangingDeviceRef = useRef(false);

  // Obtener dispositivos disponibles
  const getDevices = async () => {
    try {
      setLoading(true);
      
      // Pedir permisos primero
      const tempStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      tempStream.getTracks().forEach(track => track.stop());

      // Enumerar dispositivos
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');
      
      setCameras(videoDevices);
      setMicrophones(audioInputDevices);
      setSpeakers(audioOutputDevices);

      // Obtener dispositivos actuales de LiveKit si están disponibles
      if (localParticipant) {
        const videoTrackPub = Array.from(localParticipant.videoTrackPublications.values())[0];
        const audioTrackPub = Array.from(localParticipant.audioTrackPublications.values())[0];
        
        if (videoTrackPub?.track?.mediaStreamTrack) {
          const settings = videoTrackPub.track.mediaStreamTrack.getSettings();
          if (settings.deviceId && !selectedCamera) {
            setSelectedCamera(settings.deviceId);
          }
        }
        
        if (audioTrackPub?.track?.mediaStreamTrack) {
          const settings = audioTrackPub.track.mediaStreamTrack.getSettings();
          if (settings.deviceId && !selectedMicrophone) {
            setSelectedMicrophone(settings.deviceId);
          }
        }
      }

      // Si no hay dispositivos seleccionados, usar los primeros disponibles
      if (!selectedCamera && videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      if (!selectedMicrophone && audioInputDevices.length > 0) {
        setSelectedMicrophone(audioInputDevices[0].deviceId);
      }
      if (!selectedSpeaker && audioOutputDevices.length > 0) {
        setSelectedSpeaker(audioOutputDevices[0].deviceId);
      }

    } catch (error) {
          } finally {
      setLoading(false);
    }
  };

  // Limpiar preview después de aplicar cambio
  const clearPreviewAfterApply = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(track => track.stop());
      previewStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPreviewApplied(true);
  };

  // Reiniciar preview para nueva selección
  const resetPreviewForNewSelection = () => {
    setPreviewApplied(false);
  };
  const startCameraPreviewImmediate = async (deviceId) => {
    try {
            
      // Detener preview anterior
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(track => track.stop());
        previewStreamRef.current = null;
      }

      if (deviceId && videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: deviceId },
            width: { ideal: 320 },
            height: { ideal: 240 }
          },
          audio: false
        });
        
        previewStreamRef.current = stream;
        videoRef.current.srcObject = stream;
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.style.transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
            videoRef.current.style.webkitTransform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
          }
        }, 100);
        
              } else if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (error) {
          }
  };

  // Preview de cámara mejorado (para uso normal)
  const startCameraPreview = async () => {
    try {
      // No hacer preview si estamos cambiando dispositivos en LiveKit
      if (isChangingDeviceRef.current) {
        return;
      }

      // Detener preview anterior
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(track => track.stop());
        previewStreamRef.current = null;
      }

      if (selectedCamera && cameraEnabled && videoRef.current) {
                
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: selectedCamera },
            width: { ideal: 320 },
            height: { ideal: 240 }
          },
          audio: false
        });
        
        previewStreamRef.current = stream;
        videoRef.current.srcObject = stream;
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.style.transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
            videoRef.current.style.webkitTransform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
          }
        }, 100);
                
              } else if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (error) {
          }
  };

  // Cambiar cámara usando las APIs correctas de LiveKit
  const changeCameraInLiveKit = async (deviceId) => {
    try {
      if (!localParticipant || isChangingDeviceRef.current) return;

      isChangingDeviceRef.current = true;
      setLoading(true);
            
      // Detener preview temporalmente para evitar conflictos
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(track => track.stop());
        previewStreamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }

      // Método más directo usando las APIs de LiveKit
      try {
        // Opción 1: Usar switchActiveDevice si está disponible
        if (room && room.switchActiveDevice) {
          await room.switchActiveDevice('videoinput', deviceId);
                  } else {
          // Opción 2: Desactivar y reactivar con nuevo dispositivo
                    
          // Desactivar cámara actual
          await localParticipant.setCameraEnabled(false);
          
          // Esperar un momento
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Crear constraints con el nuevo dispositivo
          const constraints = {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          };
          
          // Reactivar con nuevo dispositivo
          await localParticipant.setCameraEnabled(true, { video: constraints });
          
                  }
        
      } catch (liveKitError) {
                
        // Fallback: Método manual con replaceTrack
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        const videoTrackPub = Array.from(localParticipant.videoTrackPublications.values())[0];
        
        if (videoTrackPub?.track) {
          const sender = videoTrackPub.track.sender;
          if (sender && sender.replaceTrack) {
            await sender.replaceTrack(newStream.getVideoTracks()[0]);
                      }
        }
        
        // Limpiar stream temporal
        newStream.getTracks().forEach(track => track.stop());
      }
      
    } catch (error) {
            
      // Último recurso: reiniciar completamente
      try {
        await localParticipant.setCameraEnabled(false);
        await new Promise(resolve => setTimeout(resolve, 300));
        await localParticipant.setCameraEnabled(true);
              } catch (fallbackError) {
              }
    } finally {
      setLoading(false);
      isChangingDeviceRef.current = false;
      
      // Reiniciar preview después de cambiar el dispositivo en LiveKit
      setTimeout(() => {
        if (cameraEnabled && selectedCamera) {
          startCameraPreview();
        }
      }, 1500); // Dar más tiempo para que LiveKit se estabilice
    }
  };

  // Cambiar micrófono usando las APIs correctas de LiveKit
  const changeMicrophoneInLiveKit = async (deviceId) => {
    try {
      if (!localParticipant || isChangingDeviceRef.current) return;

      isChangingDeviceRef.current = true;
      setLoading(true);
            
      try {
        // Opción 1: Usar switchActiveDevice si está disponible
        if (room && room.switchActiveDevice) {
          await room.switchActiveDevice('audioinput', deviceId);
                  } else {
          // Opción 2: Desactivar y reactivar con nuevo dispositivo
                    
          await localParticipant.setMicrophoneEnabled(false);
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const constraints = {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          };
          
          await localParticipant.setMicrophoneEnabled(true, { audio: constraints });
                  }
        
      } catch (liveKitError) {
                
        // Fallback manual
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { 
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        const audioTrackPub = Array.from(localParticipant.audioTrackPublications.values())[0];
        
        if (audioTrackPub?.track) {
          const sender = audioTrackPub.track.sender;
          if (sender && sender.replaceTrack) {
            await sender.replaceTrack(newStream.getAudioTracks()[0]);
                      }
        }
        
        newStream.getTracks().forEach(track => track.stop());
      }
      
    } catch (error) {
            
      // Fallback simple
      try {
        await localParticipant.setMicrophoneEnabled(false);
        await new Promise(resolve => setTimeout(resolve, 300));
        await localParticipant.setMicrophoneEnabled(true);
              } catch (fallbackError) {
              }
    } finally {
      setLoading(false);
      isChangingDeviceRef.current = false;
    }
  };

  // Funciones de toggle corregidas
  const handleCameraToggle = async (enabled) => {
    try {
      setCameraEnabled(enabled);
      await localParticipant?.setCameraEnabled(enabled);
      
      if (enabled && selectedCamera) {
        // Esperar un poco y reiniciar preview
        setTimeout(() => {
          startCameraPreview();
        }, 800);
      } else {
        // Limpiar preview si se desactiva
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach(track => track.stop());
          previewStreamRef.current = null;
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      }
    } catch (error) {
          }
  };

  const handleMicToggle = async (enabled) => {
    try {
      setMicEnabled(enabled);
      await localParticipant?.setMicrophoneEnabled(enabled);
    } catch (error) {
          }
  };

  // Manejar cambio de cámara con preview inmediato y aplicación retardada
  const handleCameraChange = async (deviceId) => {
    // Si ya se aplicó un cambio anterior, reiniciar el estado
    resetPreviewForNewSelection();
    
    setSelectedCamera(deviceId);
    
    // 1. INMEDIATAMENTE mostrar en la vista previa
        await startCameraPreviewImmediate(deviceId);
    
    // 2. Iniciar countdown visual
    if (cameraEnabled) {
      setApplyingToMain(true);
      let timeLeft = 7;
      setCountdown(timeLeft);
      
      const countdownInterval = setInterval(() => {
        timeLeft--;
        setCountdown(timeLeft);
        
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          setApplyingToMain(false);
          setCountdown(0);
        }
      }, 1000);
      
      // 3. Después de 7 segundos, aplicar al videochat principal
      setTimeout(async () => {
                await changeCameraInLiveKit(deviceId);
        setApplyingToMain(false);
        
        // 4. Limpiar preview después de aplicar
        setTimeout(() => {
          clearPreviewAfterApply();
        }, 1000); // Esperar 1 segundo adicional para que se vea que se aplicó
      }, 7000);
    }
  };

  // Manejar cambio de micrófono
  const handleMicrophoneChange = async (deviceId) => {
    setSelectedMicrophone(deviceId);
    if (micEnabled) {
      await changeMicrophoneInLiveKit(deviceId);
    }
  };

  // Test de micrófono con visualización de nivel
  const testMicrophone = async () => {
    try {
      setIsTesting(prev => ({ ...prev, mic: true }));

      if (selectedMicrophone) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: selectedMicrophone } },
          video: false
        });

        // Crear contexto de audio para analizar nivel
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Monitorear nivel de audio
        const checkAudioLevel = () => {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
                  };

        micTestIntervalRef.current = setInterval(checkAudioLevel, 100);

        // Detener test después de 3 segundos
        setTimeout(() => {
          clearInterval(micTestIntervalRef.current);
          stream.getTracks().forEach(track => track.stop());
          if (audioContextRef.current) {
            audioContextRef.current.close();
          }
          setIsTesting(prev => ({ ...prev, mic: false }));
        }, 3000);
      }
    } catch (error) {
            setIsTesting(prev => ({ ...prev, mic: false }));
    }
  };

  // Test de altavoces
  const testSpeakers = async () => {
    try {
      setIsTesting(prev => ({ ...prev, speaker: true }));

      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwgAw==';
      audio.volume = volume / 100;

      // Cambiar dispositivo de salida si es compatible
      if (audio.setSinkId && selectedSpeaker) {
        await audio.setSinkId(selectedSpeaker);
      }

      await audio.play();
      
      setTimeout(() => {
        setIsTesting(prev => ({ ...prev, speaker: false }));
      }, 2000);

    } catch (error) {
            setIsTesting(prev => ({ ...prev, speaker: false }));
    }
  };
 



  // Alternar cámara invertida
const toggleFlipCamera = () => {
  if (onMirrorToggle) {
    onMirrorToggle(); // Usar la función del VideoChat
  }
};


  // Guardar configuraciones (sin localStorage para artifacts)
  const saveSettings = async () => {
    const settings = {
      selectedCamera,
      selectedMicrophone,
      selectedSpeaker,
      isFlipped,
      volume
    };

    try {
      // En un entorno real, usarías localStorage aquí
      // localStorage.setItem('cameraAudioSettings', JSON.stringify(settings));
      
      // Aplicar configuraciones finales
      if (cameraEnabled && selectedCamera) {
        await changeCameraInLiveKit(selectedCamera);
      }
      if (micEnabled && selectedMicrophone) {
        await changeMicrophoneInLiveKit(selectedMicrophone);
      }
      
          } catch (error) {
          }
  };

  // Cargar configuraciones guardadas
  const loadSettings = () => {
    try {
      // En un entorno real, cargarías desde localStorage aquí
      // const savedSettings = localStorage.getItem('cameraAudioSettings');
      // if (savedSettings) {
      //   const settings = JSON.parse(savedSettings);
      //   setSelectedCamera(settings.selectedCamera || '');
      //   setSelectedMicrophone(settings.selectedMicrophone || '');
      //   setSelectedSpeaker(settings.selectedSpeaker || '');
      //   setIsFlipped(settings.isFlipped || false);
      //   setVolume(settings.volume || 80);
      // }
    } catch (error) {
          }
  };

  // Limpiar recursos
  const cleanup = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(track => track.stop());
      previewStreamRef.current = null;
    }
    if (micTestIntervalRef.current) {
      clearInterval(micTestIntervalRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // Reset preview applied state when closing
    setPreviewApplied(false);
  };

  // Efectos
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      getDevices();
    } else {
      cleanup();
    }
    
    return cleanup;
  }, [isOpen]);



// Aplicar espejo cuando cambie isFlipped
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
      videoRef.current.style.webkitTransform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
    }
  }, [isFlipped]);

  // Aplicar flip cuando cambie
  useEffect(() => {
    if (isFlipped) {
      const mainVideoElements = document.querySelectorAll('[data-lk-participant-video]');
      mainVideoElements.forEach(video => {
        if (video.style) {
          video.style.transform = 'scaleX(-1)';
        }
      });
    }
  }, [isFlipped]);

  if (!isOpen) return null;



  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1f2125] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-[#ff007a]/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#ff007a]/20">
          <div className="flex items-center gap-3">
            <Settings className="text-[#ff007a]" size={24} />
            <h2 className="text-xl font-semibold text-white">Configuración de Cámara y Audio</h2>
          </div>
          <button
            onClick={() => {
              saveSettings();
              onClose();
            }}
            className="text-gray-400 hover:text-white transition p-2"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Panel Izquierdo - Preview y Controles */}
            <div className="space-y-6">
              
              {/* Preview de Cámara */}
              <div className="bg-[#2b2d31] rounded-xl p-4">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Camera className="text-[#ff007a]" size={20} />
                  Vista Previa de Cámara
                </h3>
                
                <div className="relative bg-black/50 rounded-lg overflow-hidden aspect-video mb-4">
                  {/* Estado 1: Cambio ya aplicado - Pantalla negra con mensaje */}
                  {previewApplied ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <div className="text-center p-6">
                        <Check size={48} className="mx-auto mb-3 text-green-400" />
                        <p className="text-white font-medium mb-2">¡Cambio aplicado!</p>
                        <p className="text-sm text-gray-400 mb-4">La cámara se ha cambiado en tu videochat</p>
                        <button
                          onClick={resetPreviewForNewSelection}
                          className="bg-[#ff007a] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#ff007a]/80 transition"
                        >
                          Seleccionar otra cámara
                        </button>
                      </div>
                    </div>
                  ) 
                  /* Estado 2: Mostrando preview de cámara seleccionada */
                  : selectedCamera ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${isFlipped ? 'scale-x-[-1]' : ''}`}
                    />
                  ) 
                  /* Estado 3: Ninguna cámara seleccionada */
                  : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <Camera size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="text-lg font-medium text-white mb-1">Selecciona el dispositivo que quieres</p>
                        <p className="text-sm">Elige una cámara de la lista de la derecha</p>
                      </div>
                    </div>
                  )}
                  
                  {loading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <RefreshCw className="animate-spin text-[#ff007a]" size={32} />
                    </div>
                  )}
                  
                  {/* Indicator de aplicación pendiente */}
                  {applyingToMain && countdown > 0 && !previewApplied && (
                    <div className="absolute top-2 right-2 bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      Aplicando en {countdown}s
                    </div>
                  )}
                  
                  {/* Indicator de preview activo */}
                  {selectedCamera && !cameraEnabled && !previewApplied && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Vista Previa
                    </div>
                  )}
                  
                  {/* Indicator de éxito temporal */}
                  {!applyingToMain && !loading && selectedCamera && cameraEnabled && countdown === 0 && !previewApplied && (
                    <div className="absolute top-2 left-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                      <Check size={14} />
                      Listo para aplicar
                    </div>
                  )}
                </div>

                {/* Controles de Cámara */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCameraToggle(!cameraEnabled)}
                    disabled={loading}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition disabled:opacity-50 ${
                      cameraEnabled 
                        ? 'bg-[#ff007a] text-white' 
                        : 'bg-gray-600 text-gray-300'
                    }`}
                  >
                    {cameraEnabled ? 'Desactivar' : 'Activar'} Cámara
                  </button>
                  
                  <button
                    onClick={toggleFlipCamera}
                    className={`px-4 py-2 rounded-lg border transition ${
                      isFlipped 
                        ? 'border-[#ff007a] text-[#ff007a] bg-[#ff007a]/10' 
                        : 'border-gray-600 text-gray-300 hover:border-[#ff007a] hover:text-[#ff007a]'
                    }`}
                    title="Invertir cámara horizontalmente"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>
              </div>

              {/* Test de Micrófono */}
              <div className="bg-[#2b2d31] rounded-xl p-4">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Mic className="text-[#ff007a]" size={20} />
                  Test de Micrófono
                </h3>
                
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMicToggle(!micEnabled)}
                      disabled={loading}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition disabled:opacity-50 ${
                        micEnabled 
                          ? 'bg-[#ff007a] text-white' 
                          : 'bg-gray-600 text-gray-300'
                      }`}
                    >
                      {micEnabled ? 'Desactivar' : 'Activar'} Micrófono
                    </button>
                    
                    <button
                      onClick={testMicrophone}
                      disabled={!selectedMicrophone || isTesting.mic}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isTesting.mic ? 'Probando...' : 'Probar'}
                    </button>
                  </div>
                  
                  {isTesting.mic && (
                    <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
                      <p className="text-green-400 text-sm">🎤 Habla ahora para probar el micrófono...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Test de Altavoces */}
              <div className="bg-[#2b2d31] rounded-xl p-4">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Volume2 className="text-[#ff007a]" size={20} />
                  Test de Altavoces
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-300">Volumen:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => setVolume(parseInt(e.target.value))}
                      className="flex-1 accent-[#ff007a]"
                    />
                    <span className="text-sm text-[#ff007a] font-medium w-12">{volume}%</span>
                  </div>
                  
                  <button
                    onClick={testSpeakers}
                    disabled={isTesting.speaker}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isTesting.speaker ? 'Reproduciendo...' : 'Probar Altavoces'}
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Derecho - Selección de Dispositivos */}
            <div className="space-y-6">
              
              {/* Selección de Cámara */}
              <div className="bg-[#2b2d31] rounded-xl p-4">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Camera className="text-[#ff007a]" size={20} />
                  Seleccionar Cámara
                </h3>
                
                <div className="space-y-2">
                  {cameras.map((camera) => (
                    <label key={camera.deviceId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#383c44] cursor-pointer transition">
                      <input
                        type="radio"
                        name="camera"
                        value={camera.deviceId}
                        checked={selectedCamera === camera.deviceId}
                        onChange={() => handleCameraChange(camera.deviceId)}
                        disabled={loading}
                        className="accent-[#ff007a]"
                      />
                      <span className="text-white text-sm flex-1">
                        {camera.label || `Cámara ${camera.deviceId.substring(0, 8)}...`}
                      </span>
                      {selectedCamera === camera.deviceId && (
                        <Check className="text-[#ff007a]" size={16} />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Selección de Micrófono */}
              <div className="bg-[#2b2d31] rounded-xl p-4">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Mic className="text-[#ff007a]" size={20} />
                  Seleccionar Micrófono
                </h3>
                
                <div className="space-y-2">
                  {microphones.map((microphone) => (
                    <label key={microphone.deviceId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#383c44] cursor-pointer transition">
                      <input
                        type="radio"
                        name="microphone"
                        value={microphone.deviceId}
                        checked={selectedMicrophone === microphone.deviceId}
                        onChange={() => handleMicrophoneChange(microphone.deviceId)}
                        disabled={loading}
                        className="accent-[#ff007a]"
                      />
                      <span className="text-white text-sm flex-1">
                        {microphone.label || `Micrófono ${microphone.deviceId.substring(0, 8)}...`}
                      </span>
                      {selectedMicrophone === microphone.deviceId && (
                        <Check className="text-[#ff007a]" size={16} />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Selección de Altavoces */}
              <div className="bg-[#2b2d31] rounded-xl p-4">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Volume2 className="text-[#ff007a]" size={20} />
                  Seleccionar Altavoces
                </h3>
                
                <div className="space-y-2">
                  {speakers.map((speaker) => (
                    <label key={speaker.deviceId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#383c44] cursor-pointer transition">
                      <input
                        type="radio"
                        name="speaker"
                        value={speaker.deviceId}
                        checked={selectedSpeaker === speaker.deviceId}
                        onChange={() => setSelectedSpeaker(speaker.deviceId)}
                        className="accent-[#ff007a]"
                      />
                      <span className="text-white text-sm flex-1">
                        {speaker.label || `Altavoz ${speaker.deviceId.substring(0, 8)}...`}
                      </span>
                      {selectedSpeaker === speaker.deviceId && (
                        <Check className="text-[#ff007a]" size={16} />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Botón Refrescar Dispositivos */}
              <button
                onClick={getDevices}
                disabled={loading}
                className="w-full py-3 px-4 bg-[#ff007a] text-white rounded-lg hover:bg-[#ff007a]/80 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
                {loading ? 'Actualizando...' : 'Refrescar Dispositivos'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[#ff007a]/20 bg-[#1a1c20]">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-300 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              saveSettings();
              onClose();
            }}
            className="px-6 py-2 bg-[#ff007a] text-white rounded-lg hover:bg-[#ff007a]/80 transition"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraAudioSettings;