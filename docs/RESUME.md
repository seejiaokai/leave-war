# Start here

LEAVE WAR is a leave-bidding system for a fighter squadron, replacing a
spreadsheet the squadron uses to bid for leave a quarter ahead. This file says
where the work stopped and what comes next, so a session picking it up cold does
not have to reconstruct it from `git log`.

**State as of 10 Aug 26.** 405 unit tests, 56 Playwright runs (28 tests across
a phone and a desktop project), clean build, all verified first-hand. Work sits
on `claude/bidding-plan-continuation-vqnrfz`, branched from `main`.

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

**Both directions of the Raptor sync are modelled**, though neither wire
exists. Leave entered on Raptor's input tab arrives already approved — putting
it there means the person asked verbally and was told yes — and Raptor owns
those cells thereafter.

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

Three smaller debts are in `docs/known-gaps.md`: the day verdict is computed
and still not shown in words, `title` tooltips still do not exist on touch,
and a cell is not reachable from the keyboard.

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
npx vitest run              # 405 tests
npm run test:e2e            # 56 runs, phone and desktop
npm run build               # typecheck + production build
```

The browser gate is not optional decoration, and this branch is the proof.
jsdom applies no layout and reports every rectangle as 0×0, so the unit suite
can prove which class was emitted and nothing about what was painted. The two
frozen columns, the sticky header, each sheet's escape from the element that
would clip it, and whether any label is cut off are only ever verified there.
