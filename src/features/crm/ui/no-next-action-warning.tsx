import { AlertTriangle } from 'lucide-react'

/** Cross-cutting notice shown when a Lead has no task marked as its next action. */
export function NoNextActionWarning({ onDefine }: { onDefine?: (() => void) | undefined }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-md border px-5 py-4"
    >
      <div className="space-y-1">
        <p className="text-destructive flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
          <AlertTriangle className="size-4" aria-hidden="true" /> Sin siguiente acción
        </p>
        <p className="text-muted-foreground text-sm">
          Este Lead todavía no tiene definida ninguna actuación para hacerlo avanzar.
        </p>
      </div>
      {onDefine ? (
        <button
          type="button"
          onClick={onDefine}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Definir en Tareas
        </button>
      ) : null}
    </div>
  )
}
