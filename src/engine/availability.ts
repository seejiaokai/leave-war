// How much of each person each day actually has, and the totals a day is
// judged on.
//
// The sheet this replaces counted EMPTY cells, so a half day of leave cost a
// whole person and SC duty — someone at work — was indistinguishable from
// someone on leave. Both are fixed here: availability is fractional, and duty
// is reported on its own line rather than hidden inside the shortfall.

import { removesAvailability, stateOf, type BidState, type States } from './bids'
import { codeOf, isDuty } from './codes'
import { categoryOf, inSquadron, type Category, type Person } from './people'

/** `personId -> date -> code`. Sparse: most cells are empty. */
export type Grid = Record<string, Record<string, string>>

export interface DayCounts {
  byCategory: Record<Category, number>
  /** Availability of everyone carrying the SXO flag, counted on top of their category. */
  sxo: number
  /** The lesser of available pilots and available WSOs. */
  sets: number
  /** Head count on SC duty — at work, off the flying programme. */
  duty: number
}

export function availabilityOf(
  p: Person,
  date: string,
  code: string | undefined,
  state?: BidState,
): number {
  if (!inSquadron(p, date)) return 0
  const c = codeOf(code)
  // An unknown code must not remove anyone. A typo should look wrong on screen,
  // not quietly delete a person from the manning picture.
  if (!c) return 1
  if (c.duty) return 0
  // A refused bid gives the WHOLE person back, not the fraction the code
  // would have taken — he is at work all day, not half of one. This sits
  // after the two guards above on purpose: a refusal returns a man to the
  // programme, never to a squadron he has left or to a duty he is still on.
  if (!removesAvailability(code, state)) return 1
  return 1 - c.removes
}

export function countsFor(people: Person[], grid: Grid, states: States, date: string): DayCounts {
  const byCategory = { IP: 0, OPSP: 0, IWSO: 0, OPSW: 0 } as Record<Category, number>
  let sxo = 0
  let duty = 0
  let pilots = 0
  let wsos = 0

  for (const p of people) {
    const code = grid[p.id]?.[date]
    if (inSquadron(p, date) && isDuty(code)) duty += 1

    const have = availabilityOf(p, date, code, stateOf(states, p.id, date))
    if (have === 0) continue

    byCategory[categoryOf(p)] += have
    if (p.sxo) sxo += have
    if (p.seat === 'pilot') pilots += have
    else wsos += have
  }

  // A set is a crewed jet: one pilot and one WSO. Whichever seat runs out
  // first caps the number of sets, so the count is the lesser of the two.
  return { byCategory, sxo, sets: Math.min(pilots, wsos), duty }
}
