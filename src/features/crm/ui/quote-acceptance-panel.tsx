import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ClipboardCheck, Copy, Link2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthSession } from '@/features/auth'
import {
  construirAceptacionManual,
  contratacionAceptada,
  describirAceptacion,
  esMedioVerbal,
  faltantesAceptacion,
  MEDIOS_ACEPTACION,
  pasosAvanceHastaEnvio,
  registrarRespuesta,
  versionEnviada,
  type AceptacionManualInput,
  type TipoEvidenciaAceptacion,
} from '@/features/crm/application/quote-acceptance'
import { ENVIO_REGISTRADO, copiaEnviada, euros, fechaEnvioEs, leerEditor, versionesEnviadas, type CopiaVersion } from '@/features/crm/application/quote-editor'
import { leerProforma } from '@/features/crm/application/proforma'
import { useActualizarDetallesOportunidad, useMiembrosDespacho } from '@/features/crm/infrastructure/supabase-oportunidades'
import { documentoHtml, imprimir, type Cliente } from '@/features/crm/ui/quote-document'
import { useCrearOnboarding, useOnboardings } from '@/features/onboarding'
import { useCompletarTarea, useTareaPorId } from '@/features/tareas'
import { getSupabaseBrowserClient, type Json } from '@/shared/infrastructure/supabase'

type LinkRow = {
  id: string
  quote_version: number
  created_at: string
  expires_at: string
  revoked_at: string | null
  accepted_at: string | null
  acceptor_name: string | null
}
type AcceptanceInput = Omit<AceptacionManualInput, 'importe' | 'por'>
type Rec = Record<string, unknown>
const rec = (value: unknown): Rec => value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : {}
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const today = () => new Date().toISOString().slice(0, 10)

export function QuoteAcceptancePanel({ firmId, opportunity, cliente, canEdit, onIrPresupuesto }: {
  firmId: string
  opportunity: OportunidadPersistida
  cliente: Cliente
  canEdit: boolean
  onIrPresupuesto: () => void
}) {
  const queryClient = useQueryClient()
  const session = useAuthSession()
  const userId = session.status === 'signed-in' ? session.user.id : null
  const save = useActualizarDetallesOportunidad(firmId)
  const members = useMiembrosDespacho(firmId)
  const onboardings = useOnboardings(firmId)
  const createOnboarding = useCrearOnboarding(firmId)
  const completeTask = useCompletarTarea(firmId)
  const details = rec(opportunity.detalles)
  const quote = rec(details['presupuesto'])
  const acceptance = rec(details['aceptacion'])
  const sentVersion = versionEnviada(opportunity.detalles)
  const editor = leerEditor(opportunity.detalles)
  const sent = sentVersion === null ? null : [editor?.actual, ...(editor?.anteriores ?? [])].find((item) => item?.version === sentVersion) ?? null
  const snapshot = sent ? copiaEnviada(sent) : null
  const acceptanceDescription = describirAceptacion(acceptance)
  const onboarding = onboardings.data?.find((item) => item.oportunidadId === opportunity.id)
  const tracking = rec(details['seguimientoCliente'])
  const trackingTask = rec(tracking['tarea'])
  const taskId = typeof trackingTask['tareaId'] === 'string' ? trackingTask['tareaId'] : undefined
  const followupTask = useTareaPorId(firmId, taskId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [documentOpen, setDocumentOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const links = useQuery({
    queryKey: ['crm', 'acceptance-links', firmId, opportunity.id],
    enabled: sentVersion !== null,
    retry: false,
    queryFn: async (): Promise<LinkRow[] | null> => {
      const client = getSupabaseBrowserClient()
      if (!client) return null
      const { data, error } = await client
        .from('crm_quote_acceptance_links' as never)
        .select('id,quote_version,created_at,expires_at,revoked_at,accepted_at,acceptor_name')
        .eq('opportunity_id', opportunity.id)
        .order('created_at', { ascending: false })
      if (error) return null
      return data as unknown as LinkRow[]
    },
  })
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['crm', 'oportunidades', firmId, opportunity.id] }),
    queryClient.invalidateQueries({ queryKey: ['crm', 'oportunidades', firmId] }),
    queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
    queryClient.invalidateQueries({ queryKey: ['onboardings', firmId] }),
    links.refetch(),
  ])

  const startOnboarding = async (saved = opportunity) => {
    if (onboarding) return
    try {
      await createOnboarding.mutateAsync({
        contactoId: saved.contactoId,
        oportunidadId: saved.id,
        asunto: saved.titulo,
        presupuestoReferencia: text(quote['referencia']) || saved.referencia,
        importePresupuesto: typeof quote['importeEnviado'] === 'number' ? quote['importeEnviado'] : Number(text(quote['importeEnviado'])) || null,
        responsableId: saved.asignadoId,
        proformaEnviada: null,
        siguienteAccion: 'Preparar y enviar proforma',
      })
      toast.success('Onboarding iniciado; la proforma queda pendiente de preparar.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar el onboarding.'
      if (/already has onboarding/i.test(message)) return
      toast.error(message)
    }
  }

  const registerManualAcceptance = async (input: AcceptanceInput) => {
    if (busy || sentVersion === null) return
    setBusy(true)
    try {
      if (opportunity.fase === 'won' || opportunity.fase === 'lost')
        throw new Error(opportunity.fase === 'won' ? 'El Lead ya está aceptado.' : 'El Lead está cerrado como perdido.')
      const manual = construirAceptacionManual(opportunity.detalles, {
        ...input,
        importe: text(quote['importeEnviado']),
        por: userId,
      })
      let expectedVersion = opportunity.version
      for (const step of pasosAvanceHastaEnvio(opportunity.fase, opportunity.detalles)) {
        const savedStep = await save.mutateAsync({
          id: opportunity.id,
          versionEsperada: expectedVersion,
          detalles: step.detalles,
          ...(step.transicion ? { transicionContratacion: step.transicion } : {}),
        })
        expectedVersion = savedStep.version
      }
      const trackingDetails = {
        ...details,
        presupuesto: { ...quote, estado: ENVIO_REGISTRADO },
        contratacion: contratacionAceptada(details['contratacion']),
        seguimientoCliente: {
          ...tracking,
          estado: 'aceptado',
          version: sentVersion,
        },
        aceptacion: manual,
      } as unknown as Json
      const saved = await save.mutateAsync({
        id: opportunity.id,
        versionEsperada: expectedVersion,
        detalles: trackingDetails,
        transicionContratacion: { fase: 'won', subestado: 'Aceptado' },
      })
      setDialogOpen(false)
      toast.success('Aceptación registrada. El Lead ha pasado a Aceptado.')
      const task = followupTask.data
      if (task && !['Completada', 'Cancelada'].includes(task.estado)) {
        try {
          await completeTask.mutateAsync({ task, resultado: `Presupuesto ${text(quote['referencia'])} v${sentVersion} aceptado por ${input.aceptante}.` })
        } catch {
          toast.error('La aceptación está guardada, pero no se pudo completar la tarea de seguimiento.')
        }
      }
      await startOnboarding(saved)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la aceptación.')
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  const recordResponse = async (status: 'cambios' | 'aplazado' | 'rechazado') => {
    const reason = window.prompt(status === 'aplazado' ? 'Indica la fecha de seguimiento (AAAA-MM-DD).' : status === 'rechazado' ? 'Indica el motivo del rechazo.' : 'Describe los cambios solicitados.')
    if (!reason?.trim()) return
    const next = registrarRespuesta(opportunity.detalles, {
      estado: status,
      ...(status === 'aplazado' ? { fechaSeguimiento: reason.trim() } : { motivo: reason.trim() }),
      por: userId,
    })
    try {
      await save.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: status === 'rechazado'
          ? { ...rec(next), contratacion: { ...rec(details['contratacion']), decision: 'Rechazado', motivoRechazo: reason.trim() } } as Json
          : next,
        ...(status === 'rechazado' && opportunity.fase === 'engagement'
          ? { transicionContratacion: { fase: 'lost', subestado: 'Rechazado por el cliente', motivo: reason.trim() } }
          : {}),
      })
      toast.success('Respuesta del cliente registrada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la respuesta.')
    }
  }

  const generateLink = async () => {
    const client = getSupabaseBrowserClient()
    if (!client || busy) return
    setBusy(true)
    try {
      const { data, error } = await client.rpc('crm_create_quote_acceptance_link' as never, {
        target_opportunity_id: opportunity.id,
        valid_days: 30,
      } as never)
      if (error) throw new Error(/function|schema cache/i.test(error.message) ? 'La aceptación online aún no está activada en la base de datos.' : error.message)
      const row = (Array.isArray(data) ? data[0] : data) as { token?: string } | undefined
      if (!row?.token) throw new Error('El servidor no devolvió el enlace.')
      setNewLink(`${window.location.origin}/aceptar/${row.token}`)
      toast.success('Enlace generado. Cópialo ahora; por seguridad solo se muestra una vez.')
      await links.refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el enlace.')
    } finally {
      setBusy(false)
    }
  }

  const revokeLink = async (id: string) => {
    const client = getSupabaseBrowserClient()
    if (!client || !window.confirm('¿Revocar este enlace de aceptación?')) return
    const { error } = await client.rpc('crm_revoke_quote_acceptance_link' as never, { target_link_id: id } as never)
    if (error) toast.error(error.message)
    else { toast.success('Enlace revocado.'); setNewLink(null) }
    void links.refetch()
  }

  if (sentVersion === null) {
    return <Card><CardHeader><CardTitle className="text-base">Aceptación</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="text-muted-foreground">Disponible después de registrar el envío real del presupuesto en la pestaña «Enviar al cliente».</p><Button variant="outline" onClick={onIrPresupuesto}>Ir al presupuesto</Button></CardContent></Card>
  }

  const pending = !acceptanceDescription && opportunity.fase !== 'lost'
  const name = (id: string | null) => members.data?.find((member) => member.id === id)?.nombre ?? '—'
  const copy = (value: string) => void navigator.clipboard.writeText(value).then(() => toast.success('Copiado.'), () => toast.error('No se pudo copiar.'))

  return (
    <div className="space-y-4" data-testid="acceptance-panel">
      <Card>
        <CardHeader><CardTitle className="text-base">{acceptanceDescription ? 'Presupuesto aceptado' : 'Pendiente de aceptación'}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="flex flex-wrap items-center gap-2"><strong>{text(quote['referencia']) || sent?.referencia} · versión {sentVersion}</strong><span>{text(quote['importeEnviado']) ? `${text(quote['importeEnviado'])} €` : snapshot?.instantanea ? euros(snapshot.instantanea.totales.total) : '—'}</span><span className="text-muted-foreground">Enviado {sent?.envio ? fechaEnvioEs(sent.envio.fecha) : fechaEnvioEs(text(quote['fechaEnvio']))}</span></p>
          {snapshot ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setDocumentOpen(true)}>Ver documento</Button><Button size="sm" variant="outline" onClick={() => imprimir(snapshot, snapshot.instantanea?.cliente ?? cliente, snapshot.instantanea?.despacho ?? 'LEX & DOSCIENTOS')}>Descargar PDF</Button></div> : <p className="text-muted-foreground text-xs">El registro de envío anterior no contiene copia del documento.</p>}
          {acceptanceDescription ? <dl className="grid gap-2 rounded-md border p-3 sm:grid-cols-2"><div><dt className="text-muted-foreground text-xs">Estado / medio</dt><dd>{acceptanceDescription.estado} · {acceptanceDescription.medio}</dd></div><div><dt className="text-muted-foreground text-xs">Fecha y versión</dt><dd>{text(acceptance['fechaHora']) ? new Date(text(acceptance['fechaHora'])).toLocaleString('es-ES') : text(acceptance['fecha'])} · v{text(acceptance['version'])}</dd></div><div><dt className="text-muted-foreground text-xs">Acepta</dt><dd>{text(acceptance['aceptante']) || '—'}</dd></div><div><dt className="text-muted-foreground text-xs">Evidencia</dt><dd>{text(rec(acceptance['evidencia'])['texto']) || text(acceptance['soporte']) || '—'}</dd></div></dl> : null}
        </CardContent>
      </Card>

      {pending && canEdit ? <Card><CardHeader><CardTitle className="text-base">Registrar respuesta del cliente</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button onClick={() => setDialogOpen(true)}>Registrar aceptación manual</Button><Button variant="outline" onClick={() => void recordResponse('cambios')}>Registrar cambios solicitados</Button><Button variant="outline" onClick={() => void recordResponse('aplazado')}>Aplazar respuesta</Button><Button variant="destructive" onClick={() => void recordResponse('rechazado')}>Rechazar presupuesto</Button></CardContent></Card> : null}

      {pending && opportunity.fase !== 'won' && opportunity.fase !== 'lost' ? <Card><CardHeader><CardTitle className="text-base">Aceptación online segura</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <p role="note" className="rounded-md border px-3 py-2 text-xs">LEX no envía emails. Genera el enlace tokenizado, cópialo junto con el PDF y envíalo por tu canal habitual. Solo el cliente puede aceptar desde ese enlace; abrirlo no registra aceptación.</p>
        {newLink ? <div className="space-y-2 rounded-md border p-3"><div className="flex gap-2"><Input readOnly value={newLink} aria-label="Enlace de aceptación" /><Button size="sm" variant="outline" onClick={() => copy(newLink)}><Copy className="h-4 w-4" /></Button></div><Button size="sm" variant="outline" onClick={() => copy(`Puede consultar y aceptar el presupuesto ${text(quote['referencia'])} (v${sentVersion}) aquí:\n${newLink}`)}>Copiar texto para el email</Button></div> : null}
        {links.data === null ? <p className="text-destructive text-xs">No se pudieron consultar los enlaces. Verifica que la migración de aceptación online esté aplicada y vuelve a cargar.</p> : null}
        {canEdit ? <Button size="sm" variant="outline" disabled={busy || links.isPending || links.data === null} onClick={() => void generateLink()}><Link2 className="mr-1 h-4 w-4" />{links.data?.some((link) => !link.revoked_at && !link.accepted_at) ? 'Generar enlace nuevo' : 'Generar enlace de aceptación'}</Button> : null}
        <Button size="sm" variant="ghost" disabled={links.isFetching} onClick={() => void refresh()}>{links.isFetching ? 'Actualizando…' : 'Actualizar estado'}</Button>
        {links.data?.length ? <ul className="space-y-1 text-xs">{links.data.map((link) => {
          const status = link.accepted_at ? `Aceptado por ${link.acceptor_name ?? '—'}` : link.revoked_at ? 'Revocado' : new Date(link.expires_at) < new Date() ? 'Caducado' : `Activo hasta ${new Date(link.expires_at).toLocaleDateString('es-ES')}`
          return <li key={link.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1"><span>v{link.quote_version} · creado {new Date(link.created_at).toLocaleString('es-ES')} · {status}</span>{!link.accepted_at && !link.revoked_at && canEdit ? <Button size="sm" variant="ghost" onClick={() => void revokeLink(link.id)}>Revocar</Button> : null}</li>
        })}</ul> : null}
      </CardContent></Card> : null}

      {acceptanceDescription ? <Card><CardHeader><CardTitle className="text-base">Inicio del asunto</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{onboarding ? <p>Onboarding <strong>{onboarding.referencia}</strong> ya está vinculado. <Link to="/onboarding" className={buttonVariants({ variant: 'outline', size: 'sm' })}><ClipboardCheck className="h-4 w-4" /> Abrir onboarding</Link></p> : canEdit ? <><p className="text-muted-foreground">El onboarding se crea con la proforma pendiente; la aceptación online puede haberlo iniciado automáticamente.</p><Button size="sm" variant="outline" disabled={createOnboarding.isPending} onClick={() => void startOnboarding()}><ClipboardCheck className="h-4 w-4" /> Iniciar onboarding</Button></> : <p className="text-muted-foreground">Onboarding aún no iniciado.</p>}<p className="text-muted-foreground text-xs">La hoja de encargo y el pago se gestionan en onboarding; no se confirma ningún cobro desde aquí.</p></CardContent></Card> : null}

      {Object.keys(rec(details['contratacion'])).length ? <details className="rounded-md border px-3 py-2 text-xs"><summary className="cursor-pointer">Datos de contratación anteriores (solo lectura)</summary><p className="mt-2">Decisión: {text(rec(details['contratacion'])['decision']) || '—'} · Proforma: {text(rec(details['contratacion'])['proforma']) || '—'} · Pago: {text(rec(details['contratacion'])['pago']) || '—'}</p></details> : null}
      {documentOpen && snapshot ? <Dialog open onOpenChange={(open) => !open && setDocumentOpen(false)}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Documento enviado · v{snapshot.version}</DialogTitle></DialogHeader><div className="rounded-md border bg-white p-6 text-black" dangerouslySetInnerHTML={{ __html: documentoHtml(snapshot, snapshot.instantanea?.cliente ?? cliente, snapshot.instantanea?.despacho ?? 'LEX & DOSCIENTOS', false) }} /></DialogContent></Dialog> : null}
      {dialogOpen ? <ManualAcceptanceDialog cliente={cliente} sentDate={text(quote['fechaEnvio'])} amount={text(quote['importeEnviado'])} busy={busy || save.isPending} onClose={() => setDialogOpen(false)} onSubmit={registerManualAcceptance} /> : null}
    </div>
  )
}

function ManualAcceptanceDialog({ cliente, sentDate, amount, busy, onClose, onSubmit }: {
  cliente: Cliente
  sentDate: string
  amount: string
  busy: boolean
  onClose: () => void
  onSubmit: (input: AcceptanceInput) => Promise<void>
}) {
  const [date, setDate] = useState(today())
  const [medium, setMedium] = useState('')
  const [acceptor, setAcceptor] = useState(cliente.nombre)
  const [reference, setReference] = useState('')
  const [evidence, setEvidence] = useState('')
  const evidenceType: TipoEvidenciaAceptacion = esMedioVerbal(medium) ? 'constancia_interna' : 'comunicacion'
  const input: AcceptanceInput = { fecha: date, medio: medium, aceptante: acceptor, evidenciaTipo: evidenceType, evidenciaReferencia: reference, evidenciaTexto: evidence }
  const missing = faltantesAceptacion(sentDate, input)
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Registrar aceptación manual</DialogTitle><DialogDescription>Se registrará la conformidad sobre la versión enviada{amount ? ` por ${amount} €` : ''}. La evidencia se conserva en el Lead.</DialogDescription></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="accept-date">Fecha *</Label><Input id="accept-date" type="date" min={sentDate.slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="space-y-1"><Label htmlFor="accept-medium">Medio *</Label><select id="accept-medium" className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={medium} onChange={(event) => { setMedium(event.target.value); setReference(''); setEvidence('') }}><option value="">Selecciona…</option>{MEDIOS_ACEPTACION.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="space-y-1 sm:col-span-2"><Label htmlFor="acceptor">Quién acepta *</Label><Input id="acceptor" value={acceptor} onChange={(event) => setAcceptor(event.target.value)} /></div>
      {medium ? esMedioVerbal(medium) ? <div className="space-y-1 sm:col-span-2"><Label htmlFor="accept-evidence">Constancia interna de aceptación verbal *</Label><Textarea id="accept-evidence" rows={3} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></div> : <><div className="space-y-1 sm:col-span-2"><Label htmlFor="accept-reference">Referencia de email, WhatsApp o comunicación *</Label><Input id="accept-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej.: email del 08/10" /></div><div className="space-y-1 sm:col-span-2"><Label htmlFor="accept-evidence">Texto de conformidad *</Label><Textarea id="accept-evidence" rows={3} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></div></> : null}
      <div className="space-y-1"><Label>Importe aceptado</Label><Input readOnly value={amount ? `${amount} €` : '—'} /></div>
    </div>
    {missing.length ? <p className="text-muted-foreground text-xs">Falta: {missing.join(' · ')}</p> : null}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={busy || missing.length > 0} onClick={() => void onSubmit(input)}>{busy ? 'Registrando…' : 'Registrar aceptación'}</Button></DialogFooter>
  </DialogContent></Dialog>
}