import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { LoginForm } from '#/features/auth/login-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    // Si ya hay sesión, no mostramos el login.
    if (context.session) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Entra para acceder a tus chats. (mock: ana@chat.dev / password)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm onSuccess={() => router.navigate({ to: '/' })} />
        </CardContent>
      </Card>
    </div>
  )
}
