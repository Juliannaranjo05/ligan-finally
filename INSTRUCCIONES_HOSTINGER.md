# 📋 Instrucciones para Configurar ligandome.com en Hostinger

## ✅ Pasos en el Panel de Hostinger

### 1. Configurar DNS
1. Inicia sesión en tu cuenta de Hostinger
2. Ve a **"Dominios"** → **"Gestionar"**
3. Selecciona **ligandome.com**
4. Ve a **"Zona DNS"** o **"DNS"**
5. Agrega/edita estos registros:

```
Tipo A:
- Nombre: @ (o deja vacío)
- Valor: 66.94.111.180
- TTL: 3600

Tipo A:
- Nombre: www
- Valor: 66.94.111.180
- TTL: 3600
```

**✅ IP configurada:** 66.94.111.180

### 2. Activar SSL (Opcional desde panel)
Si Hostinger ofrece SSL gratuito:
1. Ve a **"SSL"** en el panel
2. Activa SSL para **ligandome.com**

**Recomendación:** Usa Let's Encrypt desde el servidor (más control).

---

## 🔧 Pasos en el Servidor (SSH)

### 1. Instalar Certbot (SSL)
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Configurar Nginx
```bash
# Copiar configuración
sudo cp /root/ligando/nginx-ligandome.conf /etc/nginx/sites-available/ligandome.com

# Crear symlink
sudo ln -s /etc/nginx/sites-available/ligandome.com /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

### 3. Obtener Certificado SSL
```bash
sudo certbot --nginx -d ligandome.com -d www.ligandome.com
```

Certbot configurará automáticamente SSL en Nginx.

### 4. Verificar Renovación Automática
```bash
sudo certbot renew --dry-run
```

### 5. Construir Frontend
```bash
cd /root/ligando/frontend
npm run build
```

### 6. Asegurar que Backend esté corriendo
```bash
cd /root/ligando/backend
php artisan serve --host=127.0.0.1 --port=8000
# O usa supervisor/systemd para mantenerlo corriendo
```

---

## 🔐 Actualizar Variables de Entorno

### Frontend (.env)
```bash
cd /root/ligando/frontend
nano .env
```

Agregar:
```
VITE_API_BASE_URL=https://ligandome.com
```

### Backend (.env)
```bash
cd /root/ligando/backend
nano .env
```

Actualizar:
```
APP_URL=https://ligandome.com
APP_ENV=production
APP_DEBUG=false
GOOGLE_REDIRECT_URI=https://ligandome.com/auth/google/callback
```

Luego:
```bash
php artisan config:clear
php artisan cache:clear
```

---

## 🌐 Actualizar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs y servicios** → **Credenciales**
3. Edita tu **OAuth 2.0 Client ID**
4. En **"URI de redirección autorizadas"**, agrega:
   ```
   https://ligandome.com/auth/google/callback
   ```
5. Guarda los cambios

---

## ✅ Verificación Final

### 1. Verificar DNS
```bash
nslookup ligandome.com
```

### 2. Verificar SSL
```bash
curl -I https://ligandome.com
```

### 3. Probar en Navegador
- Abre: `https://ligandome.com`
- Verifica que carga el frontend
- Prueba hacer login
- Verifica que las APIs funcionan

---

## 🚨 Troubleshooting

### Si el dominio no resuelve:
- Espera 24-48 horas para propagación DNS
- Verifica que la IP en DNS sea correcta
- Usa: `dig ligandome.com` para verificar

### Si SSL no funciona:
- Verifica que el puerto 443 esté abierto
- Revisa logs: `sudo tail -f /var/log/nginx/error.log`
- Verifica certificados: `sudo certbot certificates`

### Si el frontend no carga:
- Verifica que `npm run build` se ejecutó correctamente
- Verifica permisos: `sudo chown -R www-data:www-data /root/ligando/frontend/dist`
- Revisa logs de Nginx

### Si la API no funciona:
- Verifica que el backend esté corriendo: `ps aux | grep php`
- Verifica que el puerto 8000 esté escuchando: `netstat -tlnp | grep 8000`
- Revisa logs de Laravel: `tail -f /root/ligando/backend/storage/logs/laravel.log`

---

## 📝 Notas Importantes

1. **DNS Propagation:** Los cambios de DNS pueden tardar hasta 48 horas en propagarse globalmente
2. **Firewall:** Asegúrate de que los puertos 80, 443 y 8000 estén abiertos
3. **Backups:** Haz backup antes de hacer cambios importantes
4. **Monitoreo:** Configura monitoreo para el servidor y la aplicación

---

## 🎯 Checklist Final

- [ ] DNS configurado en Hostinger
- [ ] Nginx configurado y funcionando
- [ ] SSL instalado y funcionando
- [ ] Frontend construido (`npm run build`)
- [ ] Backend corriendo
- [ ] Variables de entorno actualizadas
- [ ] Google OAuth actualizado
- [ ] Sitio accesible en https://ligandome.com
- [ ] APIs funcionando correctamente

