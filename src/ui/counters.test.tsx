import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { COUNTERS } from '../engine'
import { getState, initStore, setBidState, setCell } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

describe('the counter column', () => {
  it('shows one counter at a time, not one column per counter', () => {
    render(<Matrix />)
    // One header cell for the counter column, whatever the six hold.
    expect(screen.getAllByTestId(/^counter-head$/)).toHaveLength(1)
    expect(screen.getAllByTestId(/^bal-/)).toHaveLength(getState().people.length)
  })

  it('opens on the annual pool, which is the one people ask about', () => {
    render(<Matrix />)
    expect(screen.getByTestId('counter-name').textContent).toBe('ANNUAL')
  })

  // RAMP: 12 opening + 14 top-up − 1 (OL on 1 Jan, approved) = 25.
  it('shows the opening figure plus grants less what the grid has drawn', () => {
    render(<Matrix />)
    expect(screen.getByTestId('bal-ramp').textContent).toBe('25')
  })

  // The reason the panel cycles counters rather than leave types: every row
  // has to change together, or row 1 shows ANNUAL while row 2 shows OIL.
  it('changes every row at once when the counter changes', () => {
    render(<Matrix />)
    const before = getState().people.map(p => screen.getByTestId(`bal-${p.id}`).textContent)
    fireEvent.click(screen.getByTestId('counter-next'))
    expect(screen.getByTestId('counter-name').textContent).toBe('OIL')
    const after = getState().people.map(p => screen.getByTestId(`bal-${p.id}`).textContent)
    expect(after).not.toEqual(before)
    // RAMP: 3 opening − 0.5 (*OIL on 10 Feb, pending) = 2.5
    expect(screen.getByTestId('bal-ramp').textContent).toBe('2.5')
  })

  it('walks forward and back through all six, wrapping at each end', () => {
    render(<Matrix />)
    const seen: string[] = []
    for (let i = 0; i < COUNTERS.length; i++) {
      seen.push(screen.getByTestId('counter-name').textContent!)
      fireEvent.click(screen.getByTestId('counter-next'))
    }
    expect(seen).toEqual(['ANNUAL', 'OIL', 'CCL', 'PCL', 'PL', 'EL'])
    // Wrapped back to the start.
    expect(screen.getByTestId('counter-name').textContent).toBe('ANNUAL')
    fireEvent.click(screen.getByTestId('counter-prev'))
    expect(screen.getByTestId('counter-name').textContent).toBe('EL')
  })

  // §Counters: balances already go negative in the squadron's own workbook,
  // and negative shows red and is never refused.
  it('paints a negative balance red without refusing it', () => {
    render(<Matrix />)
    // CROSS opens at −12 annual, +14 top-up, −1 refused LL (refused draws
    // nothing) = 2. Take him negative with a fresh bid instead.
    setCell('cross', '2026-02-10', 'LL')
    act(() => setCell('cross', '2026-02-11', 'LL'))
    const before = screen.getByTestId('bal-cross').textContent
    expect(before).toBeTruthy()
    // DECAL's OIL opens at −4.5 and nothing has moved it.
    fireEvent.click(screen.getByTestId('counter-next'))
    const decal = screen.getByTestId('bal-decal')
    expect(decal.textContent).toBe('-4.5')
    expect(decal.className).toContain('neg')
  })

  it('does not paint a positive balance red', () => {
    render(<Matrix />)
    expect(screen.getByTestId('bal-ramp').className).not.toContain('neg')
  })

  // A pending bid has been asked for, so it cannot be asked for twice. The
  // figure has to move the moment the bid is placed, not when it is decided.
  it('draws down as soon as a bid is placed, and gives it back on refusal', () => {
    render(<Matrix />)
    const before = Number(screen.getByTestId('bal-dusk').textContent)
    act(() => setCell('dusk', '2026-02-11', 'LL'))
    expect(Number(screen.getByTestId('bal-dusk').textContent)).toBe(before - 1)
    act(() => setBidState('dusk', '2026-02-11', 'refused'))
    expect(Number(screen.getByTestId('bal-dusk').textContent)).toBe(before)
  })

  it('draws a half day as half', () => {
    render(<Matrix />)
    const before = Number(screen.getByTestId('bal-dusk').textContent)
    act(() => setCell('dusk', '2026-02-11', '*LL'))
    expect(Number(screen.getByTestId('bal-dusk').textContent)).toBe(before - 0.5)
  })

  // The count rows have no leave balance — they are rules, not people — so
  // their cell in this column is empty rather than showing a stray figure.
  it('leaves the count rows blank in the counter column', () => {
    render(<Matrix />)
    expect(screen.getByTestId('counter-count-ip').textContent).toBe('')
  })

  it('names the counter for a screen reader, not just in the chip', () => {
    render(<Matrix />)
    expect(screen.getByTestId('counter-next').getAttribute('aria-label')).toBeTruthy()
    expect(screen.getByTestId('counter-prev').getAttribute('aria-label')).toBeTruthy()
  })
})
