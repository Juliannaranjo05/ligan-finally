# Guía de Desarrollo - Ligando

## Convenciones de Código

### Frontend (React)

- **Componentes**: PascalCase (`HomeCliente.jsx`)
- **Hooks**: camelCase con prefijo `use` (`usePageAccess.jsx`)
- **Utilidades**: camelCase (`logger.js`, `api.js`)
- **Constantes**: UPPER_SNAKE_CASE

### Backend (Laravel)

- **Controladores**: PascalCase (`VideoChatCoinController.php`)
- **Modelos**: PascalCase singular (`User.php`)
- **Middleware**: PascalCase (`SecurityHeaders.php`)
- **Migrations**: snake_case con timestamp

## Estructura de Componentes React

```jsx
import React, { useState, useEffect } from 'react';x
import { useTranslation } from 'react-i18next';
import { createLogger } from '../utils/logger';

const logger = createLogger('ComponentName');

export default function ComponentName() {
  const { t } = useTranslation();
  const [state, setState] = useState(null);

  useEffect(() => {
    // Lógica de efecto
  }, []);

  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

## Logging

### Frontend

Usar el sistema de logging estructurado:

```javascript
import { createLogger } from '../utils/logger';

const logger = createLogger('ComponentName');

logger.debug('Mensaje de debug', { data });
logger.info('Información', { data });
logger.warn('Advertencia', { data });
logger.error('Error', error);
```

**Niveles de log:**
- `DEBUG`: Desarrollo (solo en dev)
- `INFO`: Información general
- `WARN`: Advertencias
- `ERROR`: Errores (siempre se registran)

### Backend

Usar Laravel Log:

```php
use Illuminate\Support\Facades\Log;

Log::debug('Mensaje de debug', ['data' => $data]);
Log::info('Información', ['data' => $data]);
Log::warning('Advertencia', ['data' => $data]);
Log::error('Error', ['error' => $e->getMessage()]);
```

## Internacionalización

### Agregar nuevas traducciones

1. Agregar la clave en todos los archivos de idioma:
   - `frontend/src/i18n/locales/es.json`
   - `frontend/src/i18n/locales/en.json`
   - etc.

2. Usar en componentes:

```jsx
const { t } = useTranslation();
return <div>{t('mi.clave.traduccion')}</div>;
```

### Estructura de claves

Usar estructura jerárquica:
```json
{
  "seccion": {
    "subseccion": {
      "clave": "Valor traducido"
    }
  }
}
```

## Manejo de Errores

### Frontend

```javascript
try {
  // Código
} catch (error) {
  logger.error('Descripción del error', error);
  // Mostrar mensaje al usuario
}
```

### Backend

```php
try {
    // Código
} catch (\Exception $e) {
    Log::error('Descripción del error', [
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
    
    return response()->json([
        'success' => false,
        'error' => 'Mensaje amigable para el usuario'
    ], 500);
}
```

## Base de Datos

### Migraciones

```bash
php artisan make:migration create_nombre_tabla
php artisan migrate
php artisan migrate:rollback
```

### Modelos

```php
use Illuminate\Database\Eloquent\Model;

class MiModelo extends Model
{
    protected $fillable = ['campo1', 'campo2'];
    
    // Relaciones
    public function relacion() {
        return $this->hasMany(OtroModelo::class);
    }
}
```

## Testing

### Backend

```bash
php artisan test
php artisan test --filter NombreTest
```

### Frontend

```bash
npm test  # Si está configurado
```

## Git Workflow

1. **Ramas**:
   - `main` - Producción
   - `develop` - Desarrollo
   - `feature/nombre` - Nuevas features
   - `fix/nombre` - Correcciones

2. **Commits**:
   - Usar mensajes descriptivos
   - Prefijos: `feat:`, `fix:`, `docs:`, `refactor:`

3. **Pull Requests**:
   - Describir cambios
   - Incluir screenshots si aplica
   - Revisar antes de mergear

## Performance

### Frontend

- Usar `React.memo` para componentes pesados
- Lazy loading de rutas
- Optimizar imágenes
- Code splitting

### Backend

- Eager loading para evitar N+1 queries
- Cache de queries frecuentes
- Índices en columnas de búsqueda
- Paginación en listados

## Seguridad

- **Nunca** commitear `.env` o credenciales
- Validar todos los inputs
- Usar prepared statements (Eloquent ya lo hace)
- Sanitizar datos de usuario
- Rate limiting en endpoints sensibles

## Deployment

Ver `deploy.sh` para el proceso de deployment automatizado.

### Checklist Pre-Deployment

- [ ] Tests pasando
- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas
- [ ] Build de frontend generado
- [ ] Backups configurados
- [ ] Logs monitoreados

## Debugging

### Frontend

- React DevTools
- Redux DevTools (si aplica)
- Network tab del navegador
- Console logs (usar logger, no console.log)

### Backend

- Laravel Debugbar (solo en desarrollo)
- Logs en `storage/logs/laravel.log`
- `php artisan tinker` para debugging interactivo

## Recursos

- [Laravel Docs](https://laravel.com/docs)
- [React Docs](https://react.dev)
- [LiveKit Docs](https://docs.livekit.io)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

