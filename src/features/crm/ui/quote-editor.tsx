import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthSession } from '@/features/auth'
import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'
import {
  conEditor,
  datosLegado,
  editarVersion,
  euros,
  editable,
  leerEditor,
  lineaDesdeServicio,
  lineaPersonalizada,
  marcadorRevision,
  mensajeAvisoRevision,
  nuevoBorrador,
  parseEuros,
  problemasParaFinalizar,
  puedeSolicitarRevision,
  solicitarRevision,
  totales,
  totalesLinea,
  type EditorPresupuesto,
  type LineaPresupuesto,
  type VersionPresupuesto,
} from '@/features/crm/application/quote-editor'
import { documentoHtml, imprimir } from '@/features/crm/ui/quote-document'
import { buscarTareaRevisionAbierta } from '@/features/crm/infrastructure/quote-review-tasks'
import { useAvanzarLeadPorHito, useMiembrosDespacho, useActualizarDetallesOportunidad } from '@/features/crm/infrastructure/supabase-oportunidades'
import { useQuoteBlocks, useQuoteServices } from '@/features/crm/infrastructure/supabase-quote-catalogs'
import { useCrearTarea, useTareaPorId, useTareasLead } from '@/features/tareas'
import type { Json } from '@/shared/infrastructure/supabase'

type ClientePresupuesto = { nombre: string; email: string; nif?: string }
const hoy = () => new Date().toISOString().slice(0, 10)
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const selectClass = 'border-input bg-background h-9 w-full rounded-md border px-2 text-sm'

export function QuoteEditor({
  firmId,
  opportunity,
  cliente,
  canEdit,
}: {
  firmId: string
  opportunity: OportunidadPersistida
  cliente: ClientePresupuesto
  canEdit: boolean
}) {
  const session = useAuthSession()
  const userId = session.status === 'signed-in' ? session.user.id : null
  const save = useActualizarDetallesOportunidad(firmId)
  const advance = useAvanzarLeadPorHito(firmId)
  const createTask = useCrearTarea(firmId)
  const members = useMiembrosDespacho(firmId)
  const tasks = useTareasLead(firmId, opportunity.id)
  const servicesQuery = useQuoteServices(firmId)
  const blocksQuery = useQuoteBlocks(firmId)
  const [editor, setEditor] = useState<EditorPresupuesto | null>(() => leerEditor(opportunity.detalles))
  const [dirty, setDirty] = useState(false)
  const [preview, setPreview] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewer, setReviewer] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')

  useEffect(() => {
    if (!dirty) setEditor(leerEditor(opportunity.detalles))
  }, [dirty, opportunity.detalles, opportunity.version])

  const quote = record(record(opportunity.detalles)['presupuesto'])
  const legacy = datosLegado(quote)
  const blocks = (blocksQuery.data ?? []).map((item) => ({
    id: item.id,
    titulo: item.title,
    texto: item.body,
    orden: item.order,
    activo: item.active,
    porDefecto: item.includeByDefault,
    archivado: item.archived,
  }))
  const revisionTaskId = editor?.actual.revision?.tareaId
  const revisionTask = useTareaPorId(firmId, revisionTaskId)

  const persist = async (next: EditorPresupuesto, extra: Record<string, unknown> = {}) => {
    const saved = await save.mutateAsync({
      id: opportunity.id,
      versionEsperada: opportunity.version,
      detalles: conEditor(opportunity.detalles, next, extra),
    })
    setEditor(leerEditor(saved.detalles))
    setDirty(false)
    return saved
  }

  const createDraft = async () => {
    const result = nuevoBorrador({
      detalles: opportunity.detalles,
      asunto: opportunity.titulo,
      referenciaLead: opportunity.referencia,
      bloques: blocks,
      hoy: hoy(),
    })
    await persist(result.editor, result.extra)
    toast.success('Borrador de presupuesto creado en el Lead.')
  }

  const updateVersion = (change: (version: VersionPresupuesto) => VersionPresupuesto) => {
    if (!editor) return
    setEditor({ ...editor, actual: change(editor.actual) })
    setDirty(true)
  }

  const saveDraft = () => {
    if (!editor) return
    void persist(editor)
      .then(() => toast.success('Borrador guardado en el Lead.'))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudo guardar.'))
  }

  const requestReview = async () => {
    if (!editor || !reviewer) return
    try {
      const marker = marcadorRevision(opportunity.id, editor.actual.version)
      const existing = await buscarTareaRevisionAbierta(firmId, opportunity.id, marker)
      const assignedId = existing?.asignadoId ?? reviewer
      if (!assignedId) throw new Error('La tarea existente no tiene responsable.')
      let taskId = existing?.id
      if (!taskId) {
        const task = await createTask.mutateAsync({
          expedienteId: null,
          oportunidadId: opportunity.id,
          tipo: 'Tarea',
          titulo: `REVISAR / VALIDAR PRESUPUESTO ${editor.actual.referencia} · v${editor.actual.version}`,
          descripcion: `${marker}\nRevisión del presupuesto ${editor.actual.referencia}, versión ${editor.actual.version}. Resuelve esta tarea con VALIDAR o DEVOLVER CON OBSERVACIONES.${reviewNotes.trim() ? `\n\nObservaciones: ${reviewNotes.trim()}` : ''}`,
          prioridad: 'Media',
          venceEn: reviewDate ? new Date(`${reviewDate}T18:00:00`).toISOString() : null,
          recordarEn: null,
          clasePlazo: null,
          critico: false,
          asignadoId: assignedId,
          mensajeInicial: mensajeAvisoRevision({ referencia: editor.actual.referencia, version: editor.actual.version, fecha: reviewDate || null, observaciones: reviewNotes }),
        })
        taskId = task?.id
      }
      if (!taskId) throw new Error('El servidor no confirmó la tarea de revisión.')
      const memberName = members.data?.find((member) => member.id === assignedId)?.nombre ?? assignedId
      const next = solicitarRevision(editor, {
        tareaId: taskId,
        asignadoId: assignedId,
        asignadoNombre: memberName,
        solicitadaPor: userId,
        observaciones: reviewNotes.trim(),
        cliente,
        despacho: 'LEX & DOSCIENTOS',
        ahora: new Date().toISOString(),
        venceEn: reviewDate || null,
      })
      await persist(next, { estado: 'Pendiente de validación', validadoVersion: null, validadoPor: null, fechaValidacion: null })
      setReviewOpen(false)
      await advance.mutateAsync({ id: opportunity.id, hito: 'revision_solicitada' })
      toast.success(`Revisión asignada a ${memberName}.`)
      void tasks.refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo solicitar la revisión.')
    }
  }

  if (!editor) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Presupuesto / nota de encargo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">Aún no hay borrador. Al crearlo se precargan el asunto y los bloques activos marcados para incluir por defecto.</p>
          {legacy.length ? <p className="text-sm">Se conservarán {legacy.length} campos históricos del presupuesto.</p> : null}
          <Button disabled={!canEdit || save.isPending || blocksQuery.isPending} onClick={() => void createDraft().catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudo crear el borrador.'))}>Crear borrador de presupuesto</Button>
        </CardContent>
      </Card>
    )
  }

  const version = editor.actual
  const totals = totales(version.lineas)
  const client = version.instantanea?.cliente ?? cliente
  const office = version.instantanea?.despacho ?? 'LEX & DOSCIENTOS'
  const canChange = canEdit && editable(version) && opportunity.fase !== 'lost'
  const openReviewTask = (tasks.data ?? []).find((task) =>
    task.descripcion.includes(marcadorRevision(opportunity.id, version.version)) &&
    !['Completada', 'Cancelada'].includes(task.estado),
  )
  const availableServices = (servicesQuery.data ?? []).filter((service) => {
    const needle = serviceSearch.trim().toLocaleLowerCase('es')
    return service.active && (!needle || `${service.code} ${service.name} ${service.family}`.toLocaleLowerCase('es').includes(needle))
  })
  const reviewBlock = puedeSolicitarRevision(editor)

  return (
    <div className="space-y-4" data-testid="quote-editor">
      {legacy.length ? (
        <details className="rounded-md border px-3 py-2 text-sm"><summary className="cursor-pointer">Datos previos conservados ({legacy.length})</summary><ul className="mt-2 space-y-1">{legacy.map((item) => <li key={item.etiqueta}><strong>{item.etiqueta}:</strong> {item.valor}</li>)}</ul></details>
      ) : null}
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="quote-ref">Referencia</Label><Input id="quote-ref" disabled={!canChange} value={version.referencia} onChange={(event) => updateVersion((current) => ({ ...current, referencia: event.target.value }))} /></div>
          <div className="space-y-1"><Label htmlFor="quote-date">Fecha</Label><Input id="quote-date" type="date" disabled={!canChange} value={version.fecha} onChange={(event) => updateVersion((current) => ({ ...current, fecha: event.target.value }))} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="quote-subject">Asunto</Label><Input id="quote-subject" disabled={!canChange} value={version.asunto} onChange={(event) => updateVersion((current) => ({ ...current, asunto: event.target.value }))} /></div>
          <p className="text-muted-foreground text-sm">Cliente: <strong>{client.nombre || '—'}</strong>{client.nif ? ` · NIF ${client.nif}` : ''}</p>
          <p className="text-right text-sm">Versión {version.version} · <Badge variant="outline">{version.estado}</Badge></p>
          <div className="sm:col-span-2 grid grid-cols-3 gap-2 rounded-md border p-3 text-sm"><span>Base: {euros(totals.base)}</span><span>IVA: {euros(totals.iva)}</span><strong>Total: {euros(totals.total)}</strong></div>
        </CardContent>
      </Card>

      {version.revision ? (
        <Card><CardContent className="space-y-2 pt-5 text-sm">
          <p>Revisión v{version.revision.version}: {version.revision.estado} · {version.revision.asignadoNombre}</p>
          {version.revision.observaciones ? <p className="whitespace-pre-wrap">{version.revision.observaciones}</p> : null}
          {revisionTask.isError ? <p role="alert" className="text-destructive">No se pudo comprobar la tarea de revisión.</p> : null}
          {revisionTask.data ? <p><a className="underline" href={`/tareas/${revisionTask.data.id}`}>Abrir tarea de revisión</a></p> : null}
          {version.revision.estado === 'pendiente' && !openReviewTask ? <p className="text-destructive">La tarea de revisión ya no está abierta. No se puede validar esta versión con otra tarea.</p> : null}
        </CardContent></Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Servicios</CardTitle>
          {canChange ? <Button size="sm" variant="outline" onClick={() => updateVersion((current) => ({ ...current, lineas: [...current.lineas, lineaPersonalizada()] }))}>Añadir servicio personalizado</Button> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {canChange ? <div className="space-y-2"><Input aria-label="Buscar servicios" placeholder="Buscar en el catálogo del despacho" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} />
            {servicesQuery.isError ? <p role="alert" className="text-destructive text-sm">No se pudo cargar el catálogo de servicios.</p> : null}
            {availableServices.length ? <select className={selectClass} aria-label="Añadir servicio del catálogo" value="" onChange={(event) => {
              const item = availableServices.find((service) => service.id === event.target.value)
              if (!item) return
              const line = lineaDesdeServicio({ id: item.id, codigo: item.code, nombre: item.name, descripcion: item.description, precioCents: item.priceCents, ivaPct: item.vatPct })
              updateVersion((current) => ({ ...current, lineas: [...current.lineas, line] }))
            }}><option value="">Selecciona un servicio…</option>{availableServices.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name} · {euros(item.priceCents)}</option>)}</select> : <p className="text-muted-foreground text-xs">El catálogo del despacho no tiene servicios activos.</p>}
          </div> : null}
          {!version.lineas.length ? <p className="text-muted-foreground text-sm">Sin servicios todavía.</p> : null}
          {version.lineas.map((line) => <QuoteLine key={line.id} line={line} disabled={!canChange} onChange={(changes) => updateVersion((current) => ({ ...current, lineas: current.lineas.map((item) => item.id === line.id ? { ...item, ...changes } : item) }))} onRemove={() => updateVersion((current) => ({ ...current, lineas: current.lineas.filter((item) => item.id !== line.id) }))} />)}
          <p className="text-right font-semibold">Total presupuesto: {euros(totals.total)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bloques del encargo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {version.bloques.map((block) => <div key={block.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canChange} checked={block.incluido} onChange={(event) => updateVersion((current) => ({ ...current, bloques: current.bloques.map((item) => item.id === block.id ? { ...item, incluido: event.target.checked } : item) }))} /> Incluir</label><Input aria-label="Título del bloque" disabled={!canChange} value={block.titulo} onChange={(event) => updateVersion((current) => ({ ...current, bloques: current.bloques.map((item) => item.id === block.id ? { ...item, titulo: event.target.value } : item) }))} />{canChange ? <Button size="sm" variant="ghost" onClick={() => updateVersion((current) => ({ ...current, bloques: current.bloques.filter((item) => item.id !== block.id) }))}>Quitar</Button> : null}</div>
            <Textarea aria-label="Texto del bloque" rows={3} disabled={!canChange} value={block.texto} onChange={(event) => updateVersion((current) => ({ ...current, bloques: current.bloques.map((item) => item.id === block.id ? { ...item, texto: event.target.value } : item) }))} />
          </div>)}
          {canChange ? <select className={selectClass} aria-label="Añadir bloque de la biblioteca" value="" onChange={(event) => {
            const master = blocks.find((item) => item.id === event.target.value)
            if (master) updateVersion((current) => ({ ...current, bloques: [...current.bloques, { id: crypto.randomUUID(), bloqueId: master.id, titulo: master.titulo, texto: master.texto, incluido: true }] }))
          }}><option value="">Añadir bloque activo…</option>{blocks.filter((item) => item.activo && !item.archivado).map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}</select> : null}
          <div className="space-y-1"><Label htmlFor="quote-conditions">Condiciones adicionales</Label><Textarea id="quote-conditions" rows={4} disabled={!canChange} value={version.condiciones} onChange={(event) => updateVersion((current) => ({ ...current, condiciones: event.target.value }))} /></div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2 border-t py-3">
        {canChange ? <Button variant="outline" disabled={!dirty || save.isPending} onClick={saveDraft}>Guardar borrador</Button> : null}
        <Button variant="outline" onClick={() => setPreview(true)}>Vista previa / PDF</Button>
        {canEdit && !editable(version) ? <Button variant="outline" onClick={() => {
          if (version.estado === 'en_revision' && !window.confirm('Se creará una versión nueva y la tarea de revisión actual quedará obsoleta. ¿Continuar?')) return
          const result = editarVersion(opportunity.detalles, editor, hoy(), new Date().toISOString())
          void persist(result.editor, result.extra).then(() => toast.success('Versión editable preparada.')).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudo preparar la edición.'))
        }}>Editar / nueva versión</Button> : null}
        {canEdit && ['borrador', 'devuelto', 'finalizado'].includes(version.estado) ? <Button disabled={save.isPending || dirty || Boolean(reviewBlock) || !cliente.nif?.trim()} title={!cliente.nif?.trim() ? 'El NIF/DNI del cliente es obligatorio para solicitar revisión.' : reviewBlock ?? undefined} onClick={() => setReviewOpen(true)}>Solicitar revisión</Button> : null}
      </div>

      {preview ? <Dialog open onOpenChange={setPreview}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Vista previa · v{version.version}</DialogTitle></DialogHeader><div className="rounded-md border bg-white p-6 text-black" dangerouslySetInnerHTML={{ __html: documentoHtml(version, client, office, false) }} /><DialogFooter><Button onClick={() => imprimir(version, client, office)}>Descargar PDF / imprimir</Button></DialogFooter></DialogContent></Dialog> : null}
      {reviewOpen ? <Dialog open onOpenChange={setReviewOpen}><DialogContent><DialogHeader><DialogTitle>Solicitar revisión · v{version.version}</DialogTitle><DialogDescription>La versión quedará fijada y se vinculará a una tarea real. Solo la persona asignada podrá validarla o devolverla.</DialogDescription></DialogHeader>
        {problemasParaFinalizar(version).length ? <ul className="text-destructive list-disc pl-5 text-sm">{problemasParaFinalizar(version).map((problem) => <li key={problem}>{problem}</li>)}</ul> : reviewBlock ? <p className="text-destructive text-sm">{reviewBlock}</p> : <div className="space-y-3"><div className="space-y-1"><Label htmlFor="quote-reviewer">Responsable *</Label><select id="quote-reviewer" className={selectClass} value={reviewer} onChange={(event) => setReviewer(event.target.value)}><option value="">Selecciona…</option>{(members.data ?? []).map((member) => <option key={member.id} value={member.id}>{member.nombre}</option>)}</select></div><div className="space-y-1"><Label htmlFor="quote-review-date">Plazo</Label><Input id="quote-review-date" type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} /></div><div className="space-y-1"><Label htmlFor="quote-review-notes">Observaciones</Label><Textarea id="quote-review-notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} /></div></div>}
        <DialogFooter><Button variant="outline" onClick={() => setReviewOpen(false)}>Cancelar</Button><Button disabled={!reviewer || save.isPending || createTask.isPending || advance.isPending || !cliente.nif?.trim() || Boolean(reviewBlock) || problemasParaFinalizar(version).length > 0} onClick={() => void requestReview()}>{createTask.isPending || save.isPending ? 'Guardando…' : 'Crear tarea y solicitar revisión'}</Button></DialogFooter>
      </DialogContent></Dialog> : null}
    </div>
  )
}

function QuoteLine({ line, disabled, onChange, onRemove }: { line: LineaPresupuesto; disabled: boolean; onChange: (changes: Partial<LineaPresupuesto>) => void; onRemove: () => void }) {
  const lineTotals = totalesLinea(line)
  const [priceText, setPriceText] = useState((line.precioCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  return <div className="space-y-2 rounded-md border p-3">
    <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><Input aria-label="Código" disabled={disabled} value={line.codigo} onChange={(event) => onChange({ codigo: event.target.value })} /><Input aria-label="Servicio" disabled={disabled} value={line.nombre} onChange={(event) => onChange({ nombre: event.target.value })} />{!disabled ? <Button size="sm" variant="ghost" onClick={onRemove}>Quitar</Button> : null}</div>
    <Textarea aria-label="Descripción del servicio" rows={2} disabled={disabled} value={line.descripcion} onChange={(event) => onChange({ descripcion: event.target.value })} />
    <div className="grid items-end gap-2 sm:grid-cols-4"><div className="space-y-1"><Label className="text-xs">Cantidad</Label><Input aria-label="Cantidad" type="number" min="0.01" step="0.01" disabled={disabled} value={line.cantidad} onChange={(event) => onChange({ cantidad: Number(event.target.value) })} /></div><div className="space-y-1"><Label className="text-xs">Precio (€)</Label><Input aria-label="Precio (€)" disabled={disabled} value={priceText} onChange={(event) => setPriceText(event.target.value)} onBlur={() => { const amount = parseEuros(priceText); if (amount === null) { toast.error('Importe no válido; usa, por ejemplo, 1.800,00.'); return } onChange({ precioCents: amount, revisadoPrecioCero: amount !== 0 || line.revisadoPrecioCero }); setPriceText((amount / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) }} /></div><div className="space-y-1"><Label className="text-xs">IVA</Label><select aria-label="IVA" className={selectClass} disabled={disabled} value={line.ivaPct === null ? '' : String(line.ivaPct)} onChange={(event) => onChange({ ivaPct: event.target.value ? Number(event.target.value) : null })}><option value="">Decidir IVA…</option><option value="21">21 %</option><option value="10">10 %</option><option value="0">Exento</option></select></div><p className="text-right text-sm">Base / IVA<br />{euros(lineTotals.base)} / {euros(lineTotals.iva)}</p></div>
    {line.precioCents === 0 ? <label className="text-destructive flex items-center gap-2 text-xs"><input type="checkbox" disabled={disabled} checked={line.revisadoPrecioCero} onChange={(event) => onChange({ revisadoPrecioCero: event.target.checked })} />Confirmo que el precio 0 es correcto</label> : null}
  </div>
}