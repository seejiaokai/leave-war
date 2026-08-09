// The cycle a leave war moves through, and what each stage allows.
//
// Forward only. There is deliberately no way back: reopening a closed period
// would mean bids arriving against decisions already made, and the owner
// chose a cycle with stages precisely so that "why did this change after I
// bid" always has an answer. A period that needs reopening is a new period.

import type { Stage } from './period'

// Frozen, and typed `readonly`, because an exported array is mutable by
// whoever imports it: a caller who sorted or reversed it in place would
// silently rewrite the cycle for the whole app, and `nextStage` reads this
// same array. Frozen it throws at the mutation instead, which is where the
// bug is rather than three screens away in a wrong transition.
export const STAGE_ORDER: readonly Stage[] = Object.freeze<Stage[]>([
  'draft',
  'open',
  'closed',
  'published',
])

const LABEL: Record<Stage, string> = {
  draft: 'DRAFT',
  open: 'OPEN FOR BIDDING',
  closed: 'BIDDING CLOSED',
  published: 'PUBLISHED',
}

export function nextStage(stage: Stage): Stage | null {
  const i = STAGE_ORDER.indexOf(stage)
  return i < 0 || i === STAGE_ORDER.length - 1 ? null : STAGE_ORDER[i + 1]
}

/** Bids are placed only while the period is open. */
export function canBid(stage: Stage): boolean {
  return stage === 'open'
}

/** Decisions are made once bidding has closed and the picture has frozen —
 *  not while bids are still arriving underneath them. */
export function canDecide(stage: Stage): boolean {
  return stage === 'closed'
}

export function stageLabel(stage: Stage): string {
  return LABEL[stage]
}
