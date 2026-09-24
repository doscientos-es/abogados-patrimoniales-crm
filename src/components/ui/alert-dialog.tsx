import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as DoscientosAlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as DoscientosAlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@doscientos/ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}

export function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof DoscientosAlertDialogContent>) {
  return (
    <DoscientosAlertDialogContent
      {...props}
      className={cn('max-h-[calc(100dvh-2rem)] overflow-y-auto', className)}
    />
  )
}

export function AlertDialogFooter({
  className,
  ...props
}: ComponentProps<typeof DoscientosAlertDialogFooter>) {
  return <DoscientosAlertDialogFooter {...props} className={cn('sticky bottom-0 z-10', className)} />
}
