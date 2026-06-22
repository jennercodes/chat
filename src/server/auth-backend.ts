/**
 * MOCK del backend de autenticación (en memoria).
 *
 * Implementa la interfaz `AuthBackend` que consume el BFF (`server/auth.ts`).
 * Cuando exista el backend real, crea otra implementación que haga `fetch` a sus
 * endpoints (`/auth/login`, `/auth/refresh`, …) y expórtala como `authBackend`
 * en lugar de `mockAuthBackend`. El contrato es tentativo (docs/ARQUITECTURA.md).
 *
 * Nota: el almacén de refresh tokens es en memoria → se reinicia al reiniciar el
 * servidor (o con HMR en dev). Aceptable para el mock: basta volver a entrar.
 *
 * Usuarios de prueba:
 *   ana@chat.dev  / password
 *   beto@chat.dev / password
 */
import { randomUUID } from 'node:crypto'
import type { User } from '#/types/domain'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthBackend {
  /** Valida credenciales y emite tokens. `null` si son inválidas. */
  login: (input: {
    email: string
    password: string
  }) => Promise<(AuthTokens & { user: User }) | null>
  /** Valida el refresh token y emite un access token nuevo SIN rotarlo. */
  verify: (
    refreshToken: string,
  ) => Promise<{ accessToken: string; user: User } | null>
  /** Rota el refresh token y emite tokens nuevos. `null` si es inválido. */
  refresh: (
    refreshToken: string,
  ) => Promise<(AuthTokens & { user: User }) | null>
  /** Revoca el refresh token (logout). */
  logout: (refreshToken: string) => Promise<void>
}

// --- Datos mock -------------------------------------------------------------

interface MockUser extends User {
  email: string
  password: string
}

const MOCK_USERS: Array<MockUser> = [
  { id: 'u1', displayName: 'Ana', email: 'ana@chat.dev', password: 'password' },
  {
    id: 'u2',
    displayName: 'Beto',
    email: 'beto@chat.dev',
    password: 'password',
  },
]

// refreshToken -> userId (en memoria).
const refreshStore = new Map<string, string>()

function toPublicUser(u: MockUser): User {
  return { id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl }
}

function newAccessToken(userId: string): string {
  return `mock.${userId}.${randomUUID()}`
}

function issueTokens(userId: string): AuthTokens {
  const refreshToken = randomUUID()
  refreshStore.set(refreshToken, userId)
  return { accessToken: newAccessToken(userId), refreshToken }
}

function findById(userId: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === userId)
}

export const mockAuthBackend: AuthBackend = {
  async login({ email, password }) {
    const found = MOCK_USERS.find(
      (u) => u.email === email.toLowerCase().trim() && u.password === password,
    )
    if (!found) return null
    return { ...issueTokens(found.id), user: toPublicUser(found) }
  },

  async verify(refreshToken) {
    const userId = refreshStore.get(refreshToken)
    if (!userId) return null
    const found = findById(userId)
    if (!found) return null
    return { accessToken: newAccessToken(userId), user: toPublicUser(found) }
  },

  async refresh(refreshToken) {
    const userId = refreshStore.get(refreshToken)
    if (!userId) return null
    const found = findById(userId)
    if (!found) return null
    refreshStore.delete(refreshToken) // rotación
    return { ...issueTokens(found.id), user: toPublicUser(found) }
  },

  async logout(refreshToken) {
    refreshStore.delete(refreshToken)
  },
}

/** Implementación activa del backend de auth. Swap aquí por la real. */
export const authBackend: AuthBackend = mockAuthBackend
