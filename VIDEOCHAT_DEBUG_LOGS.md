# 🔍 Sistema de Depuración para Videollamadas de Modelo

## 📋 Resumen

Se ha implementado un sistema completo de logging para depurar problemas en las videollamadas de la modelo. Todos los logs se escriben tanto en `laravel.log` como en un archivo específico.

## 📁 Ubicación de los Logs

### 1. Laravel Log (Logs estándar)
```
/root/ligando/backend/storage/logs/laravel.log
```

### 2. Log Específico de Videollamadas
```
/root/ligando/backend/storage/app/videochat_modelo_debug.log
```

## 🔍 Puntos de Logging Implementados

### CallController - `answerCall()`
Este método se ejecuta cuando la modelo acepta una llamada. Los logs incluyen:

- **INICIO**: Cuando comienza el proceso
- **REQUEST**: Datos completos de la petición
- **Validación**: Estado de la llamada, usuario, permisos
- **Identificación de Caller**: Quién inició la llamada
- **Actualización de Estado**: Cambio a 'active'
- **Creación de Notificaciones**: Notificaciones enviadas
- **RESPONSE**: Respuesta completa al frontend
- **ERROR**: Cualquier error durante el proceso

### LiveKitController - `generateToken()`
Generación del token LiveKit estándar. Logs incluyen:

- **INICIO**: Inicio del proceso
- **Normalización de roomName**: Valores originales y normalizados
- **Autenticación**: Usuario autenticado
- **Credenciales**: Estado de las credenciales de LiveKit
- **Payload JWT**: Contenido del token
- **Verificación de Saldo**: Solo para clientes
- **Token Generado**: Confirmación de generación
- **RESPONSE**: Token y serverUrl devueltos
- **ERROR**: Errores durante la generación

### LiveKitController - `generateTokenWithImmediateDeduction()`
Token seguro usado por la modelo. Logs incluyen:

- **INICIO**: Inicio del proceso
- **REQUEST**: Datos de la petición
- **Normalización de roomName**: Valores originales y normalizados
- **Usuario**: Información del usuario autenticado
- **Verificación de Saldo**: Solo para clientes (no modelos)
- **Llamada a generateToken**: Delegación al método principal
- **RESPONSE**: Respuesta final
- **ERROR**: Errores durante el proceso

## 🔧 Cómo Revisar los Logs

### Ver logs en tiempo real (Laravel Log)
```bash
tail -f /root/ligando/backend/storage/logs/laravel.log | grep -E "\[VIDEOCHAT-MODELO\]|\[ANSWER_CALL\]|\[GENERATE_TOKEN"
```

### Ver logs específicos de videollamadas
```bash
tail -f /root/ligando/backend/storage/app/videochat_modelo_debug.log
```

### Buscar logs de una llamada específica
```bash
# Por call_id
grep "call_id.*123" /root/ligando/backend/storage/logs/laravel.log

# Por room_name
grep "call_4_2" /root/ligando/backend/storage/logs/laravel.log

# Por user_id
grep "user_id.*2" /root/ligando/backend/storage/logs/laravel.log
```

### Ver solo errores
```bash
grep "ERROR\|❌" /root/ligando/backend/storage/logs/laravel.log | tail -50
```

### Ver logs de una sesión específica (últimos 5 minutos)
```bash
tail -1000 /root/ligando/backend/storage/logs/laravel.log | grep -E "\[VIDEOCHAT-MODELO\]|\[ANSWER_CALL\]|\[GENERATE_TOKEN"
```

## 📊 Información que se Registra

### En cada log se registra:
- **Timestamp**: Fecha y hora exacta (con microsegundos)
- **Nivel**: INFO, ERROR, WARNING, DEBUG
- **Contexto**: ANSWER_CALL, GENERATE_TOKEN, GENERATE_TOKEN_SECURE
- **Mensaje**: Descripción de la acción
- **Caller**: Archivo, línea y función que generó el log
- **Datos**: Información contextual relevante
- **Memory**: Uso de memoria en ese momento

### Datos específicos registrados:

#### En answerCall:
- `user_id`, `user_role`, `user_name`
- `call_id`, `call_status`
- `caller_id`, `caller_name`, `caller_role`
- `receiver_id`, `receiver_name`
- `room_name`
- Estados de bloqueo
- Datos de la respuesta JSON

#### En generateToken:
- `room_original`, `room_normalized`
- `room_length`, `room_hex`
- `user_id`, `user_role`, `user_name`
- `participant_name`
- `has_api_key`, `has_api_secret`, `has_server_url`
- `server_url`
- Payload del JWT
- Información de saldo (solo clientes)

## 🐛 Qué Buscar al Depurar

### Si la pantalla queda en blanco:

1. **Verificar que answerCall se ejecutó correctamente:**
   ```bash
   grep "✅ FIN: Llamada aceptada exitosamente" laravel.log
   ```

2. **Verificar que generateToken se llamó:**
   ```bash
   grep "▶️ INICIO: Generando token" laravel.log
   ```

3. **Verificar que el token se generó:**
   ```bash
   grep "Token generado exitosamente" laravel.log
   ```

4. **Verificar el room_name:**
   ```bash
   grep "room_name.*call_4_2" laravel.log
   ```

5. **Verificar errores:**
   ```bash
   grep "❌ ERROR" laravel.log | tail -20
   ```

### Si no se puede conectar al videochat:

1. **Verificar credenciales LiveKit:**
   ```bash
   grep "Credenciales LiveKit obtenidas" laravel.log
   ```

2. **Verificar que el usuario es modelo:**
   ```bash
   grep "user_role.*modelo" laravel.log
   ```

3. **Verificar que no hay errores de autenticación:**
   ```bash
   grep "Usuario no autenticado" laravel.log
   ```

## 📝 Formato de los Logs

Cada entrada tiene este formato:

```
TIMESTAMP [LEVEL] [CONTEXT] MENSAJE | DATA_JSON | [FILE:LINE] FUNCTION
```

Ejemplo:
```
2025-12-26 02:45:23.123456 [INFO] [ANSWER_CALL] ▶️ INICIO: Modelo respondiendo llamada | {"user_id":2,"call_id":123} | [CallController.php:191] answerCall
```

## 🔄 Limpiar Logs Antiguos

```bash
# Limpiar log de videollamadas (mantener solo los últimos 1000 líneas)
tail -1000 /root/ligando/backend/storage/app/videochat_modelo_debug.log > /tmp/videochat_log_backup.log
mv /tmp/videochat_log_backup.log /root/ligando/backend/storage/app/videochat_modelo_debug.log
```

## ⚠️ Notas Importantes

1. Los logs incluyen información sensible (user_ids, tokens, etc.). No compartir públicamente.

2. El archivo `videochat_modelo_debug.log` puede crecer rápidamente. Monitorear el tamaño.

3. Todos los logs también se escriben en `laravel.log` con el prefijo `[VIDEOCHAT-MODELO]`.

4. Los logs incluyen memoria usada, lo cual puede ayudar a detectar memory leaks.

## 🔗 Helper Utilizado

El sistema utiliza `App\Helpers\VideoChatLogger` que proporciona métodos:
- `start()`: Inicio de proceso
- `end()`: Fin de proceso
- `log()`: Log general
- `error()`: Errores
- `warning()`: Advertencias
- `debug()`: Información de debug
- `request()`: Datos de request
- `response()`: Datos de response




