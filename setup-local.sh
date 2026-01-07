#!/bin/bash

# Script para configurar entorno local
# Ejecutar en tu máquina local (NO en el servidor)

echo "🛠️  Configurando entorno local para Ligando..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Este script debe ejecutarse en la raíz del proyecto"
    exit 1
fi

echo -e "${GREEN}✅ Directorio correcto detectado${NC}"
echo ""

# 1. Configurar Frontend
echo -e "${YELLOW}📦 Configurando Frontend...${NC}"
cd frontend

if [ ! -f ".env" ]; then
    echo "VITE_API_BASE_URL=http://localhost:8000" > .env
    echo -e "${GREEN}✅ Archivo frontend/.env creado${NC}"
else
    echo -e "${YELLOW}⚠️  frontend/.env ya existe, no se sobrescribió${NC}"
fi

cd ..

# 2. Configurar Backend
echo -e "${YELLOW}📦 Configurando Backend...${NC}"
cd backend

if [ ! -f ".env" ]; then
    echo "APP_NAME=Ligando" > .env
    echo "APP_ENV=local" >> .env
    echo "APP_KEY=" >> .env
    echo "APP_DEBUG=true" >> .env
    echo "APP_URL=http://localhost:8000" >> .env
    echo "" >> .env
    echo "LOG_CHANNEL=stack" >> .env
    echo "LOG_LEVEL=debug" >> .env
    echo "" >> .env
    echo "DB_CONNECTION=sqlite" >> .env
    echo "DB_DATABASE=database/database.sqlite" >> .env
    echo "" >> .env
    echo "CACHE_DRIVER=file" >> .env
    echo "SESSION_DRIVER=file" >> .env
    echo "QUEUE_CONNECTION=sync" >> .env
    echo "" >> .env
    echo "# ⚠️  IMPORTANTE: Configura estas variables con tus credenciales:" >> .env
    echo "# LIVEKIT_URL=wss://tu-servidor-livekit.com" >> .env
    echo "# LIVEKIT_API_KEY=tu-api-key" >> .env
    echo "# LIVEKIT_API_SECRET=tu-api-secret" >> .env
    echo "# STRIPE_KEY=pk_test_..." >> .env
    echo "# STRIPE_SECRET=sk_test_..." >> .env
    echo "# GOOGLE_CLIENT_ID=..." >> .env
    echo "# GOOGLE_CLIENT_SECRET=..." >> .env
    
    echo -e "${GREEN}✅ Archivo backend/.env creado${NC}"
    echo -e "${YELLOW}⚠️  Recuerda configurar LIVEKIT, STRIPE y GOOGLE en backend/.env${NC}"
else
    echo -e "${YELLOW}⚠️  backend/.env ya existe, no se sobrescribió${NC}"
fi

# Crear base de datos SQLite si no existe
if [ ! -f "database/database.sqlite" ]; then
    touch database/database.sqlite
    echo -e "${GREEN}✅ Base de datos SQLite creada${NC}"
fi

cd ..

echo ""
echo -e "${GREEN}✅ Configuración básica completada!${NC}"
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "1. Edita backend/.env y configura:"
echo "   - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET"
echo "   - STRIPE_KEY, STRIPE_SECRET"
echo "   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
echo ""
echo "2. Instala dependencias:"
echo "   cd frontend && npm install"
echo "   cd ../backend && composer install"
echo ""
echo "3. Genera la clave de Laravel:"
echo "   cd backend && php artisan key:generate"
echo ""
echo "4. Ejecuta las migraciones:"
echo "   cd backend && php artisan migrate"
echo ""
echo "5. Inicia los servidores:"
echo "   Terminal 1: cd backend && php artisan serve"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "🎉 ¡Listo para trabajar localmente!"




