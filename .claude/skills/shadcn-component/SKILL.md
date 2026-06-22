---
name: shadcn-component
description: Añadir y usar componentes de shadcn/ui en este repo — CLI de instalación, alias `#/components/ui`, estilo `new-york`, iconos `lucide`, util `cn` y Tailwind v4. Úsalo siempre que construyas UI (botones, inputs, diálogos, avatares, etc.).
---

# shadcn/ui en este proyecto

Config en `components.json`: estilo `new-york`, `baseColor` zinc, CSS variables,
iconos `lucide`. Aliases: `#/components`, ui `#/components/ui`, lib `#/lib`,
utils `#/lib/utils`, hooks `#/hooks`.

## Añadir un componente

```bash
pnpm dlx shadcn@latest add button -y
# varios a la vez:
pnpm dlx shadcn@latest add input dialog avatar scroll-area -y
```

Crea el archivo en `src/components/ui/<componente>.tsx` (editable, vive en el
repo). Para sobrescribir uno existente: añade `--overwrite`.

## Usar un componente

```tsx
import { Button } from '#/components/ui/button'
import { Send } from 'lucide-react'
import { cn } from '#/lib/utils'

export function SendButton({ className }: { className?: string }) {
  return (
    <Button className={cn('gap-2', className)}>
      <Send className="size-4" /> Enviar
    </Button>
  )
}
```

## Reglas

- **Tailwind v4**: la config es CSS-first en `src/styles.css` (`@theme`,
  `@import 'tailwindcss'`). **No** hay `tailwind.config.js`.
- Combina/condiciona clases con `cn()` de `#/lib/utils` (clsx + tailwind-merge).
- Iconos: importa desde `lucide-react`; tamaño con clases (`size-4`, `size-5`).
- Reutiliza los primitivos de `#/components/ui`; los componentes compuestos de
  cada feature van en `src/features/<feature>/` (no en `components/ui`).
- Accesibilidad: respeta los roles/labels que trae shadcn; añade `aria-label` en
  botones solo-icono.
