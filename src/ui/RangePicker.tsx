// One calendar, two taps: the start, then the end, with the days between
// filling in as you go.
//
// The owner asked for this twice in the same message — once for leave ("so I
// don't need to keep clicking a leave input like for 2 weeks continuous") and
// once for creating a leave war ("instead of clicking 2 calendars for start
// and end date"). Both are the same control, so it is written once and used
// in three places: the bid sheet, the new-war sheet, and the bidding window.
//
// Not a pair of `<input type="date">`. Two native pickers cannot show a range
// at all — the first has closed before the second opens, so nothing ever
// draws the span the person is choosing, which is the one thing they are
// trying to see.
//
// The month grid runs MONDAY FIRST. Leave is asked for in working weeks, and
// a Sunday-first calendar splits every weekend across two rows.

import { useState } from 'react'
import { addDays, isWeekend, weekday } from '../engine'
import { shortSpan } from './dates'
import './rangepicker.css'

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

/** Monday-first column index: Monday 0 … Sunday 6. */
function column(date: string): number {
  return (weekday(date) + 6) % 7
}

/** The first of the month `n` months from this one, as `yyyy-mm-01`. */
function shiftMonth(first: string, n: number): string {
  const y = Number(first.slice(0, 4))
  const m = Number(first.slice(5, 7)) - 1 + n
  const year = y + Math.floor(m / 12)
  const month = ((m % 12) + 12) % 12
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

/** Every date in the month of `first`, in order. Walks day by day rather than
 *  computing a length, so February and leap years need no special case. */
function daysOfMonth(first: string): string[] {
  const key = first.slice(0, 7)
  const out: string[] = []
  for (let d = first; d.slice(0, 7) === key; d = addDays(d, 1)) out.push(d)
  return out
}

export interface Range {
  from: string
  to: string
}

export function RangePicker({
  min,
  max,
  anchor,
  value,
  onChange,
  testid = 'range',
}: {
  /** Earliest selectable date, inclusive. Days before it are shown but dead. */
  min?: string
  /** Latest selectable date, inclusive. */
  max?: string
  /** Which month to open on when nothing is selected yet. Separate from
   *  `min` because the useful opening month is not always the earliest legal
   *  one — a new leave war may legally start in the past, but the month worth
   *  showing is the one after the last war ends. */
  anchor?: string
  value: Range | null
  onChange: (range: Range | null) => void
  testid?: string
}) {
  // Opens on the month the selection is in, or the month the bounds start in,
  // or — failing both — January of the min year. Never on "today": this app
  // has no clock, deliberately, and a calendar that opened on a real today
  // would show a month the leave war may not even cover.
  const [cursor, setCursor] = useState(() => {
    const at = value?.from ?? anchor ?? min ?? '2026-01-01'
    return `${at.slice(0, 7)}-01`
  })

  const selectable = (d: string) => (!min || d >= min) && (!max || d <= max)

  const tap = (d: string) => {
    if (!selectable(d)) return
    // A complete range starts over; an incomplete one completes. Tapping
    // BEFORE the pending start restarts there rather than making a backwards
    // range — reaching for an earlier start is the ordinary correction, and
    // refusing it would leave the person tapping a day that does nothing.
    if (!value || value.from !== value.to) return onChange({ from: d, to: d })
    if (d < value.from) return onChange({ from: d, to: d })
    onChange({ from: value.from, to: d })
  }

  const inRange = (d: string) => !!value && d >= value.from && d <= value.to
  const days = daysOfMonth(cursor)
  const lead = column(days[0])

  return (
    <div className="rpick" data-testid={`${testid}-picker`}>
      <div className="rpick-hd">
        <button
          className="rnav"
          data-testid={`${testid}-prev-month`}
          aria-label="Previous month"
          onClick={() => setCursor(shiftMonth(cursor, -1))}
        >
          ‹
        </button>
        <span className="rmon" data-testid={`${testid}-month`}>
          {MONTHS[Number(cursor.slice(5, 7)) - 1]} {cursor.slice(0, 4)}
        </span>
        <button
          className="rnav"
          data-testid={`${testid}-next-month`}
          aria-label="Next month"
          onClick={() => setCursor(shiftMonth(cursor, 1))}
        >
          ›
        </button>
      </div>

      <div className="rpick-grid" role="grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span className="rdow" key={i}>{d}</span>
        ))}
        {/* Blanks before the 1st, so the month starts under the right day. */}
        {Array.from({ length: lead }, (_, i) => <span className="rblank" key={`b${i}`} />)}
        {days.map(d => {
          const on = inRange(d)
          const cls = [
            'rday',
            on ? 'on' : '',
            on && d === value!.from ? 'start' : '',
            on && d === value!.to ? 'end' : '',
            isWeekend(d) ? 'wknd' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={d}
              className={cls}
              data-testid={`${testid}-day-${d}`}
              disabled={!selectable(d)}
              aria-pressed={on}
              onClick={() => tap(d)}
            >
              {Number(d.slice(8, 10))}
            </button>
          )
        })}
      </div>

      {/* The chosen span in words. The grid shows it too, but a person about
          to commit a fortnight of leave should be able to read back what they
          picked without counting squares. */}
      <div className="rpick-ft">
        <span className="rsel" data-testid={`${testid}-selection`}>
          {value ? shortSpan(value.from, value.to) : 'Pick a start date'}
        </span>
        {value && (
          <button className="rclear" data-testid={`${testid}-clear`} onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
