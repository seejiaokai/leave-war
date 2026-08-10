// The roster. Categories are DERIVED from seat and band rather than stored,
// which is what lets RAPTOR's own roster replace this one without a migration:
// it already holds seat, the CAT ladder and an `sxo` qualification flag.

export type Seat = 'pilot' | 'wso'
/** `ops` is CAT D up to CAT A; `instructor` is the instructor grades above it. */
export type Band = 'instructor' | 'ops'
export type Category = 'IP' | 'OPSP' | 'IWSO' | 'OPSW'

export interface Person {
  id: string
  callsign: string
  seat: Seat
  band: Band
  /** Counted as an SXO on top of their normal category, never instead of it. */
  sxo: boolean
  /** First day in the squadron, inclusive. `null` means always. */
  from: string | null
  /** Last day in the squadron, inclusive — the posting-out date. `null` means still here. */
  to: string | null
}

export function categoryOf(p: Person): Category {
  if (p.seat === 'pilot') return p.band === 'instructor' ? 'IP' : 'OPSP'
  return p.band === 'instructor' ? 'IWSO' : 'OPSW'
}

/**
 * The category as the grid shows it, with `(S)` appended for an SXO.
 *
 * The owner's ask, 10 Aug 26: "if they are SXO qualified they will have a (S)
 * tagged to it. Like IW(S)." SXO sits ON TOP of a category rather than
 * instead of one — a requirement of "2 pilots, 2 WSOs, 1 SXO" needs the same
 * person counted twice — so this decorates the category rather than replacing
 * it, and `categoryOf` is untouched. Everything that counts, sorts or
 * requires a category goes on reading the plain one; only the label differs.
 */
export function categoryLabel(p: Person): string {
  return p.sxo ? `${categoryOf(p)}(S)` : categoryOf(p)
}

// Plain string comparison is correct for `yyyy-mm-dd`: the format sorts
// lexicographically in date order, so no parsing (and no timezone) is involved.
export function inSquadron(p: Person, date: string): boolean {
  if (p.from && date < p.from) return false
  if (p.to && date > p.to) return false
  return true
}
