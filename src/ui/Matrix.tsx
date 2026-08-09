import { categoryOf, codeOf, evaluatePeriod, inSquadron } from '../engine'
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
                className={`day${d.blocked ? ' blocked' : ''}`}
                title={d.blocked ? d.blockedReason : d.events.filter(Boolean).join(' / ')}
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
                const cls = [
                  here ? '' : 'gone',
                  codeOf(code)?.duty ? 'duty' : '',
                ].filter(Boolean).join(' ')
                return (
                  <td key={d.date} data-testid={`cell-${p.id}-${d.date}`} className={cls}>
                    {here ? code : 'PO'}
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
