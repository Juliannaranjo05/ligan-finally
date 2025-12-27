/**
 * Sistema de logging estructurado para Ligando
 * Reemplaza console.log con niveles de log controlables por entorno
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Obtener nivel de log desde variables de entorno o localStorage
const getLogLevel = () => {
  // En producción, solo ERROR por defecto
  if (import.meta.env.PROD) {
    const storedLevel = localStorage.getItem('logLevel');
    if (storedLevel) {
      return parseInt(storedLevel, 10);
    }
    return LOG_LEVELS.ERROR;
  }
  
  // En desarrollo, DEBUG por defecto
  const storedLevel = localStorage.getItem('logLevel');
  if (storedLevel) {
    return parseInt(storedLevel, 10);
  }
  return LOG_LEVELS.DEBUG;
};

const currentLogLevel = getLogLevel();

/**
 * Logger estructurado
 */
class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  shouldLog(level) {
    return level >= currentLogLevel;
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS).find(
      key => LOG_LEVELS[key] === level
    );
    
    const prefix = `[${timestamp}] [${levelName}] [${this.context}]`;
    
    if (data) {
      return { prefix, message, data };
    }
    return { prefix, message };
  }

  debug(message, data = null) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      const formatted = this.formatMessage(LOG_LEVELS.DEBUG, message, data);
      if (data) {
        console.debug(formatted.prefix, message, data);
      } else {
        console.debug(formatted.prefix, message);
      }
    }
  }

  info(message, data = null) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      const formatted = this.formatMessage(LOG_LEVELS.INFO, message, data);
      if (data) {
        console.info(formatted.prefix, message, data);
      } else {
        console.info(formatted.prefix, message);
      }
    }
  }

  warn(message, data = null) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      const formatted = this.formatMessage(LOG_LEVELS.WARN, message, data);
      if (data) {
        console.warn(formatted.prefix, message, data);
      } else {
        console.warn(formatted.prefix, message);
      }
    }
  }

  error(message, error = null) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      const formatted = this.formatMessage(LOG_LEVELS.ERROR, message, error);
      if (error) {
        console.error(formatted.prefix, message, error);
        
        // Enviar a error tracking (Sentry o backend)
        if (error instanceof Error) {
          try {
            const errorTracker = require('./errorTracking').default;
            errorTracker.captureException(error, {
              context: this.context,
              tags: { logger: true },
              extra: { message },
            });
          } catch (e) {
            // Si errorTracking no está disponible, usar método anterior
            if (import.meta.env.PROD) {
              this.sendErrorToBackend(message, error);
            }
          }
        }
      } else {
        console.error(formatted.prefix, message);
      }
    }
  }

  /**
   * Enviar error crítico al backend para tracking
   * Solo en producción y para errores importantes
   */
  async sendErrorToBackend(message, error) {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/logs/error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          error: error.message,
          stack: error.stack,
          context: this.context,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (e) {
      // Silenciar errores de logging para evitar bucles
    }
  }
}

/**
 * Crear logger con contexto
 */
export const createLogger = (context) => {
  return new Logger(context);
};

/**
 * Logger por defecto
 */
export const logger = new Logger('App');

/**
 * Funciones de conveniencia
 */
export const logDebug = (message, data) => logger.debug(message, data);
export const logInfo = (message, data) => logger.info(message, data);
export const logWarn = (message, data) => logger.warn(message, data);
export const logError = (message, error) => logger.error(message, error);

export default logger;

