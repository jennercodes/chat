import { clientEventSchema } from '#/lib/validation/ws'
import type { ServerEvent } from '#/lib/validation/ws'
import type { WebSocketLike } from './types'

/**
 * Servidor WebSocket SIMULADO (en el cliente), mientras no hay backend real.
 *
 * Comportamiento:
 * - Abre la conexión tras un pequeño retraso (simula handshake).
 * - `ping`  -> responde `pong`.
 * - `message.send` -> responde `message.ack` (status `sent`) y, poco después, un
 *   `message.new` simulando la respuesta del otro participante.
 *
 * Cuando exista el backend real, basta poner `VITE_WS_MOCK=false` para usar el
 * WebSocket nativo (ver `client.ts` / `use-chat-socket.tsx`).
 */
class MockChatSocket implements WebSocketLike {
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null

  private closed = false
  private readonly timers: Array<ReturnType<typeof setTimeout>> = []

  constructor() {
    this.schedule(() => this.onopen?.(), 60)
  }

  send(data: string): void {
    if (this.closed) return
    let raw: unknown
    try {
      raw = JSON.parse(data)
    } catch {
      return
    }
    const parsed = clientEventSchema.safeParse(raw)
    if (!parsed.success) return
    const event = parsed.data

    if (event.type === 'ping') {
      this.schedule(() => this.emit({ type: 'pong' }), 10)
      return
    }

    // event.type === 'message.send'
    const { clientMessageId, conversationId, content } = event.payload
    const createdAt = new Date().toISOString()

    this.schedule(
      () =>
        this.emit({
          type: 'message.ack',
          payload: {
            clientMessageId,
            id: crypto.randomUUID(),
            conversationId,
            status: 'sent',
            createdAt,
          },
        }),
      120,
    )

    this.schedule(
      () =>
        this.emit({
          type: 'message.new',
          payload: {
            id: crypto.randomUUID(),
            clientMessageId: null,
            conversationId,
            senderId: 'u2',
            content: `Recibí: "${content}"`,
            status: 'sent',
            createdAt: new Date().toISOString(),
          },
        }),
      700,
    )
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.timers.forEach(clearTimeout)
    this.schedule(() => this.onclose?.(), 10)
  }

  private emit(event: ServerEvent): void {
    if (this.closed) return
    this.onmessage?.({ data: JSON.stringify(event) })
  }

  private schedule(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms))
  }
}

export function createMockSocket(_url: string): WebSocketLike {
  return new MockChatSocket()
}
