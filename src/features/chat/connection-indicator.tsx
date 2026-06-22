import { useConnectionStore } from '#/store/connection'
import { cn } from '#/lib/utils'
import type { ConnectionStatus } from '#/lib/ws/types'

const LABEL: Record<ConnectionStatus, string> = {
  idle: 'Sin conexión',
  connecting: 'Conectando…',
  open: 'Conectado',
  reconnecting: 'Reconectando…',
  closed: 'Desconectado',
}

const DOT: Record<ConnectionStatus, string> = {
  idle: 'bg-muted-foreground',
  connecting: 'bg-amber-500',
  open: 'bg-emerald-500',
  reconnecting: 'bg-amber-500',
  closed: 'bg-red-500',
}

export function ConnectionIndicator() {
  const status = useConnectionStore((s) => s.status)
  const pulsing = status === 'connecting' || status === 'reconnecting'

  return (
    <div className="text-muted-foreground flex items-center gap-2 text-sm">
      <span
        className={cn(
          'size-2 rounded-full',
          DOT[status],
          pulsing && 'animate-pulse',
        )}
        aria-hidden
      />
      {LABEL[status]}
    </div>
  )
}
