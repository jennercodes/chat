import { useEffect } from 'react'
import { useChatSocket } from '#/lib/ws/use-chat-socket'
import { useMessagesStore } from '#/store/messages'

/**
 * Conecta los eventos del WebSocket con el store de mensajes. Se monta una vez
 * dentro del área autenticada (no renderiza nada).
 */
export function MessageSync() {
  const { subscribe } = useChatSocket()
  const applyAck = useMessagesStore((s) => s.applyAck)
  const applyIncoming = useMessagesStore((s) => s.applyIncoming)

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'message.ack') {
        const { conversationId, clientMessageId, id, status, createdAt } =
          event.payload
        applyAck(conversationId, clientMessageId, { id, status, createdAt })
      } else if (event.type === 'message.new') {
        applyIncoming(event.payload)
      }
    })
  }, [subscribe, applyAck, applyIncoming])

  return null
}
