---
name: websocket-client
description: Convenciones de la capa WebSocket del chat — cliente con reconexión (backoff + jitter), heartbeat ping/pong, cola de envío offline, eventos tipados y validados con Zod, envío optimista y conciliación por `clientMessageId`. Úsalo en la Fase 2 (capa WS) y Fase 3 (chat 1:1) o al tocar `src/lib/ws/`, `src/lib/validation/ws.ts` o el store de mensajes.
---

# Capa WebSocket (este proyecto)

Diseño completo en `docs/ARQUITECTURA.md` §7. Los esquemas de eventos ya existen
en `src/lib/validation/ws.ts` (`clientEventSchema`, `serverEventSchema`,
`message.send`/`message.ack`/`message.new`/`error`/`ping`/`pong`).

## Dónde vive

- `src/lib/ws/client.ts` — `WebSocketClient` (clase/singleton, agnóstico de React).
- `src/lib/ws/use-chat-socket.ts` — hook/context que conecta el cliente al ciclo
  de vida de React y al store.
- `src/store/messages.ts` (Zustand) — mensajes por conversación + estado de
  conexión.
- `src/lib/validation/ws.ts` — esquemas Zod de los eventos (fuente de verdad).

## Responsabilidades del `WebSocketClient`

1. **Conexión singleton** y ciclo de vida (`connect` / `disconnect`).
2. **Reconexión automática** con **backoff exponencial + jitter** (tope ~30 s).
   Resetea el backoff tras una conexión estable.
3. **Heartbeat**: enviar `ping` cada N s; si no llega `pong` a tiempo, marcar la
   conexión muerta y reconectar.
4. **Cola de envío** en memoria: si está desconectado, encolar y **vaciar al
   reconectar**.
5. **Eventos tipados**: serializar salientes con `clientEventSchema`; validar
   **todo** mensaje entrante con `serverEventSchema` (`safeParse`) y descartar lo
   inválido (loguear, no romper).

## Autenticación del handshake

Los navegadores no permiten headers custom en el WS. Patrón preferido:
**ticket corto** vía REST (`POST /ws/ticket`, autenticado con Bearer) y conectar
con `wss://.../ws?ticket=…`. Alternativa: enviar `{ type: 'auth', accessToken }`
como primer frame. A confirmar con backend (doc §10).

## Envío optimista + conciliación

1. Al enviar: crear `Message` con `clientMessageId` (uuid) y `status: 'sending'`,
   pintarlo de inmediato en la UI y mandar/encolar `message.send`.
2. Al llegar `message.ack`: localizar por `clientMessageId`, fijar el `id`
   definitivo y `status: 'sent'`.
3. Timeout/fallo → `status: 'failed'` con acción de reintentar.
4. `message.new` entrante: insertar; **deduplicar por `clientMessageId`** (o `id`)
   para ignorar el eco del propio mensaje.

## Reglas

- **No** crear conexiones WS sueltas en componentes: todo pasa por el cliente de
  `src/lib/ws/`.
- Limpia listeners/timers en `disconnect` y en el cleanup del hook (evita fugas).
- Nunca confíes en el payload entrante sin validar con Zod.
- Refleja el estado de conexión (`connecting`/`open`/`reconnecting`/`closed`) en
  el store para mostrar indicadores en la UI.
- El contrato WS es **tentativo**: si cambia, ajusta solo
  `src/lib/validation/ws.ts` y el mapeo en el cliente.
