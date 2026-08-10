import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { advanceStage, getState, initStore, setRole } from '../state/store'
import { memoryBackend } from '../state/storage'
import { StageBar, Topbar } from './Chrome'
import { Matrix } from './Matrix'

beforeEach(() => { initStore(memoryBackend()) })

const scrim = () => screen.getByTestId('sheet-scrim')

// Every sheet, opened the way a person opens it. Kept as one table rather
// than one test each, because the point is that NO sheet is missing the
// behaviour — a per-sheet test would pass happily while an eighth sheet was
// written without one.
const SHEETS: { name: string; testid: string; open: () => void }[] = [
  {
    name: 'the counter sheet',
    testid: 'counter-sheet',
    open: () => {
      render(<Matrix />)
      fireEvent.click(screen.getByTestId('counter-pick'))
    },
  },
  {
    name: 'the bid picker',
    testid: 'bid-picker',
    open: () => {
      render(<Matrix />)
      fireEvent.click(screen.getByTestId('cell-dusk-2026-02-11'))
    },
  },
  {
    name: 'the decision sheet',
    testid: 'bid-picker',
    open: () => {
      advanceStage()
      setRole('admin')
      render(<Matrix />)
      fireEvent.click(screen.getByTestId('cell-asics-2026-01-23'))
    },
  },
  {
    name: 'the person sheet',
    testid: 'person-sheet',
    open: () => {
      setRole('admin')
      render(<Matrix />)
      fireEvent.click(screen.getByTestId('person-ramp'))
    },
  },
  {
    name: 'the new-war sheet',
    testid: 'war-sheet',
    open: () => {
      setRole('admin')
      render(<Topbar />)
      fireEvent.click(screen.getByTestId('war-new'))
    },
  },
  {
    name: 'the bidding-window sheet',
    testid: 'window-sheet',
    open: () => {
      setRole('admin')
      render(<StageBar />)
      fireEvent.click(screen.getByTestId('bid-window'))
    },
  },
]

describe('clicking outside a sheet closes it', () => {
  for (const sheet of SHEETS) {
    it(`closes ${sheet.name}`, () => {
      sheet.open()
      expect(screen.getByTestId(sheet.testid)).toBeTruthy()
      fireEvent.click(scrim())
      expect(screen.queryByTestId(sheet.testid)).toBeNull()
    })

    it(`puts a scrim behind ${sheet.name} rather than leaving it unreachable`, () => {
      sheet.open()
      expect(screen.queryByTestId('sheet-scrim')).toBeTruthy()
    })
  }

  it('leaves no scrim behind once every sheet is shut', () => {
    render(<Matrix />)
    expect(screen.queryByTestId('sheet-scrim')).toBeNull()
    fireEvent.click(screen.getByTestId('counter-pick'))
    fireEvent.click(scrim())
    expect(screen.queryByTestId('sheet-scrim')).toBeNull()
  })

  // The scrim must not swallow a click meant for the sheet itself. Clicking a
  // control inside has to keep doing what it does — the counter sheet's rows
  // choose a counter, and choosing one closes the sheet by picking, not by
  // being dismissed.
  it('does not intercept a click on the sheet itself', () => {
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('counter-pick'))
    fireEvent.click(screen.getByTestId('counter-oil'))
    expect(screen.queryByTestId('counter-sheet')).toBeNull()
    // The choice landed, which a swallowed click would not have done.
    expect(screen.getByTestId('counter-pick').textContent).toContain('OIL')
  })

  // Dismissing is not deciding. A bid left pending must still be pending after
  // the sheet is waved away, or "click outside" becomes a way to lose work.
  it('changes nothing about the bid it was opened on', () => {
    advanceStage()
    setRole('admin')
    render(<Matrix />)
    const before = getState().states.asics['2026-01-23']?.state
    fireEvent.click(screen.getByTestId('cell-asics-2026-01-23'))
    fireEvent.click(scrim())
    expect(getState().states.asics['2026-01-23']?.state).toBe(before)
  })
})
