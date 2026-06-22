import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatSocketClient } from './client'
import type { ServerEvent } from '#/lib/validation/ws'
import type { ConnectionStatus, WebSocketLike } from './types'

function must<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message)
  return value
}

function typeOf(data: string): string {
  return (JSON.parse(data) as { type: string }).type
}

/** Socket falso controlable desde el test. */
class FakeSocket implements WebSocketLike {
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  sent: Array<string> = []
  closed = false
  url: string

  constructor(url: string) {
    this.url = url
  }

  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.closed = true
    this.onclose?.()
  }

  // Helpers de test:
  open(): void {
    this.onopen?.()
  }
  drop(): void {
    this.onclose?.() // cierre inesperado (el servidor cae)
  }
  receive(event: ServerEvent): void {
    this.onmessage?.({ data: JSON.stringify(event) })
  }
  receiveRaw(data: unknown): void {
    this.onmessage?.({ data })
  }
}

const sendPayload = {
  clientMessageId: 'c1',
  conversationId: 'conv1',
  content: 'hola',
  sentAt: '2026-06-22T00:00:00.000Z',
}

let active: ChatSocketClient | undefined

afterEach(() => {
  active?.disconnect()
  active = undefined
  vi.useRealTimers()
})

describe('ChatSocketClient', () => {
  it('pide ticket, conecta con él y llega a "open"', async () => {
    let socket: FakeSocket | undefined
    const statuses: Array<ConnectionStatus> = []
    const getTicket = vi.fn(async () => 'tkt')
    const client = new ChatSocketClient({
      url: 'wss://x/ws',
      getTicket,
      socketFactory: (url) => {
        socket = new FakeSocket(url)
        return socket
      },
      onStatusChange: (s) => statuses.push(s),
    })
    active = client

    await client.connect()
    expect(getTicket).toHaveBeenCalledTimes(1)
    const s = must(socket, 'socket')
    expect(s.url).toContain('ticket=tkt')

    s.open()
    expect(client.getStatus()).toBe('open')
    expect(statuses).toEqual(['connecting', 'open'])
  })

  it('no conecta si no hay sesión (ticket null) -> closed', async () => {
    const client = new ChatSocketClient({
      url: 'wss://x/ws',
      getTicket: async () => null,
      socketFactory: (url) => new FakeSocket(url),
    })
    active = client

    await client.connect()
    expect(client.getStatus()).toBe('closed')
  })

  it('encola los envíos antes de abrir y los vacía al abrir, en orden', async () => {
    let socket: FakeSocket | undefined
    const client = new ChatSocketClient({
      url: 'wss://x/ws',
      getTicket: async () => 't',
      socketFactory: (url) => {
        socket = new FakeSocket(url)
        return socket
      },
    })
    active = client

    await client.connect()
    client.send({ type: 'message.send', payload: sendPayload })
    client.send({ type: 'ping' })
    const s = must(socket, 'socket')
    expect(s.sent).toHaveLength(0) // aún no abierto

    s.open()
    expect(s.sent).toHaveLength(2)
    expect(typeOf(s.sent[0])).toBe('message.send')
    expect(typeOf(s.sent[1])).toBe('ping')
  })

  it('despacha eventos válidos e ignora los inválidos', async () => {
    let socket: FakeSocket | undefined
    const events: Array<ServerEvent> = []
    const client = new ChatSocketClient({
      url: 'wss://x/ws',
      getTicket: async () => 't',
      socketFactory: (url) => {
        socket = new FakeSocket(url)
        return socket
      },
      onEvent: (e) => events.push(e),
    })
    active = client

    await client.connect()
    const s = must(socket, 'socket')
    s.open()

    s.receive({
      type: 'message.new',
      payload: {
        id: 'm1',
        clientMessageId: null,
        conversationId: 'conv1',
        senderId: 'u2',
        content: 'hey',
        status: 'sent',
        createdAt: '2026-06-22T00:00:00.000Z',
      },
    })
    s.receiveRaw('no-es-json')
    s.receiveRaw(JSON.stringify({ type: 'desconocido' }))

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('message.new')
  })

  it('heartbeat: envía ping y el pong evita la reconexión', async () => {
    vi.useFakeTimers()
    let socket: FakeSocket | undefined
    const client = new ChatSocketClient({
      url: 'wss://x/ws',
      getTicket: async () => 't',
      socketFactory: (url) => {
        socket = new FakeSocket(url)
        return socket
      },
      heartbeatIntervalMs: 1_000,
    })
    active = client

    await client.connect()
    const s = must(socket, 'socket')
    s.open()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(s.sent.map(typeOf)).toContain('ping')

    s.receive({ type: 'pong' })
    await vi.advanceTimersByTimeAsync(1_000) // segundo ping; sigue vivo
    expect(s.closed).toBe(false)
    expect(client.getStatus()).toBe('open')
  })

  it('reconecta tras un cierre inesperado', async () => {
    vi.useFakeTimers()
    let socket: FakeSocket | undefined
    const client = new ChatSocketClient({
      url: 'wss://x/ws',
      getTicket: async () => 't',
      socketFactory: (url) => {
        socket = new FakeSocket(url)
        return socket
      },
      reconnectBaseMs: 10,
      randomFn: () => 0,
    })
    active = client

    await client.connect()
    must(socket, 'socket').open()
    expect(client.getStatus()).toBe('open')
    const first = must(socket, 'socket')

    first.drop()
    expect(client.getStatus()).toBe('reconnecting')

    await vi.advanceTimersByTimeAsync(10) // dispara el reconnect
    const second = must(socket, 'socket')
    expect(second).not.toBe(first) // se creó un socket nuevo
    second.open()
    expect(client.getStatus()).toBe('open')
  })
})
