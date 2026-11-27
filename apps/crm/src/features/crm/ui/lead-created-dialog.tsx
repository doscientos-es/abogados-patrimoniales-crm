import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ViabilidadInicial } from '@/features/crm/application/initial-viability'

const summary = {
  apto: 'Aviso activo para concertar la primera cita',
  pendiente: 'Tarea obligatoria: Revisar viabilidad',
  no_apto: 'Lead cerrado · Comunicación pendiente',
}

/** All branches arrive here only after their dated action has been persisted. */
export function LeadCreatedDialog({
  reference,
  contactName,
  viability,
  date,
  owner,
  onFinish,
}: {
  reference: string
  contactName: string
  viability: ViabilidadInicial
  date: string
  owner: string
  onFinish: (tab?: 'firstMeeting') => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onFinish()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Lead creado correctamente</DialogTitle>
          <DialogDescription>
            <span className="text-foreground font-mono font-semibold">{reference}</span>
            {contactName ? <> · {contactName}</> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="border-border bg-muted/40 space-y-1 rounded-md border px-5 py-4">
          <p className="text-sm font-semibold">{summary[viability]}</p>
          <p className="text-muted-foreground text-sm">
            {date.split('-').reverse().join('/')} · {owner}
          </p>
        </div>
        <DialogFooter className="sm:justify-between">
          {viability === 'apto' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onFinish()}>
                Hacerlo más tarde
              </Button>
              <Button type="button" onClick={() => onFinish('firstMeeting')}>
                Concertar primera cita
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant={viability === 'apto' ? 'ghost' : 'default'}
            onClick={() => onFinish()}
          >
            Ir a la ficha del Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
