// Demo data, shaped like the squadron's own quarterly sheet so the matrix
// looks like the real thing on first run. Callsigns are the reference
// workbook's. Replaced by real data once a backend exists.

import { buildDays, type Period } from './period'
import type { Person } from './people'
import type { Grid } from './availability'
import type { States } from './bids'
import type { Ledger, Openings } from './counters'
import { makeWar, type LeaveWar } from './wars'
import type { Requirements } from './requirements'

type Row = [string, Person['seat'], Person['band'], boolean, string | null]

// callsign, seat, band, sxo, posted-out date
const ROWS: Row[] = [
  ['RAMP', 'pilot', 'ops', true, null],
  ['TATA', 'pilot', 'instructor', false, null],
  ['SPLICE', 'wso', 'instructor', false, null],
  ['JAGUAR', 'pilot', 'ops', false, null],
  ['SWITCHER', 'pilot', 'ops', false, '2026-01-12'],
  ['ASICS', 'pilot', 'ops', false, null],
  ['PIPPER', 'wso', 'ops', false, null],
  ['DUSK', 'wso', 'ops', false, null],
  ['MILES', 'pilot', 'instructor', false, null],
  ['ROULETTE', 'wso', 'instructor', false, null],
  ['CROSS', 'wso', 'ops', false, null],
  ['DECAL', 'pilot', 'ops', false, null],
  ['SKIN', 'wso', 'ops', false, null],
  ['SLAMMED', 'pilot', 'ops', false, null],
  ['CAGE', 'wso', 'ops', false, null],
  ['RESET', 'pilot', 'instructor', false, null],
]

export function seedPeople(): Person[] {
  return ROWS.map(([callsign, seat, band, sxo, to]) => ({
    id: callsign.toLowerCase(),
    callsign,
    seat,
    band,
    sxo,
    from: null,
    to,
  }))
}

// A FULL YEAR, not a quarter. The squadron forecasts a quarter ahead, but the
// war it forecasts inside runs the year — so the whole thing is on one sheet
// and the month strip is how you get about it. 365 columns is 13,600px wide;
// nobody scrolls to September by dragging.
export function seedPeriod(): Period {
  const days = buildDays('2026-01-01', '2026-12-31')
  for (const d of days) {
    if (d.date === '2026-01-01') {
      d.ph = true
      d.events[0] = 'PH'
    }
    if (d.date === '2026-02-17' || d.date === '2026-02-18') {
      d.ph = true
      d.events[0] = 'PH'
    }
    // A week of heavy tasking where leave is discouraged but still biddable.
    // Runs through Saturday 2026-03-14 on purpose: exercises spill into
    // weekends, and this gives the blocked+weekend header overlap real
    // seed coverage instead of only existing in a synthetic test.
    if (d.date >= '2026-03-09' && d.date <= '2026-03-14') {
      d.blocked = true
      d.blockedReason = 'Exercise week'
    }
    // A second blocked week late in the year, so the month strip has
    // somewhere worth navigating TO rather than only proving it moves.
    if (d.date >= '2026-09-14' && d.date <= '2026-09-19') {
      d.blocked = true
      d.blockedReason = 'Exercise week'
    }
    if (d.date === '2026-08-09' || d.date === '2026-12-25') {
      d.ph = true
      d.events[0] = 'PH'
    }
  }
  // Open, with bidding on the FIRST QUARTER only. That combination is the
  // whole point of the window and is why it is seeded rather than left null:
  // the squadron reads the entire year, and can bid on the part of it the
  // schedule has actually reached. Jan–Mar because every seeded bid sits in
  // January and February, so the demonstration costs no seed data — and Apr
  // onwards is visibly locked from the first screen.
  return {
    id: 'y2026',
    name: 'JAN - DEC 26',
    start: '2026-01-01',
    end: '2026-12-31',
    stage: 'open',
    bidFrom: '2026-01-01',
    bidTo: '2026-03-31',
    days,
  }
}

export function seedRequirements(): Requirements {
  return {
    default: {
      sets: { amber: 5, red: 4.5 },
      rules: [
        { id: 'ip', label: 'IP', target: { kind: 'category', categories: ['IP'] }, threshold: { amber: 3, red: 2 } },
        { id: 'iwso', label: 'IWSO', target: { kind: 'category', categories: ['IWSO'] }, threshold: { amber: 3, red: 2 } },
        { id: 'instr', label: 'IP + IWSO', target: { kind: 'category', categories: ['IP', 'IWSO'] }, threshold: { amber: 5, red: 4 } },
        { id: 'opsp', label: 'OPSP', target: { kind: 'category', categories: ['OPSP'] }, threshold: { amber: 4, red: 3 } },
        { id: 'opsw', label: 'OPSW', target: { kind: 'category', categories: ['OPSW'] }, threshold: { amber: 4, red: 3 } },
        { id: 'sxo', label: 'SXO', target: { kind: 'sxo' }, threshold: { amber: 1, red: 1 } },
      ],
    },
    overrides: {},
  }
}

// `HO` (half OIL) becomes `*OIL` — the morning reading, picked arbitrarily
// since the old code carried no time-of-day information to preserve. A bare
// `AM`/`PM` in the source sheet meant half a day of ordinary leave, so those
// become `*LL`/`LL*` respectively: same leave type, the portion the old code
// name was already naming. All three keep removing exactly 0.5 of a person,
// so the manning figures this grid produces are unchanged.
export function seedGrid(): Grid {
  return {
    ramp: { '2026-01-01': 'OL', '2026-01-03': 'FS', '2026-02-10': '*OIL' },
    tata: { '2026-01-01': 'FS', '2026-01-04': 'FS', '2026-01-09': 'OIL' },
    splice: { '2026-01-05': 'M', '2026-01-06': 'M', '2026-01-08': 'LL' },
    jaguar: { '2026-01-16': 'OL', '2026-01-17': 'OL', '2026-01-19': 'OL' },
    asics: { '2026-01-08': 'LL', '2026-01-09': 'LL', '2026-01-23': '*LL', '2026-02-24': 'OIL' },
    pipper: { '2026-01-12': 'CSE', '2026-01-13': 'CSE' },
    miles: { '2026-02-02': 'LL', '2026-02-03': 'LL*' },
    roulette: { '2026-01-15': 'CCL' },
    cross: { '2026-03-10': 'LL' },
    skin: { '2026-01-03': 'HS' },
  }
}

// Enough of each state that the matrix shows all three colours on first run,
// plus one cell Raptor owns and one management shifted, so those two paths
// render without anyone having to construct them.
//
// Every entry here must name a cell that seedGrid() actually holds, and a
// code someone would bid for — a state on a cell with no code is a bug the
// tests beside this one will catch.
//
// SPLICE's LL on 2026-01-08 is deliberately left out: a bid with no decision
// recorded is a real shape the matrix has to render (it reads as pending),
// and leaving one unstated is how that path gets exercised on first run.
export function seedStates(): States {
  return {
    ramp: {
      '2026-01-01': { state: 'approved', source: 'bid' },
      '2026-02-10': { state: 'pending', source: 'bid' },
    },
    // TATA's OIL came in through Raptor's input tab: he asked verbally, was
    // told yes, and it arrived here already approved. Nothing in Leave War
    // may edit or re-decide it.
    tata: { '2026-01-09': { state: 'approved', source: 'raptor' } },
    jaguar: {
      '2026-01-16': { state: 'approved', source: 'bid' },
      '2026-01-17': { state: 'approved', source: 'bid' },
      '2026-01-19': { state: 'refused', source: 'bid' },
    },
    // ASICS carries all four states at once, so every colour the sheet can
    // paint is on screen from the first run: approved green, refused red,
    // acknowledged purple, and a plain pending input with no colour at all.
    asics: {
      '2026-01-08': { state: 'approved', source: 'bid' },
      '2026-01-09': { state: 'refused', source: 'bid' },
      '2026-01-23': { state: 'pending', source: 'bid' },
      '2026-02-24': { state: 'acknowledged', source: 'bid' },
    },
    // MILES asked for the 4th and management moved him to the 3rd. A shift
    // lands PENDING — moving it is a proposal, and someone still has to
    // approve the date it was moved to.
    miles: {
      '2026-02-02': { state: 'pending', source: 'bid' },
      '2026-02-03': { state: 'pending', source: 'bid', shiftedFrom: '2026-02-04' },
    },
    roulette: { '2026-01-15': { state: 'approved', source: 'bid' } },
    cross: { '2026-03-10': { state: 'refused', source: 'bid' } },
  }
}

// Opening balances, and the ledger that has moved them since. Shaped like
// the squadron's real figures rather than round numbers: §Counters records
// that balances already go negative in the workbook — annual at −14, OIL at
// −5.5 — so CROSS opens deep in the red and DECAL's OIL is negative too.
// Both must render on first run, because "negative shows red and is never
// refused" is a rule nobody can judge against an all-positive screen.
export function seedOpenings(): Openings {
  return {
    ramp: { annual: 12, oil: 3, ccl: 5 },
    tata: { annual: 8, oil: 1.5 },
    splice: { annual: 15, oil: 0.5, pl: 10 },
    jaguar: { annual: 4, oil: 2 },
    switcher: { annual: 6, el: 14 },
    asics: { annual: 9.5, oil: 4 },
    pipper: { annual: 11, oil: 1 },
    dusk: { annual: 14, oil: 2.5, ccl: 5 },
    miles: { annual: 7, oil: 6 },
    roulette: { annual: 10, ccl: 5, fcl: 6 },
    cross: { annual: -12, oil: 1 },
    decal: { annual: 5, oil: -4.5 },
    skin: { annual: 13, oil: 2 },
    slammed: { annual: 3, oil: 0 },
    cage: { annual: 16, oil: 1 },
    reset: { annual: 2, oil: 8 },
  }
}

// The ledger holds only what the GRID cannot already account for: the annual
// top-up, an award, a correction. Leave taken is not posted here — the
// person's own row is that record, and a second copy of it would be a second
// version of the truth. See `counters.ts`.
export function seedLedger(): Ledger {
  return [
    { id: 'l1', personId: 'ramp', counter: 'annual', amount: 14, date: '2026-01-01', reason: 'Annual leave top-up', approvedBy: 'SQNCDR' },
    { id: 'l2', personId: 'tata', counter: 'annual', amount: 14, date: '2026-01-01', reason: 'Annual leave top-up', approvedBy: 'SQNCDR' },
    { id: 'l3', personId: 'cross', counter: 'annual', amount: 14, date: '2026-01-01', reason: 'Annual leave top-up', approvedBy: 'SQNCDR' },
    { id: 'l4', personId: 'jaguar', counter: 'oil', amount: 2, date: '2026-01-19', reason: 'CNY workplan', approvedBy: 'SQNCDR' },
    { id: 'l5', personId: 'asics', counter: 'oil', amount: 1.5, date: '2026-02-02', reason: 'Exercise recovery', approvedBy: 'OC OPS' },
    // A correction is a negative amount, not a second mechanism — one ledger
    // covers top-ups, awards and fixes alike (§Counters).
    { id: 'l6', personId: 'miles', counter: 'annual', amount: -1, date: '2026-02-14', reason: 'Correction: double-counted 12 Jan', approvedBy: 'SQNCDR' },
  ]
}

// Two leave wars, so switching between them is a real thing to look at on
// first run rather than a control with one entry.
//
// Jan–Mar is OPEN and carries the seeded leave; Apr–Jun is a DRAFT the
// admin has not opened yet, which is the ordinary state of the next war
// while the schedule for it is still being firmed up. Apr–Jun holds a
// little leave of its own precisely so the cross-war balance rule has
// something to prove: RESET's four days there spend the same annual pool
// that Jan–Mar draws on, and the figure must not change when you switch.
//
// The two do not overlap, and must not: a date belongs to at most one war.
export function seedWars(): LeaveWar[] {
  const y26 = makeWar('y2026', 'JAN - DEC 26', '2026-01-01', '2026-12-31')
  y26.period = seedPeriod()
  y26.grid = seedGrid()
  y26.states = seedStates()

  // Next year's war, in draft — the ordinary state of the one after the
  // current, while its schedule is still being firmed up. It holds leave of
  // its own so the cross-war balance rule has something to prove: RESET's
  // four days here spend the same annual pool the 2026 screen draws on, and
  // his figure must read the same from either.
  const y27 = makeWar('y2027', 'JAN - DEC 27', '2027-01-01', '2027-12-31')
  y27.grid = {
    reset: { '2027-04-13': 'LL', '2027-04-14': 'LL', '2027-04-15': 'LL', '2027-04-16': 'LL' },
    dusk: { '2027-05-04': 'OIL', '2027-05-05': '*LL' },
  }
  y27.states = {
    reset: {
      '2027-04-13': { state: 'pending', source: 'bid' },
      '2027-04-14': { state: 'pending', source: 'bid' },
      '2027-04-15': { state: 'pending', source: 'bid' },
      '2027-04-16': { state: 'pending', source: 'bid' },
    },
    dusk: {
      '2027-05-04': { state: 'approved', source: 'raptor' },
      '2027-05-05': { state: 'pending', source: 'bid' },
    },
  }

  return [y26, y27]
}
