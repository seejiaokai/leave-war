import { describe, expect, it } from 'vitest'
import { availabilityOf, countsFor, type Grid } from './availability'
import type { States } from './bids'
import type { Person } from './people'

const p = (id: string, seat: 'pilot' | 'wso', band: 'instructor' | 'ops', over: Partial<Person> = {}): Person => ({
  id, callsign: id.toUpperCase(), seat, band, sxo: false, from: null, to: null, ...over,
})

describe('availabilityOf', () => {
  const someone = p('a', 'pilot', 'ops')

  it('counts a free person as a whole person', () => {
    expect(availabilityOf(someone, '2026-01-05', undefined)).toBe(1)
  })

  it('counts a half day as half a person, which the spreadsheet could not', () => {
    expect(availabilityOf(someone, '2026-01-05', '*LL')).toBe(0.5)
    expect(availabilityOf(someone, '2026-01-05', '*OIL')).toBe(0.5)
  })

  it('counts a full day of leave as nobody', () => {
    expect(availabilityOf(someone, '2026-01-05', 'LL')).toBe(0)
    expect(availabilityOf(someone, '2026-01-05', 'OD')).toBe(0)
  })

  it('does not count someone on SC duty toward flying, though they are at work', () => {
    expect(availabilityOf(someone, '2026-01-05', 'FS')).toBe(0)
    expect(availabilityOf(someone, '2026-01-05', 'HS')).toBe(0)
  })

  it('does not count someone who has been posted out', () => {
    const gone = p('b', 'pilot', 'ops', { to: '2026-01-12' })
    expect(availabilityOf(gone, '2026-01-12', undefined)).toBe(1)
    expect(availabilityOf(gone, '2026-01-13', undefined)).toBe(0)
  })

  it('treats an unknown code as no effect rather than removing the person', () => {
    expect(availabilityOf(someone, '2026-01-05', 'ZZZ')).toBe(1)
  })
})

describe('countsFor', () => {
  const people: Person[] = [
    p('ip1', 'pilot', 'instructor'),
    p('ip2', 'pilot', 'instructor'),
    p('op1', 'pilot', 'ops'),
    p('iw1', 'wso', 'instructor'),
    p('ow1', 'wso', 'ops'),
    p('ow2', 'wso', 'ops', { sxo: true }),
  ]

  it('counts each category', () => {
    const c = countsFor(people, {}, {}, '2026-01-05')
    expect(c.byCategory).toEqual({ IP: 2, OPSP: 1, IWSO: 1, OPSW: 2 })
  })

  it('counts SXO separately without removing them from their own category', () => {
    const c = countsFor(people, {}, {}, '2026-01-05')
    expect(c.sxo).toBe(1)
    expect(c.byCategory.OPSW).toBe(2)
  })

  it('makes a set the lesser of available pilots and available WSOs', () => {
    // 3 pilots, 3 WSOs -> 3 sets
    expect(countsFor(people, {}, {}, '2026-01-05').sets).toBe(3)
  })

  it('produces a fractional set count from a half day', () => {
    const grid: Grid = { ow1: { '2026-01-05': '*LL' } }
    // pilots 3, wsos 2.5 -> 2.5 sets
    expect(countsFor(people, grid, {}, '2026-01-05').sets).toBe(2.5)
  })

  it('reports people on SC duty separately from people on leave', () => {
    const grid: Grid = { ip1: { '2026-01-05': 'FS' }, op1: { '2026-01-05': 'LL' } }
    const c = countsFor(people, grid, {}, '2026-01-05')
    expect(c.duty).toBe(1)
    expect(c.byCategory.IP).toBe(1)
    expect(c.byCategory.OPSP).toBe(0)
  })

  it('drops a posted-out member from every count', () => {
    const gone = [...people, p('old', 'pilot', 'instructor', { to: '2026-01-01' })]
    expect(countsFor(gone, {}, {}, '2026-01-05').byCategory.IP).toBe(2)
  })

  it('ensures pilots can be the constraining seat with fractional availability', () => {
    // Take the baseline people (3 pilots, 3 WSOs), remove half of one pilot
    // with a half-day code: 2.5 pilots, 3 WSOs -> 2.5 sets
    const grid: Grid = { ip1: { '2026-01-05': '*LL' } }
    expect(countsFor(people, grid, {}, '2026-01-05').sets).toBe(2.5)
  })

  it('does not count posted-out people in duty tally even if they carry an SC duty code', () => {
    const postedOut = p('gone', 'pilot', 'instructor', { to: '2026-01-04' })
    const withPostedOutDuty = [...people, postedOut]
    const grid: Grid = { gone: { '2026-01-05': 'FS' } }
    expect(countsFor(withPostedOutDuty, grid, {}, '2026-01-05').duty).toBe(0)
  })

  it('counts HS duty code in the duty tally like FS', () => {
    const grid: Grid = { ip1: { '2026-01-05': 'HS' } }
    const c = countsFor(people, grid, {}, '2026-01-05')
    expect(c.duty).toBe(1)
  })

  it('handles a pm-portion cell (the trailing asterisk)', () => {
    expect(availabilityOf(p('a', 'pilot', 'ops'), '2026-01-05', 'LL*')).toBe(0.5)
  })
})

describe('availability and the bid state', () => {
  const someone = p('a', 'pilot', 'ops')

  it('removes a person whose bid is pending — the worst case is what warns', () => {
    expect(availabilityOf(someone, '2026-01-05', 'LL', 'pending')).toBe(0)
  })

  it('removes a person whose bid was approved', () => {
    expect(availabilityOf(someone, '2026-01-05', 'LL', 'approved')).toBe(0)
  })

  it('does NOT remove a person whose bid was refused — he is at work', () => {
    expect(availabilityOf(someone, '2026-01-05', 'LL', 'refused')).toBe(1)
  })

  it('refuses a half day back to a whole person, not half of one', () => {
    expect(availabilityOf(someone, '2026-01-05', '*LL', 'refused')).toBe(1)
    expect(availabilityOf(someone, '2026-01-05', '*LL', 'pending')).toBe(0.5)
  })

  it('keeps a sick man away whatever state is attached', () => {
    expect(availabilityOf(someone, '2026-01-05', 'M', 'refused')).toBe(0)
  })

  // A refused bid gives back the person, not the roster window. Someone
  // posted out on the 4th is not at work on the 5th however his last bid
  // was decided, and the duty short-circuit must still win too.
  it('does not resurrect a posted-out man, or put a duty man back on the programme', () => {
    const gone = p('b', 'pilot', 'ops', { to: '2026-01-04' })
    expect(availabilityOf(gone, '2026-01-05', 'LL', 'refused')).toBe(0)
    expect(availabilityOf(someone, '2026-01-05', 'FS', 'refused')).toBe(0)
  })

  it('puts a refused person back into the counts', () => {
    const people = [p('op1', 'pilot', 'ops'), p('ow1', 'wso', 'ops')]
    const grid: Grid = { op1: { '2026-01-05': 'LL' } }
    expect(countsFor(people, grid, {}, '2026-01-05').byCategory.OPSP).toBe(0)
    const states: States = { op1: { '2026-01-05': { state: 'refused', source: 'bid' } } }
    expect(countsFor(people, grid, states, '2026-01-05').byCategory.OPSP).toBe(1)
  })
})
