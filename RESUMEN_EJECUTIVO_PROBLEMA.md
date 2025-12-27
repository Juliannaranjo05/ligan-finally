# RESUMEN EJECUTIVO: Problema de Deducción Doble de Monedas

## PROBLEMA
Al colgar una videollamada alrededor de 1:05 minutos, se descontaron **20 monedas** (2 minutos) en lugar de **10 monedas** (1 minuto).

## EVIDENCIA
- BD muestra 2 consumos de 10 monedas con 7-15 segundos de diferencia
- Ambos tienen `session_id` tipo `periodic_*` (descuento periódico)
- NO existe registro en `video_chat_sessions` cuando se inicia la videollamada

## CAUSA RAÍZ
**NO se crea `VideoChatSession` al iniciar la videollamada**. Solo se crea `ChatSession`. Cuando se cuelga, `endCoinSession` no encuentra la sesión y entra en lógica de respaldo que debería saltar el consumo final si pasaron < 60 segundos, pero parece haber un race condition o la lógica no funciona correctamente.

## FLUJO ACTUAL
1. Inicio: Solo se crea `ChatSession`, NO `VideoChatSession`
2. Cada 60s: Frontend llama `processPeriodicDeduction` → Crea `CoinConsumption` (10 monedas)
3. Al colgar: Frontend llama `endCoinSession` → Busca `VideoChatSession` → NO EXISTE → Busca último consumo → Debería saltar pero parece procesar otro consumo

## SOLUCIÓN PRINCIPAL
**Crear `VideoChatSession` al iniciar videollamada** en `LiveKitController::generateToken`:

```php
// Después de verificar saldo, antes de generar token
if ($user && $user->rol === 'cliente') {
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

## ARCHIVOS CLAVE
- `backend/app/Http/Controllers/LiveKitController.php` - `generateToken()` y `endCoinSession()`
- `backend/app/Http/Controllers/VideoChatCoinController.php` - `processConsumption()`
- `frontend/src/components/client/videochatclient.jsx` - Sistema de descuento periódico

## LOGS
Los logs de depuración están agregados pero no aparecen porque probablemente `endCoinSession` se ejecuta antes de que se complete el último descuento periódico, o hay un race condition.

## PRÓXIMOS PASOS
1. Implementar creación de `VideoChatSession` en `generateToken`
2. Agregar lock para prevenir doble procesamiento en `endCoinSession`
3. Verificar que `processConsumption` actualiza `VideoChatSession.last_consumption_at` correctamente








