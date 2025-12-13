import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';

const NotificationSystemImprovedClient = ({ notifications, onRemove }) => {
  
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} className="text-[#00ff66]" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-400" />;
      case 'info':
      default:
        return <Info size={18} className="text-[#ff007a]" />;
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
  
  const limitedNotifications = notifications.slice(-1);


  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-sm w-full space-y-3">
      {limitedNotifications.map((notification, index) => {
        const styles = getNotificationStyles(notification.type);
        const icon = getNotificationIcon(notification.type);
        
        return (
          <div
            key={notification.id}
            className={`
              ${styles.bg} ${styles.border} ${styles.text}
              bg-gradient-to-b from-[#0a0d10] to-[#131418] backdrop-blur-xl border rounded-2xl shadow-2xl
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
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.accent} rounded-l-2xl`}></div>
            
            {/* Efecto de brillo animado */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 -translate-x-full animate-shimmer"></div>
            
            <div className="p-4 pl-6">
              <div className="flex items-start gap-3">
                {/* Icono con fondo */}
                <div className={`
                  flex-shrink-0 p-2 rounded-xl ${styles.bg} border ${styles.border}
                  backdrop-blur-sm shadow-lg
                `}>
                  {icon}
                </div>
                
                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1 text-white leading-tight">
                        {notification.title}
                      </h4>
                      <p className="text-xs opacity-90 leading-relaxed text-gray-200">
                        {notification.message}
                      </p>
                    </div>
                    
                    {/* Botón cerrar mejorado */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(notification.id);
                      }}
                      className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 
                                 text-white/60 hover:text-white hover:bg-white/10 
                                 hover:scale-110 group"
                    >
                      <X size={14} className="group-hover:rotate-90 transition-transform duration-200" />
                    </button>
                  </div>
                  
                  {/* Timestamp con mejor diseño */}
                  <div className="flex items-center gap-2 mt-3">
                    <Sparkles size={10} className="text-[#ff007a]/40" />
                    <span className="text-xs text-white/50 font-mono">
                      {new Date(notification.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Barra de progreso mejorada */}
              <div className="mt-4 relative">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${styles.progressBar} rounded-full transition-all duration-100 ease-linear relative overflow-hidden`}
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
      
      {/* Estilos CSS para las animaciones */}
      <style jsx>{`
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
      `}</style>
    </div>
  );
};

export default NotificationSystemImprovedClient;