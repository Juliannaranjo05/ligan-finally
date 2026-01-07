#!/bin/bash

# 🚀 Script de Configuración Completa para Ligando Local
# Ejecutar en tu PC local (NO en el servidor)

set -e  # Detener si hay errores

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🚀 CONFIGURACIÓN COMPLETA - LIGANDO LOCAL               ║"
echo "║   Tu servidor de producción NO se afectará                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: Este script debe ejecutarse en la raíz del proyecto${NC}"
    echo "   Ejemplo: cd ligando-local && ./setup-completo.sh"
    exit 1
fi

echo -e "${GREEN}✅ Directorio correcto detectado${NC}"
echo ""

# ============================================
# 1. CONFIGURAR FRONTEND
# ============================================
echo -e "${YELLOW}📦 [1/7] Configurando Frontend...${NC}"
cd frontend

# Crear .env si no existe
if [ ! -f ".env" ]; then
    cat > .env << EOF
# Configuración Local
VITE_API_BASE_URL=http://localhost:8000
EOF
    echo -e "${GREEN}   ✅ frontend/.env creado${NC}"
else
    echo -e "${YELLOW}   ⚠️  frontend/.env ya existe, verificando configuración...${NC}"
    if ! grep -q "VITE_API_BASE_URL=http://localhost:8000" .env; then
        echo "VITE_API_BASE_URL=http://localhost:8000" >> .env
        echo -e "${GREEN}   ✅ VITE_API_BASE_URL agregado a .env${NC}"
    fi
fi

cd ..

# ============================================
# 2. CONFIGURAR BACKEND
# ============================================
echo -e "${YELLOW}📦 [2/7] Configurando Backend...${NC}"
cd backend

# Crear .env si no existe
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
APP_NAME=Ligando
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_LEVEL=debug

# Base de datos SQLite (más fácil para desarrollo)
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

# Cache y Sesiones
CACHE_DRIVER=file
SESSION_DRIVER=file
QUEUE_CONNECTION=sync
BROADCAST_DRIVER=log
FILESYSTEM_DRIVER=local

# Sanctum
SANCTUM_STATEFUL_DOMAINS=localhost,127.0.0.1
SESSION_DOMAIN=localhost

# ⚠️ IMPORTANTE: Configura estas variables con tus credenciales
# Puedes copiarlas del servidor si es necesario
LIVEKIT_URL=wss://tu-servidor-livekit.com
LIVEKIT_API_KEY=tu-api-key
LIVEKIT_API_SECRET=tu-api-secret

STRIPE_KEY=pk_test_tu_stripe_key
STRIPE_SECRET=sk_test_tu_stripe_secret
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret

GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
EOF
    echo -e "${GREEN}   ✅ backend/.env creado${NC}"
    echo -e "${YELLOW}   ⚠️  Recuerda configurar LIVEKIT, STRIPE y GOOGLE en backend/.env${NC}"
else
    echo -e "${YELLOW}   ⚠️  backend/.env ya existe, no se sobrescribió${NC}"
fi

# Crear base de datos SQLite si no existe
if [ ! -f "database/database.sqlite" ]; then
    touch database/database.sqlite
    echo -e "${GREEN}   ✅ Base de datos SQLite creada${NC}"
else
    echo -e "${YELLOW}   ℹ️  Base de datos SQLite ya existe${NC}"
fi

cd ..

# ============================================
# 3. INSTALAR DEPENDENCIAS FRONTEND
# ============================================
echo -e "${YELLOW}📦 [3/7] Instalando dependencias de Frontend (esto puede tardar)...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}   ✅ Dependencias de Frontend instaladas${NC}"
else
    echo -e "${YELLOW}   ℹ️  node_modules ya existe, omitiendo instalación${NC}"
    echo -e "${YELLOW}   💡 Si hay problemas, ejecuta: cd frontend && npm install${NC}"
fi

cd ..

# ============================================
# 4. INSTALAR DEPENDENCIAS BACKEND
# ============================================
echo -e "${YELLOW}📦 [4/7] Instalando dependencias de Backend (esto puede tardar)...${NC}"
cd backend

if [ ! -d "vendor" ]; then
    composer install --no-interaction
    echo -e "${GREEN}   ✅ Dependencias de Backend instaladas${NC}"
else
    echo -e "${YELLOW}   ℹ️  vendor ya existe, omitiendo instalación${NC}"
    echo -e "${YELLOW}   💡 Si hay problemas, ejecuta: cd backend && composer install${NC}"
fi

cd ..

# ============================================
# 5. GENERAR CLAVE DE LARAVEL
# ============================================
echo -e "${YELLOW}🔑 [5/7] Generando clave de Laravel...${NC}"
cd backend

# Verificar si APP_KEY está vacío
if grep -q "APP_KEY=$" .env || ! grep -q "APP_KEY=" .env; then
    php artisan key:generate --force
    echo -e "${GREEN}   ✅ Clave de Laravel generada${NC}"
else
    echo -e "${YELLOW}   ℹ️  APP_KEY ya está configurado${NC}"
fi

cd ..

# ============================================
# 6. EJECUTAR MIGRACIONES
# ============================================
echo -e "${YELLOW}🗄️  [6/7] Ejecutando migraciones de base de datos...${NC}"
cd backend

php artisan migrate --force
echo -e "${GREEN}   ✅ Migraciones ejecutadas${NC}"

cd ..

# ============================================
# 7. VERIFICAR CONFIGURACIÓN
# ============================================
echo -e "${YELLOW}✅ [7/7] Verificando configuración...${NC}"

# Verificar archivos .env
if [ -f "frontend/.env" ] && [ -f "backend/.env" ]; then
    echo -e "${GREEN}   ✅ Archivos .env configurados${NC}"
else
    echo -e "${RED}   ❌ Error: Faltan archivos .env${NC}"
    exit 1
fi

# Verificar base de datos
if [ -f "backend/database/database.sqlite" ]; then
    echo -e "${GREEN}   ✅ Base de datos SQLite existe${NC}"
else
    echo -e "${RED}   ❌ Error: Base de datos no encontrada${NC}"
    exit 1
fi

# Verificar dependencias
if [ -d "frontend/node_modules" ] && [ -d "backend/vendor" ]; then
    echo -e "${GREEN}   ✅ Dependencias instaladas${NC}"
else
    echo -e "${RED}   ❌ Error: Faltan dependencias${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ CONFIGURACIÓN COMPLETA                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# INSTRUCCIONES FINALES
# ============================================
echo -e "${BLUE}📋 PRÓXIMOS PASOS:${NC}"
echo ""
echo -e "${YELLOW}1. Configura las credenciales en backend/.env:${NC}"
echo "   - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET"
echo "   - STRIPE_KEY, STRIPE_SECRET"
echo "   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
echo ""
echo -e "${YELLOW}2. Inicia los servidores en dos terminales:${NC}"
echo ""
echo -e "${GREEN}   Terminal 1 - Backend:${NC}"
echo "   cd backend && php artisan serve"
echo ""
echo -e "${GREEN}   Terminal 2 - Frontend:${NC}"
echo "   cd frontend && npm run dev"
echo ""
echo -e "${BLUE}3. Accede a:${NC}"
echo -e "${GREEN}   http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "   - Tu servidor de producción (ligandome.com) sigue funcionando"
echo "   - Los cambios locales NO afectan producción"
echo "   - Solo cuando hagas git push y pull en el servidor, se aplican cambios"
echo ""
echo -e "${GREEN}🎉 ¡Listo para trabajar localmente!${NC}"




