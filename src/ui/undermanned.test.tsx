import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getState, getVersion, initStore, selectWar, setBidState, setCell } from '../state/store'
import { memoryBackend } from '../state/storage'
import { StageBar } from './Chrome'
import { Matrix } from './Matrix'

beforeEach(() => { initStore(memoryBackend()) })

// The seeded war's red days, in order: RAMP is the only SXO and is away on
// 1 and 3 Jan and half of 10 Feb; the roster carries two IWSOs, so one away
// leaves one on 5, 6, 8 and 15 Jan.
const RED = ['2026-01-01', '2026-01-03', '2026-01-05', '2026-01-06', '2026-01-08', '2026-01-15', '2026-02-10']

describe('the under-manned list', () => {
  it('is shut until the chip is clicked', () => {
    render(<StageBar />)
    expect(screen.queryByTestId('undermanned-list')).toBeNull()
    fireEvent.click(screen.getByTestId('undermanned'))
    expect(screen.getByTestId('undermanned-list')).toBeTruthy()
  })

  it('shuts again on a second click', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('undermanned'))
    fireEvent.click(screen.getByTestId('undermanned'))
    expect(screen.queryByTestId('undermanned-list')).toBeNull()
  })

  it('lists every red day and nothing else', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('undermanned'))
    const rows = within(screen.getByTestId('undermanned-list')).getAllByTestId(/^undermanned-day-/)
    expect(rows.map(r => r.getAttribute('data-testid')!.replace('undermanned-day-', ''))).toEqual(RED)
  })

  it('says what broke on each day, not just the date', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('undermanned'))
    // A list of bare dates would make a scheduler open all seven to find out
    // which is which. 1 Jan is the SXO gone; 5 Jan is one IWSO left.
    expect(screen.getByTestId('undermanned-day-2026-01-01').textContent).toContain('SXO')
    expect(screen.getByTestId('undermanned-day-2026-01-05').textContent).toContain('IWSO')
  })

  it('counts the same days the chip counts', () => {
    render(<StageBar />)
    expect(screen.getByTestId('undermanned').textContent).toContain(`${RED.length} days`)
    fireEvent.click(screen.getByTestId('undermanned'))
    expect(within(screen.getByTestId('undermanned-list')).getAllByTestId(/^undermanned-day-/)).toHaveLength(RED.length)
  })

  // The chip already recounts against live bid states; the list has to follow
  // the same figure or the two disagree on the same screen. RAMP is the only
  // SXO, so refusing his 1 Jan leave puts him back at work and takes that day
  // out of the list.
  it('drops a day the moment a refusal recovers it', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('undermanned'))
    expect(screen.getByTestId('undermanned-day-2026-01-01')).toBeTruthy()
    act(() => setBidState('ramp', '2026-01-01', 'refused'))
    expect(screen.queryByTestId('undermanned-day-2026-01-01')).toBeNull()
    expect(within(screen.getByTestId('undermanned-list')).getAllByTestId(/^undermanned-day-/)).toHaveLength(RED.length - 1)
  })

  it('gains a day the moment a bid breaks one', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('undermanned'))
    expect(screen.queryByTestId('undermanned-day-2026-03-05')).toBeNull()
    // ROULETTE is one of the two IWSOs; with SPLICE free that day, taking
    // ROULETTE away leaves one and reds the IWSO rule.
    //
    // 5 Mar, not a date later in the year: the seeded bidding window is
    // 1 Jan – 31 Mar and the app opens as a MEMBER, so `setCell` rightly
    // refuses to write outside it. The first draft of this test wrote to
    // June, saw nothing appear, and was testing the window rather than the
    // list.
    act(() => setCell('roulette', '2026-03-05', 'LL'))
    expect(screen.getByTestId('undermanned-day-2026-03-05')).toBeTruthy()
  })

  it('offers nothing to open when no day is under-manned', () => {
    act(() => {
      for (const [id, row] of Object.entries(getState().grid)) {
        for (const date of Object.keys(row)) setCell(id, date, '')
      }
    })
    render(<StageBar />)
    const chip = screen.getByTestId('undermanned')
    expect(chip.textContent).toContain('0 days')
    expect(chip.hasAttribute('disabled')).toBe(true)
    fireEvent.click(chip)
    expect(screen.queryByTestId('undermanned-list')).toBeNull()
  })
})

describe('snapping to a day', () => {
  it('records which day to snap to', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('undermanned'))
    fireEvent.click(screen.getByTestId('undermanned-day-2026-02-10'))
    expect(getState().focusDate).toBe('2026-02-10')
  })

  it('shuts the list once a day is chosen', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('undermanned'))
    fireEvent.click(screen.getByTestId('undermanned-day-2026-02-10'))
    expect(screen.queryByTestId('undermanned-list')).toBeNull()
  })

  // 365 columns means the grid is almost never already where it was left.
  // Choosing the same day twice must snap again, and a date alone cannot say
  // "asked again" — hence the sequence number beside it.
  it('asks again when the same day is chosen twice', () => {
    render(<StageBar />)
    const choose = () => {
      fireEvent.click(screen.getByTestId('undermanned'))
      fireEvent.click(screen.getByTestId('undermanned-day-2026-02-10'))
    }
    choose()
    const first = getVersion()
    choose()
    expect(getState().focusDate).toBe('2026-02-10')
    expect(getVersion()).toBeGreaterThan(first)
  })

  it('marks the chosen day in the matrix so the eye lands on it', () => {
    render(<StageBar />)
    render(<Matrix />)
    fireEvent.click(screen.getByTestId('undermanned'))
    fireEvent.click(screen.getByTestId('undermanned-day-2026-02-10'))
    expect(screen.getByTestId('head-2026-02-10').className).toContain('focus')
    expect(screen.getByTestId('head-2026-02-11').className).not.toContain('focus')
  })

  // Switching war rebuilds the grid around different dates; a focus left
  // pointing into the old one would mark a column that is no longer there and
  // send the next snap nowhere.
  it('forgets the focus when the war changes', () => {
    render(<StageBar />)
    fireEvent.click(screen.getByTestId('undermanned'))
    fireEvent.click(screen.getByTestId('undermanned-day-2026-02-10'))
    expect(getState().focusDate).toBe('2026-02-10')
    const other = getState().wars.find(w => w.period.id !== getState().period.id)!
    act(() => selectWar(other.period.id))
    expect(getState().focusDate).toBeNull()
  })
})
