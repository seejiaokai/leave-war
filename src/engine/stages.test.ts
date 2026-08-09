import { describe, expect, it } from 'vitest'
import type { Stage } from './period'
import { canBid, canDecide, nextStage, stageLabel, STAGE_ORDER } from './stages'

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
  it('accepts bids only while open', () => {
    expect(canBid('draft')).toBe(false)
    expect(canBid('open')).toBe(true)
    expect(canBid('closed')).toBe(false)
    expect(canBid('published')).toBe(false)
  })

  it('accepts decisions only once closed', () => {
    expect(canDecide('draft')).toBe(false)
    expect(canDecide('open')).toBe(false)
    expect(canDecide('closed')).toBe(true)
    expect(canDecide('published')).toBe(false)
  })

  it('has a label for every stage', () => {
    for (const s of STAGE_ORDER) expect(stageLabel(s)).toBeTruthy()
  })

  // Bidding and deciding are deliberately disjoint: the owner's reason for a
  // cycle with stages is that a bid cannot arrive underneath a decision
  // already made. No stage may permit both.
  it('never allows bidding and deciding in the same stage', () => {
    for (const s of STAGE_ORDER) expect(canBid(s) && canDecide(s)).toBe(false)
  })
})
