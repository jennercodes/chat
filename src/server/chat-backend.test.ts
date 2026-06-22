import { describe, expect, it } from 'vitest'
import { mockChatBackend } from './chat-backend'

describe('mockChatBackend', () => {
  it('lista solo las conversaciones del usuario', async () => {
    const ana = await mockChatBackend.listConversations('u1')
    expect(ana.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
    const carla = await mockChatBackend.listConversations('u3')
    expect(carla.map((c) => c.id)).toEqual(['c2'])
    const dani = await mockChatBackend.listConversations('u4')
    expect(dani).toHaveLength(0)
  })

  it('getConversation respeta la pertenencia', async () => {
    expect(await mockChatBackend.getConversation('c1', 'u1')).not.toBeNull()
    expect(await mockChatBackend.getConversation('c1', 'u3')).toBeNull()
  })

  it('pagina los mensajes por cursor (página = más recientes hacia atrás)', async () => {
    const page1 = await mockChatBackend.getMessages('c1', null, 2)
    expect(page1.items.map((m) => m.id)).toEqual(['m4', 'm5'])
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await mockChatBackend.getMessages('c1', page1.nextCursor, 2)
    expect(page2.items.map((m) => m.id)).toEqual(['m2', 'm3'])

    const page3 = await mockChatBackend.getMessages('c1', page2.nextCursor, 2)
    expect(page3.items.map((m) => m.id)).toEqual(['m1'])
    expect(page3.nextCursor).toBeNull()
  })

  it('searchUsers excluye al usuario actual y filtra por nombre', async () => {
    const all = await mockChatBackend.searchUsers('', 'u1')
    expect(all.map((u) => u.id)).not.toContain('u1')

    const carla = await mockChatBackend.searchUsers('car', 'u1')
    expect(carla.map((u) => u.id)).toEqual(['u3'])
  })

  it('getOrCreateDirectConversation reutiliza la existente e ignora el orden', async () => {
    const existing = await mockChatBackend.getOrCreateDirectConversation(
      'u1',
      'u2',
    )
    expect(existing.id).toBe('c1')

    const created = await mockChatBackend.getOrCreateDirectConversation(
      'u1',
      'u4',
    )
    expect(created.id).not.toBe('c1')

    const again = await mockChatBackend.getOrCreateDirectConversation(
      'u4',
      'u1',
    )
    expect(again.id).toBe(created.id)
  })
})
