import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleGoogleCallback } from '../../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 🔄 Verificar balance y ejecutar acción pendiente (para Google login)
const verificarBalanceYEjecutarAccionGoogle = async (actionData) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/videochat/coins/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.can_start_call) {
        // ✅ Tiene saldo - iniciar llamada directa
        await iniciarLlamadaDirectaGoogle(actionData.userId);
      } else {
        // ❌ No tiene saldo - redirigir a compra
        window.location.href = '/homecliente?action=buy-coins';
      }
    } else {
      window.location.href = '/homecliente?action=buy-coins';
    }
  } catch (error) {
    window.location.href = '/homecliente?action=buy-coins';
  }
};

// 📞 Iniciar llamada directa (para Google login)
const iniciarLlamadaDirectaGoogle = async (modeloUserId) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/api/calls/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receiver_id: modeloUserId,
        call_type: 'video'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.room_name) {
        // Guardar datos de la sala
        localStorage.setItem('roomName', data.room_name);
        localStorage.setItem('userName', data.receiver?.name || 'Cliente');
        localStorage.setItem('currentRoom', data.room_name);
        localStorage.setItem('inCall', 'true');
        localStorage.setItem('videochatActive', 'true');
        
        // Redirigir al videochat
        window.location.href = '/videochatclient';
      } else {
        window.location.href = '/esperandocallcliente';
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      window.location.href = '/esperandocallcliente';
    }
  } catch (error) {
    window.location.href = '/esperandocallcliente';
  }
};

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Procesando autenticación...');

  useEffect(() => {
    let isMounted = true;
    let redirectTimeout = null;
    let errorTimeout = null;

    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error('Autenticación cancelada por el usuario');
        }

        if (!code) {
          throw new Error('Código de autorización no recibido');
        }

        if (isMounted) {
          setMessage('Validando con Google...');
        }

        const result = await handleGoogleCallback(code, state);
        
        // 🔥 GUARDAR USUARIO EN LOCALSTORAGE PARA QUE ESTÉ DISPONIBLE INMEDIATAMENTE
        if (result.user) {
          localStorage.setItem('user', JSON.stringify(result.user));
        }
        
        if (!isMounted) return;

        setStatus('success');
        setMessage('¡Autenticación exitosa! Redirigiendo...');

        // Redirigir según el estado del usuario
        redirectTimeout = setTimeout(async () => {
          if (!isMounted) return;

          const { user, signup_step } = result;
          
          // Si no tiene rol, redirigir a selección de género
          if (!user.rol || !user.name) {
            navigate('/genero', { replace: true });
          } 
          // Si es cliente, verificar acción pendiente primero
          else if (user.rol === 'cliente') {
            // 🔄 Verificar si hay una acción pendiente de historias
            const pendingAction = localStorage.getItem('pendingStoryAction');
            if (pendingAction) {
              try {
                const actionData = JSON.parse(pendingAction);
                
                // Limpiar la acción pendiente
                localStorage.removeItem('pendingStoryAction');
                
                // Ejecutar la acción pendiente
                if (actionData.action === 'chat') {
                  // Generar room_name (mismo formato que usa el backend)
                  const currentUserId = user.id || user.user?.id;
                  const otherUserId = actionData.userId;
                  
                  if (!currentUserId || !otherUserId) {
                    navigate('/homecliente', { replace: true });
                    return;
                  }
                  
                  const roomName = [currentUserId, otherUserId].sort().join('_');
                  
                  const chatData = {
                    other_user_id: otherUserId,
                    other_user_name: actionData.userName || 'Usuario',
                    other_user_display_name: actionData.userName || 'Usuario',
                    other_user_role: 'modelo',
                    room_name: roomName,
                    createdLocally: true,
                    needsSync: true
                  };
                  
                  // Redirigir al chat con la chica usando navigate con estado
                  navigate({
                    pathname: '/message',
                    search: `?user=${encodeURIComponent(actionData.userName || 'Usuario')}`,
                    state: {
                      openChatWith: chatData
                    }
                  }, { replace: true });
                  return;
                } else if (actionData.action === 'videocall') {
                  // Verificar balance y luego iniciar llamada o redirigir a compra
                  verificarBalanceYEjecutarAccionGoogle(actionData);
                  return;
                }
              } catch (error) {
                localStorage.removeItem('pendingStoryAction');
                if (isMounted) {
                  navigate('/homecliente', { replace: true });
                }
              }
            } else {
              // No hay acción pendiente, redirigir normalmente
              navigate('/homecliente', { replace: true });
            }
          }
          // Si es modelo, verificar estado de verificación
          else if (user.rol === 'modelo') {
            if (!user.verificacion_estado || user.verificacion_estado === 'rechazada') {
              navigate('/anteveri', { replace: true });
            } else if (user.verificacion_estado === 'pendiente') {
              navigate('/esperando', { replace: true });
            } else if (user.verificacion_estado === 'aprobada') {
              navigate('/homellamadas', { replace: true });
            } else {
              navigate('/anteveri', { replace: true });
            }
          }
          // Por defecto, ir a dashboard
          else {
            navigate('/dashboard', { replace: true });
          }
        }, 1500);

      } catch (error) {
        if (!isMounted) return;

        setStatus('error');
        setMessage(error.message || 'Error al procesar autenticación');

        // Redirigir al login después de 3 segundos
        errorTimeout = setTimeout(() => {
          if (isMounted) {
            navigate('/home?auth=login', { replace: true });
          }
        }, 3000);
      }
    };

    processCallback();

    // Cleanup function
    return () => {
      isMounted = false;
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
      if (errorTimeout) {
        clearTimeout(errorTimeout);
      }
    };
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className={`animate-spin rounded-full h-16 w-16 border-b-2 ${
          status === 'error' ? 'border-red-500' : 'border-pink-500'
        } mx-auto mb-4`}></div>
        <p className="text-white/80 mt-4">
          {message}
        </p>
        {status === 'error' && (
          <button
            onClick={() => navigate('/home?auth=login', { replace: true })}
            className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition"
          >
            Volver al inicio
          </button>
        )}
      </div>
    </div>
  );
};

export default GoogleCallback;