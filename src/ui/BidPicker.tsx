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
import { setBidState, setCell } from '../state/store'
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
  onClose,
}: {
  callsign: string
  personId: string
  date: string
  code: string
  state: BidState | undefined
  onClose: () => void
}) {
  const decide = (bid: BidState) => {
    setBidState(personId, date, bid)
    onClose()
  }

  return (
    <div className="bidsheet" data-testid="bid-picker" role="dialog" aria-label="Decide a bid">
      <div className="bidsheet-hd">
        <span className="who">{callsign}</span>
        <span className="dt">{date}</span>
        <span className="cur">{code}{state ? ` · ${state}` : ''}</span>
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
    </div>
  )
}
