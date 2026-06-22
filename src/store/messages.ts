import { create } from 'zustand'
import type { Message, MessageStatus } from '#/types/domain'

interface AckPatch {
  id: string
  status: MessageStatus
  createdAt: string
}

/**
 * Mensajes por conversación (fuente de verdad de la vista en vivo). Se siembra
 * con el historial (REST) y se actualiza con los eventos del WebSocket y los
 * envíos optimistas. Ver docs/ARQUITECTURA.md §7.
 */
interface MessagesState {
  byConversation: Record<string, Array<Message>>
  /** Reemplaza el historial de una conversación. */
  setHistory: (conversationId: string, items: Array<Message>) => void
  /** Antepone mensajes más antiguos (paginación hacia atrás). */
  prependHistory: (conversationId: string, items: Array<Message>) => void
  /** Añade un mensaje propio en estado `sending`. */
  addOptimistic: (message: Message) => void
  /** Concilia el ack del servidor con el mensaje optimista (por clientMessageId). */
  applyAck: (
    conversationId: string,
    clientMessageId: string,
    patch: AckPatch,
  ) => void
  /** Inserta un mensaje entrante, deduplicando por clientMessageId/id. */
  applyIncoming: (message: Message) => void
  /** Marca un mensaje propio como fallido. */
  markFailed: (conversationId: string, clientMessageId: string) => void
}

function replace(
  state: MessagesState,
  conversationId: string,
  items: Array<Message>,
): Pick<MessagesState, 'byConversation'> {
  return {
    byConversation: { ...state.byConversation, [conversationId]: items },
  }
}

export const useMessagesStore = create<MessagesState>((set) => ({
  byConversation: {},

  setHistory: (conversationId, items) =>
    set((s) => replace(s, conversationId, items)),

  prependHistory: (conversationId, items) =>
    set((s) =>
      replace(s, conversationId, [
        ...items,
        ...(s.byConversation[conversationId] ?? []),
      ]),
    ),

  addOptimistic: (message) =>
    set((s) =>
      replace(s, message.conversationId, [
        ...(s.byConversation[message.conversationId] ?? []),
        message,
      ]),
    ),

  applyAck: (conversationId, clientMessageId, patch) =>
    set((s) => {
      const items = s.byConversation[conversationId] ?? []
      return replace(
        s,
        conversationId,
        items.map((m) =>
          m.clientMessageId === clientMessageId
            ? {
                ...m,
                id: patch.id,
                status: patch.status,
                createdAt: patch.createdAt,
              }
            : m,
        ),
      )
    }),

  applyIncoming: (message) =>
    set((s) => {
      const items = s.byConversation[message.conversationId] ?? []
      const duplicate = items.some(
        (m) =>
          (message.clientMessageId !== null &&
            m.clientMessageId === message.clientMessageId) ||
          m.id === message.id,
      )
      if (duplicate) return {}
      return replace(s, message.conversationId, [...items, message])
    }),

  markFailed: (conversationId, clientMessageId) =>
    set((s) => {
      const items = s.byConversation[conversationId] ?? []
      return replace(
        s,
        conversationId,
        items.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, status: 'failed' }
            : m,
        ),
      )
    }),
}))
