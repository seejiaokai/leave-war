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
  // SEVEN, not eight. LL and OL both spend the annual pool, so a list of
  // leave TYPES would show the same figure twice under two names — and it
  // would grow every time a ninth type was added, which the counter list
  // does not.
  it('is the seven entitlements, not the eight leave types', () => {
    expect(COUNTERS).toEqual(['annual', 'oil', 'ccl', 'pcl', 'pl', 'el', 'fcl'])
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
    expect(drawnFrom(grid, states, 'ramp', 'annual')).toBe(2)
  })

  it('draws a half day as half', () => {
    const grid: Grid = { ramp: { '2026-01-07': '*LL' } }
    expect(drawnFrom(grid, { ramp: { '2026-01-07': approved() } }, 'ramp', 'annual')).toBe(0.5)
    const pm: Grid = { ramp: { '2026-01-07': 'LL*' } }
    expect(drawnFrom(pm, { ramp: { '2026-01-07': approved() } }, 'ramp', 'annual')).toBe(0.5)
  })

  it('draws OIL from the OIL counter and nothing from annual', () => {
    const grid: Grid = { ramp: { '2026-01-08': 'OIL' } }
    const states: States = { ramp: { '2026-01-08': approved() } }
    expect(drawnFrom(grid, states, 'ramp', 'oil')).toBe(1)
    expect(drawnFrom(grid, states, 'ramp', 'annual')).toBe(0)
  })

  // The same worst-case rule the manning rows already use, reached through
  // the same function: a pending bid has been asked for, so it cannot be
  // asked for twice.
  it('draws a pending bid, so nobody can bid leave they have already asked for', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL' } }
    expect(drawnFrom(grid, { ramp: { '2026-01-05': pending } }, 'ramp', 'annual')).toBe(1)
  })

  it('draws nothing for a refused bid — he did not get the day', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL' } }
    expect(drawnFrom(grid, { ramp: { '2026-01-05': refused } }, 'ramp', 'annual')).toBe(0)
  })

  it('draws a bid with no decision recorded, which reads as pending', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL' } }
    expect(drawnFrom(grid, {}, 'ramp', 'annual')).toBe(1)
  })

  // Leave entered on Raptor's input tab was approved verbally. It has been
  // taken, so it spends exactly as an approved bid does.
  it('draws leave Raptor owns, the same as an approved bid', () => {
    const grid: Grid = { ramp: { '2026-01-05': 'LL' } }
    expect(drawnFrom(grid, { ramp: { '2026-01-05': approved('raptor') } }, 'ramp', 'annual')).toBe(1)
  })

  it('draws nothing for codes that spend no counter', () => {
    for (const code of ['CSE', 'M', 'OD', 'FS', 'HS']) {
      const grid: Grid = { ramp: { '2026-01-09': code } }
      for (const c of COUNTERS) expect(drawnFrom(grid, {}, 'ramp', c)).toBe(0)
    }
  })

  it('draws nothing for a person with no cells at all', () => {
    expect(drawnFrom({ ramp: { '2026-01-05': 'LL' } }, {}, 'nobody', 'annual')).toBe(0)
  })

  it('sums a whole quarter of mixed cells', () => {
    const grid: Grid = {
      ramp: { '2026-01-05': 'LL', '2026-01-06': 'OL', '2026-01-07': '*LL', '2026-01-09': 'CSE' },
    }
    const states: States = {
      ramp: { '2026-01-05': approved(), '2026-01-06': refused, '2026-01-07': pending },
    }
    // LL approved (1) + OL refused (0) + *LL pending (0.5), course ignored.
    expect(drawnFrom(grid, states, 'ramp', 'annual')).toBe(1.5)
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
    expect(balanceOf(openings, ledger, grid, states, 'ramp', 'annual')).toBe(22)
    expect(balanceOf(openings, ledger, grid, states, 'ramp', 'oil')).toBe(0)
  })

  it('treats a missing opening figure as nothing rather than throwing', () => {
    expect(balanceOf({}, [], {}, {}, 'nobody', 'annual')).toBe(0)
    expect(balanceOf(openings, ledger, grid, states, 'ramp', 'ccl')).toBe(0)
  })

  // §Counters: balances already go negative in the real sheet — annual at
  // −14, OIL at −5.5. Negative shows red and is never refused, so the sum
  // must not clamp.
  it('goes negative rather than clamping at zero', () => {
    const thin: Openings = { ramp: { annual: 1 } }
    expect(balanceOf(thin, [], grid, states, 'ramp', 'annual')).toBe(-1)
  })

  it('gives a refusal back to the balance', () => {
    const allRefused: States = { ramp: { '2026-01-05': refused, '2026-01-06': refused } }
    expect(balanceOf(openings, ledger, grid, allRefused, 'ramp', 'annual')).toBe(24)
  })

  // Nothing rounds anywhere else in this engine and nothing rounds here.
  it('stays fractional', () => {
    const half: Grid = { ramp: { '2026-01-05': '*LL' } }
    expect(balanceOf({ ramp: { annual: 1 } }, [], half, {}, 'ramp', 'annual')).toBe(0.5)
  })
})
