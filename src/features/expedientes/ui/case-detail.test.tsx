import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
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
) {
  return render(
    <CaseDetail
      expediente={expediente}
      lineas={
        [{ id: 'line-1', titulo: 'Due diligence', estado: 'En curso', prioridad: 'Alta' }] as never
      }
      actuaciones={
        [
          {
            id: 'activity-1',
            expedienteId: 'case-1',
            titulo: 'Revisión inicial',
            tipo: 'Análisis',
            ocurridaEn: '2026-08-07T09:15:00Z',
            horas: 2,
            facturable: true,
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
            titulo: 'Preparar firma',
            tipo: 'Tarea',
            estado: 'Pendiente',
            prioridad: 'Alta',
            venceEn: '2026-08-10T09:00:00Z',
          },
        ] as never
      }
      miembros={[{ id: 'member-1', nombre: 'Luis Ferrán' }] as never}
      clienteNombre="Inversiones Torrelodones, S.L."
      taskPending={false}
      onCreateTask={onCreateTask}
      editor={<div>Editor del expediente</div>}
      notas={notas}
      relatedForms={{
        participant: <div>Alta de interviniente</div>,
        workstream: <div>Nueva línea</div>,
        activity: <div>Registrar actuación</div>,
      }}
    />,
  )
}

describe('CaseDetail', () => {
  afterEach(cleanup)

  it('opens each operational feature using data linked to the expediente', () => {
    renderDetail()
    expect(screen.getAllByText('Firma de hoja de encargo')).toHaveLength(2)

    fireEvent.click(screen.getByRole('tab', { name: /documentos\s*1/i }))
    expect(screen.getByText('Escritura.pdf')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir gestor documental' }).getAttribute('href')).toBe(
      '/documentos',
    )

    fireEvent.click(screen.getByRole('tab', { name: /líneas de trabajo\s*1/i }))
    expect(screen.getByText('Due diligence')).toBeTruthy()
    expect(
      screen.getByText(/Frentes autónomos del expediente: cada uno con objetivo propio/i),
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
    fireEvent.change(screen.getByLabelText('Título de tarea'), {
      target: { value: 'Enviar borrador' },
    })
    const form = screen.getByRole('button', { name: 'Añadir tarea' }).closest('form')
    if (!form) throw new Error('No se encontró el formulario de alta de tarea.')
    fireEvent.submit(form)

    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ expedienteId: 'case-1', titulo: 'Enviar borrador' }),
    )
  })
})
