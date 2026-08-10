import { useEffect, useRef, useState, type TouchEvent } from 'react'
import {
  balanceOf,
  canDecide,
  canEditCell,
  categoryLabel,
  codeOf,
  evaluatePeriod,
  inSquadron,
  isBiddable,
  isDuty,
  COUNTERS,
  counterLabel,
  dayName,
  isWeekend,
  monthsIn,
  parseCell,
  raptorOwns,
  shiftedFrom,
  stateOf,
} from '../engine'
import { getState } from '../state/store'
import { BidPicker, DecisionSheet, RaptorSheet } from './BidPicker'
import { CounterSheet } from './CounterSheet'
import { PersonSheet } from './PersonSheet'
import { CountRows } from './CountRows'
import { EventRows } from './EventRows'
import { monthInView } from './monthview'
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
  const { people, period, grid, states, requirements, role, openings, ledger, wars, focusDate, focusSeq } = getState()
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
  const [picking, setPicking] = useState(false)
  const [editingWho, setEditing] = useState<string | null>(null)
  const shown = COUNTERS[counter]
  const cycle = (by: number) => setCounter(c => (c + by + COUNTERS.length) % COUNTERS.length)

  // Swipe across the counter column to cycle it — the fast path, beside the
  // sheet's guaranteed one. Bound on the wrapper rather than on each cell so
  // one pair of listeners covers a column of twenty-odd, and filtered to
  // touches that START on a `.bal` cell so a swipe anywhere else still
  // scrolls the grid, which is what a horizontal drag must go on doing.
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    const on = (e.target as HTMLElement).closest?.('.bal')
    swipe.current = on ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const from = swipe.current
    swipe.current = null
    if (!from) return
    const dx = e.changedTouches[0].clientX - from.x
    const dy = e.changedTouches[0].clientY - from.y
    // Horizontal, and decisively so: 40px across and more sideways than up,
    // or every scroll of the rows would flip the counter under the thumb.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    cycle(dx < 0 ? 1 : -1)
  }

  // Jumping to a month is how a year-long war is navigable at all: 365
  // columns is roughly 13,600px, and nobody finds September by dragging.
  const wrapRef = useRef<HTMLDivElement>(null)
  const months = monthsIn(period.start, period.end)

  // Measured live rather than read off the CSS custom properties: the two
  // frozen columns change width at the phone breakpoint, and a hard-coded
  // offset would be wrong on one of the two devices. Shared by the jump and
  // by the in-view readout, which both need to know where the day columns
  // actually begin.
  const frozenWidth = (wrap: HTMLElement): number =>
    ['.who', '.bal']
      .map(sel => wrap.querySelector<HTMLElement>(sel)?.getBoundingClientRect().width ?? 0)
      .reduce((a, b) => a + b, 0)

  const jumpTo = (date: string) => {
    const wrap = wrapRef.current
    const cell = wrap?.querySelector<HTMLElement>(`[data-testid="head-${date}"]`)
    if (!wrap || !cell) return
    // Scrolling BY a delta rather than TO an absolute keeps this correct
    // wherever the grid happens to be scrolled already.
    wrap.scrollLeft += cell.getBoundingClientRect().left - wrap.getBoundingClientRect().left - frozenWidth(wrap)
  }

  // Which month the grid is showing, so the strip says where you ARE and not
  // only where you can go. Held as state rather than derived during render
  // because it is a fact about scroll position, which no render sees.
  const [inView, setInView] = useState<string | null>(null)

  const measureInView = () => {
    const wrap = wrapRef.current
    if (!wrap || months.length === 0 || dates.length === 0) return
    const headLeft = (date: string) =>
      wrap.querySelector<HTMLElement>(`[data-testid="head-${date}"]`)?.getBoundingClientRect().left
    const lastHead = wrap.querySelector<HTMLElement>(`[data-testid="head-${dates[dates.length - 1]}"]`)
    if (!lastHead) return

    // One rect per month plus the last column, not one per day: thirteen
    // reads on a year rather than 365, which is what makes measuring this on
    // every scroll event affordable.
    const edges = months.map(m => headLeft(m.first))
    if (edges.some(e => e === undefined)) return
    const end = lastHead.getBoundingClientRect().right
    const spans = months.map((m, i) => ({
      label: m.label,
      left: edges[i]!,
      // A month runs up to where the next one starts; the last runs to the
      // right edge of the final column.
      right: i + 1 < edges.length ? edges[i + 1]! : end,
    }))

    const wr = wrap.getBoundingClientRect()
    // The visible strip starts where the day columns do — the frozen columns
    // sit ON TOP of them, so counting from the wrapper's own left edge would
    // credit whichever month is hidden underneath the callsigns.
    setInView(monthInView(spans, wr.left + frozenWidth(wrap), wr.right))
  }

  // Measured synchronously on scroll rather than deferred to a frame: thirteen
  // rectangle reads is small beside what scrolling a 9,200-node table already
  // costs, and a deferred reading is a reading of where the grid used to be.
  // Re-measured when the war changes too, since that rebuilds every column.
  useEffect(() => {
    measureInView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.id, dates.length])

  // The under-manned list asks for a day the same way the month strip asks
  // for a month, through the one `jumpTo` above — so a target lands clear of
  // both frozen columns without that measurement existing twice.
  //
  // Keyed on `focusSeq` rather than `focusDate`: choosing the same day again
  // has to snap back to it after the grid has been dragged away, and a date
  // alone cannot express that. jsdom reports every rect as 0, which makes the
  // jump a harmless no-op there; the browser gate is what proves it moves.
  useEffect(() => {
    if (focusDate) jumpTo(focusDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeq, focusDate])

  // Every "may this be written" question now goes through `canEditCell`,
  // which folds the stage, the role and the bidding window into one answer
  // for one date. `canEdit` is what the stage strip and the role toggle ask —
  // "is the sheet writable at all" — and has no date to narrow itself with.
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
    canEditCell(period, role, date) ||
    (deciding && isBiddable(grid[personId]?.[date]))

  // A day the squadron may not bid on, drawn as such. Without this the window
  // is invisible: a member taps an October cell, nothing happens, and the app
  // reads as broken rather than as closed. Admin sees no lock — the window
  // does not bind them, so drawing one would be a lie about their own screen.
  const lockedDate = (date: string): boolean => !canEditCell(period, role, date)

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
                className={`mjump${m.label === inView ? ' on' : ''}`}
                data-testid={`month-${m.label.replace(' ', '-')}`}
                aria-current={m.label === inView ? 'true' : undefined}
                title={`Jump to ${m.label}`}
                onClick={() => jumpTo(m.first)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div
          className="mx-wrap"
          ref={wrapRef}
          onScroll={measureInView}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <table className="mx">
            <thead>
              <tr>
                <th className="who">Callsign</th>
                {/* The counter selector lives in the column header, which is
                    the only place a 40px-wide column has room for a control.
                    Arrows are the guaranteed path on every device; the
                    column is frozen alongside the callsign so the figure
                    stays beside the name however far the grid scrolls. */}
                {/* The WHOLE header is the control. It was two 13px arrows
                    either side of the label, and the owner's verdict from a
                    phone was that they are too small to hit — which they
                    were: a glyph in a 44px column is not a tap target.

                    Tapping anywhere on the header opens a sheet listing every
                    counter at full width, which is the guaranteed path on any
                    device. Swiping across the column is the fast one, and is
                    handled on `.mx-wrap` below. The arrows are gone rather
                    than kept alongside: leaving a control that is known to be
                    too small to hit is worse than having one way in. */}
                <th className="bal" data-testid="counter-head">
                  <button
                    className="cpick"
                    data-testid="counter-pick"
                    aria-label={`Showing ${counterLabel(shown)}. Choose a counter`}
                    onClick={() => setPicking(true)}
                  >
                    <span className="cname" data-testid="counter-name">{counterLabel(shown)}</span>
                    <span className="cdots" aria-hidden="true">
                      {COUNTERS.map((_, i) => (
                        <span key={i} className={`cdot${i === counter ? ' on' : ''}`} />
                      ))}
                    </span>
                  </button>
                </th>
                {period.days.map(d => {
                  const mon = monthLabel(d.date)
                  return (
                    <th
                      key={d.date}
                      data-testid={`head-${d.date}`}
                      className={`day${d.blocked ? ' blocked' : ''}${isWeekend(d.date) ? ' weekend' : ''}${lockedDate(d.date) ? ' locked' : ''}${d.date === focusDate ? ' focus' : ''}`}
                      title={[d.blocked ? d.blockedReason : '', d.events.filter(Boolean).join(' / ')]
                        .filter(Boolean)
                        .join(' — ')}
                    >
                      {mon && <span className="mon">{mon}</span>}
                      {/* The day of the week, on every column. A year of
                          columns numbered 01…31 twelve times over gives the
                          eye nothing to hold on to: the weekend banding says
                          where a week ENDS but not which day any given
                          column is, and "which Tuesday" is the question
                          somebody bidding actually asks. Owner's request,
                          10 Aug 26. */}
                      <span className="dow">{dayName(d.date)}</span>
                      {d.date.slice(8)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            {/* Above the counts, because an event is the REASON a day is
                thin — reading the cause before the effect is the order a
                scheduler works in. */}
            <EventRows days={period.days} editable={role === 'admin'} />
            <CountRows verdicts={verdicts} dates={dates} />
            <tbody>
              {people.map(p => (
                <tr key={p.id} data-testid={`row-${p.id}`}>
                  {/* The callsign opens the person sheet for an admin, and
                      is plain text for everyone else. `IWSO(S)` rather than a
                      second column for SXO: it sits on top of a category, so
                      it decorates the label rather than replacing it. */}
                  <td className="who">
                    {role === 'admin' ? (
                      <button
                        className="whoedit"
                        data-testid={`person-${p.id}`}
                        title={`Edit ${p.callsign}`}
                        onClick={() => setEditing(p.id)}
                      >
                        {p.callsign}
                        <span className="cat">{categoryLabel(p)}</span>
                      </button>
                    ) : (
                      <>
                        {p.callsign}
                        <span className="cat">{categoryLabel(p)}</span>
                      </>
                    )}
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
                      // Outside the bidding window, for this role. Declared
                      // after the weekend so a locked Saturday still reads as
                      // locked — the same cascade care the .blocked/.weekend
                      // pair needs, and for the same reason.
                      lockedDate(d.date) ? 'locked' : '',
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
                    // A bid with NO decision recorded reads as pending, and
                    // PENDING IS PLAIN — no colour class at all, so the chip
                    // renders as text on the ordinary cell background.
                    //
                    // It was purple until 10 Aug 26, when the owner pointed
                    // out what that cost: an input nobody had looked at and
                    // one already in management's hands were the same colour,
                    // so the sheet could not distinguish them. Purple now
                    // means acknowledged — somebody has seen this — and the
                    // absence of colour means the absence of news.
                    const bid = stateOf(states, p.id, d.date)
                    const chipState = !here || !code
                      ? ''
                      : isDuty(code) ? 'sc'
                      : !isBiddable(code) ? 'info'
                      : bid === 'approved' ? 'appr'
                      : bid === 'refused' ? 'ref'
                      : bid === 'acknowledged' ? 'tbc'
                      : ''
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
      {picking && (
        <CounterSheet shown={shown} onPick={setCounter} onClose={() => setPicking(false)} />
      )}
      {editingWho && people.some(p => p.id === editingWho) && (
        <PersonSheet
          person={people.find(p => p.id === editingWho)!}
          onClose={() => setEditing(null)}
        />
      )}
      {open && !raptorOwns(states, open.id, open.date)
        && canEditCell(period, role, open.date)
        && !(deciding && isBiddable(grid[open.id]?.[open.date])) && (
        <BidPicker
          key={`${open.id}-${open.date}`}
          callsign={open.callsign}
          personId={open.id}
          date={open.date}
          current={grid[open.id]?.[open.date] ?? ''}
          dates={dates}
          /* The counter column follows the leave just entered — ask for OIL
             and the panel snaps to OIL. The owner's ask, and it makes the
             figure answer the question the bidder is actually holding in
             their head at that moment. Derived through the catalogue, so a
             leave type added later needs no edit here; OFF spends nothing,
             so it moves nothing. */
          onWrote={code => {
            const spends = codeOf(code)?.spends
            if (!spends) return
            const i = COUNTERS.indexOf(spends.counter)
            if (i >= 0) setCounter(i)
          }}
          /* What the balance would read AFTER this write, so the sheet can
             ask before taking someone negative. Computed here because this
             is where the wars, openings and ledger already are. */
          wouldLeave={(code, days) => {
            const spends = codeOf(code)?.spends
            if (!spends) return null
            const left = balanceOf(openings, ledger, wars, open.id, spends.counter)
            return { counter: spends.counter, after: left - spends.amount * days }
          }}
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
