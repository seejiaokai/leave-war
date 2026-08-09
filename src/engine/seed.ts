// Demo data, shaped like the squadron's own quarterly sheet so the matrix
// looks like the real thing on first run. Callsigns are the reference
// workbook's. Replaced by real data once a backend exists.

import { buildDays, type Period } from './period'
import type { Person } from './people'
import type { Grid } from './availability'
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

export function seedPeriod(): Period {
  const days = buildDays('2026-01-01', '2026-03-31')
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
  }
  return { id: 'q1-2026', name: 'JAN - MAR 26', start: '2026-01-01', end: '2026-03-31', stage: 'open', days }
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

export function seedGrid(): Grid {
  return {
    ramp: { '2026-01-01': 'OL', '2026-01-03': 'FS', '2026-02-10': 'HO' },
    tata: { '2026-01-01': 'FS', '2026-01-04': 'FS', '2026-01-09': 'OIL' },
    splice: { '2026-01-05': 'M', '2026-01-06': 'M', '2026-01-08': 'LL' },
    jaguar: { '2026-01-16': 'OL', '2026-01-17': 'OL', '2026-01-19': 'OL' },
    asics: { '2026-01-08': 'LL', '2026-01-09': 'LL', '2026-01-23': 'AM' },
    pipper: { '2026-01-12': 'CSE', '2026-01-13': 'CSE' },
    miles: { '2026-02-02': 'LL', '2026-02-03': 'PM' },
    roulette: { '2026-01-15': 'CCL' },
    cross: { '2026-03-10': 'LL' },
    skin: { '2026-01-03': 'HS' },
  }
}
