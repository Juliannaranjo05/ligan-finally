#!/bin/bash
# Script para aplicar límites de subida de archivos grandes

echo "🔧 Aplicando límites de subida para videos de alta calidad..."

# 1. Aplicar configuración de nginx
echo "📝 Actualizando configuración de nginx..."
if [ -f "/etc/nginx/sites-available/ligandome.com" ]; then
    sudo cp /root/ligando/nginx-ligandome.conf /etc/nginx/sites-available/ligandome.com
    echo "✅ Configuración de nginx actualizada"
else
    echo "⚠️  Archivo de configuración de nginx no encontrado en /etc/nginx/sites-available/ligandome.com"
    echo "   Por favor, copia manualmente nginx-ligandome.conf a /etc/nginx/sites-available/ligandome.com"
fi

# 2. Verificar y aplicar límites de PHP
echo ""
echo "📝 Verificando límites actuales de PHP..."
php -r "
echo 'Límites actuales:' . PHP_EOL;
echo '  upload_max_filesize: ' . ini_get('upload_max_filesize') . PHP_EOL;
echo '  post_max_size: ' . ini_get('post_max_size') . PHP_EOL;
echo '  max_execution_time: ' . ini_get('max_execution_time') . PHP_EOL;
echo '  memory_limit: ' . ini_get('memory_limit') . PHP_EOL;
"

# 3. Buscar archivos de configuración de PHP
echo ""
echo "🔍 Buscando archivos de configuración de PHP..."
PHP_INI=$(php --ini | grep "Loaded Configuration File" | awk '{print $4}')
if [ -n "$PHP_INI" ] && [ -f "$PHP_INI" ]; then
    echo "✅ Archivo php.ini encontrado: $PHP_INI"
    echo "   Para aplicar los cambios permanentemente, edita este archivo y configura:"
    echo "   upload_max_filesize = 500M"
    echo "   post_max_size = 500M"
    echo "   max_execution_time = 300"
    echo "   memory_limit = 512M"
else
    echo "⚠️  No se encontró php.ini. Los límites se aplicarán solo en tiempo de ejecución."
fi

# 4. Buscar configuración de PHP-FPM
echo ""
echo "🔍 Buscando configuración de PHP-FPM..."
FPM_CONF=$(find /etc -name "www.conf" -path "*/php*/*" 2>/dev/null | head -1)
if [ -n "$FPM_CONF" ]; then
    echo "✅ Archivo PHP-FPM encontrado: $FPM_CONF"
    echo "   Verifica que tenga:"
    echo "   php_admin_value[upload_max_filesize] = 500M"
    echo "   php_admin_value[post_max_size] = 500M"
else
    echo "⚠️  No se encontró configuración de PHP-FPM"
fi

# 5. Reiniciar servicios
echo ""
echo "🔄 Para aplicar los cambios, ejecuta:"
echo "   sudo nginx -t && sudo systemctl reload nginx"
if systemctl is-active --quiet php*-fpm 2>/dev/null; then
    echo "   sudo systemctl restart php*-fpm"
fi

echo ""
echo "✅ Script completado!"
echo ""
echo "📋 Resumen de cambios aplicados:"
echo "   - Nginx: client_max_body_size = 500M"
echo "   - Nginx: timeouts aumentados a 300s"
echo "   - PHP: límites configurados en el código (se aplican en tiempo de ejecución)"
echo ""
echo "⚠️  IMPORTANTE: Para cambios permanentes, edita los archivos de configuración de PHP mencionados arriba"


