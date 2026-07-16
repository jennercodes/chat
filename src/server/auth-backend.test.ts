import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpAuthBackend } from './auth-backend'

/**
 * Prueba el adaptador `fetch` contra el backend real: URLs, método, cuerpo y
 * mapeo/validación de la respuesta. El `fetch` global se stubea.
 */

const OK_BODY = {
  accessToken: 'jwt-access',
  refreshToken: 'refresh-1',
  expiresIn: 900,
  user: { id: 'u1', displayName: 'Ana', avatarUrl: null },
}

function stubFetch(res: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => res as unknown as Response)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('httpAuthBackend', () => {
  it('login hace POST /auth/login con las credenciales y mapea la sesión', async () => {
    const fetchMock = stubFetch({ ok: true, json: async () => OK_BODY })

    const session = await httpAuthBackend.login({
      email: 'ana@chat.dev',
      password: 'password',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://localhost:8080/auth/login')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'ana@chat.dev',
      password: 'password',
    })
    expect(session).toEqual({
      accessToken: 'jwt-access',
      refreshToken: 'refresh-1',
      user: { id: 'u1', displayName: 'Ana', avatarUrl: null },
    })
  })

  it('login con credenciales inválidas (401) devuelve null', async () => {
    stubFetch({ ok: false, status: 401 })
    expect(
      await httpAuthBackend.login({ email: 'x@chat.dev', password: 'bad' }),
    ).toBeNull()
  })

  it('refresh hace POST /auth/refresh con el refreshToken en el body', async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: async () => ({ ...OK_BODY, refreshToken: 'refresh-2' }),
    })

    const session = await httpAuthBackend.refresh('refresh-1')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://localhost:8080/auth/refresh')
    expect(JSON.parse(init?.body as string)).toEqual({ refreshToken: 'refresh-1' })
    expect(session?.refreshToken).toBe('refresh-2')
  })

  it('logout hace POST /auth/logout con Bearer y no lanza si el backend falla', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      throw new Error('network')
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpAuthBackend.logout('access-xyz')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-xyz' }),
      }),
    )
  })
})
