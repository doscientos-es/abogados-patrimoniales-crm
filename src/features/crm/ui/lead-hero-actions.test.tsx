import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LeadCommunicationDialogs } from '@/features/crm/ui/lead-communication-dialogs'
import {
  LeadNoteForm,
  LeadHistoryTimeline,
  LeadTaskCreateDialog,
  LeadTasksTable,
  QualificationQuestions,
} from '@/features/crm/ui/lead-workspace'
import {
  LeadContactOverview,
  LeadDetailTabs,
  LeadHeroActions,
  LeadSummary,
} from '@/routes/oportunidades.$id'

afterEach(cleanup)

describe('LeadHeroActions', () => {
  it('links the active Lead to its edit form, task form and stage transition', () => {
    const onSelectTab = vi.fn()
    render(<LeadHeroActions stage="entry" onSelectTab={onSelectTab} />)

    expect(screen.getByRole('link', { name: /editar lead/i }).getAttribute('href')).toBe(
      '#lead-edit-details',
    )
    expect(screen.getByRole('link', { name: /añadir tarea/i }).getAttribute('href')).toBe(
      '#lead-new-task',
    )
    expect(screen.getByRole('link', { name: /avanzar de fase/i }).getAttribute('href')).toBe(
      '#lead-stage-transition',
    )
    fireEvent.click(screen.getByRole('link', { name: /editar lead/i }))
    expect(onSelectTab).toHaveBeenCalledWith('contact')
    fireEvent.click(screen.getByRole('link', { name: /añadir tarea/i }))
    expect(onSelectTab).toHaveBeenCalledWith('tasks')
    fireEvent.click(screen.getByRole('link', { name: /avanzar de fase/i }))
    expect(onSelectTab).toHaveBeenLastCalledWith('acceptance')
  })

  it('hides the advance action when the Lead is in a terminal stage', () => {
    render(<LeadHeroActions stage="won" onSelectTab={() => undefined} />)

    expect(screen.getByRole('link', { name: /añadir tarea/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /avanzar de fase/i })).toBeNull()
  })

  it('selects the requested detail tab with the correct accessibility state', () => {
    const onSelectTab = vi.fn()
    render(<LeadDetailTabs activeTab="summary" onSelectTab={onSelectTab} />)

    expect(screen.getAllByRole('tab')).toHaveLength(8)
    expect(screen.getByRole('tab', { name: 'Resumen' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Contacto' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Tareas' }))
    expect(onSelectTab).toHaveBeenCalledWith('tasks')
  })

  it('shows the initial action and commercial milestones when none are registered', () => {
    render(
      <LeadSummary
        opportunity={
          {
            id: 'lead-1',
            referencia: 'OP-0001',
            contactoId: 'contact-1',
            titulo: 'Planificación patrimonial',
            area: 'Sucesiones',
            fase: 'qualification',
            subestado: 'Pendiente',
            prioridad: 'Media',
            estadoOperativo: 'En revisión',
            origen: 'Recomendación de colaborador',
            creada: new Date().toISOString(),
            actualizada: new Date().toISOString(),
            asignadoId: 'member-1',
            descripcion: '',
            valorEstimado: null,
            probabilidad: 0,
            fechaObjetivo: null,
            archivadoEn: null,
            motivoArchivo: null,
            detalles: {},
            version: 1,
          } as never
        }
        memberName="Ana Torregrosa"
        tasks={[]}
        tasksLoading={false}
        onSelectTab={() => undefined}
      />,
    )

    expect(screen.getByText('Ana Torregrosa')).toBeTruthy()
    expect(screen.getByText('Recomendación de colaborador')).toBeTruthy()
    expect(screen.getByText('Sin siguiente acción')).toBeTruthy()
    expect(screen.getByText('Definir siguiente acción')).toBeTruthy()
    expect(screen.getByText('Sin programar')).toBeTruthy()
    expect(screen.getByText('No solicitado')).toBeTruthy()
    expect(screen.getByText('Sin aceptación')).toBeTruthy()
  })

  it('shows the contact, initial information and empty participant state', () => {
    render(
      <LeadContactOverview
        opportunity={
          {
            creada: new Date().toISOString(),
            origen: 'Recomendación de colaborador',
            detalles: {
              rolContacto: { rol: '' },
              informacionInicial: { queHaOcurrido: 'División de cosa común.' },
            },
          } as never
        }
        contact={{ nombre: 'Ramón', apellidos: 'Iglesias Peña' } as never}
        contactLoading={false}
      />,
    )

    expect(screen.getByText('Ramón Iglesias Peña')).toBeTruthy()
    expect(screen.getByText('Rol en el Lead')).toBeTruthy()
    expect(screen.getAllByText('Sin indicar')).toHaveLength(2)
    expect(screen.getByText('No hay otros intervinientes vinculados a este Lead.')).toBeTruthy()
    expect(screen.getByText('División de cosa común.')).toBeTruthy()
    expect(screen.getAllByText('—')).toHaveLength(3)
  })

  it('presents accessible qualification questions and suggested additions', () => {
    const onAddQuestion = vi.fn()
    render(
      <QualificationQuestions
        questions={[]}
        newQuestion=""
        onNewQuestionChange={() => undefined}
        onAddQuestion={onAddQuestion}
        onUpdateQuestion={() => undefined}
        onMoveQuestion={() => undefined}
        onRemoveQuestion={() => undefined}
      />,
    )

    expect(screen.getByText('Todavía no hay preguntas de cualificación en este Lead.')).toBeTruthy()
    expect(
      screen.getByLabelText('Añadir pregunta de cualificación').getAttribute('aria-describedby'),
    ).toBe('lead-qualification-questions-help')
    fireEvent.click(screen.getByRole('button', { name: /está suficientemente explicado/i }))
    expect(onAddQuestion).toHaveBeenCalledWith('¿Está suficientemente explicado el asunto?')
  })

  it('labels the new internal note fields and associates their helper text', () => {
    render(
      <LeadNoteForm
        title=""
        content=""
        highlighted={false}
        pending={false}
        onTitleChange={() => undefined}
        onContentChange={() => undefined}
        onHighlightedChange={() => undefined}
        onSubmit={(event) => event.preventDefault()}
      />,
    )

    expect(screen.getByRole('form', { name: 'Nueva nota' }).getAttribute('aria-describedby')).toBe(
      'lead-new-note-help',
    )
    expect(screen.getByLabelText('Título (opcional)').getAttribute('aria-describedby')).toBe(
      'lead-note-title-help',
    )
    expect(screen.getByLabelText('Contenido *').getAttribute('aria-describedby')).toBe(
      'lead-note-content-help',
    )
    expect(screen.getByLabelText('Contenido *').hasAttribute('required')).toBe(true)
  })

  it('uses a full-width task table and opens a form linked to the Lead', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <LeadTasksTable
        tasks={[]}
        memberNames={new Map()}
        pending={false}
        loading={false}
        onComplete={vi.fn()}
        createDialog={
          <LeadTaskCreateDialog
            reference="OP-2026-0008"
            defaultAssigneeId="member-1"
            members={[{ id: 'member-1', nombre: 'Ana Torregrosa' }]}
            labels={[]}
            titleTemplates={[]}
            pending={false}
            onCreate={onCreate}
          />
        }
      />,
    )

    expect(screen.getByText('Todavía no hay tareas vinculadas a este Lead.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    expect(screen.getByText('Quedará vinculada a OP-2026-0008.')).toBeTruthy()
    expect(screen.getByLabelText('Título *')).toBeTruthy()
    expect(screen.getByLabelText('Mensaje inicial').getAttribute('aria-describedby')).toBe(
      'lead-task-description-help',
    )

    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Llamar al cliente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Llamar al cliente',
          asignadoId: 'member-1',
          tipo: 'Tarea',
          venceEn: null,
        }),
      ),
    )
  })

  it('opens dedicated accessible communication forms and saves their multiline summaries', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<LeadCommunicationDialogs reference="OP-2026-0008" pending={false} onSave={onSave} />)

    expect(screen.getByRole('button', { name: 'Nuevo email' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Registrar llamada' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nueva reunión' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar llamada' }))
    const summary = screen.getByLabelText('Resumen de la llamada *')
    expect(summary.tagName).toBe('TEXTAREA')
    expect(summary.getAttribute('aria-describedby')).toBe(
      'lead-communication-phone_call-summary-help',
    )
    fireEvent.change(summary, { target: { value: 'Confirma que enviará la documentación.' } })
    fireEvent.change(screen.getByLabelText('Siguiente paso'), {
      target: { value: 'Revisar los documentos recibidos.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar llamada' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        'phone_call',
        'Resumen: Confirma que enviará la documentación.\nSiguiente paso: Revisar los documentos recibidos.',
      ),
    )
  })

  it('presents the Lead history as a dated vertical timeline', () => {
    const { container } = render(
      <LeadHistoryTimeline
        events={[
          {
            id: 'event-1',
            tipo: 'communication_logged',
            datos: { summary: 'Llamada de seguimiento registrada.' },
            creadoEn: '2026-08-06T10:30:00.000Z',
            autorId: 'member-1',
          },
          {
            id: 'event-2',
            tipo: 'stage_changed',
            datos: { from: 'entry', to: 'qualification' },
            creadoEn: '2026-08-07T09:00:00.000Z',
            autorId: null,
          },
        ]}
        loading={false}
        memberNames={new Map([['member-1', 'Ana Torregrosa']])}
      />,
    )

    expect(screen.getByRole('list')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(container.querySelectorAll('time')).toHaveLength(2)
    const markers = container.querySelectorAll('span.bg-primary')
    expect(markers).toHaveLength(2)
    expect([...markers].every((marker) => marker.className.includes('start-0'))).toBe(true)
    expect([...markers].every((marker) => !marker.className.includes('-start-'))).toBe(true)
    expect(screen.getByText('Comunicación · Llamada de seguimiento registrada.')).toBeTruthy()
    expect(screen.getByText('Ana Torregrosa')).toBeTruthy()
    expect(screen.getByText('Sistema')).toBeTruthy()
  })
})
