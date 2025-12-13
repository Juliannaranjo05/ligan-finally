// contexts/NotificationContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification debe usarse dentro de NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      ...notification,
      duration: notification.duration || 5000, // 5 segundos por defecto
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remover después del tiempo especificado
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  // Métodos de conveniencia
  const showSuccess = useCallback((message, options = {}) => {
    return addNotification({
      type: 'success',
      message,
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((message, options = {}) => {
    return addNotification({
      type: 'error',
      message,
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((message, options = {}) => {
    return addNotification({
      type: 'warning',
      message,
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((message, options = {}) => {
    return addNotification({
      type: 'info',
      message,
      ...options
    });
  }, [addNotification]);

  // Método especial para confirmaciones
  const showConfirmation = useCallback((message, onConfirm, onCancel) => {
    return addNotification({
      type: 'confirmation',
      message,
      onConfirm,
      onCancel,
      duration: 0, // No auto-remover
    });
  }, [addNotification]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirmation,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// Componente de contenedor de notificaciones
const NotificationContainer = () => {
  const { notifications } = useNotification();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm w-full pointer-events-none">
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
};

// Componente individual de notificación
const NotificationItem = ({ notification }) => {
  const { removeNotification } = useNotification();
  const { id, type, message, title, onConfirm, onCancel } = notification;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-[#ff007a]" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      case 'confirmation':
        return <AlertCircle className="w-5 h-5 text-[#ff007a]" />;
      default:
        return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStyles = () => {
    const baseStyles = "bg-[#1f2125] border rounded-2xl p-4 shadow-2xl backdrop-blur-sm animate-slide-in-right pointer-events-auto";
    
    switch (type) {
      case 'success':
        return `${baseStyles} border-[#ff007a]/40 bg-[#ff007a]/10`;
      case 'error':
        return `${baseStyles} border-red-400/40 bg-red-400/10`;
      case 'warning':
        return `${baseStyles} border-yellow-400/40 bg-yellow-400/10`;
      case 'info':
        return `${baseStyles} border-blue-400/40 bg-blue-400/10`;
      case 'confirmation':
        return `${baseStyles} border-[#ff007a]/40 bg-[#ff007a]/10`;
      default:
        return `${baseStyles} border-gray-400/40 bg-gray-400/10`;
    }
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    removeNotification(id);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    removeNotification(id);
  };

  return (
    <div className={getStyles()}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-white font-bold text-sm mb-1">{title}</h4>
          )}
          <p className="text-white/90 text-sm leading-relaxed">{message}</p>
          
          {/* Botones para confirmación */}
          {type === 'confirmation' && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleConfirm}
                className="bg-[#ff007a] hover:bg-[#e6006e] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 hover:scale-105 shadow-lg"
              >
                Confirmar
              </button>
              <button
                onClick={handleCancel}
                className="bg-[#2b2d31] hover:bg-[#373a3f] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 hover:scale-105 border border-[#ff007a]/30"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        
        {/* Botón cerrar (solo para notificaciones que no son confirmación) */}
        {type !== 'confirmation' && (
          <button
            onClick={() => removeNotification(id)}
            className="text-white/50 hover:text-white/90 transition-colors flex-shrink-0 hover:bg-white/10 rounded-lg p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// CSS adicional para animaciones (agregar a tu archivo CSS principal)
const styles = `
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
    scale: 0.9;
  }
  to {
    transform: translateX(0);
    opacity: 1;
    scale: 1;
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(255, 0, 122, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 0, 122, 0.5);
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.notification-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Para dispositivos móviles */
@media (max-width: 640px) {
  .notification-container {
    top: 1rem;
    left: 1rem;
    right: 1rem;
    max-width: none;
  }
}
`;

// Hook personalizado para mensajes comunes de la aplicación
export const useAppNotifications = () => {
  const { showSuccess, showError, showWarning, showInfo, showConfirmation } = useNotification();

  return {
    // ===== NOTIFICACIONES DE HISTORIA =====
    storyUploaded: () => showSuccess("✅ Historia subida correctamente, esperando aprobación", {
      title: "Historia Enviada"
    }),
    storyApproved: () => showSuccess("🎉 ¡Tu historia ha sido aprobada y ya es visible!", {
      title: "¡Felicidades!"
    }),
    storyRejected: (reason) => showError(`❌ Historia rechazada: ${reason}`, {
      title: "Historia Rechazada"
    }),
    storyDeleted: () => showSuccess("🗑️ Historia eliminada correctamente", {
      title: "Historia Eliminada"
    }),
    
    // ===== NOTIFICACIONES DE GRABACIÓN =====
    recordingStarted: () => showInfo("🎬 Grabación iniciada", {
      duration: 2000
    }),
    recordingStopped: () => showSuccess("📹 Video grabado correctamente", {
      title: "Grabación Completa"
    }),
    recordingLimit: () => showWarning("⏰ Límite de grabación alcanzado (15 segundos)", {
      title: "Tiempo Agotado"
    }),
    
    // ===== NOTIFICACIONES DE ARCHIVO =====
    fileLoaded: (type) => showSuccess(`${type === 'video' ? '📹' : '🖼️'} ${type === 'video' ? 'Video' : 'Imagen'} cargado correctamente`, {
      duration: 3000
    }),
    fileRemoved: () => showInfo("🗑️ Contenido eliminado", {
      duration: 2000
    }),
    
    // ===== NOTIFICACIONES DE ERROR =====
    uploadError: () => showError("❌ Error al subir la historia. Intenta nuevamente", {
      title: "Error de Subida"
    }),
    deleteError: () => showError("❌ Error al eliminar la historia. Intenta nuevamente", {
      title: "Error de Eliminación"
    }),
    unauthorized: () => showError("❌ No estás autorizado para realizar esta acción", {
      title: "Acceso Denegado"
    }),
    cameraError: () => showError("📹 Error al acceder a la cámara. Verifica los permisos", {
      title: "Error de Cámara"
    }),
    networkError: () => showError("🌐 Error de conexión. Verifica tu internet", {
      title: "Sin Conexión"
    }),
    
    // ===== NOTIFICACIONES DE ESTADO =====
    storyPending: () => showWarning("⏳ Ya tienes una historia esperando aprobación", {
      title: "Historia Pendiente"
    }),
    storyExists: () => showWarning("📱 Ya tienes una historia activa", {
      title: "Historia Existente"
    }),
    
    // ===== NOTIFICACIONES DE VALIDACIÓN =====
    invalidFile: () => showError("📄 Solo se permiten imágenes (JPG, PNG) o videos (MP4, WebM)", {
      title: "Archivo No Válido"
    }),
    videoDuration: () => showError("⏰ El video no puede durar más de 15 segundos", {
      title: "Video Muy Largo"
    }),
    fileSizeLimit: () => showError("📦 El archivo es muy grande. Máximo 50MB", {
      title: "Archivo Muy Grande"
    }),
    
    // ===== CONFIRMACIONES =====
    confirmDelete: (onConfirm, onCancel) => 
      showConfirmation("¿Estás seguro de eliminar tu historia? Esta acción no se puede deshacer.", onConfirm, onCancel),
    
    confirmDeleteContent: (onConfirm, onCancel) => 
      showConfirmation("¿Eliminar el contenido actual? Se perderá todo el progreso.", onConfirm, onCancel),
    
    confirmExit: (onConfirm, onCancel) => 
      showConfirmation("¿Salir sin guardar? Se perderán los cambios realizados.", onConfirm, onCancel),
    
    // ===== NOTIFICACIONES GENERALES =====
    loading: (message = "Procesando...") => showInfo(`⏳ ${message}`, { 
      duration: 0,
      title: "Cargando"
    }),
    
    // ===== NOTIFICACIONES DE SISTEMA =====
    welcomeBack: (username) => showSuccess(`👋 ¡Bienvenido de vuelta, ${username}!`, {
      duration: 4000
    }),
    sessionExpired: () => showWarning("⏰ Tu sesión ha expirado. Inicia sesión nuevamente", {
      title: "Sesión Expirada"
    }),
    
    // ===== MÉTODOS GENÉRICOS =====
    success: (message, options = {}) => showSuccess(message, options),
    error: (message, options = {}) => showError(message, options),
    warning: (message, options = {}) => showWarning(message, options),
    info: (message, options = {}) => showInfo(message, options),
    
    // ===== NOTIFICACIONES ESPECIALES =====
    achievementUnlocked: (achievement) => showSuccess(`🏆 ¡Logro desbloqueado: ${achievement}!`, {
      title: "¡Nuevo Logro!",
      duration: 6000
    }),
    firstStory: () => showSuccess("🌟 ¡Felicidades por tu primera historia!", {
      title: "¡Primera Historia!",
      duration: 5000
    }),
    storyViews: (count) => showInfo(`👁️ Tu historia ha sido vista ${count} ${count === 1 ? 'vez' : 'veces'}`, {
      title: "Nuevas Visualizaciones",
      duration: 4000
    }),
  };
};

export default NotificationProvider;
