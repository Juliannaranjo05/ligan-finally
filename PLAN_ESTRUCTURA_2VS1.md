# Plan Completo: Sistema de Agregar Modelos Dinámicamente (1vs1 → 2vs1)

## Concepto General

Sistema que permite agregar un segundo modelo durante una llamada activa o iniciar directamente con 2 modelos. NO es un tipo de llamada fijo, sino participantes dinámicos que se pueden agregar en cualquier momento.

---

## Flujos de Usuario

### Flujo A: Agregar modelo durante llamada
1. Cliente inicia llamada 1vs1 con Modelo 1
2. Modelo 1 recibe notificación y acepta
3. Llamada se activa (1vs1)
4. Cliente hace clic en botón "Agregar Modelo"
5. Cliente selecciona Modelo 2 de una lista
6. Backend envía invitación a Modelo 2
7. Modelo 2 recibe notificación especial
8. Modelo 2 acepta → Se une a la llamada existente (2vs1)
9. Modelo 2 rechaza → Llamada continúa como 1vs1

### Flujo B: Iniciar con 2 modelos
1. Cliente selecciona opción "Llamada con 2 modelos"
2. Cliente selecciona Modelo 1 y Modelo 2
3. Cliente inicia llamada
4. Ambos modelos reciben notificación simultánea
5. Ambos aceptan → Llamada 2vs1 desde inicio
6. Uno rechaza → Llamada continúa con el que aceptó (1vs1)

---

## MÓDULO 1: Base de Datos

### Migración: Agregar soporte para segundo modelo

**Archivo**: `backend/database/migrations/YYYY_MM_DD_HHMMSS_add_second_model_to_chat_sessions.php`

**Campos a agregar**:
- `modelo_id_2` (unsignedBigInteger, nullable) - ID del segundo modelo
- `modelo_2_invited_at` (timestamp, nullable) - Fecha/hora de invitación
- `modelo_2_answered_at` (timestamp, nullable) - Fecha/hora de aceptación
- `modelo_2_status` (enum: 'pending', 'accepted', 'rejected', null) - Estado de invitación

**Índices**:
- Índice simple en `modelo_id_2`
- Índice compuesto en `['modelo_id_2', 'status']`

**Foreign Keys**:
- `modelo_id_2` referencia `users.id` con `onDelete('set null')`

### Modelo ChatSession

**Archivo**: `backend/app/Models/ChatSession.php`

**Campos a agregar a $fillable**:
- `modelo_id_2`
- `modelo_2_invited_at`
- `modelo_2_answered_at`
- `modelo_2_status`

**Casts a agregar**:
- `modelo_2_invited_at` → 'datetime'
- `modelo_2_answered_at` → 'datetime'

**Relaciones nuevas**:
- `modelo2()` → belongsTo(User::class, 'modelo_id_2')

**Métodos nuevos**:
- `hasSecondModel()` → retorna si modelo_id_2 no es null
- `getAllModelos()` → retorna array con ambos modelos (filtra nulls)
- `isSecondModelPending()` → retorna si modelo_2_status === 'pending'
- `isSecondModelAccepted()` → retorna si modelo_2_status === 'accepted'

**Scopes nuevos**:
- `scopeForModelo2($query, $modeloId)` → filtrar por modelo_id_2
- `scopeWithSecondModel($query)` → filtrar llamadas que tienen segundo modelo
- `scopeSecondModelPending($query)` → filtrar llamadas con segundo modelo pendiente

---

## MÓDULO 2: Backend - Invitar Segundo Modelo Durante Llamada

### Nuevo Endpoint

**Ruta**: `POST /api/calls/{call_id}/invite-second-model`

**Archivo**: `backend/app/Http/Controllers/CallController.php`

**Método**: `inviteSecondModel(Request $request, $callId)`

**Validaciones**:
1. Llamada debe existir
2. Llamada debe estar activa (status === 'active')
3. Usuario autenticado debe ser el caller (caller_id)
4. Caller debe ser cliente (rol === 'cliente')
5. modelo_id_2 debe ser null (no hay segundo modelo aún)
6. Segundo modelo debe ser diferente a modelo_id
7. Segundo modelo debe existir
8. Segundo modelo debe ser modelo (rol === 'modelo')
9. Segundo modelo debe estar disponible (no en llamada activa)
10. Validar bloqueos mutuos entre cliente y segundo modelo
11. Validar saldo suficiente del cliente para doble costo

**Lógica**:
1. Buscar la llamada por ID
2. Validar todas las condiciones anteriores
3. Actualizar ChatSession:
   - modelo_id_2 = segundo modelo ID
   - modelo_2_invited_at = now()
   - modelo_2_status = 'pending'
4. Enviar notificación Pusher/WebSocket al segundo modelo
5. Retornar respuesta exitosa con datos de la llamada actualizada

**Respuesta exitosa**:
- success: true
- message: "Invitación enviada"
- call: objeto ChatSession actualizado

**Errores posibles**:
- 404: Llamada no encontrada
- 403: No autorizado (no es el caller)
- 400: Ya hay segundo modelo
- 400: Segundo modelo no disponible
- 402: Saldo insuficiente
- 403: Usuario bloqueado

---

## MÓDULO 3: Backend - Iniciar Llamada con 2 Modelos

### Modificar startCall()

**Archivo**: `backend/app/Http/Controllers/CallController.php`

**Cambios en validación**:
- Hacer `receiver_id` opcional
- Agregar validación para `modelo_ids` (array, opcional)
- Si `modelo_ids` está presente, debe tener exactamente 2 elementos
- Si `receiver_id` está presente, funciona como antes (compatibilidad)

**Lógica cuando modelo_ids tiene 2 elementos**:
1. Validar que ambos IDs existen
2. Validar que ambos son modelos (rol === 'modelo')
3. Validar que ambos son diferentes
4. Validar disponibilidad de ambos (no en llamada activa)
5. Validar bloqueos mutuos con ambos modelos
6. Validar saldo del cliente (doble costo: minimumBalance * 2)
7. Cancelar llamadas activas previas del caller
8. Crear room_name único: `call_{caller_id}_{modelo1_id}_{modelo2_id}_{timestamp}`
9. Crear ChatSession con:
   - modelo_id = primer modelo
   - modelo_id_2 = segundo modelo
   - modelo_2_invited_at = now()
   - modelo_2_status = 'pending'
   - status = 'calling'
10. Enviar notificaciones a AMBOS modelos
11. Retornar respuesta con información de ambos modelos

**Respuesta**:
- success: true
- call_id: ID de la llamada
- room_name: nombre de la room
- modelos: array con ambos modelos y sus estados

**Compatibilidad**:
- Si se envía `receiver_id` (singular), funciona exactamente como antes
- No se rompe ninguna funcionalidad existente

---

## MÓDULO 4: Backend - Aceptar Invitación de Segundo Modelo

### Modificar answerCall()

**Archivo**: `backend/app/Http/Controllers/CallController.php`

**Lógica adicional**:
1. Detectar si la llamada tiene modelo_id_2
2. Detectar si el usuario que responde es modelo_id_2
3. Si es el segundo modelo:
   - Validar que modelo_2_status === 'pending'
   - Actualizar modelo_2_status = 'accepted'
   - Actualizar modelo_2_answered_at = now()
   - Generar token LiveKit para que se una a la room existente
   - Notificar a cliente y modelo1 que modelo2 se unió
   - Retornar respuesta con flag `is_second_model: true`
4. Si es el primer modelo (modelo_id):
   - Funciona como antes (sin cambios)

**Respuesta cuando es segundo modelo**:
- success: true
- message: "Te has unido a la llamada"
- room_name: nombre de la room
- token: token LiveKit
- is_second_model: true
- otros_participantes: información de cliente y modelo1

---

## MÓDULO 5: Backend - Rechazar Invitación de Segundo Modelo

### Nuevo Endpoint

**Ruta**: `POST /api/calls/{call_id}/reject-second-model`

**Archivo**: `backend/app/Http/Controllers/CallController.php`

**Método**: `rejectSecondModelInvitation(Request $request, $callId)`

**Validaciones**:
1. Llamada debe existir
2. Usuario autenticado debe ser modelo_id_2
3. modelo_2_status debe ser 'pending'

**Lógica**:
1. Buscar la llamada
2. Validar condiciones
3. Actualizar modelo_2_status = 'rejected'
4. Opcional: limpiar modelo_id_2 (o mantener para historial)
5. Notificar al cliente que el segundo modelo rechazó
6. La llamada continúa como 1vs1 (no se cancela)

**Respuesta**:
- success: true
- message: "Invitación rechazada"
- call: objeto ChatSession actualizado

---

## MÓDULO 6: Frontend - Botón "Agregar Modelo"

### Ubicación en UI

**Archivo**: `frontend/src/components/client/videochatclient.jsx`

**Ubicación**: En los controles de la llamada (junto a mute, cámara, colgar, etc.)

**Condiciones para mostrar**:
1. Usuario es cliente (userData.rol === 'cliente')
2. Llamada está activa (isActive === true)
3. No hay segundo modelo (callData.modelo_id_2 === null)
4. Tiene saldo suficiente (validar balance)
5. Llamada no está terminando

**Diseño**:
- Botón con icono de "agregar persona" o "➕"
- Texto: "Agregar Modelo" o "Invitar Modelo"
- Estilo: destacado pero no intrusivo
- Posición: en la barra de controles

**Acción al hacer clic**:
- Abrir modal de selección de segundo modelo

---

## MÓDULO 7: Frontend - Modal de Selección de Segundo Modelo

### Componente Nuevo

**Archivo**: `frontend/src/components/client/AddSecondModelModal.jsx`

**Funcionalidad**:
- Modal overlay que muestra lista de modelos disponibles
- Excluir el modelo actual (modelo_id)
- Filtros opcionales:
  - Solo modelos online
  - Solo favoritos
  - Buscar por nombre
- Mostrar información de cada modelo:
  - Avatar
  - Nombre
  - Estado (online/offline)
  - Indicador de favorito
- Botón "Invitar" por cada modelo
- Validar disponibilidad antes de mostrar (opcional)
- Botón "Cancelar" para cerrar modal

**Props**:
- currentModelId: ID del modelo actual (para excluir)
- callId: ID de la llamada activa
- onInvite: callback cuando se invita un modelo
- onClose: callback para cerrar modal
- availableModelos: lista de modelos disponibles (opcional)

**Estados**:
- loading: cargando lista de modelos
- inviting: enviando invitación
- error: mensaje de error si falla

**Integración**:
- Usar API para obtener lista de modelos disponibles
- Filtrar modelos que están en llamada activa
- Mostrar indicador si modelo está ocupado

---

## MÓDULO 8: Frontend - Invitar Segundo Modelo (API Call)

### Método en GlobalCallContext

**Archivo**: `frontend/src/contexts/GlobalCallContext.jsx`

**Método nuevo**: `inviteSecondModel(callId, modeloId)`

**Lógica**:
1. Hacer POST a `/api/calls/{callId}/invite-second-model`
2. Enviar `{ modelo_id: modeloId }` en body
3. Manejar respuesta:
   - Si success: actualizar estado de currentCall
   - Agregar información de modelo2 pendiente
   - Mostrar notificación de éxito
4. Manejar errores:
   - Saldo insuficiente → mostrar modal de recarga
   - Modelo no disponible → mostrar mensaje
   - Otros errores → mostrar mensaje genérico

**Actualización de estado**:
- Modificar currentCall para incluir:
  - modelo2: { id, name, avatar, status: 'pending' }

**Notificaciones**:
- Éxito: "Invitación enviada a [Nombre del Modelo]"
- Error: mensaje específico según el error

---

## MÓDULO 9: Frontend - Selector de Modo de Llamada

### Componente Nuevo

**Archivo**: `frontend/src/components/client/CallModeSelector.jsx`

**Funcionalidad**:
- Toggle/Switch: "Llamada normal (1vs1)" vs "Llamada con 2 modelos"
- Cuando está en modo "2 modelos":
  - Mostrar 2 selectores de modelos (no solo 1)
  - Validar que los 2 modelos son diferentes
  - Mostrar indicador de costo doble
  - Validar saldo suficiente
  - Deshabilitar si no hay saldo
- Cuando está en modo "1vs1":
  - Mostrar selector normal (1 modelo)
  - Funciona como antes

**Props**:
- onModeChange: callback cuando cambia el modo
  - Parámetros: (mode, selectedModelos)
  - mode: 'normal' | 'dual'
  - selectedModelos: array de IDs seleccionados
- disabled: deshabilitar si no hay saldo
- initialMode: modo inicial (default: 'normal')

**Diseño**:
- Toggle visual claro
- Selectores de modelos aparecen/desaparecen según modo
- Indicador de costo visible cuando es modo dual

**Integración**:
- Usar en: homecliente.jsx, message.jsx, favoritesclient.jsx
- Antes del botón "Llamar" o "Iniciar llamada"

---

## MÓDULO 10: Frontend - Modificar startCall() para 2 Modelos

### Modificar GlobalCallContext

**Archivo**: `frontend/src/contexts/GlobalCallContext.jsx`

**Método**: `startCall()`

**Cambios**:
- Agregar parámetro opcional `modeloIds` (array)
- Mantener parámetro `receiverId` para compatibilidad
- Si `modeloIds` tiene 2 elementos:
  - Request body: `{ modelo_ids: modeloIds, call_type: 'video' }`
  - Endpoint: `/api/calls/start`
- Si `modeloIds` tiene 1 elemento o se usa `receiverId`:
  - Request body: `{ receiver_id: receiverId || modeloIds[0], call_type: 'video' }`
  - Funciona como antes (compatibilidad)

**Manejo de respuesta**:
- Si respuesta incluye array `modelos`:
  - Actualizar currentCall con información de ambos modelos
  - Estado inicial: ambos con status 'pending'
- Si respuesta incluye solo `receiver`:
  - Funciona como antes (compatibilidad)

**Estados**:
- currentCall.modelo1: información del primer modelo
- currentCall.modelo2: información del segundo modelo (si existe)

---

## MÓDULO 11: Frontend - UI de Invitación Pendiente

### Banner de Estado

**Archivo**: `frontend/src/components/client/videochatclient.jsx`

**Ubicación**: En la parte superior de la pantalla de video, debajo del header

**Condiciones para mostrar**:
- callData.modelo_id_2 existe
- callData.modelo_2_status === 'pending'
- Usuario es cliente

**Contenido**:
- Avatar del modelo pendiente
- Nombre del modelo
- Texto: "Esperando que [Nombre] acepte la invitación..."
- Indicador de carga/spinner
- Botón opcional: "Cancelar invitación"

**Diseño**:
- Banner destacado pero no intrusivo
- Color: azul/amarillo (pendiente)
- Animación sutil de pulso
- Responsive: se adapta a mobile

**Acciones**:
- Al hacer clic en "Cancelar invitación":
  - Llamar a endpoint para cancelar invitación
  - Actualizar estado (limpiar modelo_id_2)
  - Ocultar banner

---

## MÓDULO 12: Frontend - UI de Video con 2 Modelos

### Modificar VideoDisplayImprovedClient

**Archivo**: `frontend/src/components/client/components/VideoDisplayImprovedClient.jsx`

**Lógica de detección**:
- Recibir prop `modelo2` (puede ser null)
- Detectar si `modelo2` existe y está aceptado
- Si hay 2 modelos: cambiar layout a grid
- Si solo hay 1 modelo: layout normal (1vs1)

**Layout cuando hay 2 modelos**:
- Desktop:
  - Grid 2x2 o 1x3
  - Video local: pequeño, esquina superior derecha
  - Video modelo1: grande, lado izquierdo o arriba
  - Video modelo2: grande, lado derecho o abajo
- Mobile:
  - Stack vertical
  - Video local: pequeño arriba
  - Videos modelos: grandes abajo, uno sobre otro

**Labels sobre videos**:
- Nombre del modelo sobre cada video
- Indicador de audio (mute/unmute)
- Indicador de conexión

**Props**:
- modelo1: objeto con datos del primer modelo
- modelo2: objeto con datos del segundo modelo (null si no existe)
- localParticipant: datos del participante local

**Estados**:
- Si modelo2 está pendiente: mostrar placeholder o avatar
- Si modelo2 se desconecta: mostrar indicador de desconexión
- Si solo modelo1 está conectado: layout 1vs1 normal

---

## MÓDULO 13: Frontend - Suscripción a Segundo Modelo en LiveKit

### Detección de Participantes

**Archivo**: `frontend/src/components/client/videochatclient.jsx`

**Lógica**:
1. Usar hook `useParticipants()` de LiveKit
2. Detectar cuando aparece nuevo participante
3. Comparar identity del participante con callData.modelo_id_2
4. Si coincide y modelo_2_status === 'accepted':
   - Suscribir a tracks de video del segundo modelo
   - Suscribir a tracks de audio del segundo modelo
   - Actualizar estado: segundoModeloConnected = true
   - Actualizar UI para mostrar segundo video

**Comparación de identity**:
- LiveKit identity formato: `user_{id}_{rol}`
- Comparar con `callData.modelo_id_2`
- Extraer ID del identity y comparar

**Suscripción de tracks**:
- Video track: para mostrar video
- Audio track: para reproducir audio (ver MÓDULO 14)

**Manejo de desconexión**:
- Detectar cuando segundo modelo se desconecta
- Actualizar estado: segundoModeloConnected = false
- Mantener UI pero mostrar indicador de desconexión
- Opción: permitir continuar con modelo1 o terminar llamada

**Polling opcional**:
- Si segundo modelo no aparece después de X segundos
- Hacer polling a `/api/calls/{callId}` para verificar estado
- Ver MÓDULO 18

---

## MÓDULO 14: Frontend - Audio de Segundo Modelo

### Modificar AudioManager

**Archivo**: `frontend/src/utils/AudioManager.js`

**Métodos nuevos**:
- `setSecondModelStream(stream)` → Agregar segundo stream de audio
- `removeSecondModelStream()` → Remover segundo stream
- `setModelo1Volume(volume)` → Control de volumen individual modelo1
- `setModelo2Volume(volume)` → Control de volumen individual modelo2

**Implementación**:
- Crear segundo elemento `<audio>` para modelo2
- Mezclar audio de ambos streams
- Mantener controles de volumen independientes
- Manejar mute/unmute individual

**Integración en videochatclient.jsx**:
- Cuando segundo modelo se conecta (MÓDULO 13)
- Obtener RemoteAudioTrack del segundo modelo
- Llamar a `audioManager.setSecondModelStream(track)`
- Cuando segundo modelo se desconecta:
  - Llamar a `audioManager.removeSecondModelStream()`

**Controles de UI**:
- Sliders de volumen individuales (opcional)
- Botones mute/unmute individuales (opcional)
- Por defecto: ambos al mismo volumen

---

## MÓDULO 15: Backend - Notificaciones de Invitación

### Notificación al Segundo Modelo

**Archivo**: `backend/app/Http/Controllers/CallController.php`

**En método inviteSecondModel()**:
- Después de actualizar ChatSession
- Enviar notificación Pusher/WebSocket

**Tipo de notificación**: `second_model_invitation`

**Datos a enviar**:
- type: "second_model_invitation"
- call_id: ID de la llamada
- cliente: { id, name, avatar }
- modelo1: { id, name, avatar }
- room_name: nombre de la room
- message: "Tienes una invitación para unirte a una llamada existente"

**Frontend - IncomingCallOverlay**:
- Detectar tipo de notificación
- Mostrar UI especial diferente a llamada normal
- Mostrar información:
  - Avatar y nombre del cliente
  - Avatar y nombre del modelo1
  - Texto: "Invitación para unirte a una llamada existente"
- Botones:
  - "Aceptar" → llama a answerCall() (MÓDULO 4)
  - "Rechazar" → llama a rejectSecondModelInvitation() (MÓDULO 5)

**Diseño del overlay**:
- Mostrar 2 avatares (cliente + modelo1)
- Indicador visual de que es invitación (no llamada nueva)
- Estilo diferente a llamada entrante normal

---

## MÓDULO 16: Backend - Costos Dinámicos

### Modificar VideoChatCoinController

**Archivo**: `backend/app/Http/Controllers/VideoChatCoinController.php`

**Método**: `calculateConsumption()`

**Lógica cuando hay segundo modelo**:
1. Detectar si `modelo_id_2` existe y está aceptado
2. Calcular consumo por períodos:
   - Período 1 (1vs1): desde `started_at` hasta `modelo_2_answered_at`
     - Consumo normal: `duration * consumption_rate`
   - Período 2 (2vs1): desde `modelo_2_answered_at` hasta `ended_at`
     - Consumo doble: `duration * consumption_rate * 2`
3. Sumar ambos períodos para costo total

**Si segundo modelo se unió desde inicio**:
- Todo el tiempo es consumo doble
- `total_cost = duration * consumption_rate * 2`

**Validación antes de iniciar**:
- Si se inicia con 2 modelos: validar saldo doble desde inicio
- Si se agrega durante: validar saldo suficiente para doble costo al invitar

**Registro de consumo**:
- Registrar consumo por período en logs
- Guardar en tabla de consumos (si existe)
- Incluir información de cuándo se agregó segundo modelo

---

## MÓDULO 17: Backend - Earnings por Modelo

### Modificar SessionEarningsController

**Archivo**: `backend/app/Http/Controllers/SessionEarningsController.php`

**Método**: Calcular earnings al terminar llamada

**Lógica cuando hay segundo modelo**:
1. Detectar si `modelo_id_2` existe y está aceptado
2. Calcular earnings por modelo:

**Si ambos modelos desde inicio**:
- Dividir earnings 50/50
- Modelo1: `total_earnings * 0.5`
- Modelo2: `total_earnings * 0.5`

**Si modelo2 se unió después**:
- Modelo1: earnings desde `started_at` hasta `ended_at`
  - `earnings_modelo1 = duration_total * rate * 0.5`
- Modelo2: earnings desde `modelo_2_answered_at` hasta `ended_at`
  - `earnings_modelo2 = duration_modelo2 * rate * 0.5`
- O proporcional al tiempo:
  - `earnings_modelo1 = (duration_modelo1 / duration_total) * total_earnings`
  - `earnings_modelo2 = (duration_modelo2 / duration_total) * total_earnings`

**Registro de earnings**:
- Registrar earnings individuales en tabla de earnings
- Incluir información de modelo_id y modelo_id_2
- Guardar duración individual de cada modelo

**Lógica de negocio alternativa**:
- Opción 1: Dividir 50/50 siempre
- Opción 2: Proporcional al tiempo
- Opción 3: 60/40 (modelo1 más porque inició)
- Configurable en settings o constante

---

## MÓDULO 18: Frontend - Polling de Estado de Invitación

### Polling en videochatclient.jsx

**Archivo**: `frontend/src/components/client/videochatclient.jsx`

**Condiciones para activar polling**:
- callData.modelo_id_2 existe
- callData.modelo_2_status === 'pending'
- Llamada está activa

**Lógica**:
1. Crear intervalo de polling cada 3-5 segundos
2. Hacer GET a `/api/calls/{callId}`
3. Verificar si `modelo_2_status` cambió:
   - Si cambió a 'accepted':
     - Detener polling
     - Actualizar estado
     - Suscribir a tracks del segundo modelo (MÓDULO 13)
     - Actualizar UI (MÓDULO 12)
   - Si cambió a 'rejected':
     - Detener polling
     - Actualizar estado
     - Mostrar notificación: "Modelo rechazó la invitación"
     - Ocultar banner de pendiente (MÓDULO 11)
4. Limpiar intervalo cuando:
   - Segundo modelo acepta
   - Segundo modelo rechaza
   - Llamada termina
   - Componente se desmonta

**Optimización**:
- Usar AbortController para cancelar requests pendientes
- Evitar polling si ya hay una request en curso
- Detener polling después de X intentos sin cambios

---

## Archivos a Modificar/Crear

### Backend

**Nuevos archivos**:
- `backend/database/migrations/YYYY_MM_DD_HHMMSS_add_second_model_to_chat_sessions.php`

**Archivos a modificar**:
- `backend/app/Models/ChatSession.php`
- `backend/app/Http/Controllers/CallController.php`
- `backend/app/Http/Controllers/VideoChatCoinController.php`
- `backend/app/Http/Controllers/SessionEarningsController.php`

### Frontend

**Nuevos archivos**:
- `frontend/src/components/client/AddSecondModelModal.jsx`
- `frontend/src/components/client/CallModeSelector.jsx`

**Archivos a modificar**:
- `frontend/src/contexts/GlobalCallContext.jsx`
- `frontend/src/components/client/videochatclient.jsx`
- `frontend/src/components/client/components/VideoDisplayImprovedClient.jsx`
- `frontend/src/components/IncomingCallOverlay.jsx`
- `frontend/src/utils/AudioManager.js`
- `frontend/src/components/client/homecliente.jsx`
- `frontend/src/components/client/message.jsx`
- `frontend/src/components/client/favoritesclient.jsx`

---

## Validaciones y Edge Cases

### Validaciones Backend

1. **No permitir más de 2 modelos**:
   - Validar que modelo_id_2 es null antes de agregar segundo modelo

2. **No permitir mismo modelo dos veces**:
   - Validar que modelo_id !== modelo_id_2

3. **No permitir modelo en 2 llamadas 2vs1 simultáneas**:
   - Validar disponibilidad antes de invitar

4. **Si un modelo rechaza, llamada continúa**:
   - No cancelar llamada si modelo2 rechaza
   - Limpiar estado de modelo2 pero mantener llamada activa

5. **Si un modelo se desconecta durante 2vs1**:
   - Opción A: Continuar con el otro modelo (1vs1)
   - Opción B: Terminar llamada
   - Decisión de negocio

### Validaciones Frontend

1. **Mostrar botón solo cuando aplica**:
   - Validar todas las condiciones antes de mostrar

2. **Manejar estados de carga**:
   - Loading al invitar modelo
   - Loading al aceptar invitación
   - Loading al suscribir tracks

3. **Manejar errores de red**:
   - Reintentar si falla la invitación
   - Mostrar mensajes de error claros

4. **Sincronización de estado**:
   - Polling para mantener estado actualizado
   - WebSocket para actualizaciones en tiempo real (si está disponible)

---

## Orden de Implementación Recomendado

1. **MÓDULO 1**: Base de datos (fundación)
2. **MÓDULO 2**: Invitar segundo modelo durante llamada (core backend)
3. **MÓDULO 3**: Iniciar con 2 modelos (completa backend)
4. **MÓDULO 4**: Aceptar invitación (completa flujo backend)
5. **MÓDULO 5**: Rechazar invitación (completa flujo backend)
6. **MÓDULO 6**: Botón agregar modelo (UI básica)
7. **MÓDULO 7**: Modal de selección (UI completa)
8. **MÓDULO 8**: API call para invitar (conexión frontend-backend)
9. **MÓDULO 9**: Selector de modo (UI para iniciar con 2)
10. **MÓDULO 10**: Modificar startCall (completa flujo inicio)
11. **MÓDULO 11**: UI de invitación pendiente (feedback visual)
12. **MÓDULO 12**: UI de video con 2 modelos (visualización)
13. **MÓDULO 13**: Suscripción LiveKit (conexión real)
14. **MÓDULO 14**: Audio de segundo modelo (audio completo)
15. **MÓDULO 15**: Notificaciones (comunicación)
16. **MÓDULO 16**: Costos dinámicos (monetización)
17. **MÓDULO 17**: Earnings (monetización)
18. **MÓDULO 18**: Polling (sincronización)

---

## Testing Checklist

### Backend
- [ ] Crear llamada 1vs1 normal (compatibilidad)
- [ ] Invitar segundo modelo durante llamada activa
- [ ] Segundo modelo acepta invitación
- [ ] Segundo modelo rechaza invitación
- [ ] Iniciar llamada con 2 modelos desde inicio
- [ ] Validar bloqueos mutuos
- [ ] Validar saldo insuficiente
- [ ] Validar modelo no disponible
- [ ] Calcular costos correctamente
- [ ] Calcular earnings correctamente

### Frontend
- [ ] Mostrar botón "Agregar Modelo" solo cuando aplica
- [ ] Abrir modal de selección
- [ ] Invitar modelo desde modal
- [ ] Mostrar banner de invitación pendiente
- [ ] Mostrar 2 videos cuando segundo modelo se une
- [ ] Audio de ambos modelos funciona
- [ ] Selector de modo funciona
- [ ] Iniciar con 2 modelos funciona
- [ ] Polling actualiza estado correctamente
- [ ] Notificaciones se muestran correctamente

### Integración
- [ ] Flujo completo: invitar → aceptar → mostrar videos
- [ ] Flujo completo: iniciar con 2 → ambos aceptan → mostrar videos
- [ ] Flujo completo: invitar → rechazar → continuar 1vs1
- [ ] Costos se calculan correctamente
- [ ] Earnings se calculan correctamente
- [ ] LiveKit funciona con 3 participantes
- [ ] Audio funciona con 2 streams simultáneos

---

## Notas Finales

- Todos los módulos son independientes y pueden implementarse por separado
- La compatibilidad con llamadas normales (1vs1) se mantiene en todo momento
- El sistema es extensible: se puede agregar soporte para más modelos en el futuro
- Las decisiones de negocio (earnings, costos) son configurables
- El sistema debe ser robusto ante errores de red y desconexiones






