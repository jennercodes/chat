import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react'
import { cn } from '#/lib/utils'
import { formatTime } from './format'
import type { Message, MessageStatus } from '#/types/domain'

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'sending':
      return <Clock className="size-3" />
    case 'sent':
      return <Check className="size-3" />
    case 'delivered':
    case 'read':
      return <CheckCheck className="size-3" />
    case 'failed':
      return <AlertCircle className="size-3 text-red-400" />
    default:
      return null
  }
}

export function MessageBubble({
  message,
  mine,
}: {
  message: Message
  mine: boolean
}) {
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
          mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        <p className="break-words whitespace-pre-wrap">{message.content}</p>
        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-[10px]',
            mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {mine && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  )
}
