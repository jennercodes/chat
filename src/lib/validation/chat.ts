import { z } from 'zod'
import { conversationSchema, messageSchema, userSchema } from './domain'

/**
 * Esquemas de los datos REST del chat (tentativos, ver docs/ARQUITECTURA.md §8).
 * Mantenerlos aislados aquí para ajustarlos cuando confirme el backend.
 */

// --- Respuestas -------------------------------------------------------------

export const conversationListSchema = z.array(conversationSchema)
export type ConversationList = z.infer<typeof conversationListSchema>

export const messagesPageSchema = z.object({
  items: z.array(messageSchema),
  nextCursor: z.string().nullable(),
})
export type MessagesPage = z.infer<typeof messagesPageSchema>

export const userListSchema = z.array(userSchema)
export type UserList = z.infer<typeof userListSchema>

// --- Entradas ---------------------------------------------------------------

export const conversationIdInputSchema = z.object({
  conversationId: z.string(),
})

export const getMessagesInputSchema = z.object({
  conversationId: z.string(),
  cursor: z.string().nullish(),
  limit: z.number().int().positive().max(100).optional(),
})
export type GetMessagesInput = z.infer<typeof getMessagesInputSchema>

export const searchUsersInputSchema = z.object({
  query: z.string(),
})

export const createConversationInputSchema = z.object({
  userId: z.string(),
})
