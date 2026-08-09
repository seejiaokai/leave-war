import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DayVerdict, RuleResult } from '../engine'
import { initStore, setCell } from '../state/store'
import { memoryBackend } from '../state/storage'
import { CountRows } from './CountRows'
import { Matrix } from './Matrix'

beforeEach(() => {
  initStore(memoryBackend())
})

// Dummy counts payload — CountRows never reads `counts`, only `results`, but
// DayVerdict requires the field to type-check.
const zeroCounts = { byCategory: { IP: 0, OPSP: 0, IWSO: 0, OPSW: 0 }, sxo: 0, sets: 0, duty: 0 }

function rule(ruleId: string, label: string, have: number): RuleResult {
  return { ruleId, label, have, amber: 0, red: 0, verdict: 'ok' }
}

function day(date: string, results: RuleResult[]): DayVerdict {
  return { date, verdict: 'ok', results, counts: zeroCounts }
}

describe('count rows', () => {
  it('shows one row per rule plus the set rule', () => {
    render(<Matrix />)
    expect(screen.getByTestId('count-sets')).toBeTruthy()
    expect(screen.getByTestId('count-ip')).toBeTruthy()
    expect(screen.getByTestId('count-sxo')).toBeTruthy()
  })

  it('shows the available figure for a day', () => {
    render(<Matrix />)
    // Three IPs seeded (TATA, MILES, RESET). TATA is on FS on 1 Jan, and SC
    // duty is at work but off the flying programme, so two remain available.
    expect(screen.getByTestId('count-ip-2026-01-01').textContent).toBe('2')
  })

  it('shows a real set figure for a day, not just that the row exists', () => {
    render(<Matrix />)
    // 2026-01-02 has nobody on leave or duty in the seed grid: 9 pilots and
    // 7 WSOs are all fully available, so the constraining seat (WSO) caps
    // sets at 7.
    expect(screen.getByTestId('count-sets-2026-01-02').textContent).toBe('7')
  })

  it('counts a half day as a half, which the spreadsheet could not', () => {
    setCell('cross', '2026-02-05', '*LL')
    render(<Matrix />)
    expect(screen.getByTestId('count-opsw-2026-02-05').textContent).toBe('4.5')
  })

  it('paints a breached count red', () => {
    for (const id of ['tata', 'miles', 'reset']) setCell(id, '2026-02-05', 'LL')
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).toContain('red')
  })

  it('paints a thin but unbroken count amber', () => {
    setCell('tata', '2026-02-05', 'LL')
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).toContain('amber')
  })

  it('leaves a healthy count unpainted', () => {
    render(<Matrix />)
    expect(screen.getByTestId('count-ip-2026-02-05').className).not.toMatch(/amber|red/)
  })
})

// requirementFor() can swap in a wholly different rule set per date via
// overrides[date] — nothing constrains an override's rules to match the
// default's length or order. The store seeds overrides: {} and exposes no
// way to set one, so these two cases are built by hand against CountRows
// directly rather than reached through Matrix.
describe('count rows keyed by rule identity, not array position', () => {
  it('keeps each date\'s figure under its own rule\'s row when the rule order differs between dates', () => {
    const verdicts = {
      'd1': day('d1', [rule('sets', 'Crew sets', 5), rule('ip', 'IP', 2), rule('sxo', 'SXO', 1)]),
      // Same three rules, deliberately reordered — a naive positional read
      // would attribute d2's sxo count to the "sets" row, its sets count to
      // the "ip" row, and its ip count to the "sxo" row.
      'd2': day('d2', [rule('sxo', 'SXO', 9), rule('sets', 'Crew sets', 6), rule('ip', 'IP', 3)]),
    }
    render(<table><CountRows verdicts={verdicts} dates={['d1', 'd2']} /></table>)

    expect(screen.getByTestId('count-sets-d1').textContent).toBe('5')
    expect(screen.getByTestId('count-sets-d2').textContent).toBe('6')
    expect(screen.getByTestId('count-ip-d1').textContent).toBe('2')
    expect(screen.getByTestId('count-ip-d2').textContent).toBe('3')
    expect(screen.getByTestId('count-sxo-d1').textContent).toBe('1')
    expect(screen.getByTestId('count-sxo-d2').textContent).toBe('9')
  })

  it('blanks a cell for a rule missing from that date without shifting the rows after it', () => {
    const verdicts = {
      'd1': day('d1', [rule('sets', 'Crew sets', 5), rule('ip', 'IP', 2), rule('sxo', 'SXO', 1)]),
      // d2 drops the middle rule (ip) entirely. A naive positional read
      // would render d2's sxo count under the "ip" row (index 1 of a
      // 2-element array) and leave the "sxo" row blank (index 2, out of
      // bounds) — shifting a real number into the wrong label and losing
      // the real one.
      'd2': day('d2', [rule('sets', 'Crew sets', 6), rule('sxo', 'SXO', 9)]),
    }
    render(<table><CountRows verdicts={verdicts} dates={['d1', 'd2']} /></table>)

    expect(screen.getByTestId('count-sets-d2').textContent).toBe('6')
    // CountRows renders a missing cell as a bare `<td />` with no testid —
    // so its absence, not an empty string under the testid, is the proof.
    expect(screen.queryByTestId('count-ip-d2')).toBeNull()
    expect(screen.getByTestId('count-sxo-d2').textContent).toBe('9')
  })
})
