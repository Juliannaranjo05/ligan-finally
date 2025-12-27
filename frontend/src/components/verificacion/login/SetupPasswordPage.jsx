import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const SetupPasswordPage = () => {
  const { t } = useTranslation();
  const token = new URLSearchParams(window.location.search).get('token');
  const email = new URLSearchParams(window.location.search).get('email');
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!token || !email) {
      setError(t?.('settings.setupPassword.invalidLink') || 'Enlace inválido');
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError(t?.('settings.setupPassword.passwordsMismatch') || 'Las contraseñas no coinciden');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError(t?.('settings.setupPassword.passwordTooShort') || 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/setup-password-with-token`, {
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
        setError(data.error || t?.('settings.setupPassword.error') || 'Error al establecer la contraseña');
      }
    } catch (err) {
      setError(t?.('settings.setupPassword.connectionError') || 'Error de conexión. Por favor, intenta nuevamente.');
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

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-[#0a0d10] flex items-center justify-center p-4">
        <div className="bg-[#0a0d10] border border-[#ff007a]/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">
            {t?.('settings.setupPassword.invalidLink') || 'Enlace Inválido'}
          </h1>
          <p className="text-gray-300 mb-6">
            {t?.('settings.setupPassword.invalidLinkDescription') || 'El enlace de establecimiento de contraseña es inválido o está incompleto.'}
          </p>
          <button
            onClick={() => window.location.href = '/home'}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            {t?.('settings.setupPassword.backToHome') || 'Volver al Home'}
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0d10] flex items-center justify-center p-4">
        <div className="bg-[#0a0d10] border border-[#ff007a]/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">
            {t?.('settings.setupPassword.successTitle') || '¡Contraseña Establecida!'}
          </h1>
          <p className="text-gray-300 mb-6">
            {t?.('settings.setupPassword.successMessage') || 'Tu contraseña ha sido establecida exitosamente. Ya puedes iniciar sesión con tu email y contraseña, o seguir usando Google.'}
          </p>
          <div className="animate-pulse text-pink-400">
            {t?.('settings.setupPassword.redirecting') || 'Redirigiendo al home...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0d10] flex items-center justify-center p-4">
      <div className="bg-[#0a0d10] border border-[#ff007a]/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-8">
          <Lock className="h-12 w-12 text-pink-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">
            {t?.('settings.setupPassword.title') || 'Establecer Contraseña'}
          </h1>
          <p className="text-gray-300">
            {t?.('settings.setupPassword.description') || 'Establece una contraseña para tu cuenta. Podrás iniciar sesión tanto con Google como con tu email y contraseña.'}
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              {t?.('settings.setupPassword.newPassword') || 'Nueva Contraseña'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                placeholder={t?.('settings.setupPassword.newPasswordPlaceholder') || 'Ingresa tu nueva contraseña'}
                className="w-full bg-[#1a1d20] border border-gray-700 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#ff007a] focus:border-transparent placeholder-gray-500"
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
              {t?.('settings.setupPassword.confirmPassword') || 'Confirmar Contraseña'}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder={t?.('settings.setupPassword.confirmPasswordPlaceholder') || 'Confirma tu nueva contraseña'}
                className="w-full bg-[#1a1d20] border border-gray-700 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#ff007a] focus:border-transparent placeholder-gray-500"
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

          <div className="bg-[#1a1d20] border border-[#ff007a]/20 rounded-xl p-4">
            <h3 className="text-[#ff007a] font-medium mb-2">
              {t?.('settings.setupPassword.requirementsTitle') || 'Requisitos de seguridad:'}
            </h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• {t?.('settings.setupPassword.minimumCharacters') || 'Mínimo 8 caracteres'}</li>
              <li>• {t?.('settings.setupPassword.canUseGoogle') || 'Podrás seguir usando Google para iniciar sesión'}</li>
              <li>• {t?.('settings.setupPassword.canUseEmail') || 'O usar tu email y contraseña'}</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {t?.('settings.setupPassword.settingUp') || 'Estableciendo...'}
              </div>
            ) : (
              t?.('settings.setupPassword.setupButton') || 'Establecer Contraseña'
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => window.location.href = '/home'}
            className="text-gray-400 hover:text-white text-sm transition-colors"
            disabled={loading}
          >
            {t?.('settings.setupPassword.backToHome') || 'Volver al home'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupPasswordPage;

