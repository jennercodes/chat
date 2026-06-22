import { serverEventSchema } from '#/lib/validation/ws'
import type { ClientEvent, ServerEvent } from '#/lib/validation/ws'
import type { ConnectionStatus, SocketFactory, WebSocketLike } from './types'

/** Fábrica por defecto: WebSocket nativo del navegador. */
const defaultSocketFactory: SocketFactory = (url) =>
  // El WebSocket nativo cumple la parte de la interfaz que usamos.
  new WebSocket(url) as unknown as WebSocketLike

export interface ChatSocketOptions {
  /** URL base del WebSocket. */
  url: string
  /** Obtiene un ticket de conexión de corta vida (`null` = sin sesión). */
  getTicket: () => Promise<string | null>
  /** Fábrica de sockets (inyectable para mock/tests). */
  socketFactory?: SocketFactory
  /** Notifica cambios de estado de conexión. */
  onStatusChange?: (status: ConnectionStatus) => void
  /** Recibe eventos válidos del servidor (el `pong` se maneja internamente). */
  onEvent?: (event: ServerEvent) => void
  heartbeatIntervalMs?: number
  reconnectBaseMs?: number
  reconnectMaxMs?: number
  /** Fuente de aleatoriedad para el jitter del backoff (inyectable en tests). */
  randomFn?: () => number
}

/**
 * Cliente WebSocket del chat. Responsabilidades: reconexión con backoff
 * exponencial + jitter, heartbeat ping/pong, cola de envío offline y validación
 * de eventos con Zod. Agnóstico de React (ver `use-chat-socket.tsx`).
 */
export class ChatSocketClient {
  private readonly url: string
  private readonly getTicket: () => Promise<string | null>
  private readonly factory: SocketFactory
  private readonly onStatusChange?: (status: ConnectionStatus) => void
  private readonly onEvent?: (event: ServerEvent) => void
  private readonly heartbeatIntervalMs: number
  private readonly reconnectBaseMs: number
  private readonly reconnectMaxMs: number
  private readonly randomFn: () => number

  private socket: WebSocketLike | null = null
  private status: ConnectionStatus = 'idle'
  private queue: Array<ClientEvent> = []
  private attempts = 0
  private disposed = false
  private awaitingPong = false
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: ChatSocketOptions) {
    this.url = options.url
    this.getTicket = options.getTicket
    this.factory = options.socketFactory ?? defaultSocketFactory
    this.onStatusChange = options.onStatusChange
    this.onEvent = options.onEvent
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 25_000
    this.reconnectBaseMs = options.reconnectBaseMs ?? 1_000
    this.reconnectMaxMs = options.reconnectMaxMs ?? 30_000
    this.randomFn = options.randomFn ?? Math.random
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  async connect(): Promise<void> {
    if (this.status === 'open' || this.status === 'connecting') return
    this.setStatus(this.attempts === 0 ? 'connecting' : 'reconnecting')

    let ticket: string | null
    try {
      ticket = await this.getTicket()
    } catch {
      this.scheduleReconnect()
      return
    }
    if (this.disposed) return // se llamó a disconnect() mientras pedíamos ticket
    if (ticket === null) {
      this.setStatus('closed') // sin sesión: no reintentamos
      return
    }

    const socket = this.factory(this.buildUrl(ticket))
    this.socket = socket
    socket.onopen = () => this.handleOpen()
    socket.onmessage = (event) => this.handleMessage(event)
    socket.onclose = () => this.handleClose()
    socket.onerror = () => {
      /* onclose se encargará de la reconexión */
    }
  }

  disconnect(): void {
    this.disposed = true
    this.clearTimers()
    this.queue = []
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.setStatus('closed')
  }

  send(event: ClientEvent): void {
    if (this.status === 'open' && this.socket) {
      this.socket.send(JSON.stringify(event))
    } else {
      this.queue.push(event) // se vacía al (re)conectar
    }
  }

  private buildUrl(ticket: string): string {
    const sep = this.url.includes('?') ? '&' : '?'
    return `${this.url}${sep}ticket=${encodeURIComponent(ticket)}`
  }

  private handleOpen(): void {
    this.attempts = 0
    this.setStatus('open')
    this.startHeartbeat()
    this.flushQueue()
  }

  private handleMessage(event: { data: unknown }): void {
    let raw: unknown
    try {
      raw = JSON.parse(typeof event.data === 'string' ? event.data : '')
    } catch {
      return // payload no-JSON: ignorar
    }
    const parsed = serverEventSchema.safeParse(raw)
    if (!parsed.success) return // evento desconocido/ inválido: ignorar
    if (parsed.data.type === 'pong') {
      this.awaitingPong = false
      return
    }
    this.onEvent?.(parsed.data)
  }

  private handleClose(): void {
    this.stopHeartbeat()
    this.socket = null
    if (this.disposed) {
      this.setStatus('closed')
      return
    }
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    this.setStatus('reconnecting')
    this.attempts += 1
    const delay = this.backoffDelay(this.attempts)
    this.reconnectTimer = setTimeout(() => void this.connect(), delay)
  }

  private backoffDelay(attempt: number): number {
    const base = Math.min(
      this.reconnectMaxMs,
      this.reconnectBaseMs * 2 ** (attempt - 1),
    )
    const jitter = base * 0.3 * this.randomFn()
    return Math.min(this.reconnectMaxMs, base + jitter)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.awaitingPong = false
    this.heartbeatTimer = setInterval(() => {
      if (this.awaitingPong) {
        // No llegó el pong anterior: conexión muerta, forzar reconexión.
        this.socket?.close()
        return
      }
      this.awaitingPong = true
      this.send({ type: 'ping' })
    }, this.heartbeatIntervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.awaitingPong = false
  }

  private clearTimers(): void {
    this.stopHeartbeat()
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private flushQueue(): void {
    if (this.status !== 'open' || !this.socket) return
    const pending = this.queue
    this.queue = []
    for (const event of pending) this.socket.send(JSON.stringify(event))
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return
    this.status = status
    this.onStatusChange?.(status)
  }
}
