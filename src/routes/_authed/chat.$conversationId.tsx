import { useEffect } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { getConversation, getMessages } from '#/lib/api/chat'
import { useChatSocket } from '#/lib/ws/use-chat-socket'
import { useMessagesStore } from '#/store/messages'
import { MessageList } from '#/features/chat/message-list'
import { MessageInput } from '#/features/chat/message-input'
import { initials } from '#/features/chat/format'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'

export const Route = createFileRoute('/_authed/chat/$conversationId')({
  component: ConversationView,
})

function ConversationView() {
  const { conversationId } = Route.useParams()
  const session = Route.useRouteContext({ select: (c) => c.session })
  const currentUserId = session?.user.id ?? ''
  const { send } = useChatSocket()

  const messages = useMessagesStore((s) => s.byConversation[conversationId])
  const setHistory = useMessagesStore((s) => s.setHistory)
  const addOptimistic = useMessagesStore((s) => s.addOptimistic)

  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId),
  })

  useEffect(() => {
    let active = true
    void getMessages(conversationId).then((page) => {
      if (active) setHistory(conversationId, page.items)
    })
    return () => {
      active = false
    }
  }, [conversationId, setHistory])

  function handleSend(content: string) {
    const clientMessageId = crypto.randomUUID()
    const now = new Date().toISOString()
    addOptimistic({
      id: clientMessageId,
      clientMessageId,
      conversationId,
      senderId: currentUserId,
      content,
      status: 'sending',
      createdAt: now,
    })
    send({
      type: 'message.send',
      payload: { clientMessageId, conversationId, content, sentAt: now },
    })
  }

  const other = conversation?.participants.find((p) => p.id !== currentUserId)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b p-3">
        <Link to="/" className="md:hidden" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar className="size-9">
          <AvatarFallback>
            {other ? initials(other.displayName) : '?'}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium">
          {other?.displayName ?? 'Conversación'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages ?? []} currentUserId={currentUserId} />
      </div>
      <MessageInput onSend={handleSend} />
    </div>
  )
}
