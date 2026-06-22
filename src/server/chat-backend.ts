/**
 * MOCK del backend de chat (en memoria), mientras no hay servicio real.
 *
 * Implementa la interfaz `ChatBackend` que consumen las server functions
 * (`server/chat.ts`). Para conectar el backend real, crea otra implementación
 * que haga `fetch` a sus endpoints y expórtala como `chatBackend`.
 *
 * Nota: los mensajes enviados en vivo viajan por el WebSocket (su propio mock,
 * en el cliente), así que NO se persisten aquí; al recargar se ve el historial
 * semilla. Aceptable para el mock.
 */
import { randomUUID } from 'node:crypto'
import type { Conversation, Message, User } from '#/types/domain'

export interface MessagesPage {
  items: Array<Message>
  nextCursor: string | null
}

export interface ChatBackend {
  listConversations: (userId: string) => Promise<Array<Conversation>>
  getConversation: (
    conversationId: string,
    userId: string,
  ) => Promise<Conversation | null>
  getMessages: (
    conversationId: string,
    cursor: string | null,
    limit: number,
  ) => Promise<MessagesPage>
  searchUsers: (query: string, excludeUserId: string) => Promise<Array<User>>
  getOrCreateDirectConversation: (
    userId: string,
    otherUserId: string,
  ) => Promise<Conversation>
}

// --- Directorio de usuarios -------------------------------------------------

const DIRECTORY: Array<User> = [
  { id: 'u1', displayName: 'Ana' },
  { id: 'u2', displayName: 'Beto' },
  { id: 'u3', displayName: 'Carla' },
  { id: 'u4', displayName: 'Dani' },
  { id: 'u5', displayName: 'Eva' },
]

function userById(id: string): User {
  return DIRECTORY.find((u) => u.id === id) ?? { id, displayName: id }
}

// --- Datos semilla ----------------------------------------------------------

interface ConvRecord {
  id: string
  participantIds: Array<string>
  updatedAt: string
}

const conversations: Array<ConvRecord> = [
  {
    id: 'c1',
    participantIds: ['u1', 'u2'],
    updatedAt: '2026-06-22T09:05:00.000Z',
  },
  {
    id: 'c2',
    participantIds: ['u1', 'u3'],
    updatedAt: '2026-06-21T18:30:00.000Z',
  },
]

function msg(
  id: string,
  conversationId: string,
  senderId: string,
  content: string,
  createdAt: string,
): Message {
  return {
    id,
    clientMessageId: null,
    conversationId,
    senderId,
    content,
    status: 'sent',
    createdAt,
  }
}

const messagesByConv: Record<string, Array<Message>> = {
  c1: [
    msg(
      'm1',
      'c1',
      'u2',
      '¡Hola! ¿Cómo va el proyecto?',
      '2026-06-21T09:00:00.000Z',
    ),
    msg(
      'm2',
      'c1',
      'u1',
      '¡Bien! Avanzando con el chat 🚀',
      '2026-06-21T09:02:00.000Z',
    ),
    msg(
      'm3',
      'c1',
      'u2',
      'Genial, ¿ya conecta el WebSocket?',
      '2026-06-21T09:03:00.000Z',
    ),
    msg(
      'm4',
      'c1',
      'u1',
      'Sí, ya reconecta solo y todo.',
      '2026-06-22T09:04:00.000Z',
    ),
    msg('m5', 'c1', 'u2', 'Crack 💪', '2026-06-22T09:05:00.000Z'),
  ],
  c2: [
    msg('m6', 'c2', 'u3', '¿Te paso el diseño?', '2026-06-21T18:25:00.000Z'),
    msg('m7', 'c2', 'u1', 'Porfa 🙏', '2026-06-21T18:30:00.000Z'),
  ],
}

// --- Helpers ----------------------------------------------------------------

function toConversation(record: ConvRecord): Conversation {
  const items = messagesByConv[record.id] ?? []
  return {
    id: record.id,
    type: 'direct',
    participants: record.participantIds.map(userById),
    lastMessage: items.at(-1),
    unreadCount: 0,
    updatedAt: record.updatedAt,
  }
}

// --- Implementación mock ----------------------------------------------------

export const mockChatBackend: ChatBackend = {
  async listConversations(userId) {
    return conversations
      .filter((c) => c.participantIds.includes(userId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toConversation)
  },

  async getConversation(conversationId, userId) {
    const record = conversations.find(
      (c) => c.id === conversationId && c.participantIds.includes(userId),
    )
    return record ? toConversation(record) : null
  },

  async getMessages(conversationId, cursor, limit) {
    const all = messagesByConv[conversationId] ?? [] // cronológico (viejo -> nuevo)
    const parsed = cursor ? Number.parseInt(cursor, 10) : all.length
    const end = Number.isFinite(parsed)
      ? Math.min(parsed, all.length)
      : all.length
    const start = Math.max(0, end - limit)
    return {
      items: all.slice(start, end),
      nextCursor: start > 0 ? String(start) : null,
    }
  },

  async searchUsers(query, excludeUserId) {
    const q = query.toLowerCase().trim()
    return DIRECTORY.filter(
      (u) =>
        u.id !== excludeUserId &&
        (q === '' || u.displayName.toLowerCase().includes(q)),
    )
  },

  async getOrCreateDirectConversation(userId, otherUserId) {
    const existing = conversations.find(
      (c) =>
        c.participantIds.length === 2 &&
        c.participantIds.includes(userId) &&
        c.participantIds.includes(otherUserId),
    )
    if (existing) return toConversation(existing)

    const record: ConvRecord = {
      id: `c-${randomUUID()}`,
      participantIds: [userId, otherUserId],
      updatedAt: new Date().toISOString(),
    }
    conversations.push(record)
    messagesByConv[record.id] = []
    return toConversation(record)
  },
}

/** Implementación activa del backend de chat. Swap aquí por la real. */
export const chatBackend: ChatBackend = mockChatBackend
