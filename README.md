# Ligando - Plataforma de Video Chat

Ligando es una plataforma de video chat en tiempo real que permite a usuarios conectarse mediante videollamadas, chat privado, y un sistema de regalos. La plataforma está diseñada para modelos y clientes, con un sistema completo de monedas, pagos y ganancias.

## 🚀 Stack Tecnológico

### Frontend
- **React 18.2** - Framework de UI
- **Vite 5.4** - Build tool y dev server
- **React Router DOM 6.28** - Enrutamiento
- **Tailwind CSS 3.3** - Estilos
- **LiveKit 2.15** - Video chat en tiempo real
- **Axios 1.10** - Cliente HTTP
- **React i18next 15.6** - Internacionalización (8 idiomas)
- **Stripe** - Procesamiento de pagos
- **Framer Motion** - Animaciones

### Backend
- **Laravel 8.75** - Framework PHP
- **Laravel Sanctum** - Autenticación API
- **MySQL** - Base de datos
- **Redis** - Cache y notificaciones SSE
- **LiveKit Server** - Servidor de video chat
- **Stripe PHP** - Integración de pagos
- **ePayco** - Pasarela de pagos (Colombia)

## 📋 Requisitos Previos

- PHP 8.0 o superior
- Composer 2.x
- Node.js 18.x o superior
- npm o yarn
- MySQL 5.7+ o MariaDB 10.3+
- Redis 6.0+
- LiveKit Server (para video chat)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd ligando
```

### 2. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Configurar `.env` con:
- `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `STRIPE_KEY`, `STRIPE_SECRET`
- `EPAYCO_PUBLIC_KEY`, `EPAYCO_PRIVATE_KEY`

```bash
php artisan migrate
php artisan db:seed  # Opcional
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Configurar `.env` con:
- `VITE_API_BASE_URL` - URL del backend
- `VITE_SENTRY_DSN` - (Opcional) DSN de Sentry para error tracking

```bash
npm run dev  # Desarrollo
npm run build  # Producción
```

## 🏃 Desarrollo

### Backend

```bash
cd backend
php artisan serve  # Servidor en http://localhost:8000
php artisan queue:work  # Si usas colas
php artisan schedule:work  # Para tareas programadas
```

### Frontend

```bash
cd frontend
npm run dev  # Servidor en http://localhost:5173
```

## 📁 Estructura del Proyecto

```
ligando/
├── backend/              # API Laravel
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/  # Controladores
│   │   │   └── Middleware/    # Middlewares
│   │   └── Models/            # Modelos Eloquent
│   ├── database/
│   │   ├── migrations/        # Migraciones
│   │   └── seeders/           # Seeders
│   ├── routes/
│   │   └── api.php            # Rutas API
│   └── config/                # Configuración
│
├── frontend/             # Aplicación React
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   ├── routes/            # Configuración de rutas
│   │   ├── utils/             # Utilidades
│   │   ├── api/               # Cliente API
│   │   └── i18n/              # Traducciones
│   └── public/                # Archivos estáticos
│
└── docs/                 # Documentación
    ├── API.md            # Documentación de API
    └── DEVELOPMENT.md     # Guía de desarrollo
```

## 🔐 Autenticación

La aplicación usa **Laravel Sanctum** para autenticación basada en tokens. Los tokens se almacenan en `localStorage` en el frontend.

### Flujos de Autenticación

1. **Registro**: Email + contraseña o Google OAuth
2. **Verificación**: Código enviado por email
3. **Login**: Email + contraseña o Google OAuth
4. **Sesión única**: Solo una sesión activa por usuario

## 💰 Sistema de Monedas

- **Monedas compradas**: Adquiridas mediante pagos
- **Monedas de regalo**: Recibidas como regalos
- **Consumo**: 10 monedas por minuto de video chat
- **Mínimo requerido**: 30 monedas para iniciar una llamada

## 📞 Video Chat

- **Tecnología**: LiveKit
- **Características**:
  - Video y audio en tiempo real
  - Controles de media (mute, video on/off)
  - Consumo automático de monedas
  - Historial de llamadas

## 🎁 Sistema de Regalos

- Modelos pueden recibir regalos de clientes
- Los regalos se convierten en monedas
- Sistema de seguridad anti-fraude

## 📊 Ganancias

- Modelos ganan por tiempo de video chat
- Cálculo automático de ganancias
- Historial de pagos
- Proceso semanal de pagos

## 🌍 Internacionalización

Soporte para 8 idiomas:
- Español (es)
- Inglés (en)
- Portugués (pt)
- Francés (fr)
- Alemán (de)
- Turco (tr)
- Italiano (it)
- Ruso (ru)
- Hindi (hi)

## 🛠️ Comandos Útiles

### Backend

```bash
# Backup de base de datos
php artisan db:backup --compress

# Limpiar usuarios no verificados
php artisan users:clean-unverified

# Procesar consumo de video chat
php artisan videochat:process-consumption

# Procesar pagos semanales
php artisan payments:process-weekly
```

### Frontend

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Preview de producción
npm run preview
```

## 🔒 Seguridad

- **Security Headers**: CSP, HSTS, X-Frame-Options, etc.
- **Rate Limiting**: Protección contra abuso
- **Single Session**: Una sesión activa por usuario
- **Input Validation**: Validación estricta de inputs
- **Error Tracking**: Integración con Sentry (opcional)

## 📝 Variables de Entorno

Ver `.env.example` en cada directorio para la lista completa de variables requeridas.

## 🧪 Testing

```bash
# Backend
cd backend
php artisan test

# Frontend
cd frontend
npm test  # Si está configurado
```

## 📚 Documentación Adicional

- [API Documentation](docs/API.md)
- [Development Guide](docs/DEVELOPMENT.md)

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y propietario.

## 🆘 Soporte

Para soporte, contacta al equipo de desarrollo.

---

**Nota**: Este README es una versión básica. Para información detallada, consulta la documentación en `docs/`.

