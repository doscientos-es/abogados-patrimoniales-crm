import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAccionViabilidad, type OportunidadPersistida } from '@/features/crm'
import {
  canalRechazo,
  fechaLocalMadrid,
  leerViabilidad,
  MOTIVOS_NO_APTO,
  VIABILIDAD_OPCIONES,
  type ViabilidadInicial,
} from '@/features/crm/application/initial-viability'
import type { TareaPersistida } from '@/features/tareas'

const selectClass = 'border-input bg-background h-9 rounded-md border px-3 text-sm'
const openTask = (task: TareaPersistida) => !['Completada', 'Cancelada'].includes(task.estado)
const dayFormat = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
})
const subject = 'Respuesta a su consulta'
const template =
  'Hola,\n\nGracias por contactar con nuestro despacho. Le comunicamos que no podremos asumir el asunto. No hemos aceptado el encargo.\n\nUn saludo.'

export function LeadViabilityPanel({
  opportunity,
  firmId,
  tasks,
  tasksLoaded,
  canAct,
  contact,
}: {
  opportunity: OportunidadPersistida
  firmId: string
  tasks: TareaPersistida[]
  tasksLoaded: boolean
  canAct: boolean
  contact: { email: string; phone: string }
}) {
  const fieldId = useId()
  const state = leerViabilidad(opportunity.detalles)
  const action = useAccionViabilidad(firmId)
  const [result, setResult] = useState<ViabilidadInicial>('apto')
  const [revisiting, setRevisiting] = useState(false)
  const [reason, setReason] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [deadlineAccepted, setDeadlineAccepted] = useState(false)
  const [body, setBody] = useState(template)
  const [emailSubject, setEmailSubject] = useState(subject)
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email')
  const [confirmed, setConfirmed] = useState(false)
  const [conflictChecked, setConflictChecked] = useState(false)
  const [error, setError] = useState('')
  if (!state.managed || !state.choice) return null

  const target = tasks.find((task) => task.id === state.taskId && openTask(task))
  const activeMeeting = tasks.find(
    (task) =>
      openTask(task) &&
      task.tipo === 'Evento' &&
      task.asignadoId &&
      task.venceEn &&
      task.reunion['specialType'] === 'meeting' &&
      task.reunion['meetingType'] === 'Primera cita' &&
      !['preparation', 'cancelled', 'not_held', 'finished'].some(
        (status) => task.reunion['status'] === status,
      ),
  )
  const datedTarget = target?.venceEn && target.asignadoId ? Date.parse(target.venceEn) : NaN
  const missing = state.choice === 'apto' && !activeMeeting && !Number.isFinite(datedTarget)
  const overdue = !activeMeeting && datedTarget < Date.now()
  const link = canalRechazo(
    channel,
    channel === 'email' ? contact.email : contact.phone,
    emailSubject,
    body,
  )
  const execute = async (
    input: Omit<Parameters<typeof action.mutateAsync>[0], 'id' | 'version'>,
    message: string,
  ) => {
    setError('')
    try {
      await action.mutateAsync({ id: opportunity.id, version: opportunity.version, ...input })
      toast.success(message)
      setDeadlineAccepted(false)
      setConfirmed(false)
      setRevisiting(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la actuación.')
    }
  }
  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const date = new FormData(event.currentTarget).get('review-date')
    if (typeof date !== 'string' || date < fechaLocalMadrid()) return
    void execute(
      {
        action: 'review',
        result,
        date,
        ...(result === 'no_apto'
          ? { reason: reason === 'Otro motivo' ? otherReason : reason }
          : {}),
        acceptedDeadlineWarning: deadlineAccepted,
      },
      result === 'pendiente' ? 'Nueva revisión programada.' : 'Lead reclasificado.',
    )
  }
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="text-base font-semibold">Viabilidad inicial</h2>
        <p className="text-muted-foreground text-sm">
          {VIABILIDAD_OPCIONES.find((item) => item.value === state.choice)?.label}
        </p>
        {target && Number.isFinite(datedTarget) && !activeMeeting ? (
          <p className="text-sm">
            Siguiente acción: {target.titulo} · vence {dayFormat.format(datedTarget)}.
          </p>
        ) : null}
        {tasksLoaded && missing ? (
          <p role="alert" className="text-destructive text-sm">
            APTO sin cita ni aviso activo con fecha y responsable.
          </p>
        ) : null}
        {tasksLoaded && overdue ? (
          <p role="alert" className="text-destructive text-sm">
            {state.choice === 'pendiente'
              ? 'Revisión de viabilidad vencida.'
              : state.choice === 'no_apto'
                ? 'Aviso de comunicación vencido.'
                : 'Aviso para concertar la cita vencido.'}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        {state.choice === 'apto' ? (
          state.conflictAt ? (
            <p className="text-sm">
              Comprobación de conflicto registrada: {dayFormat.format(new Date(state.conflictAt))}.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Comprueba las partes y las contrapartes del asunto antes de concertar la primera
                cita. LEX no realiza esta comprobación automáticamente.
              </p>
              {canAct ? (
                <>
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={conflictChecked}
                      onChange={(event) => setConflictChecked(event.target.checked)}
                    />
                    He revisado el conflicto de intereses y no he identificado un impedimento para
                    citar.
                  </label>
                  <Button
                    type="button"
                    disabled={!conflictChecked || action.isPending}
                    onClick={() =>
                      void execute({ action: 'confirm_conflict_check' }, 'Comprobación registrada.')
                    }
                  >
                    Registrar comprobación
                  </Button>
                </>
              ) : null}
            </div>
          )
        ) : null}

        {state.choice === 'apto' &&
        opportunity.fase === 'first_meeting' &&
        tasksLoaded &&
        canAct &&
        !tasks.some(
          (task) =>
            task.estado !== 'Cancelada' &&
            task.reunion['specialType'] === 'meeting' &&
            task.reunion['meetingType'] === 'Primera cita',
        ) ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setResult('pendiente')
              setRevisiting(!revisiting)
            }}
          >
            {revisiting ? 'Ocultar revisión' : 'Revisar viabilidad antes de citar'}
          </Button>
        ) : null}
        {(state.choice === 'pendiente' || (state.choice === 'apto' && revisiting)) && canAct ? (
          <form className="space-y-3" onSubmit={submitReview}>
            <label className="flex flex-col gap-1 text-sm">
              Resultado de la revisión
              <select
                className={selectClass}
                value={result}
                onChange={(event) => {
                  const choice = VIABILIDAD_OPCIONES.find(
                    ({ value }) => value === event.target.value,
                  )
                  if (choice) setResult(choice.value)
                  setDeadlineAccepted(false)
                }}
              >
                {VIABILIDAD_OPCIONES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${fieldId}-date`} className="flex flex-col gap-1 text-sm">
              Fecha de la siguiente acción
              <Input
                id={`${fieldId}-date`}
                name="review-date"
                type="date"
                min={fechaLocalMadrid()}
                required
              />
            </label>
            {result === 'no_apto' ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Motivo de no aceptación
                  <select
                    className={selectClass}
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  >
                    <option value="">Selecciona un motivo…</option>
                    {MOTIVOS_NO_APTO.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                {reason === 'Otro motivo' ? (
                  <label htmlFor={`${fieldId}-reason`} className="flex flex-col gap-1 text-sm">
                    Detalla el motivo
                    <Textarea
                      id={`${fieldId}-reason`}
                      value={otherReason}
                      onChange={(event) => setOtherReason(event.target.value)}
                      required
                      maxLength={1000}
                    />
                  </label>
                ) : null}
                {state.urgent ? (
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      required
                      checked={deadlineAccepted}
                      onChange={(event) => setDeadlineAccepted(event.target.checked)}
                    />
                    He revisado el plazo indicado. Quedará pendiente comunicar la no aceptación.
                  </label>
                ) : null}
              </>
            ) : null}
            <Button type="submit" disabled={action.isPending}>
              {result === 'pendiente'
                ? 'Programar otra revisión'
                : 'Guardar revisión y reclasificar'}
            </Button>
          </form>
        ) : null}

        {state.choice === 'no_apto' ? (
          <div className="space-y-3">
            {state.reason ? <p className="text-sm">Motivo interno: {state.reason}</p> : null}
            {state.noticeAt ? (
              <p className="text-sm">
                Comunicación registrada por {state.noticeChannel} el{' '}
                {dayFormat.format(new Date(state.noticeAt))}.
              </p>
            ) : (
              <>
                <p className="text-sm font-medium">Comunicación pendiente</p>
                {state.urgent ? (
                  <p role="alert" className="text-destructive text-sm">
                    Se indicó un plazo concreto. Revisa el plazo y prioriza informar al contacto.
                  </p>
                ) : null}
                {canAct ? (
                  <>
                    <label className="flex flex-col gap-1 text-sm">
                      Canal de comunicación
                      <select
                        className={selectClass}
                        value={channel}
                        onChange={(event) => {
                          setChannel(event.target.value === 'whatsapp' ? 'whatsapp' : 'email')
                          setConfirmed(false)
                        }}
                      >
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </label>
                    {channel === 'email' ? (
                      <label htmlFor={`${fieldId}-subject`} className="flex flex-col gap-1 text-sm">
                        Asunto
                        <Input
                          id={`${fieldId}-subject`}
                          value={emailSubject}
                          onChange={(event) => setEmailSubject(event.target.value)}
                          maxLength={160}
                        />
                      </label>
                    ) : null}
                    <label htmlFor={`${fieldId}-body`} className="flex flex-col gap-1 text-sm">
                      Mensaje de no aceptación
                      <Textarea
                        id={`${fieldId}-body`}
                        value={body}
                        rows={5}
                        onChange={(event) => setBody(event.target.value)}
                        maxLength={2000}
                      />
                    </label>
                    {link && body.trim() ? (
                      <a
                        className="text-primary text-sm underline"
                        href={link}
                        target={channel === 'whatsapp' ? '_blank' : undefined}
                        rel="noreferrer"
                      >
                        Abrir {channel === 'email' ? 'correo' : 'WhatsApp'} para enviar
                      </a>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Para abrir el canal necesitas un dato de contacto válido y un mensaje.
                      </p>
                    )}
                    <p className="text-muted-foreground text-sm">
                      Abrir el borrador no lo envía ni registra su envío.
                    </p>
                    <label className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      Confirmo que he enviado el aviso por este canal.
                    </label>
                    <Button
                      type="button"
                      disabled={!confirmed || action.isPending}
                      onClick={() =>
                        void execute({ action: 'confirm_notice', channel }, 'Envío registrado.')
                      }
                    >
                      Registrar envío
                    </Button>
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
