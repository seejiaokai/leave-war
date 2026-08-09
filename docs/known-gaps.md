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

Storage now holds three keys, not one: `grid`, `states` and `stage`. They are
written together by a single `persist()` so no path can save one and forget
another, and `initStore` reconciles the first two on load — a stored state
whose cell no longer holds a bid is dropped rather than left to colour the
wrong cell. Seeded states are attached only to a seeded grid, never to a grid
the squadron has already written.

## Approval is not guarded, and there is no "me"

Anyone using this prototype can approve or refuse anyone's bid, and anyone can
bid on anyone's row. There is no login, no role and no signed-in person, which
follows from deferring accounts to the backend (owner, 9 Aug 26). **Do not
present this as a security model** — it is the absence of one.

The bidding plan called for a fixed `ME` roster entry standing in for a
session. That was not built: the tests bid on whichever row was clicked, so an
`ME` constant would have been dead code claiming an identity model that does
not exist. A real one arrives with accounts. Until then the app is honest
about being a scheduler's view of everybody rather than a bidder's view of
themselves.

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
  does. Now slightly larger a trap than it was, since a bare `initStore()`
  would read `leavewar:states` and `leavewar:stage` from the same store.
- The DOM ceiling in the geometry gate is 2500 against a measured 2330.
  Raising it is meant to be a deliberate edit in whichever change adds the
  nodes, not a reflex when it goes red. Note the selector's blind spot: it
  counts `.mx *`, and the bid sheet renders outside the table, so it adds
  nothing to that figure. The same test therefore also counts the whole
  document with the sheet open (2384, ceiling 2600).
- `setCell` stores an empty row object for a person whose last state is
  cleared, so `states.ramp` can be `{}` rather than absent. Every reader uses
  `stateOf`, which is indifferent, and `initStore` prunes empty rows on the
  next load. Worth knowing before someone reads a persisted blob and
  concludes a row means something.
