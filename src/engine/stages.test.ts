import { describe, expect, it } from 'vitest'
import type { Stage } from './period'
import { canDecide, canEdit, nextStage, stageLabel, STAGE_ORDER } from './stages'

describe('stage transitions', () => {
  it('runs draft to open to closed to published', () => {
    expect(STAGE_ORDER).toEqual(['draft', 'open', 'closed', 'published'])
    expect(nextStage('draft')).toBe('open')
    expect(nextStage('open')).toBe('closed')
    expect(nextStage('closed')).toBe('published')
  })

  it('stops at published — there is nowhere further to go', () => {
    expect(nextStage('published')).toBeNull()
  })

  // `nextStage` reads STAGE_ORDER itself, so a caller reordering the exported
  // array in place would rewrite the cycle for the whole app. Frozen, the
  // attempt throws where the bug is instead of surfacing as a wrong
  // transition somewhere else. Cast away `readonly` to make the attempt the
  // compiler would otherwise refuse — the point is what happens at runtime.
  it('refuses to be reordered by a caller mutating the exported array', () => {
    expect(() => (STAGE_ORDER as Stage[]).reverse()).toThrow()
    expect(STAGE_ORDER).toEqual(['draft', 'open', 'closed', 'published'])
    expect(nextStage('draft')).toBe('open')
  })
})

describe('what each stage allows', () => {
  // The squadron edits only while the war is open. Closing it is therefore
  // what makes the sheet view-only for members — there is no separate lock to
  // forget to apply.
  it('lets a member edit only while open', () => {
    expect(canEdit('draft', 'member')).toBe(false)
    expect(canEdit('open', 'member')).toBe(true)
    expect(canEdit('closed', 'member')).toBe(false)
    expect(canEdit('published', 'member')).toBe(false)
  })

  // An admin — scheduler and management alike hold that account — keeps
  // editing after the squadron has been locked out. That is the point of
  // closing: the picture stops moving underneath the people deciding on it,
  // while the people deciding can still correct it.
  it('lets an admin edit at every stage', () => {
    for (const s of STAGE_ORDER) expect(canEdit(s, 'admin')).toBe(true)
  })

  it('accepts decisions only once closed, and only from an admin', () => {
    expect(canDecide('closed', 'admin')).toBe(true)
    expect(canDecide('draft', 'admin')).toBe(false)
    expect(canDecide('open', 'admin')).toBe(false)
    expect(canDecide('published', 'admin')).toBe(false)
    for (const s of STAGE_ORDER) expect(canDecide(s, 'member')).toBe(false)
  })

  it('has a label for every stage', () => {
    for (const s of STAGE_ORDER) expect(stageLabel(s)).toBeTruthy()
  })

  // Bidding and deciding are deliberately disjoint: the owner's reason for a
  // cycle with stages is that a bid cannot arrive underneath a decision
  // already made. No stage may permit both.
  it('never lets a member bid and an admin decide in the same stage', () => {
    for (const s of STAGE_ORDER) expect(canEdit(s, 'member') && canDecide(s, 'admin')).toBe(false)
  })

  // The whole reason roles exist here. Once bidding closes, the two roles
  // must genuinely differ — a build where they agreed everywhere would have
  // no lock at all, and every other test above would still pass.
  it('makes the roles differ exactly where the lock matters', () => {
    const differs = STAGE_ORDER.filter(s => canEdit(s, 'admin') !== canEdit(s, 'member'))
    expect(differs).toEqual(['draft', 'closed', 'published'])
  })
})
