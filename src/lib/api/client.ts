import { env } from '#/env'
import { refreshFn } from '#/server/auth'
import { getAccessToken, useAuthStore } from '#/store/auth'

/**
 * Cliente HTTP hacia la API REST del backend. Añade `Authorization: Bearer` con
 * el access token en memoria y, si recibe 401, intenta UN refresh y reintenta.
 *
 * Aún no hay endpoints REST protegidos (llegan en la Fase 3); este es el
 * esqueleto reutilizable. El contrato es tentativo: las llamadas concretas
 * vivirán en `src/features/*` o `src/lib/api/*`.
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

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let res = await fetch(url(path), withAuth(init))
  if (res.status === 401) {
    const session = await refreshFn()
    if (session) {
      useAuthStore.getState().setSession(session)
      res = await fetch(url(path), withAuth(init)) // reintento único
    } else {
      useAuthStore.getState().clear()
    }
  }
  return res
}
