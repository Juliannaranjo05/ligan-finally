import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const UserSearch = () => {
  const { t, i18n } = useTranslation();
  
  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
    }
  }, []);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [searchStatus, setSearchStatus] = useState(t("usersearch.iniciando_llamada", "Iniciando llamada..."));
  const [roomData, setRoomData] = useState(null);
  const [waitTime, setWaitTime] = useState(0);
  const [checkCount, setCheckCount] = useState(0);
  
  // 🌐 NUEVOS ESTADOS PARA MONITOR DE RED
  const [networkStatus, setNetworkStatus] = useState({
    isOnline: navigator.onLine,
    quality: 'checking', // 'excellent', 'good', 'poor', 'checking'
    latency: null,
    lastCheck: null
  });
  
  // 🎯 NUEVOS ESTADOS PARA DETECCIÓN DE ACCIONES
  const [actionDetection, setActionDetection] = useState({
    isMonitoring: false,
    lastActionCheck: null,
    consecutiveChecks: 0,
    actionType: null, // 'stop', 'siguiente', null
    detectedAt: null
  });

  const checkIntervalRef = useRef(null);
  const waitTimerRef = useRef(null);
  const networkTimerRef = useRef(null);
  const actionTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  
  // 🔥 ESTADOS CRÍTICOS PARA PREVENIR DOBLE EJECUCIÓN
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [hasProcessedResponse, setHasProcessedResponse] = useState(false);
  
  // 🔥 OBTENER PARÁMETROS
  const role = searchParams.get('role');
  const selectedCamera = searchParams.get('selectedCamera');
  const selectedMic = searchParams.get('selectedMic');
  const currentRoom = searchParams.get('currentRoom');
  const userName = searchParams.get('userName');
  const action = searchParams.get('action');
  const from = searchParams.get('from');
  const excludeUser = searchParams.get('excludeUser');
  const excludeUserName = searchParams.get('excludeUserName');
  const autoSearch = searchParams.get('autoSearch') !== 'false'; // 🔥 Por defecto true, pero puede ser false
  
  // 🌐 FUNCIÓN: VERIFICAR CALIDAD DE RED
  const checkNetworkQuality = async () => {
    try {
      const startTime = performance.now();
      
      // Test de conectividad básico
      const response = await fetch(`${API_BASE_URL}/api/ping`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      let quality = 'excellent';
      if (latency > 1000) quality = 'poor';
      else if (latency > 500) quality = 'good';
      
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: true,
        quality,
        latency,
        lastCheck: new Date().toLocaleTimeString()
      }));
      
      return { isOnline: true, quality, latency };
      
    } catch (error) {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        quality: 'poor',
        latency: null,
        lastCheck: new Date().toLocaleTimeString()
      }));
      
      return { isOnline: false, quality: 'poor', latency: null };
    }
  };

  // 🎯 FUNCIÓN: DETECTAR ACCIONES DE USUARIO (STOP/SIGUIENTE)
  const detectUserActions = async (roomName) => {
    if (!roomName || !isMountedRef.current) return null;

    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) return null;

      const response = await fetch(`${API_BASE_URL}/api/chat/room-status/${roomName}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (!response.ok) return null;

      const statusData = await response.json();
      
      // Verificar si hay acciones pendientes
      if (statusData.pendingAction) {
        const actionType = statusData.pendingAction.type; // 'stop' o 'siguiente'
        const actionUser = statusData.pendingAction.userId;
        const actionTime = statusData.pendingAction.timestamp;
        
        
        setActionDetection(prev => ({
          ...prev,
          actionType,
          detectedAt: new Date(actionTime),
          lastActionCheck: new Date()
        }));
        
        return { type: actionType, user: actionUser, timestamp: actionTime };
      }
      
      return null;
      
    } catch (error) {
      return null;
    }
  };

  // 🚨 FUNCIÓN CRÍTICA: CREAR SALA SIN BUGS
  const createRoomSafe = async () => {
    // 🛑 MÚLTIPLES PROTECCIONES
    if (isCreatingRoom || isRedirecting || hasProcessedResponse) {
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    // 🔥 BLOQUEAR EJECUCIONES ADICIONALES
    setIsCreatingRoom(true);
    setHasProcessedResponse(true);

    try {
      setSearchStatus(t("usersearch.creando_sala", "Creando sala..."));

      // 🌐 VERIFICAR RED ANTES DE CONTINUAR
      const networkCheck = await checkNetworkQuality();
      if (!networkCheck.isOnline) {
        throw new Error(t("usersearch.sin_conexion", "Sin conexión a internet"));
      }

      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error(t("usersearch.sin_token", "No hay token de autenticación"));
      }

      // 🔥 ENDPOINT Y BODY SEGÚN CONTEXTO
      let endpoint = '/api/ruleta/iniciar';
      let body = { 
        userRole: role,
        simple: true,
        preventDouble: true,
        networkQuality: networkCheck.quality
      };

      if (action === 'siguiente' && currentRoom && userName) {
        endpoint = '/api/livekit/next-room';
        body = { 
          action: 'siguiente',
          currentRoom,
          userName,
          excludeUserId: excludeUser,
          userRole: role,
          preventDouble: true,
          networkQuality: networkCheck.quality
        };
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(t("usersearch.servidor_ocupado", "Servidor ocupado"));
        }
        throw new Error(`${t("usersearch.error", "Error")} ${response.status}`);
      }

      const data = await response.json();

      // 🚨 PROCESAMIENTO CRÍTICO DE RESPUESTA
      await processServerResponse(data);

    } catch (error) {
      setError(error.message);
      setSearchStatus(t("usersearch.error_conectando", "Error conectando"));
      
      // Reset flags en caso de error
      setIsCreatingRoom(false);
      setHasProcessedResponse(false);
    }
  };

  // 🚨 FUNCIÓN CRÍTICA: PROCESAR RESPUESTA DEL SERVIDOR
  const processServerResponse = async (data) => {
    if (!data.success) {
      throw new Error(t("usersearch.respuesta_no_exitosa", "Respuesta del servidor no exitosa"));
    }

    // 🎉 CASO 1: MATCH ENCONTRADO - REDIRECCIONAR INMEDIATAMENTE
    if (data.type === 'match_found' || data.type === 'direct_match') {
      
      if (!data.roomName || !data.userName) {
        throw new Error(t("usersearch.datos_match_incompletos", "Datos de match incompletos"));
      }

      await redirectToVideoChat(data.roomName, data.userName, data, true);
      return;
    }

    // ⏳ CASO 2: SALA CREADA PARA ESPERAR
    if (data.type === 'waiting' || data.type === 'room_created' || data.roomName) {
      
      const roomName = data.roomName || data.newRoomName;
      const finalUserName = data.userName;

      if (!roomName || !finalUserName) {
        throw new Error(t("usersearch.datos_sala_incompletos", "Datos de sala incompletos"));
      }

      const newRoomData = {
        roomName,
        userName: finalUserName,
        ruletaData: data
      };
      
      setRoomData(newRoomData);
      
      // 🔥 TEXTO SEGÚN ROL: chico/chica esperando pareja
      const waitingText = role === 'modelo' ? 
        t("usersearch.esperando_chico", "Esperando chico...") : 
        t("usersearch.esperando_chica", "Esperando chica...");
      
      setSearchStatus(waitingText);
      
      // 🚀 INICIAR VERIFICACIÓN OPTIMIZADA
      startOptimizedWaiting(roomName, finalUserName, newRoomData);
      return;
    }

    throw new Error(`${t("usersearch.tipo_respuesta_no_reconocida", "Tipo de respuesta no reconocida")}: ${data.type}`);
  };

  // 🚨 FUNCIÓN: ESPERA OPTIMIZADA CON DETECCIÓN DE ACCIONES
  const startOptimizedWaiting = (roomName, finalUserName, roomDataObj) => {
    
    // 🌐 Monitor de red cada 5 segundos
    networkTimerRef.current = setInterval(() => {
      checkNetworkQuality();
    }, 5000);
    
    // 🎯 Monitor de acciones cada 1 segundo (MÁS RÁPIDO)
    actionTimerRef.current = setInterval(async () => {
      if (!isMountedRef.current || isRedirecting) return;
      
      const action = await detectUserActions(roomName);
      if (action) {
        setActionDetection(prev => ({
          ...prev,
          isMonitoring: true,
          actionType: action.type,
          detectedAt: new Date(action.timestamp)
        }));
        
        // Si es stop, redirigir inmediatamente a home
        if (action.type === 'stop') {
          handleStopAction();
          return;
        }
        
        // 🔥 FORZAR REDIRECCIÓN INMEDIATA EN "SIGUIENTE"
        if (action.type === 'siguiente') {
          handleNextAction();
          return;
        }
      }
    }, 1000); // 🔥 CAMBIADO A 1 SEGUNDO (más rápido)

    // Timer para tiempo de espera
    waitTimerRef.current = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);

    let checkCount = 0;
    // 🔥 SIN LÍMITE DE CHECKS - ESPERA INDEFINIDA HASTA MATCH REAL

    // 🔄 VERIFICACIÓN CADA 2 SEGUNDOS (MÁS RÁPIDO) - SOLO REDIRIGE CON MATCH REAL
    checkIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current || isRedirecting) {
        return;
      }
      
      checkCount++;
      setCheckCount(checkCount);

      // 🎯 SOLO REDIRIGIR CON MATCH REAL - SIN TIMEOUT AUTOMÁTICO
      
      try {
        // 🌐 Verificar red antes del check
        const networkCheck = await checkNetworkQuality();
        if (!networkCheck.isOnline) {
          return;
        }

        const participantData = await checkParticipantsSafe(roomName);
        const participantCount = participantData?.total_count || 0;
        

        // 🎉 SOLO REDIRIGIR CUANDO HAY MATCH REAL (2+ participantes)
        if (participantCount >= 2) {
          clearAllIntervals();
          
          await redirectToVideoChat(roomName, finalUserName, roomDataObj.ruletaData, false);
        }
        // 🔄 SI NO HAY MATCH, CONTINUAR ESPERANDO (NO TIMEOUT)

      } catch (error) {
      }
    }, 2000); // 🔥 CAMBIADO A 2 SEGUNDOS (más rápido)
  };

  // 🛑 FUNCIÓN: MANEJAR ACCIÓN DE STOP
  const handleStopAction = () => {
    
    clearAllIntervals();
    
    // Limpiar estado
    isMountedRef.current = false;
    window.__USERSEARCH_ACTIVE = null;
    localStorage.removeItem('inCall');
    localStorage.removeItem('videochatActive');
    localStorage.removeItem('roomName');
    localStorage.removeItem('userName');
    localStorage.removeItem('currentRoom');
    
    // 🔥 REDIRECCIONAR A ESPERARCALL SEGÚN ROL
    const esperarRoute = role === 'modelo' ? '/esperandocall' : '/esperandocallcliente';
    navigate(esperarRoute, { replace: true });
  };

  // ⏭️ FUNCIÓN: MANEJAR ACCIÓN DE SIGUIENTE (NUEVA)
  const handleNextAction = () => {
    
    clearAllIntervals();
    
    // 🔥 FORZAR LIMPIEZA TOTAL
    isMountedRef.current = false;
    window.__USERSEARCH_ACTIVE = null;
    localStorage.removeItem('inCall');
    localStorage.removeItem('videochatActive');
    localStorage.removeItem('roomName');
    localStorage.removeItem('userName');
    localStorage.removeItem('currentRoom');
    
    // 🚀 REDIRECCIÓN FORZADA A USERSEARCH CON PARÁMETROS
    const searchParams = new URLSearchParams({
      role: role,
      action: 'siguiente',
      from: 'forced_redirect',
      timestamp: Date.now()
    });
    
    
    // 🔥 MÚLTIPLES MÉTODOS DE REDIRECCIÓN PARA ASEGURAR
    navigate(`/usersearch?${searchParams}`, { replace: true });
    
    // Backup con timeout
    setTimeout(() => {
      if (window.location.pathname !== '/usersearch') {
        window.location.href = `/usersearch?${searchParams}`;
      }
    }, 500);
  };

  // 🧹 FUNCIÓN: LIMPIAR TODOS LOS INTERVALS
  const clearAllIntervals = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    
    if (waitTimerRef.current) {
      clearInterval(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    
    if (networkTimerRef.current) {
      clearInterval(networkTimerRef.current);
      networkTimerRef.current = null;
    }
    
    if (actionTimerRef.current) {
      clearInterval(actionTimerRef.current);
      actionTimerRef.current = null;
    }
  };

  // 🚨 FUNCIÓN: VERIFICAR PARTICIPANTES CON PROTECCIÓN (MÁS RÁPIDO)
  const checkParticipantsSafe = async (roomName) => {
    try {
      const lastCheck = localStorage.getItem('lastParticipantCheck');
      const now = Date.now();
      
      // 🔥 REDUCIR RATE LIMITING PARA SER MÁS RÁPIDO
      if (lastCheck && (now - parseInt(lastCheck)) < 1000) {
        return { total_count: 0 };
      }
      
      const authToken = localStorage.getItem('token');
      if (!authToken) return { total_count: 0 };

      const response = await fetch(`${API_BASE_URL}/api/chat/participants/${roomName}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (response.ok) {
        localStorage.setItem('lastParticipantCheck', now.toString());
        return await response.json();
      }
      
      return { total_count: 0 };
    } catch (error) {
      return { total_count: 0 };
    }
  };

  // 🚨 FUNCIÓN: REDIRECCIÓN PROTEGIDA (MÁS AGRESIVA)
  const redirectToVideoChat = async (roomName, finalUserName, ruletaData = null, fromMatch = false) => {
    if (isRedirecting) {
      return;
    }

    setIsRedirecting(true);

    try {
      // Iniciando redirección protegida (no-op placeholder)
      // Continúa con el flujo de redirección a continuación

      setSearchStatus(t("usersearch.conectando", "Conectando..."));
      clearAllIntervals();

      // 🔥 GUARDAR EN SESSIONSTORAGE PARA VIDEOCHAT
      localStorage.setItem('roomName', roomName);
      localStorage.setItem('userName', finalUserName);
      localStorage.setItem('currentRoom', roomName);
      localStorage.setItem('inCall', 'true');
      localStorage.setItem('videochatActive', 'true');

      // 🔥 AMBAS RUTAS USAN EL MISMO COMPONENTE (videochatclient.jsx)
      const targetRoute = role === 'modelo' ? '/videochat' : '/videochatclient';
      
      // 🔥 ASEGURAR CÁMARA PRINCIPAL PARA MODELO (MOVIDO AQUÍ)
      const camaraPrincipal = role === 'modelo' ? 'local' : 'remote';
      

      // 🔥 REDIRECCIÓN MÚLTIPLE PARA ASEGURAR
      navigate(targetRoute, {
        state: {
          roomName,
          userName: finalUserName,
          selectedCamera,
          selectedMic,
          ruletaData,
          fromMatch,
          from: 'usersearch',
          camaraPrincipal, // 🔥 NUEVO: Asegurar cámara principal
          chica: ruletaData?.chica || null, // 🔥 CAMBIADO: chica en lugar de modelo
          chico: ruletaData?.chico || null   // 🔥 AGREGADO: chico
        },
        replace: true
      });

      // 🔥 BACKUP INMEDIATO
      setTimeout(() => {
        const urlParams = new URLSearchParams({
          roomName,
          userName: finalUserName
        });
        
        window.history.replaceState(
          { roomName, userName: finalUserName },
          '',
          `${targetRoute}?${urlParams}`
        );
        
        // 🚀 FORZAR REDIRECCIÓN SI NO FUNCIONÓ
        if (window.location.pathname !== targetRoute) {
          window.location.href = `${targetRoute}?${urlParams}`;
        }
      }, 100);

      // 🔥 SEGUNDO BACKUP
      setTimeout(() => {
        if (window.location.pathname !== targetRoute) {
          window.location.replace(`${targetRoute}?roomName=${roomName}&userName=${finalUserName}`);
        }
      }, 1000);

    } catch (error) {
      setError(t("usersearch.error_conectando", "Error conectando"));
      setIsRedirecting(false);
      
      // 🔥 FALLBACK EN CASO DE ERROR
      setTimeout(() => {
        const targetRoute = role === 'modelo' ? '/videochat' : '/videochatclient';
        window.location.href = `${targetRoute}?roomName=${roomName}&userName=${finalUserName}`;
      }, 500);
    }
  };

  // 🚨 USEEFFECT PRINCIPAL - ULTRA PROTEGIDO
  useEffect(() => {
    const mountKey = `usersearch_${role}_${Date.now()}`;
    
    if (window.__USERSEARCH_ACTIVE === mountKey) {
      return;
    }

    if (window.__USERSEARCH_ACTIVE) {
      setTimeout(() => {
        window.__USERSEARCH_ACTIVE = null;
      }, 1000);
      return;
    }

    window.__USERSEARCH_ACTIVE = mountKey;

    if (!role) {
      navigate('/home');
      return;
    }

    isMountedRef.current = true;
    
    // 🌐 VERIFICAR RED AL INICIO
    checkNetworkQuality();
    
    // 🔥 SOLO INICIAR BÚSQUEDA AUTOMÁTICAMENTE SI autoSearch NO ES 'false'
    if (autoSearch) {
      const initTimeout = setTimeout(() => {
        if (isMountedRef.current && window.__USERSEARCH_ACTIVE === mountKey) {
          createRoomSafe();
        }
      }, 300);
      
      return () => {
        clearTimeout(initTimeout);
        
        if (window.__USERSEARCH_ACTIVE === mountKey) {
          window.__USERSEARCH_ACTIVE = null;
        }
        
        isMountedRef.current = false;
        clearAllIntervals();

        setIsCreatingRoom(false);
        setIsRedirecting(false);
        setHasProcessedResponse(false);
      };
    } else {
      // 🔥 NO INICIAR BÚSQUEDA AUTOMÁTICA - El usuario debe hacer clic manualmente
      console.log('⏸️ [USERSEARCH] Búsqueda automática desactivada - esperando acción del usuario');
      
      return () => {
        if (window.__USERSEARCH_ACTIVE === mountKey) {
          window.__USERSEARCH_ACTIVE = null;
        }
        
        isMountedRef.current = false;
        clearAllIntervals();

        setIsCreatingRoom(false);
        setIsRedirecting(false);
        setHasProcessedResponse(false);
      };
    }

    return () => {
      clearTimeout(initTimeout);
      
      if (window.__USERSEARCH_ACTIVE === mountKey) {
        window.__USERSEARCH_ACTIVE = null;
      }
      
      isMountedRef.current = false;
      clearAllIntervals();

      setIsCreatingRoom(false);
      setIsRedirecting(false);
      setHasProcessedResponse(false);
    };
  }, []);

  // 🚨 TIMEOUT DE SEGURIDAD CORREGIDO (SOLO PARA CASOS EXTREMOS)
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      
      clearAllIntervals();
      
      if (!isRedirecting) {
        // 🔥 LIMPIAR TODO Y REGRESAR AL ESPERARCALL (NO AL VIDEOCHAT)
        isMountedRef.current = false;
        window.__USERSEARCH_ACTIVE = null;
        localStorage.removeItem('inCall');
        localStorage.removeItem('videochatActive');
        localStorage.removeItem('roomName');
        localStorage.removeItem('userName');
        localStorage.removeItem('currentRoom');
        
        setError(t("usersearch.tiempo_agotado", "Tiempo de espera agotado - regresando al inicio"));
        
        setTimeout(() => {
          // 🔥 CORREGIDO: esperarcall/esperarcallcliente
          const esperarRoute = role === 'modelo' ? '/esperandocall' : '/esperandocallcliente';
          
          // 🚀 MÚLTIPLES MÉTODOS PARA ASEGURAR REDIRECCIÓN AL ESPERARCALL
          navigate(esperarRoute, { replace: true });
          
          // Backup 1
          setTimeout(() => {
            if (window.location.pathname !== esperarRoute) {
              window.location.href = esperarRoute;
            }
          }, 500);
          
          // Backup 2
          setTimeout(() => {
            if (window.location.pathname !== esperarRoute) {
              window.location.replace(esperarRoute);
            }
          }, 1500);
          
        }, 2000);
      }
    }, 300000); // 5 MINUTOS MÁXIMO

    return () => clearTimeout(safetyTimeout);
  }, []);

  // 🚨 FUNCIÓN PARA VOLVER (MEJORADA)
  const handleGoBack = () => {
    
    clearAllIntervals();
    isMountedRef.current = false;
    window.__USERSEARCH_ACTIVE = null;
    
    // 🔥 SI VIENE DE DESCONEXIÓN DEL CLIENTE, NO LIMPIAR SESIÓN Y VOLVER A HOME
    // Detectar si viene de partner_left_session o client_stopped_session
    const fromPartnerDisconnect = from === 'partner_left_session' || 
                                  from === 'client_stopped_session' ||
                                  from === 'previous_client_left';
    
    if (fromPartnerDisconnect && role === 'modelo') {
      // 🔥 NO LIMPIAR DATOS DE SESIÓN - Solo ir a homellamadas
      navigate('/homellamadas', { replace: true });
      return;
    }
    
    // 🔥 LIMPIAR DATOS DE SESIÓN COMPLETAMENTE (solo si no es desde desconexión)
    localStorage.removeItem('inCall');
    localStorage.removeItem('videochatActive');
    localStorage.removeItem('roomName');
    localStorage.removeItem('userName');
    localStorage.removeItem('currentRoom');
    
    // 🔥 CORREGIDO: Siempre ir a esperarcall/esperarcallcliente
    const esperarRoute = role === 'modelo' ? '/esperandocall' : '/esperandocallcliente';
    navigate(esperarRoute, { replace: true });
  };

  // 🔥 FORMATEAR TIEMPO
  const formatWaitTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 🌐 OBTENER ICONO DE CALIDAD DE RED
  const getNetworkIcon = (quality) => {
    switch (quality) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'poor': return '🔴';
      default: return '⚪';
    }
  };

  // 🌐 OBTENER TEXTO DE CALIDAD DE RED
  const getNetworkText = (quality) => {
    switch (quality) {
      case 'excellent': return t("usersearch.red_excelente", "Excelente");
      case 'good': return t("usersearch.red_buena", "Buena");
      case 'poor': return t("usersearch.red_mala", "Mala");
      default: return t("usersearch.red_verificando", "Verificando...");
    }
  };

  // 🎯 OBTENER ICONO DE ACCIÓN
  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'stop': return '🛑';
      case 'siguiente': return '⏭️';
      default: return '👁️';
    }
  };

  // 🎯 OBTENER TÍTULO PRINCIPAL
  const getMainTitle = () => {
    if (isRedirecting) return t("usersearch.conectando", "🎉 Conectando...");
    if (actionDetection.actionType === 'stop') return t("usersearch.finalizando", "🛑 Finalizando...");
    if (actionDetection.actionType === 'siguiente') return t("usersearch.cambiando", "⏭️ Cambiando...");
    if (action === 'siguiente') {
      return role === 'modelo' ? 
        t("usersearch.buscando_nuevo_chico", "Buscando nuevo chico") : 
        t("usersearch.buscando_nueva_chica", "Buscando nueva chica");
    }
    return t("usersearch.iniciando_llamada", "Iniciando llamada...");
  };
  // 🚨 RENDER MEJORADO
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0d10] to-[#131418] text-white flex items-center justify-center p-4">
      <div className="text-center max-w-md mx-auto">
        {/* Spinner */}
        <div className="relative mb-8">
          <div className="animate-spin rounded-full h-24 w-24 border-4 border-transparent border-t-[#ff007a] border-r-[#ff007a] mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-4xl animate-pulse">
              {isRedirecting ? '🎉' : 
               actionDetection.actionType === 'stop' ? '🛑' : 
               actionDetection.actionType === 'siguiente' ? '⏭️' : '📞'}
            </div>
          </div>
        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold mb-4 text-white">
          {getMainTitle()}
        </h2>

        {/* Estado */}
        <p className="text-gray-400 mb-6 text-sm">{searchStatus}</p>

        {/* Monitor de Red */}
        <div className="mb-4 p-3 bg-[#1a1d21] rounded-lg border border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span>{getNetworkIcon(networkStatus.quality)}</span>
              <span className="text-gray-400">{t("usersearch.red", "Red")}:</span>
              <span className={`font-bold ${
                networkStatus.quality === 'excellent' ? 'text-green-400' :
                networkStatus.quality === 'good' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {getNetworkText(networkStatus.quality)}
              </span>
            </div>
            {networkStatus.latency && (
              <span className="text-gray-500">{networkStatus.latency}ms</span>
            )}
          </div>
          {networkStatus.lastCheck && (
            <div className="text-[10px] text-gray-500 mt-1">
              {t("usersearch.ultima_verificacion", "Última verificación")}: {networkStatus.lastCheck}
            </div>
          )}
        </div>

        {/* Monitor de Acciones */}
        {actionDetection.isMonitoring && (
          <div className="mb-4 p-3 bg-[#1f1521] rounded-lg border border-purple-500/30">
            <div className="flex items-center justify-center space-x-2 text-xs">
              <span>{getActionIcon(actionDetection.actionType)}</span>
              <span className="text-purple-400">{t("usersearch.detectando_acciones", "Detectando acciones del usuario")}</span>
            </div>
            {actionDetection.detectedAt && (
              <div className="text-[10px] text-gray-500 mt-1">
                {t("usersearch.ultima_deteccion", "Última detección")}: {actionDetection.detectedAt.toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {/* Info de progreso SIN nombre de sala */}
        {roomData && !isRedirecting && (
          <div className="mb-6 p-4 bg-[#1f2125] rounded-lg border border-[#ff007a]/30">
            <div className="text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t("usersearch.tiempo_espera", "Tiempo de espera")}:</span>
                <span className="text-white font-bold text-lg">{formatWaitTime(waitTime)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t("usersearch.verificaciones", "Verificaciones")}:</span>
                <span className="text-blue-400">{checkCount} checks</span>
              </div>
              
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-[#ff007a] h-2 rounded-full transition-all duration-300 animate-pulse"
                  style={{ width: '100%' }}
                ></div>
              </div>
              
              <p className="text-green-400 text-center mt-2">
                ✨ {t("usersearch.esperando_match_real", "Esperando match real")}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">❌ {error}</p>
          </div>
        )}

        {/* Botón volver */}
        {!isRedirecting && actionDetection.actionType !== 'stop' && (
          <button
            onClick={handleGoBack}
            className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-full text-white text-sm transition"
          >
            ← {t("usersearch.volver", "Volver")}
          </button>
        )}

        {/* Botón reset emergencia (MEJORADO) */}
        <div className="fixed top-4 right-4">
          <button
            onClick={() => {
              window.__USERSEARCH_ACTIVE = null;
              clearAllIntervals();
              
              // 🔥 LIMPIEZA TOTAL DE DATOS
              localStorage.clear();
              localStorage.clear();
              
              // 🏠 REDIRIGIR AL ESPERARCALL (NO AL VIDEOCHAT)
              const esperarRoute = role === 'modelo' ? '/esperandocall' : '/esperandocallcliente';
              navigate(esperarRoute, { replace: true });
              
              setTimeout(() => {
                if (window.location.pathname !== esperarRoute) {
                  window.location.href = esperarRoute;
                }
              }, 500);
            }}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white text-xs font-bold"
          >
            🚨 RESET
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSearch;