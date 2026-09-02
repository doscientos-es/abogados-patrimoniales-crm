// "Redactar email" desde una tarea.
//
// No es un cliente de correo paralelo: reutiliza CONTACTOS para el
// destinatario y el módulo COMUNICACIONES para el registro. El destinatario
// externo sólo recibe el texto redactado: nunca la tarea, la conversación
// interna ni el histórico.
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Mail,
  Save,
  Send,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Vacio } from '@/components/expedientes/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { CONTACTOS, nombreCompleto, type Contacto } from '@/data/contactos'
import type { DestinatarioEmail } from '@/data/expedientes-model'
import { Field, ToneBadge } from '@/features/crm/ui/ui'
import { enviarEmailTarea, redactarEmailIA } from '@/lib/email-tarea.functions'
import {
  comunicacionesDeTarea,
  getOps,
  ops,
  puedeRedactarEmail,
  useOps,
} from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TONOS = ['Profesional', 'Cordial', 'Directo', 'Formal'] as const

type Campo = 'para' | 'cc' | 'cco'

const entidadDe = (c: Contacto) =>
  c.tipoPersona === 'Persona jurídica' ? (c.razonSocial ?? '') : c.relacion

const direccionesDe = (c: Contacto) => [c.email, c.email2].filter((e): e is string => Boolean(e))

/* ------------------------------------------------------------------ */
/* Selector de destinatarios (usa CONTACTOS, no duplica nada)          */
/* ------------------------------------------------------------------ */

function SelectorDestinatarios({
  campo,
  valores,
  onChange,
  prioritarios,
}: {
  campo: Campo
  valores: DestinatarioEmail[]
  onChange: (v: DestinatarioEmail[]) => void
  /** Ids de contacto vinculados al expediente (se muestran primero). */
  prioritarios: string[]
}) {
  const [q, setQ] = useState('')
  const [sinEmail, setSinEmail] = useState<Contacto | null>(null)
  const [multiple, setMultiple] = useState<Contacto | null>(null)
  const [libre, setLibre] = useState<string | null>(null)

  const resultados = useMemo(() => {
    const texto = q.trim().toLowerCase()
    if (!texto) return []
    const coincide = (c: Contacto) =>
      [c.nombre, c.apellidos ?? '', c.razonSocial ?? '', c.email, c.email2 ?? '', c.relacion]
        .join(' ')
        .toLowerCase()
        .includes(texto)
    const peso = (c: Contacto) => {
      if (prioritarios.includes(c.id)) return 0
      if (c.relacion === 'Profesional / colaborador') return 1
      return 2
    }
    return CONTACTOS.filter(coincide)
      .sort((a, b) => peso(a) - peso(b) || nombreCompleto(a).localeCompare(nombreCompleto(b)))
      .slice(0, 8)
  }, [q, prioritarios])

  const añadir = (d: DestinatarioEmail) => {
    if (valores.some((v) => v.email.toLowerCase() === d.email.toLowerCase())) return
    onChange([...valores, d])
    setQ('')
    setMultiple(null)
    setSinEmail(null)
  }

  const elegir = (c: Contacto) => {
    const dirs = direccionesDe(c)
    if (!dirs.length) {
      setSinEmail(c)
      return
    }
    if (dirs.length > 1) {
      setMultiple(c)
      return
    }
    añadir({
      contactoId: c.id,
      nombre: nombreCompleto(c),
      email: dirs[0] as string,
      ...(entidadDe(c) ? { entidad: entidadDe(c) } : {}),
    })
  }

  const añadirLibre = () => {
    const texto = q.trim()
    if (!EMAIL_RE.test(texto)) {
      toast.error('Esa dirección de email no es válida.')
      return
    }
    añadir({ nombre: texto, email: texto })
    setLibre(texto)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs tracking-wide uppercase">
        {campo === 'para' ? 'Para' : campo === 'cc' ? 'CC' : 'CCO'}
      </Label>

      {valores.length ? (
        <div className="flex flex-wrap gap-1.5">
          {valores.map((d) => (
            <span
              key={`${campo}-${d.email}`}
              className="border-border bg-secondary text-secondary-foreground inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
            >
              <span className="truncate">
                {d.nombre}
                {d.nombre !== d.email ? ` · ${d.email}` : ''}
              </span>
              <button
                type="button"
                aria-label={`Quitar ${d.email}`}
                onClick={() => onChange(valores.filter((x) => x.email !== d.email))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.includes('@')) {
            e.preventDefault()
            añadirLibre()
          }
        }}
        placeholder="Buscar en Contactos por nombre, entidad, notaría, profesión o email…"
        className="h-9"
      />

      {q.trim() ? (
        <div className="border-border bg-card rounded-md border">
          {resultados.map((c) => {
            const dirs = direccionesDe(c)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => elegir(c)}
                className="border-border/60 hover:bg-accent flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left last:border-0"
              >
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm">
                    {nombreCompleto(c)}
                  </span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {entidadDe(c) || '—'} · {dirs[0] ?? 'sin email'}
                  </span>
                </span>
                {prioritarios.includes(c.id) ? (
                  <ToneBadge tono="info">Del expediente</ToneBadge>
                ) : null}
              </button>
            )
          })}
          {!resultados.length ? (
            <p className="text-muted-foreground px-3 py-2 text-xs">
              Ningún contacto coincide con la búsqueda.
            </p>
          ) : null}
          {q.includes('@') ? (
            <button
              type="button"
              onClick={añadirLibre}
              className="border-border text-primary hover:bg-accent flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" /> Usar la dirección «{q.trim()}» sin registrar
            </button>
          ) : null}
        </div>
      ) : null}

      {multiple ? (
        <div className="border-border bg-muted/40 rounded-md border p-2 text-xs">
          <p className="text-foreground">
            {nombreCompleto(multiple)} tiene varias direcciones. Elige cuál utilizar:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {direccionesDe(multiple).map((e) => (
              <Button
                key={e}
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() =>
                  añadir({
                    contactoId: multiple.id,
                    nombre: nombreCompleto(multiple),
                    email: e,
                    ...(entidadDe(multiple) ? { entidad: entidadDe(multiple) } : {}),
                  })
                }
              >
                {e}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {sinEmail ? (
        <div className="border-warning/50 bg-warning/10 text-warning-foreground flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Este contacto no tiene una dirección de email registrada.</span>
          <Link
            to="/contactos/$id"
            params={{ id: sinEmail.id }}
            target="_blank"
            className="text-primary inline-flex items-center gap-1 font-medium underline"
          >
            Abrir su ficha <ExternalLink className="h-3 w-3" />
          </Link>
          <span className="text-muted-foreground">El borrador se conserva mientras tanto.</span>
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setSinEmail(null)}>
            Cerrar
          </Button>
        </div>
      ) : null}

      {libre ? (
        <div className="border-border text-muted-foreground flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2 text-xs">
          <span>«{libre}» no está registrada en Contactos.</span>
          <Link
            to="/contactos/nuevo"
            target="_blank"
            className="text-primary inline-flex items-center gap-1 font-medium underline"
          >
            Guardar esta dirección en Contactos <ExternalLink className="h-3 w-3" />
          </Link>
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setLibre(null)}>
            Ahora no
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Panel de redacción                                                  */
/* ------------------------------------------------------------------ */

export function RedactarEmailSheet({
  tareaId,
  comunicacionId,
  open,
  onOpenChange,
  onEnviado,
}: {
  tareaId: string
  comunicacionId?: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Envío real confirmado: la tarea decide después qué hacer. */
  onEnviado?: (datos: { comunicacionId: string; destinatario: string; cuando: string }) => void
}) {
  const tarea = useOps((s) => s.tareas.find((t) => t.id === tareaId))
  const expediente = useOps((s) => s.expedientes.find((e) => e.id === tarea?.expedienteId))
  const linea = useOps((s) => s.lineas.find((l) => l.id === tarea?.lineaId))
  const intervinientes = useOps((s) =>
    s.intervinientes.filter((i) => i.expedienteId === tarea?.expedienteId),
  )
  const usuario = useOps((s) => s.usuario)
  const permitido = useOps((s) => (tarea ? puedeRedactarEmail(s, tarea) : false))

  const [para, setPara] = useState<DestinatarioEmail[]>([])
  const [cc, setCc] = useState<DestinatarioEmail[]>([])
  const [cco, setCco] = useState<DestinatarioEmail[]>([])
  const [verCopias, setVerCopias] = useState(false)
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [indicacion, setIndicacion] = useState('')
  const [tono, setTono] = useState<string>('Profesional')
  const [borradorId, setBorradorId] = useState<string | null>(comunicacionId ?? null)
  const [ia, setIa] = useState<'' | 'generar' | 'mejorar' | 'acortar' | 'tono'>('')
  const [revision, setRevision] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const prioritarios = useMemo(
    () => intervinientes.map((i) => i.contactoId).filter((x): x is string => Boolean(x)),
    [intervinientes],
  )

  const firma = `\n\n—\n${usuario}\nLEX · Abogados patrimoniales`

  // Al abrir: se hereda el contexto de la tarea o se recupera el borrador.
  useEffect(() => {
    if (!open || !tarea) return
    const previo = comunicacionId
      ? comunicacionesDeTarea(getOps(), tareaId).find((c) => c.id === comunicacionId)
      : undefined
    if (previo) {
      setBorradorId(previo.id)
      setPara(previo.para ?? [])
      setCc(previo.copia ?? [])
      setCco(previo.copiaOculta ?? [])
      setAsunto(previo.asunto)
      setCuerpo(previo.contenido)
      setVerCopias(Boolean(previo.copia?.length || previo.copiaOculta?.length))
    } else {
      setBorradorId(null)
      setPara([])
      setCc([])
      setCco([])
      setAsunto(expediente ? `${tarea.titulo} – ${expediente.codigo}` : tarea.titulo)
      setCuerpo('')
      setVerCopias(false)
    }
    setRevision(false)
    setIndicacion('')
  }, [open, comunicacionId, tareaId, tarea?.titulo, expediente?.codigo])

  if (!tarea) return null

  const problemas = [
    !para.length ? 'Falta al menos un destinatario.' : '',
    para.some((d) => !EMAIL_RE.test(d.email)) ? 'Hay una dirección no válida.' : '',
    !asunto.trim() ? 'Falta el asunto.' : '',
    !cuerpo.trim() ? 'Falta el cuerpo del mensaje.' : '',
  ].filter(Boolean)

  const asistir = async (modo: 'generar' | 'mejorar' | 'acortar' | 'tono') => {
    if (modo !== 'generar' && !cuerpo.trim()) {
      toast.error('Escribe primero un borrador que la IA pueda revisar.')
      return
    }
    setIa(modo)
    try {
      const destino = para[0]
      const contacto = destino?.contactoId
        ? CONTACTOS.find((c) => c.id === destino.contactoId)
        : undefined
      const r = await redactarEmailIA({
        data: {
          modo,
          indicacion,
          borrador: cuerpo,
          asunto,
          tono,
          contexto: {
            tarea: tarea.titulo,
            descripcion: tarea.descripcion ?? '',
            expediente: expediente ? `${expediente.codigo} · ${expediente.nombre}` : '',
            destinatario: destino
              ? `${destino.nombre}${destino.entidad ? ` (${destino.entidad})` : ''}`
              : '',
            tratamiento: contacto?.tratamiento ?? '',
            remitente: usuario,
          },
        },
      })
      // Sólo se conserva el texto vigente: las propuestas descartadas no se guardan.
      setCuerpo(r.texto)
      toast.success('Borrador propuesto. Revísalo antes de enviarlo.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No ha sido posible redactar el borrador.')
    } finally {
      setIa('')
    }
  }

  const guardar = (silencioso = false) => {
    const r = ops.guardarBorradorEmail(tareaId, {
      ...(borradorId ? { comunicacionId: borradorId } : {}),
      para,
      copia: cc,
      copiaOculta: cco,
      asunto,
      cuerpo,
      remitente: usuario,
    })
    if (!r.ok) {
      toast.error(r.error)
      return null
    }
    setBorradorId(r.id)
    if (!silencioso)
      toast.success('Borrador guardado', { description: `Disponible en Comunicaciones (${r.id}).` })
    return r.id
  }

  const enviar = async () => {
    if (problemas.length) {
      toast.error('No se puede enviar todavía', { description: problemas.join(' ') })
      return
    }
    setEnviando(true)
    const id = guardar(true)
    if (!id) {
      setEnviando(false)
      return
    }
    try {
      const r = await enviarEmailTarea({
        data: {
          para: para.map((d) => d.email),
          cc: cc.map((d) => d.email),
          cco: cco.map((d) => d.email),
          asunto,
          cuerpo: cuerpo + firma,
          remitente: usuario,
        },
      })
      if (!r.disponible) {
        // No hay proveedor: nunca se presenta como enviado.
        ops.registrarHistoricoTarea(tareaId, 'Envío no disponible', r.motivo)
        toast.warning('El email NO se ha enviado', { description: r.motivo })
        onOpenChange(false)
        return
      }
      ops.registrarEnvioEmail(id, { ok: true })
      onEnviado?.({
        comunicacionId: id,
        destinatario: para.map((d) => d.nombre).join(', '),
        cuando: new Date().toLocaleString('es-ES'),
      })
      onOpenChange(false)
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : 'Error desconocido del proveedor de correo.'
      ops.registrarEnvioEmail(id, { ok: false, error: mensaje })
      toast.error('Error de envío', { description: mensaje })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle className="flex items-center gap-2 text-left font-serif text-lg">
            <Mail className="h-4 w-4" /> Redactar email
          </SheetTitle>
          <SheetDescription className="text-left">
            Relacionado con «{tarea.titulo}»{expediente ? ` · ${expediente.codigo}` : ''}
            {linea ? ` · ${linea.nombre}` : ''}. El destinatario sólo recibe el texto que escribas:
            no accede a la tarea ni a la información interna.
          </SheetDescription>
        </SheetHeader>

        {!permitido ? (
          <div className="p-5">
            <p className="border-destructive/40 bg-destructive/10 text-foreground rounded-md border p-3 text-sm">
              No tienes permiso para enviar comunicaciones relacionadas con este encargo.
            </p>
          </div>
        ) : revision ? (
          <div className="space-y-4 p-5">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Revisión antes del envío
            </p>
            <div className="border-border bg-muted/30 space-y-1 rounded-md border p-3 text-sm">
              <p>
                <span className="text-muted-foreground">De:</span> {usuario}
              </p>
              <p>
                <span className="text-muted-foreground">Para:</span>{' '}
                {para.map((d) => `${d.nombre} <${d.email}>`).join(', ')}
              </p>
              {cc.length ? (
                <p>
                  <span className="text-muted-foreground">CC:</span>{' '}
                  {cc.map((d) => d.email).join(', ')}
                </p>
              ) : null}
              {cco.length ? (
                <p>
                  <span className="text-muted-foreground">CCO:</span>{' '}
                  {cco.map((d) => d.email).join(', ')}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Asunto:</span> {asunto}
              </p>
            </div>
            <pre className="border-border bg-card text-foreground rounded-md border p-3 font-sans text-sm whitespace-pre-wrap">
              {cuerpo + firma}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button className="gap-1.5" onClick={enviar} disabled={enviando}>
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar email
              </Button>
              <Button variant="outline" onClick={() => setRevision(false)} disabled={enviando}>
                Volver a editar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <Field label="De">
              <Input value={usuario} readOnly className="bg-muted/40 h-9" />
            </Field>

            <SelectorDestinatarios
              campo="para"
              valores={para}
              onChange={setPara}
              prioritarios={prioritarios}
            />

            {verCopias ? (
              <>
                <SelectorDestinatarios
                  campo="cc"
                  valores={cc}
                  onChange={setCc}
                  prioritarios={prioritarios}
                />
                <SelectorDestinatarios
                  campo="cco"
                  valores={cco}
                  onChange={setCco}
                  prioritarios={prioritarios}
                />
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setVerCopias(true)}
              >
                Añadir CC / CCO
              </Button>
            )}

            <Field label="Asunto">
              <Input
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Asunto del correo"
                className="h-9"
              />
            </Field>

            <Field label="Cuerpo del email">
              <Textarea
                rows={10}
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                placeholder="Escribe el correo, o pide un borrador a la IA y revísalo."
              />
            </Field>
            <p className="border-border text-muted-foreground rounded-md border border-dashed p-2 text-xs">
              Firma que se añadirá al enviar:{firma.replace(/\n/g, ' ')}
            </p>

            <Separator />

            <div className="border-border bg-muted/20 space-y-2 rounded-md border p-3">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Sparkles className="h-3.5 w-3.5" /> Asistencia de redacción (opcional)
              </p>
              <Input
                value={indicacion}
                onChange={(e) => setIndicacion(e.target.value)}
                placeholder="Indicación breve: «Pídele a Unai presupuesto para estas escrituras cuando pueda»"
                className="h-9"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={Boolean(ia)}
                  onClick={() => asistir('generar')}
                >
                  {ia === 'generar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{' '}
                  Generar borrador
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(ia)}
                  onClick={() => asistir('mejorar')}
                >
                  {ia === 'mejorar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{' '}
                  Mejorar redacción
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(ia)}
                  onClick={() => asistir('acortar')}
                >
                  {ia === 'acortar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{' '}
                  Acortar
                </Button>
                <Select value={tono} onValueChange={setTono}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        Tono {t.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(ia)}
                  onClick={() => asistir('tono')}
                >
                  Cambiar tono
                </Button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                La IA sólo propone borradores: nada se envía sin que pulses «Enviar email».
              </p>
            </div>

            {problemas.length ? (
              <p className="text-muted-foreground text-xs">{problemas.join(' ')}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                className="gap-1.5"
                onClick={() => setRevision(true)}
                disabled={problemas.length > 0}
              >
                <Send className="h-4 w-4" /> Revisar y enviar
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={() => guardar()}>
                <Save className="h-4 w-4" /> Guardar borrador
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* Bloque "Comunicaciones relacionadas" dentro de la tarea             */
/* ------------------------------------------------------------------ */

export function ComunicacionesRelacionadas({
  tareaId,
  onAbrir,
}: {
  tareaId: string
  onAbrir: (comunicacionId: string) => void
}) {
  const comunicaciones = useOps((s) => comunicacionesDeTarea(s, tareaId))
  const enviados = comunicaciones.filter((c) => c.estadoEnvio === 'Enviado').length

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        Comunicaciones relacionadas
        {enviados ? ` · ${enviados} ${enviados === 1 ? 'email enviado' : 'emails enviados'}` : ''}
      </p>
      {comunicaciones.length ? (
        comunicaciones.map((c) => (
          <div
            key={c.id}
            className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs"
          >
            <span className="min-w-0">
              <span className="text-foreground block truncate">{c.asunto}</span>
              <span className="text-muted-foreground block truncate">
                {c.canal} · {c.emisor} → {c.destinatarios.join(', ') || '—'} · {c.fecha} {c.hora}
              </span>
              {c.errorEnvio ? <span className="text-destructive block">{c.errorEnvio}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <ToneBadge
                tono={
                  c.estadoEnvio === 'Enviado'
                    ? 'exito'
                    : c.estadoEnvio === 'Error'
                      ? 'riesgo'
                      : 'neutro'
                }
              >
                {c.estadoEnvio ?? (c.enviada ? 'Enviado' : 'Borrador')}
              </ToneBadge>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => onAbrir(c.id)}
              >
                Abrir comunicación
              </Button>
            </span>
          </div>
        ))
      ) : (
        <Vacio texto="Sin comunicaciones relacionadas." />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Qué hacer con la tarea tras un envío confirmado                     */
/* ------------------------------------------------------------------ */

export function TrasEnvioSheet({
  tareaId,
  datos,
  onCerrar,
  onCompletar,
  onRecordatorio,
  onSiguiente,
}: {
  tareaId: string
  datos: { comunicacionId: string; destinatario: string; cuando: string } | null
  onCerrar: () => void
  onCompletar: (sugerencia: string) => void
  onRecordatorio: () => void
  onSiguiente: () => void
}) {
  if (!datos) return null
  const sugerencia = `Email enviado a ${datos.destinatario} el ${datos.cuando}`
  return (
    <Sheet open onOpenChange={(v) => !v && onCerrar()}>
      <SheetContent side="bottom" className={cn('mx-auto max-w-xl rounded-t-lg p-5')}>
        <SheetHeader className="p-0">
          <SheetTitle className="text-left font-serif text-base">
            Email enviado correctamente. ¿Qué quieres hacer ahora?
          </SheetTitle>
          <SheetDescription className="text-left">{sugerencia}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onCompletar(sugerencia)}>
            Completar la tarea
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              ops.marcarEsperandoRespuesta(tareaId, true, datos.comunicacionId)
              toast.success('Tarea en curso, esperando respuesta externa')
              onCerrar()
            }}
          >
            Mantenerla abierta y esperar respuesta
          </Button>
          <Button size="sm" variant="outline" onClick={onRecordatorio}>
            Añadir recordatorio
          </Button>
          <Button size="sm" variant="ghost" onClick={onSiguiente}>
            Crear siguiente tarea
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
