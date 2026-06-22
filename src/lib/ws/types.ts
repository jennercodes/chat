/** Estado de la conexión WebSocket, para reflejar en la UI. */
export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'

/**
 * Interfaz mínima de un socket que necesita el cliente. El `WebSocket` nativo la
 * cumple (con un cast en la fábrica por defecto) y el mock la implementa directo.
 */
export interface WebSocketLike {
  send: (data: string) => void
  close: (code?: number, reason?: string) => void
  onopen: (() => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
}

export type SocketFactory = (url: string) => WebSocketLike
