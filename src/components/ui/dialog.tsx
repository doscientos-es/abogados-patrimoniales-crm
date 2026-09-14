import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle as DoscientosDialogTitle,
  DialogTrigger,
} from '@doscientos/ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DoscientosDialogTitle>) {
  return <DoscientosDialogTitle {...props} className={cn('tracking-wide uppercase', className)} />
}
