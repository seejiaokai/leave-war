// Judging a day against its rules.
//
// A day takes the WORST result of every rule applying to it: one broken rule
// is enough to make it red. Meeting a threshold exactly is met, not breached —
// "IP >= 2" with two IPs available is fine.

import { countsFor, type DayCounts, type Grid } from './availability'
import type { States } from './bids'
import type { Person } from './people'
import { requirementFor, type ManningRule, type Requirements } from './requirements'

export type Verdict = 'ok' | 'amber' | 'red'

export interface RuleResult {
  ruleId: string
  label: string
  have: number
  amber: number
  red: number
  verdict: Verdict
}

export interface DayVerdict {
  date: string
  verdict: Verdict
  results: RuleResult[]
  counts: DayCounts
}

const RANK: Record<Verdict, number> = { ok: 0, amber: 1, red: 2 }

export function worst(a: Verdict, b: Verdict): Verdict {
  return RANK[a] >= RANK[b] ? a : b
}

function judge(have: number, amber: number, red: number): Verdict {
  if (have < red) return 'red'
  if (have < amber) return 'amber'
  return 'ok'
}

function haveFor(rule: ManningRule, counts: DayCounts): number {
  if (rule.target.kind === 'sxo') return counts.sxo
  return rule.target.categories.reduce((sum, c) => sum + counts.byCategory[c], 0)
}

export function evaluateDay(
  people: Person[],
  grid: Grid,
  states: States,
  reqs: Requirements,
  date: string,
): DayVerdict {
  const counts = countsFor(people, grid, states, date)
  const req = requirementFor(reqs, date)
  const results: RuleResult[] = []

  if (req.sets) {
    results.push({
      ruleId: 'sets',
      label: 'Crew sets',
      have: counts.sets,
      amber: req.sets.amber,
      red: req.sets.red,
      verdict: judge(counts.sets, req.sets.amber, req.sets.red),
    })
  }

  for (const rule of req.rules) {
    const have = haveFor(rule, counts)
    results.push({
      ruleId: rule.id,
      label: rule.label,
      have,
      amber: rule.threshold.amber,
      red: rule.threshold.red,
      verdict: judge(have, rule.threshold.amber, rule.threshold.red),
    })
  }

  const verdict = results.reduce<Verdict>((acc, r) => worst(acc, r.verdict), 'ok')
  return { date, verdict, results, counts }
}

export function evaluatePeriod(
  people: Person[],
  grid: Grid,
  states: States,
  reqs: Requirements,
  dates: string[],
): Record<string, DayVerdict> {
  const out: Record<string, DayVerdict> = {}
  for (const date of dates) out[date] = evaluateDay(people, grid, states, reqs, date)
  return out
}
