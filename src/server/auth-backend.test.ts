import { describe, expect, it } from 'vitest'
import { mockAuthBackend } from './auth-backend'

/** Afirma que un valor no es null/undefined y lo devuelve (evita el operador `!`). */
function must<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message)
  return value
}

describe('mockAuthBackend', () => {
  it('login con credenciales válidas devuelve tokens y usuario', async () => {
    const res = must(
      await mockAuthBackend.login({ email: 'ana@chat.dev', password: 'password' }),
      'login debería tener éxito',
    )
    expect(res.user.displayName).toBe('Ana')
    expect(res.accessToken).toMatch(/^mock\.u1\./)
    expect(res.refreshToken).toBeTruthy()
  })

  it('login es case-insensitive en el email y recorta espacios', async () => {
    const res = await mockAuthBackend.login({
      email: '  ANA@Chat.dev  ',
      password: 'password',
    })
    expect(res?.user.id).toBe('u1')
  })

  it('login con credenciales inválidas devuelve null', async () => {
    expect(
      await mockAuthBackend.login({ email: 'ana@chat.dev', password: 'mala' }),
    ).toBeNull()
    expect(
      await mockAuthBackend.login({ email: 'nadie@chat.dev', password: 'password' }),
    ).toBeNull()
  })

  it('verify valida el refresh token SIN rotarlo', async () => {
    const login = must(
      await mockAuthBackend.login({ email: 'beto@chat.dev', password: 'password' }),
      'login',
    )
    const v1 = await mockAuthBackend.verify(login.refreshToken)
    const v2 = await mockAuthBackend.verify(login.refreshToken)
    expect(v1?.user.id).toBe('u2')
    expect(v2?.user.id).toBe('u2') // sigue válido: verify no rota
  })

  it('refresh rota el token: el anterior queda inválido y el nuevo es válido', async () => {
    const login = must(
      await mockAuthBackend.login({ email: 'ana@chat.dev', password: 'password' }),
      'login',
    )
    const rotated = must(
      await mockAuthBackend.refresh(login.refreshToken),
      'refresh debería tener éxito',
    )
    expect(rotated.refreshToken).not.toBe(login.refreshToken)
    expect(await mockAuthBackend.verify(login.refreshToken)).toBeNull()
    expect(await mockAuthBackend.verify(rotated.refreshToken)).not.toBeNull()
  })

  it('logout revoca el refresh token', async () => {
    const login = must(
      await mockAuthBackend.login({ email: 'ana@chat.dev', password: 'password' }),
      'login',
    )
    await mockAuthBackend.logout(login.refreshToken)
    expect(await mockAuthBackend.verify(login.refreshToken)).toBeNull()
  })
})
