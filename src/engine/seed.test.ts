import { describe, expect, it } from 'vitest'
import { isBiddable } from './bids'
import { codeOf } from './codes'
import { evaluateDay } from './evaluate'
import { balanceOf, COUNTERS } from './counters'
import { overlapping } from './wars'
import { seedGrid, seedLedger, seedOpenings, seedPeople, seedPeriod, seedRequirements, seedStates, seedWars } from './seed'

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

  // The seeded war is a WHOLE YEAR, not a quarter. A quarter was the first
  // shape this took, and it is still the common case in the reference
  // workbook — but the owner reads the year at once and jumps to a month to
  // navigate, so the seed has to be the thing they actually look at.
  it('covers the whole of 2026', () => {
    const period = seedPeriod()
    expect(period.start).toBe('2026-01-01')
    expect(period.end).toBe('2026-12-31')
    expect(period.days).toHaveLength(365)
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
  it('shows all four states so the screen exercises every colour', () => {
    const seen = new Set(Object.values(seedStates()).flatMap(r => Object.values(r).map(v => v.state)))
    expect(seen).toEqual(new Set(['pending', 'acknowledged', 'approved', 'refused']))
  })

  // Both sources have to render on first run for the same reason all three
  // states do: nobody can judge a surface that never appears.
  it('shows a cell Raptor owns as well as ones the squadron bid for', () => {
    const seen = new Set(Object.values(seedStates()).flatMap(r => Object.values(r).map(v => v.source)))
    expect(seen).toEqual(new Set(['bid', 'raptor']))
  })

  // A Raptor input IS the approval — the person asked verbally and was told
  // yes before Leave War ever saw it. A seeded raptor cell in any other
  // state would be a shape the store refuses to write.
  it('never seeds a raptor cell that is not approved', () => {
    for (const [id, row] of Object.entries(seedStates())) {
      for (const [date, record] of Object.entries(row)) {
        if (record.source === 'raptor' && record.state !== 'approved') {
          throw new Error(`raptor cell not approved: ${id} ${date}`)
        }
      }
    }
    const raptor = Object.values(seedStates()).flatMap(r => Object.values(r)).filter(v => v.source === 'raptor')
    expect(raptor.length).toBeGreaterThan(0)
  })

  // A shift records the date it came from, and that date must be EMPTY in
  // the grid — the bid moved off it. A shiftedFrom pointing at a cell that
  // still holds a code would mean the move never happened.
  it('seeds a shifted bid whose original date is now empty', () => {
    const grid = seedGrid()
    const shifted = Object.entries(seedStates()).flatMap(([id, row]) =>
      Object.entries(row).filter(([, v]) => v.shiftedFrom).map(([date, v]) => ({ id, date, from: v.shiftedFrom! })),
    )
    expect(shifted.length).toBeGreaterThan(0)
    for (const s of shifted) {
      if (grid[s.id]?.[s.from]) throw new Error(`shiftedFrom still holds a code: ${s.id} ${s.from}`)
      // A shift lands pending: management still has to approve where they moved it to.
      expect(seedStates()[s.id][s.date].state).toBe('pending')
    }
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

describe('seeded balances', () => {
  it('gives every person on the roster an opening figure', () => {
    const openings = seedOpenings()
    for (const p of seedPeople()) {
      if (!openings[p.id]) throw new Error(`no opening balance for ${p.id}`)
    }
    expect(Object.keys(openings).length).toBeGreaterThan(0)
  })

  it('opens no counter that is not one of the seven', () => {
    for (const [id, row] of Object.entries(seedOpenings())) {
      for (const counter of Object.keys(row)) {
        if (!COUNTERS.includes(counter as never)) throw new Error(`unknown counter ${counter} for ${id}`)
      }
    }
  })

  it('posts every ledger entry against a real person and a real counter', () => {
    const ids = new Set(seedPeople().map(p => p.id))
    const entries = seedLedger()
    expect(entries.length).toBeGreaterThan(0)
    for (const e of entries) {
      if (!ids.has(e.personId)) throw new Error(`ledger entry for unknown id: ${e.personId}`)
      if (!COUNTERS.includes(e.counter)) throw new Error(`ledger entry for unknown counter: ${e.counter}`)
      // Every entry has to say WHY and WHO — that traceability is the whole
      // point of the ledger, and an entry without it is the untraceable free
      // text this replaces.
      expect(e.reason).toBeTruthy()
      expect(e.approvedBy).toBeTruthy()
    }
  })

  it('gives every ledger entry a unique id', () => {
    const ids = seedLedger().map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // §Counters: negative shows red and is never refused. A screen where every
  // figure is positive cannot show that rule working, so the seed has to
  // carry at least one of each sign.
  it('shows a negative balance as well as positive ones, so red renders', () => {
    const [openings, ledger] = [seedOpenings(), seedLedger()]
    const all = seedPeople().flatMap(p => COUNTERS.map(c => balanceOf(openings, ledger, seedWars(), p.id, c)))
    expect(all.some(v => v < 0)).toBe(true)
    expect(all.some(v => v > 0)).toBe(true)
  })

  // A correction posted as a negative amount is the mechanism §Counters
  // describes; seeding one keeps it from being theoretical.
  it('includes a correction posted as a negative amount', () => {
    expect(seedLedger().some(e => e.amount < 0)).toBe(true)
  })
})

describe('seedWars', () => {
  it('seeds more than one, so switching between them is a real thing to do', () => {
    expect(seedWars().length).toBeGreaterThan(1)
  })

  // The next war is normally a draft while its schedule is still being
  // firmed up. Seeding one open and one draft shows both states at once.
  it('opens the first and leaves the next in draft', () => {
    const [q1, q2] = seedWars()
    expect(q1.period.stage).toBe('open')
    expect(q2.period.stage).toBe('draft')
  })

  // A date belongs to at most one war. Two seeded wars sharing a day would
  // double-count a man in the manning rows and draw his balance twice.
  it('never seeds two wars that share a day', () => {
    const wars = seedWars()
    for (let i = 0; i < wars.length; i++) {
      for (let j = i + 1; j < wars.length; j++) {
        if (overlapping(wars[i].period, wars[j].period)) {
          throw new Error(`seeded wars overlap: ${wars[i].period.id} and ${wars[j].period.id}`)
        }
      }
    }
    expect(wars.length).toBeGreaterThan(1)
  })

  it('gives every war a unique id', () => {
    const ids = seedWars().map(w => w.period.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // The second war has to hold leave of its own, or the cross-war balance
  // rule has nothing to prove on first run.
  it('puts leave in the second war too, drawing the same counters', () => {
    const [, q2] = seedWars()
    expect(Object.keys(q2.grid).length).toBeGreaterThan(0)
    for (const [id, row] of Object.entries(q2.grid)) {
      for (const date of Object.keys(row)) {
        if (date < q2.period.start || date > q2.period.end) {
          throw new Error(`leave outside its war: ${id} ${date}`)
        }
      }
    }
  })

  it('keeps every seeded cell inside the war that holds it', () => {
    for (const w of seedWars()) {
      for (const [id, row] of Object.entries(w.grid)) {
        for (const date of Object.keys(row)) {
          if (date < w.period.start || date > w.period.end) {
            throw new Error(`${w.period.id} holds ${id} ${date}, outside ${w.period.start}..${w.period.end}`)
          }
        }
      }
    }
    expect(seedWars().length).toBeGreaterThan(0)
  })
})
