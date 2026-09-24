import {
  Dialog,
  DialogClose,
  DialogContent as DoscientosDialogContent,
  DialogDescription,
  DialogFooter as DoscientosDialogFooter,
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
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
}

export function DialogContent({
  className,
  ...props
}: ComponentProps<typeof DoscientosDialogContent>) {
  return (
    <DoscientosDialogContent
      {...props}
      className={cn('max-h-[calc(100dvh-2rem)] overflow-y-auto', className)}
    />
  )
}

export function DialogFooter({
  className,
  ...props
}: ComponentProps<typeof DoscientosDialogFooter>) {
  return <DoscientosDialogFooter {...props} className={cn('sticky bottom-0 z-10', className)} />
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DoscientosDialogTitle>) {
  return <DoscientosDialogTitle {...props} className={cn('tracking-wide uppercase', className)} />
}
