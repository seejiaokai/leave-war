// What the scheduler says each day needs.
//
// Two kinds of rule are live at once: a SET requirement (a set is a pilot plus
// a WSO, counted fractionally, which is why "4.5 sets" is expressible at all)
// and CATEGORY minimums, including combinations like IP + IWSO and named roles
// like SXO. A day takes the worst result of every rule that applies to it.

import type { Category } from './people'

export interface Threshold {
  /** Below this, give the scheduler a heads-up. */
  amber: number
  /** Below this, the day is under-manned. */
  red: number
}

export type RuleTarget =
  /** Sum the availability of everyone in any of these categories. */
  | { kind: 'category'; categories: Category[] }
  /** Sum the availability of everyone carrying the SXO flag. */
  | { kind: 'sxo' }

export interface ManningRule {
  id: string
  label: string
  target: RuleTarget
  threshold: Threshold
}

export interface Requirement {
  /** In sets, where one set is a pilot plus a WSO. `null` means no set rule. */
  sets: Threshold | null
  rules: ManningRule[]
}

export interface Requirements {
  default: Requirement
  /** Keyed by `yyyy-mm-dd`. Only days that differ from the default appear. */
  overrides: Record<string, Requirement>
}

export function requirementFor(reqs: Requirements, date: string): Requirement {
  return reqs.overrides[date] ?? reqs.default
}
