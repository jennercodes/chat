import { createFileRoute } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useLogout } from '#/features/auth/use-auth'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/_authed/')({
  component: Home,
})

function Home() {
  const session = Route.useRouteContext({ select: (c) => c.session })
  const logout = useLogout()

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">
        Hola, {session?.user.displayName ?? 'usuario'} 👋
      </h1>
      <p className="text-muted-foreground mt-2">
        Sesión iniciada. Aquí irá la lista de conversaciones (Fase 3).
      </p>
      <Button
        variant="outline"
        className="mt-6 gap-2"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
      >
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </div>
  )
}
