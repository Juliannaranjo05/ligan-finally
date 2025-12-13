#!/bin/bash

# Script de despliegue para Ligand en VPS Ubuntu

echo "Actualizando sistema..."
apt update && apt upgrade -y
apt install -y curl wget git unzip software-properties-common

echo "Instalando PHP 8.2..."
add-apt-repository ppa:ondrej/php -y
apt update
apt install -y php8.2 php8.2-cli php8.2-fpm php8.2-mysql php8.2-sqlite3 php8.2-xml php8.2-mbstring php8.2-curl php8.2-zip php8.2-gd php8.2-intl

echo "Instalando Composer..."
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

echo "Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo "Instalando Nginx..."
apt install -y nginx

echo "Clonando repositorios..."
cd /var/www
# Reemplaza con tus URLs
git clone https://github.com/tuusuario/ligand-backend.git backend
git clone https://github.com/tuusuario/ligand.git frontend

echo "Configurando backend..."
cd /var/www/backend
cp .env.example .env
# Edita .env manualmente si es necesario
composer install --no-dev --optimize-autoloader
php artisan key:generate
touch database/database.sqlite
chmod 775 database/database.sqlite
php artisan migrate --force
php artisan db:seed --force

echo "Configurando frontend..."
cd /var/www/frontend
npm install
npm run build

echo "Configurando Nginx..."
cat > /etc/nginx/sites-available/ligand <<EOF
server {
    listen 80;
    server_name d23e0c6d-e12e-4b9b-acf0-6d4c8a087891.clouding.host;

    root /var/www/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/ligand /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "Ejecutando backend..."
cd /var/www/backend
php artisan serve --host=0.0.0.0 --port=8000 &

echo "Despliegue completado. Accede a http://d23e0c6d-e12e-4b9b-acf0-6d4c8a087891.clouding.host"