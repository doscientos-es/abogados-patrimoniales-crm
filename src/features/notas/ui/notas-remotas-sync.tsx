import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import type { ConversionNota, NotaInterna } from '@/data/notas'
import { sumarDias } from '@/data/pipeline'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  ahora,
  conectarNotasRemotas,
  getNotas,
  sincronizarNotasRemotas,
  type NotasRemotasApi,
  type NuevaNotaInput,
} from '@/lib/notas-store'

import {
  confirmarLecturaRemota,
  guardarNotaRemota,
  notaDesdeRemota,
  useNotasRemotas,
} from '../infrastructure/supabase-notas'

function crearNota(input: NuevaNotaInput, usuario: string): NotaInterna {
  return {
    id: '',
    ambito: input.ambito,
    contenido: input.contenido.trim(),
    origen: input.origen,
    contactos: input.contactos ?? [],
    ...(input.titulo?.trim() ? { titulo: input.titulo.trim() } : {}),
    ...(input.expedienteId ? { expedienteId: input.expedienteId } : {}),
    ...(input.oportunidadId ? { oportunidadId: input.oportunidadId } : {}),
    ...(input.ejecucionId ? { ejecucionId: input.ejecucionId } : {}),
    ...(input.presupuestoId ? { presupuestoId: input.presupuestoId } : {}),
    autor: usuario,
    creada: ahora(),
    estado: 'activa',
    destacada: input.destacada ?? false,
    critica: input.critica ?? false,
    requiereConfirmacion: input.requiereConfirmacion ?? false,
    confirmaciones: [],
    vigencia: input.vigencia ?? 'permanente',
    ...(input.desde ? { desde: input.desde } : {}),
    ...(input.revision ? { revision: input.revision } : {}),
    ...(input.vencimiento ? { vencimiento: input.vencimiento } : {}),
    alVencer: input.alVencer ?? 'archivar',
    pendienteRevision: false,
    disparadores: input.disparadores ?? [],
    visibilidad: input.visibilidad ?? 'equipo',
    autorizados: input.autorizados ?? [],
    conversiones: [],
    historial: [],
  }
}

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : 'No se ha podido guardar la nota interna.'
}

/** Mantiene los selectores de notas sincronizados con la fuente remota autorizada. */
export function NotasRemotasSync() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const userId = session.user?.id
  const queryClient = useQueryClient()
  const query = useNotasRemotas(firmId)

  const api = useMemo<NotasRemotasApi | null>(() => {
    if (!firmId || !userId) return null
    const guardar = async (
      id: string | null,
      nota: NotaInterna,
      evento: string,
      detalle?: string,
    ) => {
      try {
        await guardarNotaRemota({
          firmId,
          noteId: id,
          nota,
          evento,
          ...(detalle ? { detalle } : {}),
        })
        await queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] })
        return nota
      } catch (error) {
        toast.error(mensajeError(error))
        return null
      }
    }
    const existente = (id: string) => {
      const nota = getNotas().notas.find((item) => item.id === id)
      if (!nota) throw new Error('La nota ya no está disponible o no tienes permiso para verla.')
      return nota
    }
    const actualizar = (id: string, cambios: Partial<NotaInterna>, evento = 'Edición') => {
      const actual = existente(id)
      return guardar(id, { ...actual, ...cambios }, evento)
    }
    return {
      crear: (input) => guardar(null, crearNota(input, userId), 'Creación'),
      actualizar,
      destacar: (id, destacada) =>
        actualizar(id, { destacada }, destacada ? 'Destacada' : 'Sin destacar'),
      marcarCritica: (id, critica) =>
        actualizar(
          id,
          { critica },
          critica ? 'Marcada como advertencia crítica' : 'Retirada la advertencia crítica',
        ),
      requerirConfirmacion: (id, requiereConfirmacion) =>
        actualizar(
          id,
          { requiereConfirmacion },
          requiereConfirmacion
            ? 'Requiere confirmación de lectura'
            : 'Confirmación de lectura no requerida',
        ),
      confirmarLectura: async (id) => {
        try {
          await confirmarLecturaRemota(id)
          await queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] })
        } catch (error) {
          toast.error(mensajeError(error))
        }
      },
      cambiarVigencia: (id, valor) => {
        const cambios: Partial<NotaInterna> = { vigencia: valor.vigencia }
        if (valor.revision) cambios.revision = valor.revision
        if (valor.vigencia === 'temporal' && valor.vencimiento)
          cambios.vencimiento = valor.vencimiento
        if (valor.alVencer) cambios.alVencer = valor.alVencer
        return actualizar(id, cambios, 'Cambio de vigencia')
      },
      prorrogar: (id, vencimiento) =>
        actualizar(id, { vigencia: 'temporal', vencimiento }, 'Prórroga de vigencia'),
      marcarRevisada: (id) => actualizar(id, { pendienteRevision: false }, 'Marcada como revisada'),
      posponerAviso: (id, dias) =>
        actualizar(id, { posponerHasta: sumarDias(dias) }, 'Aviso pospuesto'),
      resolver: (id) =>
        actualizar(id, { estado: 'resuelta', pendienteRevision: false }, 'Resuelta'),
      archivar: (id) =>
        actualizar(id, { estado: 'archivada', pendienteRevision: false }, 'Archivada'),
      reactivar: (id) => actualizar(id, { estado: 'activa' }, 'Reactivada'),
      registrarConversion: (id, conversion) => {
        const actual = existente(id)
        const nueva: ConversionNota = { ...conversion, fecha: ahora(), usuario: userId }
        return guardar(
          id,
          { ...actual, conversiones: [...actual.conversiones, nueva] },
          'Conversión',
          `${conversion.tipo}: ${conversion.etiqueta}`,
        )
      },
    }
  }, [firmId, queryClient, userId])

  useEffect(() => {
    conectarNotasRemotas(api)
    return () => conectarNotasRemotas(null)
  }, [api])

  useEffect(() => {
    if (!userId) return
    sincronizarNotasRemotas((query.data ?? []).map(notaDesdeRemota), userId)
  }, [query.data, userId])

  return null
}
