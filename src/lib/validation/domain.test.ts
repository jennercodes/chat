import { describe, expect, it } from 'vitest'
import { conversationSchema, userSchema } from './domain'

/**
 * Fija las formas REALES que emite el backend (contrato 2026-07-15) para que los
 * esquemas no se rompan si alguien los "endurece" de más:
 * - `type` en MAYÚSCULAS (`DIRECT`).
 * - `lastMessage` y `lastSeenAt` pueden ser `null`.
 * - `participants` trae la entidad completa (nombres/apellidos/rol…) → se ignora.
 */

describe('userSchema (formas del backend real)', () => {
  it('acepta el UserDto reducido con avatarUrl null', () => {
    const dto = userSchema.parse({
      id: 'u1',
      displayName: 'Ana García',
      avatarUrl: null,
    })
    expect(dto.id).toBe('u1')
  })

  it('acepta la entidad completa y descarta los campos extra', () => {
    const parsed = userSchema.parse({
      id: 'u2',
      displayName: 'Luis Ramírez',
      avatarUrl: null,
      nombres: 'Luis',
      apellidos: 'Ramírez',
      rol: 'PROFESOR',
      status: 'offline',
      lastSeenAt: null,
    })
    expect(parsed).not.toHaveProperty('rol')
    expect(parsed).not.toHaveProperty('nombres')
    expect(parsed.status).toBe('offline')
  })
})

describe('conversationSchema (formas del backend real)', () => {
  it('acepta type DIRECT en mayúsculas y lastMessage null', () => {
    const conv = conversationSchema.parse({
      id: 'c1',
      type: 'DIRECT',
      participants: [
        { id: 'u1', displayName: 'Ana García', avatarUrl: null, rol: 'ESTUDIANTE', lastSeenAt: null },
        { id: 'u2', displayName: 'Luis Ramírez', avatarUrl: null, rol: 'PROFESOR', lastSeenAt: null },
      ],
      lastMessage: null,
      unreadCount: 0,
      updatedAt: '2026-07-15T12:20:47.070', // hora local sin Z (REST)
    })
    expect(conv.type).toBe('DIRECT')
    expect(conv.lastMessage).toBeNull()
    expect(conv.participants).toHaveLength(2)
  })
})
