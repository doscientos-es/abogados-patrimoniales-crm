import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { FileDown, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthSession } from '@/features/auth'
import {
  buscarTareaRevisionAbierta,
  useActualizarDetallesOportunidad,
  useAvanzarLeadPorHito,
  useMiembrosDespacho,
  useQuoteEmailTemplates,
} from '@/features/crm'
import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'
import { decisionActual } from '@/features/crm/application/qualification-decision'
import { asegurarTareaSeguimiento, venceA18 } from '@/features/crm/application/quote-acceptance'
import {
  conEditor,
  copiaEnviada,
  euros,
  leerEditor,
  preparadaParaEnviar,
  registrarEnvio,
  versionesEnviadas,
  type BorradorEnvio,
  type CopiaVersion,
  type Envio,
} from '@/features/crm/application/quote-editor'
import { documentoHtml, imprimir, type Cliente } from '@/features/crm/ui/quote-document'
import { CrearTareaEnvioBox } from '@/features/crm/ui/quote-send-task'
import { useCompletarTarea, useCrearTarea, useTareaPorId } from '@/features/tareas'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

type Rec = Record<string, unknown>
const rec = (value: unknown): Rec =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {}
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const addDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
export function QuoteSendPanel({
  firmId,
  opportunity,
  cliente,
  canEdit,
}: {
  firmId: string
  opportunity: OportunidadPersistida
  cliente: Cliente
  canEdit: boolean
}) {
  const save = useActualizarDetallesOportunidad(firmId)
  const advance = useAvanzarLeadPorHito(firmId)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const completeTask = useCompletarTarea(firmId)
  const templates = useQuoteEmailTemplates(firmId)
  const session = useAuthSession()
  const userId = session.status === 'signed-in' ? session.user.id : null
  const firm = useQuery({
    queryKey: ['crm', 'firm-name', firmId],
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) return ''
      const { data } = await client.from('crm_firms').select('name').eq('id', firmId).maybeSingle()
      return data?.name ?? ''
    },
  })
  const [sending, setSending] = useState(false)
  const [document, setDocument] = useState<CopiaVersion | null>(null)
  const editor = leerEditor(opportunity.detalles)
  const quote = rec(rec(opportunity.detalles)['presupuesto'])
  const sent = versionesEnviadas(editor)
  const prepared = preparadaParaEnviar(editor)
  const sendTask = useTareaPorId(firmId, prepared?.envioTarea?.tareaId)
  const decision = decisionActual(opportunity.detalles)
  const preparer =
    decision?.tipo === 'preparar_presupuesto' && decision.decididoPor
      ? (members.data?.find((member) => member.id === decision.decididoPor)?.nombre ?? '—')
      : null
  const firmName = firm.data || 'LEX & DOSCIENTOS'
  const sentCopy = (version: (typeof sent)[number]) => copiaEnviada(version)
  const latestSent = sent[0]
  const importe = (version: (typeof sent)[number]) => {
    const snapshot = sentCopy(version)
    return snapshot?.instantanea
      ? euros(snapshot.instantanea.totales.total)
      : text(quote['importeEnviado'])
        ? `${text(quote['importeEnviado'])} €`
        : '—'
  }

  const saveDraft = async (draft: BorradorEnvio) => {
    if (!editor) return
    const next = { ...editor, actual: { ...editor.actual, borradorEnvio: draft } }
    await save.mutateAsync({
      id: opportunity.id,
      versionEsperada: opportunity.version,
      detalles: conEditor(opportunity.detalles, next),
    })
    toast.success('Borrador del email guardado en el Lead.')
  }

  const registerExternal = async (envio: Envio, followup: { assignedId: string; date: string }) => {
    if (!editor || !prepared) return
    try {
      const result = registrarEnvio(
        editor,
        {
          ...envio,
          declaradoPorNombre: members.data?.find((member) => member.id === userId)?.nombre ?? '',
        },
        true,
        quote,
      )
      let expectedVersion = opportunity.version
      let stage = opportunity.fase
      if (['entry', 'qualification', 'first_meeting', 'quote'].includes(stage)) {
        const advanced = await advance.mutateAsync({
          id: opportunity.id,
          hito: 'revision_solicitada',
        })
        expectedVersion = advanced.version
        stage = advanced.fase
      }
      const sentOpp = await save.mutateAsync({
        id: opportunity.id,
        versionEsperada: expectedVersion,
        detalles: conEditor(opportunity.detalles, result.editor, result.extra),
        ...(stage === 'validation'
          ? {
              transicionContratacion: {
                fase: 'engagement' as const,
                subestado: 'Pendiente de aceptación',
              },
            }
          : {}),
      })
      setSending(false)
      toast.success('Envío externo registrado.')
      try {
        const ensured = await asegurarTareaSeguimiento({
          detalles: sentOpp.detalles,
          leadId: opportunity.id,
          referencia: prepared.referencia,
          cliente: prepared.instantanea?.cliente.nombre ?? cliente.nombre,
          asignadoId: followup.assignedId,
          asignadoNombre:
            members.data?.find((member) => member.id === followup.assignedId)?.nombre ??
            followup.assignedId,
          venceEn: venceA18(followup.date),
          ahora: new Date().toISOString(),
          buscar: (marker) => buscarTareaRevisionAbierta(firmId, opportunity.id, marker),
          crear: (input) => createTask.mutateAsync(input),
        })
        if (ensured)
          await save.mutateAsync({
            id: opportunity.id,
            versionEsperada: sentOpp.version,
            detalles: ensured.detalles,
          })
      } catch (error) {
        toast.error(
          `Envío registrado, pero no se pudo crear la tarea de seguimiento: ${error instanceof Error ? error.message : 'error'}. Créala desde «Aceptación».`,
        )
      }
      const task = sendTask.data
      if (task && !['Completada', 'Cancelada'].includes(task.estado)) {
        try {
          await completeTask.mutateAsync({
            task,
            resultado: `Presupuesto ${prepared.referencia} v${prepared.version} enviado a ${envio.destinatario}.`,
          })
        } catch {
          toast.error(
            'Envío registrado, pero no se pudo completar la tarea de envío. Complétala desde el enlace de la tarea.',
          )
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el envío.')
    }
  }

  return (
    <div className="space-y-4" data-testid="quote-send-panel">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Última versión enviada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {latestSent?.envio ? (
            <>
              <p>
                <strong>
                  {latestSent.referencia} · v{latestSent.version}
                </strong>{' '}
                · {importe(latestSent)} <Badge variant="outline">Enviada</Badge>
              </p>
              <p>
                Enviado el {latestSent.envio.fecha.slice(0, 10)} · {latestSent.envio.destinatario} ·{' '}
                {latestSent.envio.canal}
              </p>
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer">
                  Email registrado
                  {latestSent.envio.plantilla ? ` · ${latestSent.envio.plantilla.nombre}` : ''}
                </summary>
                <p className="mt-2 whitespace-pre-wrap">
                  {latestSent.envio.mensaje || 'Sin texto registrado.'}
                </p>
              </details>
              {sentCopy(latestSent) ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDocument(sentCopy(latestSent))}
                >
                  Ver documento enviado
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs">
                  No se guardó copia del documento en este envío anterior.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Todavía no se ha enviado ninguna versión.</p>
          )}
        </CardContent>
      </Card>

      {prepared ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preparada para enviar · v{prepared.version}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {prepared.referencia} · validada por {prepared.validacion?.por ?? '—'} ·{' '}
              {euros(prepared.instantanea?.totales.total ?? 0)}
            </p>
            {preparer ? (
              <p className="text-muted-foreground text-xs">
                Cualificación: decidió preparar presupuesto {preparer}.
              </p>
            ) : null}
            {prepared.envioTarea ? (
              <p>
                Responsable de envío: {prepared.envioTarea.asignadoNombre} ·{' '}
                <Link
                  className="underline"
                  to="/tareas/$taskId"
                  params={{ taskId: prepared.envioTarea.tareaId }}
                >
                  Abrir tarea
                </Link>
              </p>
            ) : canEdit ? (
              <CrearTareaEnvioBox
                firmId={firmId}
                oportunidad={opportunity}
                version={prepared}
                miembros={members.data ?? []}
                cliente={cliente.nombre}
              />
            ) : null}
            <div
              className="max-h-[60vh] overflow-y-auto rounded-md border bg-white p-6 text-black"
              dangerouslySetInnerHTML={{
                __html: documentoHtml(
                  prepared,
                  prepared.instantanea?.cliente ?? cliente,
                  prepared.instantanea?.despacho ?? firmName,
                  false,
                ),
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  imprimir(
                    prepared,
                    prepared.instantanea?.cliente ?? cliente,
                    prepared.instantanea?.despacho ?? firmName,
                  )
                }
              >
                <FileDown className="mr-1 h-4 w-4" /> PDF / imprimir
              </Button>
              <Button
                disabled={!canEdit || opportunity.fase === 'won' || opportunity.fase === 'lost'}
                onClick={() => setSending(true)}
              >
                <Send className="mr-1 h-4 w-4" /> Enviar al cliente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {sent.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de envíos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sent.slice(1).map((version) => (
              <div
                key={version.version}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <span>
                  {version.referencia} · v{version.version} · {version.envio?.fecha.slice(0, 10)} ·{' '}
                  {version.envio?.destinatario}
                </span>
                {sentCopy(version) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDocument(sentCopy(version))}
                  >
                    Ver documento
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">Sin copia</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {document ? (
        <Dialog open onOpenChange={(open) => !open && setDocument(null)}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Documento enviado · v{document.version}</DialogTitle>
            </DialogHeader>
            <div
              className="rounded-md border bg-white p-6 text-black"
              dangerouslySetInnerHTML={{
                __html: documentoHtml(
                  document,
                  document.instantanea?.cliente ?? cliente,
                  document.instantanea?.despacho ?? firmName,
                  false,
                ),
              }}
            />
            <DialogFooter>
              <Button
                onClick={() =>
                  imprimir(
                    document,
                    document.instantanea?.cliente ?? cliente,
                    document.instantanea?.despacho ?? firmName,
                  )
                }
              >
                Descargar PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {sending && prepared && editor ? (
        <SendDialog
          key={`${prepared.version}-${opportunity.version}`}
          version={prepared}
          cliente={prepared.instantanea?.cliente ?? cliente}
          templates={templates.data ?? []}
          userId={userId}
          memberNames={new Map((members.data ?? []).map((member) => [member.id, member.nombre]))}
          borrador={prepared.borradorEnvio ?? null}
          saving={save.isPending || advance.isPending || createTask.isPending}
          onClose={() => setSending(false)}
          onSaveDraft={saveDraft}
          onPrint={() =>
            imprimir(
              prepared,
              prepared.instantanea?.cliente ?? cliente,
              prepared.instantanea?.despacho ?? firmName,
            )
          }
          onRegister={registerExternal}
        />
      ) : null}
    </div>
  )
}

function SendDialog({
  version,
  cliente,
  templates,
  userId,
  memberNames,
  borrador,
  saving,
  onClose,
  onSaveDraft,
  onPrint,
  onRegister,
}: {
  version: { version: number; referencia: string; asunto: string; borradorEnvio?: BorradorEnvio }
  cliente: Cliente
  templates: Array<{
    id: string
    name: string
    subject: string
    body: string
    active: boolean
    isDefault: boolean
  }>
  userId: string | null
  memberNames: ReadonlyMap<string, string>
  borrador: BorradorEnvio | null
  saving: boolean
  onClose: () => void
  onSaveDraft: (draft: BorradorEnvio) => Promise<void>
  onPrint: () => void
  onRegister: (envio: Envio, followup: { assignedId: string; date: string }) => Promise<void>
}) {
  const activeTemplates = templates.filter((template) => template.active)
  const defaultTemplate = activeTemplates.find((template) => template.isDefault)
  const initial = borrador?.plantilla?.id
    ? activeTemplates.find((item) => item.id === borrador.plantilla?.id)
    : defaultTemplate
  const vars = {
    nombre_cliente: cliente.nombre,
    asunto: version.asunto,
    referencia_presupuesto: `${version.referencia} (v${version.version})`,
    fecha: new Date().toLocaleDateString('es-ES'),
    responsable: userId ? (memberNames.get(userId) ?? '') : '',
  }
  const resolve = (value: string) =>
    Object.entries(vars).reduce(
      (result, [key, replacement]) =>
        result.replaceAll(`{{${key}}}`, replacement).replaceAll(`{${key}}`, replacement),
      value,
    )
  const [templateId, setTemplateId] = useState(borrador?.plantilla?.id ?? initial?.id ?? '')
  const [recipient, setRecipient] = useState(borrador?.destinatario ?? cliente.email)
  const [subject, setSubject] = useState(
    borrador?.asunto ?? (initial ? resolve(initial.subject) : ''),
  )
  const [body, setBody] = useState(borrador?.mensaje ?? (initial ? resolve(initial.body) : ''))
  const [declared, setDeclared] = useState(false)
  const [assignee, setAssignee] = useState(userId && memberNames.has(userId) ? userId : '')
  const [followupDate, setFollowupDate] = useState(addDays(7))
  const usedTemplate = activeTemplates.find((template) => template.id === templateId)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar al cliente</DialogTitle>
          <DialogDescription>
            Presupuesto {version.referencia} · versión {version.version}
          </DialogDescription>
        </DialogHeader>
        <p role="note" className="rounded-md border px-3 py-2 text-xs">
          LEX no envía correos automáticamente. Descarga el PDF y envíalo desde tu correo; abrir el
          correo no registra el envío.
        </p>
        <div className="space-y-1">
          <Label htmlFor="quote-send-to">Destinatario</Label>
          <Input
            id="quote-send-to"
            type="email"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quote-send-template">Plantilla del despacho</Label>
          <select
            id="quote-send-template"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={templateId}
            onChange={(event) => {
              const id = event.target.value
              const template = activeTemplates.find((item) => item.id === id)
              setTemplateId(id)
              setSubject(template ? resolve(template.subject) : '')
              setBody(template ? resolve(template.body) : '')
            }}
          >
            <option value="">Sin plantilla</option>
            {activeTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.isDefault ? ' (predeterminada)' : ''}
              </option>
            ))}
          </select>
          {templates.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No hay plantillas configuradas; puedes redactar el email aquí.
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor="quote-send-subject">Asunto</Label>
          <Input
            id="quote-send-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quote-send-message">Mensaje</Label>
          <Textarea
            id="quote-send-message"
            rows={7}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onPrint}>
            <FileDown className="mr-1 h-4 w-4" /> Descargar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() =>
              void onSaveDraft({
                plantilla: usedTemplate ? { id: usedTemplate.id, nombre: usedTemplate.name } : null,
                destinatario: recipient.trim(),
                asunto: subject,
                mensaje: body,
                guardadoEn: new Date().toISOString(),
                guardadoPor: userId,
              })
            }
          >
            Guardar borrador
          </Button>
          <a
            className="border-input inline-flex h-8 items-center rounded-md border px-3 text-sm"
            href={`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
          >
            Abrir en mi correo
          </a>
        </div>
        <label className="flex items-start gap-2 border-t pt-3 text-sm">
          <input
            type="checkbox"
            checked={declared}
            onChange={(event) => setDeclared(event.target.checked)}
          />
          Declaro que ya he enviado este presupuesto al cliente fuera de LEX.
        </label>
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <p className="text-sm font-medium sm:col-span-2">Tarea de seguimiento *</p>
          <div className="space-y-1">
            <Label htmlFor="quote-followup-assignee">Responsable</Label>
            <select
              id="quote-followup-assignee"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Selecciona…</option>
              {[...memberNames].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="quote-followup-date">Próxima fecha</Label>
            <Input
              id="quote-followup-date"
              type="date"
              value={followupDate}
              onChange={(event) => setFollowupDate(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !declared || !recipient.trim() || !assignee || !followupDate}
            onClick={() =>
              void onRegister(
                {
                  fecha: new Date().toISOString(),
                  destinatario: recipient.trim(),
                  canal: 'Email externo',
                  asunto: subject,
                  mensaje: body,
                  declaradoPor: userId,
                  plantilla: usedTemplate
                    ? { id: usedTemplate.id, nombre: usedTemplate.name }
                    : null,
                },
                { assignedId: assignee, date: followupDate },
              )
            }
          >
            Registrar envío externo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
