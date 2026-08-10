// Dates as a person reads them. Presentation only — nothing here is ever
// stored, compared or fed back into the engine, which keeps `yyyy-mm-dd`
// throughout precisely because it sorts as a plain string.
//
// No `Date` object and no `toLocaleDateString`: both take the runtime's
// timezone into account, and an aircrew east of UTC would be shown the day
// before the one they clicked. The string is sliced instead, which cannot
// drift.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2027-01-05` → `5 Jan 27`. Two-digit year, because the squadron writes it
 *  that way and a leave war never spans a century. */
export function shortDate(date: string): string {
  const day = Number(date.slice(8, 10))
  const month = MONTHS[Number(date.slice(5, 7)) - 1]
  return `${day} ${month} ${date.slice(2, 4)}`
}

/** `5 Jan 27 – 31 Mar 27`, or just the one date when a span is a single day. */
export function shortSpan(start: string, end: string): string {
  return start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`
}
