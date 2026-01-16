import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './i18n';
import errorTracker from './utils/errorTracking';

// 🔇 DESHABILITAR LOGS DE LIVEKIT
try {
  // Intentar configurar el nivel de log de LiveKit si está disponible
  if (typeof window !== 'undefined') {
    // LiveKit puede usar setLogLevel si está disponible
    window.addEventListener('load', () => {
      try {
        // Intentar importar y configurar el nivel de log
        if (window.livekitClient) {
          window.livekitClient.setLogLevel?.('warn');
        }
      } catch (e) {
        // Ignorar si no está disponible
      }
    });
  }
} catch (e) {
  // Ignorar errores
}

// 🔇 FILTRAR LOGS REPETITIVOS DE LIVEKIT - DEBE EJECUTARSE ANTES QUE CUALQUIER OTRO CÓDIGO
(function() {
  
  // Patrones a filtrar - más específicos
  const filteredPatterns = [
    /already connected to room/i,
    /disconnect from room/i,
    /waiting for pending publication promise timed out/i
  ];
  
  const shouldFilter = (...args) => {
    // Verificar cada argumento individualmente y también toda la cadena combinada
    for (const arg of args) {
      const argStr = typeof arg === 'string' 
        ? arg 
        : typeof arg === 'object' && arg !== null
          ? JSON.stringify(arg)
          : String(arg);
      
      if (filteredPatterns.some(pattern => pattern.test(argStr))) {
        return true;
      }
    }
    
    // También verificar la combinación de todos los argumentos
    const combinedStr = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    return filteredPatterns.some(pattern => pattern.test(combinedStr));
  };
  
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  
  console.log = function(...args) {
    if (!shouldFilter(...args)) {
      originalLog.apply(console, args);
    }
  };
  
  console.warn = function(...args) {
    if (!shouldFilter(...args)) {
      originalWarn.apply(console, args);
    }
  };
  
  console.error = function(...args) {
    if (!shouldFilter(...args)) {
      originalError.apply(console, args);
    }
  };
  
  console.info = function(...args) {
    if (!shouldFilter(...args)) {
      originalInfo.apply(console, args);
    }
  };
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
