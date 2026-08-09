// A leave war period and the days inside it.
//
// Dates are `yyyy-mm-dd` strings throughout, never Date objects. Every parse
// goes through Date.UTC and every read uses a getUTC* accessor: local-time
// accessors shift the day for anyone east or west of UTC, which would silently
// move a weekend and therefore silently move an OIL credit.

export type Stage = 'draft' | 'open' | 'closed' | 'published'

export interface DayInfo {
  date: string
  /** Two free-text event lines, matching the two EVENT rows of the sheet. */
  events: [string, string]
  /** Leave is discouraged. Bids are still accepted — warn, never block. */
  blocked: boolean
  blockedReason: string
  /** A public holiday earns OIL for duty exactly as a weekend does. */
  ph: boolean
}

export interface Period {
  id: string
  name: string
  start: string
  end: string
  stage: Stage
  days: DayInfo[]
}

function toUTC(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

const DAY_MS = 86_400_000

export function addDays(date: string, n: number): string {
  return fromUTC(toUTC(date) + n * DAY_MS)
}

export function isWeekend(date: string): boolean {
  const day = new Date(toUTC(date)).getUTCDay()
  return day === 0 || day === 6
}

export function buildDays(start: string, end: string): DayInfo[] {
  const days: DayInfo[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({ date: d, events: ['', ''], blocked: false, blockedReason: '', ph: false })
  }
  return days
}
