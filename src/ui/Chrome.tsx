// Raptor's topbar idiom plus a stage strip below it. Only real, computable
// facts are surfaced here — no dead nav links to pages that don't exist
// yet (My leave, Ledger, Rules, Roster) and no "closes in N days", which
// the engine does not model. See CLAUDE-facing restyle brief for why.

import { evaluatePeriod, nextStage, stageLabel } from '../engine'
import { advanceStage, getState } from '../state/store'
import { useVersion } from './useStore'
import './chrome.css'

export function Topbar() {
  useVersion()
  const { period } = getState()
  return (
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
        <span className="wk on">{period.name}</span>
      </div>
    </div>
  )
}

export function StageBar() {
  useVersion()
  const { people, period, grid, states, requirements } = getState()
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
      <span className="lab" style={{ marginLeft: 12 }}>Under-manned</span>
      <span className={`fchip${redDays > 0 ? ' undermanned' : ''}`} data-testid="undermanned">
        {redDays} day{redDays === 1 ? '' : 's'}
      </span>
    </div>
  )
}
