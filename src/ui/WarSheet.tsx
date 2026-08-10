// Creating a leave war: a name and two dates.
//
// The span is whatever the admin asks for, down to a single month. A quarter
// is the common case, not a rule — nothing here rounds the dates to one or
// offers a list of quarters to pick from, because that would take away the
// flexibility the owner asked for.
//
// Shares the `.bidsheet` shell with the bid and decision sheets so every
// sheet in the app reads as the same object in the same place.

import { useState } from 'react'
import { createWar } from '../state/store'
import './bidpicker.css'

const WHY: Record<string, string> = {
  overlap: 'Those dates overlap a leave war that already exists. A day can only belong to one.',
  backwards: 'The end date is before the start date.',
  unnamed: 'Give it a name.',
  forbidden: 'Only an admin can create a leave war.',
}

export function WarSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  // A refusal has to SAY why, or the button reads as broken. The store
  // returns the reason; this turns it into the sentence an admin needs.
  const [problem, setProblem] = useState('')

  const ready = Boolean(name.trim() && start && end)

  const create = () => {
    const result = createWar(name, start, end)
    if (result === 'created') return onClose()
    setProblem(WHY[result] ?? 'That leave war could not be created.')
  }

  return (
    <div className="bidsheet" data-testid="war-sheet" role="dialog" aria-label="New leave war">
      <div className="bidsheet-hd">
        <span className="who">NEW LEAVE WAR</span>
        <button className="x" data-testid="war-cancel" onClick={onClose} aria-label="Cancel">
          ✕
        </button>
      </div>

      <div className="bidsheet-row">
        <span className="lab">Name</span>
        <input
          className="dateinput namein"
          data-testid="war-name"
          placeholder="JUL - SEP 26"
          value={name}
          onChange={e => { setName(e.target.value); setProblem('') }}
        />
      </div>

      <div className="bidsheet-row">
        <span className="lab">From</span>
        <input
          type="date"
          className="dateinput"
          data-testid="war-start"
          value={start}
          onChange={e => { setStart(e.target.value); setProblem('') }}
        />
        <span className="lab" style={{ minWidth: 0 }}>to</span>
        <input
          type="date"
          className="dateinput"
          data-testid="war-end"
          value={end}
          onChange={e => { setEnd(e.target.value); setProblem('') }}
        />
      </div>

      <div className="bidsheet-row">
        <span className="lab" />
        {/* It lands in draft and does not take the screen — opening it is a
            separate act, taken when the schedule firms up. */}
        <button className="dchip approve" data-testid="war-create" disabled={!ready} onClick={create}>
          Create
        </button>
        <span className="note">Starts in draft. Any span, down to a single month.</span>
        {problem && <span className="note warn" data-testid="war-problem">{problem}</span>}
      </div>
    </div>
  )
}
