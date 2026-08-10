import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { getState, initStore, setBidState, setCell } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

/** Open the counter sheet and choose one. The whole column header is the
 *  control now — the two arrows it replaced were 13px glyphs in a 44px
 *  column, which the owner could not hit on a phone. */
function pick(counter: string) {
  fireEvent.click(screen.getByTestId('counter-pick'))
  fireEvent.click(screen.getByTestId(`counter-${counter}`))
}

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
    pick('oil')
    expect(screen.getByTestId('counter-name').textContent).toBe('OIL')
    const after = getState().people.map(p => screen.getByTestId(`bal-${p.id}`).textContent)
    expect(after).not.toEqual(before)
    // RAMP: 3 opening − 0.5 (*OIL on 10 Feb, pending) = 2.5
    expect(screen.getByTestId('bal-ramp').textContent).toBe('2.5')
  })

  // Every counter is reachable, and each is ONE tap from any other. That is
  // the point of the sheet: the arrows it replaced made EL five taps from
  // ANNUAL, on a control the owner could not reliably hit even once.
  it('offers every counter, each a single tap away', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('counter-pick'))
    expect([...screen.getByTestId('counter-sheet').querySelectorAll('.crow .cn')].map(e => e.textContent))
      .toEqual(['ANNUAL', 'OIL', 'CCL', 'FCL', 'PL', 'EL'])
    fireEvent.click(screen.getByTestId('counter-el'))
    expect(screen.getByTestId('counter-name').textContent).toBe('EL')
    expect(screen.queryByTestId('counter-sheet')).toBeNull()

    // ...and back again, without walking through the four in between.
    pick('annual')
    expect(screen.getByTestId('counter-name').textContent).toBe('ANNUAL')
  })

  it('marks which counter is already showing', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('counter-pick'))
    expect(screen.getByTestId('counter-annual').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('counter-oil').getAttribute('aria-pressed')).toBe('false')
  })

  // The figure is what makes the list answerable: "which counter" is a
  // question people settle by looking for the one running out.
  it('shows the squadron-wide total beside each counter', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('counter-pick'))
    const oil = screen.getByTestId('counter-oil').textContent!
    expect(oil).toContain('OIL')
    expect(oil).toMatch(/-?\d/)
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
    pick('oil')
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
    const label = screen.getByTestId('counter-pick').getAttribute('aria-label')!
    expect(label).toContain('ANNUAL')
    expect(label.toLowerCase()).toContain('choose')
  })
})

describe('the counter follows the leave just entered', () => {
  // The owner's ask: "If the user inputs a leave for e.g OIL, the leave
  // counter will snap to show how many OIL they have." The figure then
  // answers the question the bidder is holding in their head at that moment,
  // instead of showing a pool they were not thinking about.
  it('snaps to the counter the leave spends', () => {
    render(<Matrix />)
    expect(screen.getByTestId('counter-name').textContent).toBe('ANNUAL')
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-OIL'))
    expect(screen.getByTestId('counter-name').textContent).toBe('OIL')
  })

  it('snaps for a half day exactly as for a whole one', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('portion-am'))
    fireEvent.click(screen.getByTestId('bid-CCL'))
    expect(screen.getByTestId('counter-name').textContent).toBe('CCL')
  })

  // Two leave types share the annual pool, so LL and OL must both land on
  // ANNUAL rather than on a column of their own. That is the difference
  // between cycling COUNTERS and cycling leave types.
  it('lands on the shared pool for the two that share one', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-OIL'))
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-12'))
    fireEvent.click(screen.getByTestId('bid-OL'))
    expect(screen.getByTestId('counter-name').textContent).toBe('ANNUAL')
  })

  // OFF spends nothing, so there is no counter to snap to. Leaving the panel
  // where it is beats moving it somewhere arbitrary.
  it('leaves the counter alone for free leave', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-OIL'))
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-12'))
    fireEvent.click(screen.getByTestId('bid-OFF'))
    expect(screen.getByTestId('counter-name').textContent).toBe('OIL')
  })

  it('clearing a cell moves nothing', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-clear'))
    expect(screen.getByTestId('counter-name').textContent).toBe('ANNUAL')
  })
})

describe('going negative is asked about, never refused', () => {
  // §Counters, and the owner twice: balances already run negative in the
  // squadron's own workbook, so this can never be a refusal. What was wrong
  // was doing it silently.
  it('asks before a bid takes someone below zero, and writes nothing yet', () => {
    render(<Matrix />)
    // RESET already reads −2 annual — he opens at 2 with four days pending in
    // the 2027 war — so any further day is unambiguously past zero. JAGUAR
    // was the first choice here and was wrong: he sits at 2, and one day
    // leaves him at 1, which is exactly the case that must NOT warn.
    fireEvent.click(screen.getByTestId('cell-reset-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-LL'))

    expect(screen.getByTestId('span-note').textContent).toContain('RESET')
    expect(getState().grid.reset?.['2026-02-11']).toBeUndefined()
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })

  it('goes ahead when the same leave is tapped again', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-reset-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(getState().grid.reset['2026-02-11']).toBe('LL')
    expect(screen.queryByTestId('bid-picker')).toBeNull()
  })

  it('says the figure it would land on', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-reset-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    const said = screen.getByTestId('span-note').textContent!
    expect(said).toContain('ANNUAL')
    expect(said).toMatch(/-\d/)
  })

  // A bid that stays in credit must not stop to ask — the warning is only
  // worth anything if it is rare.
  it('does not ask when the balance stays positive', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(screen.queryByTestId('span-note')).toBeNull()
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
  })

  // A FORTNIGHT is where this matters most: one day may stay in credit while
  // twelve do not, so the check has to count the whole span.
  it('counts the whole range, not just its first day', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-09'))
    fireEvent.click(screen.getByTestId('span-range'))
    fireEvent.click(screen.getByTestId('span-day-2026-02-27'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(screen.getByTestId('span-note').textContent).toContain('DUSK')
    expect(getState().grid.dusk?.['2026-02-09']).toBeUndefined()
  })

  // Free leave has no balance to overdraw.
  it('never asks about leave that spends nothing', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-reset-2026-02-11'))
    fireEvent.click(screen.getByTestId('bid-OFF'))
    expect(getState().grid.reset['2026-02-11']).toBe('OFF')
  })
})
