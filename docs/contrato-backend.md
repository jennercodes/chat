# Contrato Backend — Chat (auth + WebSocket + REST)

> Documento de hand-off para el equipo de backend. Describe **todo lo que el
> frontend ya consume** (hoy contra mocks) para que puedan preparar los servicios
> reales. Es una **propuesta**: ajustémosla donde haga falta.
>
> Fecha: 2026-06-22 · Reemplaza/expande a `contrato-auth-backend.md`.

> **⚠️ Estado real del backend a 2026-07-15** (lo verificado contra respuestas
> reales; la propuesta de abajo era el ideal). El frontend ya se adaptó a esto:
>
> 1. **Auth es un stub (sin JWT real).** `POST /auth/login` ignora email/password
>    y devuelve **siempre `u1`** (Ana). Los endpoints REST actúan **siempre como
>    `u1`** (el `Authorization` no cambia el usuario en REST). **Solo el
>    `POST /ws/ticket`** distingue usuario: interpreta `Bearer <token>` como
>    `userId` si existe (p. ej. `Bearer u2`); cualquier otro → `u1`.
> 2. **Timestamps inconsistentes:** el **WS** emite UTC con `Z`; el **REST** emite
>    hora **local sin `Z`**. Por eso los esquemas usan `z.string()` (no
>    `.datetime()`). En dev (mismo host) el display cuadra; en prod con TZ distinta
>    puede desviarse hasta que backend alinee a UTC.
> 3. **`User` con dos formas:** en `conversation.participants` llega la entidad
>    completa (`nombres`, `apellidos`, `rol`, `status`, `lastSeenAt`); en `/users` y
>    `auth.user` el DTO reducido. El front valida el subconjunto
>    `{ id, displayName, avatarUrl }` y **descarta** los campos extra.
> 4. **`type` de conversación en MAYÚSCULAS** (`DIRECT`); `lastMessage` y
>    `lastSeenAt`/`avatarUrl` pueden ser `null`.

---

## 1. Visión general

- El frontend es una app web (TanStack Start) con un **BFF** (nuestro servidor).
  El reparto de llamadas es:
  - **Auth** (`/auth/login`, `/auth/refresh`, `/auth/logout`) → las hace el **BFF
    servidor-a-servidor**. No requieren CORS. El refresh token nunca llega al
    navegador (lo guarda el BFF en cookie httpOnly).
  - **Chat REST** (`/conversations`, `/users`, historial) y **`/ws/ticket`** → las
    hace el **navegador directo** a su API con `Authorization: Bearer`.
- **⚠️ CORS requerido** para las llamadas del navegador: permitir el origen del
  frontend (`http://localhost:3000` en dev), los métodos `GET, POST, OPTIONS` y
  las cabeceras `Authorization` y `Content-Type` (responder también el preflight
  `OPTIONS`). **No** hace falta `Access-Control-Allow-Credentials`: esas llamadas
  van sin cookies (autenticadas solo por el Bearer).
- **Autenticación:** JWT **Bearer**. Se adjunta `Authorization: Bearer <accessToken>`
  en cada llamada REST protegida y en `/ws/ticket`; ustedes identifican al usuario
  por ese token.
- **Tokens:** el access token vive en memoria en el cliente; el refresh token lo
  guarda el BFF en una cookie `httpOnly`. **Sus endpoints devuelven los tokens en
  el cuerpo JSON** (no por `Set-Cookie`); la cookie la gestionamos nosotros.
- **Mensajería:** los mensajes se **envían y reciben por WebSocket**; el
  **historial** se lee por **REST**.
- **Convenciones generales:**
  - `id`s: `string`. Timestamps: **ISO 8601 UTC** (`2026-06-22T09:05:00.000Z`).
  - Todo se valida con Zod en el frontend; respetar nombres y tipos exactos.

---

## 2. Modelos de datos

```ts
// Usuario
interface User {
  id: string
  displayName: string
  avatarUrl?: string | null
  status?: 'online' | 'offline' // presencia (futuro)
  lastSeenAt?: string // ISO 8601 (futuro)
}

// Estado de un mensaje
type MessageStatus =
  | 'sending'   // SOLO cliente (optimista, aún sin ack)
  | 'sent'      // aceptado por el servidor
  | 'delivered' // entregado al destinatario (futuro)
  | 'read'      // leído (futuro)
  | 'failed'    // SOLO cliente (falló el envío)

// Mensaje
interface Message {
  id: string
  clientMessageId: string | null // id generado por el cliente (dedupe); null si no aplica
  conversationId: string
  senderId: string
  content: string
  status: MessageStatus
  createdAt: string // ISO 8601
  editedAt?: string
}

// Conversación (v1: solo 1:1)
interface Conversation {
  id: string
  type: 'direct'
  participants: User[] // en 1:1 son 2
  lastMessage?: Message
  unreadCount: number
  updatedAt: string // ISO 8601
}
```

> El servidor solo emite estados `sent` / `delivered` / `read`. `sending` y
> `failed` son estados internos del cliente.

---

## 3. Autenticación (REST)

| Método | Ruta            | Auth      | Descripción                          |
| ------ | --------------- | --------- | ------------------------------------ |
| POST   | `/auth/login`   | Pública   | Login con credenciales               |
| POST   | `/auth/refresh` | Refresh   | Nuevo access token desde el refresh  |
| POST   | `/auth/logout`  | Bearer    | Revoca el refresh token              |

```jsonc
// POST /auth/login  (request)
{ "email": "user@example.com", "password": "••••••" }

// POST /auth/login  (response)  — mismo shape para /auth/refresh
{
  "accessToken": "<jwt>",
  "refreshToken": "<token>",
  "expiresIn": 900,                         // segundos de vida del access token
  "user": { "id": "u1", "displayName": "Ana", "avatarUrl": null }
}

// POST /auth/refresh  (request)
{ "refreshToken": "<token>" }
```

Puntos clave:

- Devolver `accessToken` **y** `refreshToken` en el body (el BFF mueve el refresh
  a la cookie httpOnly).
- `/auth/refresh` recibe el refresh token en el **body** (lo manda el BFF).
- Incluir `user` en `login` y `refresh` nos evita un `/auth/me` aparte (si
  prefieren `/auth/me`, lo confirmamos).
- En reload, el frontend obtiene un access token nuevo vía `/auth/refresh`.

---

## 4. REST de chat

Todas requieren **Bearer**; el usuario se infiere del token. El frontend nunca
manda el `senderId`/`userId` propio: lo deduce el backend del token.

| Método | Ruta                                  | Descripción                              |
| ------ | ------------------------------------- | ---------------------------------------- |
| GET    | `/conversations`                      | Conversaciones del usuario               |
| GET    | `/conversations/{id}`                 | Una conversación (si el usuario pertenece) |
| GET    | `/conversations/{id}/messages`        | Historial paginado (cursor)              |
| GET    | `/users?search=<q>`                   | Buscar usuarios para iniciar conversación |
| POST   | `/conversations`                      | Obtener o crear conversación directa     |
| POST   | `/ws/ticket`                          | Ticket para abrir el WebSocket (ver §5)  |

```jsonc
// GET /conversations  (response)
[
  {
    "id": "c1",
    "type": "direct",
    "participants": [
      { "id": "u1", "displayName": "Ana" },
      { "id": "u2", "displayName": "Beto" }
    ],
    "lastMessage": {
      "id": "m5", "clientMessageId": null, "conversationId": "c1",
      "senderId": "u2", "content": "Crack 💪", "status": "sent",
      "createdAt": "2026-06-22T09:05:00.000Z"
    },
    "unreadCount": 0,
    "updatedAt": "2026-06-22T09:05:00.000Z"
  }
]

// GET /conversations/{id}/messages?cursor=<opaco>&limit=30  (response)
{
  "items": [ /* Message[] en orden cronológico (viejo -> nuevo) dentro de la página */ ],
  "nextCursor": "string-opaco-o-null"
}

// GET /users?search=car  (response)
[ { "id": "u3", "displayName": "Carla", "avatarUrl": null } ]

// POST /conversations  (request)  -> obtener o crear la conversación 1:1 con userId
{ "userId": "u3" }
// (response) -> Conversation
```

**Paginación de mensajes (cursor):**

- Sin `cursor`: devuelve los **últimos** `limit` mensajes (orden cronológico
  dentro de la página).
- `nextCursor`: cursor **opaco** para pedir el bloque **anterior** (mensajes más
  antiguos). `null` cuando ya no hay más.
- `limit` por defecto sugerido: 30 (máx. 100). El formato del cursor lo deciden
  ustedes (offset, id, timestamp…); el frontend lo trata como opaco.

---

## 5. WebSocket

### 5.1 Autenticación del handshake (ticket)

Los navegadores no permiten headers custom en el handshake WS. Flujo:

1. El frontend pide un ticket: `POST /ws/ticket` (con Bearer).
2. Conecta a `wss://<host>/ws?ticket=<ticket>`.
3. El servidor valida el ticket, lo asocia al usuario y abre la conexión.

```jsonc
// POST /ws/ticket  (response)
{ "ticket": "<token-corto-de-un-solo-uso>", "expiresIn": 30 }
```

- El ticket debe ser **de corta vida y un solo uso**.
- En cada (re)conexión el frontend pide un ticket nuevo.

### 5.2 Formato de mensajes

Envoltura común: `{ "type": string, "payload": object }` (JSON). Todo se valida
con Zod; respetar nombres exactos.

**Cliente → Servidor**

```jsonc
// Enviar un mensaje (el servidor asigna id y senderId a partir del socket)
{ "type": "message.send",
  "payload": { "clientMessageId": "uuid", "conversationId": "c1",
               "content": "hola", "sentAt": "2026-06-22T09:10:00.000Z" } }

// Heartbeat
{ "type": "ping" }
```

**Servidor → Cliente**

```jsonc
// Confirmación del mensaje propio (concilia por clientMessageId)
{ "type": "message.ack",
  "payload": { "clientMessageId": "uuid", "id": "m10", "conversationId": "c1",
               "status": "sent", "createdAt": "2026-06-22T09:10:01.000Z" } }

// Mensaje nuevo (de otro participante; o eco a otras sesiones del propio usuario)
{ "type": "message.new",
  "payload": { "id": "m11", "clientMessageId": null, "conversationId": "c1",
               "senderId": "u2", "content": "qué tal", "status": "sent",
               "createdAt": "2026-06-22T09:10:05.000Z" } }

// Error
{ "type": "error",
  "payload": { "code": "INVALID_PAYLOAD", "message": "…", "clientMessageId": "uuid" } }

// Respuesta al heartbeat
{ "type": "pong" }
```

### 5.3 Responsabilidades del servidor WS

- En `message.send`: validar pertenencia a la conversación, **persistir** el
  mensaje (asignar `id`, `senderId` desde el socket, `createdAt`), responder
  `message.ack` al emisor y `message.new` a los demás participantes.
- El `clientMessageId` viaja en el `ack` para que el cliente concilie su mensaje
  optimista (y deduplique posibles ecos).
- Responder `pong` a cada `ping`.

### 5.4 Reconexión / heartbeat (comportamiento del cliente)

- El cliente reconecta solo (backoff exponencial) y **pide un ticket nuevo** en
  cada intento.
- Envía `ping` periódicamente y espera `pong`; si no llega, asume conexión muerta
  y reconecta. (Si ustedes hacen su propio ping/keepalive, coordinémoslo.)

---

## 6. Resumen de endpoints

```
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /conversations
GET  /conversations/{id}
GET  /conversations/{id}/messages?cursor=&limit=
GET  /users?search=
POST /conversations            { userId }
POST /ws/ticket
WS   /ws?ticket=<ticket>       (message.send / ping  ↔  message.ack / message.new / error / pong)
```

---

## 7. Preguntas abiertas a confirmar

**Auth**

1. Tiempos de expiración de access y refresh. ¿El refresh **rota** en cada uso?
2. ¿`user` viaja en `login`/`refresh` o exponen `/auth/me`?
3. Claims del JWT utilizables por el frontend (id, nombre, avatar).
4. Formato de **error** (HTTP + shape JSON) para credenciales/token inválidos.

**REST**

5. Formato del **cursor** de mensajes y `limit` por defecto/máximo.
6. ¿`POST /conversations` con `{ userId }` o prefieren otra forma (p. ej.
   `/conversations/direct`)? ¿Idempotente (get-or-create)?
7. ¿`unreadCount` lo calculan ustedes? ¿Hay endpoint para **marcar como leído**?

**WebSocket**

8. ¿Aceptan el patrón de **ticket** (`POST /ws/ticket` + `?ticket=`)? Vida del ticket.
9. ¿`message.send` infiere `senderId` del socket (recomendado) o esperan otra cosa?
10. ¿Confirman `ack` por mensaje? ¿Hacen ping/keepalive propio?

**General**

11. URLs por entorno (dev / staging / prod).
12. ¿Presencia (online/last seen) e indicadores de lectura entran en v1 o después?

---

> Cuando confirmen, el cambio en el frontend es pequeño: el contrato está aislado
> en `src/lib/validation/*` y las implementaciones mock detrás de interfaces
> (`auth-backend`, `chat-backend`, socket), listas para cambiar por llamadas reales.
