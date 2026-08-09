import { describe, expect, it } from 'vitest'
import { isBiddable, removesAvailability, stateOf, type States } from './bids'

const states: States = { ramp: { '2026-01-05': 'approved', '2026-01-06': 'refused' } }

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
    for (const c of ['LL', 'OL', 'OIL', 'CCL', 'PCL', 'PL', 'EL', 'FCL', '*LL', 'LL*', '*OIL']) {
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
