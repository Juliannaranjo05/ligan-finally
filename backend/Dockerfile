FROM php:8.2-cli-alpine

# Instalar dependencias del sistema
RUN apk update && apk add --no-cache \
    git \
    curl \
    unzip \
    libzip-dev \
    oniguruma-dev \
    zip \
    postgresql-dev \
    build-base

# Instalar extensiones PHP
RUN docker-php-ext-install \
    pdo \
    pdo_pgsql \
    zip

# Instalar Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Establecer directorio de trabajo
WORKDIR /var/www

# Copiar archivos del proyecto
COPY . .

# Crear base de datos SQLite
RUN touch database/database.sqlite

# Crear directorios y establecer permisos
RUN mkdir -p storage/app/public \
    && mkdir -p storage/framework/cache \
    && mkdir -p storage/framework/sessions \
    && mkdir -p storage/framework/views \
    && mkdir -p storage/logs \
    && mkdir -p bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Permitir Composer como root
ENV COMPOSER_ALLOW_SUPERUSER=1

# Instalar dependencias de Laravel
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Exponer puerto
EXPOSE 8000

# Comando de inicio
CMD php artisan migrate --force && \
    php artisan db:seed --force && \
    php artisan serve --host=0.0.0.0 --port=8000