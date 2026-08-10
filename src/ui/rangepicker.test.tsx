import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { RangePicker, type Range } from './RangePicker'

/** The picker is controlled, so testing it needs something to hold the value —
 *  the same job the three sheets do in the app. */
function Harness({ min, max, initial = null }: { min?: string; max?: string; initial?: Range | null }) {
  const [range, setRange] = useState<Range | null>(initial)
  return (
    <>
      <RangePicker min={min} max={max} value={range} onChange={setRange} />
      <span data-testid="value">{range ? `${range.from}..${range.to}` : 'none'}</span>
    </>
  )
}

const value = () => screen.getByTestId('value').textContent
const day = (d: string) => screen.getByTestId(`range-day-${d}`)

describe('RangePicker', () => {
  // The whole ask: two weeks of leave in two taps, not fourteen.
  it('takes a start and an end in two taps', () => {
    render(<Harness min="2026-01-01" max="2026-12-31" />)
    fireEvent.click(day('2026-01-05'))
    expect(value()).toBe('2026-01-05..2026-01-05')
    fireEvent.click(day('2026-01-18'))
    expect(value()).toBe('2026-01-05..2026-01-18')
  })

  // Every day between the two ends is painted, which is the reason this is
  // not two native date inputs: they cannot draw a span at all.
  it('paints every day in the span, not only its ends', () => {
    render(<Harness min="2026-01-01" max="2026-12-31" />)
    fireEvent.click(day('2026-01-05'))
    fireEvent.click(day('2026-01-08'))
    for (const d of ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']) {
      expect(day(d).className).toContain('on')
    }
    expect(day('2026-01-04').className).not.toContain('on')
    expect(day('2026-01-09').className).not.toContain('on')
  })

  it('marks the two ends of the span differently from its middle', () => {
    render(<Harness min="2026-01-01" max="2026-12-31" />)
    fireEvent.click(day('2026-01-05'))
    fireEvent.click(day('2026-01-08'))
    expect(day('2026-01-05').className).toContain('start')
    expect(day('2026-01-08').className).toContain('end')
    expect(day('2026-01-06').className).not.toContain('start')
    expect(day('2026-01-06').className).not.toContain('end')
  })

  // Reaching for an earlier start is the ordinary correction. Refusing it —
  // or building a backwards range out of it — would leave the person tapping
  // a day that appears to do nothing.
  it('restarts from a day tapped before the pending start', () => {
    render(<Harness min="2026-01-01" max="2026-12-31" />)
    fireEvent.click(day('2026-01-18'))
    fireEvent.click(day('2026-01-05'))
    expect(value()).toBe('2026-01-05..2026-01-05')
  })

  it('starts a new span once one is complete', () => {
    render(<Harness min="2026-01-01" max="2026-12-31" />)
    fireEvent.click(day('2026-01-05'))
    fireEvent.click(day('2026-01-08'))
    fireEvent.click(day('2026-01-20'))
    expect(value()).toBe('2026-01-20..2026-01-20')
  })

  it('walks months without losing the selection', () => {
    render(<Harness min="2026-01-01" max="2026-12-31" />)
    fireEvent.click(day('2026-01-28'))
    fireEvent.click(screen.getByTestId('range-next-month'))
    expect(screen.getByTestId('range-month').textContent).toBe('FEBRUARY 2026')
    fireEvent.click(day('2026-02-06'))
    expect(value()).toBe('2026-01-28..2026-02-06')
  })

  // December to January is where a naive month-shift breaks, and a leave war
  // that crosses a year is the case this app was built for.
  it('crosses a year boundary in both directions', () => {
    render(<Harness min="2026-01-01" max="2027-12-31" initial={{ from: '2026-12-05', to: '2026-12-05' }} />)
    fireEvent.click(screen.getByTestId('range-next-month'))
    expect(screen.getByTestId('range-month').textContent).toBe('JANUARY 2027')
    fireEvent.click(screen.getByTestId('range-prev-month'))
    fireEvent.click(screen.getByTestId('range-prev-month'))
    expect(screen.getByTestId('range-month').textContent).toBe('NOVEMBER 2026')
  })

  // February is the month a "days in month" table gets wrong, and 2028 is a
  // leap year — the picker walks day by day precisely so neither is a case.
  it('draws a short February and a leap one', () => {
    render(<Harness min="2026-01-01" max="2028-12-31" initial={{ from: '2026-02-01', to: '2026-02-01' }} />)
    expect(screen.queryByTestId('range-day-2026-02-28')).toBeTruthy()
    expect(screen.queryByTestId('range-day-2026-02-29')).toBeNull()

    render(<Harness min="2026-01-01" max="2028-12-31" initial={{ from: '2028-02-01', to: '2028-02-01' }} />)
    expect(screen.getAllByTestId('range-day-2028-02-29')).toHaveLength(1)
  })

  // Bounds are the war's own span. A day outside it is drawn — the month has
  // to keep its shape — but dead, so nobody opens bidding on a date the war
  // does not contain.
  it('refuses a day outside the bounds', () => {
    render(<Harness min="2026-01-10" max="2026-01-20" />)
    expect((day('2026-01-09') as HTMLButtonElement).disabled).toBe(true)
    expect((day('2026-01-21') as HTMLButtonElement).disabled).toBe(true)
    expect((day('2026-01-10') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(day('2026-01-09'))
    expect(value()).toBe('none')
  })

  // The month has to start under the right weekday or every date reads a
  // column out. 1 Jan 2026 is a Thursday, which is column 3 Monday-first.
  it('pads the first row so the 1st lands under its own weekday', () => {
    const { container } = render(<Harness min="2026-01-01" max="2026-12-31" />)
    expect(container.querySelectorAll('.rblank')).toHaveLength(3)
  })

  // Monday-first, because leave is asked for in working weeks and a
  // Sunday-first grid splits every weekend across two rows.
  it('runs Monday first', () => {
    const { container } = render(<Harness min="2026-01-01" max="2026-12-31" />)
    expect([...container.querySelectorAll('.rdow')].map(e => e.textContent))
      .toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('reads the chosen span back in words', () => {
    render(<Harness min="2026-01-01" max="2026-12-31" />)
    expect(screen.getByTestId('range-selection').textContent).toBe('Pick a start date')
    fireEvent.click(day('2026-01-05'))
    fireEvent.click(day('2026-01-18'))
    expect(screen.getByTestId('range-selection').textContent).toBe('5 Jan 26 – 18 Jan 26')
  })

  it('clears back to nothing', () => {
    render(<Harness min="2026-01-01" max="2026-12-31" />)
    fireEvent.click(day('2026-01-05'))
    fireEvent.click(screen.getByTestId('range-clear'))
    expect(value()).toBe('none')
  })

  // This app has no clock, deliberately. A calendar that opened on the real
  // today would show a month the leave war may not even cover.
  it('opens on the month the bounds start in, not on today', () => {
    render(<Harness min="2026-07-01" max="2026-09-30" />)
    expect(screen.getByTestId('range-month').textContent).toBe('JULY 2026')
  })
})
