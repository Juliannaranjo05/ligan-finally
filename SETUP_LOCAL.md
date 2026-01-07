# 🛠️ Configuración para Trabajar Localmente

## ✅ Tu servidor seguirá en producción
- **Producción:** `https://ligandome.com` seguirá funcionando normalmente
- **Local:** Trabajarás en `http://localhost:5173` sin afectar producción

---

## 📋 Paso 1: Clonar el Proyecto en tu PC Local

```bash
# En tu máquina local (no en el servidor)
git clone <tu-repositorio> ligando-local
cd ligando-local
```

---

## 📋 Paso 2: Configurar Frontend Local

### Crear archivo `.env` en `frontend/`:

```bash
cd frontend
```

Crea o edita el archivo `.env` con este contenido:

```env
# Configuración Local - NO afecta producción
VITE_API_BASE_URL=http://localhost:8000
```

**Importante:** Este archivo `.env` es solo para tu máquina local.

---

## 📋 Paso 3: Configurar Backend Local

### Crear archivo `.env` en `backend/`:

```bash
cd ../backend
```

Copia el `.env.example` o crea un `.env` nuevo con esta configuración:

```env
APP_NAME=Ligando
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_LEVEL=debug

# Base de datos - Usa SQLite para desarrollo local (más fácil)
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

# O si prefieres MySQL local:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=ligando_local
# DB_USERNAME=root
# DB_PASSWORD=

# Cache y Sesiones
CACHE_DRIVER=file
SESSION_DRIVER=file
QUEUE_CONNECTION=sync

# LiveKit (usa el mismo servidor de producción o uno local)
LIVEKIT_URL=wss://tu-servidor-livekit.com
LIVEKIT_API_KEY=tu-api-key
LIVEKIT_API_SECRET=tu-api-secret

# Stripe (usa claves de prueba)
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...

# OAuth (configura según tu entorno)
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

### Generar clave de aplicación:

```bash
php artisan key:generate
```

---

## 📋 Paso 4: Instalar Dependencias

### Frontend:
```bash
cd frontend
npm install
```

### Backend:
```bash
cd ../backend
composer install
```

---

## 📋 Paso 5: Configurar Base de Datos Local

### Opción A: SQLite (Más fácil - Recomendado)

```bash
cd backend
touch database/database.sqlite
php artisan migrate
php artisan db:seed  # Si tienes seeders
```

### Opción B: MySQL Local

1. Crear base de datos:
```sql
CREATE DATABASE ligando_local;
```

2. Ejecutar migraciones:
```bash
php artisan migrate
php artisan db:seed
```

---

## 📋 Paso 6: Ejecutar Servidores Locales

### Terminal 1 - Backend:
```bash
cd backend
php artisan serve
# Servidor corriendo en http://localhost:8000
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
# Servidor corriendo en http://localhost:5173
```

---

## 🎯 Acceso Local

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/api
- **Producción (no se afecta):** https://ligandome.com

---

## ⚠️ Importante

1. **Nunca hagas `npm run build` en local** a menos que quieras probar el build
2. **El servidor de producción seguirá funcionando** independientemente
3. **Los cambios locales NO afectan producción** hasta que hagas deploy
4. **Usa Git** para sincronizar cambios cuando estén listos

---

## 🔄 Sincronizar Cambios con el Servidor

Cuando tus cambios locales estén listos:

```bash
# 1. Commit en local
git add .
git commit -m "Descripción de cambios"
git push origin main  # o tu branch

# 2. En el servidor, hacer pull
cd /root/ligando
git pull origin main

# 3. Build y deploy (solo cuando esté listo)
cd frontend
npm run build

# 4. Reiniciar backend si es necesario
cd ../backend
php artisan config:cache
php artisan route:cache
```

---

## 🐛 Troubleshooting

### Error: "No se puede conectar a la API"
- Verifica que el backend esté corriendo en `http://localhost:8000`
- Verifica que `VITE_API_BASE_URL=http://localhost:8000` en `frontend/.env`

### Error: "Database connection failed"
- Si usas SQLite: Verifica que `database/database.sqlite` exista
- Si usas MySQL: Verifica credenciales en `backend/.env`

### Error: "APP_KEY not set"
```bash
cd backend
php artisan key:generate
```

---

## ✅ Checklist de Configuración

- [ ] Proyecto clonado en tu PC
- [ ] `frontend/.env` creado con `VITE_API_BASE_URL=http://localhost:8000`
- [ ] `backend/.env` creado con `APP_ENV=local` y `APP_DEBUG=true`
- [ ] `php artisan key:generate` ejecutado
- [ ] Base de datos configurada (SQLite o MySQL)
- [ ] `composer install` ejecutado
- [ ] `npm install` ejecutado
- [ ] `php artisan migrate` ejecutado
- [ ] Backend corriendo en puerto 8000
- [ ] Frontend corriendo en puerto 5173
- [ ] Puedes acceder a http://localhost:5173

---

¡Listo! Ahora puedes trabajar localmente sin afectar producción. 🚀




