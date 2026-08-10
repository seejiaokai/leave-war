import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createWar, getState, initStore, selectWar, setRole } from '../state/store'
import { memoryBackend } from '../state/storage'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

/** jsdom computes no layout: every rectangle is 0×0 and `scrollLeft` never
 *  moves. So the scroll arithmetic is exercised against rectangles stated
 *  here — which proves the SUM (target, less the wrapper's own origin, less
 *  the two frozen columns) and nothing about real geometry. Whether the month
 *  actually lands clear of the frozen panel is a browser question, and
 *  e2e/matrix.spec.ts asks it there. */
function fakeLayout(opts: { wrapLeft?: number; cellLeft: number; who?: number; bal?: number; from?: number }) {
  const { wrapLeft = 0, cellLeft, who = 118, bal = 44, from = 0 } = opts
  const wrap = document.querySelector<HTMLElement>('.mx-wrap')!
  const rect = (left: number, width: number) => () => ({
    left, width, right: left + width, x: left, top: 0, bottom: 0, y: 0, height: 0, toJSON: () => '',
  }) as unknown as DOMRect

  wrap.getBoundingClientRect = rect(wrapLeft, 800)
  wrap.querySelector<HTMLElement>('.who')!.getBoundingClientRect = rect(wrapLeft, who)
  wrap.querySelector<HTMLElement>('.bal')!.getBoundingClientRect = rect(wrapLeft + who, bal)

  let scrolled = from
  Object.defineProperty(wrap, 'scrollLeft', {
    configurable: true,
    get: () => scrolled,
    set: (v: number) => { scrolled = v },
  })

  return {
    press: (month: string, date: string) => {
      screen.getByTestId(`head-${date}`).getBoundingClientRect = rect(cellLeft, 41)
      fireEvent.click(screen.getByTestId(`month-${month}`))
      return scrolled
    },
  }
}

describe('the month strip', () => {
  it('gives one button per month the war covers', () => {
    render(<Matrix />)
    const strip = screen.getByTestId('month-strip')
    expect([...strip.querySelectorAll('button')].map(b => b.textContent)).toEqual(
      ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    )
  })

  // The strip is derived from the CURRENT war's own span, not from the
  // calendar — a war one quarter long gets three buttons. A strip that
  // assumed a year would offer months the grid has no columns for.
  it('follows the war on screen rather than assuming a year', () => {
    setRole('admin')
    expect(createWar('WINTER 28', '2028-05-01', '2028-07-31')).toBe('created')
    render(<Matrix />)
    act(() => selectWar(getState().wars.find(w => w.period.name === 'WINTER 28')!.period.id))
    const strip = screen.getByTestId('month-strip')
    expect([...strip.querySelectorAll('button')].map(b => b.textContent)).toEqual(['MAY', 'JUN', 'JUL'])
  })

  // Scroll BY a delta, not TO an absolute. The grid is normally already
  // scrolled somewhere when a month is pressed — the day cell's rectangle is
  // where it sits NOW, so `scrollLeft = left` would be right only from the
  // far left of the war. Started deliberately at 1200 so the two differ.
  it('scrolls by the distance to the month, from wherever the grid already is', () => {
    render(<Matrix />)
    const layout = fakeLayout({ cellLeft: 5000, from: 1200 })
    expect(layout.press('JUL', '2026-07-01')).toBe(1200 + 5000 - 162)
  })

  // The wrapper is not at the window's left edge on a desktop, and the cell's
  // `left` is measured from the window. Subtracting the wrapper's own origin
  // is what turns a coordinate into a distance.
  it('measures from the wrapper, not from the window', () => {
    render(<Matrix />)
    const layout = fakeLayout({ wrapLeft: 300, cellLeft: 5000 })
    expect(layout.press('JUL', '2026-07-01')).toBe(5000 - 300 - 162)
  })

  // The frozen callsign and balance columns sit ON TOP of the day columns, so
  // their width comes off the target or the month parks underneath them. It
  // is MEASURED, not a constant: the callsign column is 118px on a desktop
  // and 76px on a phone, and a hard-coded offset would be wrong on one of
  // them. Two runs at the two widths, and the answers must differ by the 42.
  it('takes off the frozen columns\' measured width, not a fixed number', () => {
    render(<Matrix />)
    const desktop = fakeLayout({ cellLeft: 5000, who: 118 }).press('JUL', '2026-07-01')
    const phone = fakeLayout({ cellLeft: 5000, who: 76 }).press('JUL', '2026-07-01')
    expect(desktop).toBe(5000 - 162)
    expect(phone - desktop).toBe(42)
  })
})

/** State a whole year's worth of month rectangles, as if each month were 300
 *  wide and the grid scrolled left by `offset`. Same trick as `fakeLayout`
 *  and the same caveat: this proves which month the ARITHMETIC picks out of
 *  stated geometry, never that a browser lays the year out this way.
 *  `monthview.test.ts` proves the arithmetic itself; the browser gate proves
 *  the real measurement follows a real scroll. */
function layoutYear(offset: number) {
  const wrap = document.querySelector<HTMLElement>('.mx-wrap')!
  const rect = (left: number, width: number) => () => ({
    left, width, right: left + width, x: left, top: 0, bottom: 0, y: 0, height: 0, toJSON: () => '',
  }) as unknown as DOMRect

  // Viewport 0..800, with 162px of frozen columns on top of the left edge,
  // so the day columns are visible through 162..800.
  wrap.getBoundingClientRect = rect(0, 800)
  wrap.querySelector<HTMLElement>('.who')!.getBoundingClientRect = rect(0, 118)
  wrap.querySelector<HTMLElement>('.bal')!.getBoundingClientRect = rect(118, 44)

  const firsts = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
  firsts.forEach((mm, i) => {
    screen.getByTestId(`head-2026-${mm}-01`).getBoundingClientRect = rect(i * 300 - offset, 41)
  })
  screen.getByTestId('head-2026-12-31').getBoundingClientRect = rect(3600 - offset - 41, 41)

  fireEvent.scroll(wrap)
}

const lit = () =>
  [...screen.getByTestId('month-strip').querySelectorAll('button')]
    .filter(b => b.className.includes('on'))
    .map(b => b.textContent)

describe('the month strip says which month is on screen', () => {
  it('lights the month filling the view, and only that one', () => {
    render(<Matrix />)
    // Visible 162..800. JAN 0..300 gives 138; FEB 300..600 gives 300.
    act(() => layoutYear(0))
    expect(lit()).toEqual(['FEB'])
  })

  // Split from one three-step test on 10 Aug 26: each `layoutYear` fires a
  // scroll, which re-renders all 365 columns, and three of those in one test
  // ran to 5s and started timing out under load. Two re-renders is the most
  // any one of these now does.
  it('changes as the grid scrolls', () => {
    render(<Matrix />)
    act(() => layoutYear(0))
    expect(lit()).toEqual(['FEB'])
    // At 1800 the months sit JUL 0..300, AUG 300..600, SEP 600..900. Against
    // the visible 162..800 that is 138 of JUL, all 300 of AUG, 200 of SEP —
    // so AUG. (The first draft of this test said JUL, having read the month
    // at the left edge rather than the one filling the screen. The code was
    // right and the expectation was wrong.)
    act(() => layoutYear(1800))
    expect(lit()).toEqual(['AUG'])
  })

  // December's right edge is the only one computed from the last column
  // rather than from the next month's first, so the far end of the year is
  // worth asking about on its own.
  it('reads the far end of the year', () => {
    render(<Matrix />)
    // NOV 0..300 gives 138 of the visible 162..800; DEC 300..600 gives all
    // 300 of itself.
    act(() => layoutYear(3000))
    expect(lit()).toEqual(['DEC'])
  })

  // The whole point of subtracting the frozen columns. With them ignored the
  // view would start at 0 and JANUARY would keep the highlight while the
  // squadron is plainly looking at February.
  it('ignores the months hidden underneath the frozen columns', () => {
    render(<Matrix />)
    // JAN occupies 0..300 but only 162..300 of it is actually visible.
    act(() => layoutYear(0))
    expect(lit()).not.toContain('JAN')
  })

  it('lights nothing before anything has been measured', () => {
    render(<Matrix />)
    // jsdom reports every rectangle as zero, so the view has no width and
    // there is no honest answer to give.
    expect(lit()).toEqual([])
  })
})
