import { TableHead as SharedTableHead, TableRow as SharedTableRow } from '@doscientos/ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHeader } from '@doscientos/ui'

export function TableHead({ className, ...props }: ComponentProps<typeof SharedTableHead>) {
  return (
    <SharedTableHead
      {...props}
      className={cn(
        'text-muted-foreground text-xs font-medium tracking-normal normal-case',
        className,
      )}
    />
  )
}

export function TableRow({ className, ...props }: ComponentProps<typeof SharedTableRow>) {
  return (
    <SharedTableRow {...props} className={cn('border-border/60 hover:bg-muted/30', className)} />
  )
}
