// Two free-text lines per day, above the count rows.
//
// The owner's ask, 10 Aug 26: "I should have 2 open text areas to indicate
// events for each day. If the text needs more space, that day will widen to
// accommodate the info until a certain point then it will wrap text and grow
// vertically on that grid only."
//
// `DayInfo.events` has been a `[string, string]` since the period model was
// written — the shape was right and the surface simply did not exist. This is
// the surface.
//
// ADMIN-ONLY to edit, everyone to read. These are the scheduler's facts about
// a day (an exercise, a visit, a range closure), not something a bidder
// writes about themselves — and the whole squadron has to be able to see why
// a week is a bad week to ask for.

import type { DayInfo } from '../engine'
import { setDayEvent } from '../state/store'

/** How many characters a day column widens to before the text wraps. In
 *  `ch` — the width of a character in the cell's own font, which is the unit
 *  this question is actually in — and the same figure the row height is
 *  derived from, so the two cannot disagree. */
const CEILING = 22

export function EventRows({ days, editable }: { days: DayInfo[]; editable: boolean }) {
  return (
    <tbody className="events">
      {([0, 1] as const).map(line => (
        <tr key={line} data-testid={`event-row-${line}`}>
          <td className="who">Event {line + 1}</td>
          {/* Same empty balance cell the count rows carry: a day's event has
              no leave balance, and the cell exists to hold the column. */}
          <td className="bal" />
          {days.map(d => (
            <td
              key={d.date}
              className={`ev${d.events[line] ? ' has' : ''}`}
              data-testid={`event-${line}-${d.date}`}
              /* The column widens to fit the text, up to a ceiling, and only
                 then wraps — the owner's rule. It cannot be left to the
                 table's own auto layout: an `<input>` with `width: 100%`
                 contributes nothing to a column's content width (its width
                 depends on the cell, and the cell's on it), so a day with an
                 admin typing in it stayed 37px wide however much was typed.
                 Measured in a browser; the member's plain-text row widened
                 correctly all along, which is what made it confusing.

                 So the width is asked for in `ch` — the width of a character
                 in the cell's own font, which is exactly the unit this
                 question is in — and CSS caps it. Past the cap, the text
                 wraps and grows these two rows only. */
              style={{ minWidth: `${Math.min(d.events[line].length, CEILING)}ch` }}
            >
              {editable ? (
                /* A TEXTAREA, which is what the owner asked for — "2 open
                   text areas" — and also the only control that can wrap. An
                   `<input>` is single-line by nature, so with one in the cell
                   the column widened correctly and then simply never wrapped,
                   however long the text got. Found in a browser.

                   `rows` is derived from the text rather than left to the
                   element's default, because a textarea does not grow to fit
                   its own content: one line up to the ceiling, then a line
                   per ceiling's worth after it, which is exactly "wrap and
                   grow vertically on that grid only". */
                <textarea
                  className="evin"
                  data-testid={`event-in-${line}-${d.date}`}
                  aria-label={`Event ${line + 1} on ${d.date}`}
                  rows={Math.min(Math.ceil(Math.max(d.events[line].length, 1) / CEILING), 4)}
                  value={d.events[line]}
                  onChange={e => setDayEvent(d.date, line, e.target.value)}
                />
              ) : (
                /* Rendered as text rather than a disabled input: a disabled
                   field invites a tap that does nothing, and an empty one
                   would draw a box around a day where there is no event. */
                d.events[line] || null
              )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}
