import { describe, expect, it } from 'vitest'
import { monthsIn } from './months'

describe('monthsIn', () => {
  it('gives one entry per month of a year, in order', () => {
    const m = monthsIn('2026-01-01', '2026-12-31')
    expect(m).toHaveLength(12)
    expect(m.map(x => x.label)).toEqual(
      ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    )
    expect(m[0].first).toBe('2026-01-01')
    expect(m[6].first).toBe('2026-07-01')
  })

  // A war can be any span, so the strip has to fit whatever it is given —
  // a quarter gets three buttons, a single month gets one.
  it('gives three for a quarter and one for a month', () => {
    expect(monthsIn('2026-01-01', '2026-03-31').map(x => x.label)).toEqual(['JAN', 'FEB', 'MAR'])
    expect(monthsIn('2026-05-01', '2026-05-31').map(x => x.label)).toEqual(['MAY'])
  })

  // The FIRST entry points at the war's own start, not at the 1st of that
  // month — a war beginning mid-month has no column for the 1st, so jumping
  // to it would scroll to a cell that is not there.
  it('points the first month at the day the war actually starts', () => {
    const m = monthsIn('2026-05-12', '2026-07-31')
    expect(m[0].first).toBe('2026-05-12')
    expect(m[1].first).toBe('2026-06-01')
  })

  // Once a war crosses a year boundary, "JAN" alone is ambiguous.
  it('adds the year only when the war spans more than one', () => {
    expect(monthsIn('2026-11-01', '2027-02-28').map(x => x.label))
      .toEqual(['NOV 26', 'DEC 26', 'JAN 27', 'FEB 27'])
  })

  it('handles a single day', () => {
    expect(monthsIn('2026-05-12', '2026-05-12')).toEqual([{ label: 'MAY', first: '2026-05-12' }])
  })

  // This started life guarding an explicit `if (end < start) return []`, and
  // a probe found that branch DEAD: the loop condition `d <= end` is already
  // false on the first pass, so the test could not fail however the guard was
  // mutated. The guard is gone and this test stands in its place — it kills a
  // month-index reimplementation (walk m from start's month to end's), which
  // returns one bogus entry here. Seen red against exactly that, 10 Aug 26.
  it('is empty for a backwards range rather than looping forever', () => {
    expect(monthsIn('2026-05-31', '2026-05-01')).toEqual([])
  })
})
