import { describe, expect, it } from 'vitest'
import { CODES, codeOf, isDuty } from './codes'

describe('day codes', () => {
  it('makes a half day cost half a person, not a whole one', () => {
    expect(codeOf('AM')!.removes).toBe(0.5)
    expect(codeOf('PM')!.removes).toBe(0.5)
    expect(codeOf('HO')!.removes).toBe(0.5)
    expect(codeOf('LL')!.removes).toBe(1)
  })

  it('spends the right counter', () => {
    expect(codeOf('LL')!.spends).toEqual({ counter: 'annual', amount: 1 })
    expect(codeOf('AM')!.spends).toEqual({ counter: 'annual', amount: 0.5 })
    expect(codeOf('HO')!.spends).toEqual({ counter: 'oil', amount: 0.5 })
    expect(codeOf('EL')!.spends).toEqual({ counter: 'el', amount: 1 })
  })

  it('spends nothing for medical, courses and overseas duty', () => {
    for (const c of ['M', 'HL', 'CSE', 'OD']) expect(codeOf(c)!.spends).toBeNull()
  })

  it('earns OIL only for SC duty', () => {
    expect(codeOf('FS')!.earnsOil).toBe(1)
    expect(codeOf('HS')!.earnsOil).toBe(0.5)
    expect(codeOf('LL')!.earnsOil).toBe(0)
  })

  it('marks SC duty as duty and never as a bid', () => {
    expect(isDuty('FS')).toBe(true)
    expect(isDuty('HS')).toBe(true)
    expect(isDuty('LL')).toBe(false)
    expect(codeOf('FS')!.bid).toBe(false)
    expect(codeOf('LL')!.bid).toBe(true)
  })

  it('does not treat medical, courses or duty as bids', () => {
    for (const c of ['M', 'HL', 'CSE', 'OD', 'FS', 'HS']) {
      expect(codeOf(c)!.bid).toBe(false)
    }
  })

  it('has no PO code — posted out is a roster date, not a code', () => {
    expect(codeOf('PO')).toBeUndefined()
  })

  it('is case-insensitive and tolerant of stray whitespace', () => {
    expect(codeOf(' ll ')).toBe(CODES.LL)
  })

  it('returns undefined for an unknown code rather than throwing', () => {
    expect(codeOf('NOPE')).toBeUndefined()
    expect(codeOf('')).toBeUndefined()
  })
})
