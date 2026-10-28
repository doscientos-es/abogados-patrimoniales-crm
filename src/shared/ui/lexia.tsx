import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

export const LEXIA = 'LEXIA'

export function LexiaMark({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cn('text-primary inline-flex items-center gap-1 font-semibold', className)}>
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="tracking-wide">{LEXIA}</span>
      {label ? <span className="text-foreground font-medium">· {label}</span> : null}
    </span>
  )
}

export function LexiaIcon({ className }: { className?: string }) {
  return <Sparkles className={cn('h-4 w-4', className)} aria-hidden="true" />
}