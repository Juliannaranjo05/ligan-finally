/**
 * Sistema de Error Tracking para Ligando
 * Soporta Sentry (opcional) y envío al backend
 */

class ErrorTracker {
  constructor() {
    this.sentry = null;
    this.isSentryInitialized = false;
    this.backendEnabled = true;
    this.initialized = false;
  }

  /**
   * Inicializar Sentry si está configurado
   */
  async initSentry() {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
    
    if (!sentryDsn) {
      // Silenciar en producción
      if (!import.meta.env.PROD) {
        console.info('[ErrorTracker] Sentry DSN no configurado, usando solo backend');
      }
      return;
    }

    try {
      // Intentar dynamic import solo si el paquete está disponible
      // Usar una función que verifique si el módulo existe
      let Sentry = null;
      
      // Verificar si el módulo está disponible usando una función helper
      const loadSentry = async () => {
        try {
          // Usar una expresión que Vite pueda analizar estáticamente
          // pero que falle gracefully si el módulo no existe
          const moduleName = '@sentry/react';
          const sentryModule = await import(/* @vite-ignore */ moduleName);
          return sentryModule.default || sentryModule;
        } catch (importError) {
          // Si el paquete no está instalado, retornar null
          return null;
        }
      };
      
      Sentry = await loadSentry();
      
      if (!Sentry) {
        // Si el paquete no está instalado, simplemente no usar Sentry
        if (!import.meta.env.PROD) {
          console.info('[ErrorTracker] @sentry/react no está instalado, usando solo backend');
        }
        return;
      }
      
      if (!Sentry || typeof Sentry.init !== 'function') {
        if (!import.meta.env.PROD) {
          console.warn('[ErrorTracker] Sentry no está disponible correctamente');
        }
        return;
      }
      
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE || 'development',
        integrations: [
          new Sentry.BrowserTracing(),
          new Sentry.Replay({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],
        // Performance Monitoring
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        // Session Replay
        replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        replaysOnErrorSampleRate: 1.0,
        // Filtros
        beforeSend(event, hint) {
          // Filtrar errores conocidos que no queremos trackear
          const error = hint.originalException;
          
          if (error?.message?.includes('ResizeObserver loop')) {
            return null; // Ignorar errores de ResizeObserver
          }
          
          if (error?.message?.includes('Non-Error promise rejection')) {
            return null; // Ignorar promesas rechazadas sin error
          }
          
          return event;
        },
      });

      this.sentry = Sentry;
      this.isSentryInitialized = true;
      if (!import.meta.env.PROD) {
        console.info('[ErrorTracker] Sentry inicializado correctamente');
      }
    } catch (error) {
      // Silenciar errores de Sentry en producción
      if (!import.meta.env.PROD) {
        console.warn('[ErrorTracker] Error inicializando Sentry:', error);
      }
    }
  }

  /**
   * Inicializar el sistema de error tracking
   */
  async init() {
    if (this.initialized) return;
    
    await this.initSentry();
    
    // Capturar errores no manejados
    this.setupGlobalErrorHandlers();
    
    this.initialized = true;
  }

  /**
   * Configurar handlers globales de errores
   */
  setupGlobalErrorHandlers() {
    // Errores de JavaScript no capturados
    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message), {
        tags: {
          type: 'unhandled_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        extra: {
          message: event.message,
          source: 'window.onerror',
        },
      });
    });

    // Promesas rechazadas no manejadas
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      this.captureException(error, {
        tags: {
          type: 'unhandled_promise_rejection',
        },
        extra: {
          reason: event.reason,
        },
      });
    });
  }

  /**
   * Capturar una excepción
   */
  captureException(error, context = {}) {
    // Enviar a Sentry si está configurado
    if (this.isSentryInitialized && this.sentry) {
      try {
        this.sentry.captureException(error, context);
      } catch (e) {
        console.warn('[ErrorTracker] Error enviando a Sentry:', e);
      }
    }

    // Enviar al backend
    if (this.backendEnabled) {
      this.sendToBackend(error, context);
    }
  }

  /**
   * Capturar un mensaje
   */
  captureMessage(message, level = 'info', context = {}) {
    // Enviar a Sentry si está configurado
    if (this.isSentryInitialized && this.sentry) {
      try {
        this.sentry.captureMessage(message, level, context);
      } catch (e) {
        console.warn('[ErrorTracker] Error enviando mensaje a Sentry:', e);
      }
    }

    // Enviar al backend solo si es error o warning
    if (this.backendEnabled && (level === 'error' || level === 'warning')) {
      this.sendToBackend(new Error(message), { ...context, level });
    }
  }

  /**
   * Enviar error al backend
   */
  async sendToBackend(error, context = {}) {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      const errorData = {
        message: error.message || String(error),
        stack: error.stack,
        name: error.name,
        context: context.context || 'Unknown',
        tags: context.tags || {},
        extra: context.extra || {},
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: userId || null,
        timestamp: new Date().toISOString(),
        level: context.level || 'error',
      };

      // Fire and forget - no esperar respuesta
      // Usar sendBeacon si está disponible para mejor confiabilidad
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(errorData)], { type: 'application/json' });
        navigator.sendBeacon(`${import.meta.env.VITE_API_BASE_URL}/api/logs/error`, blob);
      } else {
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/logs/error`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify(errorData),
          keepalive: true, // Mantener la petición viva incluso si la página se cierra
        }).catch(() => {
          // Silenciar errores de logging para evitar bucles
        });
      }
    } catch (e) {
      // Silenciar errores de logging
    }
  }

  /**
   * Establecer contexto del usuario
   */
  setUser(user) {
    if (this.isSentryInitialized && this.sentry) {
      this.sentry.setUser({
        id: user.id?.toString(),
        username: user.name || user.username,
        email: user.email,
      });
    }
  }

  /**
   * Limpiar contexto del usuario (logout)
   */
  clearUser() {
    if (this.isSentryInitialized && this.sentry) {
      this.sentry.setUser(null);
    }
  }

  /**
   * Agregar breadcrumb (evento de seguimiento)
   */
  addBreadcrumb(message, category = 'default', level = 'info', data = {}) {
    if (this.isSentryInitialized && this.sentry) {
      this.sentry.addBreadcrumb({
        message,
        category,
        level,
        data,
        timestamp: Date.now() / 1000,
      });
    }
  }
}

// Singleton
const errorTracker = new ErrorTracker();

// Inicializar automáticamente
errorTracker.init().catch(console.error);

export default errorTracker;

