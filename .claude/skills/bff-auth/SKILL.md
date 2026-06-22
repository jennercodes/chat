---
name: bff-auth
description: Patrón de autenticación BFF de este proyecto — JWT Bearer + refresh, access token en memoria (Zustand), refresh token en cookie httpOnly gestionada por server functions de TanStack Start, e interceptor HTTP que refresca en 401. Úsalo en la Fase 1 (login, sesión, rutas protegidas) o al tocar `src/server/auth*`, `src/features/auth/` o `src/lib/api/`.
---

# Autenticación BFF (este proyecto)

Detalle y diagrama de flujo en `docs/ARQUITECTURA.md` §6. Resumen del patrón:

- **Access token (corta vida):** en memoria, en un store de Zustand
  (`src/store/`). **Nunca** en `localStorage`/`sessionStorage`.
- **Refresh token (larga vida):** en una cookie **`httpOnly` + `Secure` +
  `SameSite=Lax`**, que JS del navegador no puede leer. La gestiona el **BFF**
  (server functions de Start, `src/server/`).
- El cliente llama a las server functions del BFF para login/refresh/logout; el
  BFF habla con el backend real y mueve el refresh token a la cookie.

## Estructura

- `src/server/auth.ts` — server functions: `login`, `refresh`, `logout`, `me`.
- `src/store/auth.ts` — store Zustand: `accessToken`, `user`, `isAuthenticated`,
  acciones `setSession`, `clear`.
- `src/lib/api/client.ts` — fetch con `Authorization: Bearer` + reintento con
  refresh en 401.
- `src/features/auth/` — formulario de login (React Hook Form + Zod) y hooks.

## Server function (patrón)

```ts
// src/server/auth.ts
import { createServerFn } from '@tanstack/react-start'
import { loginSchema } from '#/lib/validation/auth'
import { env } from '#/env' // OJO: la URL del backend para el BFF es server-side

export const login = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => loginSchema.parse(raw))
  .handler(async ({ data }) => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('login failed')
    const { accessToken, refreshToken, user } = await res.json()

    // Guardar refreshToken en cookie httpOnly (ver nota de import abajo).
    setHttpOnlyCookie('refresh_token', refreshToken)

    return { accessToken, user } // el refresh NUNCA viaja al JS del cliente
  })
```

> **Verifica la API exacta antes de implementar:** los helpers de cookies y
> request del servidor de Start (`setCookie`/`getCookie`/`getWebRequest` o
> equivalentes) y la ruta de import (`@tanstack/react-start/server`) pueden
> cambiar entre versiones. Confirma contra la versión instalada
> (`node_modules/@tanstack/react-start`) o `pnpm doc react-start`. La URL del
> backend para el BFF es **server-side** (`process.env`), no una `VITE_`.

## Interceptor HTTP (refresh en 401)

```ts
// src/lib/api/client.ts (idea)
async function apiFetch(path: string, init?: RequestInit) {
  let res = await fetch(url(path), withAuth(init)) // añade Bearer desde el store
  if (res.status === 401 && (await tryRefresh())) {
    res = await fetch(url(path), withAuth(init)) // reintenta UNA vez
  }
  return res
}
```

`tryRefresh()` llama a la server function `refresh` (envía la cookie httpOnly
automáticamente), actualiza el access token en el store y devuelve `true/false`.
Evita bucles: máximo **un** reintento; si el refresh falla → `clear()` + redirige
a `/login`.

## Rutas protegidas

El guard vive en el layout `_authed` (ver skill `tanstack-route`). Hidrata la
sesión al cargar la app llamando a `me` (`/auth/me`).

## Reglas

- El contrato de auth es **tentativo** (doc §10): aísla forma de payloads y
  endpoints en `#/lib/validation/auth` y `#/lib/api` para cambiarlos fácil.
- Valida con Zod las respuestas del backend antes de usarlas.
- Cookies siempre `httpOnly`, `Secure` (en prod) y `SameSite`.
