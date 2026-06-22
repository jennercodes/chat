import { z } from 'zod'
import { messageSchema, messageStatusSchema } from './domain'

/**
 * Esquemas de los eventos del WebSocket. Formato común: `{ type, payload }`.
 * Ver `docs/ARQUITECTURA.md` (sección 8.3). A confirmar con el backend.
 */

// ---------------------------------------------------------------------------
// Cliente -> Servidor
// ---------------------------------------------------------------------------

export const sendMessagePayloadSchema = z.object({
  clientMessageId: z.string(),
  conversationId: z.string(),
  content: z.string().min(1),
  sentAt: z.string(), // ISO 8601
})
export type SendMessagePayload = z.infer<typeof sendMessagePayloadSchema>

export const clientEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.send'),
    payload: sendMessagePayloadSchema,
  }),
  z.object({ type: z.literal('ping') }),
])
export type ClientEvent = z.infer<typeof clientEventSchema>

// ---------------------------------------------------------------------------
// Servidor -> Cliente
// ---------------------------------------------------------------------------

export const messageAckPayloadSchema = z.object({
  clientMessageId: z.string(),
  id: z.string(),
  conversationId: z.string(),
  status: messageStatusSchema,
  createdAt: z.string(), // ISO 8601
})
export type MessageAckPayload = z.infer<typeof messageAckPayloadSchema>

export const wsErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  clientMessageId: z.string().optional(),
})
export type WsErrorPayload = z.infer<typeof wsErrorPayloadSchema>

export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.ack'),
    payload: messageAckPayloadSchema,
  }),
  z.object({ type: z.literal('message.new'), payload: messageSchema }),
  z.object({ type: z.literal('error'), payload: wsErrorPayloadSchema }),
  z.object({ type: z.literal('pong') }),
])
export type ServerEvent = z.infer<typeof serverEventSchema>
