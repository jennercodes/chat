---
name: tanstack-route
description: Cómo añadir o modificar rutas en este proyecto TanStack Start — file-based routing, grupo protegido `_authed` con guard de sesión, loaders que usan TanStack Query desde el router context, y params/search type-safe. Úsalo al crear pantallas o navegación (login, lista de chats, ventana de conversación) o al tocar `src/routes/`.
---

# Rutas en TanStack Start (este proyecto)

Las rutas viven en `src/routes/` (file-based). El árbol tipado se genera en
`src/routeTree.gen.ts` con `pnpm generate-routes` (en `dev` se regenera solo).
**No edites `routeTree.gen.ts` a mano.**

## Ruta básica

```tsx
// src/routes/login.tsx  ->  ruta "/login"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  return <div className="p-8">…</div>
}
```

En el componente usa los hooks de `Route`: `Route.useLoaderData()`,
`Route.useParams()`, `Route.useSearch()`, `Route.useNavigate()`.

## Convenciones de nombres de archivo

- `index.tsx` → ruta índice del segmento (`/`).
- `chat.$conversationId.tsx` → `/chat/$conversationId` (param dinámico
  `conversationId`).
- Prefijo `_` = **layout sin segmento de URL** (route group), ideal para guards
  y layouts compartidos. Ej.: `_authed`.
- Directorios también valen: `routes/_authed/route.tsx` (layout) +
  `routes/_authed/index.tsx`, `routes/_authed/chat.$conversationId.tsx`.

## Grupo protegido `_authed` (guard de sesión)

El layout pathless corre `beforeLoad` y redirige a `/login` si no hay sesión.
Sus hijos quedan protegidos automáticamente.

```tsx
// src/routes/_authed/route.tsx
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context, location }) => {
    // Ajustar a la API real del store/sesión (ver skill bff-auth).
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: () => <Outlet />,
})
```

```tsx
// src/routes/_authed/index.tsx  ->  ruta "/" (lista de conversaciones)
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/')({
  component: ConversationList,
})
```

## Loaders + TanStack Query (datos)

El router context expone `queryClient` (ver `src/router.tsx` y
`src/integrations/tanstack-query/root-provider.tsx`). Precarga en el loader y
consume con `useSuspenseQuery`/`useQuery` en el componente.

```tsx
export const Route = createFileRoute('/_authed/chat/$conversationId')({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(messagesQueryOptions(params.conversationId)),
  component: ConversationView,
})
```

Define las `queryOptions` (claves + `queryFn`) en `src/features/chat/` o
`src/lib/api/`, no inline en la ruta.

## Reglas

- Importa con el alias `#/*` (no rutas relativas largas).
- Si añades/renombras/borras archivos de ruta, corre `pnpm generate-routes`.
- Tras tocar rutas: `pnpm typecheck` debe quedar en verde (rutas y params son
  type-safe).
