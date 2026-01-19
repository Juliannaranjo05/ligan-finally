# Configuración de Límites de PHP para Videos de Alta Calidad

## ⚠️ IMPORTANTE

Los límites `upload_max_filesize` y `post_max_size` **NO se pueden cambiar con `ini_set()`** en tiempo de ejecución. 
Deben configurarse en el archivo `php.ini` o en la configuración de PHP-FPM.

## Pasos para Configurar

### 1. Encontrar el archivo php.ini

```bash
php --ini
```

Busca la línea "Loaded Configuration File" para encontrar la ruta del archivo.

### 2. Editar php.ini

Edita el archivo encontrado y configura:

```ini
upload_max_filesize = 500M
post_max_size = 500M
max_execution_time = 300
memory_limit = 512M
max_input_time = 300
```

### 3. Si usas PHP-FPM

Si estás usando PHP-FPM, también necesitas editar el archivo de configuración del pool (generalmente en `/etc/php/*/fpm/pool.d/www.conf`):

```ini
php_admin_value[upload_max_filesize] = 500M
php_admin_value[post_max_size] = 500M
php_admin_value[max_execution_time] = 300
php_admin_value[memory_limit] = 512M
php_admin_value[max_input_time] = 300
```

### 4. Reiniciar PHP-FPM

```bash
sudo systemctl restart php*-fpm
# o
sudo service php*-fpm restart
```

### 5. Verificar los cambios

```bash
php -r "echo 'upload_max_filesize: ' . ini_get('upload_max_filesize') . PHP_EOL; echo 'post_max_size: ' . ini_get('post_max_size') . PHP_EOL;"
```

## Nota sobre Nginx

Ya configuramos nginx con:
- `client_max_body_size 500M;`
- Timeouts aumentados a 300s

Recuerda recargar nginx después de los cambios:
```bash
sudo nginx -t && sudo systemctl reload nginx
```


