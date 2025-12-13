import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import api from '../api/axios'; // Usa axios con credenciales habilitadas (withCredentials: true)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const RutaClienteYaVerificado = () => {
  const [isValidCliente, setIsValidCliente] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    verificarCliente();
  }, []);

  const verificarCliente = async () => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/profile`); // Usa cookies para autenticar

      if (response?.data?.user?.rol === 'cliente') {
        setIsValidCliente(true);
      } else {
        setError('Acceso denegado: No eres cliente');
        if(user?.verificacion_estado === 'pendiente') {
        return <Navigate to="/anteveri" replace />;
        }
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Sesión expirada');
      } else {
        setError('Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    
    }

  if (!isValidCliente) {
    return <Navigate to="/anteveri" replace />;
  }

  return <Outlet />;
};

export default RutaClienteYaVerificado;
