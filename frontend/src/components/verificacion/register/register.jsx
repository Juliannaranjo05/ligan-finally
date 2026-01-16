import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "/src/utils/auth.js";
import ReCAPTCHA from "react-google-recaptcha";
import { useTranslation } from "react-i18next";
import GoogleLoginButton from '../../auth/GoogleLoginButton'; // Ajusta la ruta
import audioManager from '../../../utils/AudioManager.js';

const RECAPTCHA_SITE_KEY = "6LfNonwrAAAAAIgJSmx1LpsprNhNct1VVWMWp2rz";

export default function Register({ onClose, onShowLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(null);
  const countdownRef = useRef(null);
  const { t } = useTranslation();

  // Limpiar el countdown cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError(t("register.errorFields"));
      return;
    }

    // 🔥 DESBLOQUEAR AUDIO DURANTE EL CLIC DEL BOTÓN (antes del registro)
    // Esto asegura que el audio se desbloquee mientras el evento de clic está activo
    try {
      await audioManager.unlockOnUserInteraction();
      console.log('✅ [Register] Audio desbloqueado durante clic del botón');
    } catch (error) {
      console.warn('⚠️ [Register] Error desbloqueando audio:', error);
    }

    try {
      setLoading(true);
      const result = await register(email, password, recaptchaToken);
      
      // El token ya se guarda en la función register, solo verificar que esté presente
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No se pudo guardar el token de autenticación");
      }
      
      localStorage.setItem("emailToVerify", email);
      // Guardar información sobre el estado del correo
      if (result.email_sent === false) {
        localStorage.setItem("email_not_sent", "true");
        localStorage.setItem("email_warning", result.email_warning || "El correo de verificación no se pudo enviar. Usa 'Reenviar código' para recibirlo.");
      } else {
        localStorage.removeItem("email_not_sent");
        localStorage.removeItem("email_warning");
      }
      
      // Marcar que acabamos de registrar para evitar que los hooks redirijan antes de tiempo
      localStorage.setItem("just_registered", "true");
      // No limpiar la bandera aquí, dejarla para que el hook la maneje
      navigate("/verificaremail", { state: { email }, replace: false });
    } catch (err) {
      // Mostrar mensaje específico para errores 429
      if (err.response?.status === 429) {
        const retrySeconds = parseInt(err.response?.headers?.['retry-after'] || err.response?.headers?.['x-ratelimit-retry-after'] || 60);
        setRateLimited(true);
        setRetryAfter(retrySeconds);
        setError(t("register.errors.errorRateLimit") || t("register.errors.tooManyAttempts") || `Demasiados intentos. Por favor espera ${retrySeconds} segundos antes de intentar nuevamente.`);
        
        // Deshabilitar el botón por el tiempo de retry
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
        countdownRef.current = setInterval(() => {
          setRetryAfter((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
              setRateLimited(false);
              setRetryAfter(null);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (err.message && err.message.includes("Demasiados intentos")) {
        setError(err.message);
        setRateLimited(true);
      } else {
        setRateLimited(false);
        
        // Manejar errores 422 (validación)
        if (err.response?.status === 422) {
          const errors = err.response?.data?.errors || {};
          const errorMessages = err.response?.data?.message || '';
          
          console.log('Error 422:', { errors, errorMessages }); // Debug
          
          // Priorizar mensajes específicos de validación
          if (errors.email) {
            const emailError = Array.isArray(errors.email) ? errors.email[0] : errors.email;
            // Detectar si el email ya está registrado (diferentes formatos de mensaje)
            if (emailError.includes('taken') || 
                emailError.includes('ya existe') || 
                emailError.includes('already been taken') ||
                emailError.includes('has already been taken') ||
                emailError === 'validation.unique' ||
                emailError.includes('validation.unique')) {
              setError(t("register.errors.emailExists") || "Este correo electrónico ya está registrado. Por favor usa otro o intenta iniciar sesión.");
            } else if (emailError.includes('invalid') || emailError.includes('válido') || emailError.includes('validation.email')) {
              setError(t("register.errors.emailInvalid") || "Por favor ingresa un correo válido.");
            } else {
              // Si es una clave de validación sin traducir, usar mensaje genérico traducido
              if (emailError.startsWith('validation.')) {
                setError(t("register.errors.emailExists") || "Este correo electrónico ya está registrado. Por favor usa otro o intenta iniciar sesión.");
              } else {
                setError(emailError);
              }
            }
          } else if (errors.password) {
            const passwordError = Array.isArray(errors.password) ? errors.password[0] : errors.password;
            if (passwordError.includes('min') || passwordError.includes('mínimo')) {
              setError(t("register.errors.passwordTooShort") || "La contraseña debe tener al menos 6 caracteres.");
            } else {
              setError(passwordError);
            }
          } else if (errorMessages) {
            setError(errorMessages);
          } else {
            setError(t("register.errorGeneric") || "Ocurrió un error. Por favor intenta nuevamente.");
          }
        } else {
          const errorMsg = err.response?.data?.message || err.message || '';
          console.log('Otro error:', errorMsg); // Debug
          // Mapear errores comunes a traducciones
          if (errorMsg && (errorMsg.includes("email") || errorMsg.includes("correo")) && 
              (errorMsg.includes("already been taken") || errorMsg.includes("ya existe") || errorMsg.includes("taken"))) {
            setError(t("register.errors.emailExists") || "Este correo electrónico ya está registrado. Por favor usa otro o intenta iniciar sesión.");
          } else if (errorMsg && errorMsg.includes("password") && (errorMsg.includes("min") || errorMsg.includes("mínimo"))) {
            setError(t("register.errors.passwordTooShort") || "La contraseña debe tener al menos 6 caracteres.");
          } else {
            setError(errorMsg || t("register.errorGeneric") || "Ocurrió un error. Por favor intenta nuevamente.");
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (errorMessage) => {
    setError(errorMessage);
    setGoogleLoading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1c20] rounded-2xl p-6 sm:p-10 w-[350px] max-w-full shadow-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-4 text-white text-xl hover:text-[#ff007a] transition"
          onClick={onClose}
        >
          ×
        </button>

        <h2 className="text-2xl text-[#ff007a] font-dancing-script text-center">
          {t("register.title")}
        </h2>
        <p className="text-center text-white/80 mb-6">
          {t("register.subtitle")}
        </p>

        {error && (
          <div className="text-red-500 text-sm mb-4 text-center">
            {error}
          </div>
        )}

        {/* Botón de Google */}
        <div className="mb-4">
          <GoogleLoginButton
            loading={googleLoading}
            onError={handleGoogleError}
            disabled={loading}
            text={t('register.google_button') || "Registrarse con Google"}
          />
        </div>

        {/* Separador */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-600"></div>
          <span className="px-3 text-white/60 text-sm">o</span>
          <div className="flex-1 border-t border-gray-600"></div>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder={t("register.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 mb-4 bg-[#1a1c20] border border-[#2c2e33] text-white rounded-xl placeholder-white/60"
            required
            disabled={loading || googleLoading}
          />

          <input
            type="password"
            placeholder={t("register.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 bg-[#1a1c20] border border-[#2c2e33] text-white rounded-xl placeholder-white/60"
            required
            disabled={loading || googleLoading}
          />

          <button
            type="submit"
            disabled={loading || googleLoading || rateLimited}
            className="w-full py-3 bg-[#ff007a] text-white font-bold rounded-xl hover:bg-[#e6006e] transition disabled:opacity-50"
          >
            {loading 
              ? t("register.loading") 
              : rateLimited && retryAfter 
                ? `${t("register.errors.tooManyAttempts") || "Espera"} (${retryAfter}s)` 
                : t("register.button")}
          </button>

          <div className="text-center text-white/80 mt-6">
            {t("register.haveAccount")}{" "}
            <button
              type="button"
              className="text-[#ff007a] underline"
              onClick={() => navigate("/home?auth=login")}
              disabled={loading || googleLoading}
            >
              {t("register.loginLink")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}