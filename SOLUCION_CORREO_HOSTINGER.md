# Solución: Error de Autenticación SMTP con Hostinger

## 🔍 Problema Identificado

El error en los logs muestra:
```
Failed to authenticate on SMTP server with username "support@ligandome.com"
Error: authentication failed (535 5.7.8)
```

## ⚠️ Posibles Causas

1. **Comillas en la contraseña**: El archivo `.env` tiene comillas alrededor de la contraseña
2. **Contraseña incorrecta**: La contraseña puede no ser la correcta
3. **Configuración SSL/TLS**: Puede necesitar usar TLS en lugar de SSL

## ✅ Soluciones

### Opción 1: Quitar comillas de la contraseña (RECOMENDADO)

Edita el archivo `/root/ligando/backend/.env` y cambia:

```env
# ❌ INCORRECTO (con comillas)
MAIL_PASSWORD="Nn#01357986425"

# ✅ CORRECTO (sin comillas)
MAIL_PASSWORD=Nn#01357986425
```

**Importante**: Si la contraseña tiene caracteres especiales, asegúrate de que NO tenga comillas a menos que sea absolutamente necesario.

### Opción 2: Verificar la contraseña en Hostinger

1. Ve al panel de control de Hostinger
2. Accede a la configuración de correo electrónico
3. Verifica que la contraseña sea correcta
4. Si cambias la contraseña, actualiza el `.env`

### Opción 3: Probar con TLS en lugar de SSL

Si el problema persiste, intenta cambiar la configuración:

```env
MAIL_PORT=587
MAIL_ENCRYPTION=tls
```

O mantén SSL pero verifica:

```env
MAIL_PORT=465
MAIL_ENCRYPTION=ssl
```

### Opción 4: Usar contraseña de aplicación

Algunos proveedores requieren una "contraseña de aplicación" específica en lugar de la contraseña normal. Verifica en el panel de Hostinger si hay esta opción.

## 🧪 Probar la Configuración

He creado un script de prueba. Ejecuta:

```bash
cd /root/ligando/backend
php test-email.php
```

El script te pedirá un email de destino y probará el envío de correo con la configuración actual.

## 📋 Configuración Recomendada para Hostinger

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_USERNAME=support@ligandome.com
MAIL_PASSWORD=Nn#01357986425
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=support@ligandome.com
MAIL_FROM_NAME="Ligand"
```

**O si 465/SSL no funciona, prueba:**

```env
MAIL_PORT=587
MAIL_ENCRYPTION=tls
```

## 🔄 Después de Cambiar la Configuración

1. Limpia la caché de configuración:
   ```bash
   cd /root/ligando/backend
   php artisan config:clear
   php artisan cache:clear
   ```

2. Prueba el reenvío de código desde la aplicación

3. Revisa los logs:
   ```bash
   tail -f storage/logs/laravel.log | grep -i "mail\|smtp\|correo"
   ```

## 📞 Si el Problema Persiste

1. Verifica en el panel de Hostinger:
   - Que la cuenta de correo `support@ligandome.com` esté activa
   - Que la contraseña sea correcta
   - Que no haya restricciones de seguridad

2. Contacta al soporte de Hostinger para:
   - Verificar que el servidor SMTP esté funcionando
   - Confirmar los parámetros correctos de conexión
   - Verificar si hay límites de envío

3. Considera usar un servicio alternativo como:
   - Mailgun
   - SendGrid
   - Amazon SES
   - Postmark


