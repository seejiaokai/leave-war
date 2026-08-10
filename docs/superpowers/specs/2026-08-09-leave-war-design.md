# LEAVE WAR — design

Status: approved in brainstorming, 9 Aug 26. Not yet built.

A leave-bidding system for a fighter squadron. The squadron forecasts roughly a
quarter ahead, the scheduler states how many crew each day needs, the squadron
bids for leave against that forecast, and management approves or refuses each
bid. It replaces a spreadsheet, and it is designed to be folded into RAPTOR
later rather than to live beside it forever.

Built from two reference workbooks the owner supplied: `Gryphon Leave WAR 2026`
(the squadron's own, quarterly) and `LEAVE WAR 2025/26 CAA` (an overseas
squadron's, monthly). Where this document says "today", it means those files.

## Why it exists

The spreadsheet works, and three things about it do not:

- **The requirement is invisible.** The four count rows at the top of the
  Gryphon sheet are `COUNTIFS` that count who is *still available*. The number
  actually needed appears nowhere in the file — it lives in the scheduler's
  head, and the colour that says "we are under" is applied by hand.
- **A half day costs a whole person.** The counts test for an *empty* cell, so
  `AM` removes a person for the entire day, and so does `FS`/`HS` SC duty —
  which is someone at work. This is why availability gets discussed in awkward
  fractions like "4.5 sets": the real figure is fractional and the sheet can
  only count in whole people.
- **OIL has no audit trail.** Grants live as free text — `Deduct 3 oil for Lee
  JG` in a remarks cell, with no date, no approver and no trace. The overseas
  squadron's OFF TRACKER does better (callsign, date, days, reason, approved
  by) and has already outgrown its own shape: a half day is recorded as
  `0.5 ON 18 MAY` typed into a column meant for a date.

## Scope

**In:** the roster, the matrix, the rules engine, the bid cycle, approval,
balances for every entitlement, the OIL ledger, and automatic OIL crediting
from an approved schedule.

**Out, deliberately:**

- **RAPTOR integration.** Designed for throughout, built later. See
  §Fitting into RAPTOR.
- **A second squadron.** The two reference files have different layouts and
  different code sets. Building for both now costs real time for a squadron
  that is not going to use this.
- **Real accounts and a shared backend.** See §Storage — this is the one
  omission that blocks squadron use, and it is the next piece of work.

## The roster

A person is a **callsign**, a **seat** (pilot or WSO), a **qualification band**
(instructor, or ops meaning CAT D up to CAT A), and the **dates they are in the
squadron**.

The four manning categories are not stored. They are derived:

|            | instructor | ops (CAT D–A) |
|------------|-----------|---------------|
| **pilot**  | IP        | OPSP          |
| **WSO**    | IWSO      | OPSW          |

**SXO** is a separate flag carried on top of a category, because a requirement
of "2 pilots, 2 WSOs, 1 SXO" needs the SXO counted both as an SXO and as
whatever they normally are.

Deriving rather than storing is what makes the RAPTOR merge cheap: RAPTOR
already holds seat, the CAT ladder (`OCU→D→C→B→A→IW→IP→IR→FI`) and an `sxo`
qualification flag. Its roster drops in and the categories keep computing
themselves. There is never a second list of people to keep in step.

### Posted out is a roster fact, not a leave code

Today `PO` is typed into every remaining cell of the quarter by hand — the most
common code in the file at 269 cells. It means the person has left the
squadron.

It becomes the roster's **in-squadron from/to dates**. The grid draws `PO` from
the posting-out date onwards by itself and the person leaves every count from
that day. No typing, and no chance of a half-filled row leaving a departed
member counted as available. The same field expresses arrivals, which the
spreadsheet cannot do at all.

## Day codes

Every code carries four facts, replacing today's "any text means gone":

- **Removes** — how much of the day the person is unavailable for: 1.0, 0.5, or
  nothing.
- **Spends** — which counter it draws down, if any.
- **Earns** — OIL, for duty codes.
- **Bid** — whether it is something a person bids for. Medical, courses and
  duty are not bid, so they never enter a bid state.

| Code | Meaning | Removes | Spends | Earns | Bid |
|---|---|---|---|---|---|
| `LL` | local leave | 1.0 | annual leave | — | yes |
| `AM` / `PM` | half day leave | 0.5 | 0.5 annual leave | — | yes |
| `OL` | overseas leave | 1.0 | annual leave | — | yes |
| `OIL` | full OIL | 1.0 | OIL | — | yes |
| `HO` | half OIL | 0.5 | 0.5 OIL | — | yes |
| `CCL` | child care leave | 1.0 | CCL | — | yes |
| `FCL` | family care leave | 1.0 | FCL | — | yes |
| `PL` | paternity leave | 1.0 | PL | — | yes |
| `EL` | embarkation leave | 1.0 | EL | — | yes |
| `OFF` | off — free leave | 1.0 | *nothing* | — | yes |
| `M` | medical (HL/ATT C) | 1.0 | — | — | no |
| `HL` | hospitalisation leave | 1.0 | — | — | no |
| `CSE` | course | 1.0 | — | — | no |
| `OD` | overseas duty | 1.0 | — | — | no |
| `FS` | full day SC duty | see below | — | 1.0 OIL | no |
| `HS` | half day SC duty | see below | — | 0.5 OIL | no |

The code list is configurable — adding one is data, not a code change — in the
same way RAPTOR's stores list is configurable.

**`FCL` was removed on the morning of 10 Aug 26 and restored that afternoon**,
and the round trip is worth recording because the mistake was this document's.
It carried BOTH `FCL` and `PCL`, which the owner settled as one code, not two:
**there is no parentcare leave; it is FCL, family care leave.** `PCL` was the
invention and is gone. `PL` is a separate entitlement — paternity leave — and
was never in question.

Both edits took a counter with them without anyone touching the counter list,
because that list is derived from this table rather than restated beside it.

### OFF, and what "removes" really means

**Added 10 Aug 26**, from two of the owner's notes on the same day.

`OFF` is **free leave**: "free leave that doesn't consume any leave, but it
will count that manpower as gone too". It is a LEAVE TYPE, not a marker — the
person asks for it and management answers, because it takes a man out of the
manning picture exactly as annual leave does — and it is the only one with no
counter. What it is not is an entitlement, so there is no balance to draw.

`OD` **counts the manpower as gone**, which it always did: every non-leave
marker removes the whole day. Worth stating because the contrast is easy to
get backwards. `FS`/`HS` also leave the flying count, but that person is AT
WORK and appears on the separate duty line — a day thin because half the
squadron is on SC reads very differently from one thin because half the
squadron is abroad. `OD` must never appear there.

### SC duty and the counts

`FS` and `HS` mean the person is at work but not on the flying programme. They
are **excluded from the flying manning counts and reported separately**, so a
day that looks thin because half the squadron is on SC reads differently from a
day where everyone is on leave. This preserves today's effective behaviour
while making the reason visible.

## Counters

Rather than a fixed set of balances, a person carries a **named counter per
entitlement**: annual leave, OIL, CCL, FCL, PL, EL, and any added later.
Each spending code names the counter it draws from. A new entitlement next year
is configuration.

**Every change to every counter is a ledger entry**: date, amount, counter,
reason, who approved it, and its source (a person, or the schedule). One
mechanism covers all of it:

- the 1 January annual leave top-up, posted per person as a grant
- embarkation leave, granted free ahead of an overseas posting
- management awarding OIL — CNY, a workplan, an exercise — as the OFF TRACKER
  does today, with reason and approver preserved
- OIL earned by working, posted automatically (§Automatic OIL)
- corrections, which today are untraceable free text

A balance is always its opening figure plus its ledger, so any number on screen
can be opened and explained.

**Balances may go negative.** They already do — annual leave at −14, OIL at
−5.5 and −3. Negative shows red and is never refused.

## The cycle

A leave war is a period with stages, not a permanently open calendar.

| Stage | Who acts | What happens |
|---|---|---|
| **Draft** | scheduler | Dates, events, blocked days and requirements are set. Not visible to the squadron. |
| **Open** | squadron | Bids are placed. Each lands as `TBC`. Counts and warnings are live. |
| **Closed** | — | Bidding stops. The picture freezes for review. |
| **Published** | management | Every bid is approved or refused, and the squadron sees the outcome. |

**The colours were restated by the owner on 10 Aug 26**, and the table below
this paragraph is superseded by §Interface: an input nobody has answered
carries NO colour, purple means management has ACKNOWLEDGED it, green is
approved and red refused. The four-state model exists because purple used to
mean "typed", which made a bid nobody had looked at and one already in
management's hands the same colour.

Bids awaiting a decision are magenta `TBC`, approved are green, refused are
red — the squadron's existing colour convention, unchanged.

### Roles

Two roles, matching RAPTOR's prototype split:

- **Member** — bids for themselves, sees the whole matrix and everyone's bids,
  as they do in the shared spreadsheet today.
- **Admin** — the scheduler and management functions: building the period,
  requirements, events, blocked days, approving, refusing and shifting bids,
  ledger grants, and the roster.

**Settled, 9 Aug 26: there is no third role.** The scheduler and management
both hold the admin account — "what I mean is they have an admin account"
(owner). The split between them that this document once deferred is not a
split at all, so the two roles above are the whole model.

**The edit lock is what closing does.** While the war is open a member edits
their own leave; once the admin closes it the sheet is view-only for the
squadron, while the admin keeps editing so the picture can still be
corrected. That is one rule (`canEdit(stage, role)`), not a separate lock
that could be left unapplied.

Nothing verifies which role a person is — there is no login — so the switch
in the interface decides which controls appear and nothing else. See
`docs/known-gaps.md`.

### Periods

**Settled, 9 Aug 26, and built 10 Aug 26.** A period is a **date range the
admin chooses**, selectable down to a single month. A quarter is the common
case — the reference workbook is quarterly — but it is not a constraint. The
admin opens one when the schedule firms up rather than on any calendar
trigger.

**The seed is a whole year, changed 10 Aug 26 at the owner's request:** they
want to see the entire year in one leave war, with a quick way to reach a
given month. So the seeded wars are Jan–Dec 26 (open) and Jan–Dec 27 (draft).
A year is 365 columns, roughly 13,600px and about 9,200 DOM nodes — measured
in a real browser *before* the change was adopted, at 687–757ms to load and
296–355ms for a bid round-trip on both a phone and a desktop viewport. Had
that come out in seconds the year would not have shipped.

Many periods exist at once and one is on screen. A **leave war** is a period
together with the leave and bids inside it; the three travel as a unit so a
grid cannot belong to the wrong period. Creating one is an admin act, it
lands in draft, and it does not take the screen.

**A date belongs to at most one leave war.** Overlap is refused on creation
and rejected on load. Two wars covering 5 January would let a person hold
leave that day twice over: the manning counts would count him away twice, his
balance would be drawn twice, and nothing downstream could say which war was
the real one.

**Entitlements are continuous; leave wars are windows onto them.** Annual
leave and OIL do not reset when a quarter closes, so a balance counts leave
from **every** war, not the one being looked at. A figure counting only the
current war would let the same twenty days be bid twice, once in each.

The engine models this directly: `Period` carries free `start`/`end` strings
and `buildDays` builds any span, so a month-length period needs no engine
change. Multiplicity and selection — many wars, a picker, an admin create
sheet — were the piece of work that followed, and are built.

### Reading a year: navigate, do not filter

A year-long war cannot be read by dragging. A **month strip** above the grid
gives one button per month the war covers — derived from its own span, so a
quarter-long war gets three buttons and a month-long one gets a single
button — and pressing one scrolls the grid so that month's first day lands
just clear of the frozen columns.

It **scrolls, it does not filter.** That is deliberate: narrowing the grid to
one month would hide the manning counts either side of the boundary, and a
leave clash across the turn of a month is exactly the thing this is meant to
catch. The owner asked to see the whole year with a quick way to reach a
month, and those two are the same requirement.

The first entry points at the day the war **actually starts**, not the 1st of
that month — a war beginning on the 12th has no column for the 1st, and
jumping to a cell that is not rendered scrolls nowhere. The two frozen
columns' width is measured live and taken off the target, because they are
painted over the day cells and are a different width on a phone; without it,
the month arrives on screen underneath them.

## The rules engine

### What the scheduler sets per day

- **Events** — free text, two lines per day, as both reference files carry
  (`SC`, `PH`, `RSD`, and named events like a squadron COC).
- **Blocked** — a flag with a reason. Leave is discouraged; bids are still
  accepted and the bidder is told why they are being warned.
- **The requirement** — set once as a period default, overridden only on days
  that differ. Most of a quarter is identical.

### The requirement

Two kinds, both active at once:

- **Sets** — a set is a pilot plus a WSO. "4.5 sets" means 4.5 pilots and 4.5
  WSOs available, counted fractionally.
- **Category minimums** — `IP ≥ 2`, `OPSW ≥ 3`, combinations such as
  `IP + IWSO ≥ 4`, and named roles such as SXO.

Each carries an **amber** threshold (a heads-up) and a **red** threshold
(under-manned). A day takes the worst result of every rule applying to it: one
broken rule is enough.

**Availability is fractional.** A half-day code removes 0.5 of a person, not
1.0. This is the single largest behavioural difference from the spreadsheet.

### Shifting a bid

**Added 9 Aug 26.** Management's third answer, beside approve and refuse:
**move the bid to another date**. It is what they reach for when a week goes
red and refusing outright is too blunt.

A shift lands **pending, not approved**, and records the date it came from.
Moving a bid is a proposal with a trail — someone still approves the date it
was moved to — and a leave date that changed with no trace is exactly the
untraceable edit the OIL ledger exists to end. A shift never overwrites: a
destination that already holds a code is refused, with the reason shown.

### Bidding against the rules

At the moment of bidding, before submitting, the person is told which rule
their bid would break, what the count becomes, and whether the day is blocked
and why.

**They can still submit.** Warn, never block — management keeps the final say,
and someone with a genuine reason must always be able to ask.

## Automatic OIL

When a schedule is approved that puts someone on SC duty on a weekend or public
holiday, the leave war marks that cell yellow by itself — `FS` or `HS` — and
posts the matching ledger entry:
*SC duty, Sat 17 Jan, knock-off 1600, 1.0 OIL, from the schedule.*

**The half/full rule:** knock-off later than **14:30** credits 1.0; at or
before it credits 0.5. A public holiday is treated exactly like a weekend — no
bonus and no special case. Working a public holiday earns OIL because an
ordinary working day does not.

Auto-marked cells are tagged as coming from the schedule rather than from a
person, so earned OIL is always distinguishable from granted OIL. That
traceability is the point: it is the check and balance on how OIL was awarded.

Two cases handled explicitly rather than papered over:

- **The schedule changes after approval.** The marking and its ledger entry are
  reversed and replaced, and the reversal stays visible. A balance that changes
  silently is worse than one that changes with a reason attached.
- **A bid already exists on a day the person is then scheduled SC.** The system
  never overwrites a bid. It raises the clash to the scheduler and to the
  person, and a human decides.

Until RAPTOR is merged, "a schedule is approved" means an admin entering the SC
duty and its timings here. Afterwards RAPTOR's own approval drives the same
path.

## Interface

**One matrix on every device** — people down, days across — because it is what
the squadron already reads. The owner chose this over a separate phone layout,
having been shown the trade-off.

Making that genuinely work on a phone is real work, not an afterthought: a
frozen callsign column, a sticky date header, momentum scrolling, and tap
targets big enough to hit. A matrix you have to pinch at is the complaint, not
the solution.

Colours, end to end:

| What | Where | Colour |
|---|---|---|
| Input, nobody has answered it | person's cell | **no colour** — plain text |
| Acknowledged, not yet decided | person's cell | magenta |
| Approved | person's cell | green |
| Refused | person's cell | red |
| SC duty earning OIL | person's cell | yellow |
| Manning thin / under | count rows | amber / red |
| Blocked day | date header | orange |

Orange and amber are close in hue, and they never compete because they sit on
different rows: blocked is a property of the day and lives on the date header;
amber and red are computed and live on the count rows beneath. If that proves
too subtle in use, the blocked column gets a hatch instead of a tint.

**Reading a year on a phone, settled 10 Aug 26 by measurement.** At 390×760
the chrome held 690px of a 760px screen and left four aircrew rows visible.
The topbar now scrolls away (the date header inside the grid stays sticky,
which is the only part that was load-bearing while reading) and a phone
breakpoint tightens what is left: 229px of chrome, 15 rows, 7 day columns.
Every date column names its weekday, because a year numbered 01…31 twelve
times over gives the eye nothing to hold on to.

**Every control is sized for a thumb.** The counter column's ‹ › arrows were
13px glyphs in a 44px column and the owner could not hit them; the whole
column header is now the control, opening a sheet of full-width 44px rows,
with a swipe across the column as the fast path. That mistake set the size
for everything after it — the range calendar's days are 36px and its month
arrows 34px.

**Two event lines per day**, admin-written and squadron-read. The column
widens to fit, up to a ceiling, then wraps and grows those two rows only —
never anybody else's, or a year stops being readable the moment one day is
busy.

**Leave is asked for in spans.** One calendar, tap a start, tap an end, with
the range drawn between them. The same control sets a war's dates and a
bidding window. Two native date inputs cannot show a range at all: the first
has closed before the second opens.

Beyond the matrix: a person's own page (balances, bids, ledger history), the
ledger view (filterable, squadron-wide), the rules editor, and the roster —
though the roster's core is now editable in place: seat, band and SXO, with
the category still derived and an SXO reading `OPSP(S)`.

## Architecture

RAPTOR's shape, so the merge is a move rather than a rewrite:

- **`src/engine/`** — rules, counters, ledger, availability, the cycle's state
  transitions. No screen code at all, so it runs headless and is tested
  directly. This is the part that eventually lifts into RAPTOR.
- **`src/state/`** — the store, one mutation path, undo.
- **`src/ui/`** — the matrix and the pages.

Storage sits behind **one swappable seam**, so moving from browser storage to a
server is a single change and not a rewrite of every write path.

### Testing

- Engine tests on every rule and every sum — these are the numbers people will
  argue about.
- Component tests for the pages.
- **A real-browser geometry gate for the matrix**, following RAPTOR's hard-won
  lesson: a test runner with no layout engine reports every rectangle as 0×0
  and cannot see that a frozen column has come unstuck or that a cell has grown
  to an unusable size. The matrix on a phone is the riskiest surface in this
  build and it needs measuring in a browser.

## Storage, and the one thing that blocks squadron use

A leave war is inherently shared. Browser-local storage means forty people
bidding in forty separate browsers and management approving in a forty-first —
which is not a leave war.

**Decision: build against the storage seam now, on browser storage, and make
the shared backend the immediate next phase — before the squadron uses it.**
This gets the interface and the engine in front of the owner quickly, which is
where the value of this project is, without building anything twice.

Recorded plainly: **until that backend exists, this is a prototype the owner
can judge, not a tool the squadron can use.** The spreadsheet at least sits
where everyone can open it, and anything replacing it must clear that bar.

## Fitting into RAPTOR

Designed for from the start, built later:

- Categories derive from seat and CAT band, which RAPTOR already stores.
- SXO comes from RAPTOR's quals rather than being kept here.
- The rules editor is shaped to become its own section of RAPTOR's rules tab.
- The engine is DOM-free precisely so it can be lifted across.

The integration the owner wants: **an approved leave becomes a personal input
on the schedule automatically**, arriving for the scheduler to accept through
RAPTOR's existing accept-an-input path. And RAPTOR's approved schedule drives
the automatic OIL crediting described above. Neither wire is built yet.

### The inbound direction

**Added 9 Aug 26**, and absent from this document until then — it described
only the outward path.

Leave entered **directly on RAPTOR's input tab** means the person sought
approval **verbally and already has it**. So it arrives here already
approved, green, without anyone deciding anything in the leave war. Members
do this for themselves as well as schedulers doing it for them, and either
way it syncs back.

The two systems therefore need to agree about **who owns a cell**. RAPTOR
owns what RAPTOR last wrote: the leave war refuses to edit, decide or shift
those cells and says so, because changing one here would leave the two
disagreeing. Source tracks the last authority to write, not the origin — a
cell round-trips (bid, approved, out to RAPTOR, edited there, back), and
after that last step RAPTOR owns it.

The existing clash rule applies unchanged: an inbound input landing on a date
the squadron already bid differently **never overwrites**; it raises the
clash for a human. An identical code is not a clash — that is RAPTOR
confirming what was asked, so the cell is upgraded in place.

Outbound is **derived, not queued**: the payload is every approved cell the
squadron bid for, computed from the grid and the states. A queue would be a
second record of a fact the grid already holds, and a bid refused after being
queued would sit there waiting to be sent.

## Build order

Each step usable before the next begins:

1. Roster and the matrix that renders it
2. The rules engine and live manning counts
3. Bidding and the cycle stages
4. Approval
5. Balances, the ledger, and automatic OIL

Steps 1–4 are built. Step 5 is **half** built: balances, the counter list and
the ledger's shape are done and on screen; the grant surface, the ledger view
and **automatic OIL** are not. Automatic OIL is blocked on data rather than
effort — the half/full rule turns on knock-off time and nothing in this app
carries one.
