# 🛠️ Guía: Trabajar Localmente Sin Afectar Producción

## 📋 Situación Actual

**Producción:**
- URL: `https://ligandome.com`
- Frontend: `/root/ligando/frontend/dist` (archivos compilados)
- Backend: `php artisan serve` en puerto 8000
- Configuración: `APP_ENV=production`, `APP_DEBUG=false`

**Tu servidor actual (`/root/ligando`):**
- Está configurado como **PRODUCCIÓN**
- Cualquier cambio que hagas aquí puede afectar a los usuarios reales

---

## ✅ Opción 1: Trabajar en tu Máquina Local (RECOMENDADO)

### Configuración Local

1. **Clonar el repositorio en tu máquina:**
```bash
git clone <tu-repositorio> ligando-local
cd ligando-local
```

2. **Configurar Frontend (.env):**
```bash
cd frontend
# Crear archivo .env
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
```

3. **Configurar Backend (.env):**
```bash
cd backend
# Copiar .env.example a .env y configurar:
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite
```

4. **Instalar dependencias:**
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
composer install
php artisan key:generate
php artisan migrate
```

5. **Ejecutar en modo desarrollo:**
```bash
# Terminal 1: Backend
cd backend
php artisan serve

# Terminal 2: Frontend
cd frontend
npm run dev
```

**Resultado:** Trabajas en `http://localhost:5173` sin afectar producción.

---

## ✅ Opción 2: Crear Entorno de Desarrollo en el Servidor

Si necesitas trabajar directamente en el servidor pero sin afectar producción:

### Crear Directorio de Desarrollo

```bash
# Crear directorio separado
mkdir -p /root/ligando-dev
cd /root/ligando-dev

# Clonar o copiar el código
cp -r /root/ligando/* /root/ligando-dev/
```

### Configurar Nginx para Desarrollo

Crear configuración separada en `/etc/nginx/sites-available/ligandome-dev.conf`:

```nginx
server {
    listen 8080;
    server_name localhost;
    
    # Frontend React (modo desarrollo)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Backend Laravel API (puerto diferente)
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Configurar Variables de Entorno de Desarrollo

```bash
# Frontend
cd /root/ligando-dev/frontend
echo "VITE_API_BASE_URL=http://localhost:8080" > .env

# Backend
cd /root/ligando-dev/backend
# Editar .env:
# APP_ENV=local
# APP_DEBUG=true
# APP_URL=http://localhost:8080
```

### Ejecutar Servidores de Desarrollo

```bash
# Terminal 1: Backend en puerto 8001
cd /root/ligando-dev/backend
php artisan serve --host=127.0.0.1 --port=8001

# Terminal 2: Frontend en modo dev
cd /root/ligando-dev/frontend
npm run dev -- --port 5173 --host 0.0.0.0
```

**Acceso:** `http://tu-servidor-ip:8080` (solo tú, no afecta producción)

---

## ✅ Opción 3: Usar Branch de Git (MEJOR PRÁCTICA)

### Flujo de Trabajo con Git

1. **Crear branch de desarrollo:**
```bash
cd /root/ligando
git checkout -b desarrollo
```

2. **Trabajar en el branch:**
```bash
# Hacer cambios
git add .
git commit -m "Cambios en desarrollo"
```

3. **Probar localmente antes de mergear:**
```bash
# En tu máquina local
git pull origin desarrollo
npm run dev
```

4. **Cuando esté listo, mergear a producción:**
```bash
git checkout main
git merge desarrollo
# Luego hacer build y deploy
```

---

## ⚠️ IMPORTANTE: Si Trabajas Directamente en `/root/ligando`

**Si trabajas directamente en el servidor de producción:**

1. **NO ejecutes `npm run build`** hasta estar seguro
2. **NO reinicies servicios** sin verificar
3. **Usa `npm run dev`** para probar (no afecta el build de producción)
4. **Haz backups** antes de cambios grandes

### Comandos Seguros para Probar

```bash
# Probar frontend en modo dev (no afecta producción)
cd /root/ligando/frontend
npm run dev -- --port 5174 --host 0.0.0.0

# Probar backend en puerto diferente
cd /root/ligando/backend
php artisan serve --host=127.0.0.1 --port=8001
```

**Acceso:** `http://tu-servidor-ip:5174` (solo para pruebas)

---

## 🚀 Deploy a Producción (Solo cuando esté listo)

```bash
# 1. Build del frontend
cd /root/ligando/frontend
npm run build

# 2. Verificar que el build funcionó
ls -la dist/

# 3. Nginx ya está configurado para servir desde dist/
# 4. Reiniciar backend si es necesario
cd /root/ligando/backend
php artisan config:cache
php artisan route:cache
```

---

## 📝 Resumen

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| **Local en tu PC** | ✅ Aislado, seguro, rápido | ❌ Necesitas configurar entorno |
| **Dev en servidor** | ✅ Mismo entorno que producción | ❌ Más complejo de configurar |
| **Git branches** | ✅ Mejor control de versiones | ❌ Requiere disciplina con git |

**Recomendación:** Usa **Opción 1 (Local)** para desarrollo diario y **Opción 3 (Git)** para control de versiones.




