# Instrucciones para Exportar Logs de Depuración de VideoChat

## Cómo Usar el Sistema de Logging

El componente `videochat.jsx` ahora incluye un sistema de logging completo que guarda todos los eventos importantes en `localStorage` del navegador.

## Ver y Exportar Logs

### Opción 1: Página de Visualización (Más Fácil)

1. Abre en el navegador: `http://tu-dominio/view-logs.html`
2. La página mostrará todos los logs con estadísticas
3. Puedes exportar los logs haciendo clic en "Exportar Logs"

### Opción 2: Desde la Consola del Navegador

1. Abre las herramientas de desarrollo (F12)
2. Ve a la pestaña "Console"
3. Ejecuta el siguiente comando:
   ```javascript
   window.exportVideoChatLogs()
   ```
4. Se descargará automáticamente un archivo `.log` con todos los logs

### Opción 2: Limpiar Logs

Si necesitas limpiar los logs almacenados:
```javascript
window.clearVideoChatLogs()
```

## Qué se Registra

El sistema de logging registra:
- **RENDER**: Cada vez que el componente se renderiza (con todos los estados)
- **TOKEN**: Eventos relacionados con la obtención del token de LiveKit
- **PARAMS**: Eventos relacionados con parámetros (roomName, userName)
- **ERROR**: Errores y excepciones

Cada entrada incluye:
- Timestamp ISO
- Categoría del evento
- Mensaje descriptivo
- Datos relevantes del estado en ese momento

## Formato del Archivo Exportado

El archivo exportado es un JSON con un array de objetos, cada uno representando un evento:

```json
[
  {
    "timestamp": "2024-01-15T10:30:45.123Z",
    "category": "RENDER",
    "message": "INICIO DEL RENDER",
    "data": {
      "loading": false,
      "hasToken": true,
      "roomName": "call_2_4_123456",
      ...
    }
  },
  ...
]
```

## Uso para Depuración

1. Reproduce el problema (pantalla en blanco, etc.)
2. Exporta los logs usando `window.exportVideoChatLogs()`
3. Envía el archivo `.log` para análisis

Los logs mantienen las últimas 200 entradas para evitar llenar el localStorage.

