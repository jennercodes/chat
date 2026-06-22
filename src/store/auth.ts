import { create } from 'zustand'
import type { AuthResult } from '#/lib/validation/auth'
import type { User } from '#/types/domain'

/**
 * Estado de sesión en el cliente. El **access token vive solo en memoria** (este
 * store); nunca en localStorage/sessionStorage. El refresh token vive en una
 * cookie httpOnly gestionada por el BFF.
 */
interface AuthState {
  accessToken: string | null
  user: User | null
  setSession: (session: AuthResult) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}))

/** Lee el access token fuera de React (p. ej. en el cliente HTTP). */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken
}
