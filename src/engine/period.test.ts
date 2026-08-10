import { describe, expect, it } from 'vitest'
import { addDays, buildDays, dayName, isWeekend } from './period'

describe('isWeekend', () => {
  it('recognises Saturday and Sunday', () => {
    expect(isWeekend('2026-01-03')).toBe(true)
    expect(isWeekend('2026-01-04')).toBe(true)
  })

  it('does not call a weekday a weekend', () => {
    expect(isWeekend('2026-01-02')).toBe(false)
    expect(isWeekend('2026-01-05')).toBe(false)
  })

  it('uses UTC weekday, not local time (catches local-accessor regressions)', () => {
    // 2026-01-03 is Saturday (day 6) in UTC.
    // Under Pacific/Midway (UTC-11), 2026-01-03 00:00:00 UTC = 2026-01-02 13:00:00 local (Friday, day 5).
    // A buggy `new Date(ms).getDay()` would return 5 (Friday), failing this assertion.
    // The correct `new Date(ms).getUTCDay()` returns 6 (Saturday), passing it.
    expect(isWeekend('2026-01-03')).toBe(true)
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('buildDays', () => {
  it('builds every day of the range inclusive', () => {
    const days = buildDays('2026-01-01', '2026-01-05')
    expect(days).toHaveLength(5)
    expect(days[0].date).toBe('2026-01-01')
    expect(days[4].date).toBe('2026-01-05')
  })

  it('builds a full quarter', () => {
    expect(buildDays('2026-01-01', '2026-03-31')).toHaveLength(90)
  })

  it('starts every day unblocked, not a public holiday, with two empty event lines', () => {
    const [d] = buildDays('2026-01-01', '2026-01-01')
    expect(d.blocked).toBe(false)
    expect(d.blockedReason).toBe('')
    expect(d.ph).toBe(false)
    expect(d.events).toEqual(['', ''])
  })

  it('returns nothing when the end precedes the start', () => {
    expect(buildDays('2026-01-05', '2026-01-01')).toEqual([])
  })
})

describe('dayName', () => {
  it('names each day of a known week', () => {
    // 2026-01-05 is a Monday.
    expect(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11']
      .map(dayName)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  })

  // The same UTC discipline as `isWeekend`, and for the same reason: a
  // local-time accessor names the wrong day for anyone east or west of UTC,
  // which would put MON over a Sunday column for half the squadron.
  it('names the same day in every timezone', () => {
    const original = process.env.TZ
    try {
      for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway', 'Asia/Singapore']) {
        process.env.TZ = tz
        expect(dayName('2026-01-05')).toBe('MON')
        expect(dayName('2026-01-11')).toBe('SUN')
      }
    } finally {
      process.env.TZ = original
    }
  })

  // The weekend banding and the weekday label must never disagree — they are
  // two readings of one fact, and a column labelled SAT without the band (or
  // the reverse) would be worse than either alone.
  it('agrees with isWeekend on every day of a year', () => {
    for (const d of buildDays('2026-01-01', '2026-12-31')) {
      expect(isWeekend(d.date)).toBe(dayName(d.date) === 'SAT' || dayName(d.date) === 'SUN')
    }
  })
})
