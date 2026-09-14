import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle as DoscientosCardTitle,
} from '@doscientos/ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export { Card, CardContent, CardDescription, CardFooter, CardHeader }

export function CardTitle({ className, ...props }: ComponentProps<typeof DoscientosCardTitle>) {
  return <DoscientosCardTitle {...props} className={cn('tracking-wide uppercase', className)} />
}
