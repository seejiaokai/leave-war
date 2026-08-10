# Start here

LEAVE WAR is a leave-bidding system for a fighter squadron, replacing a
spreadsheet the squadron uses to bid for leave ahead of time. This file says
where the work stopped and what comes next, so a session picking it up cold does
not have to reconstruct it from `git log`.

**State as of 10 Aug 26, after the owner's phone review and a second round of
their notes.** 571 unit tests, 125 Playwright runs across a phone and a
desktop project, clean build, all verified first-hand. Work continues on
`claude/bidding-plan-continuation-vqnrfz`, and **`main` is merged up to it** —
see the merge agreement in `CLAUDE.md`.

> **Why `main` is kept current.** It did not used to be. `main`'s RESUME once
> said "`main` is the only branch and the default"; that was true when written
> and false eight minutes later, when this branch began. On 10 Aug a session
> took it at its word, never ran `git branch -a`, and rebuilt the whole
> bidding plan from scratch on a second branch — nine commits duplicating the
> first nine here, then diverging on the period model, the bid states and FCL.
> That branch is discarded; three of its ideas survived and are listed below.
> Every change now ends merged into `main`, gated on a green suite, build and
> browser gate. **Still check the remote for branches before trusting any
> prose about which one is live**, including this paragraph.

## What exists

The roster, the matrix, and a rules engine that turns days amber and red as
manning thins. Availability is fractional — a half day removes 0.5 of a person,
which is the central thing the spreadsheet could not do. Raptor's dark visual
language throughout.

**A bid now has a whole life.** The squadron bids while the war is open;
closing it makes the sheet view-only for members while the admin account keeps
editing; an admin approves, refuses **or moves** each bid; the period walks
draft → open → closed → published, forward only.

**Balances are on screen**, including on a phone, which was the hard part.
Six counters, one frozen column showing one of them at a time, cycled from
its own header. A pending bid draws its counter down immediately, so nobody
can ask for leave they have already asked for; a refusal gives it back.

**There is more than one leave war.** A war is a period plus the leave and
bids inside it. An admin creates one over any span — down to a single month —
and it lands in draft; a picker in the topbar switches between them. A date
belongs to at most one war, and **a balance counts leave from every war**,
because entitlements are continuous and wars are only windows onto them.

**The year is the sheet; bidding opens on a RANGE inside it** (settled with
the owner, 10 Aug 26). Their screenshot showed them creating "JUL - SEP 26"
while a war was already a whole year and wars may not overlap — so "show me
the entire year" and "the admin opens a period, usually monthly" were
fighting. They chose: one sheet per calendar year, always showing all 365
days, and a window opened inside it that only the squadron is held to. Nobody
creates a quarter-length war again. `canEditCell(period, role, date)` is the
one place stage, role and window meet.

**A war is a whole year on screen, with a month strip to navigate it**
(owner's ask, 10 Aug 26: see the entire year, with a quick jump to a month).
The seeded wars are Jan–Dec 26 and Jan–Dec 27. The strip scrolls, it never
filters — narrowing to one month would hide the manning counts either side of
a boundary, which is where a clash shows. 365 columns is ~13,600px and ~9,200
DOM nodes; that was **measured in a browser before the change was adopted**
(687–757ms to load, 296–355ms for a bid round-trip, both viewports), not
after. Two consequences: the geometry gate's node ceiling was raised
deliberately to 9600 against 9241, and **no date before 2028 is free**, so
anything creating a new war has to reach that far out or be refused for
overlap.

**Both directions of the Raptor sync are modelled**, though neither wire
exists. Leave entered on Raptor's input tab arrives already approved — putting
it there means the person asked verbally and was told yes — and Raptor owns
those cells thereafter.

**A bid is plain until somebody looks at it.** Four states, and the colours
are the owner's: pending is plain text on the ordinary cell background,
purple means management has acknowledged it, green approved, red refused.
Purple used to mean "typed", which made a bid nobody had touched and one
already in hand the same colour.

**Leave is asked for in spans, not in days.** One calendar, tap a start, tap
an end — the same control creates a war and opens a bidding window. A range
that crosses a locked day writes what it may and says what it skipped.

**The counter column is a thumb target**, follows the leave just entered, and
asks before taking somebody negative — never refuses, because the squadron's
own workbook runs negative.

**The roster is editable**: seat, band and SXO, with the category still
derived and an SXO reading `OPSP(S)`.

**Every day has two event lines**, admin-written and squadron-read, widening
to fit and then wrapping without growing anybody's row but their own.

**The period picker is labelled, and the tinted chips are readable** (owner,
10 Aug 26). The picker carried the war's name with nothing saying what it
was. Its green came from Raptor, where `.wk.on` marks the SELECTED chip among
grey week buttons — the eye is asked "which one is lit", not "read this".
Standing alone it has to be read, and pale-green ink on a green wash measures
~10.9:1 by luminance while still being hard going, because ink and field
share a hue. **A contrast ratio never flags this.** The tint stays; the ink is
near-white. The dropped-open option list mattered more than the closed chip —
a native `<option>` inherits the select's colours, so it was several rows of
green on green with no border to break them up, and it now takes the neutral
panel colours instead.

**The month strip says where you are, not only where you can go** (owner,
10 Aug 26). The month filling the grid is lit in the accent, and it follows a
real scroll as well as a jump. "Filling" means most of the visible width, not
whichever month the left edge lands in — three days of February beside four
weeks of March is a March screen — and a tie holds the earlier month so the
label cannot flicker while the grid is dragged across a boundary. The
arithmetic is a pure function (`src/ui/monthview.ts`) because the measuring
half cannot be tested: jsdom reports every rectangle as 0×0.

**The under-manned tally opens the days that caused it.** It was a dead end:
it said seven days were broken and left a scheduler to find them across 365
columns. Each row names the day and the rule and figure that broke it, and
choosing one jumps the grid to that column and rings it — through the same
`jumpTo` the month strip uses, so a target lands clear of both frozen columns
without that measurement existing twice.

Five rulings are visible on screen rather than merely written down:

- **A pending bid counts as away**, in the manning counts and in the balance
  alike. Both show the worst case, because that is what warns someone while
  there is still time to act.
- **A refused bid removes nobody.** He asked, he was told no, he is at work.
- **A shift lands pending, not approved.** Moving a bid is a proposal with a
  trail; someone still approves the date it moved to.
- **Negative balances are shown, never refused.** They already run negative in
  the squadron's own workbook — RESET reads −2 annual on first run, and reads
  it from either war.
- **A date belongs to one leave war only.** Overlap is refused on creation and
  rejected on load, or a man would be counted away twice on the same day.

## What to read, in order

| File | Why |
|---|---|
| `docs/superpowers/specs/2026-08-09-leave-war-design.md` | The approved design, kept current. Start here — it explains the domain, not just the code |
| `docs/known-gaps.md` | Limitations and rulings already made. **Read before proposing anything**, or you will relitigate a settled decision |
| `docs/superpowers/plans/2026-08-09-leave-war-bidding.md` | Done. Kept for the reasoning only |

## Next

**The shared backend, and it has to be REAL TIME** (owner, 10 Aug 26).
Everyone sees the same grid as inputs are made, and sees cells turn green or
red as they are decided. That is a stronger bar than "shared" and rules out a
snapshot-on-reload design. It has been the one thing blocking squadron use
since the beginning, and this branch sharpened it: a bid nobody else can see
is not a bid, and an approval in a private browser store is a decision that
never reached anyone. Everything is built so that change lands in
`src/state/storage.ts` and nowhere else — but that seam currently has
`read`/`write` only, and pushing will want a third verb.

Then, in rough order:

- **The rest of balances.** Earned OIL is blocked on data, not effort: the
  half/full rule turns on knock-off time and nothing here carries one. The
  grant sheet and the ledger view are also unbuilt, so a number on screen
  cannot yet be opened and explained.
- **The Raptor contract document**, now that both directions are specified.

Four smaller debts are in `docs/known-gaps.md`: the day verdict is computed
and still not shown in words, `title` tooltips still do not exist on touch, a
cell is not reachable from the keyboard, and the sheets are `role="dialog"`
without a focus trap, focus restore or an Escape key.

## Handing off

Three things a new session cannot find anywhere else in this repo.

**The owner reviews from a published link**, and it is the same one each time:

    https://claude.ai/code/artifact/7bb0d3a7-9f47-4259-a257-524fe537bfbb

That URL is bound to a **local file path**, so republishing the page from a
different path mints a NEW url and leaves the owner refreshing a page that
will never change. A session that did not publish it itself must pass this
URL as the Artifact tool's `url` argument. Republish after any change worth
their looking at — a description of a screen is not a screen.

**The link is the built app inlined into one self-contained page**, because
the host blocks every external request. Build, then put the single
`dist/assets/*.css` into a `<style>` and the single `dist/assets/*.js` into an
inline `<script type="module">`, escaping `</script` in the bundle; add a
`<title>` and a `<div id="root">`, and no `<html>`, `<head>` or `<body>` tags —
the host supplies those. It comes out around 250KB. The app paints its own
background in `theme.css`, so the page holds on either host theme.

**Raptor has not been read, and the owner has asked about it.** They gave the
repo — `seejiaokai/Raptor`, pages at `seejiaokai.github.io/Raptor` — and were
told, correctly, that everything said so far about the merge is this repo
keeping its own side of the bargain: the engine is DOM-free, the only runtime
dependencies are `react` and `react-dom`, and the palette is Raptor's own,
copied from its `scheduler.css`. Whether the merge is a move rather than a
rewrite cannot be answered from here.

**Read it before starting the backend**, because the answers change that
piece of work more than anything else: is Raptor React and which version, is
it TypeScript, what build tool, what holds its state — and above all, does it
already have a server and accounts. If it does, "shared and real time" is a
much smaller job than starting from nothing, and it should be built against
Raptor's rather than invented beside it.

## How this project has actually found its defects

Worth knowing, because it is not the obvious way. **Every real defect here has
come from a review or a measurement. None came from the suite going red.**

The method: after each new test, mutate the implementation to reintroduce the
specific bug that test guards, and confirm that test — and only that one —
goes red. A test not yet seen red is unproven.

That has now caught, across two branches:

- **Three tests that could not fail**, each rewritten rather than kept: a store
  test that never reached the validator it named, a picker test that proved
  nothing because the sheet unmounts either way, and a matrix test named for a
  branch ordering that cannot be observed.
- **Two guards that survived every probe** and are documented as
  belt-and-braces rather than dressed up as tested: the plain-object check in
  the states validator, and the duty-before-bid branch order in `Matrix.tsx`.
- **A wrong test, not a wrong implementation** — the first `drawnFrom` tests
  shared one wide grid and quietly assumed unstated cells draw nothing, when
  an unstated bid reads as pending and draws.

- **A fourth vacuous test**, in the war work: a day-preservation test called
  `initStore` twice with no write between them, so nothing was ever saved and
  it never round-tripped through storage. It passed against a loader that
  discarded every day.
- **A sixth, seventh and eighth**, all in the browser gate and all found by
  probing rather than reading. The balance-column opacity test asserted only
  "not transparent", which a 5%-alpha tint satisfies — it passed throughout
  the defect the owner reported. Its first two rewrites were no better:
  `alpha < 1` is satisfied by a fully transparent cell, and the hovered cell
  changes colour anyway through `.act:hover`, so a stylesheet with the row
  rule deleted passed both. It now measures a SIBLING cell and takes its
  readings before anything is hovered.
- **A fifth, and a dead branch with it**, in the month strip: `monthsIn` began
  with `if (end < start) return []`, and a probe showed the branch could never
  change the answer — the loop condition `d <= end` is already false on the
  first pass. The guard is gone; the test stays, re-aimed at the mutation that
  *can* kill it (a month-index rewrite, which returns one bogus entry), and
  seen red against exactly that.

And three defects found only by **measuring or looking in a real browser**,
which is why the geometry gate is not optional decoration:

- The tightened callsign column clipped "Crew sets" and "IP + IWSO" mid-word
  on a phone, while every callsign still fitted.
- The fix for that silently did nothing, because the breakpoint sat above the
  rules it was narrowing and lost the cascade. Same trap the
  `.blocked`/`.weekend` comment already warns about.
- The new-leave-war sheet rendered clipped at the top of the page, because
  `.topbar` carries `backdrop-filter` and that makes it the containing block
  for any `position: fixed` descendant. Every unit test passed while it was
  broken.

And three more found by LOOKING, on 10 Aug 26:

- The weekday label ran into the date as "SAT03" — one token, which widened
  every column in the year from 37px to 95px. Caught in a screenshot.
- An `<input>` with `width: 100%` contributes nothing to a table column's
  content width, so an event never widened its day however much was typed.
  The member's plain-text row widened correctly all along, which is what made
  it confusing.
- ...and an `<input>` cannot wrap at all, so the column then never wrapped
  either. It is a `<textarea>` — which is what the owner asked for in the
  first place.

**Twice, a stale `vite preview` server made the browser gate a lie.**
`reuseExistingServer` reused a server left running from a manual screenshot,
so `npm run build` never ran and mutation probes "passed" against code that
was never compiled. See `docs/known-gaps.md` for how to kill it.

The space arithmetic that justified the counter column was **also wrong on
paper** — it read 30px day columns off `min-width` where they render at 41px.
The conclusion held, but only measurement showed why.

## Two things not to relitigate

Both are in `docs/known-gaps.md` with the reasoning:

- **Roles are an affordance, not a permission.** There is a MEMBER/ADMIN
  switch and anyone can flip it. It is the spec's own two-role model built
  ahead of the accounts that will enforce it. Do not present it as a security
  model. There is no third role — scheduler and management both hold admin.
- **Leave taken is not posted to the ledger.** The grid is already that
  record; a second copy would be a second version of the truth. The ledger
  holds only what the grid cannot know — top-ups, awards, corrections.

## Running it

```
npm install
npm run dev                 # or: npm run build && npx vite preview --port 4173
npx vitest run              # 571 tests
npm run test:e2e            # 125 runs, phone and desktop (3 touch-only skips)
npm run build               # typecheck + production build
```

The browser gate is not optional decoration, and this branch is the proof.
jsdom applies no layout and reports every rectangle as 0×0, so the unit suite
can prove which class was emitted and nothing about what was painted. The two
frozen columns, the sticky header, each sheet's escape from the element that
would clip it, and whether any label is cut off are only ever verified there.
