import { beforeEach, describe, expect, it } from 'vitest'
import { useMessagesStore } from './messages'
import type { Message } from '#/types/domain'

function msg(partial: Partial<Message> & { id: string }): Message {
  return {
    clientMessageId: null,
    conversationId: 'c1',
    senderId: 'u1',
    content: 'hola',
    status: 'sent',
    createdAt: '2026-06-22T00:00:00.000Z',
    ...partial,
  }
}

beforeEach(() => {
  useMessagesStore.setState({ byConversation: {} })
})

describe('useMessagesStore', () => {
  it('setHistory + addOptimistic', () => {
    const store = useMessagesStore.getState()
    store.setHistory('c1', [msg({ id: 'm1' })])
    store.addOptimistic(
      msg({ id: 'tmp', clientMessageId: 'tmp', status: 'sending' }),
    )
    const items = useMessagesStore.getState().byConversation['c1'] ?? []
    expect(items).toHaveLength(2)
    expect(items[1]?.status).toBe('sending')
  })

  it('applyAck concilia el optimista por clientMessageId', () => {
    const store = useMessagesStore.getState()
    store.addOptimistic(
      msg({ id: 'tmp', clientMessageId: 'cid', status: 'sending' }),
    )
    store.applyAck('c1', 'cid', { id: 'real', status: 'sent', createdAt: 'x' })
    const items = useMessagesStore.getState().byConversation['c1'] ?? []
    expect(items[0]?.id).toBe('real')
    expect(items[0]?.status).toBe('sent')
  })

  it('applyIncoming deduplica por id', () => {
    const store = useMessagesStore.getState()
    store.applyIncoming(msg({ id: 'm9', senderId: 'u2' }))
    store.applyIncoming(msg({ id: 'm9', senderId: 'u2' }))
    const items = useMessagesStore.getState().byConversation['c1'] ?? []
    expect(items).toHaveLength(1)
  })

  it('applyIncoming ignora el eco propio (mismo clientMessageId)', () => {
    const store = useMessagesStore.getState()
    store.addOptimistic(
      msg({ id: 'tmp', clientMessageId: 'cid', status: 'sending' }),
    )
    store.applyIncoming(msg({ id: 'real', clientMessageId: 'cid' }))
    const items = useMessagesStore.getState().byConversation['c1'] ?? []
    expect(items).toHaveLength(1)
  })

  it('markFailed marca el optimista como fallido', () => {
    const store = useMessagesStore.getState()
    store.addOptimistic(
      msg({ id: 'tmp', clientMessageId: 'cid', status: 'sending' }),
    )
    store.markFailed('c1', 'cid')
    const items = useMessagesStore.getState().byConversation['c1'] ?? []
    expect(items[0]?.status).toBe('failed')
  })
})
