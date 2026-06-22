import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { createConversationFn, searchUsersFn } from '#/server/chat'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { initials } from './format'

export function NewConversationDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: users } = useQuery({
    queryKey: ['users', query],
    queryFn: () => searchUsersFn({ data: { query } }),
    enabled: open,
  })

  const create = useMutation({
    mutationFn: (userId: string) => createConversationFn({ data: { userId } }),
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setOpen(false)
      setQuery('')
      await router.navigate({
        to: '/chat/$conversationId',
        params: { conversationId: conversation.id },
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="size-4" /> Nueva
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva conversación</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar usuario…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="mt-2 flex flex-col gap-1">
          {(users ?? []).map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => create.mutate(user.id)}
              disabled={create.isPending}
              className="hover:bg-accent flex items-center gap-3 rounded-md p-2 text-left disabled:opacity-50"
            >
              <Avatar className="size-8">
                <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{user.displayName}</span>
            </button>
          ))}
          {users?.length === 0 && (
            <p className="text-muted-foreground p-2 text-sm">Sin resultados.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
