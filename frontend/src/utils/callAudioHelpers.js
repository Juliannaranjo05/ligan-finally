/**
 * Helper functions for call audio management
 * These are pure functions that avoid Temporal Dead Zone issues
 * by being function declarations (hoisted) or exported functions
 */

import audioManager from './AudioManager.js';

/**
 * Play incoming call sound using AudioManager
 * @param {Object} refs - Object containing audioRef
 * @param {Function} setIncomingCallAudio - State setter for incoming call audio
 * @returns {Promise<void>}
 */
export async function playIncomingCallSound(audioRef, setIncomingCallAudio) {
  try {
    console.log('📞 [CallAudio] Iniciando reproducción de sonido de llamada entrante');
    
    // Usar AudioManager global (ya desbloqueado al inicio)
    const success = await audioManager.playRingtone();
    
    if (success) {
      // Guardar referencia para poder detenerlo después
      if (audioRef) {
        audioRef.current = audioManager.ringtoneAudio;
      }
      if (setIncomingCallAudio) {
        setIncomingCallAudio(audioManager.ringtoneAudio);
      }
      console.log('✅ [CallAudio] Ringtone reproduciendo (usando AudioManager)');
    } else {
      console.warn('⚠️ [CallAudio] No se pudo reproducir ringtone');
    }
  } catch (error) {
    console.error('❌ [CallAudio] Error en playIncomingCallSound:', error);
  }
}

/**
 * Stop incoming call sound
 * @param {Object} audioRef - Ref object for audio
 * @param {Function} setIncomingCallAudio - State setter for incoming call audio
 */
export function stopIncomingCallSound(audioRef, setIncomingCallAudio) {
  console.log('🛑 [CallAudio] Deteniendo sonido de llamada entrante');
  
  // Usar AudioManager global para detener ringtone
  audioManager.stopRingtone();
  
  // Limpiar referencias locales
  if (audioRef) {
    audioRef.current = null;
  }
  if (setIncomingCallAudio) {
    setIncomingCallAudio(null);
  }
  
  console.log('✅ [CallAudio] Sonido de llamada entrante detenido');
}

/**
 * Play outgoing call sound
 * @param {Object} outgoingAudioRef - Ref for outgoing audio element
 * @param {Object} outgoingPlayPromiseRef - Ref for play promise
 * @param {Function} setOutgoingCallAudio - State setter for outgoing call audio
 * @returns {Promise<void>}
 */
export async function playOutgoingCallSound(outgoingAudioRef, outgoingPlayPromiseRef, setOutgoingCallAudio) {
  try {
    console.log('📞 [CallAudio] Iniciando reproducción de sonido de llamada saliente');
    
    // Detener cualquier sonido anterior
    if (outgoingAudioRef?.current) {
      outgoingAudioRef.current.pause();
      outgoingAudioRef.current.currentTime = 0;
      outgoingAudioRef.current = null;
    }
    
    // Usar el sonido de llamada entrante (outgoing-call.mp3 no existe)
    const audio = new Audio('/sounds/incoming-call.mp3');
    audio.loop = true;
    audio.volume = 0.8;
    audio.preload = 'auto';
    
    // Agregar event listeners para debugging
    audio.addEventListener('loadstart', () => {
      console.log('📞 [CallAudio] Audio saliente: loadstart');
    });
    audio.addEventListener('canplay', () => {
      console.log('📞 [CallAudio] Audio saliente: canplay');
    });
    audio.addEventListener('play', () => {
      console.log('✅ [CallAudio] Audio saliente: play iniciado');
    });
    audio.addEventListener('error', (e) => {
      console.error('❌ [CallAudio] Error en audio element saliente:', e);
    });
    
    if (outgoingAudioRef) {
      outgoingAudioRef.current = audio;
    }
    if (setOutgoingCallAudio) {
      setOutgoingCallAudio(audio);
    }
    
    try {
      console.log('📞 [CallAudio] Intentando reproducir audio saliente...');
      // Guardar la promesa de play() para poder manejarla si se interrumpe
      const playPromise = audio.play();
      if (outgoingPlayPromiseRef) {
        outgoingPlayPromiseRef.current = playPromise;
      }
      await playPromise;
      if (outgoingPlayPromiseRef) {
        outgoingPlayPromiseRef.current = null;
      }
      console.log('✅ [CallAudio] Sonido de llamada saliente reproducido exitosamente');
    } catch (playError) {
      if (outgoingPlayPromiseRef) {
        outgoingPlayPromiseRef.current = null;
      }
      // Silenciar AbortError ya que es esperado cuando se interrumpe intencionalmente
      if (playError.name === 'AbortError') {
        console.log('ℹ️ [CallAudio] Reproducción de audio saliente interrumpida (esperado)');
        return;
      }
      // Silenciar NotAllowedError ya que es esperado cuando no hay interacción del usuario
      if (playError.name === 'NotAllowedError') {
        console.log('ℹ️ [CallAudio] Reproducción de audio saliente requiere interacción del usuario (esperado)');
        return;
      }
      // Solo mostrar warnings para otros errores
      console.warn('⚠️ [CallAudio] Error reproduciendo sonido de llamada saliente:', playError);
      console.warn('⚠️ [CallAudio] Detalles del error:', {
        name: playError.name,
        message: playError.message,
        stack: playError.stack
      });
    }
  } catch (error) {
    console.error('❌ [CallAudio] Error en playOutgoingCallSound:', error);
    console.error('❌ [CallAudio] Stack:', error.stack);
  }
}

/**
 * Stop outgoing call sound
 * @param {Object} outgoingPlayPromiseRef - Ref for play promise
 * @param {Object} outgoingAudioRef - Ref for outgoing audio element
 * @param {Function} setOutgoingCallAudio - State setter for outgoing call audio
 */
export function stopOutgoingCallSound(outgoingPlayPromiseRef, outgoingAudioRef, setOutgoingCallAudio) {
  // Manejar la promesa de play() pendiente si existe
  if (outgoingPlayPromiseRef?.current) {
    outgoingPlayPromiseRef.current.catch((error) => {
      // Silenciar AbortError ya que es esperado cuando se interrumpe intencionalmente
      if (error.name !== 'AbortError') {
        console.warn('⚠️ [CallAudio] Error en promesa de play() saliente interrumpida:', error);
      }
    });
    outgoingPlayPromiseRef.current = null;
  }
  
  if (outgoingAudioRef?.current) {
    outgoingAudioRef.current.pause();
    outgoingAudioRef.current.currentTime = 0;
    outgoingAudioRef.current = null;
  }
  
  // También limpiar el estado si existe
  if (setOutgoingCallAudio) {
    setOutgoingCallAudio(prev => {
      if (prev) {
        prev.pause();
        prev.currentTime = 0;
      }
      return null;
    });
  }
}

