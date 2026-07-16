import { createServerFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { loginSchema, logoutInputSchema } from '#/lib/validation/auth'
import type { AuthResult } from '#/lib/validation/auth'
import { authBackend } from './auth-backend'

/**
 * BFF de autenticación (server functions de TanStack Start).
 *
 * - El refresh token se guarda en una cookie `httpOnly` que el JS del cliente
 *   nunca lee. El access token se devuelve al cliente para vivir en memoria.
 * - El BFF habla con el backend real (`auth-backend.ts`) vía `fetch`. El resto de
 *   la API REST del chat la llama el navegador directo con Bearer (`lib/api/`).
 */

export const REFRESH_COOKIE = 'refresh_token'
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7 // 7 días

function setRefreshCookie(token: string): void {
  setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  })
}

function clearRefreshCookie(): void {
  deleteCookie(REFRESH_COOKIE, { path: '/' })
}

/**
 * Lee el refresh de la cookie, lo rota contra el backend, actualiza la cookie y
 * devuelve access + user. `null` si no hay cookie o el refresh es inválido (en
 * cuyo caso limpia la cookie). Base de la hidratación y del refresh en 401.
 */
async function rotateSession(): Promise<AuthResult | null> {
  const token = getCookie(REFRESH_COOKIE)
  if (!token) return null
  const result = await authBackend.refresh(token)
  if (!result) {
    clearRefreshCookie()
    return null
  }
  setRefreshCookie(result.refreshToken)
  return { accessToken: result.accessToken, user: result.user }
}

/** Login: valida credenciales, setea cookie httpOnly y devuelve access + user. */
export const loginFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => loginSchema.parse(raw))
  .handler(async ({ data }): Promise<AuthResult> => {
    const result = await authBackend.login(data)
    if (!result) throw new Error('Credenciales inválidas')
    setRefreshCookie(result.refreshToken)
    return { accessToken: result.accessToken, user: result.user }
  })

/**
 * Hidrata la sesión desde la cookie. Con el backend real no hay endpoint de
 * validación sin rotar, así que rota el refresh (ver docs/contrato-backend.md §3).
 * `null` si no hay sesión.
 */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  (): Promise<AuthResult | null> => rotateSession(),
)

/** Refresh: rota el refresh token y devuelve un access token nuevo. */
export const refreshFn = createServerFn({ method: 'POST' }).handler(
  (): Promise<AuthResult | null> => rotateSession(),
)

/**
 * Logout: cierra sesión en el backend (con el access token que reenvía el
 * cliente, Bearer) y borra la cookie httpOnly. El borrado de cookie es lo
 * esencial y ocurre siempre, aunque la llamada al backend falle.
 */
export const logoutFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => logoutInputSchema.parse(raw))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    if (data.accessToken) await authBackend.logout(data.accessToken)
    clearRefreshCookie()
    return { ok: true }
  })
