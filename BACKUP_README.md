# Guía de Backup y Restauración

Este proyecto incluye scripts para hacer backup y restaurar el proyecto completo.

## Scripts Disponibles

### 1. `backup.sh` - Crear Backup

Crea un backup completo del proyecto en formato `.tar.gz` excluyendo archivos innecesarios.

**Uso:**
```bash
./backup.sh
```

**Qué incluye el backup:**
- Todo el código fuente (frontend, backend, docs, html)
- Archivos de configuración
- Documentación
- Estructura completa del proyecto

**Qué excluye el backup:**
- `node_modules` (dependencias de Node.js)
- `vendor` (dependencias de Composer)
- `dist` (archivos compilados)
- `.git` (repositorio git)
- Logs
- Archivos temporales
- Archivos de editor (.vscode, .idea, etc.)
- Archivos `.env` (por seguridad)

**Ubicación de los backups:**
Los backups se guardan en: `/root/ligando/backups/`

**Formato del nombre:**
`ligando_backup_YYYYMMDD_HHMMSS.tar.gz`

### 2. `restore_backup.sh` - Restaurar Backup

Restaura un backup previamente creado.

**Uso:**
```bash
./restore_backup.sh
```

El script te mostrará una lista de backups disponibles y te pedirá:
1. Seleccionar qué backup restaurar
2. Especificar dónde restaurarlo (por defecto: `/root/ligando_restored`)

## Ejemplos de Uso

### Crear un backup ahora:
```bash
cd /root/ligando
./backup.sh
```

### Ver backups disponibles:
```bash
ls -lh /root/ligando/backups/
```

### Restaurar un backup manualmente:
```bash
# Restaurar en un directorio específico
tar -xzf /root/ligando/backups/ligando_backup_20240101_120000.tar.gz -C /ruta/destino
```

### Programar backups automáticos (cron):

Para hacer backups automáticos diarios a las 2 AM:
```bash
# Editar crontab
crontab -e

# Agregar esta línea:
0 2 * * * /root/ligando/backup.sh
```

Para backups cada 6 horas:
```bash
0 */6 * * * /root/ligando/backup.sh
```

## Tamaño de Backups

Los backups típicamente ocupan entre 10-50 MB (dependiendo del tamaño del código y documentación), ya que excluyen `node_modules` y `vendor` que pueden ser muy grandes.

## Notas Importantes

1. **Archivos .env**: Los archivos `.env` no se incluyen en el backup por seguridad. Asegúrate de guardarlos por separado si son necesarios.

2. **Base de datos**: Este script NO hace backup de la base de datos. Si necesitas respaldar la base de datos, usa herramientas específicas como `mysqldump` o `pg_dump`.

3. **Espacio en disco**: Asegúrate de tener suficiente espacio en disco antes de crear backups.

4. **Restauración**: Al restaurar, el script crea un nuevo directorio para no sobrescribir el proyecto actual.

## Limpieza de Backups Antiguos

Para eliminar backups más antiguos que 30 días:
```bash
find /root/ligando/backups/ -name "*.tar.gz" -mtime +30 -delete
```










