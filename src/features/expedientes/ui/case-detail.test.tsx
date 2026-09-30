import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params: _params,
    search: _search,
    children,
    ...props
  }: {
    to: string
    params?: unknown
    search?: unknown
    children?: ReactNode
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

import { CaseDetail } from './case-detail'

const expediente = {
  id: 'case-1',
  referencia: 'AP_11',
  contactoPrincipalId: 'contact-1',
  oportunidadId: null,
  titulo: 'Compraventa de local comercial',
  area: 'Inmobiliario',
  tipoAsunto: 'Inmobiliario',
  naturaleza: 'Extrajudicial',
  estadoGeneral: 'En curso',
  fase: 'Diagnóstico – Objetivos – Estrategia',
  estadoOperativo: 'pending',
  prioridad: 'Alta',
  asignadoId: 'member-1',
  fechaApertura: '2026-08-05',
  fechaCierre: null,
  proximaAccion: 'Firma de hoja de encargo',
  dondeEstamos: 'Cerrar due diligence.',
  version: 1,
  actualizadoEn: '2026-08-07T09:15:00Z',
} as never

function renderDetail(
  onCreateTask = vi.fn().mockResolvedValue(undefined),
  notas = [] as never[],
  eventos = [] as never[],
  onSetNextAction = vi.fn().mockResolvedValue(undefined),
  canManageNextAction = () => true,
  onUpdateWorkstream = vi.fn().mockResolvedValue(undefined),
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CaseDetail
        expediente={expediente}
        lineas={
          [{
            id: 'line-1',
            expedienteId: 'case-1',
            parentId: null,
            titulo: 'Due diligence',
            tipo: 'Análisis jurídico',
            descripcion: 'Revisión de la operación',
            estado: 'En curso',
            prioridad: 'Alta',
            asignadoId: 'member-1',
            fechaInicio: '2026-08-05',
            fechaObjetivo: '2026-09-05',
            fechaResolucion: null,
            fechaCierre: null,
            orden: 0,
            details: { colaboradores: [], customField: 'conservar' },
            version: 2,
          }] as never
        }
        actuaciones={
          [
            {
              id: 'activity-1',
              expedienteId: 'case-1',
              titulo: 'Revisión inicial',
              tipo: 'Análisis',
              ocurridaEn: '2026-08-07T09:15:00Z',
              relevancia: 'activity',
            },
          ] as never
        }
        participantes={
          [
            {
              id: 'participant-1',
              nombre: 'Inversiones Torrelodones',
              rol: 'Cliente',
              confidencialidad: 'Normal',
            },
          ] as never
        }
        eventos={eventos}
        documentos={
          [
            {
              id: 'doc-1',
              original_name: 'Escritura.pdf',
              category: 'Escrituras',
              version: 1,
              confidentiality: 'normal',
              updated_at: '2026-08-07T09:15:00Z',
            },
          ] as never
        }
        tareas={
          [
            {
              id: 'task-1',
              expedienteId: 'case-1',
              lineaId: 'line-1',
              titulo: 'Preparar firma',
              creadaPorId: 'member-1',
              tipo: 'Tarea',
              estado: 'Pendiente',
              esSiguienteAccion: true,
              prioridad: 'Alta',
              venceEn: '2026-08-10T09:00:00Z',
              version: 1,
            },
          ] as never
        }
        miembros={[{ id: 'member-1', nombre: 'Luis Ferrán' }] as never}
        clienteNombre="Inversiones Torrelodones, S.L."
        taskPending={false}
        onCreateTask={onCreateTask}
        onSetNextAction={onSetNextAction}
        onUpdateWorkstream={onUpdateWorkstream}
        canManageNextAction={canManageNextAction}
        nextActionPending={false}
        editor={<div>Editor del expediente</div>}
        notas={notas}
        relatedForms={{
          participant: <div>Alta de interviniente</div>,
          workstream: <div>Nueva línea</div>,
        }}
      />
    </QueryClientProvider>,
  )
}

describe('CaseDetail', () => {
  afterEach(cleanup)

  it('opens each operational feature using data linked to the expediente', () => {
    renderDetail()
    expect(screen.getByText('Preparar firma')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /documentos\s*1/i }))
    expect(screen.getByText('Escritura.pdf')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir gestor documental' }).getAttribute('href')).toBe(
      '/documentos',
    )

    fireEvent.click(screen.getByRole('tab', { name: /líneas de trabajo\s*1/i }))
    expect(screen.getByText('Due diligence')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Preparar firma' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Abrir siguiente acción: Preparar firma' }),
    ).toBeTruthy()
    expect(
      screen.getByText(/Frentes autónomos con objetivo, responsable y resultado propios/i),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /vista mapa/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /vista tarjetas/i })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Orden de líneas' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Estado de línea' })).toBeTruthy()
    expect(screen.getByText('Nueva línea')).toBeTruthy()

    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridad de línea' }), {
      target: { value: 'Baja' },
    })
    expect(screen.getByText('Ninguna línea coincide con los filtros aplicados.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Restablecer filtros' })).toBeTruthy()
  })

  it('shows active internal notes linked to the expediente below the header', () => {
    renderDetail(undefined, [
      {
        id: 'note-1',
        scope: 'case',
        case_id: 'case-1',
        status: 'active',
        title: 'Confidencialidad familiar',
        content: 'No facilitar información a familiares sin autorización.',
        critical: true,
        requires_acknowledgement: true,
        created_at: '2026-08-05T09:15:00Z',
        created_by: 'member-1',
        actorNames: { 'member-1': 'Marta Solé' },
      },
    ] as never)

    expect(screen.getByText(/Notas internas del expediente a tener en cuenta \(1\)/)).toBeTruthy()
    expect(screen.getByText('Confidencialidad familiar')).toBeTruthy()
    expect(screen.getByText('Requiere confirmación')).toBeTruthy()
  })

  it('shows the actor in the expediente history', () => {
    renderDetail(undefined, [], [
      {
        id: 'event-1',
        entidad: 'case',
        accion: 'updated',
        campos: ['title'],
        actorId: 'member-1',
        creadoEn: '2026-08-07T09:15:00Z',
      },
    ] as never)

    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(screen.getByText(/Por Luis Ferrán/)).toBeTruthy()
  })

  it('opens the edit form in a dialog from the operational header', () => {
    renderDetail()
    expect(screen.queryByText('Editor del expediente')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Editar expediente' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Editor del expediente')).toBeTruthy()
  })

  it('creates a task associated with the displayed expediente', () => {
    const onCreateTask = vi.fn().mockResolvedValue(undefined)
    renderDetail(onCreateTask)
    fireEvent.click(screen.getByRole('tab', { name: /tareas\s*1/i }))
    expect(screen.queryByLabelText('Título de tarea')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir tarea' }))
    expect(screen.getByRole('dialog', { name: 'Nueva tarea para el expediente' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Título de tarea'), {
      target: { value: 'Enviar borrador' },
    })
    const form = screen.getByRole('dialog').querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta de tarea.')
    fireEvent.submit(form)

    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ expedienteId: 'case-1', titulo: 'Enviar borrador' }),
    )
  })

  it('creates a task from a workstream and persists its line context', () => {
    const onCreateTask = vi.fn().mockResolvedValue(undefined)
    renderDetail(onCreateTask)
    fireEvent.click(screen.getByRole('tab', { name: /líneas de trabajo\s*1/i }))
    expect(screen.queryByLabelText('Nueva tarea para Due diligence')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir tarea' }))
    expect(screen.getByRole('dialog', { name: 'Nueva tarea para la línea' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nueva tarea para Due diligence'), {
      target: { value: 'Revisar cargas registrales' },
    })
    const form = screen.getByRole('dialog').querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de tarea de la línea.')
    fireEvent.submit(form)

    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        expedienteId: 'case-1',
        lineaId: 'line-1',
        titulo: 'Revisar cargas registrales',
      }),
    )
  })

  it('opens the expanded workstream file and saves strategy details with the line', async () => {
    const onUpdateWorkstream = vi.fn().mockResolvedValue(undefined)
    renderDetail(undefined, [], [], undefined, undefined, onUpdateWorkstream)
    fireEvent.click(screen.getByRole('tab', { name: /líneas de trabajo\s*1/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir línea: Due diligence' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Estrategia' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Due diligence legal' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Estrategia' }))
    fireEvent.change(screen.getByLabelText('Tesis o enfoque jurídico'), {
      target: { value: 'Priorizar el análisis de cargas.' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    })

    await expect.poll(() => onUpdateWorkstream.mock.calls.length).toBe(1)
    expect(onUpdateWorkstream).toHaveBeenCalledWith(expect.objectContaining({
      id: 'line-1',
      expedienteId: 'case-1',
      versionEsperada: 2,
      titulo: 'Due diligence legal',
      estado: 'in_progress',
      details: expect.objectContaining({
        tesis: 'Priorizar el análisis de cargas.',
        customField: 'conservar',
      }),
    }))
  })

  it('marks and unmarks the next action from its workstream', async () => {
    const onSetNextAction = vi.fn().mockResolvedValue(undefined)
    renderDetail(undefined, [], [], onSetNextAction)
    fireEvent.click(screen.getByRole('tab', { name: /líneas de trabajo\s*1/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Quitar siguiente acción: Preparar firma' }))
    await expect.poll(() => onSetNextAction.mock.calls.length).toBe(1)
    expect(onSetNextAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }), false)
  })
})
