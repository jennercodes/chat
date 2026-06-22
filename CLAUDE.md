# CLAUDE.md

Interfaz **web** de un chat. El backend (equipo aparte) entrega un **servicio de
autenticación JWT** y un **WebSocket** para los mensajes; en este repo vive
**solo el frontend**.

> **Fuente de verdad de arquitectura, contrato de datos y roadmap:**
> [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Léelo antes de implementar una fase.

## Stack

- **TanStack Start** (React 19 + TypeScript `strict`) — Router + Query incluidos
- **Tailwind v4 + shadcn/ui** (estilo `new-york`, iconos `lucide`)
- **Zustand** (estado cliente) + **TanStack Query** (estado servidor)
- **t3env + Zod** (env y validación) · **React Hook Form** (formularios)
- **Vitest + Testing Library** · **ESLint + Prettier** · **pnpm**

## Comandos

- `pnpm dev` — dev server (puerto 3000)
- `pnpm build` / `pnpm preview`
- `pnpm typecheck` — `tsc --noEmit` (debe quedar en verde)
- `pnpm lint` · `pnpm format` (prettier + `eslint --fix`)
- `pnpm test` — Vitest
- `pnpm generate-routes` — regenera `routeTree.gen.ts` tras añadir/mover rutas

**Antes de commitear:** `pnpm typecheck && pnpm lint && pnpm build`.

## Convenciones

- **Alias de import: `#/*` → `src/*`** (definido en `package.json` `imports` y
  `tsconfig.json`). Úsalo siempre; no uses rutas relativas largas ni `@/`.
- **Zod es la fuente de verdad de los tipos.** Define esquemas en
  `src/lib/validation/` e infiere los tipos con `z.infer`. Valida todo dato que
  cruza una frontera (REST y WebSocket). Los tipos de dominio se re-exportan en
  `#/types/domain`.
- **Estructura feature-based** (detalle en `docs/ARQUITECTURA.md` §4):
  - `src/routes/` rutas file-based · `src/server/` server functions (BFF)
  - `src/features/{auth,chat}/` UI + lógica por feature
  - `src/lib/{ws,api,validation}/` · `src/store/` (Zustand) · `src/components/ui/` (shadcn)
- **TS strict** con `noUnusedLocals` y `noUnusedParameters`: nada de imports o
  variables sin usar (rompen `tsc`).
- ESLint: `import/order` y `sort-imports` están **desactivados** → no reordenes
  imports por estética.
- Estilos con Tailwind; combina clases con `cn()` de `#/lib/utils`.

## Autenticación (resumen; detalle en doc §6)

JWT **Bearer + refresh**. **Access token en memoria** (Zustand). **Refresh token
en cookie `httpOnly`** gestionada por el **BFF** (server functions de Start).
Nunca guardes tokens en `localStorage`. Ver skill `bff-auth`.

## Variables de entorno

- Cliente (prefijo `VITE_`, validadas en `src/env.ts`): `VITE_API_URL`,
  `VITE_WS_URL`, `VITE_APP_TITLE?`. Copia `.env.example` → `.env`.
- Las URLs son placeholders locales hasta que backend confirme (doc §10).

## Gotchas

- pnpm 11 bloquea build scripts → aprobados en `pnpm-workspace.yaml`
  (`allowBuilds`). Si un paquete nuevo necesita build, añádelo ahí.
- Tras crear/renombrar rutas corre `pnpm generate-routes` (el plugin de Start
  también lo regenera en `dev`).
- El contrato REST/WS es **tentativo** hasta confirmación de backend; manténlo
  aislado en `src/lib/api/` y `src/lib/validation/ws.ts` para cambiarlo fácil.

## Skills del proyecto (`.claude/skills/`)

- **`tanstack-route`** — añadir/modificar rutas (incl. grupo protegido `_authed`)
- **`shadcn-component`** — añadir y usar componentes shadcn/ui
- **`bff-auth`** — patrón BFF de autenticación (cookies httpOnly, refresh)
- **`websocket-client`** — capa de WebSocket (reconexión, optimista, Zod)

## Estado

- **Fase 0 (scaffold) ✅ completada.** Siguiente: **Fase 1 (autenticación)**.
  Checklist por fases en `docs/ARQUITECTURA.md` §9.
