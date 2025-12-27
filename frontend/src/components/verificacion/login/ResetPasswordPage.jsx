import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, AlertCircle, Lock } from 'lucide-react';

// 👈 AGREGADO: API_BASE_URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ResetPasswordPage = () => {
  const token = new URLSearchParams(window.location.search).get('token');
  const email = new URLSearchParams(window.location.search).get('email');
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setError('Enlace de restablecimiento inválido');
      setValidatingToken(false);
      return;
    }
    
    validateToken();
  }, [token, email]);

  const validateToken = async () => {
    try {
      // 👈 CORREGIDO: URL completa con API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/validate-reset-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, email })
      });

      const data = await response.json();

      if (data.success) {
        setTokenValid(true);
        setUserName(data.user_name);
      } else {
        setError(data.error || 'Token inválido o expirado');
      }
    } catch (err) {
      setError('Error de conexión. Por favor, intenta nuevamente.');
    } finally {
      setValidatingToken(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 👈 CORREGIDO: URL completa con API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/reset-password-with-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email,
          new_password: formData.newPassword,
          new_password_confirmation: formData.confirmPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          window.location.href = '/home';
        }, 3000);
      } else {
        setError(data.error || 'Error al restablecer la contraseña');
      }
    } catch (err) {
      setError('Error de conexión. Por favor, intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-white">Validando enlace...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Enlace Inválido</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/home'}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            Volver al Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">¡Contraseña Actualizada!</h1>
          <p className="text-gray-300 mb-6">
            Tu contraseña ha sido restablecida exitosamente. 
            Serás redirigido al home en unos segundos...
          </p>
          <div className="animate-pulse text-pink-400">
            Redirigiendo...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <Lock className="h-12 w-12 text-pink-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Restablecer Contraseña</h1>
          <p className="text-gray-300">
            ¡Hola {userName}! Ingresa tu nueva contraseña
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-200 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* 👈 CORREGIDO: Agregado form con onSubmit */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                placeholder="Ingresa tu nueva contraseña"
                className="w-full bg-white/10 border border-gray-600 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent placeholder-gray-400"
                required
                minLength={8}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                disabled={loading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirma tu nueva contraseña"
                className="w-full bg-white/10 border border-gray-600 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent placeholder-gray-400"
                required
                minLength={8}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4">
            <h3 className="text-blue-200 font-medium mb-2">Requisitos de seguridad:</h3>
            <ul className="text-blue-100 text-sm space-y-1">
              <li>• Mínimo 8 caracteres</li>
              <li>• Se cerrarán todas tus sesiones activas</li>
              <li>• Deberás iniciar sesión nuevamente</li>
            </ul>
          </div>

          {/* 👈 CORREGIDO: Botón ahora es type="submit" */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Actualizando...
              </div>
            ) : (
              'Actualizar Contraseña'
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => window.location.href = '/home'}
            className="text-gray-400 hover:text-white text-sm transition-colors"
            disabled={loading}
          >
            Volver al home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;