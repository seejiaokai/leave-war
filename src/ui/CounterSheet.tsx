// Choosing which counter the frozen column shows.
//
// The column header used to carry two 13px arrows, and the owner's verdict
// from a phone was that they are too small to hit. They were: a glyph inside
// a 44px column is not a tap target, and no amount of padding makes it one
// without eating the column it sits in.
//
// So the choice moves out of the column entirely, into the sheet idiom every
// other decision in this app already uses — full-width rows, each naming a
// counter and showing what the person whose row was tapped has left of it.
// The figure is the point: "which counter" is a question people answer by
// looking for the one that is running out.

import { balanceOf, COUNTERS, counterLabel, type CounterName } from '../engine'
import { getState } from '../state/store'
import { Sheet } from './Sheet'
import './bidpicker.css'

/** Rounds for display only, the same rule the grid and the count rows use. */
const show = (n: number) => String(Math.round(n * 10) / 10)

export function CounterSheet({
  shown,
  onPick,
  onClose,
}: {
  shown: CounterName
  onPick: (index: number) => void
  onClose: () => void
}) {
  const { people, openings, ledger, wars } = getState()

  return (
    <Sheet testid="counter-sheet" label="Which counter" onClose={onClose}>
      <div className="bidsheet-hd">
        <span className="who">WHICH COUNTER</span>
        <span className="dt">shown beside every callsign</span>
        <button className="x" data-testid="counter-cancel" onClick={onClose} aria-label="Cancel">
          ✕
        </button>
      </div>
      <div className="clist">
        {COUNTERS.map((c, i) => {
          // The squadron's total, not one person's: this sheet is opened from
          // a column header, which belongs to everybody. It answers "is this
          // pool under pressure at all", which is what makes a counter worth
          // switching to.
          const total = people.reduce((sum, p) => sum + balanceOf(openings, ledger, wars, p.id, c), 0)
          return (
            <button
              key={c}
              className={`crow${c === shown ? ' on' : ''}`}
              data-testid={`counter-${c}`}
              aria-pressed={c === shown}
              onClick={() => { onPick(i); onClose() }}
            >
              <span className="cn">{counterLabel(c)}</span>
              <span className={`ct${total < 0 ? ' neg' : ''}`}>{show(total)} left, squadron-wide</span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
