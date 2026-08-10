import { act, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Person } from '../engine'
import { getState, initStore, setBidState, setCell } from '../state/store'
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
    // RAMP is the seed's one SXO, so his category carries the (S) tag. TATA
    // is not, so his does not — asserted alongside, or a build that appended
    // (S) to everybody would pass this just as happily.
    expect(within(row).getByText('OPSP(S)')).toBeTruthy()
    expect(within(screen.getByTestId('row-tata')).getByText('IP')).toBeTruthy()
  })

  it('renders a column for every day of the year', () => {
    render(<Matrix />)
    expect(screen.getAllByTestId(/^head-/)).toHaveLength(365)
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

  // The owner's ask: "I should have a short form day title for each day. Like
  // Mon, Tues Etc." On EVERY column, unlike the month label — the question it
  // answers ("which Tuesday is this") is asked at every column, not only at
  // the turn of a month.
  it('names the weekday on every column', () => {
    render(<Matrix />)
    expect(screen.getByTestId('head-2026-01-05').querySelector('.dow')?.textContent).toBe('MON')
    expect(screen.getByTestId('head-2026-01-06').querySelector('.dow')?.textContent).toBe('TUE')
    expect(screen.getByTestId('head-2026-01-10').querySelector('.dow')?.textContent).toBe('SAT')
    // Including the 1st, where it sits alongside the month label rather than
    // instead of it.
    const jan1 = screen.getByTestId('head-2026-01-01')
    expect(jan1.querySelector('.mon')?.textContent).toBe('JAN')
    expect(jan1.querySelector('.dow')?.textContent).toBe('THU')
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

  it('gives a duty cell the sc chip class and a non-bid code the info chip class', () => {
    render(<Matrix />)
    // Seed: TATA is on FS (a duty code) on 1 Jan; SPLICE is on M (medical)
    // on 5 Jan. This asserted TATA's OIL on 9 Jan as the `.info` case until
    // bid states landed — OIL is leave someone asked for, so it now carries
    // a bid colour instead. `.info` is what remains: the codes nobody bids
    // for, which is medical, courses and overseas duty.
    const dutyCell = screen.getByTestId('cell-tata-2026-01-01')
    expect(dutyCell.querySelector('.c.sc')?.textContent).toBe('FS')
    const ordinaryCell = screen.getByTestId('cell-splice-2026-01-05')
    expect(ordinaryCell.querySelector('.c.info')?.textContent).toBe('M')
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

describe('bid state on a cell', () => {
  // The owner's colour rule, restated 10 Aug 26: an input nobody has answered
  // carries NO colour, purple means management has acknowledged it, green
  // approved, red refused. Purple used to mean "typed", which made a bid in
  // management's hands look identical to one nobody had touched.
  it('paints approved green, acknowledged purple, refused red, and pending not at all', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-jaguar-2026-01-16').querySelector('.c')!.className).toContain('appr')
    expect(screen.getByTestId('cell-asics-2026-02-24').querySelector('.c')!.className).toContain('tbc')
    expect(screen.getByTestId('cell-jaguar-2026-01-19').querySelector('.c')!.className).toContain('ref')

    const pending = screen.getByTestId('cell-asics-2026-01-23').querySelector('.c')!.className
    for (const painted of ['appr', 'tbc', 'ref']) expect(pending).not.toContain(painted)
  })

  it('leaves a code nobody bids for as plain information', () => {
    render(<Matrix />)
    expect(screen.getByTestId('cell-tata-2026-01-01').querySelector('.c')!.className).toContain('sc')
    expect(screen.getByTestId('cell-pipper-2026-01-12').querySelector('.c')!.className).toContain('info')
  })

  // Neither duty nor medical may ever take a bid colour: one is a man at
  // work, the other is a man who did not ask for anything. Both are pinned
  // against every bid class rather than just for their own, so a cascade
  // that added `tbc` alongside `sc` would fail here.
  //
  // This does NOT prove the branch ORDER in Matrix.tsx — duty codes carry
  // `bid: false`, so `isDuty` and `isBiddable` are disjoint and reordering
  // them changes nothing. Reading duty first is for the reader, not a guard.
  it('never lets duty or medical take a bid colour', () => {
    render(<Matrix />)
    for (const [id, cls] of [['cell-skin-2026-01-03', 'sc'], ['cell-splice-2026-01-05', 'info']] as const) {
      const name = screen.getByTestId(id).querySelector('.c')!.className
      expect(name).toContain(cls)
      for (const bidClass of ['appr', 'tbc', 'ref']) expect(name).not.toContain(bidClass)
    }
  })

  // A bid with no decision recorded is pending — the seed leaves splice's
  // LL unstated precisely so this path renders on first run — and pending
  // now means NO colour. Asserted against all three painted classes rather
  // than for one, so a cascade that reintroduced any of them fails here.
  it('reads a bid with no decision recorded as pending, and paints it plain', () => {
    render(<Matrix />)
    const cls = screen.getByTestId('cell-splice-2026-01-08').querySelector('.c')!.className
    for (const painted of ['appr', 'tbc', 'ref']) expect(cls).not.toContain(painted)
  })

  it('re-paints when a decision is recorded', () => {
    render(<Matrix />)
    const cls = () => screen.getByTestId('cell-asics-2026-01-23').querySelector('.c')!.className
    expect(cls()).not.toContain('appr')
    act(() => setBidState('asics', '2026-01-23', 'approved'))
    expect(cls()).toContain('appr')
  })

  // Acknowledging is the step the owner added: it is not a decision, it says
  // management has the bid in hand. A plain input becomes purple, and the
  // counts do not move — an acknowledged bid still removes the person,
  // exactly as a pending one does.
  it('turns a plain pending input purple when it is acknowledged, without moving the counts', () => {
    render(<Matrix />)
    const cls = () => screen.getByTestId('cell-asics-2026-01-23').querySelector('.c')!.className
    expect(cls()).not.toContain('tbc')
    const before = screen.getByTestId('count-opsp-2026-01-23').textContent
    act(() => setBidState('asics', '2026-01-23', 'acknowledged'))
    expect(cls()).toContain('tbc')
    expect(screen.getByTestId('count-opsp-2026-01-23').textContent).toBe(before)
  })

  // The counts are what a refusal is FOR: pulling a man back into the
  // manning picture. A Matrix that painted the chip but still passed `{}`
  // for the states would pass every assertion above and fail this one.
  it('counts a refused bid as a man at work', () => {
    render(<Matrix />)
    const before = screen.getByTestId('count-opsp-2026-01-23').textContent
    act(() => setBidState('asics', '2026-01-23', 'refused'))
    expect(screen.getByTestId('count-opsp-2026-01-23').textContent).not.toBe(before)
  })
})
