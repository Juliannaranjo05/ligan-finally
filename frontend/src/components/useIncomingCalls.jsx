import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Hook personalizado para manejar llamadas entrantes
 * Se debe usar en componentes principales como Layout o App
 */
export const useIncomingCalls = () => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const checkIntervalRef = useRef(null);
  const isActiveRef = useRef(true);

  // 🔥 FUNCIÓN: VERIFICAR LLAMADAS ENTRANTES
  const checkForIncomingCalls = async () => {
    if (!isActiveRef.current) return;

    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) return;

      const response = await fetch(`${API_BASE_URL}/api/calls/check-incoming`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.has_incoming && data.incoming_call) {
                    
          // Solo mostrar si no hay ya una llamada visible
          if (!showIncomingCall) {
            setIncomingCall(data.incoming_call);
            setShowIncomingCall(true);
          }
        } else if (showIncomingCall && !data.has_incoming) {
          // La llamada ya no está disponible
                    setShowIncomingCall(false);
          setIncomingCall(null);
        }
      }
    } catch (error) {
          }
  };

  // 🔄 INICIAR POLLING
  useEffect(() => {
        
    // Verificar inmediatamente
    checkForIncomingCalls();
    
    // Configurar polling cada 3 segundos
    checkIntervalRef.current = setInterval(checkForIncomingCalls, 3000);

    return () => {
            isActiveRef.current = false;
      
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // 🔥 FUNCIÓN: CERRAR OVERLAY DE LLAMADA ENTRANTE
  const closeIncomingCall = () => {
        setShowIncomingCall(false);
    setIncomingCall(null);
  };

  // 🔥 FUNCIÓN: PAUSAR/REANUDAR MONITOREO
  const pauseMonitoring = () => {
        isActiveRef.current = false;
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
  };

  const resumeMonitoring = () => {
        isActiveRef.current = true;
    checkIntervalRef.current = setInterval(checkForIncomingCalls, 3000);
  };

  return {
    incomingCall,
    showIncomingCall,
    closeIncomingCall,
    pauseMonitoring,
    resumeMonitoring
  };
};