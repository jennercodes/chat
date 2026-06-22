import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void
  disabled?: boolean
}) {
  const [value, setValue] = useState('')

  function submit() {
    const content = value.trim()
    if (!content) return
    onSend(content)
    setValue('')
  }

  return (
    <form
      className="flex items-end gap-2 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Escribe un mensaje…"
        rows={1}
        className="max-h-32 min-h-10 resize-none"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled ?? value.trim() === ''}
        aria-label="Enviar"
      >
        <Send className="size-4" />
      </Button>
    </form>
  )
}
