import { useMemo } from 'react'

import { contarNotas, filtrarNotas, type FiltroNotas } from '../application/note-filters'
import type { ConversionNota, NotaInterna } from '../application/note-types'
import {
  notaDesdeRemota,
  useActualizarEstadoNota,
  useConfirmarLectura,
  useGuardarNota,
  useNotasRemotas,
  type GuardarNotaInput,
} from './supabase-notas'

/** Fachada de notas persistida íntegramente en Supabase; no usa estado local efímero. */
export function useNotasStore(firmId: string | undefined, userId?: string) {
  const remote = useNotasRemotas(firmId)
  const save = useGuardarNota(firmId)
  const updateState = useActualizarEstadoNota(firmId)
  const acknowledge = useConfirmarLectura(firmId)
  const notes = useMemo<NotaInterna[]>(
    () => (remote.data ?? []).map(notaDesdeRemota),
    [remote.data],
  )
  const counts = useMemo(() => contarNotas(notes, userId), [notes, userId])
  const findNote = (noteId: string) => notes.find((note) => note.id === noteId)

  return {
    notas: notes,
    contadores: counts,
    cargando: remote.isPending,
    error: remote.error,
    guardando: save.isPending || updateState.isPending || acknowledge.isPending,
    filtrar: (filter: FiltroNotas) => filtrarNotas(notes, filter, userId),
    crearNota: (input: Omit<GuardarNotaInput, 'noteId'>) => save.mutateAsync(input),
    editarNota: (noteId: string, input: Omit<GuardarNotaInput, 'noteId'>) =>
      save.mutateAsync({ ...input, noteId }),
    archivarNota: (noteId: string) =>
      updateState.mutateAsync({ noteId, status: 'archived', eventType: 'archived' }),
    resolverNota: (noteId: string) =>
      updateState.mutateAsync({ noteId, status: 'resolved', eventType: 'resolved' }),
    toggleDestacada: (noteId: string) =>
      updateState.mutateAsync({
        noteId,
        highlighted: !findNote(noteId)?.destacada,
        eventType: 'highlighted',
      }),
    toggleCritica: (noteId: string) =>
      updateState.mutateAsync({
        noteId,
        critical: !findNote(noteId)?.critica,
        eventType: 'critical',
      }),
    confirmarLectura: (noteId: string) => acknowledge.mutateAsync(noteId),
    posponerNota: (noteId: string, hasta: string) =>
      updateState.mutateAsync({ noteId, snoozedUntil: hasta, eventType: 'snoozed' }),
    registrarConversion: (noteId: string, conversion: ConversionNota) =>
      updateState.mutateAsync({ noteId, conversion, eventType: 'converted' }),
  }
}
