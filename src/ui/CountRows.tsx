import type { DayVerdict } from '../engine'

/** Rounds for display only — 4.5 stays 4.5, 4 does not become "4.0". */
const show = (n: number) => String(Math.round(n * 10) / 10)

export function CountRows({ verdicts, dates }: { verdicts: Record<string, DayVerdict>; dates: string[] }) {
  // `requirementFor` can swap in a wholly different rule set per date via
  // `overrides[date]` — nothing constrains an override's rules to the same
  // length or order as the default. So the row set is built by walking
  // every date's results (not just the first) and keeping the first label
  // seen per ruleId, and each cell is looked up by ruleId, never by array
  // position — a reordered or date-only rule must still land in its own
  // row, not silently under someone else's label.
  const rows: { ruleId: string; label: string }[] = []
  const seen = new Set<string>()
  for (const date of dates) {
    for (const r of verdicts[date]?.results ?? []) {
      if (!seen.has(r.ruleId)) {
        seen.add(r.ruleId)
        rows.push({ ruleId: r.ruleId, label: r.label })
      }
    }
  }
  if (rows.length === 0) return null

  // One lookup map per date, built once, so each cell is a ruleId lookup
  // rather than a per-cell `find` over that date's results array.
  const byDate = new Map(dates.map(date => [date, new Map(verdicts[date]?.results.map(r => [r.ruleId, r]))]))

  return (
    <tbody className="counts">
      {rows.map(({ ruleId, label }) => (
        <tr key={ruleId} data-testid={`count-${ruleId}`}>
          <td className="who">{label}</td>
          {/* A count row is a rule, not a person, so it has no leave
              balance. The cell exists to keep the column aligned and stays
              deliberately empty rather than showing a stray figure. */}
          <td className="bal" data-testid={`counter-count-${ruleId}`} />
          {dates.map(date => {
            const r = byDate.get(date)?.get(ruleId)
            if (!r) return <td key={date} />
            return (
              <td
                key={date}
                data-testid={`count-${ruleId}-${date}`}
                className={r.verdict === 'ok' ? '' : r.verdict}
                title={`${label}: ${show(r.have)} available, amber ${r.amber}, red ${r.red}`}
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
