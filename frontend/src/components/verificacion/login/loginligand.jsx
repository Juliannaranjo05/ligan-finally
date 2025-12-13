import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithoutRedirect } from "../../../utils/auth";
import { useTranslation } from 'react-i18next';
import GoogleLoginButton from '../../auth/GoogleLoginButton';
import ForgotPasswordModal from './ForgotPasswordModal'; // 👈 NUEVO IMPORT

export default function LoginLigand({ onClose, onShowRegister }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false); // 👈 NUEVO ESTADO
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("🔑 Iniciando login...");
      await loginWithoutRedirect(email, password);
      
      console.log("✅ Login exitoso, redirigiendo al dashboard");
      navigate("/dashboard", { replace: true });

    } catch (err) {
      const backendMessage = err?.message || "Correo o contraseña incorrectos.";
      setError(backendMessage);
      console.error("🛑 Error en login:", backendMessage);
      setLoading(false);
    }
  };

  const handleGoogleError = (errorMessage) => {
    setError(errorMessage);
    setGoogleLoading(false);
  };

  return (
    <>
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
            {t('login.titulo')}
          </h2>
          <p className="text-center text-white/80 mb-6">
            {t('login.subtitulo')}
          </p>

          {error && (
            <div className="text-red-500 text-sm text-center mb-4">{error}</div>
          )}

          {/* Botón de Google */}
          <div className="mb-4">
            <GoogleLoginButton
              loading={googleLoading}
              onError={handleGoogleError}
              disabled={loading}
              text={t('login.google_button') || "Continuar con Google"}
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
              placeholder={t('login.placeholder_email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 mb-4 bg-[#1a1c20] border border-[#2c2e33] text-white rounded-xl placeholder-white/60"
              disabled={loading || googleLoading}
            />
            <input
              type="password"
              placeholder={t('login.placeholder_contrasena')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 mb-4 bg-[#1a1c20] border border-[#2c2e33] text-white rounded-xl placeholder-white/60"
              disabled={loading || googleLoading}
            />

            {/* 👈 NUEVA SECCIÓN CON CHECKBOX Y ENLACE */}
            <div className="flex items-center justify-between mb-4">
              <label className="text-white/80 flex items-center gap-2">
                <input type="checkbox" disabled={loading || googleLoading} /> 
                {t('login.recuerdame')}
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-[#ff007a] hover:text-[#e6006e] text-sm underline transition"
                disabled={loading || googleLoading}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 bg-[#ff007a] text-white font-bold rounded-xl hover:bg-[#e6006e] transition disabled:opacity-50"
            >
              {loading ? t("login.loading") : t("login.boton_iniciar")}
            </button>

            <div className="text-center text-white/80 mt-6">
              {t('login.no_tienes_cuenta')}{" "}
              <button
                type="button"
                className="text-[#ff007a] underline"
                onClick={() => navigate("/home?auth=register")}
                disabled={loading || googleLoading}
              >
                {t('login.registrate')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 👈 NUEVO MODAL */}
      <ForgotPasswordModal 
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
}