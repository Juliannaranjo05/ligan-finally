# Documentación de API - Ligando

## Base URL

```
https://ligando.duckdns.org/api
```

## Autenticación

La mayoría de los endpoints requieren autenticación mediante Bearer Token:

```
Authorization: Bearer {token}
```

El token se obtiene mediante los endpoints de autenticación y se almacena en `localStorage`.

## Endpoints Principales

### Autenticación

#### POST `/login`
Iniciar sesión con email y contraseña.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "1|xxxxxxxxxxxx",
  "user": {
    "id": 1,
    "name": "Usuario",
    "email": "user@example.com",
    "rol": "cliente"
  }
}
```

#### POST `/register`
Registrar nuevo usuario.

**Body:**
```json
{
  "name": "Usuario",
  "email": "user@example.com",
  "password": "password123",
  "password_confirmation": "password123",
  "rol": "cliente"
}
```

#### POST `/logout`
Cerrar sesión (requiere autenticación).

### Video Chat

#### POST `/calls/start`
Iniciar una videollamada.

**Body:**
```json
{
  "receiver_id": 2,
  "call_type": "video"
}
```

**Response:**
```json
{
  "success": true,
  "call_id": 123,
  "room_name": "room_abc123"
}
```

#### POST `/calls/status`
Verificar estado de una llamada.

**Body:**
```json
{
  "call_id": 123
}
```

#### POST `/calls/cancel`
Cancelar una llamada.

**Body:**
```json
{
  "call_id": 123
}
```

### Monedas y Balance

#### GET `/videochat/coins/balance`
Obtener balance del usuario actual.

**Response:**
```json
{
  "success": true,
  "balance": {
    "purchased_coins": 100,
    "gift_coins": 50,
    "total_coins": 150,
    "minutes_available": 15,
    "cost_per_minute": 10,
    "minimum_required": 30
  },
  "can_start_call": true
}
```

#### POST `/videochat/coins/check-client-balance`
Verificar balance de un cliente (solo modelos).

**Body:**
```json
{
  "client_id": 5
}
```

### Chat

#### GET `/chat/conversations`
Obtener lista de conversaciones.

#### GET `/chat/messages/{conversationId}`
Obtener mensajes de una conversación.

#### POST `/chat/send`
Enviar un mensaje.

**Body:**
```json
{
  "receiver_id": 2,
  "message": "Hola!"
}
```

### Regalos

#### GET `/gifts/available`
Obtener regalos disponibles.

#### POST `/gifts/request`
Solicitar enviar un regalo.

**Body:**
```json
{
  "receiver_id": 2,
  "gift_id": 5,
  "message": "Feliz cumpleaños!"
}
```

### Historias

#### GET `/stories/active`
Obtener historias activas.

#### POST `/stories/{id}/like`
Dar like a una historia.

#### POST `/stories/{id}/unlike`
Quitar like de una historia.

### Ganancias (Modelos)

#### GET `/earnings/weekly`
Obtener ganancias semanales.

#### GET `/earnings/pending-payments`
Obtener pagos pendientes.

#### GET `/earnings/payment-history`
Obtener historial de pagos.

## Códigos de Error

- `200` - Éxito
- `400` - Bad Request (datos inválidos)
- `401` - No autenticado
- `403` - No autorizado
- `404` - No encontrado
- `409` - Conflicto (ej: sesión duplicada)
- `422` - Validación fallida
- `429` - Rate limit excedido
- `500` - Error del servidor

## Rate Limiting

Algunos endpoints tienen rate limiting:
- Rutas públicas: 20 req/min
- Operaciones críticas: 30 req/min
- Operaciones normales: 100 req/min
- Operaciones frecuentes: 500 req/min

## Middleware

- `auth:sanctum` - Requiere autenticación
- `single.session` - Sesión única
- `throttle` - Rate limiting
- `admin` - Solo administradores

## Notas

- Todos los timestamps están en formato ISO 8601
- Las respuestas de error incluyen `message` y opcionalmente `errors` para validación
- Los tokens expiran después de un período de inactividad

