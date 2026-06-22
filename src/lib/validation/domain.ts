import { z } from 'zod'

/**
 * Esquemas Zod del dominio + tipos inferidos.
 *
 * Estos esquemas son la fuente de verdad: validan en runtime todo dato que
 * cruza una frontera (API REST y WebSocket) y de ellos se infieren los tipos
 * de TypeScript. Ver `docs/ARQUITECTURA.md` (secciones 5 y 8).
 */

/** Usuario del chat. */
export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullish(),
  // Presencia: opcional en v1, útil más adelante.
  status: z.enum(['online', 'offline']).optional(),
  lastSeenAt: z.string().optional(), // ISO 8601
})
export type User = z.infer<typeof userSchema>

/** Estado de entrega de un mensaje. */
export const messageStatusSchema = z.enum([
  'sending', // optimista en cliente, sin ack del server
  'sent', // el server lo aceptó (ack)
  'delivered', // entregado al destinatario (futuro)
  'read', // leído por el destinatario (futuro)
  'failed', // falló el envío
])
export type MessageStatus = z.infer<typeof messageStatusSchema>

/** Mensaje de una conversación. */
export const messageSchema = z.object({
  id: z.string(), // id definitivo (lo asigna el server)
  clientMessageId: z.string().nullable(), // id de cliente para dedupe/optimista
  conversationId: z.string(),
  senderId: z.string(),
  content: z.string(),
  status: messageStatusSchema,
  createdAt: z.string(), // ISO 8601
  editedAt: z.string().optional(),
})
export type Message = z.infer<typeof messageSchema>

/** Conversación (v1: solo 1:1). */
export const conversationSchema = z.object({
  id: z.string(),
  type: z.literal('direct'),
  participants: z.array(userSchema),
  lastMessage: messageSchema.optional(),
  unreadCount: z.number().int().nonnegative(),
  updatedAt: z.string(), // ISO 8601
})
export type Conversation = z.infer<typeof conversationSchema>
