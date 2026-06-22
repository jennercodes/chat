import { createFileRoute } from '@tanstack/react-router'
import { ConversationList } from '#/features/chat/conversation-list'

export const Route = createFileRoute('/_authed/')({
  component: Home,
})

function Home() {
  const session = Route.useRouteContext({ select: (c) => c.session })
  const currentUserId = session?.user.id ?? ''

  return (
    <div className="h-full">
      {/* Móvil: la lista ocupa la pantalla. */}
      <div className="h-full md:hidden">
        <ConversationList currentUserId={currentUserId} />
      </div>
      {/* Escritorio: la lista vive en la barra lateral; aquí va el estado vacío. */}
      <div className="text-muted-foreground hidden h-full items-center justify-center p-8 text-center md:flex">
        Selecciona una conversación o empieza una nueva.
      </div>
    </div>
  )
}
