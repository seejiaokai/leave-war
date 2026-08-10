import { useRef, useState } from 'react'
import {
  balanceOf,
  canDecide,
  canEdit,
  categoryOf,
  evaluatePeriod,
  inSquadron,
  isBiddable,
  isDuty,
  COUNTERS,
  counterLabel,
  isWeekend,
  monthsIn,
  parseCell,
  raptorOwns,
  shiftedFrom,
  stateOf,
} from '../engine'
import { getState } from '../state/store'
import { BidPicker, DecisionSheet, RaptorSheet } from './BidPicker'
import { CountRows } from './CountRows'
import { useVersion } from './useStore'
import './matrix.css'

/** Rounds for display only — 4.5 stays 4.5, 4 does not become "4.0". The
 *  same rule the count rows use; nothing in this engine rounds a real
 *  figure. */
const show = (n: number) => String(Math.round(n * 10) / 10)

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
  const { people, period, grid, states, requirements, role, openings, ledger, wars } = getState()
  const dates = period.days.map(d => d.date)
  const verdicts = evaluatePeriod(people, grid, states, requirements, dates)

  // Which cell is open, not which sheet is open: what the sheet OFFERS is
  // derived from the stage and the role, so a period that moves on — or a
  // role that changes — while a sheet is open cannot leave the wrong
  // controls on screen.
  const [open, setOpen] = useState<{ id: string; callsign: string; date: string } | null>(null)
  const close = () => setOpen(null)
  // ONE selected counter, shared by every row. Giving each row its own
  // scroller would let them desync — row 1 showing ANNUAL while row 2 shows
  // OIL — which is worse than no panel at all.
  const [counter, setCounter] = useState(0)
  const shown = COUNTERS[counter]
  const cycle = (by: number) => setCounter(c => (c + by + COUNTERS.length) % COUNTERS.length)

  // Jumping to a month is how a year-long war is navigable at all: 365
  // columns is roughly 13,600px, and nobody finds September by dragging.
  const wrapRef = useRef<HTMLDivElement>(null)
  const months = monthsIn(period.start, period.end)

  const jumpTo = (date: string) => {
    const wrap = wrapRef.current
    const cell = wrap?.querySelector<HTMLElement>(`[data-testid="head-${date}"]`)
    if (!wrap || !cell) return
    // Measured live rather than read off the CSS custom properties: the two
    // frozen columns change width at the phone breakpoint, and a hard-coded
    // offset would land the target underneath them on one device and not
    // the other. Scrolling BY a delta rather than TO an absolute keeps this
    // correct wherever the grid happens to be scrolled already.
    const frozen = ['.who', '.bal']
      .map(sel => wrap.querySelector<HTMLElement>(sel)?.getBoundingClientRect().width ?? 0)
      .reduce((a, b) => a + b, 0)
    wrap.scrollLeft += cell.getBoundingClientRect().left - wrap.getBoundingClientRect().left - frozen
  }

  const editing = canEdit(period.stage, role)
  const deciding = canDecide(period.stage, role)

  // Which sheet a click opens follows from three things: the stage, the role,
  // and what the cell already holds.
  //
  // A cell Raptor owns always opens, at every stage and for either role, but
  // only ever onto the read-only sheet — a member who cannot edit anything
  // still deserves to be told why that particular cell is green and why
  // nothing here will change it.
  //
  // Deciding needs an existing bid to decide: a course, a sick day and an
  // empty cell are all things nobody asked for.
  const openable = (personId: string, date: string): boolean =>
    raptorOwns(states, personId, date) ||
    editing ||
    (deciding && isBiddable(grid[personId]?.[date]))

  return (
    <div className="stage">
      <div className="card">
        <div className="card-hd">
          <span className="t">{period.name} · {dates.length} days · {people.length} aircrew</span>
          {/* One button per month the war covers, so the strip fits a
              quarter and a year alike without being told which it is. */}
          <div className="months" data-testid="month-strip">
            {months.map(m => (
              <button
                key={m.first}
                className="mjump"
                data-testid={`month-${m.label.replace(' ', '-')}`}
                title={`Jump to ${m.label}`}
                onClick={() => jumpTo(m.first)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-wrap" ref={wrapRef}>
          <table className="mx">
            <thead>
              <tr>
                <th className="who">Callsign</th>
                {/* The counter selector lives in the column header, which is
                    the only place a 40px-wide column has room for a control.
                    Arrows are the guaranteed path on every device; the
                    column is frozen alongside the callsign so the figure
                    stays beside the name however far the grid scrolls. */}
                <th className="bal" data-testid="counter-head">
                  <button
                    className="cnav"
                    data-testid="counter-prev"
                    aria-label={`Show the previous counter (now ${counterLabel(shown)})`}
                    onClick={() => cycle(-1)}
                  >
                    ‹
                  </button>
                  <span className="cname" data-testid="counter-name">{counterLabel(shown)}</span>
                  <button
                    className="cnav"
                    data-testid="counter-next"
                    aria-label={`Show the next counter (now ${counterLabel(shown)})`}
                    onClick={() => cycle(1)}
                  >
                    ›
                  </button>
                </th>
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
                  {/* Derived on every render rather than cached: the figure
                      has to move the instant a bid is placed, because a
                      pending bid has been asked for and cannot be asked for
                      twice. Negative shows red and is never refused — the
                      squadron's balances already run negative (§Counters).

                      Counted across EVERY war, not the one on screen: leave
                      bid in Jan–Mar still spends annual leave while you are
                      looking at Apr–Jun, or the same days could be bid twice
                      over. */}
                  {(() => {
                    const left = balanceOf(openings, ledger, wars, p.id, shown)
                    return (
                      <td
                        className={`bal${left < 0 ? ' neg' : ''}`}
                        data-testid={`bal-${p.id}`}
                        title={`${p.callsign}: ${show(left)} ${counterLabel(shown)} remaining, pending bids included`}
                      >
                        {show(left)}
                      </td>
                    )
                  })()}
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
                    // Duty first for the reader — FS/HS are work, not a bid.
                    // (They carry `bid: false`, so they could not reach a
                    // bid branch anyway; the order is legibility, not a
                    // guard.) Then the bid state, but only where the code is
                    // one a person bids for. Everything else is plain
                    // information:
                    // medical, a course, overseas duty. A bare "PO" chip on
                    // a posted-out cell carries no state class at all.
                    //
                    // A bid with NO decision recorded reads as pending: the
                    // squadron has asked and nobody has answered, which is
                    // what "to be confirmed" means.
                    const bid = stateOf(states, p.id, d.date)
                    const chipState = !here || !code
                      ? ''
                      : isDuty(code) ? 'sc'
                      : !isBiddable(code) ? 'info'
                      : bid === 'approved' ? 'appr'
                      : bid === 'refused' ? 'ref'
                      : 'tbc'
                    // The half-day fill is read off the stored string via
                    // `parseCell`, never kept as its own bit of state and
                    // never guessed by matching an asterisk here in the
                    // component. The asterisk in `text` stays the one source
                    // of truth; this is only a derived echo of it, so the
                    // two can never disagree.
                    const portion = here && code ? parseCell(code)?.portion : undefined
                    const portionClass = portion === 'am' || portion === 'pm' ? ` ${portion}` : ''
                    // Two marks on top of the state colour, never instead of
                    // it: the squadron reads green as approved and magenta as
                    // pending, and that stays true here. `raptor` says the
                    // approval happened elsewhere and nothing on this screen
                    // will change it; `moved` says management shifted this
                    // bid off another date.
                    const marks = [
                      here && code && raptorOwns(states, p.id, d.date) ? 'raptor' : '',
                      here && code && shiftedFrom(states, p.id, d.date) ? 'moved' : '',
                    ].filter(Boolean).join(' ')
                    // A cell outside the person's time in the squadron is
                    // never actionable: bidding leave for a man who has been
                    // posted out is a data-entry accident, not a bid.
                    const actionable = here && openable(p.id, d.date)
                    return (
                      <td
                        key={d.date}
                        data-testid={`cell-${p.id}-${d.date}`}
                        className={`${cls}${actionable ? ' act' : ''}`}
                        onClick={actionable
                          ? () => setOpen({ id: p.id, callsign: p.callsign, date: d.date })
                          : undefined}
                      >
                        {text && (
                          <span
                            className={`c${chipState ? ` ${chipState}` : ''}${portionClass}${marks ? ` ${marks}` : ''}`}
                          >
                            {text}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rendered outside `.mx-wrap` on purpose: that wrapper scrolls, and a
          sheet inside it would be clipped by its own scroller. Keyed by the
          cell so opening a second one remounts rather than carrying the
          first's portion choice across. */}
      {/* Raptor's ownership is checked FIRST and short-circuits both other
          sheets. That cell is approved elsewhere: offering a picker or a
          decision on it would offer an action the store will refuse, which
          is worse than offering nothing. */}
      {open && raptorOwns(states, open.id, open.date) && (
        <RaptorSheet
          callsign={open.callsign}
          date={open.date}
          code={grid[open.id]?.[open.date] ?? ''}
          onClose={close}
        />
      )}
      {/* An admin at `closed` can BOTH edit and decide, so the two are not
          mutually exclusive and the order between them matters. Deciding
          wins on a cell that holds a bid, because that is what the stage is
          for; the picker still opens on an empty one, so an admin can add
          leave to a closed sheet without a second control. */}
      {open && !raptorOwns(states, open.id, open.date) && editing
        && !(deciding && isBiddable(grid[open.id]?.[open.date])) && (
        <BidPicker
          key={`${open.id}-${open.date}`}
          callsign={open.callsign}
          personId={open.id}
          date={open.date}
          current={grid[open.id]?.[open.date] ?? ''}
          onClose={close}
        />
      )}
      {open && !raptorOwns(states, open.id, open.date) && deciding
        && isBiddable(grid[open.id]?.[open.date]) && (
        <DecisionSheet
          key={`${open.id}-${open.date}`}
          callsign={open.callsign}
          personId={open.id}
          date={open.date}
          code={grid[open.id][open.date]}
          state={stateOf(states, open.id, open.date)}
          movedFrom={shiftedFrom(states, open.id, open.date)}
          dates={dates}
          onClose={close}
        />
      )}
    </div>
  )
}
