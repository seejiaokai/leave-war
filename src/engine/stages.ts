// The cycle a leave war moves through, and what each stage allows.
//
// Forward only. There is deliberately no way back: reopening a closed period
// would mean bids arriving against decisions already made, and the owner
// chose a cycle with stages precisely so that "why did this change after I
// bid" always has an answer. A period that needs reopening is a new period.

import { inBidWindow, type Period, type Stage } from './period'

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

/**
 * Two roles, per the spec's §Roles. The scheduler and management both hold
 * the admin account — the further split between them is a distinction the
 * owner draws in conversation, and it needs real accounts before it can mean
 * anything here.
 *
 * There is no login, so nothing verifies which of these a person actually
 * is. This is the affordance model, not a permission model — see
 * `docs/known-gaps.md`.
 */
export type Role = 'member' | 'admin'

/**
 * Whether this role may write cells at this stage.
 *
 * A member edits only while the war is open, so **closing it is what makes
 * the sheet view-only for the squadron** — there is no second lock that
 * could be left unapplied. An admin edits throughout, because the reason for
 * closing is to stop the picture moving underneath the people deciding on
 * it, not to stop those people correcting it.
 */
export function canEdit(stage: Stage, role: Role): boolean {
  return role === 'admin' || stage === 'open'
}

/**
 * Whether this role may write THIS CELL — stage, role and the bidding window
 * together.
 *
 * A separate function rather than a wider `canEdit`, deliberately. `canEdit`
 * answers "is the sheet writable at all", which is what the stage strip and
 * the role toggle ask and what four files already read; this answers "is that
 * particular day writable", which only the grid asks. Widening the first
 * would have made every caller pass a date it does not have.
 *
 * **An admin is not bound by the window.** The window exists to stop the
 * squadron bidding on months the schedule has not reached — it is not a lock
 * on the people running the war, who close it precisely so they can work on
 * it without the picture moving underneath them.
 */
export function canEditCell(period: Period, role: Role, date: string): boolean {
  if (!canEdit(period.stage, role)) return false
  return role === 'admin' || inBidWindow(period, date)
}

/** Decisions are made once bidding has closed and the picture has frozen —
 *  not while bids are still arriving underneath them — and only by an
 *  admin. A member watching the same screen sees the outcome, not the
 *  buttons. */
export function canDecide(stage: Stage, role: Role): boolean {
  return role === 'admin' && stage === 'closed'
}

export function stageLabel(stage: Stage): string {
  return LABEL[stage]
}
