# Start here

LEAVE WAR is a leave-bidding system for a fighter squadron, replacing a
spreadsheet the squadron uses to bid for leave a quarter ahead. This file says
where the work stopped and what comes next, so a session picking it up cold does
not have to reconstruct it from `git log`.

**State as of 9 Aug 26.** 217 unit tests, 24 Playwright runs (12 tests across a
phone and a desktop project), clean build, all verified first-hand. Work sits on
`claude/bidding-plan-continuation-vqnrfz`, branched from `main`. Working tree
clean.

## What exists

The roster, the matrix, and a rules engine that turns days amber and red as
manning thins. Availability is fractional — a half day removes 0.5 of a person,
which is the central thing the spreadsheet could not do. Raptor's dark visual
language throughout.

**The squadron can now bid, and management can now decide.** That was the gap
this branch closed. A cell carries a leave type and a portion; a bid carries a
state on top of it, in the squadron's three colours. The period walks draft →
open → closed → published, forward only, and what a click on a cell does
follows from where the period stands: bidding while open, approving or refusing
once closed, nothing at all once published.

Two rulings are visible on screen rather than merely written down:

- **A pending bid counts as away.** The manning counts show the worst case —
  what happens if everything asked for is granted — because that is what warns a
  scheduler while there is still time to act.
- **A refused bid removes nobody.** He asked, he was told no, he is at work. A
  refusal visibly pulls a day back from red, which is what lets management see
  the effect of a decision as they make it.

## What to read, in order

| File | Why |
|---|---|
| `docs/superpowers/specs/2026-08-09-leave-war-design.md` | The approved design. Start here — it explains the domain, not just the code |
| `docs/known-gaps.md` | Limitations and rulings already made. **Read before proposing anything**, or you will relitigate a settled decision |
| `docs/superpowers/plans/2026-08-09-leave-war-bidding.md` | **Done.** Kept for the reasoning; see the note below on where execution departed from it |

## Where the bidding plan and the code differ

The plan's header already flagged five places it predated the leave-code
rework. Four more differences arose in execution, each deliberate:

- **The picker is a bottom sheet, not a popover in the cell.** The plan's
  `.bidpop` inside a `<td>` is clipped by `.mx-wrap`'s scroller — proven, not
  assumed: rendering it that way makes the sheet invisible on both browser
  projects, which is what the new e2e test pins.
- **No `ME` constant.** The plan called for a fixed current user; that would
  have been dead code, since a bid is placed on whichever row was clicked. See
  `docs/known-gaps.md`.
- **`setCell` resets a decision when the code CHANGES.** The plan kept any
  existing state unless the cell was cleared. Re-typing `LL` over an approved
  `LL` still keeps the approval; turning it into `OL` does not, because nobody
  approved a week overseas by approving a day of local leave.
- **`initStore` reconciles the grid and the states.** The plan left load
  unguarded. The parallel map's one weakness is drift, and load is where drift
  arrives from outside `setCell`, so a stored state whose cell no longer holds
  a bid is dropped.

The plan also assumed a `Chrome` component; the file exports `Topbar` and
`StageBar`, and the stage control went into `StageBar`.

## Next

Leave balances and the OIL ledger, then the Raptor contract document. The
design for both is in the spec. Three smaller things the bidding work left
behind are in `docs/known-gaps.md`: the day verdict is computed and still not
shown in words, `title` tooltips still do not exist on touch, and a cell is
not reachable from the keyboard.

## How this project has actually found its defects

Worth knowing, because it is not the obvious way.

A subagent per task, a separate reviewer reading only that task's diff, then a
fix round that must **prove the new test fails against the specific bug it
guards** before the fix is accepted.

Every real defect found here came from the review step. None came from the suite
going red. Among them: a member who had not yet arrived being labelled *posted
out*; count rows matching figures to their labels by array position, so a
per-day rule override would have shown one rule's number under another's name;
and a sticky-header test that could not scroll, and therefore passed against a
header with `position: sticky` removed entirely.

The recurring failure class is **tests that cannot fail**. Treat a new test as
unproven until it has been seen red.

The bidding branch was built by mutating the implementation under each new test
and checking the right test went red. That caught three of its own tests
passing vacuously, each fixed rather than kept:

- a store test claiming to exercise the stored-states validator, which never
  reached it — with no stored grid, the states key is not consulted at all;
- a picker test claiming the portion resets between cells, which proved nothing
  because choosing a code unmounts the sheet either way;
- a matrix test named for a branch ordering that cannot be observed, since duty
  codes are never biddable.

Two guards survived every probe and are documented as belt-and-braces rather
than dressed up as tested: the plain-object check inside the states validator,
and the duty-before-bid branch order in `Matrix.tsx`.

## Two things not to relitigate

Both are in `docs/known-gaps.md` with the reasoning:

- **Approval is unguarded** — there is no login, so anyone can approve any bid,
  and anyone can bid on any row. This follows from deferring accounts to the
  backend. Do not present it as a security model.
- **Nothing reaches Raptor yet.** Raptor needs five new leave types and a portion
  field before it can receive most of what this app produces. The owner intends
  to make that change; the contract it should be built against is the next
  planned document.

## Running it

```
npm install
npm run dev                 # or: npm run build && npx vite preview --port 4173
npx vitest run              # 217 tests
npm run test:e2e            # 24 runs, phone and desktop
npm run build               # typecheck + production build
```

The browser gate is not optional decoration. jsdom applies no layout and reports
every rectangle as 0×0, so the unit suite can prove which class was emitted and
nothing about what was painted. The frozen callsign column, the sticky header
and the bid sheet's escape from the grid's scroller are only ever verified
there.
