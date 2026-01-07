/**
 * AudioManager Global
 * 
 * Sistema de audio SIMPLE y FUNCIONAL
 * Desbloquea el audio con la primera interacción del usuario
 * Guarda el estado en localStorage para persistencia
 */

class AudioManager {
  constructor() {
    this.ringtoneAudio = null;
    this.remoteAudio = null;
    this.remoteAudio2 = null; // Audio del segundo modelo
    this.isUnlocked = false;
    this.unlockAudioElement = null; // Elemento audio para desbloquear
    this.ringtonePlayPromise = null; // Promesa de play() del ringtone
    
    // Verificar si ya está desbloqueado desde localStorage
    try {
      const storedUnlock = localStorage.getItem('audioUnlocked');
      if (storedUnlock === 'true') {
        this.isUnlocked = true;
      }
    } catch (e) {
      // Ignorar errores de localStorage
    }
  }

  /**
   * Inicializar AudioManager (llamar UNA VEZ al inicio de la app)
   */
  async initialize() {
    return true;
  }

  /**
   * Desbloquear audio DURANTE una interacción del usuario
   * Esta función DEBE llamarse durante un evento de click/touch/etc.
   */
  async unlockAudio() {
    if (this.isUnlocked) {
      return true;
    }

    try {

      // Crear elemento audio oculto y reproducirlo inmediatamente
      // Esto desbloquea el autoplay del navegador
      this.unlockAudioElement = new Audio();
      this.unlockAudioElement.volume = 0.01; // Casi silencioso
      this.unlockAudioElement.src = '/sounds/incoming-call.mp3';
      
      // Intentar reproducir inmediatamente (debe estar durante interacción del usuario)
      try {
        await this.unlockAudioElement.play();
        
        // Detener inmediatamente
        setTimeout(() => {
          if (this.unlockAudioElement) {
            this.unlockAudioElement.pause();
            this.unlockAudioElement.currentTime = 0;
          }
        }, 100);

        // Marcar como desbloqueado
        this.isUnlocked = true;
        localStorage.setItem('audioUnlocked', 'true');
        return true;
      } catch (playError) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Desbloquear audio durante cualquier interacción del usuario
   */
  async unlockOnUserInteraction() {
    if (this.isUnlocked) {
      return true;
    }

    return await this.unlockAudio();
  }

  /**
   * Verificar si el audio está desbloqueado
   */
  isAudioReady() {
    // Verificar memoria
    if (this.isUnlocked) {
      return true;
    }
    
    // Verificar localStorage
    try {
      const storedUnlock = localStorage.getItem('audioUnlocked');
      if (storedUnlock === 'true') {
        this.isUnlocked = true; // Sincronizar memoria
        return true;
      }
    } catch (e) {
      // Ignorar errores
    }
    
    return false;
  }

  /**
   * Reproducir ringtone de llamada entrante
   */
  async playRingtone() {
    try {
      // Verificar si está desbloqueado
      if (!this.isAudioReady()) {
        return false;
      }

      // Detener ringtone anterior si existe (esperar a que se detenga)
      if (this.ringtoneAudio) {
        try {
          // Si hay una promesa de play() pendiente, esperarla primero
          if (this.ringtonePlayPromise) {
            try {
              await this.ringtonePlayPromise;
            } catch (e) {
              // Ignorar AbortError al detener
            }
          }
          this.ringtoneAudio.pause();
          this.ringtoneAudio.currentTime = 0;
        } catch (e) {
          // Ignorar errores al detener
        }
      }

      // Crear nuevo ringtone
      this.ringtoneAudio = new Audio('/sounds/incoming-call.mp3');
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 0.8;
      this.ringtoneAudio.preload = 'auto';

      // Agregar listeners de eventos para debugging y manejo de errores
      return new Promise((resolve) => {
        let errorHandled = false;
        
        const handleError = (error) => {
          if (errorHandled) return;
          errorHandled = true;
          
          // Limpiar listeners
          this.ringtoneAudio.removeEventListener('error', handleError);
          this.ringtoneAudio.removeEventListener('canplay', handleCanPlay);
          
          const errorDetails = this.ringtoneAudio.error;
          if (errorDetails) {
            const errorInfo = {
              code: errorDetails.code,
              message: errorDetails.message,
              src: this.ringtoneAudio.src,
              readyState: this.ringtoneAudio.readyState
            };
            
            // Agregar códigos de error MediaError si están disponibles
            if (typeof MediaError !== 'undefined') {
              errorInfo.MEDIA_ERR_ABORTED = errorDetails.code === MediaError.MEDIA_ERR_ABORTED;
              errorInfo.MEDIA_ERR_NETWORK = errorDetails.code === MediaError.MEDIA_ERR_NETWORK;
              errorInfo.MEDIA_ERR_DECODE = errorDetails.code === MediaError.MEDIA_ERR_DECODE;
              errorInfo.MEDIA_ERR_SRC_NOT_SUPPORTED = errorDetails.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;
            }
            
          }
          
          resolve(false);
        };
        
        const handleCanPlay = async () => {
          if (errorHandled) return;
          
          // Limpiar listener de error ya que el audio se cargó correctamente
          this.ringtoneAudio.removeEventListener('error', handleError);
          this.ringtoneAudio.removeEventListener('canplay', handleCanPlay);
          
          // Reproducir (ya está desbloqueado, debería funcionar)
          try {
            // Guardar la promesa de play() para poder manejarla
            this.ringtonePlayPromise = this.ringtoneAudio.play();
            await this.ringtonePlayPromise;
            this.ringtonePlayPromise = null; // Limpiar después de completar
            resolve(true);
          } catch (error) {
            this.ringtonePlayPromise = null; // Limpiar en caso de error
            
            if (error.name === 'AbortError') {
              // AbortError es normal cuando se detiene el audio - no es un error real
              resolve(false);
            } else if (error.name === 'NotAllowedError') {
              // Si falla, el audio no está realmente desbloqueado - limpiar estado
              this.isUnlocked = false;
              localStorage.removeItem('audioUnlocked');
              resolve(false);
            } else {
              resolve(false);
            }
          }
        };
        
        // Agregar listeners
        this.ringtoneAudio.addEventListener('error', handleError);
        this.ringtoneAudio.addEventListener('canplay', handleCanPlay);
        
        // Si el audio ya está listo, ejecutar handleCanPlay inmediatamente
        if (this.ringtoneAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          handleCanPlay();
        } else {
          // Timeout de seguridad: si después de 3 segundos no se carga, considerar error
          setTimeout(() => {
            if (!errorHandled && this.ringtoneAudio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
              handleError(new Error('Timeout esperando que el audio se cargue'));
            }
          }, 3000);
        }
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Detener ringtone
   */
  stopRingtone() {
    if (this.ringtoneAudio) {
      // Si hay una promesa de play() pendiente, no esperarla - solo pausar
      // El AbortError es normal y esperado cuando se detiene el audio
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
      this.ringtonePlayPromise = null; // Limpiar la promesa
    }
  }

  /**
   * Obtener elemento audio para stream remoto
   */
  getRemoteAudioElement() {
    if (!this.remoteAudio) {
      this.remoteAudio = new Audio();
      this.remoteAudio.autoplay = true;
      this.remoteAudio.volume = 1.0;
    }
    return this.remoteAudio;
  }

  /**
   * Asignar stream remoto al elemento audio
   */
  setRemoteStream(stream) {
    const audioElement = this.getRemoteAudioElement();
    if (audioElement && stream) {
      audioElement.srcObject = stream;
      audioElement.play().catch(error => {
      });
    }
  }

  /**
   * Detener audio remoto
   */
  stopRemoteAudio() {
    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
    }
  }

  /**
   * Agregar segundo stream de audio (segundo modelo)
   */
  setSecondModelStream(stream) {
    if (!stream) {
      return;
    }

    // Crear elemento audio para segundo modelo si no existe
    if (!this.remoteAudio2) {
      this.remoteAudio2 = new Audio();
      this.remoteAudio2.autoplay = true;
      this.remoteAudio2.volume = 1.0;
    }

    this.remoteAudio2.srcObject = stream;
    
    // Intentar reproducir
    this.remoteAudio2.play().catch(err => {
      if (err.name !== 'AbortError') {
      }
    });

  }

  /**
   * Remover segundo stream de audio
   */
  removeSecondModelStream() {
    if (this.remoteAudio2) {
      this.remoteAudio2.pause();
      this.remoteAudio2.srcObject = null;
      this.remoteAudio2 = null;
    }
  }

  /**
   * Limpiar recursos
   */
  cleanup() {
    this.stopRingtone();
    this.stopRemoteAudio();
    this.removeSecondModelStream();
    
    if (this.unlockAudioElement) {
      this.unlockAudioElement.pause();
      this.unlockAudioElement = null;
    }
    
  }
}

// Singleton - una sola instancia global
const audioManager = new AudioManager();

export default audioManager;
