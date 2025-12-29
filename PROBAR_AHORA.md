# ✅ Probar Sistema de Desconexiones - AHORA

## 📋 Datos de tu Webhook

- **Nombre:** Ligando
- **URL:** `https://ligando.duckdns.org/api/livekit/webhook`
- **Signing API Key:** `APIYFF3U2G6J4DV`

---

## 🚀 Pasos para Probar (Ejecutar en orden)

### Paso 1: Configurar el Secret en Backend

Agrega esta línea a `backend/.env`:

```env
LIVEKIT_WEBHOOK_SECRET=APIYFF3U2G6J4DV
```

**⚠️ IMPORTANTE:** Debe ser exactamente igual (mayúsculas: `APIYFF3U2G6J4DV`)

### Paso 2: Limpiar Caché de Configuración

```bash
cd backend
php artisan config:clear
php artisan config:cache
```

### Paso 3: Verificar que Redis Funciona

```bash
cd backend
php artisan tinker
```

En tinker, ejecuta:
```php
Redis::ping()
```

**Debe retornar:** `"PONG"`

Si no funciona, las notificaciones no llegarán, pero el webhook seguirá funcionando.

Sal de tinker:
```php
exit
```

### Paso 4: Iniciar Monitoreo de Logs

Abre una terminal y mantén este comando corriendo:

```bash
cd backend
tail -f storage/logs/laravel.log | grep --color=always -E "LiveKit Webhook|participant_left|room_finished|Desconexión procesada|❌.*LiveKit"
```

Esto te mostrará en tiempo real todos los eventos relacionados con webhooks.

### Paso 5: Probar con Videollamada Real

#### Escenario de Prueba:

1. **Abre dos navegadores/ventanas:**
   - Ventana 1: Login como **Cliente**
   - Ventana 2: Login como **Modelo**

2. **Inicia una videollamada:**
   - Cliente inicia llamada a Modelo
   - Espera a que ambos se conecten

3. **Prueba desconexión:**
   - Cliente hace click en **"Finalizar llamada"** o **"Siguiente"**
   - O simplemente cierra el navegador del Cliente

4. **Observa la terminal de logs:**
   - Debes ver algo como:
     ```
     📨 [LiveKit Webhook] Evento recibido
     🚪 [LiveKit Webhook] Participante abandonó sala
     ✅ [LiveKit Webhook] Desconexión procesada exitosamente
     ```

5. **Verifica en la ventana del Modelo:**
   - Debe recibir notificación de desconexión
   - Debe mostrar pantalla de desconexión

---

## 🧪 Prueba Rápida sin Videollamada (Opcional)

Si quieres probar que el endpoint funciona sin esperar una videollamada:

```bash
curl -X POST https://ligando.duckdns.org/api/livekit/webhook \
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
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }
  }'
```

**Respuesta esperada:** `OK`

Luego verifica los logs para ver si se procesó.

---

## ✅ Checklist de Verificación

Después de probar, verifica:

- [ ] Logs muestran: `📨 [LiveKit Webhook] Evento recibido`
- [ ] Logs muestran: `🚪 [LiveKit Webhook] Participante abandonó sala`
- [ ] Logs muestran: `✅ [LiveKit Webhook] Desconexión procesada exitosamente`
- [ ] No hay errores rojos (`❌`) en los logs
- [ ] El partner (modelo/cliente) recibe notificación de desconexión
- [ ] Las sesiones en BD se actualizan correctamente

---

## 🔍 Verificar Base de Datos (Opcional)

Para verificar que las sesiones se actualizaron:

```bash
cd backend
php artisan tinker
```

```php
// Ver sesiones finalizadas en los últimos 5 minutos
\App\Models\ChatSession::where('status', 'ended')
    ->where('ended_at', '>', now()->subMinutes(5))
    ->orderBy('ended_at', 'desc')
    ->get(['id', 'room_name', 'status', 'end_reason', 'ended_at']);

// Ver VideoChatSessions finalizadas
\App\Models\VideoChatSession::where('status', 'ended')
    ->where('ended_at', '>', now()->subMinutes(5))
    ->orderBy('ended_at', 'desc')
    ->get(['id', 'user_id', 'room_name', 'status', 'end_reason', 'ended_at']);
```

---

## 🐛 Si Algo No Funciona

### Problema: "No veo eventos en los logs"

**Verificar:**
1. ¿El webhook está activo en LiveKit Dashboard? (debe aparecer como "Ligando")
2. ¿Agregaste `LIVEKIT_WEBHOOK_SECRET` al `.env`?
3. ¿Ejecutaste `php artisan config:clear && php artisan config:cache`?
4. ¿La URL `https://ligando.duckdns.org/api/livekit/webhook` es accesible?

**Probar manualmente:**
```bash
curl https://ligando.duckdns.org/api/livekit/webhook
# Debe responder algo (aunque sea un error de método)
```

### Problema: "Firma inválida"

**Verificar:**
1. El `LIVEKIT_WEBHOOK_SECRET` en `.env` debe ser exactamente: `APIYFF3U2G6J4DV`
2. Debe estar en mayúsculas
3. Ejecuta: `php artisan config:clear && php artisan config:cache`

### Problema: "No se encuentra sesión activa"

**Esto es normal si:**
- El webhook llegó pero la sesión ya fue cerrada por otro método
- Es una prueba con datos que no existen en la BD
- El frontend ya procesó la desconexión antes

**No es un error crítico** - el sistema sigue funcionando.

### Problema: "Redis no funciona"

**Si Redis no funciona:**
- El webhook seguirá funcionando ✅
- Las sesiones se actualizarán correctamente ✅
- Solo las notificaciones en tiempo real no llegarán ⚠️
- Los usuarios seguirán recibiendo notificaciones por polling (más lento)

---

## 📊 Comandos Útiles para Debugging

```bash
# Ver todos los logs de webhooks
cd backend
tail -n 100 storage/logs/laravel.log | grep "LiveKit Webhook"

# Ver solo errores
tail -n 100 storage/logs/laravel.log | grep "❌.*LiveKit"

# Ver logs en tiempo real
tail -f storage/logs/laravel.log | grep "LiveKit"

# Verificar configuración cargada
php artisan tinker
>>> config('livekit.webhook_secret')
# Debe retornar: "APIYFF3U2G6J4DV"
```

---

## 🎯 Resumen Rápido

**Lo que ya tienes:**
- ✅ Webhook configurado en LiveKit
- ✅ URL: `https://ligando.duckdns.org/api/livekit/webhook`
- ✅ Signing Key: `APIYFF3U2G6J4DV`

**Lo que falta hacer:**
1. Agregar `LIVEKIT_WEBHOOK_SECRET=APIYFF3U2G6J4DV` al `.env`
2. Ejecutar `php artisan config:clear && php artisan config:cache`
3. Monitorear logs: `tail -f storage/logs/laravel.log | grep "LiveKit"`
4. Probar con una videollamada real

**Tiempo estimado:** 5 minutos

---

¡Listo para probar! 🚀

Ejecuta los pasos en orden y deberías ver los eventos en los logs cuando alguien se desconecte.










