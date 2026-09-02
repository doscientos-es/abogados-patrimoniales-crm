// Motor único de NOTAS INTERNAS de LEX.
// Persiste hoy en localStorage (mismo patrón que crm-store y expedientes-store)
// con una API desacoplada: sustituirlo por Lovable Cloud no exigirá tocar las
// pantallas. Todas las lecturas pasan por el filtro de permisos.
import { useSyncExternalStore } from 'react'

import { CONTACTOS } from '@/data/contactos'
import { SEMILLA_OPERATIVA } from '@/data/expedientes-model'
import {
  type AlVencer,
  type AmbitoNota,
  type ConversionNota,
  type DisparadorNota,
  type EstadoNota,
  type EventoNota,
  type NotaInterna,
  type OrigenNota,
  type TipoConversion,
  type VigenciaNota,
  type VisibilidadNota,
} from '@/data/notas'
import { HOY, hoyTexto, parseFecha, sumarDias } from '@/data/pipeline'

export type NotasState = {
  version: number
  usuario: string
  secuencia: number
  notas: NotaInterna[]
}

const STORAGE_KEY = 'patrimonial-suite-notas'
const VERSION = 1
const isBrowser = typeof document !== 'undefined'

/* ------------------------------------------------------------------ */
/* Utilidades de fecha                                                 */
/* ------------------------------------------------------------------ */

const hora = () => new Date().toTimeString().slice(0, 5)
export const ahora = () => `${hoyTexto()} ${hora()}`
export const soloFecha = (v: string | undefined) => (v ? v.slice(0, 10) : '')

/** Días que faltan hasta una fecha dd/mm/aaaa (negativo si ya pasó). */
export const diasHasta = (v: string | undefined) => {
  const d = parseFecha(v)
  if (!d) return null
  return Math.round((d.getTime() - HOY.getTime()) / 86400000)
}

const vencida = (n: NotaInterna) => {
  const d = diasHasta(n.vencimiento)
  return d !== null && d < 0
}

const revisionAlcanzada = (n: NotaInterna) => {
  const d = diasHasta(n.revision)
  return d !== null && d <= 0
}

/* ------------------------------------------------------------------ */
/* Semilla                                                             */
/* ------------------------------------------------------------------ */

function evento(accion: string, usuario: string, fecha: string, detalle?: string): EventoNota {
  return {
    id: `EV-${Math.random().toString(36).slice(2, 9)}`,
    fecha,
    usuario,
    accion,
    ...(detalle ? { detalle } : {}),
  }
}

function base(
  n: Partial<NotaInterna> & {
    id: string
    ambito: AmbitoNota
    contenido: string
    origen: OrigenNota
    autor: string
    creada: string
  },
): NotaInterna {
  return {
    contactos: [],
    estado: 'activa',
    destacada: false,
    critica: false,
    requiereConfirmacion: false,
    confirmaciones: [],
    vigencia: 'permanente',
    alVencer: 'archivar',
    pendienteRevision: false,
    disparadores: [],
    visibilidad: 'equipo',
    autorizados: [],
    conversiones: [],
    historial: [evento('Creación', n.autor, n.creada)],
    ...n,
  }
}

function semilla(): NotasState {
  const notas: NotaInterna[] = []
  let seq = 100

  // Notas de persona ya existentes en las fichas de contacto.
  for (const c of CONTACTOS) {
    const etiqueta = [c.nombre, c.apellidos].filter(Boolean).join(' ') || c.razonSocial || c.id
    for (const n of c.notas) {
      seq += 1
      notas.push(
        base({
          id: `NT-${seq}`,
          ambito: 'persona',
          titulo: n.titulo,
          contenido: n.contenido,
          origen: { tipo: 'persona', id: c.id, etiqueta },
          contactos: [c.id],
          autor: n.autor,
          creada: n.fecha,
          destacada: n.destacada,
          estado: n.archivada ? 'archivada' : 'activa',
        }),
      )
    }
  }

  // Notas de expediente sobre expedientes reales de la semilla operativa.
  const expedientes = SEMILLA_OPERATIVA().expedientes.slice(0, 3)
  const textos = [
    {
      titulo: 'Estrategia con la contraparte',
      contenido:
        'La contraparte parece dispuesta a negociar. No remitir todavía la propuesta económica hasta comentar la estrategia con Igor.',
      destacada: true,
    },
    {
      titulo: 'Sensibilidad del cliente',
      contenido:
        'Está especialmente preocupado por los costes: anticipar cualquier gasto extraordinario.',
      destacada: false,
    },
    {
      titulo: 'Confidencialidad familiar',
      contenido: 'No facilitar información al hermano sin consultarle previamente.',
      destacada: true,
    },
  ]
  expedientes.forEach((e, i) => {
    const t = textos[i]!
    seq += 1
    notas.push(
      base({
        id: `NT-${seq}`,
        ambito: 'expediente',
        titulo: t.titulo,
        contenido: t.contenido,
        origen: { tipo: 'expediente', id: e.id, etiqueta: `${e.codigo} · ${e.nombre}` },
        contactos: [e.contactoId],
        expedienteId: e.id,
        autor: e.responsable,
        creada: `${hoyTexto()} 09:15`,
        destacada: t.destacada,
        critica: i === 2,
        requiereConfirmacion: i === 2,
        disparadores: i === 2 ? (['abrir-expediente', 'antes-contactar'] as DisparadorNota[]) : [],
      }),
    )
  })

  return { version: VERSION, usuario: 'Ana Torregrosa', secuencia: seq, notas }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

// SSR must not eagerly build the demo seed: its cross-domain data imports can
// be split into circular server chunks. Browser hydration still receives the
// same local demo seed until this store is replaced by Supabase.
const semillaBase: NotasState = !isBrowser
  ? { version: VERSION, usuario: '', secuencia: 100, notas: [] }
  : semilla()
let estado: NotasState = semillaBase
let hidratado = false
const listeners = new Set<() => void>()

function leerAlmacen(): NotasState {
  if (!isBrowser) return semillaBase
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return semilla()
    const parsed = JSON.parse(raw) as NotasState
    if (parsed.version !== VERSION) return semilla()
    return parsed
  } catch {
    return semilla()
  }
}

function persistir() {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
  } catch {
    /* almacenamiento no disponible */
  }
}

function set(fn: (s: NotasState) => NotasState) {
  estado = fn(estado)
  persistir()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function nuevoId() {
  const n = estado.secuencia + 1
  estado = { ...estado, secuencia: n }
  return `NT-${n}`
}

function mapNota(id: string, fn: (n: NotaInterna) => NotaInterna) {
  set((s) => ({ ...s, notas: s.notas.map((n) => (n.id === id ? fn(n) : n)) }))
}

/** Añade un evento al historial y sella la modificación. */
function registrar(
  n: NotaInterna,
  accion: string,
  detalle?: string,
  usuario = estado.usuario,
): NotaInterna {
  return {
    ...n,
    modificada: ahora(),
    modificadaPor: usuario,
    historial: [evento(accion, usuario, ahora(), detalle), ...n.historial],
  }
}

/* ------------------------------------------------------------------ */
/* Automatismos temporales                                             */
/* ------------------------------------------------------------------ */

/** Aplica revisión y vencimiento. Nunca borra: archiva o deja pendiente. */
export function aplicarAutomatismos() {
  let cambios = 0
  const notas = estado.notas.map((n) => {
    if (n.estado === 'archivada') return n
    let out = n
    if (!out.pendienteRevision && out.revision && revisionAlcanzada(out)) {
      cambios += 1
      out = {
        ...out,
        pendienteRevision: true,
        historial: [
          evento('Revisión alcanzada', 'Sistema', ahora(), `Fecha de revisión ${out.revision}`),
          ...out.historial,
        ],
      }
    }
    if (out.estado === 'activa' && out.vigencia === 'temporal' && vencida(out)) {
      cambios += 1
      if (out.alVencer === 'archivar') {
        out = {
          ...out,
          estado: 'archivada',
          archivadaPor: 'Sistema',
          archivadaEl: ahora(),
          historial: [
            evento('Archivo automático', 'Sistema', ahora(), `Vencida el ${out.vencimiento}`),
            ...out.historial,
          ],
        }
      } else if (!out.pendienteRevision) {
        out = {
          ...out,
          pendienteRevision: true,
          historial: [
            evento(
              'Pendiente de confirmación',
              'Sistema',
              ahora(),
              `Vencida el ${out.vencimiento}`,
            ),
            ...out.historial,
          ],
        }
      }
    }
    return out
  })
  if (cambios) set((s) => ({ ...s, notas }))
}

if (isBrowser && !hidratado) {
  hidratado = true
  estado = leerAlmacen()
  aplicarAutomatismos()
  persistir()
}

export function useNotas<T>(selector: (s: NotasState) => T): T {
  const snap = useSyncExternalStore(
    subscribe,
    () => estado,
    () => semillaBase,
  )
  return selector(snap)
}

export const getNotas = () => estado

/* ------------------------------------------------------------------ */
/* Permisos                                                            */
/* ------------------------------------------------------------------ */

/** Una nota restringida no debe existir para quien no está autorizado. */
export function visiblePara(n: NotaInterna, usuario: string) {
  if (n.visibilidad === 'equipo') return true
  return n.autor === usuario || n.autorizados.includes(usuario)
}

export const notasVisibles = (s: NotasState) => s.notas.filter((n) => visiblePara(n, s.usuario))

/* ------------------------------------------------------------------ */
/* Selectores                                                          */
/* ------------------------------------------------------------------ */

/** Todas las notas relacionadas con un contacto, sin duplicar. */
export const notasDeContacto = (s: NotasState, contactoId: string) =>
  notasVisibles(s).filter(
    (n) =>
      n.contactos.includes(contactoId) || (n.ambito === 'persona' && n.origen.id === contactoId),
  )

export const notasDeExpediente = (s: NotasState, expedienteId: string) =>
  notasVisibles(s).filter(
    (n) =>
      n.expedienteId === expedienteId ||
      (n.ambito === 'expediente' && n.origen.id === expedienteId),
  )

export const notasDeOportunidad = (s: NotasState, oportunidadId: string) =>
  notasVisibles(s).filter(
    (n) =>
      n.oportunidadId === oportunidadId ||
      (n.ambito === 'oportunidad' && n.origen.id === oportunidadId),
  )

export const notasDeEjecucion = (s: NotasState, ejecucionId: string) =>
  notasVisibles(s).filter(
    (n) =>
      n.ejecucionId === ejecucionId || (n.ambito === 'ejecucion' && n.origen.id === ejecucionId),
  )

export const notaPorId = (s: NotasState, id: string) => {
  const n = s.notas.find((x) => x.id === id)
  return n && visiblePara(n, s.usuario) ? n : undefined
}

/** Notas que deben mostrarse como aviso contextual en un disparador dado. */
export function avisosContextuales(
  s: NotasState,
  disparador: DisparadorNota,
  ambito: { contactoId?: string; expedienteId?: string; oportunidadId?: string },
) {
  const candidatas = ambito.contactoId
    ? notasDeContacto(s, ambito.contactoId)
    : ambito.expedienteId
      ? notasDeExpediente(s, ambito.expedienteId)
      : ambito.oportunidadId
        ? notasDeOportunidad(s, ambito.oportunidadId)
        : notasVisibles(s)

  return candidatas.filter((n) => {
    if (n.estado === 'archivada') return false
    if (n.estado === 'resuelta') return false
    if (vencida(n) && !n.pendienteRevision) return false
    if (n.posponerHasta) {
      const d = diasHasta(n.posponerHasta)
      if (d !== null && d > 0) return false
    }
    return n.disparadores.includes(disparador) || n.disparadores.includes('siempre')
  })
}

export type ContadoresNotas = {
  destacadas: number
  criticas: number
  revisarHoy: number
  vencidasPendientes: number
  proximasVencer: number
}

export function contadores(s: NotasState): ContadoresNotas {
  const v = notasVisibles(s).filter((n) => n.estado !== 'archivada')
  const prox = v.filter((n) => {
    const d = diasHasta(n.vencimiento)
    return d !== null && d >= 0 && d <= 7
  })
  return {
    destacadas: v.filter((n) => n.destacada && n.estado === 'activa').length,
    criticas: v.filter((n) => n.critica && n.estado === 'activa').length,
    revisarHoy: v.filter((n) => n.pendienteRevision || (n.revision && revisionAlcanzada(n))).length,
    vencidasPendientes: v.filter((n) => vencida(n) && n.estado === 'activa').length,
    proximasVencer: prox.length,
  }
}

export const estaVencida = vencida
export const necesitaRevision = (n: NotaInterna) =>
  n.pendienteRevision || (!!n.revision && revisionAlcanzada(n))

/* ------------------------------------------------------------------ */
/* Acciones                                                            */
/* ------------------------------------------------------------------ */

export type NuevaNotaInput = {
  ambito: AmbitoNota
  contenido: string
  titulo?: string
  origen: OrigenNota
  contactos?: string[]
  expedienteId?: string
  oportunidadId?: string
  ejecucionId?: string
  presupuestoId?: string
  destacada?: boolean
  critica?: boolean
  requiereConfirmacion?: boolean
  vigencia?: VigenciaNota
  desde?: string
  revision?: string
  vencimiento?: string
  alVencer?: AlVencer
  disparadores?: DisparadorNota[]
  visibilidad?: VisibilidadNota
  autorizados?: string[]
  autor?: string
}

export const notas = {
  setUsuario(usuario: string) {
    set((s) => ({ ...s, usuario }))
  },

  crear(input: NuevaNotaInput) {
    const id = nuevoId()
    const autor = input.autor ?? estado.usuario
    const creada = ahora()
    const nota: NotaInterna = base({
      id,
      ambito: input.ambito,
      contenido: input.contenido.trim(),
      origen: input.origen,
      autor,
      creada,
      contactos: input.contactos ?? [],
      ...(input.titulo?.trim() ? { titulo: input.titulo.trim() } : {}),
      ...(input.expedienteId ? { expedienteId: input.expedienteId } : {}),
      ...(input.oportunidadId ? { oportunidadId: input.oportunidadId } : {}),
      ...(input.ejecucionId ? { ejecucionId: input.ejecucionId } : {}),
      ...(input.presupuestoId ? { presupuestoId: input.presupuestoId } : {}),
      destacada: input.destacada ?? false,
      critica: input.critica ?? false,
      requiereConfirmacion: input.requiereConfirmacion ?? false,
      vigencia: input.vigencia ?? 'permanente',
      ...(input.desde ? { desde: input.desde } : {}),
      ...(input.revision ? { revision: input.revision } : {}),
      ...(input.vencimiento ? { vencimiento: input.vencimiento } : {}),
      alVencer: input.alVencer ?? 'archivar',
      disparadores: input.disparadores ?? [],
      visibilidad: input.visibilidad ?? 'equipo',
      autorizados: input.autorizados ?? [],
    })
    set((s) => ({ ...s, notas: [nota, ...s.notas] }))
    return nota
  },

  actualizar(id: string, cambios: Partial<NuevaNotaInput>) {
    mapNota(id, (n) => {
      const detalles: string[] = []
      if (cambios.contenido !== undefined && cambios.contenido !== n.contenido)
        detalles.push('contenido')
      if (cambios.titulo !== undefined && cambios.titulo !== n.titulo) detalles.push('título')
      if (cambios.ambito && cambios.ambito !== n.ambito) detalles.push(`tipo → ${cambios.ambito}`)
      if (cambios.visibilidad && cambios.visibilidad !== n.visibilidad) detalles.push('permisos')
      if (cambios.vencimiento !== undefined || cambios.revision !== undefined || cambios.vigencia)
        detalles.push('vigencia')
      const limpio = Object.fromEntries(
        Object.entries(cambios).filter(([, v]) => v !== undefined),
      ) as Partial<NotaInterna>
      return registrar({ ...n, ...limpio }, 'Edición', detalles.join(', ') || undefined)
    })
  },

  destacar(id: string, valor: boolean) {
    mapNota(id, (n) => registrar({ ...n, destacada: valor }, valor ? 'Destacada' : 'Sin destacar'))
  },

  marcarCritica(id: string, valor: boolean) {
    mapNota(id, (n) =>
      registrar(
        { ...n, critica: valor },
        valor ? 'Marcada como advertencia crítica' : 'Retirada la advertencia crítica',
      ),
    )
  },

  requerirConfirmacion(id: string, valor: boolean) {
    mapNota(id, (n) =>
      registrar(
        { ...n, requiereConfirmacion: valor, ...(valor ? { confirmaciones: [] } : {}) },
        valor ? 'Requiere confirmación de lectura' : 'Confirmación de lectura no requerida',
      ),
    )
  },

  confirmarLectura(id: string) {
    mapNota(id, (n) =>
      n.confirmaciones.some((c) => c.usuario === estado.usuario)
        ? n
        : registrar(
            {
              ...n,
              confirmaciones: [...n.confirmaciones, { usuario: estado.usuario, fecha: ahora() }],
            },
            'Confirmación de lectura',
          ),
    )
  },

  cambiarVigencia(
    id: string,
    v: { vigencia: VigenciaNota; revision?: string; vencimiento?: string; alVencer?: AlVencer },
  ) {
    mapNota(id, (n) => {
      const out: NotaInterna = {
        ...n,
        vigencia: v.vigencia,
        alVencer: v.alVencer ?? n.alVencer,
      }
      if (v.vigencia === 'permanente') {
        delete out.vencimiento
      } else if (v.vencimiento) {
        out.vencimiento = v.vencimiento
      }
      if (v.revision) out.revision = v.revision
      else delete out.revision
      return registrar(
        out,
        'Cambio de vigencia',
        v.vigencia === 'temporal' ? `Hasta ${out.vencimiento ?? '—'}` : 'Permanente',
      )
    })
  },

  prorrogar(id: string, nuevoVencimiento: string) {
    mapNota(id, (n) =>
      registrar(
        {
          ...n,
          vigencia: 'temporal',
          vencimiento: nuevoVencimiento,
          estado: n.estado === 'archivada' ? 'activa' : n.estado,
          pendienteRevision: false,
        },
        'Prórroga de vigencia',
        `Nueva fecha: ${nuevoVencimiento}`,
      ),
    )
  },

  marcarRevisada(id: string) {
    mapNota(id, (n) => registrar({ ...n, pendienteRevision: false }, 'Marcada como revisada'))
  },

  posponerAviso(id: string, dias: number) {
    mapNota(id, (n) =>
      registrar({ ...n, posponerHasta: sumarDias(dias) }, 'Aviso pospuesto', `${dias} día(s)`),
    )
  },

  resolver(id: string) {
    mapNota(id, (n) =>
      registrar(
        {
          ...n,
          estado: 'resuelta' as EstadoNota,
          resueltaPor: estado.usuario,
          resueltaEl: ahora(),
          pendienteRevision: false,
        },
        'Resuelta',
      ),
    )
  },

  archivar(id: string) {
    mapNota(id, (n) =>
      registrar(
        {
          ...n,
          estado: 'archivada' as EstadoNota,
          archivadaPor: estado.usuario,
          archivadaEl: ahora(),
          pendienteRevision: false,
        },
        'Archivada',
      ),
    )
  },

  reactivar(id: string) {
    mapNota(id, (n) => {
      const out: NotaInterna = { ...n, estado: 'activa' }
      delete out.archivadaEl
      delete out.archivadaPor
      delete out.resueltaEl
      delete out.resueltaPor
      return registrar(out, 'Reactivada')
    })
  },

  registrarConversion(id: string, c: Omit<ConversionNota, 'fecha' | 'usuario'>) {
    mapNota(id, (n) =>
      registrar(
        {
          ...n,
          conversiones: [
            ...n.conversiones,
            { ...c, fecha: ahora(), usuario: estado.usuario } satisfies ConversionNota,
          ],
        },
        'Conversión',
        `${c.tipo}: ${c.etiqueta}`,
      ),
    )
  },

  /** Guarda un lote de borradores (alta de contacto) una vez existe el contacto. */
  guardarBorradores(contactoId: string, etiqueta: string, borradores: NuevaNotaInput[]) {
    const creadas: NotaInterna[] = []
    for (const b of borradores) {
      if (!b.contenido.trim()) continue
      creadas.push(
        this.crear({
          ...b,
          ambito: 'persona',
          origen: { tipo: 'persona', id: contactoId, etiqueta },
          contactos: [contactoId],
        }),
      )
    }
    return creadas
  },
}

export const conversionActiva = (n: NotaInterna, tipo: TipoConversion) =>
  n.conversiones.some((c) => c.tipo === tipo)
