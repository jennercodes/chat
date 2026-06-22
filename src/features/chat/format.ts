import type { Message } from '#/types/domain'

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function formatDayLabel(iso: string): string {
  const now = new Date()
  const key = dayKey(iso)
  if (key === dayKey(now.toISOString())) return 'Hoy'
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (key === dayKey(yesterday.toISOString())) return 'Ayer'
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  })
}

export interface MessageGroup {
  key: string
  label: string
  items: Array<Message>
}

/** Agrupa mensajes consecutivos por día. */
export function groupByDay(messages: Array<Message>): Array<MessageGroup> {
  const groups: Array<MessageGroup> = []
  for (const message of messages) {
    const key = dayKey(message.createdAt)
    const last = groups.at(-1)
    if (last && last.key === key) {
      last.items.push(message)
    } else {
      groups.push({
        key,
        label: formatDayLabel(message.createdAt),
        items: [message],
      })
    }
  }
  return groups
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
