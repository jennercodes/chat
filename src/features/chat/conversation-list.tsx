import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { listConversations } from '#/lib/api/chat'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { NewConversationDialog } from './new-conversation-dialog'
import { formatTime, initials } from './format'
import type { Conversation } from '#/types/domain'

function ConversationItem({
  conversation,
  currentUserId,
}: {
  conversation: Conversation
  currentUserId: string
}) {
  const other =
    conversation.participants.find((p) => p.id !== currentUserId) ??
    conversation.participants[0]

  return (
    <Link
      to="/chat/$conversationId"
      params={{ conversationId: conversation.id }}
      className="hover:bg-accent flex items-center gap-3 p-3"
      activeProps={{ className: 'bg-accent' }}
    >
      <Avatar className="size-10">
        <AvatarFallback>{initials(other?.displayName ?? '?')}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{other?.displayName}</span>
          {conversation.lastMessage && (
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatTime(conversation.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground truncate text-sm">
            {conversation.lastMessage?.content ?? 'Sin mensajes'}
          </span>
          {conversation.unreadCount > 0 && (
            <Badge className="shrink-0">{conversation.unreadCount}</Badge>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ConversationList({ currentUserId }: { currentUserId: string }) {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => listConversations(),
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3">
        <h2 className="font-semibold">Conversaciones</h2>
        <NewConversationDialog />
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col gap-3 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}
        {conversations?.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            currentUserId={currentUserId}
          />
        ))}
        {conversations?.length === 0 && (
          <p className="text-muted-foreground p-4 text-sm">
            Aún no tienes conversaciones. Crea una nueva.
          </p>
        )}
      </div>
    </div>
  )
}
