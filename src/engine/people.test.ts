import { describe, expect, it } from 'vitest'
import { categoryOf, inSquadron, type Person } from './people'

const person = (over: Partial<Person> = {}): Person => ({
  id: 'p1',
  callsign: 'RAMP',
  seat: 'pilot',
  band: 'ops',
  sxo: false,
  from: null,
  to: null,
  ...over,
})

describe('categoryOf', () => {
  it('derives all four categories from seat and band', () => {
    expect(categoryOf(person({ seat: 'pilot', band: 'instructor' }))).toBe('IP')
    expect(categoryOf(person({ seat: 'pilot', band: 'ops' }))).toBe('OPSP')
    expect(categoryOf(person({ seat: 'wso', band: 'instructor' }))).toBe('IWSO')
    expect(categoryOf(person({ seat: 'wso', band: 'ops' }))).toBe('OPSW')
  })

  it('does not let the SXO flag change the category', () => {
    expect(categoryOf(person({ seat: 'wso', band: 'ops', sxo: true }))).toBe('OPSW')
  })
})

describe('inSquadron', () => {
  it('counts someone with no dates on any day', () => {
    expect(inSquadron(person(), '2026-01-01')).toBe(true)
  })

  it('stops counting a posted-out member from the day after their last day', () => {
    const p = person({ to: '2026-01-12' })
    expect(inSquadron(p, '2026-01-12')).toBe(true)
    expect(inSquadron(p, '2026-01-13')).toBe(false)
  })

  it('does not count an arrival before their first day', () => {
    const p = person({ from: '2026-02-01' })
    expect(inSquadron(p, '2026-01-31')).toBe(false)
    expect(inSquadron(p, '2026-02-01')).toBe(true)
  })

  it('handles someone who both arrives and leaves inside the period', () => {
    const p = person({ from: '2026-01-10', to: '2026-01-20' })
    expect(inSquadron(p, '2026-01-09')).toBe(false)
    expect(inSquadron(p, '2026-01-15')).toBe(true)
    expect(inSquadron(p, '2026-01-21')).toBe(false)
  })
})
