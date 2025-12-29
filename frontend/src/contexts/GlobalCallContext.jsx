import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import IncomingCallOverlay from '../components/IncomingCallOverlay';
import CallingSystem from '../components/CallingOverlay';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const GlobalCallContext = createContext(null);

export const useGlobalCall = () => {
  const context = useContext(GlobalCallContext);
  if (!context) {
    throw new Error('useGlobalCall must be used within GlobalCallProvider');
  }
  return context;
};

export const GlobalCallProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callPollingInterval, setCallPollingInterval] = useState(null);
  const [incomingCallAudio, setIncomingCallAudio] = useState(null);
  const [outgoingCallAudio, setOutgoingCallAudio] = useState(null);
  const audioRef = useRef(null);
  const outgoingAudioRef = useRef(null);
  
  // 🔥 REFS PARA CONTROL DE CONCURRENCIA Y POLLING
  const isCheckingRef = useRef(false); // Prevenir peticiones simultáneas
  const currentAbortControllerRef = useRef(null); // Para cancelar peticiones pendientes
  const incomingCallPollingIntervalRef = useRef(null); // 🔥 USAR REF EN LUGAR DE ESTADO PARA EVITAR LOOP INFINITO
  const consecutiveErrorsRef = useRef(0); // Para backoff exponencial
  const lastCheckTimeRef = useRef(0); // Para throttling
  
  // 🔥 DETECTAR SI ESTAMOS EN UNA VIDELLAMADA ACTIVA O EN RUTAS DE AUTENTICACIÓN
  const isInVideoChat = useMemo(() => {
    const path = location.pathname;
    return path === '/videochat' || path === '/videochatclient';
  }, [location.pathname]);
  
  // 🔥 DETECTAR SI ESTAMOS EN RUTAS DE AUTENTICACIÓN
  const isInAuthRoute = useMemo(() => {
    const path = location.pathname;
    return path === '/auth/google/callback' || 
           path === '/login' || 
           path === '/home' ||
           path.startsWith('/auth/');
  }, [location.pathname]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // 🔥 REPRODUCIR SONIDO DE LLAMADA ENTRANTE
  const playIncomingCallSound = async () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      const audio = new Audio('/sounds/incoming-call.mp3');
      audio.loop = true;
      audio.volume = 0.8;
      audio.preload = 'auto';
      
      audioRef.current = audio;
      setIncomingCallAudio(audio);
      
      try {
        await audio.play();
      } catch (playError) {
        if (playError.name === 'NotAllowedError') {
          console.warn('Reproducción de audio bloqueada por el navegador');
        }
      }
    } catch (error) {
      console.error('Error reproduciendo sonido de llamada entrante:', error);
    }
  };

  const stopIncomingCallSound = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (incomingCallAudio) {
      incomingCallAudio.pause();
      incomingCallAudio.currentTime = 0;
      setIncomingCallAudio(null);
    }
  };

  // 🔥 REPRODUCIR SONIDO DE LLAMADA SALIENTE
  const playOutgoingCallSound = async () => {
    try {
      if (outgoingAudioRef.current) {
        outgoingAudioRef.current.pause();
        outgoingAudioRef.current.currentTime = 0;
      }
      
      const audio = new Audio('/sounds/outgoing-call.mp3');
      // Si no existe, usar el sonido de llamada entrante como fallback
      audio.onerror = () => {
        const fallbackAudio = new Audio('/sounds/incoming-call.mp3');
        fallbackAudio.loop = true;
        fallbackAudio.volume = 0.6;
        fallbackAudio.preload = 'auto';
        outgoingAudioRef.current = fallbackAudio;
        setOutgoingCallAudio(fallbackAudio);
        fallbackAudio.play().catch(() => {
          console.warn('No se pudo reproducir sonido de llamada saliente');
        });
      };
      
      audio.loop = true;
      audio.volume = 0.6;
      audio.preload = 'auto';
      
      outgoingAudioRef.current = audio;
      setOutgoingCallAudio(audio);
      
      try {
        await audio.play();
      } catch (playError) {
        if (playError.name === 'NotAllowedError') {
          console.warn('Reproducción de audio bloqueada por el navegador');
        }
      }
    } catch (error) {
      console.error('Error reproduciendo sonido de llamada saliente:', error);
    }
  };

  // 🔥 DETENER SONIDO DE LLAMADA SALIENTE
  const stopOutgoingCallSound = () => {
    if (outgoingAudioRef.current) {
      outgoingAudioRef.current.pause();
      outgoingAudioRef.current.currentTime = 0;
      outgoingAudioRef.current = null;
    }
    if (outgoingCallAudio) {
      outgoingCallAudio.pause();
      outgoingCallAudio.currentTime = 0;
      setOutgoingCallAudio(null);
    }
  };

  // 🔥 VERIFICAR LLAMADAS ENTRANTES (GLOBAL) - OPTIMIZADO
  const verificarLlamadasEntrantes = useCallback(async () => {
    // 🔥 NO HACER POLLING SI ESTAMOS EN UNA VIDELLAMADA ACTIVA O EN RUTAS DE AUTENTICACIÓN
    if (isInVideoChat || isInAuthRoute) {
      return;
    }
    
    // 🔥 PREVENIR PETICIONES SIMULTÁNEAS
    if (isCheckingRef.current) {
      if (import.meta.env.DEV) {
        console.log('⏸️ [CALL] Polling ya en progreso, saltando...');
      }
      return;
    }
    
    // 🔥 THROTTLING: No hacer polling si la última petición fue hace menos de 3 segundos (reducido para respuesta más rápida)
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTimeRef.current;
    if (timeSinceLastCheck < 3000) {
      if (import.meta.env.DEV) {
        console.log('⏸️ [CALL] Throttling activo, esperando...', { timeSinceLastCheck });
      }
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        // No hay token válido, no hacer polling
        return;
      }

      // 🔥 CANCELAR PETICIÓN ANTERIOR SI EXISTE
      if (currentAbortControllerRef.current) {
        currentAbortControllerRef.current.abort();
      }

      // 🔥 MARCAR COMO EN PROGRESO
      isCheckingRef.current = true;
      lastCheckTimeRef.current = now;

      // 🔥 CREAR NUEVO ABORT CONTROLLER
      const controller = new AbortController();
      currentAbortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout de 8 segundos
      
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/api/calls/check-incoming`, {
          method: 'GET',
          headers: getAuthHeaders(),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        // 🔥 RESETEAR CONTADOR DE ERRORES SI LA PETICIÓN FUE EXITOSA
        consecutiveErrorsRef.current = 0;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name !== 'AbortError') {
          consecutiveErrorsRef.current += 1;
        }
        throw fetchError;
      } finally {
        // 🔥 LIBERAR FLAG
        isCheckingRef.current = false;
        if (currentAbortControllerRef.current === controller) {
          currentAbortControllerRef.current = null;
        }
      }

      if (response.ok) {
        const data = await response.json();
        
        // 🔥 LOGGEAR RESPUESTA COMPLETA (SIEMPRE PARA DEBUGGING)
        console.log('📞 [CALL] Verificando llamadas entrantes - Respuesta completa:', JSON.stringify(data, null, 2));
        
        if (data.has_incoming && data.incoming_call) {
          // 🔥 VERIFICAR SI ES UNA LLAMADA SALIENTE PROPIA
          // 1. Verificar si hay una llamada saliente activa con el mismo ID
          const isMyOutgoingCall = currentCall && 
                                  (String(currentCall.callId) === String(data.incoming_call.id) ||
                                   String(currentCall.id) === String(data.incoming_call.id));
          
          // 2. Obtener el ID del usuario actual desde localStorage
          let currentUserId = null;
          try {
            const userString = localStorage.getItem('user');
            if (userString) {
              const userData = JSON.parse(userString);
              currentUserId = userData?.id;
            }
          } catch (e) {
            console.error('❌ [CALL] Error obteniendo usuario desde localStorage:', e);
          }
          
          // 3. Verificar si el usuario es el caller comparando caller.id con user.id
          // 🔥 CONVERTIR A STRING PARA COMPARACIÓN SEGURA (pueden ser números o strings)
          const callerId = data.incoming_call.caller?.id ? String(data.incoming_call.caller.id) : null;
          const userIdStr = currentUserId ? String(currentUserId) : null;
          const isUserCaller = userIdStr && callerId && userIdStr === callerId;
          
          // 🔥 LOGGING DETALLADO DE TODAS LAS CONDICIONES (SIEMPRE PARA DEBUGGING)
          console.log('📞 [CALL] Evaluando llamada entrante:', {
            hasIncoming: data.has_incoming,
            incomingCall: data.incoming_call,
            isCallActive,
            isReceivingCall,
            isMyOutgoingCall,
            isUserCaller,
            currentCall: currentCall,
            currentCallId: currentCall?.callId,
            currentCallIdType: typeof currentCall?.callId,
            incomingCallId: data.incoming_call.id,
            incomingCallIdType: typeof data.incoming_call.id,
            currentUserId: currentUserId,
            currentUserIdType: typeof currentUserId,
            callerId: callerId,
            callerIdType: typeof data.incoming_call.caller?.id,
            callerInfo: data.incoming_call.caller,
            willShow: !isCallActive && !isReceivingCall && !isMyOutgoingCall && !isUserCaller
          });
          
          // 🔥 SOLO MOSTRAR SI NO HAY LLAMADA ACTIVA, NO ES UNA LLAMADA SALIENTE PROPIA, EL USUARIO NO ES EL CALLER, Y NO ESTÁ RECIBIENDO
          if (!isCallActive && !isReceivingCall && !isMyOutgoingCall && !isUserCaller) {
            console.log('✅ [CALL] Nueva llamada entrante detectada - Mostrando overlay:', {
              incomingCall: data.incoming_call,
              callerName: data.incoming_call.caller?.name || data.incoming_call.caller?.display_name,
              callId: data.incoming_call.id
            });
            setIncomingCall(data.incoming_call);
            setIsReceivingCall(true);
            await playIncomingCallSound();
          } else {
            // 🔥 LOGGING DETALLADO DE POR QUÉ SE IGNORA (SIEMPRE PARA DEBUGGING)
            console.log('⏸️ [CALL] Ignorando llamada entrante:', {
              reason: isMyOutgoingCall ? 'Es mi llamada saliente' :
                     isCallActive ? 'Hay llamada activa' :
                     isUserCaller ? 'Soy el caller' :
                     isReceivingCall ? 'Ya estoy recibiendo una llamada' : 'Razón desconocida',
              isMyOutgoingCall,
              isCallActive,
              isUserCaller,
              isReceivingCall,
              currentCallId: currentCall?.callId,
              incomingCallId: data.incoming_call.id,
              userId: currentUserId,
              callerId: data.incoming_call.caller?.id
            });
          }
        } else if (isReceivingCall && !data.has_incoming) {
          // 🔥 LIMPIAR SIEMPRE cuando no hay llamada entrante
          // Esto asegura que el estado se resetee correctamente
          console.log('📞 [CALL] Llamada entrante ya no disponible - Limpiando estado');
          setIsReceivingCall(false);
          setIncomingCall(null);
          stopIncomingCallSound();
        } else {
          // 🔥 LOGGEAR CUANDO NO HAY LLAMADA ENTRANTE (solo en modo debug)
          // Comentado para reducir ruido en consola - descomentar si necesitas debugging
          // console.log('📞 [CALL] No hay llamada entrante:', {
          //   hasIncoming: data.has_incoming,
          //   isReceivingCall,
          //   data: data
          // });
        }
      } else if (response.status === 401 || response.status === 403) {
        // 🔥 VERIFICAR SI ES SESIÓN SUSPENDIDA
        const errorData = await response.json().catch(() => ({}));
        const codigo = errorData.code || errorData.codigo || '';
        
        if (codigo === 'SESSION_SUSPENDED') {
          console.warn('⏸️ [CALL] Sesión suspendida detectada - cerrando inmediatamente');
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch (e) {}
          window.location.reload();
          return;
        }
        
        // Usuario no autenticado, no hacer polling
        console.warn('⚠️ [CALL] No autenticado, deteniendo verificación de llamadas');
        return;
      } else if (response.status === 500) {
        // Error del servidor, solo loggear sin interrumpir
        console.warn('⚠️ [CALL] Error del servidor verificando llamadas, ignorando');
      } else {
        console.error('❌ [CALL] Error verificando llamadas entrantes:', response.status, response.statusText);
      }
    } catch (error) {
      // 🔥 LIBERAR FLAG EN CASO DE ERROR
      isCheckingRef.current = false;
      if (currentAbortControllerRef.current) {
        currentAbortControllerRef.current = null;
      }
      
      // Solo loggear errores de red en desarrollo, no interrumpir el polling
      // Ignorar errores de aborto (timeout) y errores durante autenticación
      if (error.name !== 'AbortError' && !isInAuthRoute && import.meta.env.DEV) {
        console.warn('⚠️ [CALL] Error de red verificando llamadas, ignorando:', error.message, {
          consecutiveErrors: consecutiveErrorsRef.current
        });
      }
    }
  }, [isCallActive, isReceivingCall, isInVideoChat, isInAuthRoute, currentCall]);

  // 🔥 INICIAR POLLING DE LLAMADAS ENTRANTES (PAUSAR DURANTE VIDELLAMADAS Y AUTENTICACIÓN)
  useEffect(() => {
    // 🔥 NO INICIAR POLLING SI ESTAMOS EN UNA VIDELLAMADA ACTIVA O EN RUTAS DE AUTENTICACIÓN
    if (isInVideoChat || isInAuthRoute) {
      console.log('⏸️ [CALL] Polling pausado - en videochat o ruta de autenticación', {
        isInVideoChat,
        isInAuthRoute,
        path: window.location.pathname
      });
      // Limpiar intervalo existente si hay uno
      if (incomingCallPollingIntervalRef.current) {
        clearInterval(incomingCallPollingIntervalRef.current);
        incomingCallPollingIntervalRef.current = null;
      }
      return;
    }
    
    // 🔥 VERIFICAR QUE HAY TOKEN ANTES DE INICIAR POLLING
    const token = localStorage.getItem('token');
    if (!token || token === 'null' || token === 'undefined') {
      console.log('⏸️ [CALL] Polling no iniciado - sin token válido', {
        token: token ? 'existe' : 'no existe',
        tokenValue: token
      });
      return;
    }
    
    // 🔥 CALCULAR INTERVALO CON BACKOFF EXPONENCIAL
    // Intervalo base: 5 segundos (reducido para detectar llamadas más rápido)
    // Si hay errores consecutivos, aumentar el intervalo
    const baseInterval = 5000; // 5 segundos (reducido para respuesta más rápida)
    const backoffMultiplier = Math.min(1 + (consecutiveErrorsRef.current * 0.5), 3); // Máximo 3x
    const currentInterval = baseInterval * backoffMultiplier;
    
    if (import.meta.env.DEV && consecutiveErrorsRef.current > 0) {
      console.log(`🔄 [CALL] Usando backoff exponencial: ${currentInterval}ms (errores: ${consecutiveErrorsRef.current})`);
    }
    
    // 🔥 LIMPIAR INTERVALO ANTERIOR SI EXISTE
    if (incomingCallPollingIntervalRef.current) {
      clearInterval(incomingCallPollingIntervalRef.current);
    }
    
    const interval = setInterval(verificarLlamadasEntrantes, currentInterval);
    incomingCallPollingIntervalRef.current = interval; // 🔥 USAR REF EN LUGAR DE ESTADO
    
    console.log('🔄 [CALL] Polling de llamadas entrantes iniciado', {
      interval: currentInterval,
      isInVideoChat,
      isInAuthRoute,
      path: window.location.pathname
    });
    
    // 🔥 Verificar inmediatamente para detectar llamadas más rápido
    console.log('🔄 [CALL] Ejecutando primera verificación de llamadas entrantes');
    verificarLlamadasEntrantes();

    return () => {
      console.log('🛑 [CALL] Limpiando polling de llamadas entrantes');
      if (interval) clearInterval(interval);
      if (incomingCallPollingIntervalRef.current) {
        clearInterval(incomingCallPollingIntervalRef.current);
        incomingCallPollingIntervalRef.current = null;
      }
      // 🔥 CANCELAR PETICIÓN PENDIENTE AL DESMONTAR
      if (currentAbortControllerRef.current) {
        currentAbortControllerRef.current.abort();
        currentAbortControllerRef.current = null;
      }
      stopIncomingCallSound();
    };
  }, [verificarLlamadasEntrantes, isInVideoChat, isInAuthRoute]); // 🔥 REMOVIDO incomingCallPollingInterval DE DEPENDENCIAS

  // 🔥 INICIAR LLAMADA (GLOBAL)
  const startCall = useCallback(async (receiverId, receiverName, userRole = null) => {
    try {
      // Si hay una llamada activa, cancelarla primero
      if (isCallActive && currentCall) {
        console.log('📞 [CALL] Cancelando llamada activa antes de iniciar nueva');
        await cancelCall();
        // Esperar un momento para que se procese la cancelación
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Si hay una llamada entrante, rechazarla primero
      if (isReceivingCall && incomingCall) {
        console.log('📞 [CALL] Rechazando llamada entrante antes de iniciar nueva');
        await declineCall();
        // Esperar un momento para que se procese el rechazo
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      

      // Si el usuario es modelo, verificar saldo del cliente antes de iniciar
      if (userRole === 'modelo') {
        try {
          const balanceResponse = await fetch(`${API_BASE_URL}/api/videochat/coins/check-client-balance`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              client_id: receiverId
            })
          });
          
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            const canStartCall = balanceData.success?.can_start_call ?? balanceData.can_start_call ?? true;
            
            if (!canStartCall) {
              const minimumRequired = balanceData.balance?.minimum_required || 30;
              alert(`${receiverName} no tiene saldo suficiente para realizar videollamadas. Necesita al menos ${minimumRequired} monedas.`);
              return;
            }
          }
          // Si el endpoint no está disponible (404) o hay error, continuar normalmente
        } catch (error) {
          // Silenciar errores de red o del endpoint (endpoint puede no estar disponible)
          // Continuar con la llamada si hay error en la verificación
        }
      }

      setCurrentCall({ id: receiverId, name: receiverName, status: 'initiating' });
      setIsCallActive(true);

      // 🔥 REPRODUCIR SONIDO DE LLAMADA SALIENTE
      await playOutgoingCallSound();

      const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ receiver_id: receiverId, call_type: 'video' })
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setCurrentCall({
          id: receiverId,
          name: receiverName,
          callId: data.call_id,
          roomName: data.room_name,
          status: 'calling'
        });

        // Iniciar polling para verificar estado de la llamada
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`${API_BASE_URL}/api/calls/status`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ call_id: data.call_id })
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              
              // El endpoint devuelve { success: true, call: { status: ... } }
              const callStatus = statusData.call?.status || statusData.status;
              
              console.log('📞 [CALL] Estado de llamada:', {
                callId: data.call_id,
                status: callStatus,
                fullResponse: statusData
              });
              
              if (callStatus === 'answered' || callStatus === 'active') {
                console.log('✅ [CALL] Llamada aceptada, redirigiendo al videochat');
                clearInterval(pollInterval);
                setCallPollingInterval(null);
                
                // Detener sonido de llamada saliente
                stopOutgoingCallSound();
                
                // 🔥 LIMPIAR ESTADOS ANTES DE REDIRIGIR PARA EVITAR CONFLICTOS
                setIsCallActive(false);
                
                // Determinar el rol del usuario para redirigir a la ruta correcta
                let userRole = null;
                try {
                  const userString = localStorage.getItem('user');
                  if (userString) {
                    const userData = JSON.parse(userString);
                    userRole = userData.rol;
                  }
                } catch (error) {
                  console.warn('No se pudo obtener el rol del usuario:', error);
                }
                
                // Si no se obtuvo el rol, intentar desde getUser
                if (!userRole) {
                  try {
                    const { getUser } = await import('../utils/auth.js');
                    const userData = await getUser();
                    userRole = userData?.rol;
                  } catch (e) {
                    console.error('Error obteniendo rol desde getUser:', e);
                  }
                }
                
                // Redirigir al videochat correcto según el rol
                // 🔥 MODELO USA /videochat, CLIENTE USA /videochatclient
                const roomName = statusData.call?.room_name || data.room_name;
                const videochatRoute = userRole === 'modelo' ? '/videochat' : '/videochatclient';
                
                console.log('📞 [CALL] Llamada aceptada (saliente), redirigiendo a:', videochatRoute, {
                  roomName,
                  receiverName,
                  callId: data.call_id,
                  userRole,
                  hasRoomName: !!roomName
                });
                
                if (!roomName) {
                  console.error('❌ [CALL] No se pudo obtener room_name');
                  alert('Error: No se pudo obtener información de la sala');
                  setCurrentCall(null);
                  return;
                }
                
                // 🔥 GUARDAR EN MULTIPLES LUGARES PARA ASEGURAR DISPONIBILIDAD
                // localStorage
                localStorage.setItem('roomName', roomName);
                localStorage.setItem('userName', receiverName);
                localStorage.setItem('currentRoom', roomName);
                localStorage.setItem('inCall', 'true');
                localStorage.setItem('videochatActive', 'true');
                
                // sessionStorage
                sessionStorage.setItem('roomName', roomName);
                sessionStorage.setItem('userName', receiverName);
                sessionStorage.setItem('currentRoom', roomName);
                sessionStorage.setItem('inCall', 'true');
                sessionStorage.setItem('videochatActive', 'true');
                
                // 🔥 CONSTRUIR URL CON PARÁMETROS
                const videochatUrl = `${videochatRoute}?roomName=${encodeURIComponent(roomName)}&userName=${encodeURIComponent(receiverName)}`;
                
                // 🔥 LIMPIAR currentCall DESPUÉS DE GUARDAR DATOS PERO ANTES DE NAVEGAR
                setCurrentCall(null);
                
                // Pequeño delay para asegurar que los datos se guarden
                await new Promise(resolve => setTimeout(resolve, 100));
                
                try {
                  navigate(videochatUrl, {
                    state: {
                      roomName: roomName,
                      userName: receiverName,
                      callId: data.call_id,
                      from: 'call'
                    },
                    replace: true
                  });
                  
                  console.log('✅ [CALL] Navegación ejecutada exitosamente (saliente)');
                  
                  // Backup: Si después de 2 segundos aún estamos aquí, forzar redirección
                  setTimeout(() => {
                    if (window.location.pathname !== videochatRoute && window.location.pathname !== '/videochatclient' && window.location.pathname !== '/videochat') {
                      console.warn('⚠️ [CALL] Navegación no funcionó, forzando redirección');
                      window.location.href = videochatUrl;
                    }
                  }, 2000);
                } catch (navError) {
                  console.error('❌ [CALL] Error en navigate:', navError);
                  window.location.href = videochatUrl;
                }
              } else if (callStatus === 'rejected' || callStatus === 'cancelled' || callStatus === 'ended') {
                console.log('❌ [CALL] Llamada finalizada:', callStatus);
                clearInterval(pollInterval);
                setCallPollingInterval(null);
                
                // Detener sonido de llamada saliente
                stopOutgoingCallSound();
                
                setIsCallActive(false);
                setCurrentCall(null);
                
                if (callStatus === 'rejected') {
                  alert('La llamada fue rechazada');
                } else if (callStatus === 'cancelled') {
                  alert('La llamada fue cancelada');
                }
              } else {
                // Si el status es 'calling', continuar esperando
                console.log('⏳ [CALL] Esperando respuesta...', callStatus);
              }
            } else {
              console.error('❌ [CALL] Error en respuesta de estado:', statusResponse.status, statusResponse.statusText);
            }
          } catch (error) {
            console.error('❌ [CALL] Error verificando estado de llamada:', error);
          }
        }, 2000);

        setCallPollingInterval(pollInterval);
      } else {
        stopOutgoingCallSound();
        throw new Error(data.error || 'Error al iniciar la llamada');
      }
    } catch (error) {
      console.error('Error iniciando llamada:', error);
      stopOutgoingCallSound();
      setIsCallActive(false);
      setCurrentCall(null);
      throw error;
    }
  }, [isCallActive, currentCall, isReceivingCall, incomingCall, navigate]);

  // 🔥 CANCELAR LLAMADA (GLOBAL)
  const cancelCall = useCallback(async () => {
    // Detener sonido de llamada saliente
    stopOutgoingCallSound();

    if (currentCall?.callId) {
      try {
        await fetch(`${API_BASE_URL}/api/calls/cancel`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ call_id: currentCall.callId })
        });
      } catch (error) {
        console.error('Error cancelando llamada:', error);
      }
    }

    if (callPollingInterval) {
      clearInterval(callPollingInterval);
      setCallPollingInterval(null);
    }

    setIsCallActive(false);
    setCurrentCall(null);
  }, [currentCall, callPollingInterval]);

  // 🔥 ACEPTAR LLAMADA (GLOBAL) - COLGAR LLAMADA ANTERIOR SI EXISTE
  const answerCall = useCallback(async () => {
    try {
      // Si hay una llamada activa, cancelarla primero
      if (isCallActive && currentCall) {
        await cancelCall();
      }

      // 🔥 OBTENER DISPOSITIVOS ACTUALES ANTES DE DESCONECTAR
      let currentSelectedCamera = null;
      let currentSelectedMic = null;
      
      try {
        // Intentar obtener dispositivos desde la sala actual antes de desconectar
        if (window.livekitRoom && window.livekitRoom.localParticipant) {
          const localParticipant = window.livekitRoom.localParticipant;
          
          // Obtener cámara actual
          const videoTracks = Array.from(localParticipant.videoTrackPublications.values());
          if (videoTracks.length > 0) {
            const videoTrack = videoTracks[0]?.track?.mediaStreamTrack;
            if (videoTrack) {
              const settings = videoTrack.getSettings();
              if (settings.deviceId) {
                currentSelectedCamera = settings.deviceId;
                console.log('📹 [CALL] Cámara actual obtenida:', currentSelectedCamera);
              }
            }
          }
          
          // Obtener micrófono actual
          const audioTracks = Array.from(localParticipant.audioTrackPublications.values());
          if (audioTracks.length > 0) {
            const audioTrack = audioTracks[0]?.track?.mediaStreamTrack;
            if (audioTrack) {
              const settings = audioTrack.getSettings();
              if (settings.deviceId) {
                currentSelectedMic = settings.deviceId;
                console.log('🎤 [CALL] Micrófono actual obtenido:', currentSelectedMic);
              }
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ [CALL] Error obteniendo dispositivos actuales:', error);
      }
      
      // 🔥 DESCONECTAR DE LA SALA ACTUAL DE VIDEOCHAT SI ESTAMOS EN UNA
      const currentPath = window.location.pathname;
      const isInVideoChat = currentPath === '/videochat' || currentPath === '/videochatclient';
      const currentRoomName = localStorage.getItem('currentRoom') || localStorage.getItem('roomName');
      
      if (isInVideoChat && currentRoomName) {
        console.log('🔌 [CALL] Desconectando de la sala actual antes de aceptar nueva llamada:', {
          currentPath,
          currentRoomName,
          currentSelectedCamera,
          currentSelectedMic
        });
        
        const authToken = localStorage.getItem('token');
        
        // 1. Desconectar de LiveKit y limpiar completamente
        try {
          if (window.livekitRoom && window.livekitRoom.state !== 'disconnected') {
            console.log('🔌 [CALL] Desconectando de LiveKit...');
            
            // Detener todos los tracks locales antes de desconectar
            try {
              const localParticipant = window.livekitRoom.localParticipant;
              if (localParticipant) {
                // Unpublish todos los tracks
                const tracksToUnpublish = [
                  ...Array.from(localParticipant.videoTrackPublications.values()),
                  ...Array.from(localParticipant.audioTrackPublications.values())
                ];
                
                for (const publication of tracksToUnpublish) {
                  if (publication.track) {
                    publication.track.stop();
                    await localParticipant.unpublishTrack(publication.track).catch(() => {});
                  }
                }
                console.log('✅ [CALL] Tracks locales detenidos');
              }
            } catch (trackError) {
              console.warn('⚠️ [CALL] Error deteniendo tracks:', trackError);
            }
            
            // Desconectar
            await window.livekitRoom.disconnect();
            console.log('✅ [CALL] Desconectado de LiveKit');
          }
          
          // Limpiar la referencia global
          window.livekitRoom = null;
          console.log('✅ [CALL] Referencia de LiveKit limpiada');
        } catch (error) {
          console.warn('⚠️ [CALL] Error desconectando de LiveKit:', error);
          // Intentar desconectar de forma forzada
          try {
            if (window.livekitRoom) {
              window.livekitRoom.disconnect().catch(() => {});
            }
            window.livekitRoom = null;
          } catch (e) {
            // Ignorar errores finales
            window.livekitRoom = null;
          }
        }
        
        // 2. Notificar al otro participante que colgamos
        if (authToken) {
          try {
            await fetch(`${API_BASE_URL}/api/livekit/notify-partner-stop`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
              },
              body: JSON.stringify({ 
                roomName: currentRoomName,
                reason: 'accepted_new_call'
              })
            }).catch(() => {});
          } catch (error) {
            console.warn('⚠️ [CALL] Error notificando al otro participante:', error);
          }
        }
        
        // 3. Finalizar la sala en el backend
        if (authToken) {
          try {
            // Obtener nombre de usuario del localStorage si está disponible
            let userName = 'Usuario';
            try {
              const userString = localStorage.getItem('user');
              if (userString) {
                const userData = JSON.parse(userString);
                userName = userData.name || userData.display_name || 'Usuario';
              }
            } catch (e) {
              // Usar 'Usuario' como fallback
            }
            
            await fetch(`${API_BASE_URL}/api/livekit/end-room`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                roomName: currentRoomName,
                userName: userName
              })
            }).catch(() => {});
            console.log('✅ [CALL] Sala finalizada en el backend');
          } catch (error) {
            console.warn('⚠️ [CALL] Error finalizando sala en el backend:', error);
          }
        }
        
        // 4. Limpiar localStorage relacionado con la sala actual
        localStorage.removeItem('currentRoom');
        localStorage.removeItem('sessionTime');
        localStorage.removeItem('sessionStartTime');
        localStorage.removeItem('inCall');
        localStorage.removeItem('videochatActive');
        
        console.log('✅ [CALL] Limpieza de sala actual completada');
      }

      if (!incomingCall) return;

      stopIncomingCallSound();
      
      // 🔥 LIMPIAR ESTADO INMEDIATAMENTE PARA EVITAR DOBLE CLICK
      setIsReceivingCall(false);
      
      const callIdToUse = incomingCall.call_id || incomingCall.id;
      
      if (!callIdToUse) {
        console.error('❌ [CALL] No se pudo obtener el ID de la llamada');
        setIncomingCall(null);
        alert('Error: No se pudo obtener información de la llamada');
        return;
      }
      
      console.log('📞 [CALL] Aceptando llamada:', {
        incomingCall,
        call_id: callIdToUse
      });

      const response = await fetch(`${API_BASE_URL}/api/calls/answer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          call_id: callIdToUse,
          action: 'accept'
        })
      });

      console.log('📞 [CALL] Respuesta de answer:', {
        status: response.status,
        ok: response.ok
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📞 [CALL] Datos de respuesta:', data);
        
        if (data.success) {
          setIncomingCall(null);
          
          // Obtener room_name de la respuesta o del incomingCall
          const roomName = data.room_name || incomingCall.room_name || incomingCall.roomName;
          // El caller es quien inició la llamada, así que usamos los datos del caller
          const callerName = data.caller?.name || data.caller?.display_name || incomingCall.caller?.name || incomingCall.caller?.display_name || incomingCall.caller_name || incomingCall.name;
          const callId = data.call_id || incomingCall.call_id || incomingCall.id;
          
          console.log('📞 [CALL] Redirigiendo al videochat:', {
            roomName,
            callerName,
            callId
          });
          
          if (!roomName) {
            console.error('❌ [CALL] No se pudo obtener room_name');
            alert('Error: No se pudo obtener información de la sala');
            return;
          }
          
          // Determinar el rol del usuario para redirigir a la ruta correcta
          let userRole = null;
          try {
            const userString = localStorage.getItem('user');
            if (userString) {
              const userData = JSON.parse(userString);
              userRole = userData.rol;
              console.log('📞 [CALL] Rol obtenido de localStorage:', userRole);
            }
          } catch (error) {
            console.warn('No se pudo obtener el rol del usuario desde localStorage:', error);
          }
          
          // Si no se obtuvo el rol, intentar desde getUser
          if (!userRole) {
            try {
              const { getUser } = await import('../utils/auth.js');
              const userData = await getUser();
              userRole = userData?.rol;
              console.log('📞 [CALL] Rol obtenido de getUser:', userRole);
            } catch (e) {
              console.error('Error obteniendo rol desde getUser:', e);
            }
          }
          
          // Redirigir al videochat correcto según el rol
          // 🔥 MODELO USA /videochat, CLIENTE USA /videochatclient
          const videochatRoute = userRole === 'modelo' ? '/videochat' : '/videochatclient';
          
          // 🔥 CONSTRUIR URL CON PARÁMETROS
          const videochatUrl = `${videochatRoute}?roomName=${encodeURIComponent(roomName)}&userName=${encodeURIComponent(callerName)}`;
          
          console.log('📞 [CALL] Preparando redirección:', {
            videochatRoute,
            videochatUrl,
            roomName,
            callerName,
            callId,
            userRole,
            hasRoomName: !!roomName
          });
          
          if (!roomName) {
            console.error('❌ [CALL] No se pudo obtener room_name, abortando redirección');
            alert('Error: No se pudo obtener información de la sala');
            return;
          }
          
          // Guardar en localStorage como backup
          localStorage.setItem('roomName', roomName);
          localStorage.setItem('userName', callerName);
          localStorage.setItem('currentRoom', roomName);
          localStorage.setItem('inCall', 'true');
          localStorage.setItem('videochatActive', 'true');
          
          console.log('📞 [CALL] Ejecutando navigate a:', videochatUrl);
          
          // Redirigir con replace para evitar problemas de navegación
          // Incluir dispositivos en el estado de navegación si están disponibles
          const navigationState = {
            roomName: roomName,
            userName: callerName,
            callId: callId,
            from: 'call'
          };
          
          // Agregar dispositivos si se obtuvieron antes de desconectar
          if (currentSelectedCamera) {
            navigationState.selectedCamera = currentSelectedCamera;
          }
          if (currentSelectedMic) {
            navigationState.selectedMic = currentSelectedMic;
          }
          
          console.log('📞 [CALL] Navegando con estado:', navigationState);
          
          // 🔥 REDIRIGIR INMEDIATAMENTE USANDO LA URL COMPLETA CON PARÁMETROS
          try {
            // Usar navigate con la URL completa que incluye los parámetros
            navigate(videochatUrl, {
              state: navigationState,
              replace: true
            });
            console.log('✅ [CALL] Navegación ejecutada exitosamente a:', videochatUrl);
          } catch (navError) {
            console.error('❌ [CALL] Error en navigate, usando fallback:', navError);
            // Fallback: usar window.location como último recurso
            window.location.href = videochatUrl;
          }
        } else {
          console.error('❌ [CALL] Error en respuesta:', data.error || data.message);
          alert(data.error || data.message || 'Error al aceptar la llamada');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        console.error('❌ [CALL] Error HTTP:', response.status, errorData);
        alert(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error aceptando llamada:', error);
      setIsReceivingCall(false);
      setIncomingCall(null);
      stopIncomingCallSound();
    }
  }, [isCallActive, currentCall, incomingCall, navigate, cancelCall]);

  // 🔥 RECHAZAR LLAMADA (GLOBAL)
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await fetch(`${API_BASE_URL}/api/calls/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ call_id: incomingCall.call_id || incomingCall.id })
      });
    } catch (error) {
      console.error('Error rechazando llamada:', error);
    }

    setIsReceivingCall(false);
    setIncomingCall(null);
    stopIncomingCallSound();
  }, [incomingCall]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (callPollingInterval) clearInterval(callPollingInterval);
      if (incomingCallPollingIntervalRef.current) {
        clearInterval(incomingCallPollingIntervalRef.current);
        incomingCallPollingIntervalRef.current = null;
      }
      stopIncomingCallSound();
      stopOutgoingCallSound();
    };
  }, [callPollingInterval]); // 🔥 REMOVIDO incomingCallPollingInterval DE DEPENDENCIAS

  // 🔥 MEMOIZAR EL VALOR DEL CONTEXTO PARA EVITAR RE-RENDERS INNECESARIOS
  // Las funciones ya están memoizadas con useCallback, así que solo necesitamos memoizar el objeto
  const value = useMemo(() => {
    return {
      isCallActive,
      currentCall,
      isReceivingCall,
      incomingCall,
      startCall,
      cancelCall,
      answerCall,
      declineCall
    };
  }, [isCallActive, currentCall, isReceivingCall, incomingCall, startCall, cancelCall, answerCall, declineCall]);

  return (
    <GlobalCallContext.Provider value={value}>
      {children}
      
      {/* Overlay de llamada saliente (global) */}
      <CallingSystem
        isVisible={isCallActive}
        callerName={currentCall?.name}
        onCancel={cancelCall}
        callStatus={currentCall?.status || 'initiating'}
      />

      {/* Overlay de llamada entrante (global) */}
      <IncomingCallOverlay
        isVisible={isReceivingCall}
        callData={incomingCall}
        onAnswer={answerCall}
        onDecline={declineCall}
      />
    </GlobalCallContext.Provider>
  );
};

