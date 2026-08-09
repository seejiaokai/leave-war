import { describe, expect, it } from 'vitest'
import { isBiddable } from './bids'
import { codeOf } from './codes'
import { evaluateDay } from './evaluate'
import { seedGrid, seedPeople, seedPeriod, seedRequirements, seedStates } from './seed'

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

  it('gives every seeded person a unique id', () => {
    // Duplicate callsigns would collide on id (lowercased callsign), giving
    // duplicate React keys and a shared grid row between two people.
    const ids = seedPeople().map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
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
      expect(['ok', 'amber', 'red']).toContain(evaluateDay(people, grid, seedStates(), reqs, day.date).verdict)
    }
  })

  it('grid ids all resolve to real people', () => {
    const people = seedPeople()
    const peopleIds = new Set(people.map(p => p.id))
    const grid = seedGrid()
    // Without this, seedGrid() returning {} would pass the loop below
    // vacuously — assert the collection actually has something to check.
    expect(Object.keys(grid).length).toBeGreaterThan(0)
    for (const id of Object.keys(grid)) {
      if (!peopleIds.has(id)) {
        throw new Error(`grid contains unknown id: ${id}`)
      }
    }
  })

  it('grid codes all resolve in the catalogue', () => {
    const grid = seedGrid()
    const allCodes = Object.values(grid).flatMap(days => Object.values(days))
    // Without this, an empty grid (or one whose rows are all empty) would
    // pass the loop below vacuously — assert there is something to check.
    expect(allCodes.length).toBeGreaterThan(0)
    for (const [id, days] of Object.entries(grid)) {
      for (const [date, code] of Object.entries(days)) {
        const resolved = codeOf(code)
        if (resolved === undefined) {
          throw new Error(`grid[${id}]['${date}'] has unknown code: ${code}`)
        }
      }
    }
  })
})

describe('seedStates', () => {
  it('shows all three states so the screen exercises every colour', () => {
    const seen = new Set(Object.values(seedStates()).flatMap(r => Object.values(r)))
    expect(seen).toEqual(new Set(['pending', 'approved', 'refused']))
  })

  it('never records a state for a cell that has no code', () => {
    const grid = seedGrid()
    for (const [id, row] of Object.entries(seedStates())) {
      for (const date of Object.keys(row)) {
        if (!grid[id]?.[date]) throw new Error(`state with no code: ${id} ${date}`)
      }
    }
    expect(Object.keys(seedStates()).length).toBeGreaterThan(0)
  })

  it('never records a state for a code nobody bids for', () => {
    const grid = seedGrid()
    for (const [id, row] of Object.entries(seedStates())) {
      for (const date of Object.keys(row)) {
        if (!isBiddable(grid[id][date])) throw new Error(`state on a non-bid code: ${id} ${date}`)
      }
    }
    expect(Object.keys(seedStates()).length).toBeGreaterThan(0)
  })

  // The two loops above walk `seedStates()` and would pass vacuously against
  // a row that exists but is empty. Count the entries, not the rows.
  it('records enough states to be worth walking', () => {
    const entries = Object.values(seedStates()).flatMap(r => Object.keys(r))
    expect(entries.length).toBeGreaterThan(5)
  })

  // A state on a person the roster does not hold would paint nothing and
  // point at nobody — the same class of bug as a grid row with an unknown id,
  // which the grid tests above already guard.
  it('names only people the roster actually holds', () => {
    const ids = new Set(seedPeople().map(p => p.id))
    for (const id of Object.keys(seedStates())) {
      if (!ids.has(id)) throw new Error(`state for unknown id: ${id}`)
    }
    expect(Object.keys(seedStates()).length).toBeGreaterThan(0)
  })
})
