# LEAVE WAR — known gaps

What this branch knows about itself and did not fix. Written because the
subagent progress ledger these were first recorded in is git-ignored scratch,
and a limitation that leaves no trace in the repo was not deferred, it was
dropped.

Each entry says what it is, why it was not fixed, and what would fix it.

## Blocking squadron use

**No shared data.** Every write goes to the browser's own storage, so forty
people bidding is forty private copies and management approving is a
forty-first. This is the single thing between the app and real use, and it is
the next phase of work. Until it lands this is a prototype the owner can judge,
not a tool the squadron can use — the spreadsheet at least sits where everyone
can open it.

**What it has to become (owner, 10 Aug 26): everyone sees the same grid in
real time.** An input appears for everybody as it is made, and so does every
change of state — a cell going green or red as it is decided. That is a
stronger bar than "shared": it rules out a design where each browser reads a
snapshot and only notices someone else's bid on reload, which is the shape a
plain REST store would give. Whatever replaces `storage.ts` has to push, not
just persist.

Everything is built to make that change small: all persistence goes through one
module (`src/state/storage.ts`), and every write goes through one function
(`setCell`). Nothing else in the codebase touches either.

Storage now holds five keys, not one: `wars` (each carrying its own period,
grid and states), `current`, `role`, `openings` and `ledger`. They are written together by a single `persist()` so
no path can save one and forget another, and `initStore` reconciles each
war's grid and states on load — a stored state whose cell no longer holds a
bid is dropped rather than left to colour the wrong cell.

Stored states written before bids carried a source are **bare strings**, and
they are migrated on load rather than rejected: a string could only ever have
meant a bid placed here, so `source: 'bid'` is a fact and not a guess.
Rejecting them would have degraded a squadron's real decisions to the seed to
gain nothing.

## The role switch is an affordance, not a permission

The interface now has a MEMBER/ADMIN switch, and **anyone can flip it**.
There is no login, so nothing verifies which one a person is: the switch
decides which controls appear and nothing else. Closing the war genuinely
locks members out of editing *in the interface*; it does not stop anyone who
flips the switch.

This is the spec's own two-role model (§Roles) built ahead of the accounts
that will enforce it, in the same way approval was. **Do not present it as a
security model** — it is the shape a real one will take, with the check
missing.

Everything else that follows from having no accounts still holds: anyone can
approve, refuse or shift anyone's bid, and anyone can bid on anyone's row.

The bidding plan called for a fixed `ME` roster entry standing in for a
session. That was not built: the tests bid on whichever row was clicked, so an
`ME` constant would have been dead code claiming an identity model that does
not exist. A real one arrives with accounts. Until then the app is honest
about being a scheduler's view of everybody rather than a bidder's view of
themselves.

## What balances do not yet do

Balances are computed and on screen. Three parts of §Counters are not built:

- **Earned OIL.** The automatic-OIL rule turns on knock-off time — later than
  14:30 credits 1.0, at or before credits 0.5 — and **nothing in this app
  carries a knock-off time**. So a balance is `opening + grants − drawn` and
  never `+ earned`. This is blocked on data, not effort, and it is the reason
  step 5 of the build order is only half done.
- **No grant sheet.** The ledger is seeded and read; nothing can post a
  top-up, an award or a correction through the interface.
- **No ledger view.** §Counters promises that any number on screen can be
  opened and explained. It cannot yet: the counter column shows the figure
  and the tooltip says what it counts, but the entries behind it are not
  visible anywhere.

Also note the derivation, because it narrows the spec deliberately: §Counters
says every change to a counter is a ledger entry, and **leave taken is not
posted to the ledger here**. The grid is already that record, and a second
copy of it would be a second version of the truth. The ledger holds only what
the grid cannot know.

## The owner's review of 10 Aug 26, and what it settled

Twelve pieces of feedback from a phone. What they changed is in the spec; what
they SETTLED is here, so it is not relitigated:

- **The year is the sheet; bidding opens on a range inside it.** A quarter is
  never a war of its own again. Asked and answered when their screenshot
  showed "JUL - SEP 26" being created inside a year-long 2026.
- **A bid nobody has answered carries no colour.** Purple means management has
  acknowledged it. This is why `acknowledged` exists at all.
- **`OFF` is leave, not a marker.** Free — no entitlement spent — but the
  person is gone from the manning picture, so it is asked for and answered
  like any other leave. The only leave type with a null counter.
- **`OD` counts the manpower as gone**, and always did. Pinned at the count
  level now.
- **There is no PCL.** See the leave-type section below.
- **Events are the scheduler's**, not the bidder's: admin-only to write, and
  everyone reads them.
- **The category is still derived.** The roster sheet edits seat, band and
  SXO — never the category itself — because that derivation is what lets
  Raptor's roster replace this one without a migration.

## Wars, and what is not built about them

An admin can create a leave war over any span and switch between them. Three
things are deliberately absent:

- **No war can be deleted or renamed.** Nothing removes one, which is why
  `wars` is never empty and `withCurrent` can fall back to the first. A war
  created by mistake stays.
- **A war's requirements are shared, not per-war.** `Requirements` still sits
  at the top of the store, so every war is judged against the same manning
  rules. Real squadrons vary them by period; the rules editor is where that
  belongs.
- **Nothing stops a war being created in the past**, or a hundred of them.
  There is no sanity bound on the dates beyond "end not before start" and
  "no overlap".
- **The seeded wars now cover the whole of 2026 and 2027**, one year each,
  because the owner reads the year at once (10 Aug 26). A consequence worth
  knowing before writing a test: **there is no free date nearer than 2028**,
  so anything creating a war has to reach that far out or be refused for
  overlap. Two e2e tests and several store tests moved for exactly this.
- **The bidding window does not bind an admin**, and never overrides the
  stage. It holds the SQUADRON to the part of the year the schedule has
  reached; a closed war is closed to them on every date, window or no window.
- **A window is refused, never clamped.** An admin who typed the wrong year
  has made a mistake worth being told about; sliding their dates to the
  period's edges would leave them believing they opened something else.
- **A month is only navigation, never a filter.** The strip scrolls the year
  to a month; it does not narrow the grid to it. That was the owner's ask —
  see the whole year, jump to a month — and it matters because a filter would
  hide the manning counts either side of a boundary, which is where a leave
  clash actually shows up.

## Removing a leave type is a breaking data change

Twice over, on the same day. `FCL` was removed on the morning of 10 Aug 26,
and that afternoon the owner settled the confusion that caused it: **there is
no PCL.** This author could not tell FCL from PCL, guessed there were two,
and removed the wrong one. The catalogue now carries `FCL` — family care
leave — and no `PCL` at all. `PL` is unrelated and unchanged.

The counter list is derived from the code catalogue, so a counter follows its
leave type in and out with no other file edited — the property both changes
proved. But **stored balances that still name a counter the catalogue no
longer has are rejected on load**, and `openings` or `ledger` falls back to
the seed entire rather than dropping just the stale entries. Anyone whose
browser holds a balance from this morning naming `pcl` gets the seed back.

That is the established rule for every stored shape here (an unknown value
means the blob is not trustworthy), and it is the right default while this is
one browser's own storage. It stops being acceptable when the shared backend
lands and a removed code could discard a squadron's real balances: at that
point a removal needs a migration, not a fallback.

## The RAPTOR clash has nowhere to go

`ingestFromRaptor` returns `clash` when an inbound input lands on a date the
squadron already bid differently, and **nothing displays it**. The value is
returned to the caller and dropped, because until the wire exists the only
caller is a test. The rule is right and tested; the surface it needs does not
exist. Build it with the wire, not before.

## The geometry gate claims less than it appears to

`npm run test:e2e` runs its "phone" project as **Chromium with an iPhone
viewport, not WebKit**, because the container ships no WebKit build. The
viewport, touch, user agent and scale factor are emulated; the rendering engine
is not the one real iPhones use.

This matters more than it usually would. The gate's whole purpose is the frozen
column and sticky header, and `position: sticky` inside a `<table>` is exactly
where Blink and WebKit have historically diverged. So the gate proves the layout
holds in Chromium and infers the rest.

Run the gate against real WebKit before the squadron opens this on iPhones. It
is a one-line config change wherever a WebKit build is available; nothing in the
test code needs to change.

## Deliberately deferred to later plans

- **The day's overall verdict is computed and not shown.** `evaluateDay`
  produces a worst-across-all-rules verdict per day, and the interface still
  renders only the per-rule count rows. This was marked "for the bidding
  plan", and the bidding plan did not do it: a bidder can watch the count
  rows move as they bid, but nothing tells them in words what their bid
  would break. Still outstanding, and now more clearly worth doing — the
  bid sheet is the surface that would carry it.
- **`title` tooltips do not exist on touch.** The blocked-day reason and the
  count-row detail are still `title` attributes, which a phone never shows.
  Bidding added a real surface (the bid sheet) but did not move these onto
  it. The spec's promise that a bidder is told *why* a day is blocked is
  therefore still unkept on a phone.
- **A cell is not reachable from the keyboard.** Bidding and deciding hang
  off `onClick` on a `<td>`, which takes no focus and answers no Enter key.
  Making 1,440 cells focusable buttons would cost more DOM than the grid can
  afford, so the fix is a roving-tabindex grid, which is its own piece of
  work. The sheets themselves are ordinary buttons and are fully operable.
- **The sheets are `role="dialog"` without the behaviour that usually
  implies.** No focus trap, no focus restore, no Escape key — a click on the
  ✕, on another cell, or on a choice is what closes them. The role is right
  for what they are; the interaction is not yet complete.

## Rulings made, so they are not relitigated

- **`focusDate` is view state, and it lives in the domain store on purpose.**
  The stage strip and the matrix render independently of each other — neither
  takes props from the other, so both stay renderable standalone in their own
  tests — and the store is already the channel they share. It is not
  persisted: where someone was last looking is not a fact about the leave war.
  The `focusSeq` counter beside it exists because a date alone cannot say
  "asked again", and with 365 columns the grid is almost never still where it
  was left, so choosing the same day twice must snap back to it. It is cleared
  on `selectWar`: wars do not overlap, so a date from the old one names no
  column in the new grid.
- **The under-manned list is positioned from JS, not CSS.** The stage strip is
  `flex-wrap: wrap`, so the chip it hangs from sits in a different place on a
  phone than on a desktop, and there is no CSS way to say "under the chip, but
  never off the screen" when the anchor itself moves. Anchored naively it ran
  past the right edge of the phone viewport and its rows stopped being
  clickable — a mutation probe reproduces exactly that, failing on phone and
  passing on desktop. `LIST_WIDTH` in `Chrome.tsx` must stay in step with
  `.umlist`'s width in `chrome.css`.
- **The tinted chips do not use Raptor's `.wk.on` ink.** Raptor's value is for
  a chip that is one of several and only has to look *lit*; here the same
  chips have to be *read*. Do not "restore" them to Raptor's palette — see the
  comment on `.wk.on` in `chrome.css` for the measurement and why a contrast
  ratio does not catch it.

- **`DayCounts.duty` counts heads, not availability.** It increments by one for
  a half-day SC duty exactly as for a full day. This is deliberate — it answers
  "how many people are on SC today", which is a head count, not a fraction of a
  person. Every *availability* figure in the same module is fractional; this one
  is not, on purpose.
- **A cleared cell deletes its key rather than storing an empty string**, so a
  day someone cleared is indistinguishable from one never set. Intended: there
  is no third state to represent.
- **`initStore()` clears every subscriber.** Call it once before render, never
  after mount, or a live component's subscription is silently dropped. Pinned by
  a test named as a contract. A fresh boot is a clean slate; the trap is real,
  which is why it is written down rather than left implicit.

## Small and safe to carry

- **The swipe on the counter column is gated only on the phone project**,
  because Chromium's touch emulation is what dispatches it. Three tests skip
  elsewhere rather than pretending to have run. The sheet — the guaranteed
  path — is gated on both.
- **`.bidsheet`'s `max-height` is belt and braces, not tested.** The gate
  asserts every sheet sits wholly inside the viewport and deleting it does not
  break that: the tallest sheet is ~500px against a 664px phone, so nothing
  yet overflows. It is there for the sheet that eventually does.
- **A stale `vite preview` server will silently invalidate the browser gate.**
  `playwright.config.ts` sets `reuseExistingServer: !CI`, so a server left
  running from a manual screenshot is reused and `npm run build` never runs —
  the gate then tests the last build, not the working tree. This cost real
  time twice on 10 Aug 26: mutation probes "passed" against code that was
  never compiled. Kill it with `pkill -f "vite prev[i]ew"` — the bracket stops
  the pattern matching the shell running it.
- One test writes a real `leavewar:grid` key into jsdom's storage and does not
  clean it up. Harmless while every other test passes an explicit backend and
  none calls bare `initStore()` — it becomes a cross-test dependency the day one
  does. Now slightly larger a trap than it was, since a bare `initStore()`
  would read `leavewar:states`, `leavewar:stage`, `leavewar:role`,
  `leavewar:openings` and `leavewar:ledger` from the same store.
- The DOM ceiling in the geometry gate is **9600 against a measured 9241**,
  raised from 2500/2357 on 10 Aug 26 when the war became a year rather than a
  quarter. Raising it is meant to be a deliberate edit in whichever change
  adds the nodes, not a reflex when it goes red. Note the selector's blind
  spot: it counts `.mx *`, and the bid sheet renders outside the table, so it
  adds nothing to that figure. The same test therefore also counts the whole
  document with the sheet open (9278, ceiling 9700). It now carries a **lower**
  bound of 8000 as well, so a grid that quietly shrank back to a quarter fails
  instead of passing comfortably.
- `setCell` stores an empty row object for a person whose last state is
  cleared, so `states.ramp` can be `{}` rather than absent. Every reader uses
  `stateOf`, which is indifferent, and `initStore` prunes empty rows on the
  next load. Worth knowing before someone reads a persisted blob and
  concludes a row means something.
