import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { ChatSocketProvider } from '#/lib/ws/use-chat-socket'
import { ConnectionIndicator } from '#/features/chat/connection-indicator'

/**
 * Layout protegido (pathless). Su `beforeLoad` corre antes que el de cualquier
 * ruta hija: si no hay sesión, redirige a /login. La sesión la resuelve el
 * `beforeLoad` del root (lee la cookie httpOnly vía el BFF).
 *
 * Además abre la conexión WebSocket (solo para usuarios autenticados) y muestra
 * el estado de conexión en la cabecera.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/login' })
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  return (
    <ChatSocketProvider>
      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold">Chat</span>
          <ConnectionIndicator />
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </ChatSocketProvider>
  )
}
