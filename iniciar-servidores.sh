#!/bin/bash

# 🚀 Script para Iniciar Servidores de Desarrollo
# Ejecutar después de setup-completo.sh

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🚀 INICIANDO SERVIDORES DE DESARROLLO                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: Este script debe ejecutarse en la raíz del proyecto${NC}"
    exit 1
fi

# Verificar que los .env existen
if [ ! -f "frontend/.env" ] || [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  Archivos .env no encontrados${NC}"
    echo "   Ejecuta primero: ./setup-completo.sh"
    exit 1
fi

echo -e "${GREEN}✅ Verificaciones completadas${NC}"
echo ""

# Función para iniciar backend
start_backend() {
    echo -e "${YELLOW}🔧 Iniciando Backend en http://localhost:8000...${NC}"
    cd backend
    php artisan serve
}

# Función para iniciar frontend
start_frontend() {
    echo -e "${YELLOW}🔧 Iniciando Frontend en http://localhost:5173...${NC}"
    cd frontend
    npm run dev
}

# Verificar si se pasa un argumento
if [ "$1" == "backend" ]; then
    start_backend
elif [ "$1" == "frontend" ]; then
    start_frontend
else
    echo -e "${BLUE}📋 Instrucciones:${NC}"
    echo ""
    echo "Este script inicia los servidores. Tienes dos opciones:"
    echo ""
    echo -e "${GREEN}Opción 1: Iniciar en terminales separadas (RECOMENDADO)${NC}"
    echo ""
    echo "   Terminal 1:"
    echo "   ./iniciar-servidores.sh backend"
    echo ""
    echo "   Terminal 2:"
    echo "   ./iniciar-servidores.sh frontend"
    echo ""
    echo -e "${GREEN}Opción 2: Iniciar ambos en segundo plano${NC}"
    echo ""
    echo "   cd backend && php artisan serve > /dev/null 2>&1 &"
    echo "   cd frontend && npm run dev &"
    echo ""
    echo -e "${YELLOW}💡 Recomendación: Usa la Opción 1 para ver los logs${NC}"
fi




