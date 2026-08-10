// A bid is a code plus a record of what has happened to it. The code lives in
// the Grid; the record lives here, in a parallel map keyed the same way.
//
// Why parallel rather than making a cell an object: the Grid's shape is what
// storage, the matrix and every engine consumer already read, and widening it
// would touch all of them for fields that only some cells have. The cost of
// the parallel map is that the two can drift, which is why `setCell` owns
// both and is the only thing allowed to write either.
//
// Why ONE record rather than a second and third parallel map for source and
// provenance: those facts are written and cleared with the state, never
// apart from it, so keeping them together makes the drift unrepresentable
// instead of merely policed. `reconcile()` in the store guards the one seam
// that remains, which is load.

import { codeOf } from './codes'

/**
 * What has happened to a bid, in the order it happens.
 *
 * The owner's own colour convention, given 10 Aug 26 and unchanged since:
 *
 * | state | on screen |
 * |---|---|
 * | `pending` | plain text on the normal cell background — no colour at all |
 * | `acknowledged` | purple: management has seen it and not yet decided |
 * | `approved` | green |
 * | `refused` | red |
 *
 * `acknowledged` is the state added that day. Until then a bid was purple the
 * instant it was typed, which made "somebody has looked at this" and "nobody
 * has looked at this" the same colour — so a squadron scanning the sheet
 * could not tell an untouched bid from one already in hand. Plain text is the
 * absence of news, and it is the right absence: an input nobody has answered
 * should not be shouting.
 */
export type BidState = 'pending' | 'acknowledged' | 'approved' | 'refused'

/** Which system last wrote this cell.
 *
 *  `raptor` means the leave was entered directly in Raptor's input tab,
 *  which means the person sought approval verbally and already has it. */
export type BidSource = 'bid' | 'raptor'

export interface BidRecord {
  state: BidState
  /** The last authority to write this cell, NOT where it first came from. A
   *  cell round-trips — bid, approved, out to Raptor, edited there, back —
   *  and after that last step Raptor is what owns it. */
  source: BidSource
  /** The date management moved this bid from, when they shifted it. Absent
   *  on a bid that landed where it was asked for. */
  shiftedFrom?: string
}

/** `personId -> date -> record`. Sparse: only bid cells appear. */
export type States = Record<string, Record<string, BidRecord>>

export function recordOf(states: States, personId: string, date: string): BidRecord | undefined {
  return states[personId]?.[date]
}

/** Kept returning a bare `BidState` on purpose. Every existing consumer —
 *  `removesAvailability`, the count rows, the chip colour — asks only what
 *  was decided, and none of them should have to learn about the record to
 *  keep asking it. */
export function stateOf(states: States, personId: string, date: string): BidState | undefined {
  return recordOf(states, personId, date)?.state
}

export function sourceOf(states: States, personId: string, date: string): BidSource | undefined {
  return recordOf(states, personId, date)?.source
}

/** The question every write path asks first. Raptor owns what Raptor last
 *  wrote: it is edited in Raptor's input tab and syncs back here, so editing
 *  it here would leave the two systems disagreeing — which is the single
 *  failure this whole model exists to prevent. */
export function raptorOwns(states: States, personId: string, date: string): boolean {
  return sourceOf(states, personId, date) === 'raptor'
}

export function shiftedFrom(states: States, personId: string, date: string): string | undefined {
  return recordOf(states, personId, date)?.shiftedFrom
}

/** Whether a person bids for this code at all. Medical, courses and duty
 *  happen to someone; leave is asked for.
 *
 *  Reads `bid` off the code catalogue rather than holding a list here, so
 *  the seven leave types stay defined in exactly one place — one added
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
 *  An ACKNOWLEDGED bid removes for the same reason and needed no edit here:
 *  `!== 'refused'` already covered a state that did not exist when it was
 *  written, which is why it was written that way rather than as a list.
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
