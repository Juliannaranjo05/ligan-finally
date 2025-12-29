# 🔍 ANÁLISIS COMPLETO: Problema de Deducción de Monedas en Videollamadas

## 📋 RESUMEN DEL PROBLEMA

**Síntoma**: Cuando el cliente cuelga una videollamada alrededor de 1:05 minutos, se descontaron **20 monedas** (2 minutos) en lugar de **10 monedas** (1 minuto).

**Evidencia de la BD**:
- Se registran 2 consumos de 10 monedas cada uno con 7-15 segundos de diferencia
- Ejemplo: `21:19:38` (10 monedas) y `21:19:53` (10 monedas) = 20 monedas totales
- Ambos consumos tienen `session_id` tipo `periodic_*`, lo que indica que ambos vienen del sistema de descuento periódico

## 🔎 CAUSA RAÍZ IDENTIFICADA

### Problema Principal: **NO se crea VideoChatSession al iniciar la videollamada**

1. **Flujo Actual**:
   - Cuando se inicia una videollamada, solo se crea `ChatSession` (tabla `chat_sessions`)
   - **NO se crea** `VideoChatSession` (tabla `video_chat_sessions`) con `is_consuming = true` y `started_at`
   - El sistema de descuento periódico del frontend funciona correctamente y registra consumos en `CoinConsumption`
   - Cuando se cuelga, `endCoinSession` busca `VideoChatSession` pero no la encuentra

2. **Lógica de Respaldo (Actual)**:
   - Si no encuentra `VideoChatSession`, busca el último consumo en `CoinConsumption`
   - Si el último consumo fue hace menos de 60 segundos, debería saltar el consumo final
   - **PERO**: Parece que hay un problema de timing o la lógica no se está ejecutando correctamente

3. **Dónde se crea VideoChatSession**:
   - Solo se crea en `SessionEarningsController` cuando se procesan ganancias (después de que termina la llamada)
   - **NO se crea** cuando se inicia la videollamada

## 📊 FLUJO ACTUAL DETALLADO

### 1. Inicio de Videollamada
```
Frontend (videochatclient.jsx):
  - Llama a /api/livekit/token-secure (generateToken)
  - Inicia sistema de descuento periódico cada 60 segundos
  - NO crea VideoChatSession

Backend (LiveKitController::generateToken):
  - Verifica saldo
  - Genera token JWT
  - NO crea VideoChatSession
```

### 2. Descuento Periódico (Cada 60 segundos)
```
Frontend (videochatclient.jsx):
  - Cada 60 segundos llama a /api/livekit/periodic-deduction
  - Envía: room_name, session_duration_seconds: 60, manual_coins_amount: 10

Backend (LiveKitController::processPeriodicDeduction):
  - Llama a VideoChatCoinController::processConsumption
  - Crea registro en CoinConsumption (10 monedas)
  - Actualiza UserCoins.purchased_balance
  - Intenta actualizar VideoChatSession.last_consumption_at pero NO EXISTE
```

### 3. Cuelga la Llamada (Alrededor de 1:05)
```
Frontend (videochatclient.jsx):
  - Llama a /api/livekit/end-coin-session
  - Envía: room_name

Backend (LiveKitController::endCoinSession):
  - Busca VideoChatSession: NO EXISTE ❌
  - Entra en lógica de respaldo:
    - Busca último consumo en CoinConsumption
    - Encuentra consumo a los 60 segundos (hace ~5 segundos)
    - Debería saltar consumo final (porque < 60 segundos)
    - PERO: Parece que se está procesando otro consumo de todas formas
```

## 🐛 POSIBLES CAUSAS DEL DOBLE DESCUENTO

### Hipótesis 1: Timing Race Condition
- El frontend puede estar llamando a `endCoinSession` ANTES de que se complete el último descuento periódico
- O viceversa: el último descuento periódico se ejecuta DESPUÉS de que se cuelga

### Hipótesis 2: Lógica de Respaldo No Funciona
- La verificación `if ($secondsSinceLastConsumption < 60)` no se está ejecutando correctamente
- O hay otro lugar donde se está procesando un consumo adicional

### Hipótesis 3: Frontend Llama Dos Veces
- El frontend puede estar llamando a `endCoinSession` dos veces
- O llamando tanto a `endCoinSession` como a `processPeriodicDeduction` casi simultáneamente

## 🔧 SOLUCIONES PROPUESTAS

### Solución 1: Crear VideoChatSession al Iniciar Videollamada (RECOMENDADA)

**Ubicación**: `LiveKitController::generateToken` o crear nuevo endpoint

**Código a agregar**:
```php
// Después de verificar saldo y antes de generar token
if ($user && $user->rol === 'cliente') {
    // Crear o actualizar VideoChatSession
    VideoChatSession::updateOrCreate(
        [
            'user_id' => $user->id,
            'room_name' => $roomName,
            'status' => 'active'
        ],
        [
            'user_role' => 'cliente',
            'is_consuming' => true,
            'consumption_rate' => 10.00,
            'started_at' => now(),
            'last_consumption_at' => now()
        ]
    );
}
```

**Ventajas**:
- Permite que `endCoinSession` encuentre la sesión correctamente
- Permite calcular correctamente el tiempo transcurrido
- Permite actualizar `last_consumption_at` en cada descuento periódico

### Solución 2: Mejorar Lógica de Respaldo en endCoinSession

**Problema actual**: La lógica de respaldo busca el último consumo pero puede haber un problema de timing.

**Mejora**:
```php
// En endCoinSession, cuando no encuentra VideoChatSession:
$lastConsumption = CoinConsumption::where('user_id', $user->id)
    ->where('room_name', $roomName)
    ->orderBy('consumed_at', 'desc')
    ->first();

if ($lastConsumption) {
    $secondsSinceLastConsumption = now()->diffInSeconds($lastConsumption->consumed_at);
    
    // 🔥 MEJORADO: Si el último consumo fue hace menos de 90 segundos, NO cobrar nada adicional
    // Esto da un margen de seguridad para evitar race conditions
    if ($secondsSinceLastConsumption < 90) {
        Log::info('⏭️ Saltando consumo final - consumo muy reciente', [
            'seconds_since_last' => $secondsSinceLastConsumption,
            'threshold' => 90
        ]);
        return response()->json(['success' => true]);
    }
}
```

### Solución 3: Agregar Lock/Prevención de Doble Procesamiento

**Problema**: Múltiples llamadas simultáneas pueden procesar el mismo consumo.

**Solución**: Usar cache lock para prevenir procesamiento simultáneo:
```php
$lockKey = "end_coin_session_{$user->id}_{$roomName}";
$lock = Cache::lock($lockKey, 10); // 10 segundos de lock

if ($lock->get()) {
    try {
        // Procesar consumo final
    } finally {
        $lock->release();
    }
}
```

## 📝 ARCHIVOS A MODIFICAR

1. **`backend/app/Http/Controllers/LiveKitController.php`**:
   - Método `generateToken`: Agregar creación de `VideoChatSession`
   - Método `endCoinSession`: Mejorar lógica de respaldo y agregar lock

2. **`backend/app/Http/Controllers/VideoChatCoinController.php`**:
   - Método `processConsumption`: Asegurar que actualiza `VideoChatSession.last_consumption_at` correctamente

3. **`frontend/src/components/client/videochatclient.jsx`**:
   - Verificar que no se llama a `endCoinSession` múltiples veces
   - Agregar prevención de llamadas simultáneas

## 🧪 PRUEBAS A REALIZAR

1. **Prueba 1**: Cuelga a los 65 segundos
   - Esperado: 10 monedas (1 minuto)
   - Verificar: Solo 1 consumo en `CoinConsumption`

2. **Prueba 2**: Cuelga a los 95 segundos
   - Esperado: 10 monedas (1 minuto, redondeado hacia abajo)
   - Verificar: Solo 1 consumo en `CoinConsumption`

3. **Prueba 3**: Cuelga a los 125 segundos
   - Esperado: 20 monedas (2 minutos, redondeado hacia arriba después de 1:30)
   - Verificar: 2 consumos en `CoinConsumption` (60s y 120s)

## 📊 LOGS A REVISAR

Después de implementar las soluciones, revisar:
```bash
tail -2000 storage/logs/laravel.log | grep -E "\[DEBUG\]|endCoinSession|processPeriodicDeduction|processConsumption" | tail -100
```

Buscar específicamente:
- `endCoinSession INICIADO`
- `Sesión encontrada` (debe ser `true` después de la solución)
- `SALTANDO consumo final` (si aplica)
- `Procesando consumo final` (si aplica)

## 🎯 PRIORIDAD DE IMPLEMENTACIÓN

1. **ALTA**: Crear `VideoChatSession` al iniciar videollamada (Solución 1)
2. **MEDIA**: Agregar lock para prevenir doble procesamiento (Solución 3)
3. **BAJA**: Mejorar lógica de respaldo (Solución 2) - Solo si Solución 1 no funciona

## 📌 NOTAS ADICIONALES

- El sistema de descuento periódico del frontend funciona correctamente
- Los consumos se registran correctamente en `CoinConsumption`
- El problema está en la falta de `VideoChatSession` y posiblemente en race conditions
- Los logs de depuración están agregados pero no aparecen porque probablemente `endCoinSession` no se está ejecutando o se ejecuta antes de que se complete el último descuento periódico








