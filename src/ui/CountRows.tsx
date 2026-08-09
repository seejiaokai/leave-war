import type { DayVerdict } from '../engine'

/** Rounds for display only — 4.5 stays 4.5, 4 does not become "4.0". */
const show = (n: number) => String(Math.round(n * 10) / 10)

export function CountRows({ verdicts, dates }: { verdicts: Record<string, DayVerdict>; dates: string[] }) {
  const first = dates.length ? verdicts[dates[0]] : undefined
  if (!first) return null

  return (
    <tbody className="counts">
      {first.results.map((rule, i) => (
        <tr key={rule.ruleId} data-testid={`count-${rule.ruleId}`}>
          <td className="who">{rule.label}</td>
          {dates.map(date => {
            const r = verdicts[date]?.results[i]
            if (!r) return <td key={date} />
            return (
              <td
                key={date}
                data-testid={`count-${rule.ruleId}-${date}`}
                className={r.verdict === 'ok' ? '' : r.verdict}
                title={`${rule.label}: ${show(r.have)} available, amber ${r.amber}, red ${r.red}`}
              >
                {show(r.have)}
              </td>
            )
          })}
        </tr>
      ))}
    </tbody>
  )
}
