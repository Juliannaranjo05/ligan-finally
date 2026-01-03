# 🧪 Guía de Pruebas - Sistema de Detección de Desconexiones

## ✅ Checklist de Preparación

### 1. Verificar que el código está implementado

```bash
# Verificar que la ruta existe
grep -n "livekit/webhook" backend/routes/api.php

# Verificar que el método existe
grep -n "handleWebhook" backend/app/Http/Controllers/LiveKitController.php

# Debe mostrar resultados ✅
```

### 2. Verificar Redis (para notificaciones)

```bash
cd backend
php artisan tinker
```

En tinker:
```php
>>> Redis::ping()
// Debe retornar: "PONG"
>>> exit
```

**Si Redis no funciona:**
- Instala/configura Redis según tu entorno
- O comenta temporalmente las notificaciones (el webhook seguirá funcionando)

### 3. Verificar variables de entorno

Verifica que tienes estas variables en `backend/.env`:

```env
LIVEKIT_API_KEY=tu_api_key
LIVEKIT_API_SECRET=tu_api_secret
LIVEKIT_WS_URL=wss://tu-servidor-livekit.com
# Opcional para desarrollo (requerido en producción):
LIVEKIT_WEBHOOK_SECRET=tu_webhook_secret
```

---

## 🚀 Opción 1: Probar SIN configurar webhook en LiveKit (Desarrollo Local)

**Esta opción es útil para probar que el código funciona, pero NO recibirás webhooks reales de LiveKit.**

### Paso 1: Probar el endpoint manualmente

```bash
# Desde tu terminal, ejecuta:
curl -X POST http://localhost:8000/api/livekit/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "participant_left",
      "room": {
        "name": "test_room_123_456"
      },
      "participant": {
        "identity": "user_1_cliente",
        "name": "user_1_cliente"
      },
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'
```

**Respuesta esperada:** `OK` (200)

### Paso 2: Verificar logs

```bash
cd backend
tail -n 50 storage/logs/laravel.log | grep "LiveKit Webhook"
```

**Debes ver:**
```
📨 [LiveKit Webhook] Evento recibido
🚪 [LiveKit Webhook] Participante abandonó sala
✅ [LiveKit Webhook] Desconexión procesada exitosamente
```

### Paso 3: Verificar en base de datos

```bash
php artisan tinker
```

```php
// Verificar que se creó/actualizó una ChatSession
>>> \App\Models\ChatSession::where('room_name', 'test_room_123_456')->first();

// Verificar VideoChatSession
>>> \App\Models\VideoChatSession::where('room_name', 'test_room_123_456')->get();
```

---

## 🎯 Opción 2: Probar CON webhook real de LiveKit (Recomendado)

**Esta es la forma correcta de probar en producción o con LiveKit real.**

### Paso 1: Obtener URL pública de tu servidor

Si estás en desarrollo local, necesitas exponer tu servidor:

**Opción A: Usar ngrok (recomendado para desarrollo)**
```bash
# Instalar ngrok si no lo tienes
# https://ngrok.com/download

# Exponer puerto 8000
ngrok http 8000

# Copia la URL HTTPS que te da (ej: https://abc123.ngrok.io)
```

**Opción B: Usar tu servidor de producción**
- Ya tienes una URL pública (ej: https://tu-dominio.com)

### Paso 2: Configurar webhook en LiveKit Dashboard

1. **Accede a tu dashboard de LiveKit:**
   - URL: `https://tu-servidor-livekit.com` (o donde tengas el dashboard)
   - O si usas LiveKit Cloud: `https://cloud.livekit.io`

2. **Ve a Settings → Webhooks** (o similar según tu versión)

3. **Agrega nuevo webhook:**
   ```
   URL: https://tu-dominio.com/api/livekit/webhook
        (o https://abc123.ngrok.io/api/livekit/webhook si usas ngrok)
   
   Método: POST
   
   Eventos a escuchar:
   ✅ participant_left
   ✅ room_finished
   ⬜ participant_joined (opcional, solo para logs)
   ```

4. **Copia el Webhook Secret** que te da LiveKit

### Paso 3: Configurar Webhook Secret

Agrega a `backend/.env`:

```env
LIVEKIT_WEBHOOK_SECRET=el_secret_que_te_dio_livekit
```

Luego:
```bash
cd backend
php artisan config:clear
php artisan config:cache
```

### Paso 4: Probar con una videollamada real

1. **Abre dos navegadores/ventanas:**
   - Ventana 1: Login como Cliente
   - Ventana 2: Login como Modelo

2. **Inicia una videollamada:**
   - Cliente inicia llamada a Modelo
   - Ambos se conectan a la sala

3. **Monitorea los logs en tiempo real:**
   ```bash
   cd backend
   tail -f storage/logs/laravel.log | grep "LiveKit"
   ```

4. **Prueba diferentes escenarios:**

   **Escenario A: Cliente cierra la llamada**
   - Cliente hace click en "Finalizar llamada"
   - **Esperado:** Ver en logs: `🚪 [LiveKit Webhook] Participante abandonó sala`
   - **Esperado:** Modelo recibe notificación de desconexión

   **Escenario B: Cliente presiona "Siguiente"**
   - Cliente hace click en "Siguiente"
   - **Esperado:** Ver en logs el webhook
   - **Esperado:** Modelo ve pantalla de desconexión

   **Escenario C: Cierre de navegador**
   - Cliente cierra el navegador completamente
   - Espera 5-10 segundos (LiveKit detecta timeout)
   - **Esperado:** Ver webhook en logs
   - **Esperado:** Modelo recibe notificación

---

## 🔍 Verificación de Resultados

### 1. Verificar logs

```bash
cd backend

# Ver todos los eventos de webhook
tail -f storage/logs/laravel.log | grep "LiveKit Webhook"

# Ver solo errores
tail -f storage/logs/laravel.log | grep "❌.*LiveKit"

# Ver desconexiones procesadas
tail -f storage/logs/laravel.log | grep "Desconexión procesada"
```

### 2. Verificar base de datos

```bash
php artisan tinker
```

```php
// Ver sesiones finalizadas recientemente
>>> \App\Models\ChatSession::where('status', 'ended')
    ->where('ended_at', '>', now()->subMinutes(10))
    ->orderBy('ended_at', 'desc')
    ->get(['id', 'room_name', 'status', 'end_reason', 'ended_at']);

// Ver VideoChatSessions finalizadas
>>> \App\Models\VideoChatSession::where('status', 'ended')
    ->where('ended_at', '>', now()->subMinutes(10))
    ->orderBy('ended_at', 'desc')
    ->get(['id', 'user_id', 'room_name', 'status', 'end_reason', 'ended_at']);
```

### 3. Verificar notificaciones (si Redis funciona)

En el frontend del usuario que NO se desconectó:
- Abre la consola del navegador (F12)
- Busca mensajes de notificaciones
- Debe recibir: `partner_left_session` o `partner_went_next`

---

## 🐛 Solución de Problemas Comunes

### Problema: "Webhook no llega"

**Síntomas:** No ves logs de webhook cuando alguien se desconecta

**Soluciones:**
1. Verifica que el webhook esté configurado en LiveKit Dashboard
2. Verifica que la URL sea accesible públicamente
3. Si usas ngrok, verifica que esté corriendo
4. Revisa logs de LiveKit (si tienes acceso)

### Problema: "Firma inválida"

**Síntomas:** Logs muestran `❌ [LiveKit Webhook] Firma inválida`

**Soluciones:**
1. Verifica que `LIVEKIT_WEBHOOK_SECRET` en `.env` sea correcto
2. Copia el secret exactamente como aparece en LiveKit Dashboard
3. Ejecuta: `php artisan config:clear && php artisan config:cache`

### Problema: "No se encuentra sesión activa"

**Síntomas:** Logs muestran `⚠️ [LiveKit Webhook] No se encontró sesión activa`

**Causa:** El webhook llegó pero no hay `ChatSession` activa para esa sala

**Solución:** Esto es normal si:
- La sesión ya fue cerrada por otro método
- El webhook llegó después de que el frontend ya procesó la desconexión
- Es una sala de prueba que no tiene sesión en la BD

**No es un error crítico** - el sistema sigue funcionando.

### Problema: "Redis no funciona"

**Síntomas:** Las notificaciones no llegan a los usuarios

**Soluciones:**
1. Verifica que Redis esté corriendo: `redis-cli ping`
2. Verifica configuración en `config/database.php`
3. **Temporal:** El webhook seguirá funcionando, solo las notificaciones no llegarán

---

## ✅ Checklist Final

Antes de considerar que está funcionando:

- [ ] El endpoint `/api/livekit/webhook` responde correctamente
- [ ] Los logs muestran eventos cuando hay desconexiones
- [ ] Las `ChatSession` se actualizan a `status: 'ended'`
- [ ] Las `VideoChatSession` se limpian correctamente
- [ ] Los usuarios reciben notificaciones (si Redis funciona)
- [ ] No hay errores en los logs

---

## 📝 Notas Importantes

1. **En desarrollo local:** Puedes probar sin configurar el webhook en LiveKit usando `curl` (Opción 1)

2. **En producción:** DEBES configurar el webhook en LiveKit Dashboard (Opción 2)

3. **El frontend ya detecta desconexiones** usando eventos del SDK. El webhook es un **respaldo** y actualiza el estado en el backend.

4. **Si no configuras `LIVEKIT_WEBHOOK_SECRET`:** El sistema funcionará pero mostrará advertencias en los logs. En producción, **SIEMPRE** configúralo.

---

## 🎯 Próximo Paso

Una vez que hayas verificado que todo funciona:

1. **Configura el webhook en LiveKit Dashboard** (si aún no lo hiciste)
2. **Monitorea los logs** durante 24-48 horas en producción
3. **Ajusta intervalos de polling** si es necesario (actualmente 500ms-3s)

¡Listo para probar! 🚀














