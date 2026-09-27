import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SatisfactionMeter } from './satisfaction-meter'

afterEach(cleanup)

describe('SatisfactionMeter', () => {
  it.each([
    ['Sin valorar', 0],
    ['Muy bajo', 1],
    ['Bajo', 2],
    ['Medio', 3],
    ['Alto', 4],
    ['Muy alto', 5],
  ] as const)('renders five bars for %s', (value, activeBars) => {
    render(<SatisfactionMeter value={value} />)

    const meter = screen.getByRole('img', { name: `Nivel de satisfacción: ${value}` })
    const bars = Array.from(meter.querySelectorAll('[aria-hidden="true"]'))

    expect(bars).toHaveLength(5)
    expect(bars.filter((bar) => bar.classList.contains('bg-primary'))).toHaveLength(activeBars)
    expect(screen.getByText(value)).toBeTruthy()
  })

  it('hides the text label when used in a compact list cell', () => {
    render(<SatisfactionMeter value="Alto" showLabel={false} />)

    expect(screen.getByRole('img', { name: 'Nivel de satisfacción: Alto' })).toBeTruthy()
    expect(screen.queryByText('Alto')).toBeNull()
  })
})
