import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { advanceStage, getState, initStore } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

// DUSK has nothing seeded anywhere in the quarter, so every assertion here
// is about what the click did rather than about what was already there.
const CELL = 'cell-dusk-2026-02-11'

describe('placing a bid', () => {
  it('opens a picker on a cell while the period is open', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })

  it('writes the chosen code and makes it pending', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
    expect(getState().states.dusk['2026-02-11']?.state).toBe('pending')
  })

  it('closes once a choice is made', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
  })

  it('closes on cancel without writing anything', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    fireEvent.click(screen.getByTestId('bid-cancel'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
    expect(getState().grid.dusk?.['2026-02-11']).toBeUndefined()
  })

  it('clears a cell', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    fireEvent.click(screen.getByTestId('bid-LL'))
    fireEvent.click(screen.getByTestId(CELL))
    fireEvent.click(screen.getByTestId('bid-clear'))
    expect(getState().grid.dusk?.['2026-02-11']).toBeUndefined()
    expect(getState().states.dusk?.['2026-02-11']).toBeUndefined()
  })

  it('offers only codes a person actually bids for', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    expect(screen.queryByTestId('bid-FS')).toBeNull()
    expect(screen.queryByTestId('bid-CSE')).toBeNull()
    expect(screen.queryByTestId('bid-M')).toBeNull()
    expect(screen.getByTestId('bid-OL')).toBeTruthy()
  })

  it('does nothing once bidding has closed', () => {
    advanceStage() // open -> closed
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
  })

  // The whole point of the leave-code rework: a portion is something any
  // leave type carries, not a code of its own. So the picker asks two
  // questions, and the asterisk lands where the time sits.
  it('bids for a morning or an afternoon, not just a whole day', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    fireEvent.click(screen.getByTestId('portion-am'))
    fireEvent.click(screen.getByTestId('bid-OIL'))
    expect(getState().grid.dusk['2026-02-11']).toBe('*OIL')

    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-12'))
    fireEvent.click(screen.getByTestId('portion-pm'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(getState().grid.dusk['2026-02-12']).toBe('LL*')
  })

  // Moving to another cell WITHOUT closing first is the case that bites: the
  // sheet stays mounted, so without a key on the cell React keeps the
  // component instance and its portion with it, and the next bid silently
  // becomes a half day. Choosing a code closes the sheet, so a version of
  // this test that picked one in between would remount either way and prove
  // nothing.
  it('starts each cell back at a whole day rather than carrying the last portion across', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId(CELL))
    fireEvent.click(screen.getByTestId('portion-am'))
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-12'))
    expect(screen.getByTestId('portion-full').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(getState().grid.dusk['2026-02-12']).toBe('LL')
    expect(getState().grid.dusk?.['2026-02-11']).toBeUndefined()
  })

  // A half day removes 0.5 of a person, and the count rows are the reason
  // the portion question exists at all. Bidding a morning must move the
  // figure by a half, not by a whole.
  it('moves the manning count by a half for a half day', () => {
    render(<Matrix />)
    const before = Number(screen.getByTestId('count-opsw-2026-02-11').textContent)
    fireEvent.click(screen.getByTestId(CELL))
    fireEvent.click(screen.getByTestId('portion-am'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(Number(screen.getByTestId('count-opsw-2026-02-11').textContent)).toBe(before - 0.5)
  })

  // SWITCHER is posted out on 2026-01-12. Bidding leave for a man who has
  // left the squadron is not a bid, it is a data-entry accident.
  it('refuses to open on a cell outside the person’s time in the squadron', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-switcher-2026-01-20'))
    expect(screen.queryByTestId('bid-picker')).toBeNull()
    fireEvent.click(screen.getByTestId('cell-switcher-2026-01-09'))
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })
})

describe('bidding over a range', () => {
  const CAL = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

  const goTo = (yyyymm: string) => {
    for (let i = 0; i < 72; i++) {
      const [name, year] = screen.getByTestId('span-month').textContent!.split(' ')
      const at = `${year}-${String(CAL.indexOf(name) + 1).padStart(2, '0')}`
      if (at === yyyymm) return
      fireEvent.click(screen.getByTestId(at < yyyymm ? 'span-next-month' : 'span-prev-month'))
    }
    throw new Error(`never reached ${yyyymm}`)
  }

  // One day is the common case and must stay ONE tap. The range is the
  // exception, so it is what costs the extra tap — not the other way round.
  it('opens on just this day, and writes only that day', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    expect(screen.getByTestId('span-one').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('span-picker')).toBeNull()
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(getState().grid.dusk['2026-02-11']).toBe('LL')
    expect(getState().grid.dusk?.['2026-02-12']).toBeUndefined()
  })

  // The bidder chose their start by opening this cell. Asking for it again
  // would be the extra work the control exists to remove.
  it('seeds the range with the day already tapped', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    fireEvent.click(screen.getByTestId('span-range'))
    expect(screen.getByTestId('span-month').textContent).toBe('FEBRUARY 2026')
    expect(screen.getByTestId('span-selection').textContent).toBe('11 Feb 26')
  })

  it('writes a fortnight from one selection', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-09'))
    fireEvent.click(screen.getByTestId('span-range'))
    fireEvent.click(screen.getByTestId('span-day-2026-02-20'))
    fireEvent.click(screen.getByTestId('bid-LL'))

    for (let d = 9; d <= 20; d++) {
      expect(getState().grid.dusk[`2026-02-${String(d).padStart(2, '0')}`]).toBe('LL')
    }
    expect(screen.queryByTestId('bid-picker')).toBeNull()
  })

  it('carries the portion across every day of the range', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-09'))
    fireEvent.click(screen.getByTestId('span-range'))
    fireEvent.click(screen.getByTestId('span-day-2026-02-11'))
    fireEvent.click(screen.getByTestId('portion-am'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    for (const d of ['2026-02-09', '2026-02-10', '2026-02-11']) {
      expect(getState().grid.dusk[d]).toBe('*LL')
    }
  })

  // A shortfall must be SAID. A range that quietly wrote eleven of fourteen
  // days would leave someone believing they had asked for a fortnight.
  it('says how many days it could not write, and keeps the sheet open', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-03-29'))
    fireEvent.click(screen.getByTestId('span-range'))
    goTo('2026-04')
    fireEvent.click(screen.getByTestId('span-day-2026-04-04'))
    fireEvent.click(screen.getByTestId('bid-LL'))

    const said = screen.getByTestId('span-note').textContent!
    expect(said).toContain('3 days written')
    expect(said).toContain('4 skipped')
    expect(screen.getByTestId('bid-picker')).toBeTruthy()
  })

  it('goes back to a single day when the bidder changes their mind', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-02-09'))
    fireEvent.click(screen.getByTestId('span-range'))
    fireEvent.click(screen.getByTestId('span-day-2026-02-20'))
    fireEvent.click(screen.getByTestId('span-one'))
    fireEvent.click(screen.getByTestId('bid-LL'))
    expect(getState().grid.dusk['2026-02-09']).toBe('LL')
    expect(getState().grid.dusk?.['2026-02-10']).toBeUndefined()
  })

  // Bounded by the war, so a fortnight cannot run off the end of the sheet
  // it belongs to.
  it('offers no day outside the war', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('cell-dusk-2026-01-05'))
    fireEvent.click(screen.getByTestId('span-range'))
    goTo('2025-12')
    expect((screen.getByTestId('span-day-2025-12-31') as HTMLButtonElement).disabled).toBe(true)
  })
})
