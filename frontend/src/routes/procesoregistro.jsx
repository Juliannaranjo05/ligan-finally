import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import api from '../api/axios'; // Usa axios con credenciales habilitadas (withCredentials: true)

const RutaProcesoRegistro = () => {
  const [canAccess, setCanAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [redirectTo, setRedirectTo] = useState(null);
  const location = useLocation();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // Asegúrate de que esta variable esté definida en tu entorno

  useEffect(() => {
    verificarAcceso();
  }, [location.pathname]);

  const verificarAcceso = async () => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/profile`); // Usa cookies para autenticar
      const user = response?.data?.user;

      if (!user) {
        setError('Usuario no encontrado');
        return;
      }

      // Si está en la ruta de verificar email, saltar a género
      if (location.pathname === '/verificaremail') {
        setRedirectTo('/genero');
        return;
      }

      // Si está en la ruta de género
      if (location.pathname === '/genero') {
        // Si el género ya está completado, redirige según el tipo de usuario
        if (user.rol || user.genero) {
          if (user.rol === 'cliente') {
            setRedirectTo('/homecliente');
          } else if (user.rol === 'modelo' && user.verificacion?.estado === 'null') {
            setRedirectTo('/anteveri');
          } else if (user.rol === 'modelo' && user.verificacion?.estado === 'pendiente') {
            setRedirectTo('/esperando');
          } else if (user.rol === 'modelo' && user.verificacion?.estado === 'aprobada') {
            setRedirectTo('/homellamadas');
          }else {
            setRedirectTo('/home');
          }
          return;
        }
        // Si no está completado, puede acceder
        setCanAccess(true);
      }

    } catch (err) {
      if (err.response?.status === 401) {
        setError('Sesión expirada');
        setRedirectTo('/login');
      } else {
        setError('Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  };

  // Render optimizado - solo loading cuando es necesario
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  // Redirección inmediata si se detectó una
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
};

export default RutaProcesoRegistro;