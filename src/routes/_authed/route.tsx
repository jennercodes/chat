import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Layout protegido (pathless). Su `beforeLoad` corre antes que el de cualquier
 * ruta hija: si no hay sesión, redirige a /login. La sesión la resuelve el
 * `beforeLoad` del root (lee la cookie httpOnly vía el BFF).
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/login' })
  },
  component: () => <Outlet />,
})
