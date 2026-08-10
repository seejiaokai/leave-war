// Balances: what each person has left of each entitlement.
//
// A balance is DERIVED, never stored. It is the opening figure, plus what
// the ledger has granted, less what the grid has drawn. The grid is already
// the record of what leave was taken, so posting a second copy of that into
// the ledger would give two records of one fact — and two records of one
// fact disagree. The ledger holds only what the grid cannot know: top-ups,
// awards and corrections.
//
// The spec's §Counters says every change to a counter is a ledger entry.
// This narrows that to every change the grid does not already hold, for the
// reason above; the audit trail it exists for is intact, because "why is my
// annual 22" is answered by an opening figure, a list of grants, and the
// leave visible on the person's own row.
//
// NOT here, and deliberately: OIL EARNED by working. The spec's rule turns
// on knock-off time — later than 14:30 credits 1.0, at or before credits
// 0.5 — and nothing in this app carries a knock-off time yet. See
// `docs/known-gaps.md`.

import type { Grid } from './availability'
import { removesAvailability, stateOf, type States } from './bids'
import { codeOf, LEAVE_TYPES, type CounterName } from './codes'

/**
 * The counters, in the order the interface cycles them.
 *
 * One fewer than there are leave types: `LL` and `OL` both spend the annual
 * pool, so a list of leave types would show the same figure twice under two
 * names. Derived from the catalogue rather than written out again, so a leave
 * type added or removed changes this list without anyone remembering the
 * file — removing `FCL` on 10 Aug 26 took its counter with it and needed no
 * edit here. Frozen for the same reason `STAGE_ORDER` is: an exported array
 * is mutable by whoever imports it.
 */
export const COUNTERS: readonly CounterName[] = Object.freeze(
  // `OFF` carries no counter — it is leave that spends no entitlement — so
  // the nulls are dropped rather than becoming a column of nothing.
  [...new Set(LEAVE_TYPES.map(t => t.counter).filter((c): c is CounterName => c !== null))],
)

const LABEL: Record<CounterName, string> = {
  annual: 'ANNUAL',
  oil: 'OIL',
  ccl: 'CCL',
  fcl: 'FCL',
  pl: 'PL',
  el: 'EL',
}

export function counterLabel(counter: CounterName): string {
  return LABEL[counter]
}

/** One movement on a counter that the grid cannot account for: a top-up, an
 *  award, or a correction. A correction is simply a negative amount rather
 *  than a second kind of thing. */
export interface LedgerEntry {
  id: string
  personId: string
  counter: CounterName
  amount: number
  date: string
  reason: string
  approvedBy: string
}

export type Ledger = LedgerEntry[]

/** `personId -> counter -> opening figure`. Sparse: an absent counter opens
 *  at nothing rather than being an error. */
export type Openings = Record<string, Partial<Record<CounterName, number>>>

export function grantedTo(ledger: Ledger, personId: string, counter: CounterName): number {
  let total = 0
  for (const e of ledger) {
    if (e.personId === personId && e.counter === counter) total += e.amount
  }
  return total
}

/** Just enough of a leave war to draw a counter from. `LeaveWar` satisfies
 *  it structurally, so callers pass their wars straight in. */
export interface LeaveSource {
  grid: Grid
  states: States
}

/**
 * How much of one counter this person's leave has spent, **across every
 * leave war**.
 *
 * Taking a list rather than one war is the whole point: entitlements are
 * continuous and leave wars are windows onto them. Annual leave does not
 * reset when a quarter closes, so leave bid in Jan–Mar still spends it while
 * someone is looking at Apr–Jun. A figure counting only the war on screen
 * would let the same twenty days be bid twice over, once in each.
 *
 * Which cells count is decided by `removesAvailability` — the SAME function
 * the manning rows use, not a second copy of the rule. So a refused bid
 * draws nothing, a pending one draws in full, and a half day draws 0.5,
 * exactly as the counts on screen already behave.
 */
export function drawnFrom(
  sources: LeaveSource[],
  personId: string,
  counter: CounterName,
): number {
  let total = 0
  for (const { grid, states } of sources) {
    for (const [date, code] of Object.entries(grid[personId] ?? {})) {
      const spends = codeOf(code)?.spends
      if (!spends || spends.counter !== counter) continue
      if (!removesAvailability(code, stateOf(states, personId, date))) continue
      total += spends.amount
    }
  }
  return total
}

/**
 * What this person has left of this counter.
 *
 * Never clamped: balances already go negative in the squadron's own sheet —
 * annual at −14, OIL at −5.5 — and §Counters is explicit that negative shows
 * red and is never refused. Clamping here would hide the very thing the
 * figure exists to show.
 */
export function balanceOf(
  openings: Openings,
  ledger: Ledger,
  sources: LeaveSource[],
  personId: string,
  counter: CounterName,
): number {
  const opening = openings[personId]?.[counter] ?? 0
  return opening + grantedTo(ledger, personId, counter) - drawnFrom(sources, personId, counter)
}
