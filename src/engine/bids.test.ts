import { describe, expect, it } from 'vitest'
import {
  isBiddable,
  raptorOwns,
  removesAvailability,
  shiftedFrom,
  sourceOf,
  stateOf,
  type States,
} from './bids'

const states: States = {
  ramp: {
    '2026-01-05': { state: 'approved', source: 'bid' },
    '2026-01-06': { state: 'refused', source: 'bid' },
  },
}

describe('stateOf', () => {
  it('returns the state where one is recorded', () => {
    expect(stateOf(states, 'ramp', '2026-01-05')).toBe('approved')
  })

  it('returns undefined where none is, without throwing on an unknown person', () => {
    expect(stateOf(states, 'ramp', '2026-01-09')).toBeUndefined()
    expect(stateOf(states, 'nobody', '2026-01-05')).toBeUndefined()
  })
})

describe('isBiddable', () => {
  it('is true for leave a person bids for, whole day or half', () => {
    for (const c of ['LL', 'OL', 'OIL', 'CCL', 'FCL', 'PL', 'EL', '*LL', 'LL*', '*OIL']) {
      expect(isBiddable(c)).toBe(true)
    }
  })

  it('is false for medical, courses and duty — nobody bids for those', () => {
    for (const c of ['M', 'CSE', 'OD', 'FS', 'HS']) expect(isBiddable(c)).toBe(false)
  })

  it('is false for an unknown or empty code', () => {
    expect(isBiddable('ZZZ')).toBe(false)
    expect(isBiddable('')).toBe(false)
    expect(isBiddable(undefined)).toBe(false)
    expect(isBiddable(null)).toBe(false)
  })

  // `*M` and `FS*` parse to null rather than to a portioned marker, so they
  // are unknown codes, not biddable ones. Asserted because the opposite —
  // an asterisk quietly promoting a marker into a bid — is exactly the class
  // of bug the leave-code rework existed to end.
  it('is false for an asterisk stuck on something that is not leave', () => {
    for (const c of ['*M', 'CSE*', '*FS']) expect(isBiddable(c)).toBe(false)
  })
})

describe('removesAvailability', () => {
  it('removes for a pending bid — the counts show the worst case', () => {
    expect(removesAvailability('LL', 'pending')).toBe(true)
  })

  it('removes for an approved bid', () => {
    expect(removesAvailability('LL', 'approved')).toBe(true)
  })

  it('removes NOBODY for a refused bid — he is working that day', () => {
    expect(removesAvailability('LL', 'refused')).toBe(false)
    expect(removesAvailability('*LL', 'refused')).toBe(false)
  })

  it('removes for a non-bid code regardless of any stray state', () => {
    // Medical is not bid for, so a state should never exist; if one does,
    // it must not make a sick man count as available.
    expect(removesAvailability('M', undefined)).toBe(true)
    expect(removesAvailability('M', 'refused')).toBe(true)
  })

  it('removes for a bid code with no state recorded', () => {
    expect(removesAvailability('LL', undefined)).toBe(true)
  })
})

describe('the bid record', () => {
  // A bid now carries three facts, not one: what was decided, which system
  // last wrote it, and whether management moved it to get here. They live in
  // ONE record rather than three parallel maps so they cannot drift apart.
  const rich: States = {
    ramp: {
      '2026-01-05': { state: 'approved', source: 'bid' },
      '2026-01-06': { state: 'approved', source: 'raptor' },
      '2026-01-07': { state: 'pending', source: 'bid', shiftedFrom: '2026-01-02' },
    },
  }

  it('reads the state out of the record, so every existing consumer is unchanged', () => {
    expect(stateOf(rich, 'ramp', '2026-01-05')).toBe('approved')
    expect(stateOf(rich, 'ramp', '2026-01-09')).toBeUndefined()
    expect(stateOf(rich, 'nobody', '2026-01-05')).toBeUndefined()
  })

  it('reads the source, and defaults nothing — an absent record has no source', () => {
    expect(sourceOf(rich, 'ramp', '2026-01-05')).toBe('bid')
    expect(sourceOf(rich, 'ramp', '2026-01-06')).toBe('raptor')
    expect(sourceOf(rich, 'ramp', '2026-01-09')).toBeUndefined()
  })

  // The one question every write path asks before touching a cell. Raptor
  // owns what Raptor last wrote; changing it here would desync the two
  // systems, which is the whole failure this model exists to prevent.
  it('says which cells Raptor owns', () => {
    expect(raptorOwns(rich, 'ramp', '2026-01-06')).toBe(true)
    expect(raptorOwns(rich, 'ramp', '2026-01-05')).toBe(false)
    expect(raptorOwns(rich, 'ramp', '2026-01-09')).toBe(false)
    expect(raptorOwns(rich, 'nobody', '2026-01-09')).toBe(false)
  })

  it('carries the date a shifted bid was moved from', () => {
    expect(shiftedFrom(rich, 'ramp', '2026-01-07')).toBe('2026-01-02')
    expect(shiftedFrom(rich, 'ramp', '2026-01-05')).toBeUndefined()
  })

  // Source and state are orthogonal in the type but not in practice: nothing
  // is allowed to write a raptor record that is not approved, because a
  // Raptor input IS the approval. The store enforces it; this pins that
  // `removesAvailability` would do the right thing regardless.
  it('removes a raptor-owned cell from the manning picture', () => {
    expect(removesAvailability('LL', stateOf(rich, 'ramp', '2026-01-06'))).toBe(true)
  })
})
