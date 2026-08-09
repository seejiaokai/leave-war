// Placing a bid is two questions, not one: WHICH leave, and HOW MUCH of the
// day. That is the shape of the squadron's own notation — `OIL` a whole day,
// `*OIL` a morning, `OIL*` an afternoon — and offering a flat list of codes
// instead would put the portion back inside the code name, which is the
// thing the leave-code rework existed to end.
//
// It renders as a sheet anchored to the bottom of the viewport rather than a
// popover inside the cell. The matrix scrolls inside `.mx-wrap`, and anything
// absolutely positioned in a cell is clipped by that scroller; a sheet is
// also the shape that works on a phone, where a 30px-wide column has nowhere
// to put a menu.
//
// There is no login, so a bid is placed against whichever row was clicked
// rather than against a signed-in person — see `docs/known-gaps.md`.

import { useState } from 'react'
import { formatCell, LEAVE_TYPES, type BidState, type Portion } from '../engine'
import { setBidState, setCell, shiftBid } from '../state/store'
import './bidpicker.css'

const PORTIONS: { portion: Portion; label: string; testid: string }[] = [
  { portion: 'full', label: 'Whole day', testid: 'portion-full' },
  { portion: 'am', label: 'Morning', testid: 'portion-am' },
  { portion: 'pm', label: 'Afternoon', testid: 'portion-pm' },
]

export function BidPicker({
  callsign,
  personId,
  date,
  current,
  onClose,
}: {
  callsign: string
  personId: string
  date: string
  current: string
  onClose: () => void
}) {
  // Deliberately not seeded from `current`: the portion resets to a whole
  // day for every cell opened. A picker that remembered the last choice
  // would silently write a half day on the next cell the bidder touched.
  const [portion, setPortion] = useState<Portion>('full')

  const write = (code: string) => {
    setCell(personId, date, code)
    onClose()
  }

  return (
    <div className="bidsheet" data-testid="bid-picker" role="dialog" aria-label="Place a bid">
      <div className="bidsheet-hd">
        <span className="who">{callsign}</span>
        <span className="dt">{date}</span>
        {current && <span className="cur">now {current}</span>}
        <button className="x" data-testid="bid-cancel" onClick={onClose} aria-label="Cancel">
          ✕
        </button>
      </div>

      <div className="bidsheet-row">
        <span className="lab">How much</span>
        {PORTIONS.map(p => (
          <button
            key={p.portion}
            data-testid={p.testid}
            className={`pchip${portion === p.portion ? ' on' : ''}`}
            aria-pressed={portion === p.portion}
            onClick={() => setPortion(p.portion)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bidsheet-row">
        <span className="lab">Which leave</span>
        {/* Straight off the catalogue, so the eight types stay defined in one
            place. Duty, medical and courses are absent by construction —
            they are not leave types, and offering them here would invite a
            scheduler's data to be typed in as if it were a bid. */}
        {LEAVE_TYPES.map(t => (
          <button
            key={t.type}
            data-testid={`bid-${t.type}`}
            className="tchip"
            title={t.label}
            onClick={() => write(formatCell({ type: t.type, portion }))}
          >
            {formatCell({ type: t.type, portion })}
          </button>
        ))}
        <button className="tchip clear" data-testid="bid-clear" onClick={() => write('')}>
          Clear
        </button>
      </div>
    </div>
  )
}

/**
 * Approve or refuse a bid, once bidding has closed.
 *
 * Deliberately NOT role-gated: this prototype has no login, so anyone can
 * decide anything. That is a consequence of deferring accounts to the
 * backend, recorded in `docs/known-gaps.md` — it is not a security model and
 * must not be presented as one.
 *
 * Reuses the bid sheet's shell so a decision and a bid read as the same
 * object in the same place, rather than as two unrelated surfaces.
 */
export function DecisionSheet({
  callsign,
  personId,
  date,
  code,
  state,
  movedFrom,
  dates,
  onClose,
}: {
  callsign: string
  personId: string
  date: string
  code: string
  state: BidState | undefined
  /** Set when this bid has already been moved once; the date it came from. */
  movedFrom?: string
  /** Every date in the period, used only for the move field's bounds so a
   *  bid cannot be moved outside the war it belongs to. */
  dates: string[]
  onClose: () => void
}) {
  const [to, setTo] = useState('')
  // A refused move has to say WHY, or the button reads as broken. The store
  // returns the reason; this turns it into the sentence management needs.
  const [problem, setProblem] = useState('')

  const decide = (bid: BidState) => {
    setBidState(personId, date, bid)
    onClose()
  }

  const move = () => {
    if (!to) return
    const result = shiftBid(personId, date, to)
    if (result === 'shifted') return onClose()
    setProblem(
      result === 'occupied'
        ? `${to} already has something booked — clear it first.`
        : result === 'raptor'
          ? 'Raptor owns this cell; move it there instead.'
          : 'There is no bid here to move.',
    )
  }

  return (
    <div className="bidsheet" data-testid="bid-picker" role="dialog" aria-label="Decide a bid">
      <div className="bidsheet-hd">
        <span className="who">{callsign}</span>
        <span className="dt">{date}</span>
        <span className="cur">
          {code}{state ? ` · ${state}` : ''}{movedFrom ? ` · moved from ${movedFrom}` : ''}
        </span>
        <button className="x" data-testid="bid-cancel" onClick={onClose} aria-label="Cancel">
          ✕
        </button>
      </div>
      <div className="bidsheet-row">
        <span className="lab">Decision</span>
        {/* Both stay enabled on an already-decided bid. Management is meant
            to try one and watch the count rows move, and a decision that
            could not be changed back would make that a one-way door. */}
        <button
          className="dchip approve"
          data-testid="decide-approve"
          aria-pressed={state === 'approved'}
          onClick={() => decide('approved')}
        >
          Approve
        </button>
        <button
          className="dchip refuse"
          data-testid="decide-refuse"
          aria-pressed={state === 'refused'}
          onClick={() => decide('refused')}
        >
          Refuse
        </button>
      </div>

      {/* Moving a bid is what management does instead of refusing when a week
          goes red and refusing outright is too blunt. It lands PENDING and
          they approve it afterwards on the new date — a move is a proposal
          with a trail, not a silent re-approval. */}
      <div className="bidsheet-row">
        <span className="lab">Move to</span>
        <input
          type="date"
          className="dateinput"
          data-testid="shift-date"
          value={to}
          min={dates[0]}
          max={dates[dates.length - 1]}
          onChange={e => { setTo(e.target.value); setProblem('') }}
        />
        <button className="dchip move" data-testid="decide-shift" disabled={!to} onClick={move}>
          Move
        </button>
        {problem && <span className="note warn" data-testid="shift-problem">{problem}</span>}
      </div>
    </div>
  )
}

/**
 * A cell Raptor owns: read-only, and it says why.
 *
 * The leave was entered in Raptor's input tab, which means the person sought
 * approval verbally and already has it. There is nothing to decide and
 * nothing to edit — the store refuses both — so this sheet offers neither.
 * Offering an action that will be silently ignored is worse than offering
 * none, which is why it is a separate sheet rather than a disabled version
 * of the other two.
 */
export function RaptorSheet({
  callsign,
  date,
  code,
  onClose,
}: {
  callsign: string
  date: string
  code: string
  onClose: () => void
}) {
  return (
    <div className="bidsheet" data-testid="raptor-sheet" role="dialog" aria-label="Leave from Raptor">
      <div className="bidsheet-hd">
        <span className="who">{callsign}</span>
        <span className="dt">{date}</span>
        <span className="cur">{code} · approved</span>
        <button className="x" data-testid="bid-cancel" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="bidsheet-row">
        <span className="lab">From Raptor</span>
        <span className="note" data-testid="raptor-note">
          Entered on Raptor’s input tab, so it was approved there — change it in Raptor and it
          syncs back here.
        </span>
      </div>
    </div>
  )
}
