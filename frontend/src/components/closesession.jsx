// hooks/useSessionCleanup.js - VERSIÓN CORREGIDA
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useSessionCleanup = (roomName, isConnected = false) => {
  const navigate = useNavigate();
  const hasCleanedUp = useRef(false);
  const isUnloadingRef = useRef(false);

  // Función para finalizar sesión
  const finalizarSesion = async (reason = 'user_disconnect') => {
    if (hasCleanedUp.current || !roomName) return;
    
    hasCleanedUp.current = true;
    
    try {
      
      const authToken = localStorage.getItem('token');
      const data = {
        room_name: roomName,
        end_reason: reason
      };

      if (isUnloadingRef.current) {
        // Usar sendBeacon para casos de cierre de pestaña/navegador
        const formData = new FormData();
        formData.append('room_name', roomName);
        formData.append('end_reason', reason);
        
        if (authToken) {
          formData.append('_token', authToken);
        }

        navigator.sendBeacon(`${API_BASE_URL}/api/finalizar`, formData);
      } else {
        // Usar fetch normal para otros casos
        const response = await fetch(`${API_BASE_URL}/api/finalizar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          navigate('/esperarcall');
        }
      }
    } catch (error) {
    } finally {
      // Limpiar localStorage
      limpiarDatosSession();
    }
  };

  // Función para limpiar datos de la sesión
  const limpiarDatosSession = () => {
    try {
      // Limpiar datos específicos de la sala
      localStorage.removeItem('roomName');
      localStorage.removeItem('userName');
      localStorage.removeItem('session_data');
      localStorage.removeItem('chat_messages');
      
      // Limpiar cache de usuarios
      if (window.debugUserCache) {
        const USER_CACHE = new Map();
        USER_CACHE.clear();
      }
      
    } catch (error) {
    }
  };

  // Detectar cierre de pestaña/navegador - SOLO PARA CIERRES REALES
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isConnected && roomName) {
        isUnloadingRef.current = true;
        finalizarSesion('page_close');
        
        // Mensaje de confirmación (opcional)
        event.preventDefault();
        event.returnValue = '¿Estás seguro de que quieres salir? Se cerrará la videollamada.';
        return event.returnValue;
      }
    };

    const handleUnload = () => {
      if (isConnected && roomName) {
        isUnloadingRef.current = true;
        finalizarSesion('page_unload');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [roomName, isConnected]);

  // 🔥 FIX: CAMBIO DE VISIBILIDAD - SOLO LOGGING, NO AUTO-FINALIZACIÓN
  useEffect(() => {
    let timeoutId;

    const handleVisibilityChange = () => {
      if (document.hidden && isConnected && roomName) {
        
        // 🔥 COMENTADO: NO finalizar automáticamente por cambio de pestaña
        // timeoutId = setTimeout(() => {
        //   if (document.hidden) {
        //     finalizarSesion('page_hidden');
        //     navigate('/esperarcall');
        //   }
        // }, 60000);
        
      } else if (!document.hidden) {
        
        // Si regresa, cancelar el timeout (aunque ya no existe)
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [roomName, isConnected, navigate]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (isConnected && roomName && !hasCleanedUp.current) {
        finalizarSesion('component_unmount');
      }
    };
  }, []);

  return {
    finalizarSesion,
    limpiarDatosSession
  };
};