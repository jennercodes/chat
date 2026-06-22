import { z } from 'zod'
import { userSchema } from './domain'

/**
 * Esquemas de autenticación. El contrato es tentativo (docs/ARQUITECTURA.md
 * §8/§10); manténlos aislados aquí para ajustarlos cuando confirme el backend.
 */

/** Credenciales de login. */
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})
export type LoginInput = z.infer<typeof loginSchema>

/**
 * Resultado de auth que el BFF devuelve al cliente: access token (vive en
 * memoria) + usuario. El refresh token NUNCA llega aquí; vive en cookie
 * httpOnly gestionada por el servidor.
 */
export const authResultSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
})
export type AuthResult = z.infer<typeof authResultSchema>
