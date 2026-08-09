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
    expect(getState().states.dusk['2026-02-11']).toBe('pending')
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
