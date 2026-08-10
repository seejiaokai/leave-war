import { describe, expect, it } from 'vitest'
import { monthInView, type MonthSpan } from './monthview'

/** Three 300-wide months laid end to end, as the grid lays them out. */
const SPANS: MonthSpan[] = [
  { label: 'JAN', left: 0, right: 300 },
  { label: 'FEB', left: 300, right: 600 },
  { label: 'MAR', left: 600, right: 900 },
]

describe('monthInView', () => {
  it('names the month filling the view', () => {
    expect(monthInView(SPANS, 320, 580)).toBe('FEB')
  })

  it('names the month holding MOST of the view when two are on screen', () => {
    // 40px of JAN, 260px of FEB.
    expect(monthInView(SPANS, 260, 560)).toBe('FEB')
    // 260px of FEB, 40px of MAR.
    expect(monthInView(SPANS, 340, 640)).toBe('FEB')
  })

  // The month strip is a "where am I" readout, so it must not flicker between
  // two answers while the grid is dragged slowly across a boundary. An exact
  // half-and-half view resolves to the earlier month, always.
  it('settles on the earlier month when the view is split exactly', () => {
    expect(monthInView(SPANS, 200, 400)).toBe('JAN')
    expect(monthInView(SPANS, 500, 700)).toBe('FEB')
  })

  it('names the first month at the very start and the last at the very end', () => {
    expect(monthInView(SPANS, 0, 260)).toBe('JAN')
    expect(monthInView(SPANS, 700, 900)).toBe('MAR')
  })

  // jsdom reports every rectangle as zero, which lands here as a view with no
  // width. Returning null rather than guessing 'JAN' is what keeps the strip
  // blank in a unit test instead of asserting a highlight that no browser
  // would have painted.
  it('names nothing when the view has no width, rather than guessing', () => {
    expect(monthInView(SPANS, 0, 0)).toBeNull()
    expect(monthInView(SPANS, 400, 400)).toBeNull()
  })

  it('names nothing when the view misses every month', () => {
    expect(monthInView(SPANS, 1000, 1200)).toBeNull()
    expect(monthInView(SPANS, -400, -100)).toBeNull()
  })

  it('names nothing when there are no months', () => {
    expect(monthInView([], 0, 500)).toBeNull()
  })

  // A war can be one month long, and a month can be narrower than the view —
  // a three-day war on a desktop. Neither is a reason to name nothing.
  it('names a month narrower than the view', () => {
    expect(monthInView([{ label: 'MAY', left: 100, right: 200 }], 0, 800)).toBe('MAY')
  })

  // Wars whose spans are given out of order, or which share a label across
  // years, must still resolve by position rather than by array index.
  it('answers by overlap, not by array order', () => {
    const jumbled: MonthSpan[] = [
      { label: 'MAR', left: 600, right: 900 },
      { label: 'JAN', left: 0, right: 300 },
      { label: 'FEB', left: 300, right: 600 },
    ]
    expect(monthInView(jumbled, 620, 880)).toBe('MAR')
    expect(monthInView(jumbled, 20, 280)).toBe('JAN')
  })
})
