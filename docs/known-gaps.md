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

Everything is built to make that change small: all persistence goes through one
module (`src/state/storage.ts`), and every write goes through one function
(`setCell`). Nothing else in the codebase touches either.

**`setCell` has no production caller yet.** The matrix is read-only until the
bidding plan lands, so the persist-and-reload path only ever runs in tests. Not
a defect — a consequence worth knowing before someone concludes storage is
broken because a reload shows the seed.

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
  produces a worst-across-all-rules verdict per day, and the interface currently
  renders only the per-rule count rows. The engine behaviour is correct and
  tested; nothing on screen yet summarises a day's standing. For the bidding
  plan, where a bidder needs to be told what their bid would break.
- **`Period.stage` is seeded and read by nothing.** The cycle stages — draft,
  open, closed, published — are modelled but not enforced. The bidding plan is
  what gives them meaning.
- **`title` tooltips do not exist on touch.** The blocked-day reason and the
  count-row detail are `title` attributes, which a phone never shows. The spec's
  promise that a bidder is told *why* a day is blocked needs a real surface, and
  that arrives with bidding.

## Rulings made, so they are not relitigated

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

- One test writes a real `leavewar:grid` key into jsdom's storage and does not
  clean it up. Harmless while every other test passes an explicit backend and
  none calls bare `initStore()` — it becomes a cross-test dependency the day one
  does.
- The DOM ceiling in the geometry gate is 2500 against a measured 2227. Raising
  it is meant to be a deliberate edit in whichever change adds the nodes, not a
  reflex when it goes red.
