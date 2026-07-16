import { env } from '#/env'
import { refreshFn } from '#/server/auth'
import { getAccessToken, useAuthStore } from '#/store/auth'
import type { AuthResult } from '#/lib/validation/auth'

/**
 * Cliente HTTP hacia la API REST del backend. Añade `Authorization: Bearer` con
 * el access token en memoria y, si recibe 401, intenta UN refresh y reintenta.
 * Lo usan los módulos `lib/api/*` (chat, ws-ticket) desde el navegador.
 */

function url(path: string): string {
  return `${env.VITE_API_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function withAuth(init?: RequestInit): RequestInit {
  const token = getAccessToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

/**
 * Refresh con "single-flight": si varias peticiones reciben 401 a la vez (p. ej.
 * al expirar el access token de ~15 min), comparten UN solo refresh en vuelo en
 * lugar de disparar varios en paralelo (que podrían invalidarse mutuamente si el
 * backend rota el refresh token).
 */
let inflightRefresh: Promise<AuthResult | null> | null = null

function refreshOnce(): Promise<AuthResult | null> {
  inflightRefresh ??= refreshFn().finally(() => {
    inflightRefresh = null
  })
  return inflightRefresh
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let res = await fetch(url(path), withAuth(init))
  if (res.status === 401) {
    const session = await refreshOnce()
    if (session) {
      useAuthStore.getState().setSession(session)
      res = await fetch(url(path), withAuth(init)) // reintento único
    } else {
      useAuthStore.getState().clear()
    }
  }
  return res
}
