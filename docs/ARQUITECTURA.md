# Chat — Arquitectura y Plan del Proyecto (Frontend)

> Documento vivo. Lo afinamos por fases. El backend nos entrega un **servicio de
> autenticación (JWT)** y un **WebSocket para los chats**; nosotros construimos
> toda la interfaz de usuario.

Última actualización: 2026-06-21

---

## 1. Visión general

Aplicación **web** de chat. Versión 1 (v1) enfocada en **mensajería 1:1 en
tiempo real** con login. Construida como app full-stack con **TanStack Start**,
donde el servidor (Nitro) actúa además como **BFF** (Backend-For-Frontend) para
proteger los tokens de autenticación.

| Decisión            | Valor                                           | Estado                     |
| ------------------- | ----------------------------------------------- | -------------------------- |
| Plataforma          | Web (navegador)                                 | ✅ Decidido                |
| Framework           | TanStack Start (React + TS)                     | ✅ Decidido                |
| Alcance v1          | Chat 1:1 básico                                 | ✅ Decidido                |
| UI                  | Tailwind + shadcn/ui                            | ✅ Decidido                |
| Auth                | JWT Bearer + refresh token (con expiración)     | ✅ Decidido                |
| Esquemas de datos   | **Los define el frontend** y se pasan a backend | 🟡 Propuesto (sección 8)   |
| Endpoints REST      | Tentativos, a confirmar con backend             | 🟡 Propuesto (sección 8)   |
| Protocolo WebSocket | Tentativo, a confirmar con backend              | 🟡 Propuesto (sección 7-8) |

---

## 2. Stack tecnológico

| Capa            | Elección                                              | Por qué                                                   |
| --------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Framework       | **TanStack Start** (v1)                               | Router type-safe + Vite + servidor Nitro (BFF)            |
| Lenguaje        | **TypeScript** (strict)                               | Tipado de extremo a extremo                               |
| Routing         | **TanStack Router** (incluido)                        | Rutas 100% type-safe, loaders integrados                  |
| Estado servidor | **TanStack Query**                                    | Caché de historial/conversaciones, reintentos, paginación |
| Estado cliente  | **Zustand**                                           | Conexión WS, sesión, estado de UI de chat                 |
| Tiempo real     | **WebSocket nativo** + cliente propio                 | Reconexión, heartbeat, cola offline, eventos tipados      |
| Estilos         | **Tailwind CSS**                                      | Utilidades, rápido y mantenible                           |
| Componentes     | **shadcn/ui**                                         | Accesibles, copiados al repo (control total)              |
| Formularios     | **React Hook Form + Zod**                             | Login/registro validado y tipado                          |
| Validación      | **Zod**                                               | Valida también payloads de API/WS en runtime              |
| Tests           | **Vitest + Testing Library** (+ Playwright e2e luego) | Unit + e2e                                                |
| Calidad         | **ESLint + Prettier**                                 | Estándar                                                  |
| Gestor paquetes | **pnpm**                                              | Rápido, eficiente en disco                                |

---

## 3. Por qué TanStack Start (validación y trade-offs)

**A favor:**

- **Routing type-safe de primera clase** (TanStack Router): rutas, params y
  search params tipados; menos bugs de navegación.
- **Servidor Nitro integrado** → lo usamos como **BFF**: el refresh token vive en
  una cookie `httpOnly` que JS nunca lee (mitiga XSS). Ver sección 6.
- Integración natural con **TanStack Query** (ya en el stack).
- v1.0 estable (marzo 2026), production-ready.

**Trade-offs a tener presentes:**

- Ahora **hay un servidor que desplegar** (no es un SPA estático puro). A cambio
  ganamos seguridad de tokens y un punto para proxiar/ocultar el backend.
- **No soporta React Server Components** todavía → no nos afecta (no los usamos).
- API aún evoluciona en minors → **fijamos versiones** (lockfile) y subimos
  versión de forma controlada.

> Alternativa descartada: SPA Vite puro. Más simple de desplegar, pero perdemos
> el BFF para los tokens y el routing type-safe integrado.

---

## 4. Estructura de carpetas (feature-based)

```
src/
  routes/                 # Rutas (TanStack Start file-based routing)
    __root.tsx            # Layout raíz + providers
    login.tsx             # Pantalla de login (pública)
    _authed/              # Grupo protegido (requiere sesión)
      index.tsx           # Lista de conversaciones
      chat.$conversationId.tsx   # Ventana de conversación
  server/                 # Funciones de servidor (BFF): proxy auth, set cookies
    auth.ts
  features/
    auth/                 # Hooks de sesión, guards, formularios
    chat/                 # Lista de conversaciones, ventana, burbujas, input
  lib/
    ws/                   # WebSocketClient (reconexión, heartbeat, cola, eventos)
    api/                  # Cliente HTTP + endpoints REST tipados
    validation/           # Esquemas Zod compartidos
  store/                  # Stores Zustand (sesión, conexión, mensajes)
  components/ui/          # shadcn/ui
  types/                  # Tipos del dominio (User, Conversation, Message)
```

---

## 5. Modelo de dominio (entidades)

```ts
// types/domain.ts

export interface User {
  id: string
  displayName: string
  avatarUrl?: string
  // presencia: opcional en v1, útil más adelante
  status?: 'online' | 'offline'
  lastSeenAt?: string // ISO 8601
}

export type MessageStatus =
  | 'sending' // optimista en cliente, sin ack del server
  | 'sent' // el server lo aceptó (ack)
  | 'delivered' // entregado al destinatario (futuro)
  | 'read' // leído por el destinatario (futuro)
  | 'failed' // falló el envío

export interface Message {
  id: string // id definitivo (lo asigna el server)
  clientMessageId: string // id generado en cliente para dedupe/optimista
  conversationId: string
  senderId: string
  content: string
  status: MessageStatus
  createdAt: string // ISO 8601
  editedAt?: string
}

export interface Conversation {
  id: string
  type: 'direct' // v1: solo 1:1. 'group' más adelante
  participants: User[] // en 1:1 son 2 usuarios
  lastMessage?: Message
  unreadCount: number
  updatedAt: string
}
```

---

## 6. Autenticación (JWT Bearer + refresh)

**Decidido:** JWT Bearer + refresh token con expiración.

### Estrategia de almacenamiento (recomendada) — BFF

Para minimizar riesgo de XSS y robo de tokens, aprovechamos el servidor de Start:

- **Access token (corta vida, p. ej. 5–15 min):** se mantiene **en memoria** en el
  cliente (store de Zustand). No se persiste en `localStorage`.
- **Refresh token (larga vida):** vive en una **cookie `httpOnly` + `Secure` +
  `SameSite`**, gestionada por el **servidor BFF**. JavaScript del navegador
  **nunca** lo lee → resistente a XSS.

### Flujo

```
1. Login
   Cliente → BFF (/api/auth/login)  → Backend (/auth/login)
   Backend devuelve { accessToken, refreshToken, user }
   BFF guarda refreshToken en cookie httpOnly y responde { accessToken, user }

2. Peticiones autenticadas
   Cliente añade  Authorization: Bearer <accessToken>  a cada request al backend
   (o vía BFF como proxy).

3. Access token expirado (401)
   Cliente → BFF (/api/auth/refresh)  (envía la cookie automáticamente)
   BFF → Backend (/auth/refresh con el refresh token)
   Devuelve nuevo accessToken. Se reintenta la request original 1 vez.

4. Logout
   Cliente → BFF (/api/auth/logout) → Backend revoca refresh; BFF borra cookie.
```

> **Alternativa más simple (menos segura):** guardar ambos tokens en el cliente y
> manejar el refresh sin BFF. Sirve para prototipar, pero recomendamos el BFF
> desde el inicio porque el costo extra es bajo (ya tenemos el servidor).

### Rutas protegidas

Guard en el grupo `_authed/`: si no hay sesión válida (ni se puede refrescar),
redirige a `/login`. Hidratación de sesión al cargar la app vía `/api/auth/me`.

---

## 7. Capa de tiempo real (WebSocket)

El corazón del chat. Cliente reutilizable en `lib/ws/`.

**Responsabilidades del `WebSocketClient`:**

- **Conexión singleton** y ciclo de vida (connect/disconnect).
- **Reconexión automática** con backoff exponencial + jitter.
- **Heartbeat** (ping/pong) para detectar conexiones muertas.
- **Cola de envío** en memoria: si la conexión cae, los mensajes pendientes se
  reenvían al reconectar.
- **Eventos tipados** (entrada/salida) validados con Zod.
- Expuesto a React vía un **hook/context** (`useChatSocket`).

**Autenticación del WebSocket (a confirmar con backend):**
Los navegadores no permiten cabeceras custom en el handshake WS. Opciones:

1. **(Recomendada) Ticket de corta vida:** el cliente pide un ticket por REST
   (`POST /ws/ticket`, autenticado con Bearer) y conecta con `wss://.../ws?ticket=…`.
   El ticket caduca en segundos y es de un solo uso.
2. **Token en primer mensaje:** conectar y enviar `{ type: 'auth', accessToken }`
   como primer frame; el server cierra si no llega a tiempo.
3. Token en query string (más simple, pero el token puede quedar en logs).

**Envío optimista de mensajes:**

1. Usuario envía → se crea `Message` con `clientMessageId` y `status: 'sending'`,
   se pinta de inmediato en la UI.
2. Se manda por WS (o se encola si está desconectado).
3. Llega `message.ack` con el `id` definitivo → se concilia por `clientMessageId`
   y pasa a `status: 'sent'`.
4. Si falla / timeout → `status: 'failed'` con opción de reintentar.
5. `clientMessageId` evita duplicados si el server reenvía el eco del mensaje.

---

## 8. Contrato de datos para BACKEND (propuesto)

> Esto es lo que pasamos al equipo de backend para que lo tengan en cuenta.
> Marcado como propuesta; ajustamos según su feedback.

### 8.1 Endpoints REST (tentativos)

| Método | Ruta                                         | Descripción                          | Auth           |
| ------ | -------------------------------------------- | ------------------------------------ | -------------- |
| POST   | `/auth/login`                                | Login con credenciales               | Pública        |
| POST   | `/auth/refresh`                              | Nuevo access token desde refresh     | Cookie/refresh |
| POST   | `/auth/logout`                               | Revoca sesión                        | Bearer         |
| GET    | `/auth/me`                                   | Perfil del usuario actual            | Bearer         |
| GET    | `/users?search=`                             | Buscar usuarios para iniciar chat    | Bearer         |
| GET    | `/conversations`                             | Lista de conversaciones del usuario  | Bearer         |
| POST   | `/conversations`                             | Crear/obtener conversación 1:1       | Bearer         |
| GET    | `/conversations/:id/messages?cursor=&limit=` | Historial paginado (cursor)          | Bearer         |
| POST   | `/ws/ticket`                                 | Ticket corto para abrir el WebSocket | Bearer         |

### 8.2 Ejemplos de payloads (REST)

```jsonc
// POST /auth/login  (request)
{ "email": "user@example.com", "password": "••••••" }

// POST /auth/login  (response)
{
  "accessToken": "<jwt>",
  "expiresIn": 900,            // segundos
  "refreshToken": "<token>",   // el BFF lo mueve a cookie httpOnly
  "user": { "id": "u1", "displayName": "Ana", "avatarUrl": null }
}

// GET /conversations  (response)
{
  "items": [
    {
      "id": "c1",
      "type": "direct",
      "participants": [ { "id": "u1", "displayName": "Ana" }, { "id": "u2", "displayName": "Beto" } ],
      "lastMessage": { "id": "m9", "senderId": "u2", "content": "hola", "createdAt": "2026-06-21T10:00:00Z", "status": "sent" },
      "unreadCount": 2,
      "updatedAt": "2026-06-21T10:00:00Z"
    }
  ]
}

// GET /conversations/:id/messages?cursor=&limit=30  (response, paginación por cursor)
{
  "items": [ /* Message[] en orden cronológico */ ],
  "nextCursor": "eyJvZmZzZXQiOjMwfQ"   // null si no hay más
}
```

### 8.3 Protocolo WebSocket (propuesto)

Formato común: `{ "type": string, "payload": object }`. Validado con Zod.

**Cliente → Servidor**

```jsonc
// Enviar mensaje
{ "type": "message.send",
  "payload": { "clientMessageId": "uuid", "conversationId": "c1", "content": "hola", "sentAt": "2026-06-21T10:00:00Z" } }

// Heartbeat
{ "type": "ping" }

// (Futuro) typing
{ "type": "typing.start", "payload": { "conversationId": "c1" } }
```

**Servidor → Cliente**

```jsonc
// Confirmación de un mensaje propio (concilia por clientMessageId)
{ "type": "message.ack",
  "payload": { "clientMessageId": "uuid", "id": "m10", "conversationId": "c1", "status": "sent", "createdAt": "2026-06-21T10:00:01Z" } }

// Mensaje nuevo (de otro usuario, o eco en otra sesión)
{ "type": "message.new",
  "payload": { "id": "m11", "clientMessageId": null, "conversationId": "c1", "senderId": "u2", "content": "qué tal", "status": "sent", "createdAt": "2026-06-21T10:00:05Z" } }

// Error
{ "type": "error",
  "payload": { "code": "INVALID_PAYLOAD", "message": "…", "clientMessageId": "uuid" } }

{ "type": "pong" }

// (Futuro) presence / typing / read receipts
```

---

## 9. Plan por fases

### Fase 0 — Scaffold ✅ (commit `0acc845`)

- [x] Proyecto TanStack Start + TypeScript (strict) + pnpm
- [x] Tailwind + shadcn/ui configurados
- [x] ESLint + Prettier
- [x] Estructura de carpetas (sección 4)
- [x] Variables de entorno (`.env` / `.env.example`): URL backend, URL WS
- [x] Tipos de dominio (`types/domain.ts`) + esquemas Zod base (`lib/validation/`)

> Verificado: `pnpm typecheck`, `pnpm lint` y `pnpm build` (cliente + SSR) en
> verde; el dev server sirve HTML SSR (HTTP 200). Scripts disponibles: `dev`,
> `build`, `preview`, `test`, `lint`, `format`, `check`, `typecheck`,
> `generate-routes`. Alias de import del proyecto: `#/*` → `src/*`.

### Fase 1 — Autenticación ✅ (commit `a77d7a3`)

- [x] Pantalla de login (React Hook Form + Zod + shadcn)
- [x] BFF: server functions `login`/`getSession`/`refresh`/`logout` con cookie
      httpOnly (`src/server/auth.ts`)
- [x] Store de sesión (Zustand) con access token en memoria (`src/store/auth.ts`)
- [x] Cliente HTTP con interceptor (Bearer + refresh en 401) (`src/lib/api/client.ts`)
- [x] Rutas protegidas (`_authed/`) + hidratación de sesión desde la cookie en el
      `beforeLoad` del root

> **Backend simulado:** no hay servicio real todavía. El BFF habla con un mock en
> memoria aislado tras la interfaz `AuthBackend` (`src/server/auth-backend.ts`);
> para conectar el backend real se cambia esa única implementación por `fetch`.
> Usuarios mock: `ana@chat.dev` / `password`, `beto@chat.dev` / `password`.
> Verificado: typecheck, lint, build (cliente + SSR) y tests (vitest) en verde; el
> SSR redirige `/` → `/login` sin sesión.
>
> Pendiente menor (cuando haya más rutas protegidas): recordar el destino
> original tras el login (deep-link redirect); hoy siempre vuelve a `/`.

### Fase 2 — Capa WebSocket ✅ (commit `31c70bd`)

- [x] `ChatSocketClient` (reconexión backoff + jitter, heartbeat, cola offline)
- [x] Autenticación del WS por **ticket** (`getWsTicketFn`, mock)
- [x] Provider + hook `useChatSocket` + indicador de estado de conexión
- [x] Eventos tipados validados con Zod (`serverEventSchema`)

> **Servidor WS simulado** (`src/lib/ws/mock-socket.ts`): responde `ack`/`echo`/
> `pong` mientras no hay backend. Se desactiva con `VITE_WS_MOCK=false` para usar
> el WebSocket nativo. Verificado: typecheck, lint, build y 6 tests del cliente
> (connect/ticket, cola+flush, despacho/validación, heartbeat, reconexión).

### Fase 3 — Chat 1:1 ⬜

- [ ] Lista de conversaciones (TanStack Query)
- [ ] Buscar usuario e iniciar conversación
- [ ] Ventana de conversación + historial paginado (cursor)
- [ ] Envío optimista (sending → sent/failed) con dedupe por `clientMessageId`
- [ ] Auto-scroll, agrupado por fecha, estados de mensaje

### Fase 4 — Pulido ⬜

- [ ] Estados vacíos / carga / error
- [ ] Responsive (móvil ↔ desktop)
- [ ] Reintento de mensajes fallidos
- [ ] Tests (Vitest + Testing Library; Playwright e2e del flujo principal)

> Más adelante (post-v1): grupos, presencia online, indicador de "escribiendo…",
> confirmaciones de lectura, adjuntos/imágenes, reacciones, notificaciones push.

---

## 10. Preguntas abiertas para el equipo de backend

**Auth**

1. ¿Tiempos de expiración de access y refresh token? ¿Rotación de refresh?
2. ¿Formato exacto de respuesta de `/auth/login` y `/auth/refresh`?
3. ¿Claims dentro del JWT que el frontend pueda usar (id, nombre, avatar)?

**WebSocket** 4. ¿Cómo autenticamos el handshake? (ticket recomendado vs token en primer frame) 5. ¿Formato final de los mensajes? ¿Hay `ack` de confirmación? 6. ¿El historial llega por REST (paginado) o por WS al conectar? 7. ¿Esperan que el cliente haga heartbeat (ping/pong)? ¿Cada cuánto?

**General** 8. URLs de entornos (dev / staging / prod) y configuración de CORS. 9. ¿Paginación por cursor o por offset para el historial?

---

## 11. Convenciones

- **TypeScript strict**; nada de `any` sin justificar.
- **Zod** valida todo dato que cruza una frontera (API REST y WS).
- Identificadores y código en **inglés**; documentación en **español**.
- Commits: Conventional Commits.
- Componentes pequeños y por feature; lógica de datos en hooks/loaders.
