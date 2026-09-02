import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { Building2, UserPlus, Users, X } from 'lucide-react'
// Campos compartidos de la TAREA ESPECIAL «REUNIÓN».
//
// Se usan tanto en el alta (instrucciones) como en la fase de PREPARACIÓN de
// la ficha, para que la orden de trabajo se lea y se edite igual en ambos
// sitios. CON QUIÉN reutiliza INTERVINIENTES y CONTACTOS ya existentes en LEX:
// añadir a alguien a una reunión NO lo convierte en interviniente.
import { useMemo, useState } from 'react'

import { SelectorFecha } from '@/components/fechas/datetime'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CONTACTOS } from '@/data/contactos'
import { USUARIOS } from '@/data/crm'
import {
  DURACIONES_REUNION,
  FRANJAS_REUNION,
  LUGARES_REUNION,
  PREFERENCIAS_FECHA_REUNION,
  type ClaseAsistente,
  type FranjaReunion,
} from '@/data/expedientes-model'
import { useOps } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

export type Participante = {
  nombre: string
  clase: ClaseAsistente
  rol?: string
  contactoId?: string
}

export const nombreDeContacto = (id: string) => {
  const c = CONTACTOS.find((x) => x.id === id)
  if (!c) return id
  return [c.nombre, c.apellidos].filter(Boolean).join(' ') || c.razonSocial || id
}

export function CampoLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
      {children}
    </Label>
  )
}

/* ------------------------------ CON QUIÉN ------------------------------ */

export function SelectorParticipantes({
  expedienteId,
  valor,
  onChange,
}: {
  expedienteId?: string
  valor: Participante[]
  onChange: (v: Participante[]) => void
}) {
  const intervinientes = useOps((s) => s.intervinientes)
  const [abiertoContacto, setAbiertoContacto] = useState(false)
  const [abiertoCompanero, setAbiertoCompanero] = useState(false)

  const delExpediente = useMemo(
    () => (expedienteId ? intervinientes.filter((i) => i.expedienteId === expedienteId) : []),
    [intervinientes, expedienteId],
  )

  const seleccionado = (p: Participante) =>
    valor.some((v) => (p.contactoId && v.contactoId === p.contactoId) || v.nombre === p.nombre)

  const alternar = (p: Participante) => {
    if (seleccionado(p)) {
      onChange(
        valor.filter(
          (v) => !((p.contactoId && v.contactoId === p.contactoId) || v.nombre === p.nombre),
        ),
      )
      return
    }
    onChange([...valor, p])
  }

  return (
    <div className="space-y-2">
      {delExpediente.length ? (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            Intervinientes del expediente
          </p>
          <div className="flex flex-wrap gap-1.5">
            {delExpediente.map((i) => {
              const p: Participante = {
                nombre: i.nombre,
                clase: 'Externo',
                rol: i.rol,
                ...(i.contactoId ? { contactoId: i.contactoId } : {}),
              }
              const activo = seleccionado(p)
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => alternar(p)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    activo
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {i.nombre} · <span className="tracking-wide uppercase">{i.rol}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <PopoverTrigger isOpen={abiertoContacto} onOpenChange={setAbiertoContacto}>
          <Button type="button" size="sm" variant="outline">
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Añadir contacto
          </Button>
          <PopoverContent placement="bottom start" className="w-[22rem] p-0">
            <Command>
              <CommandInput placeholder="Buscar en contactos…" />
              <CommandList className="pointer-events-auto">
                <CommandEmpty>Sin coincidencias.</CommandEmpty>
                <CommandGroup heading="Contactos de LEX">
                  {CONTACTOS.map((c) => {
                    const nombre = nombreDeContacto(c.id)
                    return (
                      <CommandItem
                        key={c.id}
                        value={`${nombre} ${c.relacion ?? ''}`}
                        onSelect={() => {
                          alternar({ nombre, clase: 'Externo', rol: c.relacion, contactoId: c.id })
                          setAbiertoContacto(false)
                        }}
                      >
                        <Building2 className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                        <span className="truncate">{nombre}</span>
                        <span className="text-muted-foreground ml-auto text-[10px] uppercase">
                          {c.relacion}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                <CommandGroup>
                  <CommandItem value="crear contacto nuevo" asChild>
                    <Link to="/contactos/nuevo" onClick={() => setAbiertoContacto(false)}>
                      <UserPlus className="mr-2 h-3.5 w-3.5" /> Crear contacto
                    </Link>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </PopoverTrigger>

        <PopoverTrigger isOpen={abiertoCompanero} onOpenChange={setAbiertoCompanero}>
          <Button type="button" size="sm" variant="outline">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Añadir compañero
          </Button>
          <PopoverContent placement="bottom start" className="w-[20rem] p-0">
            <Command>
              <CommandInput placeholder="Buscar compañero…" />
              <CommandList className="pointer-events-auto">
                <CommandEmpty>Sin coincidencias.</CommandEmpty>
                <CommandGroup heading="Despacho">
                  {USUARIOS.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={`${u.nombre} ${u.rol}`}
                      onSelect={() => {
                        alternar({ nombre: u.nombre, clase: 'Interno', rol: u.rol })
                        setAbiertoCompanero(false)
                      }}
                    >
                      <span className="truncate">{u.nombre}</span>
                      <span className="text-muted-foreground ml-auto text-[10px] uppercase">
                        {u.rol}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </PopoverTrigger>
      </div>

      {valor.length ? (
        <div className="flex flex-wrap gap-1.5">
          {valor.map((p) => (
            <span
              key={`${p.contactoId ?? ''}${p.nombre}`}
              className="border-border bg-muted/50 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            >
              {p.nombre}
              <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                {p.clase === 'Interno' ? 'Despacho' : (p.rol ?? 'Externo')}
              </span>
              <button
                type="button"
                aria-label={`Quitar ${p.nombre}`}
                onClick={() => alternar(p)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-[11px]">
          Todavía no hay participantes seleccionados.
        </p>
      )}
    </div>
  )
}

/* ------------------------- Condiciones de la reunión ------------------- */

export function SelectorDuracion({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const estandar = (DURACIONES_REUNION as readonly string[]).includes(value)
  const [personalizada, setPersonalizada] = useState(!estandar && Boolean(value))
  return (
    <div className="space-y-1.5">
      <Select
        value={personalizada ? 'Personalizada' : value}
        onValueChange={(v) => {
          if (v === 'Personalizada') {
            setPersonalizada(true)
            return
          }
          setPersonalizada(false)
          onChange(v)
        }}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Duración" />
        </SelectTrigger>
        <SelectContent>
          {DURACIONES_REUNION.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
          <SelectItem value="Personalizada">Personalizada</SelectItem>
        </SelectContent>
      </Select>
      {personalizada ? (
        <Input
          className="h-9"
          inputMode="numeric"
          placeholder="Minutos"
          defaultValue={estandar ? '' : value.replace(/\D/g, '')}
          onChange={(e) =>
            onChange(e.target.value ? `${e.target.value.replace(/\D/g, '')} min` : '')
          }
        />
      ) : null}
    </div>
  )
}

export function SelectorPreferenciaFecha({
  value,
  fecha,
  onChange,
  onFecha,
}: {
  value: string
  fecha: string
  onChange: (v: string) => void
  onFecha: (v: string) => void
}) {
  const pideFecha = value === 'Antes de una fecha' || value === 'Fecha concreta preferente'
  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Preferencia" />
        </SelectTrigger>
        <SelectContent>
          {PREFERENCIAS_FECHA_REUNION.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pideFecha ? <SelectorFecha value={fecha} onChange={onFecha} /> : null}
    </div>
  )
}

export function SelectorFranja({
  value,
  onChange,
}: {
  value: FranjaReunion
  onChange: (v: FranjaReunion) => void
}) {
  return (
    <div className="border-border inline-flex rounded-md border p-0.5">
      {FRANJAS_REUNION.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={cn(
            'rounded-[4px] px-3 py-1.5 text-xs transition-colors',
            value === f
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {f}
        </button>
      ))}
    </div>
  )
}

export function SelectorLugar({
  value,
  direccion,
  onChange,
  onDireccion,
}: {
  value: string
  direccion: string
  onChange: (v: string) => void
  onDireccion: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Lugar / modalidad" />
        </SelectTrigger>
        <SelectContent>
          {LUGARES_REUNION.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === 'Fuera del despacho' ? (
        <Input
          className="h-9"
          value={direccion}
          onChange={(e) => onDireccion(e.target.value)}
          placeholder="Lugar / dirección"
        />
      ) : null}
    </div>
  )
}
