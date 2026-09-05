// Estado de presentación de NOTAS INTERNAS de LEX.
// Los datos operativos se cargan y escriben en Supabase. Este módulo sólo
// conserva una instantánea en memoria para que los selectores existentes sigan
// siendo reutilizables entre las distintas pantallas.
import { useSyncExternalStore } from 'react'

import {
  type AlVencer,
  type AmbitoNota,
  type ConversionNota,
  type DisparadorNota,
  type NotaInterna,
  type OrigenNota,
  type TipoConversion,
  type VigenciaNota,
  type VisibilidadNota,
} from '@/data/notas'
import { HOY, hoyTexto, parseFecha } from '@/data/pipeline'

export type NotasState = {
  version: number
  usuario: string
  secuencia: number
  notas: NotaInterna[]
}

const VERSION = 1

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
/* Store                                                               */
/* ------------------------------------------------------------------ */

const semillaBase: NotasState = { version: VERSION, usuario: '', secuencia: 0, notas: [] }
let estado: NotasState = semillaBase
const listeners = new Set<() => void>()

function set(fn: (s: NotasState) => NotasState) {
  estado = fn(estado)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Reemplaza la instantánea en memoria con la lectura autorizada de Supabase. */
export function sincronizarNotasRemotas(notas: NotaInterna[], usuario: string) {
  set((s) => ({ ...s, usuario, secuencia: notas.length, notas }))
}

/* ------------------------------------------------------------------ */
/* Automatismos temporales                                             */
/* ------------------------------------------------------------------ */

/** Aplica revisión y vencimiento. Nunca borra: archiva o deja pendiente. */
export function aplicarAutomatismos() {
  // La aplicación de vencimientos se realiza en el backend al guardar una nota.
  // No se modifican datos jurídicos localmente al abrir una pantalla.
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

export type NotasRemotasApi = {
  crear: (input: NuevaNotaInput) => Promise<NotaInterna | null>
  actualizar: (id: string, cambios: Partial<NotaInterna>) => Promise<NotaInterna | null>
  destacar: (id: string, valor: boolean) => Promise<NotaInterna | null>
  marcarCritica: (id: string, valor: boolean) => Promise<NotaInterna | null>
  requerirConfirmacion: (id: string, valor: boolean) => Promise<NotaInterna | null>
  confirmarLectura: (id: string) => Promise<void>
  cambiarVigencia: (
    id: string,
    valor: { vigencia: VigenciaNota; revision?: string; vencimiento?: string; alVencer?: AlVencer },
  ) => Promise<NotaInterna | null>
  prorrogar: (id: string, vencimiento: string) => Promise<NotaInterna | null>
  marcarRevisada: (id: string) => Promise<NotaInterna | null>
  posponerAviso: (id: string, dias: number) => Promise<NotaInterna | null>
  resolver: (id: string) => Promise<NotaInterna | null>
  archivar: (id: string) => Promise<NotaInterna | null>
  reactivar: (id: string) => Promise<NotaInterna | null>
  registrarConversion: (
    id: string,
    conversion: Omit<ConversionNota, 'fecha' | 'usuario'>,
  ) => Promise<NotaInterna | null>
}

let apiRemota: NotasRemotasApi | null = null

/** Conecta las acciones visibles de la UI con las mutaciones persistentes. */
export function conectarNotasRemotas(api: NotasRemotasApi | null) {
  apiRemota = api
}

function api(): NotasRemotasApi {
  if (!apiRemota) throw new Error('Las notas internas no están listas para guardarse.')
  return apiRemota
}

export const notas = {
  setUsuario(usuario: string) {
    set((s) => ({ ...s, usuario }))
  },

  crear(input: NuevaNotaInput) {
    return api().crear(input)
  },

  actualizar(id: string, cambios: Partial<NotaInterna>) {
    return api().actualizar(id, cambios)
  },

  destacar(id: string, valor: boolean) {
    return api().destacar(id, valor)
  },

  marcarCritica(id: string, valor: boolean) {
    return api().marcarCritica(id, valor)
  },

  requerirConfirmacion(id: string, valor: boolean) {
    return api().requerirConfirmacion(id, valor)
  },

  confirmarLectura(id: string) {
    return api().confirmarLectura(id)
  },

  cambiarVigencia(
    id: string,
    v: { vigencia: VigenciaNota; revision?: string; vencimiento?: string; alVencer?: AlVencer },
  ) {
    return api().cambiarVigencia(id, v)
  },

  prorrogar(id: string, nuevoVencimiento: string) {
    return api().prorrogar(id, nuevoVencimiento)
  },

  marcarRevisada(id: string) {
    return api().marcarRevisada(id)
  },

  posponerAviso(id: string, dias: number) {
    return api().posponerAviso(id, dias)
  },

  resolver(id: string) {
    return api().resolver(id)
  },

  archivar(id: string) {
    return api().archivar(id)
  },

  reactivar(id: string) {
    return api().reactivar(id)
  },

  registrarConversion(id: string, c: Omit<ConversionNota, 'fecha' | 'usuario'>) {
    return api().registrarConversion(id, c)
  },

  /** Guarda un lote de borradores (alta de contacto) una vez existe el contacto. */
  guardarBorradores(contactoId: string, etiqueta: string, borradores: NuevaNotaInput[]) {
    return Promise.all(
      borradores
        .filter((b) => b.contenido.trim())
        .map((b) =>
          this.crear({
            ...b,
            ambito: 'persona',
            origen: { tipo: 'persona', id: contactoId, etiqueta },
            contactos: [contactoId],
          }),
        ),
    )
  },
}

export const conversionActiva = (n: NotaInterna, tipo: TipoConversion) =>
  n.conversiones.some((c) => c.tipo === tipo)
