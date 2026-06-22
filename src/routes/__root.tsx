import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useEffect } from 'react'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { getSessionFn } from '#/server/auth'
import { useAuthStore } from '#/store/auth'
import { Toaster } from '#/components/ui/sonner'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  // Resuelve la sesión desde la cookie httpOnly y la expone en el contexto del
  // router (`context.session`) para los guards de las rutas hijas.
  beforeLoad: async () => {
    const session = await getSessionFn()
    return { session }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Chat' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

/** Sincroniza la sesión del contexto del router con el store en memoria. */
function AuthSync() {
  const session = Route.useRouteContext({ select: (c) => c.session })
  const setSession = useAuthStore((s) => s.setSession)
  const clear = useAuthStore((s) => s.clear)
  useEffect(() => {
    if (session) setSession(session)
    else clear()
  }, [session, setSession, clear])
  return null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthSync />
        {children}
        <Toaster />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
