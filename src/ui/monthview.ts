// Which month the grid is currently showing.
//
// The month strip was a jump control only: twelve buttons that all looked the
// same wherever you were, so a year-long war told you where you could go and
// never where you were. This is the arithmetic behind the answer.
//
// Kept as a pure function on measured numbers rather than reading the DOM
// itself, because the DOM half cannot be tested: jsdom computes no layout and
// reports every rectangle as 0×0. The measuring lives in Matrix.tsx and is
// proved in the browser gate; the deciding lives here and is proved properly.

export interface MonthSpan {
  label: string
  /** Left and right edges, in whatever one coordinate space the caller is
   *  using for the view as well. Viewport pixels, in practice. */
  left: number
  right: number
}

/**
 * The month occupying most of the visible strip, or `null` if none does.
 *
 * Most-of-the-view rather than whichever month the left edge happens to sit
 * in: a screen showing three days of February and four weeks of March is a
 * March screen, and saying "FEB" there would be a readout nobody trusts.
 *
 * Ties go to the earlier month, which is what stops the label flickering
 * between two answers while the grid is dragged slowly across a boundary —
 * with a strict `>` the first month to reach the maximum keeps it.
 */
export function monthInView(spans: MonthSpan[], viewLeft: number, viewRight: number): string | null {
  if (viewRight <= viewLeft) return null

  let best: string | null = null
  let most = 0
  // Ordered by position, not by the order they arrive in: a caller building
  // spans from a map or a reversed list must get the same answer.
  for (const m of [...spans].sort((a, b) => a.left - b.left)) {
    const overlap = Math.min(m.right, viewRight) - Math.max(m.left, viewLeft)
    if (overlap > most) {
      most = overlap
      best = m.label
    }
  }
  return best
}
