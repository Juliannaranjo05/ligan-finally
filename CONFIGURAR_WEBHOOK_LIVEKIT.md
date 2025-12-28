# 🔧 Configuración Rápida del Webhook de LiveKit

## 📋 Pasos Basados en tu Pantalla

### 1. Completar el Formulario en LiveKit Dashboard

En la pantalla que estás viendo:

#### Campo "Name":
```
Mi Webhook Ligando
```
(Usa cualquier nombre descriptivo)

#### Campo "URL":
**Para desarrollo local (con ngrok):**
```
https://tu-url-ngrok.ngrok.io/api/livekit/webhook
```

**Para producción:**
```
https://tu-dominio.com/api/livekit/webhook
```

⚠️ **IMPORTANTE:** 
- Debe ser HTTPS (no HTTP) si es producción
- Para desarrollo local, usa ngrok u otra herramienta de tunneling
- La URL debe ser accesible públicamente desde Internet

#### Campo "Signing API key":
- Deja la clave que ya está seleccionada: `APIYFF3U2g6J4dv`
- Esta es tu clave de firma (webhook secret)

### 2. Guardar el Webhook

1. Haz click en el botón "Save" o "Create" (debe estar abajo del formulario)
2. LiveKit debería confirmar que el webhook fue creado

### 3. Configurar en tu Backend

#### Paso 3.1: Agregar al .env

Abre `backend/.env` y agrega:

```env
# LiveKit Webhook Secret (para validar firmas)
LIVEKIT_WEBHOOK_SECRET=APIYFF3U2g6J4dv
```

⚠️ **Usa EXACTAMENTE la misma clave que ves en el dropdown** (`APIYFF3U2g6J4dv`)

#### Paso 3.2: Limpiar caché de configuración

```bash
cd backend
php artisan config:clear
php artisan config:cache
```

### 4. Probar que Funciona

#### Opción A: Probar con una videollamada real

1. Inicia una videollamada entre 2 usuarios
2. Cierra la llamada desde uno de ellos
3. Verifica los logs:

```bash
cd backend
tail -f storage/logs/laravel.log | grep "LiveKit Webhook"
```

**Debes ver:**
```
📨 [LiveKit Webhook] Evento recibido
🚪 [LiveKit Webhook] Participante abandonó sala
✅ [LiveKit Webhook] Desconexión procesada exitosamente
```

#### Opción B: Probar manualmente (sin LiveKit real)

```bash
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

---

## 🐛 Solución de Problemas

### Si la URL no es accesible (desarrollo local)

**Usa ngrok para exponer tu servidor local:**

1. **Instalar ngrok:**
   ```bash
   # En macOS
   brew install ngrok
   
   # O descargar de: https://ngrok.com/download
   ```

2. **Iniciar ngrok:**
   ```bash
   ngrok http 8000
   ```

3. **Copiar la URL HTTPS que te da:**
   ```
   https://abc123.ngrok.io
   ```

4. **Usar esa URL en LiveKit:**
   ```
   https://abc123.ngrok.io/api/livekit/webhook
   ```

⚠️ **Nota:** Cada vez que reinicies ngrok, la URL cambia. Tendrás que actualizar el webhook en LiveKit.

### Si ves "Firma inválida" en los logs

1. Verifica que `LIVEKIT_WEBHOOK_SECRET` en `.env` sea **exactamente igual** a la clave del dropdown
2. Ejecuta: `php artisan config:clear && php artisan config:cache`
3. Vuelve a probar

### Si no ves eventos en los logs

1. Verifica que el webhook esté activo en LiveKit Dashboard
2. Verifica que la URL sea correcta y accesible
3. Prueba con una desconexión real (no con curl)
4. Revisa los logs de LiveKit (si tienes acceso)

---

## ✅ Checklist Final

- [ ] Webhook creado en LiveKit Dashboard con URL correcta
- [ ] `LIVEKIT_WEBHOOK_SECRET` agregado al `.env`
- [ ] Ejecutado `php artisan config:clear && php artisan config:cache`
- [ ] URL del webhook es accesible públicamente (HTTPS o ngrok)
- [ ] Probado con una desconexión real
- [ ] Logs muestran eventos correctamente

---

## 📝 Notas Importantes

1. **En desarrollo:** Puedes usar ngrok para exponer tu servidor local
2. **En producción:** La URL debe ser HTTPS y estar accesible públicamente
3. **La Signing API key** (`APIYFF3U2g6J4dv`) debe ser la misma en LiveKit y en tu `.env`
4. **Si cambias la clave:** Actualiza ambos lugares (LiveKit Dashboard y `.env`)

¡Listo! Una vez completado, tu sistema de detección de desconexiones estará funcionando. 🚀









