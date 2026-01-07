# ⚡ Instrucciones Rápidas: Trabajar Localmente

## 🎯 Objetivo
Trabajar en tu PC local **SIN afectar** el servidor de producción (`ligandome.com`)

---

## 📥 Paso 1: Clonar en tu PC

```bash
git clone <tu-repositorio> ligando-local
cd ligando-local
```

---

## ⚙️ Paso 2: Configurar Frontend

```bash
cd frontend
cp .env.local.example .env
# O crea .env manualmente con:
# VITE_API_BASE_URL=http://localhost:8000
```

---

## ⚙️ Paso 3: Configurar Backend

```bash
cd ../backend
cp .env.local.example .env
# Edita .env y configura:
# - APP_ENV=local
# - APP_DEBUG=true
# - DB_CONNECTION=sqlite
# - DB_DATABASE=database/database.sqlite
# - LIVEKIT_URL, STRIPE_KEY, etc. (copia del servidor si es necesario)

# Generar clave
php artisan key:generate

# Crear base de datos SQLite
touch database/database.sqlite

# Instalar dependencias
composer install

# Ejecutar migraciones
php artisan migrate
```

---

## 🚀 Paso 4: Ejecutar

### Terminal 1 - Backend:
```bash
cd backend
php artisan serve
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## ✅ Resultado

- **Local:** http://localhost:5173 ✅
- **Producción:** https://ligandome.com ✅ (sigue funcionando)

---

## 📤 Cuando estés listo para subir cambios:

```bash
# En tu PC local
git add .
git commit -m "Tus cambios"
git push

# En el servidor (SSH)
cd /root/ligando
git pull
cd frontend && npm run build
```

---

## ⚠️ IMPORTANTE

- ✅ Tu servidor **SIGUE en producción** normalmente
- ✅ Los cambios locales **NO afectan** producción
- ✅ Solo cuando hagas `git push` y `git pull` en el servidor, los cambios se aplican

---

¡Listo! 🎉




