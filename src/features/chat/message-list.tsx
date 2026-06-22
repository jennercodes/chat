import { useEffect, useRef } from 'react'
import { groupByDay } from './format'
import { MessageBubble } from './message-bubble'
import type { Message } from '#/types/domain'

export function MessageList({
  messages,
  currentUserId,
}: {
  messages: Array<Message>
  currentUserId: string
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-center text-sm">
        No hay mensajes todavía. ¡Escribe el primero!
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {groupByDay(messages).map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <div className="bg-muted text-muted-foreground self-center rounded-full px-3 py-0.5 text-xs">
            {group.label}
          </div>
          {group.items.map((message) => (
            <MessageBubble
              key={message.clientMessageId ?? message.id}
              message={message}
              mine={message.senderId === currentUserId}
            />
          ))}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
