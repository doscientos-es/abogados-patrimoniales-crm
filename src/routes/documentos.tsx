import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { FileText, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { SectionHeader } from '@/components/common'
import {
  AsignarDocumentoDialog,
  NuevaVersionDialog,
  NuevoDocumentoDialog,
  ValidarPlazoDialog,
} from '@/components/expedientes/dialogs'
import { DatoLinea, DndKanban, TipoDocBadges, Vacio } from '@/components/expedientes/ui'
import { TareaFicha } from '@/components/tareas/ficha-modal'
import { NuevaTareaRapidaDialog } from '@/components/tareas/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ESTADOS_DOC_SIMPLE, type Documento } from '@/data/expedientes-model'
import { ToneBadge, ViewSwitch } from '@/features/crm'
import { ops, useOps } from '@/lib/expedientes-store'

export const Route = createFileRoute('/documentos')({
  validateSearch: (search: Record<string, unknown>) =>
    typeof search['doc'] === 'string' && search['doc']
      ? { doc: search['doc'] as string }
      : ({} as { doc?: string }),
  head: () => ({
    meta: [
      { title: 'Documentos — LEX' },
      {
        name: 'description',
        content:
          'Gestión documental del despacho: flujo simple de tratamiento, tareas vinculadas, versiones, documentos judiciales y entregables al cliente.',
      },
      { property: 'og:title', content: 'Documentos — LEX' },
      {
        property: 'og:description',
        content:
          'Flujo documental de cuatro estados, versionado, tareas vinculadas y control de plazos.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DocumentosPage,
})

/** Columnas del flujo documental mínimo acordado. */
const COLUMNAS_FLUJO = [
  { id: 'Pendiente de tratar', nombre: 'Pendiente de tratar', tono: 'aviso' as const },
  { id: 'En tratamiento', nombre: 'En tratamiento', tono: 'info' as const },
  { id: 'Tratado', nombre: 'Tratado', tono: 'exito' as const },
  { id: 'Archivado / solo consulta', nombre: 'Archivado / solo consulta', tono: 'neutro' as const },
]

function TarjetaDoc({ d, codigo, onAbrir }: { d: Documento; codigo: string; onAbrir: () => void }) {
  const tareas = useOps((s) => s.tareas.filter((t) => (d.tareasVinculadas ?? []).includes(t.id)))
  return (
    <article className="border-border bg-card rounded-md border p-3">
      <button type="button" onClick={onAbrir} className="block w-full text-left">
        <p className="text-muted-foreground truncate text-[11px]">{codigo}</p>
        <p className="text-foreground line-clamp-2 text-sm font-medium">{d.nombre}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {d.tipoDocumental} · v{d.version} · {d.responsable}
        </p>
      </button>
      <div className="mt-2">
        <TipoDocBadges
          judicial={d.judicial}
          entregable={d.entregable}
          {...(d.datosJudiciales ? { plazo: d.datosJudiciales.estadoPlazo } : {})}
        />
      </div>
      {tareas.length ? (
        <p className="text-muted-foreground mt-1.5 text-[11px]">
          {tareas.length} tarea{tareas.length === 1 ? '' : 's'} vinculada
          {tareas.length === 1 ? '' : 's'}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onAbrir}
          className="text-primary text-[11px] hover:underline"
        >
          Ver ficha
        </button>
        {d.expedienteId ? (
          <Link
            to="/expedientes/$id"
            params={{ id: d.expedienteId }}
            className="text-muted-foreground text-[11px] hover:underline"
          >
            Ver expediente
          </Link>
        ) : null}
        <NuevaVersionDialog
          documentoId={d.id}
          trigger={
            <button type="button" className="text-muted-foreground text-[11px] hover:underline">
              Nueva versión
            </button>
          }
        />
        {d.datosJudiciales?.estadoPlazo === 'Posible plazo pendiente de validar' ? (
          <ValidarPlazoDialog
            documentoId={d.id}
            trigger={
              <button
                type="button"
                className="text-destructive text-[11px] font-medium hover:underline"
              >
                Validar plazo
              </button>
            }
          />
        ) : null}
      </div>
    </article>
  )
}

/** Ficha del documento: datos, tareas, actuación y primera capa de IA. */
function FichaDocumento({
  documentoId,
  onOpenChange,
  onAbrirTarea,
}: {
  documentoId: string | null
  onOpenChange: (v: boolean) => void
  onAbrirTarea: (id: string) => void
}) {
  const d = useOps((s) => s.documentos.find((x) => x.id === documentoId))
  const expediente = useOps((s) => s.expedientes.find((e) => e.id === d?.expedienteId))
  const tareas = useOps((s) => s.tareas.filter((t) => (d?.tareasVinculadas ?? []).includes(t.id)))
  const actuacion = useOps((s) =>
    s.actuaciones.find((a) => (d?.actuacionesRelacionadas ?? []).includes(a.id)),
  )
  const [ia, setIa] = useState(false)
  if (!d) return null

  const responsableInferido = d.responsable

  return (
    <Dialog open={Boolean(documentoId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <ToneBadge tono="neutro">{d.id}</ToneBadge>
            <ToneBadge
              tono={
                d.estado === 'Tratado' ? 'exito' : d.estado === 'En tratamiento' ? 'info' : 'aviso'
              }
            >
              {d.estado}
            </ToneBadge>
            <TipoDocBadges
              judicial={d.judicial}
              entregable={d.entregable}
              {...(d.datosJudiciales ? { plazo: d.datosJudiciales.estadoPlazo } : {})}
            />
          </div>
          <DialogTitle className="text-left font-serif text-xl">{d.nombre}</DialogTitle>
          <DialogDescription className="text-left">
            {d.tipoDocumental} · v{d.version} · {d.fechaDocumento || d.fechaIncorporacion}
            {expediente ? ` · ${expediente.codigo} · ${expediente.nombre}` : ' · sin expediente'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <DatoLinea label="Fecha del documento" value={d.fechaDocumento || '—'} />
          <DatoLinea label="Incorporado" value={d.fechaIncorporacion} />
          <DatoLinea label="Tipo documental" value={d.tipoDocumental} />
          <DatoLinea label="Estado documental" value={d.estado} />
          <DatoLinea label="Responsable de tratamiento" value={responsableInferido} />
          <DatoLinea label="Origen" value={d.origen} />
          <DatoLinea label="Emisor / autor" value={d.autorEmisor || '—'} />
          <DatoLinea label="Confidencialidad" value={d.confidencialidad} />
          <DatoLinea
            label="Fecha o plazo vinculado"
            value={d.fechaVinculadaId ?? 'Sin fecha vinculada (módulo Fechas y plazos)'}
          />
          <DatoLinea label="Actuación vinculada" value={actuacion?.titulo ?? '—'} />
        </div>

        <Separator />

        {/* Estado documental: flujo simple, sin workflow complejo */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Estado
          </span>
          <Select
            value={d.estado}
            onValueChange={(v) => {
              const r = ops.cambiarEstadoDocumento(d.id, v)
              if (!r.ok) toast.error(r.motivo)
              else toast.success('Estado documental actualizado')
            }}
          >
            <SelectTrigger className="h-9 w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_DOC_SIMPLE.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-[11px]">
            Con una tarea viva vinculada, el documento se mantiene EN TRATAMIENTO.
          </span>
        </div>

        {/* Tareas vinculadas */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Tareas vinculadas
            </p>
            <NuevaTareaRapidaDialog
              tituloInicial={`Tratar ${d.nombre}`}
              descripcionInicial={`Documento ${d.id} · ${d.tipoDocumental}${
                expediente ? ` · ${expediente.codigo}` : ''
              }. Revisar y decidir el tratamiento.`}
              responsableInicial={responsableInferido}
              documentoId={d.id}
              {...(d.expedienteId ? { expedienteId: d.expedienteId } : {})}
              {...(d.lineaId ? { lineaId: d.lineaId } : {})}
              contextoLabel={
                expediente ? `${expediente.codigo} · ${expediente.nombre}` : 'este documento'
              }
              trigger={
                <Button size="sm" variant="outline">
                  Crear tarea
                </Button>
              }
            />
          </div>
          {tareas.length ? (
            tareas.map((t) => (
              <div
                key={t.id}
                className="border-border flex items-center justify-between gap-2 rounded-md border p-2.5"
              >
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm">{t.titulo}</span>
                  <span className="text-muted-foreground block text-[11px]">
                    {t.id} · {t.estado} · {t.responsable}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => onAbrirTarea(t.id)}>
                  Abrir tarea vinculada
                </Button>
              </div>
            ))
          ) : (
            <Vacio texto="Sin tareas vinculadas." />
          )}
        </div>

        {/* Primera capa de IA documental: propuesta a validar, nunca automática */}
        <div className="border-border bg-muted/40 space-y-2 rounded-md border border-dashed p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
              <Sparkles className="h-3.5 w-3.5" /> Resumir con IA
            </p>
            <Button size="sm" variant="outline" onClick={() => setIa(true)}>
              Resumir con IA
            </Button>
          </div>
          {ia ? (
            <div className="text-muted-foreground space-y-1 text-xs">
              <p className="text-foreground">
                Este documento no tiene todavía un archivo procesable cargado en LEX, de modo que no
                hay contenido que leer. LEX no inventa el resumen ni los datos.
              </p>
              <p>
                La propuesta, cuando exista archivo, se mostrará siempre como borrador a validar:
              </p>
              <ul className="list-disc pl-4">
                <li>nombre normalizado y tipo documental;</li>
                <li>fecha y emisor u órgano;</li>
                <li>expediente probable;</li>
                <li>resumen breve;</li>
                <li>aviso de posible requerimiento o posible plazo.</li>
              </ul>
              <p className="text-foreground">
                Ningún plazo se valida jurídicamente de forma automática: siempre lo confirma una
                persona.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Primera capa: propone ficha y resumen a validar. Nunca valida plazos por su cuenta.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DocumentosPage() {
  const { doc: docBuscado } = Route.useSearch()
  const navigate = useNavigate()
  const documentos = useOps((s) => s.documentos)
  const expedientes = useOps((s) => s.expedientes)
  const [vista, setVista] = useState('flujo')
  const [q, setQ] = useState('')
  const [expediente, setExpediente] = useState('todos')
  const [ficha, setFicha] = useState<string | null>(null)
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null)

  // Apertura directa de la ficha al llegar con ?doc=DOC-XXXX (p. ej. desde una tarea).
  useEffect(() => {
    if (docBuscado) setFicha(docBuscado)
  }, [docBuscado])

  const cerrarFicha = () => {
    setFicha(null)
    if (docBuscado) void navigate({ to: '/documentos', search: {}, replace: true })
  }

  const codigo = (id?: string) =>
    id ? (expedientes.find((e) => e.id === id)?.codigo ?? id) : 'Sin expediente'

  const filtrados = documentos.filter(
    (d) =>
      `${d.nombre} ${d.tipoDocumental} ${codigo(d.expedienteId)}`
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (expediente === 'todos' || d.expedienteId === expediente),
  )

  const sinAsignar = documentos.filter((d) => !d.expedienteId)
  const enFlujo = filtrados.filter((d) => d.expedienteId)

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <SectionHeader
        title="Documentos"
        subtitle="Los documentos son entidades propias con estado, versiones y trazabilidad. El trabajo se hace en TAREAS; el documento es origen y evidencia."
        actions={
          <>
            <ViewSwitch
              value={vista}
              onChange={setVista}
              options={[
                { id: 'flujo', label: 'Flujo documental' },
                { id: 'bandeja', label: `Bandeja (${sinAsignar.length})` },
              ]}
            />
            <NuevoDocumentoDialog trigger={<Button size="sm">Incorporar documento</Button>} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar documento…"
          className="h-9 max-w-sm"
        />
        <Select value={expediente} onValueChange={setExpediente}>
          <SelectTrigger className="h-9 w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los expedientes</SelectItem>
            {expedientes.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.codigo} — {e.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {vista === 'bandeja' ? (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-foreground text-sm font-semibold">
              Documentos pendientes de asignación
            </h2>
            <p className="text-muted-foreground mb-3 text-xs">
              Un documento puede entrar en el sistema sin expediente y asignarse después.
            </p>
            {sinAsignar.length ? (
              <ul className="space-y-2">
                {sinAsignar.map((d) => (
                  <li
                    key={d.id}
                    className="border-border flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <button
                      type="button"
                      onClick={() => setFicha(d.id)}
                      className="min-w-0 text-left"
                    >
                      <p className="text-foreground truncate text-sm font-medium">{d.nombre}</p>
                      <p className="text-muted-foreground text-xs">
                        {d.tipoDocumental} · {d.origen} · {d.fechaIncorporacion}
                      </p>
                    </button>
                    <span className="flex shrink-0 gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setFicha(d.id)}>
                        Ver ficha
                      </Button>
                      <AsignarDocumentoDialog
                        documentoId={d.id}
                        trigger={
                          <Button size="sm" variant="outline">
                            Asignar a expediente
                          </Button>
                        }
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio texto="La bandeja está vacía." />
            )}
          </CardContent>
        </Card>
      ) : (
        <DndKanban
          columns={COLUMNAS_FLUJO}
          items={enFlujo}
          columnOf={(d) => d.estado}
          idOf={(d) => d.id}
          onDrop={(id, columna) => {
            const r = ops.cambiarEstadoDocumento(id, columna)
            if (!r.ok) toast.error(r.motivo)
            else toast.success('Estado del documento actualizado')
          }}
          renderCard={(d) => (
            <TarjetaDoc d={d} codigo={codigo(d.expedienteId)} onAbrir={() => setFicha(d.id)} />
          )}
          vacio="Sin documentos en este estado."
        />
      )}

      <Card>
        <CardContent className="p-4">
          <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
            <FileText className="h-4 w-4" /> Control de documentos judiciales
          </h2>
          <p className="text-muted-foreground mb-3 text-xs">
            Ningún plazo se calcula automáticamente: el sistema sólo advierte de que un documento
            puede contener plazo.
          </p>
          {documentos.filter((d) => d.judicial).length ? (
            <div className="space-y-2">
              {documentos
                .filter((d) => d.judicial)
                .map((d) => (
                  <div
                    key={d.id}
                    className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <button
                      type="button"
                      onClick={() => setFicha(d.id)}
                      className="min-w-0 text-left"
                    >
                      <p className="text-foreground truncate text-sm">{d.nombre}</p>
                      <p className="text-muted-foreground text-xs">
                        {d.datosJudiciales?.organo} · autos {d.datosJudiciales?.autos || '—'} ·{' '}
                        {d.datosJudiciales?.canal}
                      </p>
                    </button>
                    <ToneBadge
                      tono={
                        d.datosJudiciales?.estadoPlazo === 'Posible plazo pendiente de validar'
                          ? 'riesgo'
                          : d.datosJudiciales?.estadoPlazo === 'Plazo validado'
                            ? 'exito'
                            : 'neutro'
                      }
                    >
                      {d.datosJudiciales?.estadoPlazo}
                    </ToneBadge>
                  </div>
                ))}
            </div>
          ) : (
            <Vacio texto="Sin documentos judiciales registrados." />
          )}
        </CardContent>
      </Card>

      <FichaDocumento
        documentoId={ficha}
        onOpenChange={(v) => !v && cerrarFicha()}
        onAbrirTarea={(id) => {
          cerrarFicha()
          setTareaAbierta(id)
        }}
      />
      <TareaFicha tareaId={tareaAbierta} onOpenChange={(v) => !v && setTareaAbierta(null)} />
    </div>
  )
}
