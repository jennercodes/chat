# WebSocket — Guía de implementación para BACKEND

> Instrucciones para que el equipo de backend **construya** el WebSocket del chat.
> Complementa el contrato general (`contrato-backend.md §5`) con los detalles
> exactos que el **frontend ya consume** (extraídos del cliente real en
> `src/lib/ws/`). Respetar nombres, tipos y timings tal cual: el cliente valida
> con Zod y **descarta en silencio** cualquier frame que no matchee.
>
> Fecha: 2026-07-15 · Referencia de comportamiento: `src/lib/ws/mock-socket.ts`
> (servidor simulado que hay que replicar) y `src/lib/ws/client.ts`.

---

## 0. Decisión tecnológica (leer primero)

**Usar WebSocket "crudo" (raw), NO STOMP ni SockJS.**

El cliente usa el `WebSocket` nativo del navegador y una envoltura JSON propia
`{ "type": string, "payload": object }`. En Spring esto es:

- ✅ `spring-boot-starter-websocket` + un `TextWebSocketHandler` registrado con
  `WebSocketConfigurer` (API de bajo nivel).
- ❌ **NO** `@EnableWebSocketMessageBroker` / STOMP / `SockJS` → esos imponen su
  propio protocolo de frames y **romperían el contrato**. Si por algún motivo el
  backend necesita STOMP, hay que avisar: cambia la capa `src/lib/ws/` del front.

---

## 1. Handshake y autenticación (ticket)

Los navegadores no permiten headers custom en el handshake WS, así que **no** se
manda `Authorization` en la conexión. Flujo:

1. El front pide un ticket por REST: **`POST /ws/ticket`** con `Authorization: Bearer <accessToken>`.
2. Conecta a **`ws://<host>/ws?ticket=<ticket>`** (el query param se llama
   exactamente `ticket`, URL-encoded).
3. El servidor valida el ticket en el handshake, lo asocia al `userId` y abre la
   conexión. Si es inválido/expirado → **rechazar** el handshake (401 / cerrar).

```jsonc
// POST /ws/ticket  (response)
{ "ticket": "<token-corto-de-un-solo-uso>", "expiresIn": 30 }
```

Requisitos del ticket:

- **Corta vida** (~15–60 s) y **un solo uso** (se invalida al consumirlo en el handshake).
- Ligado al usuario del Bearer. Recomendado: JWT corto firmado o UUID opaco en
  store con TTL (Redis/in-memory).
- El front pide un **ticket nuevo en cada (re)conexión**; no reutilizar.

**En Spring:** validar el ticket en un `HandshakeInterceptor` (leer
`?ticket=` de la URI, resolver el `userId`, guardarlo en los `attributes` de la
sesión) o al inicio de `afterConnectionEstablished`. Registrar el handler con
`setAllowedOrigins("http://localhost:3000")` (y las URLs de cada entorno).

> Nota CORS: el handshake WS **sí** valida `Origin`. Añadir el origen del front
> (`http://localhost:3000` en dev). El REST no necesita CORS (sale del BFF).

---

## 2. Ciclo de vida de la conexión

- Un usuario puede tener **varias conexiones** a la vez (multi-pestaña). Mantener
  un registro `Map<userId, Set<Session>>` concurrente para poder enrutar
  `message.new` a todas las sesiones de un participante.
- Al cerrarse la conexión (`afterConnectionClosed`), quitar la sesión del registro.
- No hace falta lógica de reconexión en el servidor: **el cliente reconecta solo**
  (ver §6). El servidor solo debe aceptar conexiones nuevas con ticket válido.

---

## 3. Formato de frames

Envoltura común, **JSON en frames de texto**: `{ "type": string, "payload": object }`.
`ping`/`pong` no llevan `payload`. Timestamps en **ISO 8601 UTC**
(`2026-07-15T09:10:00.000Z`). Modelos (`Message`, `User`…) en
`contrato-backend.md §2`.

### Cliente → Servidor

```jsonc
// Enviar mensaje. El servidor IGNORA cualquier senderId/id que venga del cliente:
// el senderId se infiere del ticket, el id lo asigna el servidor.
{ "type": "message.send",
  "payload": {
    "clientMessageId": "uuid-generado-en-cliente",  // idempotency key (ver §5)
    "conversationId": "c1",
    "content": "hola",
    "sentAt": "2026-07-15T09:10:00.000Z"            // hora del cliente (informativa)
  } }

// Heartbeat
{ "type": "ping" }
```

### Servidor → Cliente

```jsonc
// 1) ACK del mensaje propio → SOLO a la conexión que envió. Concilia por clientMessageId.
{ "type": "message.ack",
  "payload": {
    "clientMessageId": "uuid-generado-en-cliente",  // el MISMO que llegó en message.send
    "id": "m10",                                    // id definitivo asignado por el servidor
    "conversationId": "c1",
    "status": "sent",
    "createdAt": "2026-07-15T09:10:01.000Z"         // hora autoritativa del servidor
  } }

// 2) Mensaje nuevo → a los DEMÁS participantes (y a otras sesiones del emisor). Ver §5.
{ "type": "message.new",
  "payload": {
    "id": "m10",
    "clientMessageId": null,                        // o el clientMessageId si es eco al propio emisor
    "conversationId": "c1",
    "senderId": "u1",
    "content": "hola",
    "status": "sent",
    "createdAt": "2026-07-15T09:10:01.000Z"
  } }

// 3) Error (opcional pero recomendado)
{ "type": "error",
  "payload": { "code": "INVALID_PAYLOAD", "message": "…",
               "clientMessageId": "uuid" } }        // clientMessageId opcional, si aplica al envío

// 4) Respuesta al heartbeat
{ "type": "pong" }
```

**Campos y tipos exactos** (el cliente los valida con Zod y descarta lo que no
cuadre — un typo en un `type` o un campo faltante = frame ignorado sin error):

- `message.ack.payload`: `clientMessageId` (string), `id` (string),
  `conversationId` (string), `status` (`"sent"`), `createdAt` (string ISO).
- `message.new.payload` = objeto `Message` completo: `id`, `clientMessageId`
  (string|**null**), `conversationId`, `senderId`, `content`, `status`, `createdAt`.
- `status` que emite el servidor: `"sent"` (más adelante `"delivered"`/`"read"`).
  `"sending"` y `"failed"` son **solo del cliente**, no los emitas.

---

## 4. Flujo al recibir `message.send`

1. **Validar** el payload y la **pertenencia**: el `userId` del socket debe ser
   participante de `conversationId`. Si no → `error` (o cerrar).
2. **Idempotencia:** si ya existe un mensaje con esa `(senderId, clientMessageId)`,
   **no crear otro**; responder el `ack` del existente (ver §5).
3. **Persistir** el mensaje: asignar `id`, fijar `senderId` = usuario del socket,
   `createdAt` = hora del servidor, `status = "sent"`. Debe quedar en el historial
   REST (`GET /conversations/{id}/messages`).
4. **Actualizar** la conversación: `lastMessage`, `updatedAt` (y `unreadCount`
   del destinatario, si lo llevan).
5. **Emitir `message.ack`** a la conexión emisora (con el `clientMessageId` recibido).
6. **Emitir `message.new`** a las **demás** conexiones de los participantes.

---

## 5. Ack vs message.new y deduplicación (importante)

El cliente pinta el mensaje de forma **optimista** al enviarlo y luego lo concilia:

- El **`ack`** llega a la conexión emisora → el cliente reemplaza el `id`
  provisional por el definitivo y pasa el mensaje a `sent`. **Casa por
  `clientMessageId`.**
- El **`message.new`** es para que **los demás** vean el mensaje.

Regla de enrutado para evitar duplicados en la UI:

- A la **conexión que envió**: mandar **solo el `ack`** (NO le mandes también
  `message.new` del mismo mensaje, se vería duplicado).
- A las **demás conexiones del mismo usuario** (otras pestañas) y a los **otros
  participantes**: mandar `message.new`.
- El cliente **deduplica** `message.new` por `clientMessageId` **o** por `id`
  (`applyIncoming` en `src/store/messages.ts`). Si haces eco al propio emisor en
  otra pestaña, puedes incluir el `clientMessageId` real; si no, `null` está bien
  siempre que el `id` no colisione con uno ya presente.

**`clientMessageId` = clave de idempotencia.** El cliente reintentará mensajes
fallidos (Fase 4) con el **mismo** `clientMessageId`, y al reconectar puede
reenviar lo que quedó en cola. Si el servidor ve dos veces la misma
`(senderId, clientMessageId)`, debe devolver el **mismo** `ack` y **no** duplicar.

---

## 6. Heartbeat y timeouts (timings exactos del cliente)

- El cliente envía **`ping` cada ~25 s** y espera un **`pong`**. Si al siguiente
  tick (~25 s después) no recibió el `pong`, considera la conexión muerta, la
  cierra y reconecta. → **El servidor DEBE responder `pong` a cada `ping`, rápido.**
- El servidor puede además hacer su propio keepalive, pero no es obligatorio.
- Ajustar el **idle timeout** del servidor por encima del intervalo del cliente
  (p. ej. ≥ 60 s) para no cortar conexiones sanas. En Spring:
  `ServletServerContainerFactoryBean#setMaxSessionIdleTimeout` (y tamaños de buffer
  de texto si esperan mensajes grandes).

---

## 7. Reconexión (comportamiento del cliente que el servidor debe tolerar)

- El cliente reconecta con **backoff exponencial + jitter**: base 1 s, tope 30 s.
  Pide un **ticket nuevo** en cada intento.
- Mientras está desconectado, **encola** los `message.send` y los **vacía de golpe
  al reconectar** → el servidor puede recibir una **ráfaga** de envíos al abrir una
  conexión. Procesarlos en orden; la idempotencia por `clientMessageId` (§5) cubre
  posibles reenvíos.
- Si no hay sesión (sin ticket), el cliente **no** reintenta (se queda cerrado).
  Un ticket inválido con sesión válida sí provoca reintentos → devolver un rechazo
  claro en el handshake.

---

## 8. Errores y validación

- Emitir `{ "type": "error", "payload": { code, message, clientMessageId? } }`
  ante payload inválido, conversación ajena, contenido vacío, etc. `code` es un
  string estable (p. ej. `INVALID_PAYLOAD`, `NOT_A_PARTICIPANT`, `RATE_LIMITED`).
- `content`: el cliente exige longitud ≥ 1. Definir en backend un **máximo**
  razonable (p. ej. 4 000–8 000 chars) y rechazar por encima.
- Nunca confíes en `senderId` del cliente (no lo manda; si lo mandara, ignóralo).
- Validar pertenencia a la conversación en **cada** `message.send`.

---

## 9. Ejemplo de secuencia (1:1, Ana → Beto)

```
Ana (conn A)                         Servidor                         Beto (conn B)
  |  POST /ws/ticket (Bearer) ─────────▶ |                                  |
  | ◀───────────── { ticket, 30 } ────── |                                  |
  |  WS  /ws?ticket=… ─────────────────▶ | (valida ticket → userId=u1)      |
  |  {type:"message.send",               |                                  |
  |   payload:{clientMessageId:"k1",     |                                  |
  |            conversationId:"c1",      |                                  |
  |            content:"hola"}} ───────▶ | persiste → id=m10, createdAt=…   |
  | ◀── {type:"message.ack",             |                                  |
  |      payload:{clientMessageId:"k1",  |                                  |
  |               id:"m10",status:"sent"}}                                  |
  |                                      | ── {type:"message.new",          |
  |                                      |     payload:{id:"m10",           |
  |                                      |     senderId:"u1",content:"hola" |
  |                                      |     …}} ────────────────────────▶ |
  |  {type:"ping"} ────────────────────▶ |                                  |
  | ◀──────────── {type:"pong"} ──────── |                                  |
```

---

## 10. Checklist de implementación (backend)

- [ ] `POST /ws/ticket` (Bearer) → `{ ticket, expiresIn }`, ticket corto y de un solo uso.
- [ ] Endpoint WS `/ws`, raw (TextWebSocketHandler), `Origin` permitido para el front.
- [ ] Validar ticket en el handshake → resolver `userId`; rechazar si inválido.
- [ ] Registro `Map<userId, Set<Session>>` para enrutar a todas las sesiones.
- [ ] Parseo/serialización del envoltorio `{type,payload}` (Jackson).
- [ ] `message.send`: validar pertenencia, idempotencia por `clientMessageId`,
      persistir (id/senderId/createdAt/status=sent), actualizar conversación.
- [ ] Responder `message.ack` al emisor y `message.new` a los demás.
- [ ] Responder `pong` a cada `ping`; idle timeout ≥ 60 s.
- [ ] `error` con `code`/`message` en fallos; límite de tamaño de `content`.
- [ ] El historial REST refleja los mensajes enviados por WS.

---

## 11. Desviaciones que ROMPEN el frontend (evitar o avisar)

Cambiar cualquiera de estos obliga a tocar `src/lib/ws/` o `src/lib/validation/ws.ts`:

- Usar STOMP/SockJS en vez de raw WebSocket.
- Cambiar la envoltura `{type,payload}` o los strings de `type`
  (`message.send`/`message.ack`/`message.new`/`ping`/`pong`/`error`).
- Renombrar campos del payload o cambiar tipos (p. ej. `clientMessageId` que no
  vuelva idéntico en el `ack`).
- Autenticar el handshake de otra forma que no sea `?ticket=` (p. ej. token en
  primer frame o en subprotocolo). Si prefieren otra, coordinémoslo.

---

## 12. Preguntas a confirmar

1. ¿OK con **raw WebSocket** (no STOMP) y la envoltura `{type,payload}`?
2. ¿OK con el patrón **ticket** (`POST /ws/ticket` + `?ticket=`)? Vida del ticket.
3. ¿Emiten `message.ack` por mensaje? ¿Idempotencia por `clientMessageId`?
4. ¿Hacen ping/keepalive propio además de responder `pong`? Idle timeout.
5. ¿`unreadCount` y `updatedAt` los recalculan al recibir el mensaje?
6. Límite de longitud de `content` y códigos de `error` que van a usar.
```
