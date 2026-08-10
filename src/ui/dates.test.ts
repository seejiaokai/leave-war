import { describe, expect, it } from 'vitest'
import { shortDate, shortSpan } from './dates'

describe('shortDate', () => {
  it('reads a date the way the squadron writes one', () => {
    expect(shortDate('2027-01-05')).toBe('5 Jan 27')
    expect(shortDate('2026-12-31')).toBe('31 Dec 26')
  })

  // A leading zero on the day is storage's business, not the reader's.
  it('drops the leading zero on the day but keeps the month name', () => {
    expect(shortDate('2026-08-01')).toBe('1 Aug 26')
    expect(shortDate('2026-08-10')).toBe('10 Aug 26')
  })

  // The whole reason this does not use `toLocaleDateString` or a `Date`: both
  // read the runtime's timezone, and an aircrew east of UTC would be shown
  // the day BEFORE the one they clicked. Slicing the string cannot drift, so
  // this holds under a timezone that would break the obvious implementation.
  it('is the same date in every timezone', () => {
    const original = process.env.TZ
    try {
      for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway', 'Asia/Singapore']) {
        process.env.TZ = tz
        expect(shortDate('2026-01-01')).toBe('1 Jan 26')
        expect(shortDate('2026-12-31')).toBe('31 Dec 26')
      }
    } finally {
      process.env.TZ = original
    }
  })
})

describe('shortSpan', () => {
  it('joins two dates with a dash', () => {
    expect(shortSpan('2027-01-01', '2027-12-31')).toBe('1 Jan 27 – 31 Dec 27')
  })

  // A single-day war is legal, and "5 Jan 27 – 5 Jan 27" reads as a mistake.
  it('says a single day once', () => {
    expect(shortSpan('2027-01-05', '2027-01-05')).toBe('5 Jan 27')
  })
})
