# Start here

LEAVE WAR is a leave-bidding system for a fighter squadron, replacing a
spreadsheet the squadron uses to bid for leave a quarter ahead. This file says
where the work stopped and what comes next, so a session picking it up cold does
not have to reconstruct it from `git log`.

**State as of 9 Aug 26.** 336 unit tests, 48 Playwright runs (24 tests across a
phone and a desktop project), clean build, all verified first-hand. Work sits on
`claude/bidding-plan-continuation-vqnrfz`, branched from `main`.

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
Seven counters, one frozen column showing one of them at a time, cycled from
its own header. A pending bid draws its counter down immediately, so nobody
can ask for leave they have already asked for; a refusal gives it back.

**Both directions of the Raptor sync are modelled**, though neither wire
exists. Leave entered on Raptor's input tab arrives already approved — putting
it there means the person asked verbally and was told yes — and Raptor owns
those cells thereafter.

Four rulings are visible on screen rather than merely written down:

- **A pending bid counts as away**, in the manning counts and in the balance
  alike. Both show the worst case, because that is what warns someone while
  there is still time to act.
- **A refused bid removes nobody.** He asked, he was told no, he is at work.
- **A shift lands pending, not approved.** Moving a bid is a proposal with a
  trail; someone still approves the date it moved to.
- **Negative balances are shown, never refused.** They already run negative in
  the squadron's own workbook.

## What to read, in order

| File | Why |
|---|---|
| `docs/superpowers/specs/2026-08-09-leave-war-design.md` | The approved design, kept current. Start here — it explains the domain, not just the code |
| `docs/known-gaps.md` | Limitations and rulings already made. **Read before proposing anything**, or you will relitigate a settled decision |
| `docs/superpowers/plans/2026-08-09-leave-war-bidding.md` | Done. Kept for the reasoning only |

## Next

**The shared backend.** It has been the one thing blocking squadron use since
the beginning, and this branch sharpened it: a bid nobody else can see is not
a bid, and an approval in a private browser store is a decision that never
reached anyone. Everything is built so that change lands in
`src/state/storage.ts` and nowhere else.

Then, in rough order:

- **More than one period.** A period is a date range the admin chooses, down
  to a single month (settled 9 Aug 26). The engine already handles any span —
  `Period` has free `start`/`end` and `buildDays` builds any range — so what
  is missing is *multiplicity and selection*: a set of periods with one open,
  and the surface to create and open them. Today there is exactly one and no
  picker.
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

And two defects found only by **measuring in a real browser**, which is why
the geometry gate is not optional decoration:

- The tightened callsign column clipped "Crew sets" and "IP + IWSO" mid-word
  on a phone, while every callsign still fitted.
- The fix for that silently did nothing, because the breakpoint sat above the
  rules it was narrowing and lost the cascade. Same trap the
  `.blocked`/`.weekend` comment already warns about.

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
npx vitest run              # 336 tests
npm run test:e2e            # 48 runs, phone and desktop
npm run build               # typecheck + production build
```

The browser gate is not optional decoration, and this branch is the proof.
jsdom applies no layout and reports every rectangle as 0×0, so the unit suite
can prove which class was emitted and nothing about what was painted. The two
frozen columns, the sticky header, the bid sheet's escape from the grid's
scroller, and whether any label is cut off are only ever verified there.
