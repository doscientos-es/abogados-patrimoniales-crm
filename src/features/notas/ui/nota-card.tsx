import { Link } from '@tanstack/react-router'
import {
  AlarmClock,
  Archive,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCheck,
  Clock,
  Eye,
  History,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  RotateCcw,
  ShieldAlert,
  Wand2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AMBITO_META, ESTADO_LABEL, type NotaInterna } from '@/data/notas'
import { sumarDias } from '@/data/pipeline'
import { diasHasta, estaVencida, necesitaRevision, notas, useNotas } from '@/lib/notas-store'
import { cn } from '@/lib/utils'

import { enlaceOrigen, nombreContacto } from './contexto'
import { ConvertirNotaDialog } from './nota-convertir'
import { NotaDialog } from './nota-form'

function Marca({
  icon: Icon,
  children,
  className,
}: {
  icon: typeof Pin
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-current/25 bg-background/40 px-2 py-0.5 text-[11px] font-medium',
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {children}
    </span>
  )
}

export function NotaHistorialDialog({
  nota,
  open,
  onOpenChange,
}: {
  nota: NotaInterna
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial de la nota</DialogTitle>
          <DialogDescription>
            Trazabilidad completa: creación, ediciones, vigencia, conversiones y lecturas.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {nota.historial.map((h) => (
            <li key={h.id} className="border-border border-l-2 pl-3">
              <p className="text-foreground text-sm font-medium">{h.accion}</p>
              <p className="text-muted-foreground text-xs">
                {h.fecha} · {h.usuario}
                {h.detalle ? ` · ${h.detalle}` : ''}
              </p>
            </li>
          ))}
        </ol>
        {nota.confirmaciones.length ? (
          <div className="border-border bg-muted/40 rounded-md border p-3">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Confirmaciones de lectura
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {nota.confirmaciones.map((c) => (
                <li key={c.usuario + c.fecha}>
                  {c.usuario} — {c.fecha}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ProrrogarDialog({
  nota: n,
  open,
  onOpenChange,
}: {
  nota: NotaInterna
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [fecha, setFecha] = useState(n.vencimiento ?? sumarDias(30))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Prorrogar vigencia</DialogTitle>
          <DialogDescription>
            La nota se mantiene: solo se amplía su vigencia y queda registrado quién la prorroga.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs tracking-wide uppercase">
            Nueva fecha de vencimiento
          </Label>
          <Input
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            placeholder="dd/mm/aaaa"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              void Promise.resolve(notas.prorrogar(n.id, fecha))
              onOpenChange(false)
              toast.success('Vigencia prorrogada.')
            }}
          >
            Prorrogar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Tarjeta post-it de una nota interna. Color estable según el ámbito. */
export function NotaCard({
  nota: n,
  mostrarOrigen = true,
}: {
  nota: NotaInterna
  mostrarOrigen?: boolean
}) {
  const usuario = useNotas((s) => s.usuario)
  const [editar, setEditar] = useState(false)
  const [historial, setHistorial] = useState(false)
  const [prorroga, setProrroga] = useState(false)
  const [convertir, setConvertir] = useState(false)

  const meta = AMBITO_META[n.ambito]
  const Icono = meta.icon
  const inactiva = n.estado !== 'activa'
  const dias = diasHasta(n.vencimiento)
  const confirmada = n.confirmaciones.some((c) => c.usuario === usuario)

  return (
    <article
      className={cn(
        'flex w-full flex-col rounded-sm border p-4 shadow-md transition-transform',
        inactiva ? 'nota-tono-inactiva' : meta.clase,
        n.critica && 'ring-2 ring-destructive/70',
        'hover:-translate-y-0.5',
      )}
      aria-label={`${meta.label}${n.titulo ? `: ${n.titulo}` : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
          <Icono className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </span>
        <div className="flex items-center gap-1">
          {n.destacada ? <Pin className="h-4 w-4 shrink-0" aria-label="Destacada" /> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hover:bg-background/40 rounded p-1"
                aria-label="Acciones de la nota"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setEditar(true)}>
                <Pencil className="h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void notas.destacar(n.id, !n.destacada)}>
                <Pin className="h-4 w-4" /> {n.destacada ? 'Quitar destacada' : 'Destacar'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void notas.marcarCritica(n.id, !n.critica)}>
                <ShieldAlert className="h-4 w-4" />
                {n.critica ? 'Quitar advertencia crítica' : 'Marcar como crítica'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void notas.requerirConfirmacion(n.id, !n.requiereConfirmacion)}
              >
                <CheckCheck className="h-4 w-4" />
                {n.requiereConfirmacion
                  ? 'No requerir confirmación'
                  : 'Requerir confirmación de lectura'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setProrroga(true)}>
                <CalendarClock className="h-4 w-4" /> Prorrogar vigencia
              </DropdownMenuItem>
              {necesitaRevision(n) ? (
                <DropdownMenuItem onSelect={() => void notas.marcarRevisada(n.id)}>
                  <Check className="h-4 w-4" /> Marcar como revisada
                </DropdownMenuItem>
              ) : null}
              {n.estado === 'activa' ? (
                <>
                  <DropdownMenuItem onSelect={() => void notas.resolver(n.id)}>
                    <Check className="h-4 w-4" /> Resolver
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void notas.archivar(n.id)}>
                    <Archive className="h-4 w-4" /> Archivar
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onSelect={() => void notas.reactivar(n.id)}>
                  <RotateCcw className="h-4 w-4" /> Reactivar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConvertir(true)}>
                <Wand2 className="h-4 w-4" /> Convertir en…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setHistorial(true)}>
                <History className="h-4 w-4" /> Ver historial
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={enlaceOrigen(n.origen)}>
                  <ArrowUpRight className="h-4 w-4" /> Abrir procedencia
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {n.titulo ? (
        <h3 className="mt-2 font-serif text-base leading-snug font-semibold">{n.titulo}</h3>
      ) : null}
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{n.contenido}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {n.critica ? (
          <Marca icon={ShieldAlert} className="border-destructive/60 text-destructive">
            Advertencia crítica
          </Marca>
        ) : null}
        {n.visibilidad === 'restringida' ? <Marca icon={Lock}>Restringida</Marca> : null}
        {inactiva ? <Marca icon={Archive}>{ESTADO_LABEL[n.estado]}</Marca> : null}
        {n.vigencia === 'temporal' && n.vencimiento ? (
          <Marca icon={Clock}>
            {estaVencida(n)
              ? `Vencida el ${n.vencimiento}`
              : `Vigente hasta ${n.vencimiento}${dias !== null && dias <= 7 ? ` (${dias} d)` : ''}`}
          </Marca>
        ) : (
          <Marca icon={Clock}>Permanente</Marca>
        )}
        {necesitaRevision(n) ? <Marca icon={AlarmClock}>Pendiente de revisar</Marca> : null}
        {n.disparadores.length ? (
          <Marca icon={Eye}>{n.disparadores.length} aviso(s) contextual(es)</Marca>
        ) : null}
      </div>

      {n.conversiones.length ? (
        <ul className="mt-2 space-y-0.5 text-[11px] opacity-90">
          {n.conversiones.map((c) => (
            <li key={c.tipo + c.referenciaId}>
              Convertida en {c.tipo} el {c.fecha} por {c.usuario} · {c.etiqueta}
            </li>
          ))}
        </ul>
      ) : null}

      {n.requiereConfirmacion ? (
        <div className="mt-3">
          {confirmada ? (
            <p className="text-[11px] font-medium">Lectura confirmada.</p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="bg-background/50 h-7 border-current/40 text-xs"
              onClick={() => {
                void notas.confirmarLectura(n.id)
                toast.success('Lectura confirmada y registrada.')
              }}
            >
              Confirmar lectura
            </Button>
          )}
        </div>
      ) : null}

      <footer className="mt-3 space-y-0.5 border-t border-current/20 pt-2 text-[11px] opacity-80">
        <p>
          {n.autor} · {n.creada}
          {n.modificada ? ' · Editada' : ''}
        </p>
        {mostrarOrigen ? (
          <p className="truncate">
            Procedencia:{' '}
            <Link to={enlaceOrigen(n.origen)} className="underline underline-offset-2">
              {n.origen.etiqueta}
            </Link>
          </p>
        ) : null}
        {n.contactos.length ? (
          <p className="truncate">Personas: {n.contactos.map(nombreContacto).join(', ')}</p>
        ) : null}
      </footer>

      {editar ? <NotaDialog open={editar} onOpenChange={setEditar} nota={n} /> : null}
      {historial ? (
        <NotaHistorialDialog nota={n} open={historial} onOpenChange={setHistorial} />
      ) : null}
      {prorroga ? <ProrrogarDialog nota={n} open={prorroga} onOpenChange={setProrroga} /> : null}
      {convertir ? (
        <ConvertirNotaDialog nota={n} open={convertir} onOpenChange={setConvertir} />
      ) : null}
    </article>
  )
}
