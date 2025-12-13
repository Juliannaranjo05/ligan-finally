// hooks/useMediaDevices.js
import { useState, useEffect, useCallback } from 'react';

export const useMediaDevices = (room = null, localParticipant = null) => {
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentAudioDevice, setCurrentAudioDevice] = useState('');
  const [currentVideoDevice, setCurrentVideoDevice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Función para solicitar permisos
  const requestPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      
      // Detener el stream temporal
      stream.getTracks().forEach(track => track.stop());
      setPermissionsGranted(true);
      return true;
    } catch (error) {
            setPermissionsGranted(false);
      return false;
    }
  }, []);

  // Función principal para actualizar dispositivos
  const updateDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      // Solicitar permisos si no los tenemos
      if (!permissionsGranted) {
        const granted = await requestPermissions();
        if (!granted) {
          console.warn('Permisos no concedidos, no se pueden obtener etiquetas de dispositivos');
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices.filter(device => 
        device.kind === 'audioinput' && 
        device.deviceId !== 'default' &&
        device.deviceId !== 'communications'
      );
      
      const videoInputs = devices.filter(device => 
        device.kind === 'videoinput'
      );

            
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // Establecer dispositivo predeterminado si no hay uno seleccionado
      if (audioInputs.length > 0 && !currentAudioDevice) {
        setCurrentAudioDevice(audioInputs[0].deviceId);
              }

      if (videoInputs.length > 0 && !currentVideoDevice) {
        setCurrentVideoDevice(videoInputs[0].deviceId);
              }

    } catch (error) {
          } finally {
      setIsLoading(false);
    }
  }, [permissionsGranted, currentAudioDevice, currentVideoDevice, requestPermissions]);

  // Función para cambiar dispositivo de audio
  const switchAudioDevice = useCallback(async (deviceId) => {
    try {
            setCurrentAudioDevice(deviceId);

      if (localParticipant?.switchActiveDevice) {
        // Método LiveKit
        await localParticipant.switchActiveDevice('audioinput', deviceId);
                return true;
      } else if (room?.switchActiveDevice) {
        // Método Room
        await room.switchActiveDevice('audioinput', deviceId);
                return true;
      } else {
        // Método manual - necesitarás implementar esto en tu videochat
                return false;
      }
    } catch (error) {
            return false;
    }
  }, [localParticipant, room]);

  // Función para cambiar dispositivo de video
  const switchVideoDevice = useCallback(async (deviceId) => {
    try {
            setCurrentVideoDevice(deviceId);

      if (localParticipant?.switchActiveDevice) {
        // Método LiveKit
        await localParticipant.switchActiveDevice('videoinput', deviceId);
                return true;
      } else if (room?.switchActiveDevice) {
        // Método Room
        await room.switchActiveDevice('videoinput', deviceId);
                return true;
      } else {
        // Método manual - necesitarás implementar esto en tu videochat
                return false;
      }
    } catch (error) {
            return false;
    }
  }, [localParticipant, room]);

  // Efecto para inicializar y escuchar cambios
  useEffect(() => {
    updateDevices();

    // Listener para cambios de dispositivos (conectar/desconectar)
    const handleDeviceChange = () => {
            setTimeout(updateDevices, 1000); // Delay para que el sistema reconozca el cambio
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [updateDevices]);

  // Función para obtener el nombre del dispositivo actual
  const getCurrentAudioDeviceName = useCallback(() => {
    const device = audioDevices.find(d => d.deviceId === currentAudioDevice);
    return device?.label || `Micrófono ${currentAudioDevice?.slice(0, 8)}` || 'Desconocido';
  }, [audioDevices, currentAudioDevice]);

  const getCurrentVideoDeviceName = useCallback(() => {
    const device = videoDevices.find(d => d.deviceId === currentVideoDevice);
    return device?.label || `Cámara ${currentVideoDevice?.slice(0, 8)}` || 'Desconocido';
  }, [videoDevices, currentVideoDevice]);

  return {
    // Estados
    audioDevices,
    videoDevices,
    currentAudioDevice,
    currentVideoDevice,
    isLoading,
    permissionsGranted,
    
    // Funciones
    updateDevices,
    switchAudioDevice,
    switchVideoDevice,
    requestPermissions,
    getCurrentAudioDeviceName,
    getCurrentVideoDeviceName,
    
    // Setters directos (para casos especiales)
    setCurrentAudioDevice,
    setCurrentVideoDevice
  };
};