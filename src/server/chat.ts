import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import {
  conversationIdInputSchema,
  createConversationInputSchema,
  getMessagesInputSchema,
  searchUsersInputSchema,
} from '#/lib/validation/chat'
import { REFRESH_COOKIE } from './auth'
import { authBackend } from './auth-backend'
import { chatBackend } from './chat-backend'
import type { MessagesPage } from '#/lib/validation/chat'
import type { Conversation, User } from '#/types/domain'

/**
 * Server functions de datos del chat (BFF). Hoy hablan con un mock en memoria
 * (`chat-backend.ts`); el patrón no cambia al conectar el backend real.
 *
 * Cada función resuelve el usuario actual desde la cookie httpOnly y acota los
 * datos a él.
 */

async function requireUser(): Promise<User> {
  const token = getCookie(REFRESH_COOKIE)
  const session = token ? await authBackend.verify(token) : null
  if (!session) throw new Error('No autenticado')
  return session.user
}

export const listConversationsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<Conversation>> => {
    const user = await requireUser()
    return chatBackend.listConversations(user.id)
  },
)

export const getConversationFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => conversationIdInputSchema.parse(raw))
  .handler(async ({ data }): Promise<Conversation | null> => {
    const user = await requireUser()
    return chatBackend.getConversation(data.conversationId, user.id)
  })

export const getMessagesFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => getMessagesInputSchema.parse(raw))
  .handler(async ({ data }): Promise<MessagesPage> => {
    await requireUser()
    return chatBackend.getMessages(
      data.conversationId,
      data.cursor ?? null,
      data.limit ?? 30,
    )
  })

export const searchUsersFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => searchUsersInputSchema.parse(raw))
  .handler(async ({ data }): Promise<Array<User>> => {
    const user = await requireUser()
    return chatBackend.searchUsers(data.query, user.id)
  })

export const createConversationFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => createConversationInputSchema.parse(raw))
  .handler(async ({ data }): Promise<Conversation> => {
    const user = await requireUser()
    return chatBackend.getOrCreateDirectConversation(user.id, data.userId)
  })
