import { describe, expect, it } from 'vitest'
import { evaluateDay } from './evaluate'
import { seedGrid, seedPeople, seedPeriod, seedRequirements } from './seed'

describe('seed', () => {
  it('has a roster with all four categories represented', () => {
    const people = seedPeople()
    expect(people.length).toBeGreaterThanOrEqual(12)
    const seats = new Set(people.map(p => `${p.seat}-${p.band}`))
    expect(seats).toEqual(new Set(['pilot-instructor', 'pilot-ops', 'wso-instructor', 'wso-ops']))
  })

  it('has exactly one SXO', () => {
    expect(seedPeople().filter(p => p.sxo)).toHaveLength(1)
  })

  it('has someone posted out mid-quarter so the roster dates are exercised', () => {
    expect(seedPeople().some(p => p.to !== null)).toBe(true)
  })

  it('covers the first quarter of 2026', () => {
    const period = seedPeriod()
    expect(period.start).toBe('2026-01-01')
    expect(period.end).toBe('2026-03-31')
    expect(period.days).toHaveLength(90)
  })

  it('marks New Year as a public holiday and blocks at least one day', () => {
    const period = seedPeriod()
    expect(period.days[0].ph).toBe(true)
    expect(period.days.some(d => d.blocked)).toBe(true)
  })

  it('evaluates every seeded day without throwing', () => {
    const people = seedPeople()
    const grid = seedGrid()
    const reqs = seedRequirements()
    for (const day of seedPeriod().days) {
      expect(['ok', 'amber', 'red']).toContain(evaluateDay(people, grid, reqs, day.date).verdict)
    }
  })
})
