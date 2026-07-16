import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { loginFn, logoutFn } from '#/server/auth'
import { getAccessToken, useAuthStore } from '#/store/auth'
import type { LoginInput } from '#/lib/validation/auth'

/**
 * Mutación de login: llama al BFF, guarda la sesión en memoria e invalida el
 * router para que el guard re-evalúe con la cookie ya seteada.
 */
export function useLogin() {
  const router = useRouter()
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (input: LoginInput) => loginFn({ data: input }),
    onSuccess: async (session) => {
      setSession(session)
      await router.invalidate()
    },
  })
}

/** Mutación de logout: revoca en el BFF, limpia memoria y vuelve a /login. */
export function useLogout() {
  const router = useRouter()
  const clear = useAuthStore((s) => s.clear)
  return useMutation({
    mutationFn: () => logoutFn({ data: { accessToken: getAccessToken() } }),
    onSuccess: async () => {
      clear()
      await router.invalidate()
      await router.navigate({ to: '/login' })
    },
  })
}
