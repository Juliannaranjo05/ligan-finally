#!/bin/bash
# Script para configurar límites de PHP para videos de alta calidad

echo "🔧 Configurando límites de PHP para videos de alta calidad..."
echo ""

# Encontrar versiones de PHP instaladas
PHP_VERSIONS=$(ls -d /etc/php/*/fpm 2>/dev/null | sed 's|/etc/php/||' | sed 's|/fpm||' | tr '\n' ' ')

if [ -z "$PHP_VERSIONS" ]; then
    echo "⚠️  No se encontraron versiones de PHP-FPM instaladas"
    echo "   Buscando php.ini de CLI..."
    PHP_CLI_INI=$(php --ini | grep "Loaded Configuration File" | awk '{print $4}')
    if [ -n "$PHP_CLI_INI" ] && [ -f "$PHP_CLI_INI" ]; then
        echo "   Archivo encontrado: $PHP_CLI_INI"
        echo ""
        echo "📝 Para editar manualmente, ejecuta:"
        echo "   sudo nano $PHP_CLI_INI"
        echo ""
        echo "   Busca y cambia:"
        echo "   upload_max_filesize = 500M"
        echo "   post_max_size = 500M"
        exit 0
    fi
else
    echo "✅ Versiones de PHP encontradas: $PHP_VERSIONS"
    echo ""
    
    for VERSION in $PHP_VERSIONS; do
        echo "📝 Configurando PHP $VERSION..."
        
        # Archivo php.ini principal
        PHP_INI="/etc/php/$VERSION/fpm/php.ini"
        if [ -f "$PHP_INI" ]; then
            echo "   Archivo: $PHP_INI"
            
            # Backup
            sudo cp "$PHP_INI" "${PHP_INI}.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Actualizar límites
            sudo sed -i 's/^upload_max_filesize =.*/upload_max_filesize = 500M/' "$PHP_INI"
            sudo sed -i 's/^post_max_size =.*/post_max_size = 500M/' "$PHP_INI"
            sudo sed -i 's/^max_execution_time =.*/max_execution_time = 300/' "$PHP_INI"
            sudo sed -i 's/^memory_limit =.*/memory_limit = 512M/' "$PHP_INI"
            sudo sed -i 's/^max_input_time =.*/max_input_time = 300/' "$PHP_INI"
            
            echo "   ✅ php.ini actualizado"
        fi
        
        # Archivo de pool PHP-FPM
        POOL_CONF="/etc/php/$VERSION/fpm/pool.d/www.conf"
        if [ -f "$POOL_CONF" ]; then
            echo "   Archivo pool: $POOL_CONF"
            
            # Backup
            sudo cp "$POOL_CONF" "${POOL_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Agregar o actualizar límites en pool
            if grep -q "php_admin_value\[upload_max_filesize\]" "$POOL_CONF"; then
                sudo sed -i 's|php_admin_value\[upload_max_filesize\].*|php_admin_value[upload_max_filesize] = 500M|' "$POOL_CONF"
            else
                echo "; Upload limits for videos" | sudo tee -a "$POOL_CONF"
                echo "php_admin_value[upload_max_filesize] = 500M" | sudo tee -a "$POOL_CONF"
            fi
            
            if grep -q "php_admin_value\[post_max_size\]" "$POOL_CONF"; then
                sudo sed -i 's|php_admin_value\[post_max_size\].*|php_admin_value[post_max_size] = 500M|' "$POOL_CONF"
            else
                echo "php_admin_value[post_max_size] = 500M" | sudo tee -a "$POOL_CONF"
            fi
            
            echo "   ✅ pool.d/www.conf actualizado"
        fi
        
        # Reiniciar PHP-FPM
        echo "   🔄 Reiniciando PHP-FPM..."
        sudo systemctl restart "php${VERSION}-fpm" 2>/dev/null || sudo service "php${VERSION}-fpm" restart 2>/dev/null
        
        echo ""
    done
fi

echo "✅ Configuración completada!"
echo ""
echo "📋 Verificar los límites:"
php -r "echo 'upload_max_filesize: ' . ini_get('upload_max_filesize') . PHP_EOL; echo 'post_max_size: ' . ini_get('post_max_size') . PHP_EOL;"
echo ""
echo "⚠️  IMPORTANTE: Los cambios se aplicarán después de reiniciar PHP-FPM."
echo "   Si el comando anterior no reinició PHP-FPM, ejecuta manualmente:"
echo "   sudo systemctl restart php*-fpm"

