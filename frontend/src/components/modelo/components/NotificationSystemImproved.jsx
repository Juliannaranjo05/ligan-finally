import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';

const NotificationSystemImproved = ({ notifications, onRemove }) => {
  
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={14} className="text-[#00ff66]" />;
      case 'error':
        return <AlertCircle size={14} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={14} className="text-amber-400" />;
      case 'info':
      default:
        return <Info size={14} className="text-[#ff007a]" />;
    }
  };

  const getNotificationStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-[#00ff66]/10 to-[#00ff66]/5',
          border: 'border-[#00ff66]/30',
          text: 'text-[#00ff66]',
          accent: 'bg-[#00ff66]',
          progressBar: 'from-[#00ff66] to-[#00ff66]/80'
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-red-500/10 to-red-500/5',
          border: 'border-red-400/30',
          text: 'text-red-100',
          accent: 'bg-red-400',
          progressBar: 'from-red-400 to-rose-400'
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-amber-500/10 to-amber-500/5',
          border: 'border-amber-400/30',
          text: 'text-amber-100',
          accent: 'bg-amber-400',
          progressBar: 'from-amber-400 to-yellow-400'
        };
      case 'info':
      default:
        return {
          bg: 'bg-gradient-to-r from-[#ff007a]/10 to-[#ff007a]/5',
          border: 'border-[#ff007a]/30',
          text: 'text-[#ff007a]',
          accent: 'bg-[#ff007a]',
          progressBar: 'from-[#ff007a] to-[#ff007a]/80'
        };
    }
  };

  if (!notifications || notifications.length === 0) {
    return null;
  }

  // 🔥 LIMITAR A SOLO 2 NOTIFICACIONES - Mostrar las más recientes
  const limitedNotifications = notifications.slice(-1);

  return (
    <div className="notification-container">
      {limitedNotifications.map((notification, index) => {
        const styles = getNotificationStyles(notification.type);
        const icon = getNotificationIcon(notification.type);
        
        return (
          <div
            key={notification.id}
            className={`
              notification-card
              ${styles.bg} ${styles.border} ${styles.text}
              bg-gradient-to-b from-[#0a0d10] to-[#131418] backdrop-blur-xl border rounded-lg shadow-2xl
              transform transition-all duration-500 ease-out
              hover:scale-[1.02] cursor-pointer relative overflow-hidden
              animate-slide-in-right
            `}
            style={{
              animationDelay: `${index * 100}ms`
            }}
            onClick={() => onRemove(notification.id)}
          >
            {/* Línea de acento lateral */}
            <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${styles.accent} rounded-l-lg`}></div>
            
            {/* Efecto de brillo animado */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 -translate-x-full animate-shimmer"></div>
            
            <div className="notification-content">
              <div className="flex items-start gap-2">
                {/* Icono compacto */}
                <div className={`
                  flex-shrink-0 p-1 rounded-md ${styles.bg} border ${styles.border}
                  backdrop-blur-sm shadow-sm
                `}>
                  {icon}
                </div>
                
                {/* Contenido compacto */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1">
                      <h4 className="notification-title">
                        {notification.title}
                      </h4>
                      <p className="notification-message">
                        {notification.message}
                      </p>
                    </div>
                    
                    {/* Botón cerrar compacto */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(notification.id);
                      }}
                      className="close-button"
                    >
                      <X size={10} className="group-hover:rotate-90 transition-transform duration-200" />
                    </button>
                  </div>
                  
                  {/* Timestamp compacto */}
                  <div className="notification-timestamp">
                    <Sparkles size={8} className="text-[#ff007a]/40" />
                    <span className="timestamp-text">
                      {new Date(notification.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Barra de progreso compacta */}
              <div className="progress-container">
                <div className="progress-track">
                  <div 
                    className={`progress-bar bg-gradient-to-r ${styles.progressBar}`}
                    style={{
                      animation: `shrinkProgress ${notification.duration}ms linear forwards`
                    }}
                  >
                    {/* Efecto de brillo en la barra */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* 🔥 INDICADOR DE NOTIFICACIONES ADICIONALES */}
      {notifications.length > 2 && (
        <div className="overflow-indicator">
          <div className="overflow-content">
            <Info size={10} className="text-[#ff007a]" />
            <span className="overflow-text">
              +{notifications.length - 2} más
            </span>
          </div>
        </div>
      )}
      
      {/* 🔥 ESTILOS CSS RESPONSIVE */}
      <style jsx>{`
        /* 🔥 CONTENEDOR PRINCIPAL RESPONSIVE */
        .notification-container {
          position: fixed;
          top: 12px;
          right: 12px;
          z-index: 9999;
          max-width: 280px;
          width: calc(100vw - 24px);
          space-y: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* 🔥 TARJETA DE NOTIFICACIÓN COMPACTA */
        .notification-card {
          width: 100%;
          min-height: auto;
        }

        .notification-content {
          padding: 8px 10px;
        }

        /* 🔥 TEXTO COMPACTO */
        .notification-title {
          font-weight: 600;
          font-size: 11px;
          margin-bottom: 2px;
          color: white;
          line-height: 1.2;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .notification-message {
          font-size: 10px;
          opacity: 0.9;
          line-height: 1.3;
          color: rgb(229, 231, 235);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* 🔥 BOTÓN CERRAR COMPACTO */
        .close-button {
          flex-shrink: 0;
          padding: 2px;
          border-radius: 4px;
          transition: all 0.2s;
          color: rgba(255, 255, 255, 0.6);
        }

        .close-button:hover {
          color: white;
          background-color: rgba(255, 255, 255, 0.1);
          transform: scale(1.1);
        }

        /* 🔥 TIMESTAMP COMPACTO */
        .notification-timestamp {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 6px;
        }

        .timestamp-text {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.5);
          font-family: ui-monospace, SFMono-Regular, monospace;
        }

        /* 🔥 BARRA DE PROGRESO COMPACTA */
        .progress-container {
          margin-top: 6px;
          position: relative;
        }

        .progress-track {
          height: 2px;
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 1px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          border-radius: 1px;
          transition: all 0.1s ease-linear;
          position: relative;
          overflow: hidden;
        }

        /* 🔥 INDICADOR DE OVERFLOW */
        .overflow-indicator {
          background: rgba(10, 13, 16, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 0, 122, 0.3);
          border-radius: 8px;
          padding: 4px 8px;
          text-align: center;
        }

        .overflow-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .overflow-text {
          font-size: 9px;
          color: rgb(255, 0, 122);
          font-weight: 500;
        }

        /* 🔥 ANIMACIONES */
        @keyframes shrinkProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(300%) skewX(-12deg); }
        }
        
        .animate-slide-in-right {
          animation: slideInRight 0.5s ease-out forwards;
        }
        
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }

        /* 🔥 RESPONSIVE BREAKPOINTS */
        
        /* Móvil pequeño (320px-479px) */
        @media (max-width: 479px) {
          .notification-container {
            top: 8px;
            right: 8px;
            max-width: 240px;
            width: calc(100vw - 16px);
          }

          .notification-content {
            padding: 6px 8px;
          }

          .notification-title {
            font-size: 10px;
          }

          .notification-message {
            font-size: 9px;
            -webkit-line-clamp: 1;
          }

          .timestamp-text {
            font-size: 8px;
          }

          .overflow-text {
            font-size: 8px;
          }
        }

        /* Móvil medio (480px-639px) */
        @media (min-width: 480px) and (max-width: 639px) {
          .notification-container {
            max-width: 260px;
          }

          .notification-title {
            font-size: 11px;
          }

          .notification-message {
            font-size: 10px;
          }
        }

        /* Móvil grande / Tablet pequeño (640px-767px) */
        @media (min-width: 640px) and (max-width: 767px) {
          .notification-container {
            max-width: 280px;
          }
        }

        /* Tablet (768px-1023px) */
        @media (min-width: 768px) and (max-width: 1023px) {
          .notification-container {
            top: 16px;
            right: 16px;
            max-width: 300px;
          }

          .notification-content {
            padding: 10px 12px;
          }

          .notification-title {
            font-size: 12px;
          }

          .notification-message {
            font-size: 11px;
          }

          .timestamp-text {
            font-size: 10px;
          }
        }

        /* Desktop pequeño (1024px-1279px) */
        @media (min-width: 1024px) and (max-width: 1279px) {
          .notification-container {
            top: 20px;
            right: 20px;
            max-width: 320px;
          }

          .notification-content {
            padding: 12px 14px;
          }

          .notification-title {
            font-size: 13px;
          }

          .notification-message {
            font-size: 12px;
          }

          .timestamp-text {
            font-size: 10px;
          }

          .overflow-text {
            font-size: 10px;
          }
        }

        /* Desktop medio (1280px-1535px) */
        @media (min-width: 1280px) and (max-width: 1535px) {
          .notification-container {
            max-width: 340px;
          }

          .notification-title {
            font-size: 14px;
          }

          .notification-message {
            font-size: 13px;
          }

          .timestamp-text {
            font-size: 11px;
          }
        }

        /* Desktop grande (1536px+) */
        @media (min-width: 1536px) {
          .notification-container {
            top: 24px;
            right: 24px;
            max-width: 360px;
          }

          .notification-content {
            padding: 14px 16px;
          }

          .notification-title {
            font-size: 15px;
          }

          .notification-message {
            font-size: 14px;
          }

          .timestamp-text {
            font-size: 12px;
          }

          .overflow-text {
            font-size: 11px;
          }
        }

        /* 🔥 ORIENTACIÓN LANDSCAPE EN MÓVILES */
        @media (max-height: 500px) and (orientation: landscape) {
          .notification-container {
            top: 4px;
            right: 4px;
            max-width: 200px;
          }

          .notification-content {
            padding: 4px 6px;
          }

          .notification-title {
            font-size: 9px;
          }

          .notification-message {
            font-size: 8px;
            -webkit-line-clamp: 1;
          }

          .timestamp-text {
            font-size: 7px;
          }

          .progress-track {
            height: 1px;
          }
        }

        /* 🔥 PANTALLAS MUY GRANDES (4K+) */
        @media (min-width: 2560px) {
          .notification-container {
            top: 32px;
            right: 32px;
            max-width: 400px;
          }

          .notification-content {
            padding: 16px 20px;
          }

          .notification-title {
            font-size: 16px;
          }

          .notification-message {
            font-size: 15px;
          }

          .timestamp-text {
            font-size: 13px;
          }

          .overflow-text {
            font-size: 12px;
          }
        }

        /* 🔥 MODO OSCURO AUTOMÁTICO */
        @media (prefers-color-scheme: dark) {
          .notification-container {
            /* Ya está optimizado para modo oscuro */
          }
        }

        /* 🔥 REDUCIR ANIMACIONES SI EL USUARIO LO PREFIERE */
        @media (prefers-reduced-motion: reduce) {
          .animate-slide-in-right,
          .animate-shimmer,
          .close-button,
          .progress-bar {
            animation: none !important;
            transition: none !important;
          }
        }

        /* 🔥 ALTO CONTRASTE */
        @media (prefers-contrast: high) {
          .notification-card {
            border-width: 2px;
          }

          .notification-title {
            font-weight: 700;
          }

          .progress-track {
            background-color: rgba(255, 255, 255, 0.3);
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationSystemImproved;