# ⚠️ URGENTE: Configurar Límites de PHP para Videos

## 🔴 PROBLEMA ACTUAL

Los límites actuales de PHP son:
- `upload_max_filesize`: 2M (MUY BAJO)
- `post_max_size`: 8M (MUY BAJO)

**Estos límites NO se pueden cambiar con `ini_set()` en tiempo de ejecución.**

## ✅ SOLUCIÓN INMEDIATA

### Paso 1: Encontrar php.ini

```bash
php --ini
```

Busca la línea que dice "Loaded Configuration File".

### Paso 2: Editar php.ini

Edita el archivo encontrado (por ejemplo: `/etc/php/8.1/fpm/php.ini`):

```bash
sudo nano /etc/php/8.1/fpm/php.ini
```

Busca y cambia estas líneas:

```ini
upload_max_filesize = 500M
post_max_size = 500M
max_execution_time = 300
memory_limit = 512M
max_input_time = 300
```

### Paso 3: Si usas PHP-FPM

También edita el archivo del pool (generalmente `/etc/php/8.1/fpm/pool.d/www.conf`):

```bash
sudo nano /etc/php/8.1/fpm/pool.d/www.conf
```

Agrega o modifica:

```ini
php_admin_value[upload_max_filesize] = 500M
php_admin_value[post_max_size] = 500M
php_admin_value[max_execution_time] = 300
php_admin_value[memory_limit] = 512M
```

### Paso 4: Reiniciar PHP-FPM

```bash
sudo systemctl restart php8.1-fpm
# O la versión que uses
sudo systemctl restart php*-fpm
```

### Paso 5: Verificar

```bash
php -r "echo 'upload_max_filesize: ' . ini_get('upload_max_filesize') . PHP_EOL; echo 'post_max_size: ' . ini_get('post_max_size') . PHP_EOL;"
```

Debería mostrar `500M` para ambos.

## 📝 NOTA

Mientras no configures estos límites en php.ini, **los videos no se podrán subir** porque PHP rechaza la petición antes de que llegue al código de Laravel.


