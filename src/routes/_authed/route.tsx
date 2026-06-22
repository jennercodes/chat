import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { ChatSocketProvider } from '#/lib/ws/use-chat-socket'
import { ConnectionIndicator } from '#/features/chat/connection-indicator'
import { ConversationList } from '#/features/chat/conversation-list'
import { MessageSync } from '#/features/chat/message-sync'
import { useLogout } from '#/features/auth/use-auth'
import { Button } from '#/components/ui/button'

/**
 * Layout protegido (pathless). Guard de sesión + conexión WebSocket (solo para
 * autenticados) + layout de dos paneles (lista de conversaciones / conversación).
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/login' })
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const session = Route.useRouteContext({ select: (c) => c.session })
  const currentUserId = session?.user.id ?? ''
  const logout = useLogout()

  return (
    <ChatSocketProvider>
      <MessageSync />
      <div className="flex h-svh flex-col">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <span className="font-semibold">Chat</span>
          <div className="flex items-center gap-4">
            <ConnectionIndicator />
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {session?.user.displayName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden w-80 shrink-0 flex-col border-r md:flex">
            <ConversationList currentUserId={currentUserId} />
          </aside>
          <main className="min-w-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </ChatSocketProvider>
  )
}
