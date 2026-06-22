import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { env } from '#/env'
import { getWsTicketFn } from '#/server/ws'
import { useConnectionStore } from '#/store/connection'
import { ChatSocketClient } from './client'
import { createMockSocket } from './mock-socket'
import type { ClientEvent, ServerEvent } from '#/lib/validation/ws'

interface ChatSocketContextValue {
  send: (event: ClientEvent) => void
  /** Suscribe un handler a los eventos del servidor. Devuelve el des-suscriptor. */
  subscribe: (handler: (event: ServerEvent) => void) => () => void
}

const ChatSocketContext = createContext<ChatSocketContextValue | null>(null)

/**
 * Crea y mantiene una única conexión WebSocket durante el ciclo de vida de las
 * rutas protegidas. Conecta al montar (cliente) y cierra al desmontar.
 */
export function ChatSocketProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const subscribers = useRef(new Set<(event: ServerEvent) => void>())

  const [client] = useState(
    () =>
      new ChatSocketClient({
        url: env.VITE_WS_URL,
        getTicket: () => getWsTicketFn(),
        socketFactory:
          env.VITE_WS_MOCK === 'false' ? undefined : createMockSocket,
        onStatusChange: (status) =>
          useConnectionStore.getState().setStatus(status),
        onEvent: (event) => {
          subscribers.current.forEach((fn) => fn(event))
        },
      }),
  )

  useEffect(() => {
    void client.connect()
    return () => client.disconnect()
  }, [client])

  const value = useMemo<ChatSocketContextValue>(
    () => ({
      send: (event) => client.send(event),
      subscribe: (handler) => {
        subscribers.current.add(handler)
        return () => {
          subscribers.current.delete(handler)
        }
      },
    }),
    [client],
  )

  return (
    <ChatSocketContext.Provider value={value}>
      {children}
    </ChatSocketContext.Provider>
  )
}

export function useChatSocket(): ChatSocketContextValue {
  const ctx = useContext(ChatSocketContext)
  if (!ctx) {
    throw new Error('useChatSocket debe usarse dentro de <ChatSocketProvider>')
  }
  return ctx
}
