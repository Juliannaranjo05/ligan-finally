# Flujo del Link de Perfil

## Formato del Link
```
https://ligandome.com/message?user={username}
```

## Flujo Completo

### 1. Usuario CON sesión activa hace clic en el link
- URL: `/message?user=Yandry+Montealegre`
- El sistema detecta que hay token válido en localStorage
- `usePageAccess` permite el acceso (no redirige)
- `useSessionValidation` valida la sesión (no cierra)
- El componente `message.jsx` se monta
- El `useEffect` detecta el parámetro `user` en la URL
- Busca el modelo por nombre usando `/api/model/by-name/{username}`
- Si encuentra el modelo, abre/crea la conversación
- El chat se abre automáticamente

### 2. Usuario SIN sesión hace clic en el link
- URL: `/message?user=Yandry+Montealegre`
- El sistema detecta que NO hay token
- `useSessionValidation` detecta parámetro `user` y redirige a `/login?redirect=/message?user=...`
- El usuario inicia sesión
- Después del login, redirige a `/message?user=Yandry+Montealegre`
- El componente `message.jsx` se monta
- El `useEffect` detecta el parámetro `user` y abre el chat

## Puntos Críticos

1. **NO debe cerrar sesión** si hay token válido
2. **NO debe limpiar token** en errores de endpoints de modelos
3. **El endpoint `/api/model/by-name/{username}` NO requiere autenticación**
4. **Si hay token, debe permitir acceso directo sin redirecciones**





