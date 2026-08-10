// The months a leave war covers, for the strip that jumps between them.
//
// A year is 365 columns and about 13,600 pixels wide. Nobody finds September
// by dragging, so the strip is not a convenience — it is how a year-long war
// is navigable at all.

import { addDays } from './period'

const NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export interface MonthJump {
  label: string
  /** The date to scroll to — the first day of that month THAT THE WAR HOLDS.
   *  A war starting on the 12th has no column for the 1st, and jumping to a
   *  cell that is not rendered would scroll nowhere. */
  first: string
}

export function monthsIn(start: string, end: string): MonthJump[] {
  // Only disambiguate with the year when the war actually crosses one —
  // "JAN" is clear in a single-year war and "JAN 26" is just noise there.
  const spansYears = start.slice(0, 4) !== end.slice(0, 4)

  const out: MonthJump[] = []
  let seen = ''
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key = d.slice(0, 7)
    if (key === seen) continue
    seen = key
    const name = NAMES[Number(d.slice(5, 7)) - 1]
    out.push({ label: spansYears ? `${name} ${d.slice(2, 4)}` : name, first: d })
  }
  return out
}
