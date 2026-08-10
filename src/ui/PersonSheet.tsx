// Editing who somebody is: their seat, their qualification band, and whether
// they hold SXO.
//
// The CATEGORY is not edited, and that is the whole design. It is derived
// from seat and band — a WSO instructor is an IWSO, and nothing stores that
// separately — which is what lets Raptor's own roster replace this one
// without a migration: Raptor already holds seat, the CAT ladder and an sxo
// flag, so its people drop in and the categories keep computing themselves.
// Offering the category as a field would create a second version of a fact
// the two systems must agree on.

import { categoryLabel, type Person } from '../engine'
import { setPerson } from '../state/store'
import './bidpicker.css'
import { Sheet } from './Sheet'

export function PersonSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  return (
    <Sheet testid="person-sheet" label="Edit aircrew" onClose={onClose}>
      <div className="bidsheet-hd">
        <span className="who">{person.callsign}</span>
        <span className="dt" data-testid="person-category">{categoryLabel(person)}</span>
        <button className="x" data-testid="person-cancel" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="bidsheet-row">
        <span className="lab">Seat</span>
        {(['pilot', 'wso'] as const).map(seat => (
          <button
            key={seat}
            data-testid={`seat-${seat}`}
            className={`pchip${person.seat === seat ? ' on' : ''}`}
            aria-pressed={person.seat === seat}
            onClick={() => setPerson(person.id, { seat })}
          >
            {seat === 'pilot' ? 'Pilot' : 'WSO'}
          </button>
        ))}
      </div>

      <div className="bidsheet-row">
        <span className="lab">Band</span>
        {/* "Ops" is CAT D up to CAT A; "instructor" is the grades above it.
            Two buttons rather than the full CAT ladder because the ladder is
            Raptor's to hold — this app only ever asks which side of it
            somebody is on. */}
        {(['ops', 'instructor'] as const).map(band => (
          <button
            key={band}
            data-testid={`band-${band}`}
            className={`pchip${person.band === band ? ' on' : ''}`}
            aria-pressed={person.band === band}
            onClick={() => setPerson(person.id, { band })}
          >
            {band === 'ops' ? 'Ops (CAT D–A)' : 'Instructor'}
          </button>
        ))}
      </div>

      <div className="bidsheet-row">
        <span className="lab">SXO</span>
        <button
          data-testid="person-sxo"
          className={`pchip${person.sxo ? ' on' : ''}`}
          aria-pressed={person.sxo}
          onClick={() => setPerson(person.id, { sxo: !person.sxo })}
        >
          {person.sxo ? 'SXO qualified' : 'Not SXO'}
        </button>
        <span className="note">
          Counted as an SXO on top of their category, never instead of it — the
          SXO row and the category row both include them.
        </span>
      </div>
    </Sheet>
  )
}
