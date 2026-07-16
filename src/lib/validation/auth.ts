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
 * Entrada de `logoutFn`: el cliente reenvía su access token para que el BFF pueda
 * autenticar `POST /auth/logout` (Bearer). El BFF no tiene el access token (vive
 * en memoria del cliente), solo el refresh en la cookie httpOnly.
 */
export const logoutInputSchema = z.object({
  accessToken: z.string().nullish(),
})
export type LogoutInput = z.infer<typeof logoutInputSchema>

/**
 * Respuesta del backend real (`/auth/login` y `/auth/refresh`) que consume el
 * BFF. Trae ambos tokens: el BFF mueve el `refreshToken` a la cookie httpOnly y
 * solo reenvía `accessToken` + `user` al cliente. Ver docs/contrato-backend.md §3.
 */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().optional(), // segundos de vida del access token
  user: userSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

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
