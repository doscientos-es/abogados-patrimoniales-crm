import { Input as DoscientosInput } from '@doscientos/ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

type InputProps = ComponentProps<typeof DoscientosInput>

export function Input({ className, ...props }: InputProps) {
  return <DoscientosInput {...props} className={cn('leading-normal', className)} />
}
