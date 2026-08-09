import { describe, expect, it } from 'vitest'
import { requirementFor, type Requirement, type Requirements } from './requirements'

const base: Requirement = {
  sets: { amber: 5, red: 4.5 },
  rules: [
    { id: 'ip', label: 'IP', target: { kind: 'category', categories: ['IP'] }, threshold: { amber: 3, red: 2 } },
    { id: 'instr', label: 'IP + IWSO', target: { kind: 'category', categories: ['IP', 'IWSO'] }, threshold: { amber: 5, red: 4 } },
    { id: 'sxo', label: 'SXO', target: { kind: 'sxo' }, threshold: { amber: 1, red: 1 } },
  ],
}

const reqs: Requirements = { default: base, overrides: {} }

describe('requirementFor', () => {
  it('returns the period default for an ordinary day', () => {
    expect(requirementFor(reqs, '2026-01-07')).toBe(base)
  })

  it('returns the override for a day that has one', () => {
    const heavy: Requirement = { sets: { amber: 7, red: 6 }, rules: [] }
    const withOverride: Requirements = { default: base, overrides: { '2026-01-20': heavy } }
    expect(requirementFor(withOverride, '2026-01-20')).toBe(heavy)
    expect(requirementFor(withOverride, '2026-01-21')).toBe(base)
  })

  it('lets a day require no manning at all', () => {
    const none: Requirement = { sets: null, rules: [] }
    const withOverride: Requirements = { default: base, overrides: { '2026-01-25': none } }
    expect(requirementFor(withOverride, '2026-01-25').sets).toBeNull()
  })
})
