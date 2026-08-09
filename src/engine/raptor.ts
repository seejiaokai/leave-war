// What crosses to Raptor, and why it is derived rather than queued.
//
// The owner's rule: once a leave is green, Raptor takes it as a personal
// input on the schedule. So the payload is simply "every approved cell the
// squadron bid for" — a question the grid and the states already answer
// between them.
//
// Deriving it rather than keeping a queue is deliberate. A queue would be a
// second record of a fact the grid already holds, and two records of one fact
// disagree: a bid refused after being queued would sit there waiting to be
// sent, and nothing would ever notice. Derived, the payload cannot describe a
// leave war that does not exist.
//
// Nothing sends this yet. The wire, and the shape Raptor receives, are the
// contract document's business — this is the answer that document describes.

import type { Grid } from './availability'
import { sourceOf, stateOf, type States } from './bids'
import { isBiddable } from './bids'

export interface OutboundLeave {
  personId: string
  date: string
  /** The stored notation, unaltered — `LL`, `*LL`, `OIL*`. Raptor needs a
   *  portion field before it can receive the half-day forms at all. */
  code: string
}

export function outboundToRaptor(grid: Grid, states: States): OutboundLeave[] {
  const out: OutboundLeave[] = []
  // Walked in a fixed person-then-date order so two runs over the same leave
  // war compare equal. A payload whose order wandered would look like a
  // change to anything diffing it.
  for (const personId of Object.keys(grid).sort()) {
    for (const date of Object.keys(grid[personId]).sort()) {
      const code = grid[personId][date]
      if (!isBiddable(code)) continue
      if (stateOf(states, personId, date) !== 'approved') continue
      // A cell Raptor owns came FROM Raptor. Sending it back would be this
      // app telling Raptor something Raptor told it, which is how a sync
      // loop starts.
      if (sourceOf(states, personId, date) === 'raptor') continue
      out.push({ personId, date, code })
    }
  }
  return out
}
