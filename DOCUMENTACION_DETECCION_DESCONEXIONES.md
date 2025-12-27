# 🔔 Sistema de Detección de Desconexiones - LiveKit

## 📋 Índice

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Configuración](#configuración)
4. [Eventos de LiveKit](#eventos-de-livekit)
5. [Flujo de Detección](#flujo-de-detección)
6. [Mejores Prácticas](#mejores-prácticas)
7. [Solución de Problemas](#solución-de-problemas)

---

## 🎯 Visión General

Este sistema proporciona detección **confiable y en tiempo real** de desconexiones en tu plataforma de videochat basada en LiveKit. Combina múltiples estrategias para asegurar que ninguna desconexión pase desapercibida:

1. **Webhooks de LiveKit** (Backend) - Detección en tiempo real desde el servidor
2. **Eventos del SDK** (Frontend) - Detección inmediata en el cliente
3. **Polling de Notificaciones** (Respaldo) - Sistema de respaldo para casos edge
4. **Heartbeat/Health Checks** - Verificación periódica de conexión

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                     LIVEKIT SERVER                          │
│  • Detecta desconexiones                                    │
│  • Envía webhooks a Laravel                                │
│  • Notifica a clientes conectados                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Webhooks HTTP
                     │
┌────────────────────▼────────────────────────────────────────┐
│              LARAVEL BACKEND                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LiveKitController::handleWebhook()                  │  │
│  │  • Valida firma                                       │  │
│  │  • Procesa eventos                                    │  │
│  │  • Actualiza ChatSession/VideoChatSession            │  │
│  │  • Envía notificaciones a usuarios                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  NotificationController                              │  │
│  │  • Publica eventos en Redis                           │  │
│  │  • SSE para clientes                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ SSE / Polling
                     │
┌────────────────────▼────────────────────────────────────────┐
│              FRONTEND (React)                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LiveKit SDK Events                                  │  │
│  │  • room.on('disconnected')                           │  │
│  │  • room.on('participantDisconnected')                │  │
│  │  • Detección inmediata                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Polling de Notificaciones                           │  │
│  │  • GET /api/status/updates                           │  │
│  │  • Respaldo para casos edge                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuración

### 1. Configurar Webhook en LiveKit Dashboard

1. Accede a tu dashboard de LiveKit: `https://your-livekit-instance.com`
2. Ve a **Settings** → **Webhooks**
3. Configura el endpoint:

```
URL: https://tu-dominio.com/api/livekit/webhook
Método: POST
Eventos a escuchar:
  ✅ participant_left
  ✅ room_finished
  ✅ participant_joined (opcional, solo para logs)
```

### 2. Configurar Variables de Entorno

Agrega a tu `.env`:

```env
# LiveKit Configuration
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_WS_URL=wss://your-livekit-instance.com

# Webhook Secret (opcional pero recomendado para producción)
LIVEKIT_WEBHOOK_SECRET=your_webhook_secret_from_livekit
```

**⚠️ IMPORTANTE:** En producción, **SIEMPRE** configura `LIVEKIT_WEBHOOK_SECRET` para validar las firmas de los webhooks y prevenir ataques.

### 3. Configurar Redis (para notificaciones)

Asegúrate de que Redis esté configurado en tu `config/database.php`:

```php
'redis' => [
    'default' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD', null),
        'port' => env('REDIS_PORT', 6379),
        'database' => env('REDIS_DB', 0),
    ],
],
```

---

## 🔔 Eventos de LiveKit

### Eventos que Procesamos

#### 1. `participant_left`

**Cuándo se dispara:**
- Un usuario cierra la llamada
- Un usuario presiona "siguiente"
- Un usuario cierra el navegador
- Pérdida de conexión a internet

**Payload del webhook:**
```json
{
  "event": {
    "type": "participant_left",
    "room": {
      "name": "room_123_456"
    },
    "participant": {
      "identity": "user_123_cliente",
      "name": "user_123_cliente"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Acciones del backend:**
1. Extrae `user_id` y `role` de `participant.identity`
2. Busca `ChatSession` activa para la sala
3. Identifica al partner (cliente/modelo)
4. Actualiza `ChatSession` → `status: 'ended'`
5. Limpia `VideoChatSession` del usuario desconectado
6. Envía notificación al partner vía Redis/SSE

#### 2. `room_finished`

**Cuándo se dispara:**
- La sala se cierra completamente (todos desconectados)
- LiveKit cierra la sala automáticamente

**Payload del webhook:**
```json
{
  "event": {
    "type": "room_finished",
    "room": {
      "name": "room_123_456"
    },
    "timestamp": "2024-01-15T10:35:00Z"
  }
}
```

**Acciones del backend:**
1. Busca todas las sesiones activas de la sala
2. Finaliza todas las `ChatSession` y `VideoChatSession`
3. Limpia datos relacionados (mensajes, participantes)
4. Notifica a todos los usuarios afectados

---

## 🔄 Flujo de Detección

### Escenario 1: Usuario Cierra la Llamada

```
1. Usuario hace click en "Finalizar llamada"
   ↓
2. Frontend: room.disconnect()
   ↓
3. LiveKit Server detecta desconexión
   ↓
4. LiveKit envía webhook → Laravel
   ↓
5. Laravel procesa evento:
   - Actualiza ChatSession
   - Limpia VideoChatSession
   - Envía notificación al partner
   ↓
6. Partner recibe notificación (SSE/Polling)
   ↓
7. Frontend del partner muestra pantalla de desconexión
```

### Escenario 2: Usuario Presiona "Siguiente"

```
1. Usuario hace click en "Siguiente"
   ↓
2. Frontend: Llama a /api/livekit/next-user
   ↓
3. Backend:
   - Notifica al partner vía NotificationController
   - Actualiza sesiones
   ↓
4. LiveKit detecta desconexión → Webhook
   ↓
5. Frontend del partner:
   - Recibe notificación (método rápido)
   - También puede detectar via SDK event (respaldo)
   ↓
6. Muestra pantalla de desconexión
```

### Escenario 3: Desconexión Abrupta (Cierre de Navegador)

```
1. Usuario cierra navegador / pierde conexión
   ↓
2. LiveKit Server detecta timeout de conexión
   ↓
3. LiveKit envía webhook → Laravel
   ↓
4. Laravel procesa:
   - Detecta desconexión
   - Actualiza sesiones
   - Envía notificación al partner
   ↓
5. Partner recibe notificación (SSE/Polling)
   ↓
6. Frontend muestra pantalla de desconexión
```

### Escenario 4: Desconexión Detectada por Frontend (SDK Events)

```
1. Usuario se desconecta (cualquier razón)
   ↓
2. LiveKit SDK detecta: room.on('participantDisconnected')
   ↓
3. Frontend procesa inmediatamente:
   - Verifica que es el partner
   - Procesa ganancias
   - Muestra pantalla de desconexión
   ↓
4. (Respaldo) Webhook también llega al backend
   ↓
5. Backend actualiza estado (idempotente)
```

---

## ✅ Mejores Prácticas

### 1. Validación de Webhooks

**SIEMPRE valida las firmas en producción:**

```php
// El método validateWebhookSignature() ya está implementado
// Asegúrate de tener LIVEKIT_WEBHOOK_SECRET configurado
```

### 2. Manejo de Eventos Duplicados

El sistema está diseñado para ser **idempotente**:
- Si el frontend ya procesó la desconexión, el webhook no causa problemas
- Las actualizaciones de base de datos usan condiciones para evitar duplicados

### 3. Timeouts y Reconexiones

**Recomendaciones:**
- LiveKit tiene un timeout de ~30 segundos para detectar desconexiones
- El polling de notificaciones actúa como respaldo (cada 500ms-3s)
- Los eventos del SDK son inmediatos (< 1 segundo)

### 4. Logging

Todos los eventos importantes se registran en logs:

```php
Log::info('🚪 [LiveKit Webhook] Participante abandonó sala', [
    'room_name' => $roomName,
    'user_id' => $userId,
    'user_role' => $userRole
]);
```

**Recomendación:** Monitorea estos logs en producción para detectar problemas.

### 5. Notificaciones Múltiples

El sistema usa **múltiples canales** para notificaciones:

1. **SSE (Server-Sent Events)** - Tiempo real, más rápido
2. **Polling de Notificaciones** - Respaldo confiable
3. **Eventos del SDK** - Detección inmediata en el cliente

Esto garantiza que **al menos uno** funcione incluso si otros fallan.

### 6. Limpieza de Recursos

El sistema limpia automáticamente:

- `ChatSession` → `status: 'ended'`
- `VideoChatSession` → `status: 'ended'`, `is_consuming: false`
- `ChatMessage` y `RoomParticipant` (opcional, según configuración)

### 7. Procesamiento de Ganancias

Cuando se detecta una desconexión:

1. Se calcula el tiempo de sesión
2. Se procesan las ganancias (`processSessionEarnings`)
3. Se actualiza el saldo del cliente
4. Se registra el evento

**⚠️ Importante:** El procesamiento de ganancias debe ser **atómico** (usar transacciones de DB).

---

## 🐛 Solución de Problemas

### Problema: Webhooks no llegan al backend

**Síntomas:**
- Los logs no muestran eventos de webhook
- Las desconexiones no se procesan en el backend

**Soluciones:**

1. **Verificar configuración en LiveKit Dashboard:**
   - URL del webhook correcta
   - Método POST
   - Eventos habilitados

2. **Verificar firewall/proxy:**
   - LiveKit debe poder hacer POST a tu servidor
   - Puerto 443 (HTTPS) debe estar abierto

3. **Verificar logs de LiveKit:**
   - Dashboard de LiveKit → Logs
   - Buscar errores de webhook

4. **Probar webhook manualmente:**
   ```bash
   curl -X POST https://tu-dominio.com/api/livekit/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "event": {
         "type": "participant_left",
         "room": {"name": "test_room"},
         "participant": {"identity": "user_1_cliente"}
       }
     }'
   ```

### Problema: Firma de webhook inválida

**Síntomas:**
- Logs muestran: `❌ [LiveKit Webhook] Firma inválida`
- Webhooks son rechazados con 401/403

**Soluciones:**

1. **Verificar LIVEKIT_WEBHOOK_SECRET:**
   ```bash
   php artisan tinker
   >>> config('livekit.webhook_secret')
   ```

2. **Obtener secret desde LiveKit Dashboard:**
   - Settings → Webhooks → Ver secret

3. **Actualizar .env:**
   ```env
   LIVEKIT_WEBHOOK_SECRET=tu_secret_correcto
   ```

### Problema: Desconexiones no detectadas

**Síntomas:**
- El partner no recibe notificación de desconexión
- Sesiones quedan en estado "active" indefinidamente

**Soluciones:**

1. **Verificar que el webhook está configurado** (ver sección anterior)

2. **Verificar Redis/SSE:**
   ```bash
   # Verificar conexión a Redis
   php artisan tinker
   >>> Redis::ping()
   ```

3. **Verificar logs del frontend:**
   - Console del navegador
   - Buscar eventos `participantDisconnected`

4. **Verificar polling de notificaciones:**
   - Network tab → `/api/status/updates`
   - Debe responder con notificaciones pendientes

### Problema: Desconexiones detectadas dos veces

**Síntomas:**
- El frontend procesa la desconexión dos veces
- Ganancias se procesan duplicadas

**Soluciones:**

1. **El sistema ya tiene protección:**
   - Los métodos de procesamiento son idempotentes
   - Se verifica estado antes de procesar

2. **Si persiste, verificar:**
   - Que no haya múltiples listeners del mismo evento
   - Que el cleanup de eventos funcione correctamente

### Problema: Delay en detección de desconexiones

**Síntomas:**
- Hay retraso entre desconexión y notificación
- Puede tardar 5-30 segundos

**Soluciones:**

1. **El webhook es el método más rápido** (1-2 segundos)
2. **Los eventos del SDK son inmediatos** (< 1 segundo)
3. **El polling es un respaldo** (puede tardar hasta el intervalo)

**Para mejorar:**
- Reducir intervalo de polling (actualmente 500ms-3s)
- Asegurar que SSE funcione correctamente
- Monitorear latencia del webhook

---

## 📊 Monitoreo y Métricas

### Logs Importantes

Busca estos logs en tu sistema:

```
✅ [LiveKit Webhook] Participante abandonó sala
✅ [LiveKit Webhook] Desconexión procesada exitosamente
❌ [LiveKit Webhook] Error procesando webhook
⚠️ [LiveKit Webhook] Sin sesión activa para la sala
```

### Métricas Recomendadas

1. **Tiempo de detección promedio:**
   - Desde desconexión hasta notificación
   - Objetivo: < 3 segundos

2. **Tasa de éxito de webhooks:**
   - Webhooks recibidos / Webhooks esperados
   - Objetivo: > 95%

3. **Tasa de falsos positivos:**
   - Desconexiones detectadas incorrectamente
   - Objetivo: < 1%

---

## 🔐 Seguridad

### Validación de Firmas

**SIEMPRE** valida las firmas de webhooks en producción:

```env
LIVEKIT_WEBHOOK_SECRET=tu_secret_seguro
```

### Rate Limiting

Considera agregar rate limiting al endpoint de webhook:

```php
// En routes/api.php
Route::post('/livekit/webhook', [LiveKitController::class, 'handleWebhook'])
    ->middleware('throttle:100,1'); // 100 requests por minuto
```

### IP Whitelisting (Opcional)

Si conoces las IPs de LiveKit, puedes agregar whitelisting:

```php
// En el método handleWebhook()
$allowedIPs = ['IP_DE_LIVEKIT_1', 'IP_DE_LIVEKIT_2'];
if (!in_array($request->ip(), $allowedIPs)) {
    return response('Forbidden', 403);
}
```

---

## 🚀 Próximos Pasos

1. **Configurar webhook en LiveKit Dashboard**
2. **Agregar LIVEKIT_WEBHOOK_SECRET al .env**
3. **Probar con una desconexión real**
4. **Monitorear logs por 24-48 horas**
5. **Ajustar intervalos de polling si es necesario**

---

## 📚 Referencias

- [LiveKit Webhooks Documentation](https://docs.livekit.io/guides/webhooks/)
- [LiveKit SDK Events](https://docs.livekit.io/client-sdk-js/)
- [Laravel Logging](https://laravel.com/docs/logging)

---

**¿Preguntas o problemas?** Revisa los logs y el código fuente en:
- `backend/app/Http/Controllers/LiveKitController.php::handleWebhook()`
- `frontend/src/components/client/videochatclient.jsx` (eventos de desconexión)




