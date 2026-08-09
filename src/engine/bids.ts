// A bid is a code plus a state. The code lives in the Grid; the state lives
// here, in a parallel map keyed the same way.
//
// Why parallel rather than making a cell an object: the Grid's shape is what
// storage, the matrix and every engine consumer already read, and widening it
// would touch all of them for a field that only some cells have. The cost of
// the parallel map is that the two can drift, which is why `setCell` owns
// both and is the only thing allowed to write either.

import { codeOf } from './codes'

export type BidState = 'pending' | 'approved' | 'refused'

/** `personId -> date -> state`. Sparse: only bid cells appear. */
export type States = Record<string, Record<string, BidState>>

export function stateOf(states: States, personId: string, date: string): BidState | undefined {
  return states[personId]?.[date]
}

/** Whether a person bids for this code at all. Medical, courses and duty
 *  happen to someone; leave is asked for.
 *
 *  Reads `bid` off the code catalogue rather than holding a list here, so
 *  the eight leave types stay defined in exactly one place — a ninth added
 *  to `LEAVE_TYPES` becomes biddable without anyone remembering this file. */
export function isBiddable(code: string | undefined | null): boolean {
  return codeOf(code)?.bid ?? false
}

/** Whether this cell takes the person out of the manning picture.
 *
 *  A REFUSED bid removes nobody — he asked, he was told no, he is at work.
 *  A PENDING bid does remove: the counts show the worst case, what manning
 *  becomes if everything asked for is granted, because that is what warns a
 *  scheduler while there is still time to act (owner, 9 Aug 26).
 *
 *  A non-bid code always removes, whatever state may somehow be attached —
 *  a stray state must never make a sick man count as available. */
export function removesAvailability(
  code: string | undefined | null,
  state: BidState | undefined,
): boolean {
  if (!isBiddable(code)) return true
  return state !== 'refused'
}
