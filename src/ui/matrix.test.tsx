import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { initStore, setCell } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('Matrix', () => {
  it('renders a row for every person with their callsign and category', () => {
    render(<Matrix />)
    const row = screen.getByTestId('row-ramp')
    expect(within(row).getByText('RAMP')).toBeTruthy()
    expect(within(row).getByText('OPSP')).toBeTruthy()
  })

  it('renders a column for every day of the quarter', () => {
    render(<Matrix />)
    expect(screen.getAllByTestId(/^head-/)).toHaveLength(90)
  })

  it('shows a code in the cell it belongs to', () => {
    setCell('ramp', '2026-01-20', 'LL')
    render(<Matrix />)
    expect(screen.getByTestId('cell-ramp-2026-01-20').textContent).toBe('LL')
  })

  it('marks a blocked day on the date header', () => {
    render(<Matrix />)
    expect(screen.getByTestId('head-2026-03-10').className).toContain('blocked')
    expect(screen.getByTestId('head-2026-01-07').className).not.toContain('blocked')
  })

  it('marks SC duty cells as duty so they read as earning OIL', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-tata-2026-01-01').className).toContain('duty')
  })

  it('greys the cells of a posted-out member from the day after they leave', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-switcher-2026-01-12').className).not.toContain('gone')
    expect(screen.getByTestId('cell-switcher-2026-01-13').className).toContain('gone')
  })
})
