import React, { useState, useEffect } from 'react';
import { Lock, LogOut, Trash2, X, Check, AlertCircle, Mail, Shield } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const SecuritySettings = ({ t }) => {
  // Estados principales
  const [modalActivo, setModalActivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  
  // Estados para cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [passwordStep, setPasswordStep] = useState(1); // 1: form, 2: código, 3: éxito
  
  // Estados para logout all
  const [logoutCode, setLogoutCode] = useState('');
  const [logoutStep, setLogoutStep] = useState(1); // 1: confirmación, 2: código, 3: éxito
  
  // Estados para eliminar cuenta
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteStep, setDeleteStep] = useState(1); // 1: form, 2: código, 3: éxito

  // Auto-focus en inputs de código cuando cambian los pasos
  useEffect(() => {
    // Pequeño delay para asegurar que el DOM se haya actualizado
    const timer = setTimeout(() => {
      const codigoInput = document.querySelector('input[inputMode="numeric"]');
      if (codigoInput) {
        codigoInput.focus();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [passwordStep, logoutStep, deleteStep]);

  // Función para obtener headers con autenticación
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    console.log('🔑 Token encontrado:', token ? 'Sí (' + token.substring(0, 20) + '...)' : 'No');
    
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Requested-With': 'XMLHttpRequest'
    };
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 5000);
  };

  // Función para manejar errores de autenticación
  const manejarErrorAuth = (response) => {
    if (response.status === 401) {
      mostrarMensaje('error', 'Sesión expirada. Redirigiendo al login...');
      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }, 2000);
      return true;
    }
    return false;
  };

  const abrirModal = (tipo) => {
    setModalActivo(tipo);
    setMensaje({ tipo: '', texto: '' });
    
    // Resetear estados según el modal
    if (tipo === 'changePassword') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordCode('');
      setPasswordStep(1);
    } else if (tipo === 'logoutAll') {
      setLogoutCode('');
      setLogoutStep(1);
    } else if (tipo === 'deleteAccount') {
      setDeletePassword('');
      setDeleteCode('');
      setDeleteConfirmText('');
      setDeleteStep(1);
    }
  };

  const cerrarModal = () => {
    setModalActivo(null);
    setMensaje({ tipo: '', texto: '' });
    // Resetear todos los estados
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordCode('');
    setPasswordStep(1);
    setLogoutCode('');
    setLogoutStep(1);
    setDeletePassword('');
    setDeleteCode('');
    setDeleteConfirmText('');
    setDeleteStep(1);
  };

  // Función para cerrar modal con delay (para mostrar mensaje de éxito)
  const cerrarModalConDelay = () => {
    setTimeout(() => {
      cerrarModal();
    }, 2500); // Dar tiempo para leer el mensaje
  };

  // 🔐 FUNCIONES PARA CAMBIO DE CONTRASEÑA

  const solicitarCodigoPassword = async () => {
    if (!currentPassword) {
      mostrarMensaje('error', 'Ingresa tu contraseña actual');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      mostrarMensaje('error', 'La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      mostrarMensaje('error', 'Las contraseñas nuevas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/request-password-change-code`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          current_password: currentPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        setPasswordStep(2);
        mostrarMensaje('success', 'Código enviado a tu correo electrónico');
      } else {
        mostrarMensaje('error', data.error || 'Error solicitando código');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const cambiarPassword = async () => {
    if (!passwordCode || passwordCode.length !== 6) {
      mostrarMensaje('error', 'Ingresa el código de 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/change-password-with-code`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code: passwordCode,
          new_password: newPassword,
          new_password_confirmation: confirmPassword
        })
      });

      if (manejarErrorAuth(response)) return;

      const data = await response.json();

      if (data.success) {
        setPasswordStep(3);
        mostrarMensaje('success', '🎉 ¡Contraseña cambiada exitosamente!');
        cerrarModalConDelay();
      } else {
        mostrarMensaje('error', data.error || 'Error cambiando contraseña');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // 🚪 FUNCIONES PARA LOGOUT ALL

  const solicitarCodigoLogout = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/request-logout-all-code`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (data.success) {
        setLogoutStep(2);
        mostrarMensaje('success', 'Código enviado a tu correo electrónico');
      } else {
        mostrarMensaje('error', data.error || 'Error solicitando código');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const logoutAll = async () => {
    if (!logoutCode || logoutCode.length !== 6) {
      mostrarMensaje('error', 'Ingresa el código de 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/logout-all-with-code`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code: logoutCode
        })
      });

      const data = await response.json();

      if (data.success) {
        setLogoutStep(3);
        mostrarMensaje('success', '🎉 ¡Todas las sesiones han sido cerradas exitosamente!');
        cerrarModalConDelay();
      } else {
        mostrarMensaje('error', data.error || 'Error cerrando sesiones');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // 🗑️ FUNCIONES PARA ELIMINAR CUENTA

  const solicitarCodigoDelete = async () => {
    if (!deletePassword) {
      mostrarMensaje('error', 'Ingresa tu contraseña');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/request-delete-account-code`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          current_password: deletePassword
        })
      });

      const data = await response.json();

      if (data.success) {
        setDeleteStep(2);
        mostrarMensaje('success', 'Código enviado a tu correo electrónico');
      } else {
        mostrarMensaje('error', data.error || 'Error solicitando código');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const eliminarCuenta = async () => {
    if (!deleteCode || deleteCode.length !== 6) {
      mostrarMensaje('error', 'Ingresa el código de 6 dígitos');
      return;
    }

    if (deleteConfirmText.toUpperCase() !== 'ELIMINAR') {
      mostrarMensaje('error', 'Debes escribir "ELIMINAR" para confirmar');
      return;
    }

    setLoading(true);
    try {
      console.log('🗑️ Intentando eliminar cuenta...', {
        code: deleteCode,
        confirmation: deleteConfirmText
      });

      const response = await fetch(`${API_BASE_URL}/api/security/delete-account-with-code`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code: deleteCode,
          confirmation_text: deleteConfirmText
        })
      });

      console.log('📡 Respuesta del servidor:', response.status, response.statusText);

      // Si es 401, mostrar error específico
      if (response.status === 401) {
        mostrarMensaje('error', 'Sesión expirada. Por favor, inicia sesión nuevamente.');
        // Opcional: redirigir al login
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const data = await response.json();
      console.log('📋 Datos recibidos:', data);

      if (data.success) {
        setDeleteStep(3);
        mostrarMensaje('success', '🗑️ Cuenta eliminada correctamente. Redirigiendo...');
        // Limpiar localStorage antes de redirigir
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Esperar un poco antes de redirigir
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } else {
        mostrarMensaje('error', data.error || 'Error eliminando cuenta');
      }
    } catch (error) {
      console.error('❌ Error de red:', error);
      mostrarMensaje('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // 🔄 REENVIAR CÓDIGO
  const reenviarCodigo = async (actionType) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/resend-code`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action_type: actionType
        })
      });

      const data = await response.json();

      if (data.success) {
        mostrarMensaje('success', 'Nuevo código enviado');
      } else {
        mostrarMensaje('error', data.error || 'Error reenviando código');
      }
    } catch (error) {
      mostrarMensaje('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // 🎨 COMPONENTES DE UI

  const ConfigBoton = ({ icon, texto, onClick, danger = false }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 bg-[#131418] hover:bg-[#1c1f25] transition px-4 py-2 rounded-lg text-left border border-white/10 ${
        danger ? 'hover:border-red-500/30' : ''
      }`}
    >
      <span className={danger ? 'text-red-400' : 'text-[#ff007a]'}>{icon}</span>
      <span className="text-sm text-white">{texto}</span>
    </button>
  );

  const MensajeEstado = () => {
    if (!mensaje.texto) return null;
    
    return (
      <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 ${
        mensaje.tipo === 'success' 
          ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
          : 'bg-red-600/20 text-red-400 border border-red-600/30'
      }`}>
        {mensaje.tipo === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
        <span className="text-sm">{mensaje.texto}</span>
      </div>
    );
  };

  const CodigoInput = ({ value, onChange, placeholder = "Código de 6 dígitos" }) => {
    const inputRef = React.useRef(null);
    
    // Auto-focus cuando el componente se monta
    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);

    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(val);
        }}
        onKeyDown={(e) => {
          // Permitir: backspace, delete, tab, escape, enter
          if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
              // Permitir: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
              (e.keyCode === 65 && e.ctrlKey === true) ||
              (e.keyCode === 67 && e.ctrlKey === true) ||
              (e.keyCode === 86 && e.ctrlKey === true) ||
              (e.keyCode === 88 && e.ctrlKey === true)) {
            return;
          }
          // Asegurar que solo sean números
          if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
            e.preventDefault();
          }
        }}
        onPaste={(e) => {
          // Permitir pegar y limpiar automáticamente
          const paste = (e.clipboardData || window.clipboardData).getData('text');
          const cleanPaste = paste.replace(/\D/g, '').slice(0, 6);
          onChange(cleanPaste);
          e.preventDefault();
        }}
        maxLength={6}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        className="w-full px-4 py-3 bg-[#131418] text-white placeholder-white/60 rounded-lg outline-none focus:ring-2 focus:ring-[#ff007a]/50 border border-white/10 text-center text-lg font-mono tracking-widest"
        placeholder={placeholder}
      />
    );
  };

  const PantallaExito = ({ titulo, mensaje, icono }) => (
    <div className="text-center space-y-4">
      <div className="text-6xl mb-4">{icono}</div>
      <h4 className="text-lg font-bold text-white">{titulo}</h4>
      <p className="text-green-400 text-sm">{mensaje}</p>
      <div className="text-white/60 text-xs">
        Este modal se cerrará automáticamente...
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <MensajeEstado />
      
      {/* Botones de configuración de seguridad */}
      <ConfigBoton 
        icon={<Lock size={18} />} 
        texto={t?.("settings.changePassword") || "Cambiar Contraseña"} 
        onClick={() => abrirModal("changePassword")} 
      />
      <ConfigBoton 
        icon={<LogOut size={18} />} 
        texto={t?.("settings.logoutAll") || "Cerrar Todas las Sesiones"} 
        onClick={() => abrirModal("logoutAll")} 
      />
      <ConfigBoton 
        icon={<Trash2 size={18} />} 
        texto={t?.("settings.deleteAccount") || "Eliminar Cuenta"} 
        onClick={() => abrirModal("deleteAccount")}
        danger={true}
      />

      {/* MODAL CAMBIAR CONTRASEÑA */}
      {modalActivo === "changePassword" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0d10] border border-[#ff007a]/30 rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-[#ff007a]/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">🔐 Cambiar Contraseña</h3>
              {passwordStep !== 3 && (
                <button onClick={cerrarModal} className="text-white/60 hover:text-white">
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Contenido */}
            <div className="p-6">
              <MensajeEstado />

              {passwordStep === 1 ? (
                <div className="space-y-4">
                  <p className="text-white/70 text-sm">
                    Para cambiar tu contraseña, necesitamos verificar tu identidad.
                  </p>
                  
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[#131418] text-white placeholder-white/60 rounded-lg outline-none focus:ring-2 focus:ring-[#ff007a]/50 border border-white/10"
                    placeholder="Contraseña actual"
                  />
                  
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[#131418] text-white placeholder-white/60 rounded-lg outline-none focus:ring-2 focus:ring-[#ff007a]/50 border border-white/10"
                    placeholder="Nueva contraseña (mín. 8 caracteres)"
                  />
                  
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[#131418] text-white placeholder-white/60 rounded-lg outline-none focus:ring-2 focus:ring-[#ff007a]/50 border border-white/10"
                    placeholder="Confirmar nueva contraseña"
                  />
                </div>
              ) : passwordStep === 2 ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <Mail className="mx-auto mb-3 text-[#ff007a]" size={32} />
                    <h4 className="font-medium text-white mb-2">Código enviado</h4>
                    <p className="text-white/70 text-sm">
                      Te hemos enviado un código de 6 dígitos a tu correo electrónico.
                    </p>
                  </div>
                  
                  <CodigoInput 
                    value={passwordCode}
                    onChange={setPasswordCode}
                  />
                  
                  <button
                    onClick={() => reenviarCodigo('change_password')}
                    disabled={loading}
                    className="w-full text-center text-[#ff007a] text-sm hover:underline disabled:opacity-50"
                  >
                    ¿No recibiste el código? Reenviar
                  </button>
                </div>
              ) : (
                <PantallaExito 
                  titulo="¡Contraseña cambiada!"
                  mensaje="Tu contraseña ha sido actualizada exitosamente."
                  icono="🎉"
                />
              )}
            </div>

            {/* Botones - Solo mostrar si no está en pantalla de éxito */}
            {passwordStep !== 3 && (
              <div className="p-6 border-t border-[#ff007a]/20 flex gap-3">
                <button
                  onClick={cerrarModal}
                  disabled={loading}
                  className="flex-1 bg-[#131418] hover:bg-[#1c1f25] text-white px-4 py-2 rounded-lg transition-colors border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={passwordStep === 1 ? solicitarCodigoPassword : cambiarPassword}
                  disabled={loading}
                  className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Procesando...' : passwordStep === 1 ? 'Enviar código' : 'Cambiar contraseña'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CERRAR TODAS LAS SESIONES */}
      {modalActivo === "logoutAll" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0d10] border border-[#ff007a]/30 rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-[#ff007a]/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">🚪 Cerrar Todas las Sesiones</h3>
              {logoutStep !== 3 && (
                <button onClick={cerrarModal} className="text-white/60 hover:text-white">
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Contenido */}
            <div className="p-6">
              <MensajeEstado />

              {logoutStep === 1 ? (
                <div className="space-y-4">
                  <div className="bg-[#ff007a]/10 border border-[#ff007a]/30 rounded-lg p-3">
                    <h4 className="text-[#ff007a] font-medium text-sm mb-2">¿Qué va a pasar?</h4>
                    <ul className="text-[#ff007a]/90 text-xs space-y-1">
                      <li>• Se cerrarán todas tus sesiones activas</li>
                      <li>• Tendrás que volver a iniciar sesión en otros dispositivos</li>
                      <li>• Tu sesión actual se mantendrá activa</li>
                    </ul>
                  </div>
                  
                  <p className="text-white/70 text-sm">
                    Para continuar, te enviaremos un código de verificación a tu correo electrónico.
                  </p>
                </div>
              ) : logoutStep === 2 ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <Mail className="mx-auto mb-3 text-[#ff007a]" size={32} />
                    <h4 className="font-medium text-white mb-2">Código enviado</h4>
                    <p className="text-white/70 text-sm">
                      Te hemos enviado un código de verificación a tu correo electrónico.
                    </p>
                  </div>
                  
                  <CodigoInput 
                    value={logoutCode}
                    onChange={setLogoutCode}
                  />
                  
                  <button
                    onClick={() => reenviarCodigo('logout_all')}
                    disabled={loading}
                    className="w-full text-center text-[#ff007a] text-sm hover:underline disabled:opacity-50"
                  >
                    ¿No recibiste el código? Reenviar
                  </button>
                </div>
              ) : (
                <PantallaExito 
                  titulo="¡Sesiones cerradas!"
                  mensaje="Todas tus sesiones han sido cerradas exitosamente."
                  icono="🚪"
                />
              )}
            </div>

            {/* Botones */}
            {logoutStep !== 3 && (
              <div className="p-6 border-t border-[#ff007a]/20 flex gap-3">
                <button
                  onClick={cerrarModal}
                  disabled={loading}
                  className="flex-1 bg-[#131418] hover:bg-[#1c1f25] text-white px-4 py-2 rounded-lg transition-colors border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={logoutStep === 1 ? solicitarCodigoLogout : logoutAll}
                  disabled={loading}
                  className="flex-1 bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Procesando...' : logoutStep === 1 ? 'Enviar código' : 'Cerrar sesiones'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR CUENTA */}
      {modalActivo === "deleteAccount" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0d10] border border-red-500/30 rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="p-6 border-b border-red-500/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">🗑️ Eliminar Cuenta</h3>
              {deleteStep !== 3 && (
                <button onClick={cerrarModal} className="text-white/60 hover:text-white">
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Contenido */}
            <div className="p-6">
              <MensajeEstado />

              {deleteStep === 1 ? (
                <div className="space-y-4">
                  <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-3">
                    <h4 className="text-red-400 font-medium text-sm mb-2">⚠️ ADVERTENCIA</h4>
                    <ul className="text-red-400/90 text-xs space-y-1">
                      <li>• Esta acción es PERMANENTE e IRREVERSIBLE</li>
                      <li>• Se eliminarán todos tus datos y conversaciones</li>
                      <li>• No podrás recuperar tu cuenta</li>
                      <li>• Perderás acceso a todas las funciones</li>
                    </ul>
                  </div>
                  
                  <p className="text-white/70 text-sm">
                    Para continuar, confirma tu contraseña:
                  </p>
                  
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[#131418] text-white placeholder-white/60 rounded-lg outline-none focus:ring-2 focus:ring-red-500/50 border border-red-500/30"
                    placeholder="Tu contraseña actual"
                  />
                </div>
              ) : deleteStep === 2 ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <Mail className="mx-auto mb-3 text-red-400" size={32} />
                    <h4 className="font-medium text-white mb-2">Verificación final</h4>
                    <p className="text-white/70 text-sm">
                      Te hemos enviado un código de verificación. Esta es tu última oportunidad para cancelar.
                    </p>
                  </div>
                  
                  <CodigoInput 
                    value={deleteCode}
                    onChange={setDeleteCode}
                  />
                  
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Para confirmar, escribe "ELIMINAR":
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full px-4 py-3 bg-[#131418] text-white placeholder-white/60 rounded-lg outline-none focus:ring-2 focus:ring-red-500/50 border border-red-500/30"
                      placeholder="ELIMINAR"
                    />
                  </div>
                  
                  <button
                    onClick={() => reenviarCodigo('delete_account')}
                    disabled={loading}
                    className="w-full text-center text-red-400 text-sm hover:underline disabled:opacity-50"
                  >
                    ¿No recibiste el código? Reenviar
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="text-6xl mb-4">🗑️</div>
                  <h4 className="text-lg font-bold text-white">Cuenta eliminada</h4>
                  <p className="text-red-400 text-sm">Tu cuenta ha sido eliminada permanentemente.</p>
                  <div className="text-white/60 text-xs">
                    Redirigiendo al inicio...
                  </div>
                </div>
              )}
            </div>

            {/* Botones */}
            {deleteStep !== 3 && (
              <div className="p-6 border-t border-red-500/20 flex gap-3">
                <button
                  onClick={cerrarModal}
                  disabled={loading}
                  className="flex-1 bg-[#131418] hover:bg-[#1c1f25] text-white px-4 py-2 rounded-lg transition-colors border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={deleteStep === 1 ? solicitarCodigoDelete : eliminarCuenta}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Procesando...' : deleteStep === 1 ? 'Enviar código' : 'ELIMINAR CUENTA'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SecuritySettings;