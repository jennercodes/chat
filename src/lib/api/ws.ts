import { wsTicketSchema } from '#/lib/validation/ws'
import { apiFetch } from './client'

/**
 * Pide al backend un ticket de corta vida para autenticar el handshake del
 * WebSocket (`POST /ws/ticket`, con Bearer). Los navegadores no permiten headers
 * custom en el handshake, así que el ticket viaja luego en el query string
 * (`?ticket=`). Ver docs/websocket-backend-spec.md §1.
 *
 * Devuelve `null` si no hay sesión válida (sin token y sin poder refrescar): el
 * cliente WS lo interpreta como "no reintentar".
 */
export async function getWsTicket(): Promise<string | null> {
  const res = await apiFetch('/ws/ticket', { method: 'POST' })
  if (!res.ok) return null
  return wsTicketSchema.parse(await res.json()).ticket
}
