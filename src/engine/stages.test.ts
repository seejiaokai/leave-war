import { describe, expect, it } from 'vitest'
import { windowFits, type Period, type Stage } from './period'
import { canDecide, canEdit, canEditCell, nextStage, stageLabel, STAGE_ORDER } from './stages'

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

describe('canEditCell — stage, role and the bidding window together', () => {
  const year = (bidFrom: string | null, bidTo: string | null, stage: Stage = 'open'): Period => ({
    id: 'y', name: 'JAN - DEC 26',
    start: '2026-01-01', end: '2026-12-31',
    stage, bidFrom, bidTo, days: [],
  })

  // The whole point of the window. The year is on screen; the squadron may
  // write to the part of it the schedule has actually reached.
  it('lets a member write inside the window and not outside it', () => {
    const p = year('2026-07-01', '2026-09-30')
    expect(canEditCell(p, 'member', '2026-07-01')).toBe(true)
    expect(canEditCell(p, 'member', '2026-08-15')).toBe(true)
    expect(canEditCell(p, 'member', '2026-09-30')).toBe(true)
    expect(canEditCell(p, 'member', '2026-06-30')).toBe(false)
    expect(canEditCell(p, 'member', '2026-10-01')).toBe(false)
  })

  // Both bounds are INCLUSIVE, and an off-by-one here would silently cost the
  // squadron the first and last day of every window they were told was open.
  it('includes both end dates', () => {
    const p = year('2026-07-01', '2026-09-30')
    expect(canEditCell(p, 'member', '2026-07-01')).toBe(true)
    expect(canEditCell(p, 'member', '2026-09-30')).toBe(true)
  })

  // A war stored before windows existed carries neither bound, and it must go
  // on behaving exactly as it did — open everywhere the stage allows.
  it('opens the whole war when no window is set', () => {
    const p = year(null, null)
    for (const d of ['2026-01-01', '2026-06-15', '2026-12-31']) {
      expect(canEditCell(p, 'member', d)).toBe(true)
    }
  })

  // Half a window is still a window: an open end means "from here on".
  it('honours a one-ended window', () => {
    expect(canEditCell(year('2026-07-01', null), 'member', '2026-06-30')).toBe(false)
    expect(canEditCell(year('2026-07-01', null), 'member', '2026-12-31')).toBe(true)
    expect(canEditCell(year(null, '2026-09-30'), 'member', '2026-10-01')).toBe(false)
    expect(canEditCell(year(null, '2026-09-30'), 'member', '2026-01-01')).toBe(true)
  })

  // The window holds the SQUADRON to the part of the year the schedule has
  // reached. It is not a lock on the people running the war — they close a
  // war precisely so they can work on it without the picture moving.
  it('does not bind an admin', () => {
    const p = year('2026-07-01', '2026-09-30')
    for (const d of ['2026-01-01', '2026-08-15', '2026-12-31']) {
      expect(canEditCell(p, 'admin', d)).toBe(true)
    }
  })

  // The window never OVERRIDES the stage. A closed war is closed to the
  // squadron on every date, window or no window — otherwise closing bidding
  // would stop meaning anything as long as a window was left set.
  it('never opens a date the stage has closed', () => {
    for (const stage of ['draft', 'closed', 'published'] as Stage[]) {
      const p = year('2026-07-01', '2026-09-30', stage)
      expect(canEditCell(p, 'member', '2026-08-15')).toBe(false)
    }
  })
})

describe('windowFits', () => {
  const p: Period = {
    id: 'y', name: 'JAN - DEC 26', start: '2026-01-01', end: '2026-12-31',
    stage: 'open', bidFrom: null, bidTo: null, days: [],
  }

  it('accepts a range inside the war, including its very edges', () => {
    expect(windowFits(p, '2026-07-01', '2026-09-30')).toBe(true)
    expect(windowFits(p, '2026-01-01', '2026-12-31')).toBe(true)
    expect(windowFits(p, '2026-05-04', '2026-05-04')).toBe(true)
  })

  // Refused rather than clamped: an admin who typed the wrong year has made a
  // mistake worth being told about, and sliding their dates to the period's
  // edges would leave them believing they opened something else.
  it('refuses a range that leaves the war at either end', () => {
    expect(windowFits(p, '2025-12-31', '2026-03-31')).toBe(false)
    expect(windowFits(p, '2026-10-01', '2027-01-01')).toBe(false)
  })

  it('refuses a backwards range', () => {
    expect(windowFits(p, '2026-09-30', '2026-07-01')).toBe(false)
  })
})
