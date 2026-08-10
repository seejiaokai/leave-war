// Raptor's topbar idiom plus a stage strip below it. Only real, computable
// facts are surfaced here — no dead nav links to pages that don't exist
// yet (My leave, Ledger, Rules, Roster) and no "closes in N days", which
// the engine does not model. See CLAUDE-facing restyle brief for why.

import { useState } from 'react'
import { evaluatePeriod, nextStage, stageLabel } from '../engine'
import {
  advanceStage,
  clearBidWindow,
  getState,
  selectWar,
  setBidWindow,
  setRole,
} from '../state/store'
import { RangePicker, type Range } from './RangePicker'
import { shortSpan } from './dates'
import { WarSheet } from './WarSheet'
import { useVersion } from './useStore'
import './chrome.css'

export function Topbar() {
  useVersion()
  const { period, wars, role } = getState()
  const [making, setMaking] = useState(false)
  return (
    <>
    <div className="topbar">
      <div className="mark">
        <svg className="rglyph" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 6 L12 3 L21 6 L12 11 Z" fill="#3BC6E8" opacity=".9" />
          <path d="M4 12 L12 15 L20 12 L12 21 Z" fill="#3BC6E8" opacity=".45" />
        </svg>
        <div className="tx">
          <span className="k">142 SQN</span>
          <span className="v">LEAVE WAR</span>
        </div>
      </div>
      <nav className="nav">
        <span className="on">Leave war</span>
      </nav>
      <div className="spring">
        {/* A native select rather than a popover: it is the one control that
            works the same on a phone, a desktop and a keyboard, and it needs
            no geometry of its own inside a page that already has a scroller
            and three sheets.

            Each option is the war's NAME only. Adding its stage would widen
            the closed chip to whatever the longest label is, and the stage
            strip immediately below already names the current war's — so the
            cost lands on every phone screen to answer a question only
            someone mid-switch is asking. */}
        <select
          className="wk on warpick"
          data-testid="war-picker"
          aria-label="Which leave war"
          value={period.id}
          onChange={e => selectWar(e.target.value)}
        >
          {wars.map(w => (
            <option key={w.period.id} value={w.period.id}>
              {w.period.name}
            </option>
          ))}
        </select>
        {role === 'admin' && (
          <button className="warnew" data-testid="war-new" onClick={() => setMaking(true)}>
            + New
          </button>
        )}
      </div>
    </div>
    {/* OUTSIDE `.topbar`, and that is load-bearing rather than tidiness.
        `.topbar` carries `backdrop-filter`, which makes it the containing
        block for any `position: fixed` descendant — so the sheet's
        `bottom: 14px` would resolve against the topbar's own 60px-tall box
        and render clipped at the top of the page instead of at the bottom of
        the viewport. jsdom computes no layout, so every unit test passed
        while it was broken; the browser gate is what caught it. */}
    {making && <WarSheet onClose={() => setMaking(false)} />}
    </>
  )
}

/**
 * Choose which dates the squadron may bid on.
 *
 * The refusals are the store's, not this sheet's: `setBidWindow` re-checks
 * the role and the bounds because the role switch is an affordance rather
 * than a permission, and the picker's own `min`/`max` only stop the mistake
 * being made in the first place.
 */
function WindowSheet({ onClose }: { onClose: () => void }) {
  const { period } = getState()
  const [range, setRange] = useState<Range | null>(
    period.bidFrom && period.bidTo ? { from: period.bidFrom, to: period.bidTo } : null,
  )
  const [problem, setProblem] = useState('')

  const apply = () => {
    const result = range ? setBidWindow(range.from, range.to) : clearBidWindow()
    if (result === 'set') return onClose()
    setProblem(
      result === 'outside'
        ? `Those dates leave ${period.name}, which runs ${shortSpan(period.start, period.end)}.`
        : result === 'backwards'
          ? 'The end date is before the start date.'
          : 'Only an admin can open bidding.',
    )
  }

  return (
    <div className="bidsheet" data-testid="window-sheet" role="dialog" aria-label="Open bidding on">
      <div className="bidsheet-hd">
        <span className="who">OPEN BIDDING ON</span>
        <span className="dt">{period.name}</span>
        <button className="x" data-testid="window-cancel" onClick={onClose} aria-label="Cancel">
          ✕
        </button>
      </div>
      <div className="bidsheet-row">
        <RangePicker
          testid="window"
          min={period.start}
          max={period.end}
          value={range}
          onChange={setRange}
        />
      </div>
      <div className="bidsheet-row">
        <span className="lab" />
        <button className="dchip approve" data-testid="window-apply" onClick={apply}>
          {range ? 'Open these dates' : 'Open the whole year'}
        </button>
        {/* Clearing is a real choice, not a fallback: before a schedule firms
            up at all, the whole year being open is the right state. */}
        <span className="note">
          The year stays on screen. Only these dates are editable by the squadron.
        </span>
        {problem && <span className="note warn" data-testid="window-problem">{problem}</span>}
      </div>
    </div>
  )
}

export function StageBar() {
  useVersion()
  const [picking, setPicking] = useState(false)
  const { people, period, grid, states, requirements, role } = getState()
  const dates = period.days.map(d => d.date)
  // Duplicates the same evaluatePeriod call Matrix makes internally. Both
  // stay self-contained (no prop plumbing between them) so Matrix keeps
  // rendering standalone in its existing tests; the cost is one extra pass
  // over a 90-day period, which is not worth threading props for. Both must
  // be handed the same `states`, or the strip counts a different squadron
  // from the one the grid below it is painting.
  const verdicts = evaluatePeriod(people, grid, states, requirements, dates)
  const redDays = dates.filter(d => verdicts[d].verdict === 'red').length
  const next = nextStage(period.stage)

  return (
    <div className="filters">
      <span className="lab">Stage</span>
      <span
        className={`fchip${period.stage === 'open' ? ' stage-open' : ''}`}
        data-testid="stage-now"
      >
        {stageLabel(period.stage)}
      </span>
      {/* The control sits beside the stage it moves, so the strip reads as
          one thing rather than as a label and an unrelated button. It names
          the stage it will move TO — the label answers "what does this do",
          and the chip immediately to its left is already showing where the
          period stands.
          Forward only, and disabled at the end of the cycle: `nextStage`
          owns which transitions exist and this asks it rather than deciding
          for itself. */}
      <button
        className="stage-go"
        data-testid="stage-advance"
        disabled={next === null}
        title={next ? `Move this period to ${stageLabel(next)}` : 'The cycle ends at published'}
        onClick={advanceStage}
      >
        → {next ? stageLabel(next) : 'END OF CYCLE'}
      </button>
      {/* Which part of the year the squadron may bid on. The war is a whole
          year on screen and the schedule firms up a quarter at a time, so
          this is what "the admin opens a period" means — the year stays
          visible and this much of it is writable.

          Only shown while the war is OPEN: a draft or closed war is shut to
          the squadron on every date, and a window advertised beside "BIDDING
          CLOSED" would contradict it. */}
      {period.stage === 'open' && (
        <>
          <span className="lab" style={{ marginLeft: 12 }}>Bidding on</span>
          <button
            className={`fchip winchip${role === 'admin' ? ' can' : ''}`}
            data-testid="bid-window"
            disabled={role !== 'admin'}
            title={role === 'admin'
              ? 'Choose which dates the squadron may bid on'
              : 'The dates the squadron may bid on'}
            onClick={() => setPicking(true)}
          >
            {period.bidFrom && period.bidTo
              ? shortSpan(period.bidFrom, period.bidTo)
              : 'THE WHOLE YEAR'}
          </button>
        </>
      )}
      {/* Nothing verifies this. There is no login, so switching it changes
          which controls appear and nothing else — the store is plain about
          that too. Labelled "viewing as" rather than "role" so it does not
          read as an identity the app has checked. */}
      <span className="lab" style={{ marginLeft: 12 }}>Viewing as</span>
      <button
        className={`rchip${role === 'admin' ? ' admin' : ''}`}
        data-testid="role-toggle"
        aria-pressed={role === 'admin'}
        title={role === 'admin'
          ? 'Admin: edits at every stage and decides once bidding closes. Not verified — there is no login.'
          : 'Member: edits only while the war is open.'}
        onClick={() => setRole(role === 'admin' ? 'member' : 'admin')}
      >
        {role === 'admin' ? 'ADMIN' : 'MEMBER'}
      </button>
      <span className="lab" style={{ marginLeft: 12 }}>Under-manned</span>
      <span className={`fchip${redDays > 0 ? ' undermanned' : ''}`} data-testid="undermanned">
        {redDays} day{redDays === 1 ? '' : 's'}
      </span>
      {/* Rendered inside `.filters` rather than `.topbar`, which carries no
          `backdrop-filter` — see the note on WarSheet in Topbar for why that
          distinction decides where a `position: fixed` sheet actually lands. */}
      {picking && <WindowSheet onClose={() => setPicking(false)} />}
    </div>
  )
}
