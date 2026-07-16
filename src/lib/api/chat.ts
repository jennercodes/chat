import {
  conversationListSchema,
  messagesPageSchema,
  userListSchema,
} from '#/lib/validation/chat'
import { conversationSchema } from '#/lib/validation/domain'
import { apiFetch } from './client'
import type { MessagesPage } from '#/lib/validation/chat'
import type { Conversation, User } from '#/types/domain'

/**
 * Cliente REST del chat: el **navegador** llama directo al backend con
 * `Authorization: Bearer` (`apiFetch` añade el token y refresca en 401). Cada
 * respuesta se valida con el esquema Zod correspondiente antes de devolverla.
 *
 * Contrato: docs/contrato-backend.md §4. El backend infiere el usuario del token;
 * el frontend nunca manda su propio id.
 */

async function jsonOk(res: Response): Promise<unknown> {
  if (!res.ok) throw new Error(`Error ${res.status} en ${res.url}`)
  return res.json()
}

/** GET /conversations — conversaciones del usuario actual. */
export async function listConversations(): Promise<Array<Conversation>> {
  const res = await apiFetch('/conversations')
  return conversationListSchema.parse(await jsonOk(res))
}

/** GET /conversations/{id} — `null` si no existe o no pertenece al usuario. */
export async function getConversation(id: string): Promise<Conversation | null> {
  const res = await apiFetch(`/conversations/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  return conversationSchema.parse(await jsonOk(res))
}

/** GET /conversations/{id}/messages — historial paginado por cursor. */
export async function getMessages(
  conversationId: string,
  opts?: { cursor?: string | null; limit?: number },
): Promise<MessagesPage> {
  const params = new URLSearchParams()
  if (opts?.cursor) params.set('cursor', opts.cursor)
  params.set('limit', String(opts?.limit ?? 30))
  const res = await apiFetch(
    `/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
  )
  return messagesPageSchema.parse(await jsonOk(res))
}

/** GET /users?search= — buscar usuarios para iniciar conversación. */
export async function searchUsers(query: string): Promise<Array<User>> {
  const res = await apiFetch(`/users?search=${encodeURIComponent(query)}`)
  return userListSchema.parse(await jsonOk(res))
}

/** POST /conversations — obtener o crear la conversación directa con `userId`. */
export async function getOrCreateConversation(
  userId: string,
): Promise<Conversation> {
  const res = await apiFetch('/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  return conversationSchema.parse(await jsonOk(res))
}
