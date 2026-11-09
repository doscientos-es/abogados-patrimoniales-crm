import { describe, expect, it } from 'vitest'

import { addParticipant, readParticipants, removeParticipant } from './lead-participants'

describe('intervinientes del Lead', () => {
  it('reads legacy and linked participants and replaces by canonical contact id', () => {
    const initial = {
      title: 'Lead',
      otrosIntervinientes: [{ contactoId: 'c1', nombre: 'Ana', rol: 'Hermana' }],
    }
    expect(readParticipants(initial as never)).toHaveLength(1)
    const updated = addParticipant(initial as never, {
      contactoId: 'c1',
      nombre: 'Ana Pérez',
      rol: 'Coheredera',
      posicion: 'De nuestra parte',
    })
    expect(readParticipants(updated)).toEqual([
      { contactoId: 'c1', nombre: 'Ana Pérez', rol: 'Coheredera', posicion: 'De nuestra parte' },
    ])
    expect(updated).toMatchObject({ title: 'Lead' })
  })

  it('removes one participant without altering unrelated detail fields', () => {
    const updated = removeParticipant(
      {
        keep: true,
        otrosIntervinientes: [
          { contactoId: 'c1', nombre: 'Ana' },
          { contactoId: 'c2', nombre: 'Luis' },
        ],
      } as never,
      'c1',
    )
    expect(updated).toMatchObject({ keep: true })
    expect(readParticipants(updated).map((participant) => participant.contactoId)).toEqual(['c2'])
  })
})
