import { categoryOf, evaluatePeriod, inSquadron, isDuty, isWeekend } from '../engine'
import { getState } from '../state/store'
import { CountRows } from './CountRows'
import { useVersion } from './useStore'
import './matrix.css'

export function Matrix() {
  useVersion()
  const { people, period, grid, requirements } = getState()
  const dates = period.days.map(d => d.date)
  const verdicts = evaluatePeriod(people, grid, requirements, dates)

  return (
    <div className="mx-wrap">
      <table className="mx">
        <thead>
          <tr>
            <th className="who">Callsign</th>
            {period.days.map(d => (
              <th
                key={d.date}
                data-testid={`head-${d.date}`}
                className={`day${d.blocked ? ' blocked' : ''}${isWeekend(d.date) ? ' weekend' : ''}`}
                title={[d.blocked ? d.blockedReason : '', d.events.filter(Boolean).join(' / ')]
                  .filter(Boolean)
                  .join(' — ')}
              >
                {d.date.slice(8)}
              </th>
            ))}
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
                ].filter(Boolean).join(' ')
                return (
                  <td key={d.date} data-testid={`cell-${p.id}-${d.date}`} className={cls}>
                    {here ? code : notYetArrived ? '' : 'PO'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
