// COMUNICACIONES — diálogos de preparación y registro.
//
// LEX permite preparar y registrar comunicaciones. Cuando no hay integración
// de proveedor, las abre de forma explícita en el cliente del usuario.
import { Link } from '@tanstack/react-router'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { PendingBadge } from '@/components/common'
import {
  ctxLimpio,
  emailContactoPorId,
  nombreContactoPorId,
  telefonoContactoPorId,
  type ContextoComunicacion,
} from '@/components/comunicaciones/contexto'
import { SelectorFecha, SelectorHora } from '@/components/fechas/datetime'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CUENTAS_CORREO, aplicarVariables, canalDe } from '@/data/comunicaciones'
import { CONTACTOS, nombreCompleto } from '@/data/contactos'
import type { Comunicacion } from '@/data/expedientes-model'
import { hoyTexto } from '@/data/pipeline'
import {
  PLANTILLAS_LEX,
  faseDeContexto,
  plantillasRecientes,
  registrarUsoPlantilla,
  type FaseLex,
  type PlantillaLex,
} from '@/data/plantillas'
import { Field, ToneBadge } from '@/features/crm/ui/ui'
import { useCrm } from '@/lib/crm-store'
import { getOps, ops, propuestaVinculacion, useOps } from '@/lib/expedientes-store'
import { useOnboarding } from '@/lib/onboarding-store'

/** Equipo del despacho (datos de prueba, parametrizable en Configuración). */
const RESPONSABLES = [
  'Igor Belmonte',
  'Ana Torregrosa',
  'Luis Ferrán',
  'Marta Solé',
  'Nuria Casals',
]

const horaActual = () => new Date().toTimeString().slice(0, 5)

/* --------------------------- Selector contacto --------------------- */

function SelectorContacto({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const lista = useMemo(
    () =>
      CONTACTOS.map((c) => ({ id: c.id, nombre: nombreCompleto(c) })).sort((a, b) =>
        a.nombre.localeCompare(b.nombre),
      ),
    [],
  )
  return (
    <Select value={value || 'ninguno'} onValueChange={(v) => onChange(v === 'ninguno' ? '' : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Selecciona un contacto" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="ninguno">Sin identificar</SelectItem>
        {lista.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ---------------------------- Plantillas --------------------------- */

/**
 * PLANTILLAS: pieza nuclear. Toda comunicación saliente parte de una
 * plantilla; el «mensaje libre» usa la plantilla base mínima. Se agrupan por
 * favoritas, recientes, fase de LEX y todas.
 */
export function SelectorPlantilla({
  canal,
  fase,
  seleccionada,
  onAplicar,
}: {
  canal: 'Email' | 'WhatsApp'
  fase?: FaseLex
  seleccionada?: string
  onAplicar: (p: PlantillaLex) => void
}) {
  const [grupo, setGrupo] = useState<'fase' | 'favoritas' | 'recientes' | 'todas'>(
    fase ? 'fase' : 'favoritas',
  )
  const disponibles = PLANTILLAS_LEX.filter((p) => p.canal === canal)
  const lista =
    grupo === 'fase'
      ? disponibles.filter((p) => p.fase === fase)
      : grupo === 'favoritas'
        ? disponibles.filter((p) => p.favorita)
        : grupo === 'recientes'
          ? plantillasRecientes(canal)
          : disponibles

  const aplicar = (p: PlantillaLex) => {
    registrarUsoPlantilla(p.id)
    onAplicar(p)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['favoritas', 'Favoritas'],
            ['recientes', 'Recientes'],
            ['fase', fase ? `De esta fase (${fase})` : 'De esta fase'],
            ['todas', 'Todas'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={grupo === id ? 'default' : 'outline'}
            className="h-7 text-[11px]"
            onClick={() => setGrupo(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {lista.length ? (
          lista.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={seleccionada === p.id ? 'default' : 'secondary'}
              className="h-7 text-[11px]"
              title={p.finalidad}
              onClick={() => aplicar(p)}
            >
              {p.nombre}
              {p.formato !== 'Texto' ? ' · audio' : ''}
            </Button>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">Sin plantillas en este grupo.</span>
        )}
      </div>
    </div>
  )
}

/* ----------- Destinatario / contexto / documentos DESDE EXPEDIENTE -------- */

const pareceEmail = (v: string) => v.includes('@')
const pareceTelefono = (v: string) => /\d{6,}/.test(v.replace(/\s/g, ''))

function abrirClienteCorreo({
  para,
  cc,
  asunto,
  cuerpo,
}: Record<'para' | 'cc' | 'asunto' | 'cuerpo', string>) {
  const parametros = new URLSearchParams({ subject: asunto, body: cuerpo })
  if (cc.trim()) parametros.set('cc', cc.trim())
  window.location.assign(`mailto:${encodeURIComponent(para.trim())}?${parametros.toString()}`)
}

function abrirWhatsapp(destinatario: string, texto: string) {
  const telefono = destinatario.replace(/\D/g, '').replace(/^00/, '')
  if (telefono.length < 8 || telefono.length > 15) return false
  window.open(
    `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`,
    '_blank',
    'noopener,noreferrer',
  )
  return true
}

/** Dato de contacto disponible de un interviniente para el canal indicado. */
function datoDeInterviniente(
  i: { contacto: string; contactoId?: string },
  canal: 'Email' | 'WhatsApp',
): string {
  const propio = (i.contacto ?? '').trim()
  if (canal === 'Email') {
    if (pareceEmail(propio)) return propio
    return emailContactoPorId(i.contactoId) || ''
  }
  if (pareceTelefono(propio) && !pareceEmail(propio)) return propio
  return telefonoContactoPorId(i.contactoId) || ''
}

/**
 * DESTINATARIO desde expediente: intervinientes del propio expediente, con
 * NOMBRE · ROL. LEX no inventa el dato de contacto: si falta, lo advierte.
 */
export function SelectorInterviniente({
  expedienteId,
  canal,
  value,
  onChange,
}: {
  expedienteId: string
  canal: 'Email' | 'WhatsApp'
  value: string
  onChange: (
    dato: string,
    interviniente: { id: string; nombre: string; contactoId?: string },
  ) => void
}) {
  const intervinientes = useOps((s) =>
    s.intervinientes.filter((i) => i.expedienteId === expedienteId),
  )
  const [seleccionado, setSeleccionado] = useState('')
  const actual = intervinientes.find((i) => i.id === seleccionado)
  const dato = actual ? datoDeInterviniente(actual, canal) : ''

  return (
    <div className="space-y-1.5">
      <Select
        value={seleccionado || 'ninguno'}
        onValueChange={(v) => {
          setSeleccionado(v === 'ninguno' ? '' : v)
          const i = intervinientes.find((x) => x.id === v)
          if (i) {
            onChange(datoDeInterviniente(i, canal), {
              id: i.id,
              nombre: i.nombre,
              ...(i.contactoId ? { contactoId: i.contactoId } : {}),
            })
          } else onChange('', { id: '', nombre: '' })
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecciona un interviniente del expediente" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="ninguno">Sin seleccionar</SelectItem>
          {intervinientes.map((i) => {
            const d = datoDeInterviniente(i, canal)
            return (
              <SelectItem key={i.id} value={i.id}>
                {i.nombre} · {i.rol}
                {d ? '' : canal === 'Email' ? ' — sin email' : ' — sin teléfono'}
              </SelectItem>
            )
          })}
          {intervinientes.length ? null : (
            <SelectItem value="vacio" disabled>
              El expediente no tiene intervinientes registrados
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {actual ? (
        dato ? (
          <p className="text-muted-foreground text-xs">
            {canal === 'Email' ? 'Email' : 'Teléfono'} del interviniente:{' '}
            <strong className="text-foreground">{value || dato}</strong>
          </p>
        ) : (
          <p className="text-destructive text-xs">
            {canal === 'Email'
              ? 'Este interviniente no tiene email registrado en su ficha.'
              : 'Este interviniente no tiene teléfono registrado en su ficha.'}{' '}
            LEX no lo inventa: complétalo en su ficha o indícalo manualmente.
          </p>
        )
      ) : null}
    </div>
  )
}

/** Contexto heredado del expediente: información, no selector editable. */
export function ContextoExpedienteFijo({ expedienteId }: { expedienteId: string }) {
  const exp = useOps((s) => s.expedientes.find((e) => e.id === expedienteId))
  if (!exp) return null
  return (
    <div className="border-border bg-muted/30 flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
      <span className="text-muted-foreground">Expediente:</span>
      <strong className="text-foreground">
        {exp.codigo} · {exp.nombre}
      </strong>
      <Link
        to="/expedientes/$id"
        params={{ id: exp.id }}
        className="text-primary ml-auto hover:underline"
      >
        Ver expediente
      </Link>
    </div>
  )
}

/**
 * ADJUNTAR DESDE DOCUMENTOS DEL EXPEDIENTE. Selección real de documentos del
 * expediente actual; el volcado del archivo al envío queda pendiente de la
 * integración documental completa.
 */
export function AdjuntosDelExpediente({
  expedienteId,
  seleccion,
  onChange,
}: {
  expedienteId: string
  seleccion: string[]
  onChange: (v: string[]) => void
}) {
  const documentos = useOps((s) => s.documentos.filter((d) => d.expedienteId === expedienteId))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value=""
          onValueChange={(v) => {
            if (!seleccion.includes(v)) onChange([...seleccion, v])
          }}
        >
          <SelectTrigger className="w-full sm:w-[420px]">
            <SelectValue placeholder="Adjuntar desde Documentos del expediente" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {documentos.length ? (
              documentos.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nombre} · {d.tipoDocumental}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="vacio" disabled>
                El expediente todavía no tiene documentos
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <PendingBadge label="Volcado del archivo · pendiente de integración documental" />
      </div>
      {seleccion.length ? (
        <div className="flex flex-wrap gap-1.5">
          {seleccion.map((id) => {
            const d = documentos.find((x) => x.id === id)
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[11px]"
                title="Quitar del envío"
                onClick={() => onChange(seleccion.filter((x) => x !== id))}
              >
                {d?.nombre ?? id} ✕
              </Button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * CONTACTO DE LA COMUNICACIÓN (único componente para email, WhatsApp y llamada).
 * Desde expediente: intervinientes del expediente (NOMBRE · ROL) y opción
 * «Sin identificar / Sin registrar». Desde el panel general: búsqueda por las
 * primeras letras en CONTACTOS, «Sin registrar» y aviso de los expedientes
 * relacionados del contacto elegido, sin obligar a Lead/Onboarding.
 */
export function ContactoContexto({
  expedienteId,
  contactoId,
  onChange,
  label = 'Contacto',
}: {
  expedienteId?: string
  contactoId: string
  onChange: (v: string) => void
  label?: string
}) {
  const intervinientes = useOps((s) =>
    expedienteId ? s.intervinientes.filter((i) => i.expedienteId === expedienteId) : [],
  )
  const propuesta = useOps((s) => propuestaVinculacion(s, contactoId || undefined))
  const [q, setQ] = useState('')

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return CONTACTOS.map((c) => ({ id: c.id, nombre: nombreCompleto(c) }))
      .filter((c) => c.nombre.toLowerCase().includes(t))
      .slice(0, 8)
  }, [q])

  if (expedienteId) {
    return (
      <Field label={label}>
        <Select
          value={contactoId || 'ninguno'}
          onValueChange={(v) => onChange(v === 'ninguno' ? '' : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Interviniente del expediente" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="ninguno">Sin identificar / Sin registrar</SelectItem>
            {intervinientes
              .filter((i) => i.contactoId)
              .map((i) => (
                <SelectItem key={i.id} value={i.contactoId!}>
                  {i.nombre} · {i.rol}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
    )
  }

  return (
    <div className="space-y-2">
      <Field label={label}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escribe las primeras letras del contacto…"
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={contactoId ? 'outline' : 'default'}
          className="h-7 text-[11px]"
          onClick={() => onChange('')}
        >
          Sin registrar
        </Button>
        {resultados.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={contactoId === c.id ? 'default' : 'secondary'}
            className="h-7 text-[11px]"
            onClick={() => onChange(c.id)}
          >
            {c.nombre}
          </Button>
        ))}
        {q.trim().length >= 2 && !resultados.length ? (
          <span className="text-muted-foreground text-xs">Sin resultados en CONTACTOS.</span>
        ) : null}
      </div>
      {contactoId ? (
        <div className="border-border bg-muted/30 rounded-md border border-dashed px-3 py-2 text-xs">
          <p className="text-foreground">{nombreContactoPorId(contactoId)}</p>
          {propuesta.abiertos.length || propuesta.cerrados.length ? (
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
              <span>Expedientes relacionados:</span>
              {[...propuesta.abiertos, ...propuesta.cerrados].map((e) => (
                <Link
                  key={e.id}
                  to="/expedientes/$id"
                  params={{ id: e.id }}
                  className="text-primary hover:underline"
                >
                  {e.codigo}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mt-1">
              Sin expedientes asociados: la llamada queda en la ficha del contacto.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Valores de contexto para sustituir las variables de la plantilla. */
function valoresContexto(ctx: ContextoComunicacion, remitente: string) {
  const s = getOps()
  const exp = ctx.expedienteId ? s.expedientes.find((e) => e.id === ctx.expedienteId) : undefined
  return {
    NUM_EXPEDIENTE: exp?.codigo ?? '[indicar expediente]',
    TITULO_EXPEDIENTE: exp?.nombre ?? '[indicar asunto]',
    CONTACTO: nombreContactoPorId(ctx.contactoId) || '[indicar destinatario]',
    DESPACHO: 'Abogados Patrimoniales',
    REMITENTE: remitente,
  }
}

/* ------------------------- Vinculación de contexto ------------------ */

/**
 * Propuesta semiautomática de contexto. LEX propone; la decisión es siempre
 * del usuario. Cada comunicación se vincula individualmente.
 */
export function CamposContexto({
  ctx,
  onChange,
}: {
  ctx: ContextoComunicacion
  onChange: (c: ContextoComunicacion) => void
}) {
  const expedientes = useOps((s) => s.expedientes)
  const propuesta = useOps((s) => propuestaVinculacion(s, ctx.contactoId))
  const leads = useCrm((s) => s.oportunidades)
  const onboardings = useOnboarding((s) => s.onboardings)

  const set = (parcial: Partial<ContextoComunicacion>) => onChange({ ...ctx, ...parcial })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Contacto">
        <SelectorContacto
          value={ctx.contactoId ?? ''}
          onChange={(v) => onChange({ contactoId: v || undefined })}
        />
      </Field>
      <Field label="Expediente">
        <Select
          value={ctx.expedienteId ?? 'ninguno'}
          onValueChange={(v) => set({ expedienteId: v === 'ninguno' ? undefined : v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="ninguno">Sin expediente (queda en la ficha del contacto)</SelectItem>
            {expedientes.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.codigo} · {e.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Lead">
        <Select
          value={ctx.leadId ?? 'ninguno'}
          onValueChange={(v) => set({ leadId: v === 'ninguno' ? undefined : v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="ninguno">Sin lead</SelectItem>
            {leads.slice(0, 60).map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.codigo} · {o.titulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Onboarding">
        <Select
          value={ctx.onboardingId ?? 'ninguno'}
          onValueChange={(v) => set({ onboardingId: v === 'ninguno' ? undefined : v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="ninguno">Sin onboarding</SelectItem>
            {onboardings.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.codigo} · {o.asunto}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {ctx.contactoId ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs sm:col-span-2">
          {propuesta.propuesto ? (
            <span className="flex flex-wrap items-center gap-2">
              Propuesta de LEX: expediente abierto{' '}
              <strong className="text-foreground">{propuesta.propuesto.codigo}</strong>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[11px]"
                onClick={() => set({ expedienteId: propuesta.propuesto?.id })}
              >
                Aplicar
              </Button>
            </span>
          ) : propuesta.abiertos.length > 1 ? (
            <span>
              El contacto tiene {propuesta.abiertos.length} expedientes abiertos: elige uno arriba.
            </span>
          ) : propuesta.cerrados.length ? (
            <span>
              Sólo constan expedientes cerrados. La comunicación quedará en la ficha del contacto
              salvo que la vincules manualmente.
            </span>
          ) : (
            <span>Sin expedientes asociados: quedará en la ficha del contacto.</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------ Nuevo email ------------------------ */

export function NuevoEmailDialog({
  trigger,
  contexto,
  destinatarioInicial,
  asuntoInicial,
  respuestaDe,
  onRegistrada,
}: {
  trigger: ReactNode
  /** Contexto heredado automáticamente desde donde se abre. */
  contexto?: ContextoComunicacion
  destinatarioInicial?: string
  asuntoInicial?: string
  respuestaDe?: string
  onRegistrada?: (id: string) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const [abierto, setAbierto] = useState(false)
  const [ctx, setCtx] = useState<ContextoComunicacion>(contexto ?? {})
  const [cuenta, setCuenta] = useState(CUENTAS_CORREO[0]!.direccion)
  const [para, setPara] = useState(destinatarioInicial ?? '')
  const [cc, setCc] = useState('')
  const [asunto, setAsunto] = useState(asuntoInicial ?? '')
  const [cuerpo, setCuerpo] = useState('')
  const [adjuntos, setAdjuntos] = useState('')
  const [docsExpediente, setDocsExpediente] = useState<string[]>([])
  /** Abierto DESDE un expediente: contexto heredado, no editable. */
  const desdeExpediente = contexto?.expedienteId
  const documentos = useOps((s) =>
    desdeExpediente ? s.documentos.filter((d) => d.expedienteId === desdeExpediente) : [],
  )

  const abrir = (v: boolean) => {
    setAbierto(v)
    if (v) {
      setCtx(contexto ?? {})
      setPara(destinatarioInicial ?? emailContactoPorId(contexto?.contactoId) ?? '')
      setAsunto(asuntoInicial ?? '')
      setDocsExpediente([])
    }
  }

  const aplicarPlantilla = (p: PlantillaLex) => {
    const v = valoresContexto(ctx, usuario)
    if (p.asunto) setAsunto(aplicarVariables(p.asunto, v))
    setCuerpo(aplicarVariables(p.cuerpo, v))
  }

  const guardar = () => {
    if (!para.trim()) {
      toast.error('Indica al menos un destinatario.')
      return
    }
    if (!asunto.trim()) {
      toast.error('Indica el asunto.')
      return
    }
    const id = ops.registrarComunicacion({
      canal: 'Email',
      direccion: 'Salida',
      asunto,
      contenido: cuerpo,
      cuenta,
      emisor: usuario,
      destinatarios: [para, ...(cc ? [`CC: ${cc}`] : [])],
      estadoEnvio: 'Borrador',
      triaje: 'Tratada',
      ...(respuestaDe ? { respuestaDe } : {}),
      ...ctxLimpio(ctx),
      ...(adjuntos.trim() || docsExpediente.length
        ? {
            adjuntosRef: [
              ...adjuntos
                .split(',')
                .map((n) => n.trim())
                .filter(Boolean)
                .map((nombre) => ({ nombre })),
              ...docsExpediente.map((id) => ({
                nombre: documentos.find((d) => d.id === id)?.nombre ?? id,
                documentoId: id,
              })),
            ],
          }
        : {}),
    })
    if (respuestaDe) ops.marcarContestada(respuestaDe)
    toast.success('Email preparado', {
      description:
        'Queda registrado en COMUNICACIONES como preparado. El envío real está pendiente de integración.',
    })
    onRegistrada?.(id)
    setAbierto(false)
    setCuerpo('')
    setAdjuntos('')
    setDocsExpediente([])
  }

  const abrirEnClienteCorreo = () => {
    if (!pareceEmail(para.trim())) {
      toast.error('Indica una dirección de correo válida.')
      return
    }
    if (!asunto.trim()) {
      toast.error('Indica el asunto antes de abrir el cliente de correo.')
      return
    }
    abrirClienteCorreo({ para, cc, asunto, cuerpo })
  }

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Nuevo email
          </DialogTitle>
          <DialogDescription>
            Prepara el correo y ábrelo en el cliente de correo instalado. LEX no lo envía ni marca
            como enviado automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cuenta del despacho">
              <Select value={cuenta} onValueChange={setCuenta}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUENTAS_CORREO.filter((c) => c.canal === 'Email').map((c) => (
                    <SelectItem key={c.id} value={c.direccion}>
                      {c.direccion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Para">
              {desdeExpediente ? (
                <SelectorInterviniente
                  expedienteId={desdeExpediente}
                  canal="Email"
                  value={para}
                  onChange={(dato, i) => {
                    setPara(dato)
                    setCtx((c) => ({ ...c, ...(i.contactoId ? { contactoId: i.contactoId } : {}) }))
                  }}
                />
              ) : (
                <Input
                  value={para}
                  onChange={(e) => setPara(e.target.value)}
                  placeholder="correo@dominio.es"
                />
              )}
            </Field>
            <Field label="CC (opcional)">
              <Input value={cc} onChange={(e) => setCc(e.target.value)} />
            </Field>
            <Field label="Asunto">
              <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
            </Field>
          </div>

          <Field label="Plantilla">
            <SelectorPlantilla
              canal="Email"
              fase={faseDeContexto(ctx)}
              onAplicar={aplicarPlantilla}
            />
          </Field>

          <Field label="Cuerpo">
            <Textarea rows={8} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
          </Field>

          <Field label="Adjuntos (nombres separados por comas)">
            <Input
              value={adjuntos}
              onChange={(e) => setAdjuntos(e.target.value)}
              placeholder="escrito.pdf, poder.pdf"
            />
          </Field>

          {desdeExpediente ? (
            <Field label="Documentos del expediente">
              <AdjuntosDelExpediente
                expedienteId={desdeExpediente}
                seleccion={docsExpediente}
                onChange={setDocsExpediente}
              />
            </Field>
          ) : null}

          <div>
            <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
              {desdeExpediente ? 'Contexto heredado' : 'Contacto y contexto'}
            </p>
            {desdeExpediente ? (
              <ContextoExpedienteFijo expedienteId={desdeExpediente} />
            ) : (
              <ContactoContexto
                label="Contacto"
                contactoId={ctx.contactoId ?? ''}
                onChange={(v) => {
                  setCtx(v ? { contactoId: v } : {})
                  const email = emailContactoPorId(v)
                  if (email) setPara(email)
                }}
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <p className="text-muted-foreground mr-auto text-xs">
            Los adjuntos se añaden en el cliente de correo.
          </p>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={abrirEnClienteCorreo}>
            Abrir cliente de correo
          </Button>
          <Button onClick={guardar}>Guardar borrador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------- Nuevo WhatsApp ------------------------ */

export function NuevoWhatsappDialog({
  trigger,
  contexto,
  onRegistrada,
}: {
  trigger: ReactNode
  contexto?: ContextoComunicacion
  onRegistrada?: (id: string) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const [abierto, setAbierto] = useState(false)
  const [ctx, setCtx] = useState<ContextoComunicacion>(contexto ?? {})
  const [destinatario, setDestinatario] = useState('')
  const [texto, setTexto] = useState('')
  const [adjunto, setAdjunto] = useState('')
  const [docsExpediente, setDocsExpediente] = useState<string[]>([])
  /** Abierto DESDE un expediente: contexto heredado, no editable. */
  const desdeExpediente = contexto?.expedienteId
  const documentos = useOps((s) =>
    desdeExpediente ? s.documentos.filter((d) => d.expedienteId === desdeExpediente) : [],
  )

  const abrir = (v: boolean) => {
    setAbierto(v)
    if (v) {
      setCtx(contexto ?? {})
      setDestinatario(telefonoContactoPorId(contexto?.contactoId))
      setDocsExpediente([])
    }
  }

  const guardar = () => {
    if (!destinatario.trim()) {
      toast.error('Indica el destinatario.')
      return
    }
    if (!texto.trim()) {
      toast.error('Escribe el mensaje.')
      return
    }
    const id = ops.registrarComunicacion({
      canal: 'WhatsApp',
      direccion: 'Salida',
      asunto: texto.slice(0, 80),
      contenido: texto,
      emisor: usuario,
      destinatarios: [destinatario],
      cuenta: CUENTAS_CORREO.find((c) => c.canal === 'WhatsApp')?.direccion ?? '',
      estadoEnvio: 'Borrador',
      triaje: 'Tratada',
      ...ctxLimpio(ctx),
      ...(adjunto.trim() || docsExpediente.length
        ? {
            adjuntosRef: [
              ...(adjunto.trim() ? [{ nombre: adjunto.trim() }] : []),
              ...docsExpediente.map((docId) => ({
                nombre: documentos.find((d) => d.id === docId)?.nombre ?? docId,
                documentoId: docId,
              })),
            ],
          }
        : {}),
    })
    toast.success('Mensaje preparado', {
      description:
        'Registrado en COMUNICACIONES. El envío por WhatsApp Business está pendiente de integración.',
    })
    onRegistrada?.(id)
    setAbierto(false)
    setTexto('')
    setAdjunto('')
    setDocsExpediente([])
  }

  const abrirEnWhatsapp = () => {
    if (!texto.trim()) {
      toast.error('Escribe el mensaje antes de abrir WhatsApp.')
      return
    }
    if (!abrirWhatsapp(destinatario, texto)) {
      toast.error('Indica un teléfono válido con prefijo internacional.')
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Nuevo WhatsApp
          </DialogTitle>
          <DialogDescription>
            Prepara el mensaje y ábrelo en WhatsApp. LEX no lo envía ni marca como enviado
            automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Destinatario">
            {desdeExpediente ? (
              <SelectorInterviniente
                expedienteId={desdeExpediente}
                canal="WhatsApp"
                value={destinatario}
                onChange={(dato, i) => {
                  setDestinatario(dato)
                  setCtx((c) => ({ ...c, ...(i.contactoId ? { contactoId: i.contactoId } : {}) }))
                }}
              />
            ) : (
              <Input
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                placeholder="+34 ..."
              />
            )}
          </Field>
          <Field label="Plantilla">
            <SelectorPlantilla
              canal="WhatsApp"
              fase={faseDeContexto(ctx)}
              onAplicar={(p) => setTexto(aplicarVariables(p.cuerpo, valoresContexto(ctx, usuario)))}
            />
          </Field>
          <Field label="Texto">
            <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Field>
          <Field label="Adjunto (opcional)">
            <Input value={adjunto} onChange={(e) => setAdjunto(e.target.value)} />
          </Field>
          {desdeExpediente ? (
            <Field label="Documentos del expediente">
              <AdjuntosDelExpediente
                expedienteId={desdeExpediente}
                seleccion={docsExpediente}
                onChange={setDocsExpediente}
              />
            </Field>
          ) : null}
          <div>
            <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
              {desdeExpediente ? 'Contexto heredado' : 'Contacto y contexto'}
            </p>
            {desdeExpediente ? (
              <ContextoExpedienteFijo expedienteId={desdeExpediente} />
            ) : (
              <ContactoContexto
                label="Contacto"
                contactoId={ctx.contactoId ?? ''}
                onChange={(v) => {
                  setCtx(v ? { contactoId: v } : {})
                  const tel = telefonoContactoPorId(v)
                  if (tel) setDestinatario(tel)
                }}
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <p className="text-muted-foreground mr-auto text-xs">
            Los adjuntos se añaden directamente en WhatsApp.
          </p>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={abrirEnWhatsapp}>
            Abrir WhatsApp
          </Button>
          <Button onClick={guardar}>Guardar borrador</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------- Registro de llamada --------------------- */

export function RegistroLlamadaDialog({
  trigger,
  contexto,
  contactoInicial,
  direccionInicial = 'Entrada',
  open,
  onOpenChange,
  onRegistrada,
}: {
  trigger?: ReactNode
  contexto?: ContextoComunicacion
  contactoInicial?: string
  direccionInicial?: 'Entrada' | 'Salida'
  open?: boolean
  onOpenChange?: (v: boolean) => void
  onRegistrada?: (id: string) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const [interno, setInterno] = useState(false)
  const abierto = open ?? interno
  const setAbierto = (v: boolean) => {
    setInterno(v)
    onOpenChange?.(v)
  }
  const [ctx, setCtx] = useState<ContextoComunicacion>(
    contexto ?? (contactoInicial ? { contactoId: contactoInicial } : {}),
  )
  const [direccion, setDireccion] = useState<'Entrada' | 'Salida'>(direccionInicial)
  const [fecha, setFecha] = useState(hoyTexto())
  const [hora, setHora] = useState(horaActual())
  const [notas, setNotas] = useState('')
  const [ultima, setUltima] = useState<string | null>(null)

  const guardar = (): string | undefined => {
    /** El contacto puede quedar SIN REGISTRAR: la llamada se registra igual. */
    const quien = ctx.contactoId ? nombreContactoPorId(ctx.contactoId) : 'Sin identificar'
    const id = ops.registrarComunicacion({
      canal: 'Llamada',
      direccion,
      fecha,
      hora,
      asunto: `Llamada ${direccion === 'Entrada' ? 'recibida' : 'realizada'} · ${quien}`,
      notasInternas: notas,
      emisor: direccion === 'Entrada' ? quien : usuario,
      destinatarios: [direccion === 'Entrada' ? usuario : quien],
      triaje: 'Tratada',
      ...ctxLimpio(ctx),
    })
    setUltima(id)
    onRegistrada?.(id)
    toast.success('Llamada registrada en COMUNICACIONES')
    setAbierto(false)
    setNotas('')
    return id
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4" /> Registro de llamada
          </DialogTitle>
          <DialogDescription>
            Queda registrada en la cronología de COMUNICACIONES del contacto y de su contexto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sentido">
              <Select
                value={direccion}
                onValueChange={(v) => setDireccion(v as 'Entrada' | 'Salida')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrada">Recibida</SelectItem>
                  <SelectItem value="Salida">Realizada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha">
              <SelectorFecha value={fecha} onChange={setFecha} />
            </Field>
            <Field label="Hora">
              <SelectorHora value={hora} onChange={setHora} />
            </Field>
          </div>

          <Field label="Notas internas">
            <Textarea rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Field>

          <div className="space-y-2">
            <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
              Contacto y contexto
            </p>
            {ctx.expedienteId ? (
              <>
                <ContextoExpedienteFijo expedienteId={ctx.expedienteId} />
                <ContactoContexto
                  label="Contacto de la llamada"
                  expedienteId={ctx.expedienteId}
                  contactoId={ctx.contactoId ?? ''}
                  onChange={(v) => setCtx({ ...ctx, contactoId: v || undefined })}
                />
              </>
            ) : (
              <ContactoContexto
                label="Contacto de la llamada"
                contactoId={ctx.contactoId ?? ''}
                onChange={(v) => setCtx({ ...ctx, contactoId: v || undefined })}
              />
            )}
          </div>

          {ultima ? <ToneBadge tono="exito">Última llamada registrada: {ultima}</ToneBadge> : null}
        </div>

        {/* La llamada se registra primero; las tareas nacen después desde la
            ficha de la comunicación («+ Tarea de comunicación» / «+ Tarea»). */}
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar llamada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------- TAREA ESPECIAL DE COMUNICACIÓN (Email/WA/Llamada) ------------- */

/**
 * Crea una TAREA ESPECIAL DE COMUNICACIÓN sobre una comunicación existente.
 * Sólo cuando lo que hay que hacer es precisamente COMUNICAR: contestar un
 * email, responder un WhatsApp o devolver una llamada. Reutiliza el sistema
 * de tareas: no hay un segundo sistema paralelo.
 */
export function TareaEspecialComunicacionDialog({
  comunicacion,
  canalInicial,
  trigger,
  onCreada,
}: {
  comunicacion: Comunicacion
  canalInicial?: 'Email' | 'WhatsApp' | 'Llamada'
  trigger: ReactNode
  onCreada?: (tareaId: string) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const [abierto, setAbierto] = useState(false)
  const canalPorDefecto: 'Email' | 'WhatsApp' | 'Llamada' =
    canalInicial ?? (canalDe(comunicacion) === 'Otro' ? 'Email' : (canalDe(comunicacion) as never))
  const [canal, setCanal] = useState<'Email' | 'WhatsApp' | 'Llamada'>(canalPorDefecto)
  const [indicaciones, setIndicaciones] = useState('')
  const [responsable, setResponsable] = useState(comunicacion.responsable || usuario)
  const [vencimiento, setVencimiento] = useState('')

  const contacto = nombreContactoPorId(comunicacion.contactoId) || comunicacion.emisor

  /**
   * TÍTULO OBLIGATORIO Y AUTOGENERADO. LEX lo propone según canal, sentido de
   * la comunicación original y contacto; el usuario puede editarlo.
   */
  const tituloSugerido = (c: 'Email' | 'WhatsApp' | 'Llamada') => {
    const quien = contacto || 'el contacto'
    const entrante = (comunicacion.direccion ?? 'Entrada') === 'Entrada'
    if (c === 'Llamada') return entrante ? `Devolver llamada a ${quien}` : `Llamar a ${quien}`
    if (c === 'WhatsApp')
      return entrante ? `Responder WhatsApp a ${quien}` : `Enviar WhatsApp a ${quien}`
    return entrante ? `Responder email a ${quien}` : `Enviar email a ${quien}`
  }

  const [titulo, setTitulo] = useState(() => tituloSugerido(canalPorDefecto))
  const [tituloTocado, setTituloTocado] = useState(false)

  const cambiarCanal = (c: 'Email' | 'WhatsApp' | 'Llamada') => {
    setCanal(c)
    if (!tituloTocado) setTitulo(tituloSugerido(c))
  }

  const crear = () => {
    if (!titulo.trim()) {
      toast.error('El título es obligatorio.')
      return
    }
    const id = ops.crearTareaEspecialComunicacion({
      canal,
      comunicacionId: comunicacion.id,
      titulo: titulo.trim(),
      ...(indicaciones.trim() ? { indicaciones: indicaciones.trim() } : {}),
      responsable,
      ...(vencimiento ? { vencimiento } : {}),
      ...(comunicacion.contactoId ? { contactoId: comunicacion.contactoId } : {}),
      ...(contacto ? { contacto } : {}),
      ...(comunicacion.leadId ? { leadId: comunicacion.leadId } : {}),
      ...(comunicacion.onboardingId ? { onboardingId: comunicacion.onboardingId } : {}),
      ...(comunicacion.expedienteId ? { expedienteId: comunicacion.expedienteId } : {}),
    })
    setAbierto(false)
    toast.success('Tarea especial de comunicación creada', {
      description: 'La comunicación original queda accesible desde la propia tarea.',
    })
    if (id) onCreada?.(id)
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tarea especial de comunicación</DialogTitle>
          <DialogDescription>
            Lo que hay que hacer es comunicar. Si además hay trabajo jurídico, crea una tarea normal
            desde la ficha de la comunicación.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Canal">
              <Select value={canal} onValueChange={(v) => cambiarCanal(v as typeof canal)}>
                <SelectTrigger>
                  <SelectValue>{canal}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Llamada">Llamada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Asignada a">
              <Select value={responsable} onValueChange={setResponsable}>
                <SelectTrigger>
                  <SelectValue>{responsable}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RESPONSABLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Título (obligatorio · propuesto por LEX y editable)">
            <Input
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value)
                setTituloTocado(true)
              }}
              placeholder={tituloSugerido(canal)}
            />
          </Field>

          <Field label="Indicaciones">
            <Textarea
              rows={3}
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
              placeholder="Qué hay que comunicar y con qué alcance."
            />
          </Field>
          <Field label="Vencimiento (opcional)">
            <SelectorFecha value={vencimiento} onChange={setVencimiento} />
          </Field>
          <p className="border-border bg-muted/40 text-muted-foreground rounded-md border p-2.5 text-xs">
            Comunicación original: {comunicacion.asunto || '(sin asunto)'} · {comunicacion.fecha}{' '}
            {comunicacion.hora}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={crear}>Crear tarea especial</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
