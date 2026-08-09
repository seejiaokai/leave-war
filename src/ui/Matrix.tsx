import { categoryOf, evaluatePeriod, inSquadron, isDuty, isWeekend } from '../engine'
import { getState } from '../state/store'
import { CountRows } from './CountRows'
import { useVersion } from './useStore'
import './matrix.css'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** The month abbreviation for a date, but only on that month's first day —
 *  `null` every other day. The header renders it above the day number so a
 *  quarter running 01…31 twice says which "01" is which. */
function monthLabel(date: string): string | null {
  if (date.slice(8, 10) !== '01') return null
  return MONTHS[Number(date.slice(5, 7)) - 1]
}

export function Matrix() {
  useVersion()
  const { people, period, grid, requirements } = getState()
  const dates = period.days.map(d => d.date)
  const verdicts = evaluatePeriod(people, grid, requirements, dates)

  return (
    <div className="stage">
      <div className="card">
        <div className="card-hd">
          <span className="t">{period.name} · {dates.length} days · {people.length} aircrew</span>
        </div>
        <div className="mx-wrap">
          <table className="mx">
            <thead>
              <tr>
                <th className="who">Callsign</th>
                {period.days.map(d => {
                  const mon = monthLabel(d.date)
                  return (
                    <th
                      key={d.date}
                      data-testid={`head-${d.date}`}
                      className={`day${d.blocked ? ' blocked' : ''}${isWeekend(d.date) ? ' weekend' : ''}`}
                      title={[d.blocked ? d.blockedReason : '', d.events.filter(Boolean).join(' / ')]
                        .filter(Boolean)
                        .join(' — ')}
                    >
                      {mon && <span className="mon">{mon}</span>}
                      {d.date.slice(8)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <CountRows verdicts={verdicts} dates={dates} />
            <tbody>
              {people.map(p => (
                <tr key={p.id} data-testid={`row-${p.id}`}>
                  <td className="who">
                    {p.callsign}
                    <span className="cat">{categoryOf(p)}</span>
                  </td>
                  {period.days.map(d => {
                    const code = grid[p.id]?.[d.date] ?? ''
                    const here = inSquadron(p, d.date)
                    // `here` is false on both sides of the roster window. Before
                    // `from` the person has not arrived yet — that is not the
                    // same fact as having been posted out, and must not read as
                    // one. Only the "after `to`" direction is a genuine PO.
                    const notYetArrived = !here && p.from !== null && d.date < p.from
                    const cls = [
                      here ? '' : 'gone',
                      here && isDuty(code) ? 'duty' : '',
                      // The band runs the whole column, not just the header —
                      // finding a Tuesday in 90 columns should not need
                      // counting. `.gone`'s hatch is declared after the
                      // weekend rule so a posted-out weekend still reads as
                      // posted out.
                      isWeekend(d.date) ? 'weekend' : '',
                    ].filter(Boolean).join(' ')
                    const text = here ? code : notYetArrived ? '' : 'PO'
                    // Only `.sc` (duty) and `.info` (everything else with a
                    // real code) are ever produced — bid states (appr/tbc/
                    // ref) arrive with a later plan. A bare "PO" chip on a
                    // posted-out cell carries no state class.
                    const chipState = here && code ? (isDuty(code) ? 'sc' : 'info') : ''
                    return (
                      <td key={d.date} data-testid={`cell-${p.id}-${d.date}`} className={cls}>
                        {text && <span className={`c${chipState ? ` ${chipState}` : ''}`}>{text}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
