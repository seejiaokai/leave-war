import { describe, expect, it } from 'vitest'
import type { Grid } from './availability'
import type { States } from './bids'
import { evaluateDay, evaluatePeriod, worst } from './evaluate'
import type { Person } from './people'
import type { Requirements } from './requirements'

const p = (id: string, seat: 'pilot' | 'wso', band: 'instructor' | 'ops', over: Partial<Person> = {}): Person => ({
  id, callsign: id.toUpperCase(), seat, band, sxo: false, from: null, to: null, ...over,
})

const people: Person[] = [
  p('ip1', 'pilot', 'instructor'),
  p('ip2', 'pilot', 'instructor'),
  p('op1', 'pilot', 'ops'),
  p('iw1', 'wso', 'instructor'),
  p('ow1', 'wso', 'ops'),
  p('ow2', 'wso', 'ops', { sxo: true }),
]

const reqs: Requirements = {
  default: {
    sets: { amber: 3, red: 2 },
    rules: [
      { id: 'ip', label: 'IP', target: { kind: 'category', categories: ['IP'] }, threshold: { amber: 2, red: 1 } },
      { id: 'sxo', label: 'SXO', target: { kind: 'sxo' }, threshold: { amber: 1, red: 1 } },
    ],
  },
  overrides: {},
}

const D = '2026-01-05'

describe('worst', () => {
  it('ranks red above amber above ok', () => {
    expect(worst('ok', 'amber')).toBe('amber')
    expect(worst('amber', 'red')).toBe('red')
    expect(worst('red', 'ok')).toBe('red')
    expect(worst('ok', 'ok')).toBe('ok')
  })
})

describe('evaluateDay', () => {
  it('is ok when every rule is met', () => {
    expect(evaluateDay(people, {}, {}, reqs, D).verdict).toBe('ok')
  })

  it('goes amber when a count falls below the amber figure but not the red', () => {
    // one IP away -> IP = 1, amber 2, red 1 -> below amber, not below red
    const grid: Grid = { ip1: { [D]: 'LL' } }
    const day = evaluateDay(people, grid, {}, reqs, D)
    expect(day.results.find(r => r.ruleId === 'ip')!.verdict).toBe('amber')
    expect(day.verdict).toBe('amber')
  })

  it('goes red when a count falls below the red figure', () => {
    const grid: Grid = { ip1: { [D]: 'LL' }, ip2: { [D]: 'LL' } }
    const day = evaluateDay(people, grid, {}, reqs, D)
    expect(day.results.find(r => r.ruleId === 'ip')!.verdict).toBe('red')
    expect(day.verdict).toBe('red')
  })

  it('takes the worst result across all rules — one broken rule is enough', () => {
    const grid: Grid = { ow2: { [D]: 'LL' } } // SXO gone: sxo rule red, others fine
    expect(evaluateDay(people, grid, {}, reqs, D).verdict).toBe('red')
  })

  it('treats exactly the red figure as met, not as a breach', () => {
    const grid: Grid = { ip1: { [D]: 'LL' } } // IP = 1, red = 1
    expect(evaluateDay(people, grid, {}, reqs, D).results.find(r => r.ruleId === 'ip')!.verdict).toBe('amber')
  })

  it('judges the set rule fractionally', () => {
    const grid: Grid = { ow1: { [D]: '*LL' }, ow2: { [D]: 'LL' } } // wsos = 1.5 -> sets 1.5
    const sets = evaluateDay(people, grid, {}, reqs, D).results.find(r => r.ruleId === 'sets')!
    expect(sets.have).toBe(1.5)
    expect(sets.verdict).toBe('red')
  })

  it('reports a rule with no set requirement without inventing one', () => {
    const noSets: Requirements = { default: { sets: null, rules: [] }, overrides: {} }
    const day = evaluateDay(people, {}, {}, noSets, D)
    expect(day.results).toEqual([])
    expect(day.verdict).toBe('ok')
  })

  it('uses a day override in place of the default', () => {
    const strict: Requirements = {
      default: reqs.default,
      overrides: { [D]: { sets: { amber: 99, red: 98 }, rules: [] } },
    }
    expect(evaluateDay(people, {}, {}, strict, D).verdict).toBe('red')
  })

  it('carries the counts so the interface need not recompute them', () => {
    expect(evaluateDay(people, {}, {}, reqs, D).counts.byCategory.IP).toBe(2)
  })
})

describe('evaluatePeriod', () => {
  it('returns a verdict per date, keyed by date', () => {
    const out = evaluatePeriod(people, {}, {}, reqs, ['2026-01-05', '2026-01-06'])
    expect(Object.keys(out)).toEqual(['2026-01-05', '2026-01-06'])
    expect(out['2026-01-06'].verdict).toBe('ok')
  })
})

describe('evaluateDay and the bid state', () => {
  it('lets a refusal pull a day back from red', () => {
    const grid: Grid = { ip1: { [D]: 'LL' }, ip2: { [D]: 'LL' } }
    expect(evaluateDay(people, grid, {}, reqs, D).results.find(r => r.ruleId === 'ip')!.verdict).toBe('red')
    const states: States = { ip1: { [D]: { state: 'refused', source: 'bid' } } }
    expect(evaluateDay(people, grid, states, reqs, D).results.find(r => r.ruleId === 'ip')!.verdict).toBe('amber')
  })

  // evaluatePeriod hands `states` down to every day, not just the first. A
  // version that dropped the argument at the loop would still pass the
  // single-day test above.
  it('carries the states into every day of a period, not only the first', () => {
    const grid: Grid = { ip1: { '2026-01-05': 'LL' }, ip2: { '2026-01-06': 'LL' } }
    const states: States = {
      ip1: { '2026-01-05': { state: 'refused', source: 'bid' } },
      ip2: { '2026-01-06': { state: 'refused', source: 'bid' } },
    }
    const out = evaluatePeriod(people, grid, states, reqs, ['2026-01-05', '2026-01-06'])
    expect(out['2026-01-05'].counts.byCategory.IP).toBe(2)
    expect(out['2026-01-06'].counts.byCategory.IP).toBe(2)
  })
})
