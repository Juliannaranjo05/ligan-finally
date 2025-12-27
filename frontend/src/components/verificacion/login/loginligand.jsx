import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithoutRedirect, getUser } from "../../../utils/auth";
import { useTranslation } from 'react-i18next';
import GoogleLoginButton from '../../auth/GoogleLoginButton';
import ForgotPasswordModal from './ForgotPasswordModal'; // 👈 NUEVO IMPORT

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 🔄 Verificar balance y ejecutar acción pendiente (para login normal)
const verificarBalanceYEjecutarAccionLogin = async (actionData) => {
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
        await iniciarLlamadaDirectaLogin(actionData.userId);
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

// 📞 Iniciar llamada directa (para login normal)
const iniciarLlamadaDirectaLogin = async (modeloUserId) => {
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
      await loginWithoutRedirect(email, password);
      
      // 🔄 Verificar si hay una acción pendiente de historias
      const pendingAction = localStorage.getItem('pendingStoryAction');
      if (pendingAction) {
        try {
          const actionData = JSON.parse(pendingAction);
          
          // Limpiar la acción pendiente
          localStorage.removeItem('pendingStoryAction');
          
          // Ejecutar la acción pendiente
          if (actionData.action === 'chat') {
            // Obtener el usuario actual para generar el room_name
            const userData = await getUser();
            const currentUserId = userData?.id || userData?.user?.id;
            const otherUserId = actionData.userId;
            
            if (!currentUserId || !otherUserId) {
              navigate("/dashboard", { replace: true });
              return;
            }
            
            // Generar room_name (mismo formato que usa el backend)
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
            verificarBalanceYEjecutarAccionLogin(actionData);
            return;
          }
        } catch (error) {
          localStorage.removeItem('pendingStoryAction');
          navigate("/dashboard", { replace: true });
        }
      } else {
        // No hay acción pendiente, redirigir normalmente
        navigate("/dashboard", { replace: true });
      }

    } catch (err) {
      const backendMessage = err?.message || "Correo o contraseña incorrectos.";
      setError(backendMessage);
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
                {t('login.olvidaste_contrasena')}
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