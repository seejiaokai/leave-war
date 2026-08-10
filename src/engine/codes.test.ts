import { describe, expect, it } from 'vitest'
import { codeOf, formatCell, isDuty, LEAVE_TYPES, parseCell, portionAmount } from './codes'

describe('portionAmount', () => {
  it('costs a whole day for full, half a day for am or pm', () => {
    expect(portionAmount('full')).toBe(1)
    expect(portionAmount('am')).toBe(0.5)
    expect(portionAmount('pm')).toBe(0.5)
  })
})

describe('parseCell', () => {
  it('parses a bare leave type as a full day', () => {
    expect(parseCell('LL')).toEqual({ type: 'LL', portion: 'full' })
    expect(parseCell('OIL')).toEqual({ type: 'OIL', portion: 'full' })
  })

  it('parses a leading asterisk as the morning', () => {
    expect(parseCell('*LL')).toEqual({ type: 'LL', portion: 'am' })
    expect(parseCell('*OIL')).toEqual({ type: 'OIL', portion: 'am' })
  })

  it('parses a trailing asterisk as the afternoon', () => {
    expect(parseCell('LL*')).toEqual({ type: 'LL', portion: 'pm' })
    expect(parseCell('OIL*')).toEqual({ type: 'OIL', portion: 'pm' })
  })

  it('parses every leave type', () => {
    for (const type of ['LL', 'OL', 'OIL', 'CCL', 'FCL', 'PL', 'EL']) {
      expect(parseCell(type)).toEqual({ type, portion: 'full' })
    }
  })

  it('parses a non-leave marker as a full day with no meaningful portion', () => {
    for (const type of ['M', 'CSE', 'OD']) {
      expect(parseCell(type)).toEqual({ type, portion: 'full' })
    }
  })

  it('parses SC duty markers the same way, since they carry no portion either', () => {
    expect(parseCell('FS')).toEqual({ type: 'FS', portion: 'full' })
    expect(parseCell('HS')).toEqual({ type: 'HS', portion: 'full' })
  })

  it('is tolerant of surrounding whitespace and of case', () => {
    expect(parseCell(' ll ')).toEqual({ type: 'LL', portion: 'full' })
    expect(parseCell(' *ll ')).toEqual({ type: 'LL', portion: 'am' })
    expect(parseCell(' ll* ')).toEqual({ type: 'LL', portion: 'pm' })
  })

  it('rejects an asterisk on both sides, since the notation only ever carries one time marker', () => {
    expect(parseCell('*LL*')).toBeNull()
    expect(parseCell('*OIL*')).toBeNull()
  })

  it('rejects a portion on a non-leave marker — only leave types come in halves', () => {
    expect(parseCell('*M')).toBeNull()
    expect(parseCell('CSE*')).toBeNull()
    expect(parseCell('*OD')).toBeNull()
  })

  it('rejects a portion on an SC duty marker', () => {
    expect(parseCell('*FS')).toBeNull()
    expect(parseCell('HS*')).toBeNull()
  })

  it('rejects an unknown type', () => {
    expect(parseCell('NOPE')).toBeNull()
    expect(parseCell('*NOPE')).toBeNull()
  })

  it('rejects empty, whitespace-only or missing input', () => {
    expect(parseCell('')).toBeNull()
    expect(parseCell('   ')).toBeNull()
    expect(parseCell(undefined)).toBeNull()
    expect(parseCell(null)).toBeNull()
  })

  it('has no PO code — posted out is a roster date, not a code', () => {
    expect(parseCell('PO')).toBeNull()
  })

  it('has no standalone AM, PM or HO code — a portion belongs to a leave type, not on its own', () => {
    expect(parseCell('AM')).toBeNull()
    expect(parseCell('PM')).toBeNull()
    expect(parseCell('HO')).toBeNull()
  })

  it('has no HL code — the owner\'s legend makes HL a reason M is used, not a code of its own', () => {
    expect(parseCell('HL')).toBeNull()
  })
})

describe('formatCell', () => {
  it('round-trips a full day back to the bare type', () => {
    const cell = { type: 'LL', portion: 'full' } as const
    expect(formatCell(cell)).toBe('LL')
    expect(parseCell(formatCell(cell))).toEqual(cell)
  })

  it('round-trips a morning portion with a leading asterisk', () => {
    const cell = { type: 'OIL', portion: 'am' } as const
    expect(formatCell(cell)).toBe('*OIL')
    expect(parseCell(formatCell(cell))).toEqual(cell)
  })

  it('round-trips an afternoon portion with a trailing asterisk', () => {
    const cell = { type: 'OIL', portion: 'pm' } as const
    expect(formatCell(cell)).toBe('OIL*')
    expect(parseCell(formatCell(cell))).toEqual(cell)
  })

  it('round-trips a non-leave marker unchanged', () => {
    const cell = { type: 'FS', portion: 'full' } as const
    expect(formatCell(cell)).toBe('FS')
    expect(parseCell(formatCell(cell))).toEqual(cell)
  })

  it('throws rather than emit a portion on a non-leave marker, which parseCell would only reject', () => {
    expect(() => formatCell({ type: 'FS', portion: 'am' })).toThrow()
    expect(() => formatCell({ type: 'M', portion: 'pm' })).toThrow()
    expect(() => formatCell({ type: 'CSE', portion: 'am' })).toThrow()
  })
})

describe('codeOf', () => {
  it('makes a half day cost half a person, not a whole one', () => {
    // Iterates all seven leave types rather than just LL and OIL: the
    // implementation is generic over `type`, so a future change that wrongly
    // special-cased one leave type would slip past a test that only ever
    // checked two of them.
    for (const { type } of LEAVE_TYPES) {
      expect(codeOf(`*${type}`)!.removes).toBe(0.5)
      expect(codeOf(`${type}*`)!.removes).toBe(0.5)
      expect(codeOf(type)!.removes).toBe(1)
    }
  })

  it('spends the right counter, scaled by the portion', () => {
    // Same reasoning as above: every leave type's counter and amount, not
    // just LL and OIL, so a wrongly special-cased type shows up here. `OFF`
    // is excluded because it has no counter at all — its own case is below.
    for (const { type, counter } of LEAVE_TYPES.filter(t => t.counter !== null)) {
      expect(codeOf(type)!.spends).toEqual({ counter, amount: 1 })
      expect(codeOf(`*${type}`)!.spends).toEqual({ counter, amount: 0.5 })
      expect(codeOf(`${type}*`)!.spends).toEqual({ counter, amount: 0.5 })
    }
  })

  it('spends nothing for medical, courses and overseas duty', () => {
    for (const c of ['M', 'CSE', 'OD']) expect(codeOf(c)!.spends).toBeNull()
  })

  // `OFF` is free leave (owner, 10 Aug 26): the person asks for it and it
  // takes them out of the manning picture, but it draws no entitlement. That
  // makes it the one leave type with NO counter, so it needs its own case —
  // and `spends` must be absent rather than a zero-amount draw, because a
  // zero would join a balance's arithmetic as if it were real.
  it('takes the day for OFF and spends nothing at all', () => {
    expect(codeOf('OFF')!.spends).toBeNull()
    expect(codeOf('OFF')!.removes).toBe(1)
    expect(codeOf('OFF')!.bid).toBe(true)
    expect(codeOf('OFF')!.duty).toBe(false)
    // Still a leave type, so it still comes in halves.
    expect(codeOf('*OFF')!.removes).toBe(0.5)
    expect(codeOf('*OFF')!.spends).toBeNull()
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

  it('removes nobody for SC duty by itself — `duty` is what excludes them, not `removes`', () => {
    // availabilityOf returns on the `c.duty` branch before ever reading
    // `removes` for FS/HS, and the catalogue now says plainly what that
    // branch already assumes: SC duty removes 0 on its own account. Someone
    // on SC duty is at work, not absent — it is `duty: true`, checked on its
    // own line, that keeps them out of the flying count.
    expect(codeOf('FS')!.removes).toBe(0)
    expect(codeOf('HS')!.removes).toBe(0)
  })

  it('does not treat medical, courses or duty as bids', () => {
    for (const c of ['M', 'CSE', 'OD', 'FS', 'HS']) {
      expect(codeOf(c)!.bid).toBe(false)
    }
  })

  it('has no PO code — posted out is a roster date, not a code', () => {
    expect(codeOf('PO')).toBeUndefined()
  })

  it('is case-insensitive and tolerant of stray whitespace', () => {
    expect(codeOf(' ll ')).toEqual(codeOf('LL'))
  })

  it('returns undefined for an unknown code rather than throwing', () => {
    expect(codeOf('NOPE')).toBeUndefined()
    expect(codeOf('')).toBeUndefined()
  })

  it('no longer recognises AM, PM or HO as codes in their own right', () => {
    expect(codeOf('AM')).toBeUndefined()
    expect(codeOf('PM')).toBeUndefined()
    expect(codeOf('HO')).toBeUndefined()
  })

  it('no longer recognises HL as a code', () => {
    expect(codeOf('HL')).toBeUndefined()
  })

  it('rejects a portion on a non-leave or SC-duty marker end to end', () => {
    expect(codeOf('*M')).toBeUndefined()
    expect(codeOf('CSE*')).toBeUndefined()
    expect(codeOf('*FS')).toBeUndefined()
  })

  it('rejects an asterisk on both sides end to end', () => {
    expect(codeOf('*LL*')).toBeUndefined()
  })
})
