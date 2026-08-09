import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Person } from '../engine'
import { getState, initStore, setCell } from '../state/store'
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

  it('does not label a member who has not yet arrived as posted out', () => {
    // The seed has nobody with a `from`, which is why this survived past
    // review — give the test its own person rather than relying on seed data.
    const arriving: Person = {
      id: 'newbie', callsign: 'NEWBIE', seat: 'pilot', band: 'ops',
      sxo: false, from: '2026-02-01', to: null,
    }
    getState().people.push(arriving)
    render(<Matrix />)

    const beforeArrival = screen.getByTestId('cell-newbie-2026-01-15')
    expect(beforeArrival.textContent).not.toBe('PO')
    expect(beforeArrival.textContent).toBe('')
    expect(beforeArrival.className).toContain('gone')

    const onArrival = screen.getByTestId('cell-newbie-2026-02-01')
    expect(onArrival.textContent).not.toBe('PO')
    expect(onArrival.className).not.toContain('gone')
  })

  it('suppresses the duty class for a code left on a day outside the roster window', () => {
    // A stale FS on a posted-out member's row must not read as "at work" —
    // they are gone, full stop, regardless of what code sits under them.
    setCell('switcher', '2026-01-13', 'FS')
    render(<Matrix />)
    const cell = screen.getByTestId('cell-switcher-2026-01-13')
    expect(cell.className).toContain('gone')
    expect(cell.className).not.toContain('duty')
    expect(cell.textContent).toBe('PO')
  })

  it('marks a Saturday header as a weekend and a Tuesday as not', () => {
    render(<Matrix />)
    expect(screen.getByTestId('head-2026-01-03').className).toContain('weekend')
    expect(screen.getByTestId('head-2026-01-06').className).not.toContain('weekend')
  })

  it('marks the blocked week\'s Saturday as both blocked and weekend', () => {
    // The seed's exercise week runs through 2026-03-14 (Saturday) precisely
    // so this overlap exists in the data. jsdom computes no cascade, so this
    // only proves both classes are emitted — it cannot see which background
    // wins. That's covered by the e2e spec instead.
    render(<Matrix />)
    const head = screen.getByTestId('head-2026-03-14')
    expect(head.className).toContain('blocked')
    expect(head.className).toContain('weekend')
  })

  it('labels the first day of a month, and only the first day', () => {
    render(<Matrix />)
    const jan1 = screen.getByTestId('head-2026-01-01')
    expect(jan1.querySelector('.mon')?.textContent).toBe('JAN')
    const jan2 = screen.getByTestId('head-2026-01-02')
    expect(jan2.querySelector('.mon')).toBeNull()
    const feb1 = screen.getByTestId('head-2026-02-01')
    expect(feb1.querySelector('.mon')?.textContent).toBe('FEB')
  })

  it('gives a duty cell the sc chip class and an ordinary code the info chip class', () => {
    render(<Matrix />)
    // Seed: TATA is on FS (a duty code) on 1 Jan, and on OIL (an ordinary
    // code) on 9 Jan.
    const dutyCell = screen.getByTestId('cell-tata-2026-01-01')
    expect(dutyCell.querySelector('.c.sc')?.textContent).toBe('FS')
    const ordinaryCell = screen.getByTestId('cell-tata-2026-01-09')
    expect(ordinaryCell.querySelector('.c.info')?.textContent).toBe('OIL')
  })

  it('carries the am/pm portion class on the chip, derived from the stored asterisk', () => {
    setCell('ramp', '2026-01-20', '*LL')
    setCell('ramp', '2026-01-21', 'LL*')
    setCell('ramp', '2026-01-22', 'LL')
    render(<Matrix />)
    // Assert on the chip element itself, not the `<td>` — the portion class
    // decorates `.c`, and a `<td>`-level assertion would pass even if the
    // class landed on the wrong element.
    const morning = screen.getByTestId('cell-ramp-2026-01-20').querySelector('.c')!
    expect(morning.className).toContain('am')
    expect(morning.className).not.toContain('pm')

    const afternoon = screen.getByTestId('cell-ramp-2026-01-21').querySelector('.c')!
    expect(afternoon.className).toContain('pm')
    expect(afternoon.className).not.toContain('am')

    const wholeDay = screen.getByTestId('cell-ramp-2026-01-22').querySelector('.c')!
    expect(wholeDay.className).not.toContain('am')
    expect(wholeDay.className).not.toContain('pm')
  })

  it('shows both the blocked reason and the day\'s events when both exist', () => {
    // The seed's blocked week carries no events, so this is exercised by
    // hand: a day that is both blocked and carries an event line, which the
    // old `blocked ? reason : events` title would make the event invisible.
    const day = getState().period.days.find(d => d.date === '2026-03-09')!
    day.events = ['Range closure', '']
    render(<Matrix />)
    const head = screen.getByTestId('head-2026-03-09')
    expect(head.title).toContain('Exercise week')
    expect(head.title).toContain('Range closure')
  })
})

describe('weekend banding', () => {
  it('bands the whole column, header and body alike', () => {
    render(<Matrix />)
    // 2026-01-03 is a Saturday, 2026-01-06 a Tuesday.
    expect(screen.getByTestId('head-2026-01-03').className).toContain('weekend')
    expect(screen.getByTestId('cell-ramp-2026-01-03').className).toContain('weekend')
    expect(screen.getByTestId('head-2026-01-06').className).not.toContain('weekend')
    expect(screen.getByTestId('cell-ramp-2026-01-06').className).not.toContain('weekend')
  })
})
