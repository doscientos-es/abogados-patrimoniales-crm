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

const DIALOG_SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-3xl lg:max-w-4xl',
  '5xl': 'sm:max-w-3xl lg:max-w-5xl',
} as const

export type DialogSize = keyof typeof DIALOG_SIZES

export function DialogContent({
  className,
  size = 'lg',
  ...props
}: ComponentProps<typeof DoscientosDialogContent> & { size?: DialogSize }) {
  return (
    <DoscientosDialogContent
      {...props}
      className={cn('max-h-[calc(100dvh-2rem)] overflow-y-auto', DIALOG_SIZES[size], className)}
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
