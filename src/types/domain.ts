/**
 * Tipos del dominio. La fuente de verdad son los esquemas Zod en
 * `#/lib/validation/domain`; aquí solo se re-exportan para tener una ruta de
 * importación estable de tipos.
 */
export type {
  User,
  Conversation,
  Message,
  MessageStatus,
} from '#/lib/validation/domain'
