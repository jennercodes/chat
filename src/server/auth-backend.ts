/**
 * Adaptador de autenticación que el BFF (`server/auth.ts`) usa para hablar con el
 * backend real (Spring) vía `fetch`. Solo corre en el servidor (Nitro).
 *
 * Contrato: docs/contrato-backend.md §2 (auth JWT real).
 * - `POST /auth/login`   { email, password }   (público) -> AuthResponse | 401
 * - `POST /auth/refresh` { refreshToken }       (público) -> AuthResponse | 401
 * - `POST /auth/logout`  (Bearer <accessToken>)           -> 204
 *
 * El BFF guarda el `refreshToken` en una cookie httpOnly y solo reenvía
 * `accessToken` + `user` al cliente.
 */
import { env } from '#/env'
import { authResponseSchema } from '#/lib/validation/auth'
import type { User } from '#/types/domain'

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: User
}

export interface AuthBackend {
  /** Valida credenciales y emite tokens. `null` si son inválidas. */
  login: (input: {
    email: string
    password: string
  }) => Promise<AuthSession | null>
  /** Rota el refresh token y emite tokens nuevos. `null` si es inválido. */
  refresh: (refreshToken: string) => Promise<AuthSession | null>
  /** Cierra sesión en el backend, autenticado con el access token (Bearer). */
  logout: (accessToken: string) => Promise<void>
}

function authUrl(path: string): string {
  return `${env.VITE_API_URL}${path}`
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(authUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Valida la respuesta del backend y la mapea a `AuthSession`. */
async function parseSession(res: Response): Promise<AuthSession | null> {
  if (!res.ok) return null // 401/403 = credenciales o refresh inválidos
  const data = authResponseSchema.parse(await res.json())
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  }
}

export const httpAuthBackend: AuthBackend = {
  async login(input) {
    return parseSession(await postJson('/auth/login', input))
  },

  async refresh(refreshToken) {
    return parseSession(await postJson('/auth/refresh', { refreshToken }))
  },

  async logout(accessToken) {
    // Best-effort: si el backend falla, igual borramos la cookie en el BFF.
    await fetch(authUrl('/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined)
  },
}

/** Implementación activa del backend de auth. */
export const authBackend: AuthBackend = httpAuthBackend
