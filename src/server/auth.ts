import { createServerFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { loginSchema } from '#/lib/validation/auth'
import type { AuthResult } from '#/lib/validation/auth'
import { authBackend } from './auth-backend'

/**
 * BFF de autenticación (server functions de TanStack Start).
 *
 * - El refresh token se guarda en una cookie `httpOnly` que el JS del cliente
 *   nunca lee. El access token se devuelve al cliente para vivir en memoria.
 * - Hoy el BFF habla con un backend simulado (`auth-backend.ts`); el patrón no
 *   cambia cuando se conecte el backend real.
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

/** Login: valida credenciales, setea cookie httpOnly y devuelve access + user. */
export const loginFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => loginSchema.parse(raw))
  .handler(async ({ data }): Promise<AuthResult> => {
    const result = await authBackend.login(data)
    if (!result) throw new Error('Credenciales inválidas')
    setRefreshCookie(result.refreshToken)
    return { accessToken: result.accessToken, user: result.user }
  })

/** Hidrata la sesión desde la cookie (sin rotar). `null` si no hay sesión. */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthResult | null> => {
    const token = getCookie(REFRESH_COOKIE)
    if (!token) return null
    const result = await authBackend.verify(token)
    if (!result) {
      clearRefreshCookie()
      return null
    }
    return result
  },
)

/** Refresh: rota el refresh token y devuelve un access token nuevo. */
export const refreshFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<AuthResult | null> => {
    const token = getCookie(REFRESH_COOKIE)
    if (!token) return null
    const result = await authBackend.refresh(token)
    if (!result) {
      clearRefreshCookie()
      return null
    }
    setRefreshCookie(result.refreshToken)
    return { accessToken: result.accessToken, user: result.user }
  },
)

/** Logout: revoca el refresh token y borra la cookie. */
export const logoutFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ ok: true }> => {
    const token = getCookie(REFRESH_COOKIE)
    if (token) await authBackend.logout(token)
    clearRefreshCookie()
    return { ok: true }
  },
)
