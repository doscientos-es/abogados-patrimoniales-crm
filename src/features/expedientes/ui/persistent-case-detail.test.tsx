import { fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    params: _params,
    search: _search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

import { PersistentCaseDetail } from './persistent-case-detail'

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

function renderDetail(onCreateTask = vi.fn().mockResolvedValue(undefined)) {
  return render(
    <PersistentCaseDetail
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
      eventos={[]}
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
      relatedForms={{
        participant: <div>Alta de interviniente</div>,
        workstream: <div>Nueva línea</div>,
        activity: <div>Registrar actuación</div>,
      }}
    />,
  )
}

describe('PersistentCaseDetail', () => {
  it('opens each operational feature using data linked to the expediente', () => {
    renderDetail()
    expect(screen.getByText('Firma de hoja de encargo')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /documentos 1/i }))
    expect(screen.getByText('Escritura.pdf')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir gestor documental' }).getAttribute('href')).toBe(
      '/documentos',
    )

    fireEvent.click(screen.getByRole('tab', { name: /líneas de trabajo 1/i }))
    expect(screen.getByText('Due diligence')).toBeTruthy()
    expect(screen.getByText('Nueva línea')).toBeTruthy()
  })

  it('creates a task associated with the displayed expediente', () => {
    const onCreateTask = vi.fn().mockResolvedValue(undefined)
    renderDetail(onCreateTask)
    fireEvent.click(screen.getByRole('tab', { name: /tareas 1/i }))
    fireEvent.change(screen.getByLabelText('Título de tarea'), {
      target: { value: 'Enviar borrador' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Añadir tarea' }).closest('form')!)

    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ expedienteId: 'case-1', titulo: 'Enviar borrador' }),
    )
  })
})
