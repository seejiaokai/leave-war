import { describe, expect, it } from 'vitest'
import { blankWar, makeWar, overlapping, warHolding, type LeaveWar } from './wars'

const q1 = makeWar('q1', 'JAN - MAR 26', '2026-01-01', '2026-03-31')
const q2 = makeWar('q2', 'APR - JUN 26', '2026-04-01', '2026-06-30')

describe('makeWar', () => {
  it('builds a war over any span the admin asks for, down to one month', () => {
    const may = makeWar('may', 'MAY 26', '2026-05-01', '2026-05-31')
    expect(may.period.days).toHaveLength(31)
    expect(may.period.start).toBe('2026-05-01')
    expect(may.period.end).toBe('2026-05-31')
  })

  it('builds a quarter just as readily — the length is not fixed', () => {
    expect(q1.period.days).toHaveLength(90)
    expect(q2.period.days).toHaveLength(91)
  })

  // A new war starts in draft. Opening it is the admin's act, taken when the
  // schedule firms up — never a side effect of creating it.
  it('starts in draft, not open', () => {
    expect(q1.period.stage).toBe('draft')
  })

  it('starts empty — no leave and no bids', () => {
    expect(blankWar('x', 'X', '2026-05-01', '2026-05-02').grid).toEqual({})
    expect(blankWar('x', 'X', '2026-05-01', '2026-05-02').states).toEqual({})
  })

  it('carries the id and name it was given', () => {
    expect(q1.period.id).toBe('q1')
    expect(q1.period.name).toBe('JAN - MAR 26')
  })

  it('refuses a range that ends before it starts', () => {
    expect(() => makeWar('bad', 'BAD', '2026-05-31', '2026-05-01')).toThrow()
  })

  it('accepts a single day, which is a range of one', () => {
    expect(makeWar('one', 'ONE', '2026-05-01', '2026-05-01').period.days).toHaveLength(1)
  })
})

describe('overlapping', () => {
  // A date must belong to at most ONE leave war. Two wars covering 5 January
  // would mean a person could hold leave on that day twice over: the manning
  // counts would double-count him and his balance would be drawn twice.
  it('is false for wars that sit side by side', () => {
    expect(overlapping(q1.period, q2.period)).toBe(false)
  })

  it('is true when one starts before the other ends', () => {
    const late = makeWar('x', 'X', '2026-03-15', '2026-05-31')
    expect(overlapping(q1.period, late.period)).toBe(true)
    expect(overlapping(late.period, q1.period)).toBe(true)
  })

  it('is true when one swallows the other whole', () => {
    const year = makeWar('y', 'Y', '2026-01-01', '2026-12-31')
    expect(overlapping(year.period, q1.period)).toBe(true)
    expect(overlapping(q1.period, year.period)).toBe(true)
  })

  // The boundary cases, which is where an off-by-one would live: touching
  // ends do not overlap, sharing a single day does.
  it('does not count touching ends as an overlap', () => {
    const abut = makeWar('a', 'A', '2026-04-01', '2026-04-30')
    expect(overlapping(q1.period, abut.period)).toBe(false)
  })

  it('counts one shared day as an overlap', () => {
    const share = makeWar('s', 'S', '2026-03-31', '2026-04-30')
    expect(overlapping(q1.period, share.period)).toBe(true)
  })

  it('a war overlaps itself', () => {
    expect(overlapping(q1.period, q1.period)).toBe(true)
  })
})

describe('warHolding', () => {
  const wars: LeaveWar[] = [q1, q2]

  it('finds which war owns a date', () => {
    expect(warHolding(wars, '2026-02-14')?.period.id).toBe('q1')
    expect(warHolding(wars, '2026-05-14')?.period.id).toBe('q2')
  })

  it('returns nothing for a date no war covers', () => {
    expect(warHolding(wars, '2025-12-31')).toBeUndefined()
    expect(warHolding(wars, '2026-07-01')).toBeUndefined()
    expect(warHolding([], '2026-02-14')).toBeUndefined()
  })

  it('includes both end dates — a war owns its first and last day', () => {
    expect(warHolding(wars, '2026-01-01')?.period.id).toBe('q1')
    expect(warHolding(wars, '2026-03-31')?.period.id).toBe('q1')
    expect(warHolding(wars, '2026-04-01')?.period.id).toBe('q2')
  })
})
