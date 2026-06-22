import { randomUUID } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { REFRESH_COOKIE } from './auth'
import { authBackend } from './auth-backend'

/**
 * Emite un ticket de corta vida para autenticar el handshake del WebSocket
 * (los navegadores no permiten headers custom en el handshake).
 *
 * MOCK: hoy solo valida que haya sesión (cookie httpOnly) y devuelve un ticket
 * de un solo uso simulado. El backend real lo emitirá vía `POST /ws/ticket`.
 */
export const getWsTicketFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string | null> => {
    const token = getCookie(REFRESH_COOKIE)
    if (!token) return null
    const session = await authBackend.verify(token)
    if (!session) return null
    return `mock-ticket-${randomUUID()}`
  },
)
