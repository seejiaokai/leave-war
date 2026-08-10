import { describe, expect, it } from 'vitest'
import type { Grid } from './availability'
import type { States } from './bids'
import {
  balanceOf,
  COUNTERS,
  counterLabel,
  drawnFrom,
  grantedTo,
  type Ledger,
  type Openings,
} from './counters'

const approved = (source: 'bid' | 'raptor' = 'bid') => ({ state: 'approved' as const, source })
const pending = { state: 'pending' as const, source: 'bid' as const }
const refused = { state: 'refused' as const, source: 'bid' as const }

describe('COUNTERS', () => {
  // SIX counters against SEVEN leave types. LL and OL both spend the annual
  // pool, so a list of leave TYPES would show the same figure twice under two
  // names — and it would grow every time a type was added, which the counter
  // list does not. Both figures moved together when FCL was removed on
  // 10 Aug 26, without this list being edited: it is derived, not restated.
  it('is the six entitlements, one fewer than the leave types', () => {
    expect(COUNTERS).toEqual(['annual', 'oil', 'ccl', 'fcl', 'pl', 'el'])
  })

  it('has a label for every counter', () => {
    for (const c of COUNTERS) expect(counterLabel(c)).toBeTruthy()
  })

  // The list is derived from the code catalogue, not hand-written beside it.
  // A ninth leave type naming a new counter must appear here without anyone
  // remembering this file.
  it('covers every counter any leave type actually spends', () => {
    expect(new Set(COUNTERS).size).toBe(COUNTERS.length)
  })

  it('refuses to be reordered by a caller mutating the exported array', () => {
    expect(() => (COUNTERS as string[]).reverse()).toThrow()
  })
})

describe('drawnFrom', () => {
  // Each case uses its OWN narrow grid. Sharing one wide grid across them
  // hid a real fact on the first attempt: a cell with no state recorded
  // reads as PENDING and therefore draws, so unrelated cells left unstated
  // were silently adding to every total.

  // LL and OL draw from the same pool. This is the whole reason the panel
  // cycles counters rather than leave types.
  it('draws local and overseas leave from the same annual pool', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL', '2026-01-06': 'OL' } }
    const states: States = { ramp: { '2026-01-05': approved(), '2026-01-06': approved() } }
    expect(drawnFrom([{ grid: grid, states: states }], 'ramp', 'annual')).toBe(2)
  })

  it('draws a half day as half', () => {
    const grid: Grid = { ramp: { '2026-01-07': '*LL' } }
    expect(drawnFrom([{ grid: grid, states: { ramp: { '2026-01-07': approved() } } }], 'ramp', 'annual')).toBe(0.5)
    const pm: Grid = { ramp: { '2026-01-07': 'LL*' } }
    expect(drawnFrom([{ grid: pm, states: { ramp: { '2026-01-07': approved() } } }], 'ramp', 'annual')).toBe(0.5)
  })

  it('draws OIL from the OIL counter and nothing from annual', () => {
    const grid: Grid = { ramp: { '2026-01-08': 'OIL' } }
    const states: States = { ramp: { '2026-01-08': approved() } }
    expect(drawnFrom([{ grid: grid, states: states }], 'ramp', 'oil')).toBe(1)
    expect(drawnFrom([{ grid: grid, states: states }], 'ramp', 'annual')).toBe(0)
  })

  // The same worst-case rule the manning rows already use, reached through
  // the same function: a pending bid has been asked for, so it cannot be
  // asked for twice.
  it('draws a pending bid, so nobody can bid leave they have already asked for', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL' } }
    expect(drawnFrom([{ grid: grid, states: { ramp: { '2026-01-05': pending } } }], 'ramp', 'annual')).toBe(1)
  })

  it('draws nothing for a refused bid — he did not get the day', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL' } }
    expect(drawnFrom([{ grid: grid, states: { ramp: { '2026-01-05': refused } } }], 'ramp', 'annual')).toBe(0)
  })

  it('draws a bid with no decision recorded, which reads as pending', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL' } }
    expect(drawnFrom([{ grid: grid, states: {} }], 'ramp', 'annual')).toBe(1)
  })

  // Leave entered on Raptor's input tab was approved verbally. It has been
  // taken, so it spends exactly as an approved bid does.
  it('draws leave Raptor owns, the same as an approved bid', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL' } }
    expect(drawnFrom([{ grid: grid, states: { ramp: { '2026-01-05': approved('raptor') } } }], 'ramp', 'annual')).toBe(1)
  })

  it('draws nothing for codes that spend no counter', () => {
    for (const code of ['CSE', 'M', 'OD', 'FS', 'HS']) {
      const grid: Grid = { ramp: { '2026-01-09': code } }
      for (const c of COUNTERS) expect(drawnFrom([{ grid: grid, states: {} }], 'ramp', c)).toBe(0)
    }
  })

  it('draws nothing for a person with no cells at all', () => {
    expect(drawnFrom([{ grid: { ramp: { '2026-01-05': 'LL' } }, states: {} }], 'nobody', 'annual')).toBe(0)
  })

  it('sums a whole quarter of mixed cells', () => {
    const grid: Grid = {
      ramp: { '2026-01-05': 'LL', '2026-01-06': 'OL', '2026-01-07': '*LL', '2026-01-09': 'CSE' },
    }
    const states: States = {
      ramp: { '2026-01-05': approved(), '2026-01-06': refused, '2026-01-07': pending },
    }
    // LL approved (1) + OL refused (0) + *LL pending (0.5), course ignored.
    expect(drawnFrom([{ grid: grid, states: states }], 'ramp', 'annual')).toBe(1.5)
  })
})

describe('grantedTo', () => {
  const ledger: Ledger = [
    { id: 'g1', personId: 'ramp', counter: 'annual', amount: 14, date: '2026-01-01', reason: 'Annual top-up', approvedBy: 'SQNCDR' },
    { id: 'g2', personId: 'ramp', counter: 'oil', amount: 2, date: '2026-01-15', reason: 'CNY workplan', approvedBy: 'SQNCDR' },
    { id: 'g3', personId: 'ramp', counter: 'annual', amount: -1, date: '2026-02-01', reason: 'Correction', approvedBy: 'SQNCDR' },
    { id: 'g4', personId: 'tata', counter: 'annual', amount: 20, date: '2026-01-01', reason: 'Annual top-up', approvedBy: 'SQNCDR' },
  ]

  it('sums the grants for one person and one counter', () => {
    expect(grantedTo(ledger, 'ramp', 'annual')).toBe(13)
    expect(grantedTo(ledger, 'ramp', 'oil')).toBe(2)
  })

  // Corrections are negative grants, not a second mechanism — §Counters says
  // one ledger covers top-ups, awards and corrections alike.
  it('lets a correction be a negative amount rather than its own kind', () => {
    expect(grantedTo([ledger[2]], 'ramp', 'annual')).toBe(-1)
  })

  it('is zero for a person or counter with no entries', () => {
    expect(grantedTo(ledger, 'ramp', 'ccl')).toBe(0)
    expect(grantedTo(ledger, 'nobody', 'annual')).toBe(0)
    expect(grantedTo([], 'ramp', 'annual')).toBe(0)
  })
})

describe('balanceOf', () => {
  const openings: Openings = { ramp: { annual: 10, oil: 1 } }
  const ledger: Ledger = [
    { id: 'g1', personId: 'ramp', counter: 'annual', amount: 14, date: '2026-01-01', reason: 'top-up', approvedBy: 'SQNCDR' },
  ]
  const grid: Grid = { ramp: { '2026-01-05': 'LL', '2026-01-06': 'OL', '2026-01-07': 'OIL' } }
  const states: States = {
    ramp: { '2026-01-05': approved(), '2026-01-06': pending, '2026-01-07': approved() },
  }

  it('is the opening figure plus grants less what the grid has drawn', () => {
    // 10 opening + 14 granted - 2 taken (LL approved, OL pending) = 22
    expect(balanceOf(openings, ledger, [{ grid, states }], 'ramp', 'annual')).toBe(22)
    expect(balanceOf(openings, ledger, [{ grid, states }], 'ramp', 'oil')).toBe(0)
  })

  it('treats a missing opening figure as nothing rather than throwing', () => {
    expect(balanceOf({}, [], [{ grid: {}, states: {} }], 'nobody', 'annual')).toBe(0)
    expect(balanceOf(openings, ledger, [{ grid, states }], 'ramp', 'ccl')).toBe(0)
  })

  // §Counters: balances already go negative in the real sheet — annual at
  // −14, OIL at −5.5. Negative shows red and is never refused, so the sum
  // must not clamp.
  it('goes negative rather than clamping at zero', () => {
    const thin: Openings = { ramp: { annual: 1 } }
    expect(balanceOf(thin, [], [{ grid, states }], 'ramp', 'annual')).toBe(-1)
  })

  it('gives a refusal back to the balance', () => {
    const allRefused: States = { ramp: { '2026-01-05': refused, '2026-01-06': refused } }
    expect(balanceOf(openings, ledger, [{ grid, states: allRefused }], 'ramp', 'annual')).toBe(24)
  })

  // Nothing rounds anywhere else in this engine and nothing rounds here.
  it('stays fractional', () => {
    const half: Grid = { ramp: { '2026-01-05': '*LL' } }
    expect(balanceOf({ ramp: { annual: 1 } }, [], [{ grid: half, states: {} }], 'ramp', 'annual')).toBe(0.5)
  })
})

describe('balances across more than one leave war', () => {
  // THE point of the multi-war change, and the thing most easily got wrong.
  // Leave bid in the Jan–Mar war still spends annual leave while you are
  // looking at Apr–Jun. A balance that only counted the war on screen would
  // let the same twenty days be bid twice over.
  const openings: Openings = { ramp: { annual: 20 } }
  const q1 = {
    grid: { ramp: { '2026-02-10': 'LL', '2026-02-11': 'LL' } },
    states: { ramp: { '2026-02-10': approved(), '2026-02-11': approved() } },
  }
  const q2 = {
    grid: { ramp: { '2026-05-10': 'LL', '2026-05-11': '*LL' } },
    states: { ramp: { '2026-05-10': approved(), '2026-05-11': pending } },
  }

  it('draws from every war, not just the one being looked at', () => {
    expect(drawnFrom([q1], 'ramp', 'annual')).toBe(2)
    expect(drawnFrom([q2], 'ramp', 'annual')).toBe(1.5)
    expect(drawnFrom([q1, q2], 'ramp', 'annual')).toBe(3.5)
  })

  it('leaves the balance the same whichever war is open', () => {
    // 20 opening − 3.5 taken across both = 16.5, and the order of the wars
    // must not change it.
    expect(balanceOf(openings, [], [q1, q2], 'ramp', 'annual')).toBe(16.5)
    expect(balanceOf(openings, [], [q2, q1], 'ramp', 'annual')).toBe(16.5)
  })

  it('still honours a refusal in a war that is not on screen', () => {
    const refusedQ2 = {
      grid: q2.grid,
      states: { ramp: { '2026-05-10': refused, '2026-05-11': refused } },
    }
    expect(drawnFrom([q1, refusedQ2], 'ramp', 'annual')).toBe(2)
  })

  it('counts nothing from a war the person has no leave in', () => {
    const empty = { grid: {}, states: {} }
    expect(drawnFrom([q1, empty], 'ramp', 'annual')).toBe(2)
    expect(drawnFrom([], 'ramp', 'annual')).toBe(0)
  })
})

// `OFF` is leave that costs nothing (owner, 10 Aug 26). It is the one leave
// type with no counter, so the risk it carries is the opposite of every other
// code's: not that it draws from the wrong pool, but that it draws from ANY.
describe('free leave draws nothing', () => {
  it('leaves every counter untouched however much OFF is taken', () => {
    const sources = [{
      grid: { ramp: { '2026-01-05': 'OFF', '2026-01-06': 'OFF', '2026-01-07': '*OFF' } },
      states: {},
    }]
    for (const counter of COUNTERS) {
      expect(drawnFrom(sources, 'ramp', counter)).toBe(0)
    }
  })

  it('keeps a balance exactly where it was', () => {
    const openings = { ramp: { annual: 10 } }
    const sources = [{ grid: { ramp: { '2026-01-05': 'OFF' } }, states: {} }]
    expect(balanceOf(openings, [], sources, 'ramp', 'annual')).toBe(10)
  })

  // The contrast that gives the two above their teeth: an ordinary leave type
  // over the same day DOES draw, so a `drawnFrom` that had simply stopped
  // counting would fail here rather than passing all three.
  it('unlike ordinary leave over the same day', () => {
    const sources = [{ grid: { ramp: { '2026-01-05': 'LL' } }, states: {} }]
    expect(drawnFrom(sources, 'ramp', 'annual')).toBe(1)
  })

  // OFF has no counter, so it must not put a column in the panel — a counter
  // nobody can ever have a balance of would be a column of blanks.
  it('adds no counter to the panel', () => {
    expect(COUNTERS).not.toContain(undefined)
    expect(COUNTERS).not.toContain(null)
    expect(COUNTERS).toEqual(['annual', 'oil', 'ccl', 'fcl', 'pl', 'el'])
  })
})
