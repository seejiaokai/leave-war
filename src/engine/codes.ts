// The day-code catalogue. Every code carries four facts so that availability,
// balances and bidding all read from one place rather than each re-deciding
// what a piece of text in a cell means.
//
// The spreadsheet this replaces had no such table: its availability counts
// tested for an EMPTY cell, so `AM` removed a whole person and so did SC duty,
// which is someone at work. `removes` and `duty` exist to end both of those.

export type CounterName = 'annual' | 'oil' | 'ccl' | 'pcl' | 'pl' | 'el' | 'fcl'

export interface DayCode {
  code: string
  label: string
  /** How much of the day the person is unavailable for. */
  removes: 0 | 0.5 | 1
  /** Which counter this draws down, and by how much. */
  spends: { counter: CounterName; amount: number } | null
  /** OIL credited by working this day. */
  earnsOil: 0 | 0.5 | 1
  /** Whether a person bids for this. Medical, courses and duty are not bid. */
  bid: boolean
  /** At work, but off the flying programme — excluded from flying counts. */
  duty: boolean
}

const def = (
  code: string,
  label: string,
  removes: 0 | 0.5 | 1,
  spends: { counter: CounterName; amount: number } | null,
  opts: { earnsOil?: 0 | 0.5 | 1; bid?: boolean; duty?: boolean } = {},
): DayCode => ({
  code,
  label,
  removes,
  spends,
  earnsOil: opts.earnsOil ?? 0,
  bid: opts.bid ?? true,
  duty: opts.duty ?? false,
})

export const CODES: Record<string, DayCode> = {
  LL: def('LL', 'local leave', 1, { counter: 'annual', amount: 1 }),
  AM: def('AM', 'half day leave (morning)', 0.5, { counter: 'annual', amount: 0.5 }),
  PM: def('PM', 'half day leave (afternoon)', 0.5, { counter: 'annual', amount: 0.5 }),
  OL: def('OL', 'overseas leave', 1, { counter: 'annual', amount: 1 }),
  OIL: def('OIL', 'full OIL', 1, { counter: 'oil', amount: 1 }),
  HO: def('HO', 'half OIL', 0.5, { counter: 'oil', amount: 0.5 }),
  CCL: def('CCL', 'child care leave', 1, { counter: 'ccl', amount: 1 }),
  PCL: def('PCL', 'parentcare leave', 1, { counter: 'pcl', amount: 1 }),
  PL: def('PL', 'paternity leave', 1, { counter: 'pl', amount: 1 }),
  EL: def('EL', 'embarkation leave', 1, { counter: 'el', amount: 1 }),
  FCL: def('FCL', 'FCL', 1, { counter: 'fcl', amount: 1 }),
  M: def('M', 'medical (HL/ATT C)', 1, null, { bid: false }),
  HL: def('HL', 'hospitalisation leave', 1, null, { bid: false }),
  CSE: def('CSE', 'course', 1, null, { bid: false }),
  OD: def('OD', 'overseas duty', 1, null, { bid: false }),
  FS: def('FS', 'full day SC duty', 0, null, { earnsOil: 1, bid: false, duty: true }),
  HS: def('HS', 'half day SC duty', 0, null, { earnsOil: 0.5, bid: false, duty: true }),
}

export function codeOf(code: string | undefined | null): DayCode | undefined {
  if (!code) return undefined
  return CODES[code.trim().toUpperCase()]
}

export function isDuty(code: string | undefined | null): boolean {
  return codeOf(code)?.duty ?? false
}
