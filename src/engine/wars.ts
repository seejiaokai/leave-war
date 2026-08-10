// A leave war: a period, and the leave and bids inside it.
//
// The three travel together rather than as three maps keyed by period id,
// for the same reason a bid's state and source share one record — they are
// created, read and thrown away as a unit, so bundling them makes "a grid
// belonging to the wrong period" unrepresentable rather than merely
// discouraged.
//
// A period is any span the admin chooses, down to a single month. A quarter
// is the common case, not a rule: `buildDays` has always built an arbitrary
// range and nothing here narrows it.

import type { Grid } from './availability'
import type { States } from './bids'
import { buildDays, type Period } from './period'

export interface LeaveWar {
  period: Period
  grid: Grid
  states: States
}

/**
 * A new war over the given span, in draft and empty.
 *
 * Draft, not open: opening it is the admin's act, taken when the schedule
 * firms up, and making creation open it would take that decision away at
 * exactly the moment they are least ready to make it.
 */
export function makeWar(id: string, name: string, start: string, end: string): LeaveWar {
  // `yyyy-mm-dd` compares correctly as a plain string, so no parsing and no
  // timezone is involved. A backwards range would silently build no days at
  // all and present as an empty war, which is worse than failing here.
  if (end < start) {
    throw new Error(`makeWar: '${name}' ends (${end}) before it starts (${start})`)
  }
  return {
    period: { id, name, start, end, stage: 'draft', bidFrom: null, bidTo: null, days: buildDays(start, end) },
    grid: {},
    states: {},
  }
}

/** Alias that reads better where the emptiness is the point. */
export const blankWar = makeWar

/**
 * Whether two periods share any day.
 *
 * A date must belong to at most ONE leave war. Two wars covering 5 January
 * would let a person hold leave on that day twice over — the manning counts
 * would count him away twice and his balance would be drawn twice — and
 * nothing downstream could tell which war was the real one.
 *
 * Touching ends do not overlap: a war ending 31 March and one starting
 * 1 April are adjacent, which is the normal case and must stay allowed.
 *
 * Takes a bare span rather than a whole `Period` because the caller that
 * matters most is asking about dates that are not a period yet — an admin
 * typing two dates into the new-war sheet. `Period` satisfies this
 * structurally, so every existing caller is unaffected.
 */
export interface Span {
  start: string
  end: string
}

export function overlapping(a: Span, b: Span): boolean {
  return a.start <= b.end && b.start <= a.end
}

/** Which war owns this date, if any. Both end dates are inclusive. */
export function warHolding(wars: LeaveWar[], date: string): LeaveWar | undefined {
  return wars.find(w => date >= w.period.start && date <= w.period.end)
}
