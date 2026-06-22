import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

/**
 * Variables de entorno validadas (lado cliente).
 *
 * Las variables exclusivas del servidor (p. ej. la URL del backend que usará el
 * BFF para el refresh de tokens) se añadirán en la Fase 1 leyendo `process.env`,
 * ya que `import.meta.env` solo expone las variables con prefijo `VITE_`.
 */
export const env = createEnv({
  /**
   * Prefijo obligatorio para variables expuestas al navegador. Se valida tanto
   * a nivel de tipos como en runtime.
   */
  clientPrefix: 'VITE_',

  client: {
    /** Base de la API REST del backend. */
    VITE_API_URL: z.string().url(),
    /** URL del WebSocket de chat. */
    VITE_WS_URL: z.string().url(),
    /** Usa un WebSocket simulado en memoria (mientras no haya backend real). */
    VITE_WS_MOCK: z.enum(['true', 'false']).optional(),
    /** Título de la app (opcional). */
    VITE_APP_TITLE: z.string().min(1).optional(),
  },

  /** Fuente de las variables en runtime. */
  runtimeEnv: import.meta.env,

  /** Trata cadenas vacías como `undefined` (recomendado). */
  emptyStringAsUndefined: true,
})
