import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleGoogleCallback } from '../../utils/auth';

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Procesando autenticación...');

  useEffect(() => {
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

        console.log('🔄 Procesando callback...');
        setMessage('Validando con Google...');

        const result = await handleGoogleCallback(code, state);
        
        setStatus('success');
        setMessage('¡Autenticación exitosa! Redirigiendo...');

        // Redirigir según el estado del usuario
        setTimeout(() => {
          const { user, signup_step } = result;
          
          // Si no tiene rol, redirigir a selección de género
          if (!user.rol || !user.name) {
            navigate('/genero', { replace: true });
          } 
          // Si no tiene email verificado, redirigir a verificación
          else if (!user.email_verified) {
            navigate('/verificaremail', { replace: true });
          }
          // Si es cliente, ir a homecliente
          else if (user.rol === 'cliente') {
            navigate('/homecliente', { replace: true });
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
        console.error('❌ Error en callback:', error);
        setStatus('error');
        setMessage(error.message || 'Error al procesar autenticación');

        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          navigate('/home?auth=login', { replace: true });
        }, 3000);
      }
    };

    processCallback();
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