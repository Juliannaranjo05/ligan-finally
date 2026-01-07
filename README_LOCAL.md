# 🚀 Guía Completa: Trabajar Localmente

## ✅ Tu servidor de producción NO se afectará
- **Producción:** `https://ligandome.com` sigue funcionando normalmente
- **Local:** Trabajas en `http://localhost:5173` sin afectar producción

---

## 🎯 Inicio Rápido (3 Pasos)

### Paso 1: Clonar el proyecto en tu PC
```bash
git clone <tu-repositorio> ligando-local
cd ligando-local
```

### Paso 2: Ejecutar script de configuración automática
```bash
chmod +x setup-completo.sh
./setup-completo.sh
```

Este script hace TODO automáticamente:
- ✅ Configura frontend/.env
- ✅ Configura backend/.env
- ✅ Instala dependencias (npm y composer)
- ✅ Crea base de datos SQLite
- ✅ Genera clave de Laravel
- ✅ Ejecuta migraciones

### Paso 3: Configurar credenciales (solo una vez)
Edita `backend/.env` y configura:
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `STRIPE_KEY`, `STRIPE_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

*(Puedes copiarlas del servidor si las necesitas)*

### Paso 4: Iniciar servidores
```bash
# Terminal 1 - Backend
cd backend && php artisan serve

# Terminal 2 - Frontend
cd frontend && npm run dev
```

O usa el script:
```bash
# Terminal 1
./iniciar-servidores.sh backend

# Terminal 2
./iniciar-servidores.sh frontend
```

---

## ✅ Resultado

- **Local:** http://localhost:5173 ✅
- **Producción:** https://ligandome.com ✅ (sigue funcionando)

---

## 📤 Subir Cambios a Producción

Cuando tus cambios estén listos:

```bash
# 1. En tu PC local
git add .
git commit -m "Descripción de cambios"
git push

# 2. En el servidor (SSH)
cd /root/ligando
git pull
cd frontend && npm run build
```

---

## 🐛 Solución de Problemas

### Error: "No se puede conectar a la API"
- Verifica que el backend esté corriendo: `http://localhost:8000`
- Verifica `frontend/.env`: `VITE_API_BASE_URL=http://localhost:8000`

### Error: "Database connection failed"
- Verifica que `backend/database/database.sqlite` exista
- Ejecuta: `cd backend && php artisan migrate`

### Error: "APP_KEY not set"
```bash
cd backend && php artisan key:generate
```

### Error: "Dependencies not found"
```bash
cd frontend && npm install
cd ../backend && composer install
```

---

## 📋 Checklist

- [ ] Proyecto clonado en tu PC
- [ ] `./setup-completo.sh` ejecutado exitosamente
- [ ] Credenciales configuradas en `backend/.env`
- [ ] Backend corriendo en `http://localhost:8000`
- [ ] Frontend corriendo en `http://localhost:5173`
- [ ] Puedes acceder a `http://localhost:5173`

---

## ⚠️ IMPORTANTE

- ✅ Tu servidor **SIGUE en producción** normalmente
- ✅ Los cambios locales **NO afectan** producción
- ✅ Solo cuando hagas `git push` y `git pull` en el servidor, los cambios se aplican
- ✅ Nunca ejecutes `npm run build` en local a menos que quieras probar el build

---

## 📚 Archivos de Ayuda

- `SETUP_LOCAL.md` - Guía detallada paso a paso
- `INSTRUCCIONES_RAPIDAS_LOCAL.md` - Guía rápida
- `setup-completo.sh` - Script de configuración automática
- `iniciar-servidores.sh` - Script para iniciar servidores

---

¡Listo! 🎉




